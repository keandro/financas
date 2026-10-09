import { Link } from "react-router-dom";
import { GraficoDistribuicao, GraficoEvolucao, GraficoFaturas } from "../components/Graficos";
import { SeletorMes } from "../components/SeletorMes";
import { Aviso, Painel } from "../components/ui";
import { ProximosVencimentos } from "../components/Vencimentos";
import { useMes } from "../contexts/Mes";
import { api } from "../lib/api";
import { formatarBRL, formatarPct } from "../lib/formato";
import { nomeMes } from "../lib/mes";
import { useApi } from "../lib/useApi";

function CardResumo({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe?: React.ReactNode; destaque?: string }) {
  return (
    <Painel className="flex flex-col justify-between">
      <p className="text-sm text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${destaque ?? ""}`}>{valor}</p>
      {detalhe && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</div>}
    </Painel>
  );
}

export function DashboardPage() {
  const { mes } = useMes();
  const resumo = useApi(() => api.resumo(mes), [mes]);
  const historico = useApi(() => api.historico(mes, 12), [mes]);
  const vencimentos = useApi(api.vencimentos, []);

  const r = resumo.dados;
  const erro = resumo.erro ?? historico.erro ?? vencimentos.erro;

  function recarregarTudo() {
    resumo.recarregar();
    historico.recarregar();
    vencimentos.recarregar();
  }

  const v = r?.variacao;
  const sobe = v ? v.valor >= 0 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{nomeMes(mes)}</p>
        </div>
        <SeletorMes />
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {r && !r.temDados && (
        <Aviso>
          Nenhum lançamento neste mês.{" "}
          <Link to="/lancamento" className="font-medium underline">
            Lançar valores
          </Link>
        </Aviso>
      )}

      {r && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardResumo
            titulo="Total disponível"
            valor={formatarBRL(r.disponivel)}
            detalhe={`Físico ${formatarBRL(r.dinheiro_fisico)} · Bancos ${formatarBRL(r.bancos)}`}
          />
          <CardResumo titulo="Total devido" valor={formatarBRL(r.devido)} detalhe="Faturas não pagas do mês" destaque={r.devido > 0 ? "text-red-600 dark:text-red-400" : ""} />
          <CardResumo
            titulo="Patrimônio líquido"
            valor={formatarBRL(r.patrimonio)}
            detalhe="Disponível − devido"
            destaque={r.patrimonio < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
          />
          <CardResumo
            titulo="Variação vs mês anterior"
            valor={v ? `${sobe ? "▲ +" : "▼ −"}${formatarBRL(Math.abs(v.valor))}` : "—"}
            destaque={v ? (sobe ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-slate-400"}
            detalhe={v ? (v.pct !== null ? `${formatarPct(v.pct)} no patrimônio líquido` : "Mês anterior com patrimônio zero") : "Sem dados no mês anterior"}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo="Distribuição do dinheiro" className="lg:col-span-3">
          {r && <GraficoDistribuicao dados={r.distribuicao} />}
        </Painel>
        <Painel titulo="Próximos vencimentos" className="lg:col-span-2">
          {vencimentos.dados && <ProximosVencimentos faturas={vencimentos.dados} onAlterado={recarregarTudo} />}
        </Painel>
      </div>

      <Painel titulo="Evolução — últimos 12 meses">{historico.dados && <GraficoEvolucao historico={historico.dados} />}</Painel>

      <Painel titulo="Fatura por cartão no mês">{r && <GraficoFaturas faturas={r.faturas} />}</Painel>
    </div>
  );
}
