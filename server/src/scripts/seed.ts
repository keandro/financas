/**
 * Popula o banco com dados de exemplo dos últimos 6 meses.
 * Uso: npm run seed            (só se o banco estiver vazio)
 *      npm run seed -- --reset (APAGA tudo e recria)
 */
import { db } from "../db/index.js";
import { mesAtual, somarMeses } from "../lib/mes.js";

const reset = process.argv.includes("--reset");
const temDados = (db.prepare("SELECT COUNT(*) AS n FROM bancos").get() as { n: number }).n > 0;

if (temDados && !reset) {
  console.log("Banco já tem dados. Use `npm run seed -- --reset` para apagar e recriar.");
  process.exit(0);
}

const bancosExemplo = [
  { nome: "Nubank", cor: "#8A05BE", cartao: { fech: 8, venc: 15, limite: 6_000_00 }, saldo: 3_200_00, fatura: 1_850_00 },
  { nome: "Itaú", cor: "#EC7000", cartao: { fech: 3, venc: 10, limite: 2_500_00 }, saldo: 5_400_00, fatura: 2_300_00 },
  { nome: "Banco do Brasil", cor: "#F5C400", cartao: { fech: null, venc: 25, limite: null }, saldo: 1_750_00, fatura: 640_00 },
  { nome: "Caixa", cor: "#0070AF", cartao: null, saldo: 8_000_00, fatura: 0 },
];

db.transaction(() => {
  if (reset) {
    db.exec("DELETE FROM movimentacoes_dinheiro; DELETE FROM faturas; DELETE FROM saldos; DELETE FROM dinheiro_fisico; DELETE FROM cartoes; DELETE FROM bancos;");
  }

  const insBanco = db.prepare("INSERT INTO bancos (nome, cor) VALUES (?, ?)");
  const insCartao = db.prepare("INSERT INTO cartoes (banco_id, dia_fechamento, dia_vencimento, limite_centavos) VALUES (?, ?, ?, ?)");
  const insSaldo = db.prepare("INSERT INTO saldos (mes, banco_id, valor_centavos) VALUES (?, ?, ?)");
  const insFatura = db.prepare("INSERT INTO faturas (mes, cartao_id, valor_centavos, paga) VALUES (?, ?, ?, ?)");
  const insFisico = db.prepare("INSERT INTO dinheiro_fisico (mes, valor_centavos) VALUES (?, ?)");

  const atual = mesAtual();
  const meses = Array.from({ length: 6 }, (_, i) => somarMeses(atual, i - 5));

  for (const b of bancosExemplo) {
    const bancoId = Number(insBanco.run(b.nome, b.cor).lastInsertRowid);
    const cartaoId = b.cartao
      ? Number(insCartao.run(bancoId, b.cartao.fech, b.cartao.venc, b.cartao.limite).lastInsertRowid)
      : null;

    meses.forEach((mes, i) => {
      // variação determinística para os gráficos ficarem interessantes
      const fator = 100 + i * 4 + ((i * 7 + bancoId * 3) % 9) - 4;
      insSaldo.run(mes, bancoId, Math.round((b.saldo * fator) / 100));
      if (cartaoId) {
        const fatorF = 100 + ((i * 13 + bancoId * 5) % 25) - 12;
        const ehAtual = i === meses.length - 1;
        // mês atual: nada pago; mês anterior: Itaú ficou em aberto (para aparecer como vencida)
        const paga = ehAtual ? 0 : i === meses.length - 2 && b.nome === "Itaú" ? 0 : 1;
        insFatura.run(mes, cartaoId, Math.round((b.fatura * fatorF) / 100), paga);
      }
    });
  }

  meses.forEach((mes, i) => insFisico.run(mes, 300_00 + i * 50_00));
  console.log(`Seed concluído: ${bancosExemplo.length} bancos, meses ${meses[0]} a ${meses.at(-1)}.`);
})();
