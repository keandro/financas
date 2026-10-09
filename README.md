# Finanças: dashboard de finanças pessoais (mensal)

Sistema local para registrar, **mês a mês**, quanto dinheiro você tem (dinheiro físico + saldo de cada banco)
e quanto deve em cartões de crédito. Não é controle de gastos: você não lança cada compra.

**Stack:** React + Vite + TypeScript + Tailwind + Recharts (`/web`) · Node + Express + TypeScript (`/server`) · SQLite (better-sqlite3).
Valores são guardados como **inteiros em centavos**.

## Requisitos
- Node.js 20+ (testado com 22)
- Ferramentas de compilação para o `better-sqlite3` (Arch/CachyOS: `sudo pacman -S base-devel python`)

## Como rodar

```bash
npm install          # na raiz: instala server e web
npm run seed         # (opcional) dados de exemplo dos últimos 6 meses
npm run dev          # API em :3001 + site em :5173 (recarrega ao salvar arquivos)
```

Abra http://localhost:5173

### Uso no dia a dia (sem modo dev)

```bash
npm run build        # compila server e web
npm start            # um único servidor em http://localhost:3001 (API + site)
```

### Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run seed` | Cria dados de exemplo (só se o banco estiver vazio) |
| `npm run seed -- --reset` | **Apaga todos os dados** e recria o exemplo |
| `npm run backup` | Gera uma cópia do banco em `backups/` |

## Onde ficam os dados

Tudo fica em um único arquivo: **`server/data/financas.db`** (SQLite).
O esquema é criado/atualizado automaticamente ao iniciar o servidor (migrations em `server/src/db/migrations.ts`).

## Backup

**Opção 1: script (recomendado, funciona com o servidor rodando):**

```bash
npm run backup
# → backups/financas-2026-10-09-16-30-00.db
```

Ele usa a API de backup do SQLite, então a cópia é sempre consistente.

**Opção 2: copiar o arquivo manualmente:** pare o servidor (Ctrl+C) e copie
`server/data/financas.db`. Com o servidor parado, os arquivos `financas.db-wal` / `-shm`
somem ou ficam vazios. Se existirem, copie-os juntos.

**Restaurar:** pare o servidor e substitua `server/data/financas.db` pelo arquivo de backup
(apague `financas.db-wal` e `financas.db-shm` se existirem). Depois inicie de novo.

Dica: guarde a pasta `backups/` em um lugar sincronizado (Google Drive, Syncthing, etc.).

## Estrutura

```
server/src/
  index.ts            servidor Express
  db/                 conexão + migrations
  lib/                cálculos, datas (YYYY-MM), validação
  routes/             bancos, lançamentos, resumo/histórico/vencimentos
  scripts/            seed e backup
web/src/
  pages/              Dashboard, Lançamento, Bancos e cartões
  components/         gráficos, seletor de mês, campo de moeda, vencimentos
  contexts/           tema (claro/escuro) e mês selecionado
  lib/                cliente da API, formatação BRL/datas
```

## API (resumo)

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/bancos` | Lista / cria banco (com cartão opcional) |
| PUT | `/api/bancos/:id` | Edita nome, cor, ativo e cartão (dias + `limite_centavos`; `cartao: null` desativa o cartão) |
| DELETE | `/api/bancos/:id` | **Exclui definitivamente** o banco, o cartão e todos os saldos/faturas dele |
| GET/PUT | `/api/lancamentos/:mes` | Formulário do mês / salva tudo de uma vez (ajusta saldos ao pagar/despagar faturas) |
| POST/DELETE | `/api/lancamentos/:mes/movimentacoes[/:id]` | Entrada/saída do dinheiro físico (`banco_id: null`) ou de um banco (soma/subtrai na hora; remover desfaz) |
| GET | `/api/resumo/:mes` | Totais, variação, distribuição, faturas |
| GET | `/api/historico/:mes?n=12` | Evolução dos últimos N meses |
| GET | `/api/vencimentos` | Faturas não pagas, por data de vencimento |
| GET | `/api/cotacoes/atual` | Cotação atual de USD, EUR, ouro e prata (R$/g) — consulta externa |
| GET | `/api/meses` | Meses com lançamento |

**Desativar × excluir:** desativar esconde o banco dos lançamentos novos e mantém o histórico.
Excluir apaga tudo (os totais de meses passados mudam). Faça um `npm run backup` antes, por garantia.

**Poupança:** aplicações e outras reservas (Tesouro, CDB, dinheiro em outras moedas...), cadastradas em "Bancos e cartões".
Funcionam como um banco sem cartão: saldo herdado mês a mês, entradas/saídas, e entram no total disponível.
Cada um pode ser em **Real, Dólar, Euro, Ouro ou Prata** (ouro/prata em gramas, cotação em R$ por grama). Valores ficam na moeda original; para os totais, são convertidos
pela cotação do mês (informada na tela de Lançamento ou buscada em economia.awesomeapi.com.br; mês sem cotação herda a anterior).

**Virada de mês automática:** dinheiro físico e saldos passam sozinhos para os meses seguintes.
Um mês sem valor gravado herda o último valor gravado (bancos inativos não herdam). Ao mudar o valor de um mês
(edição, movimentação ou pagamento de fatura), a diferença é repassada aos meses seguintes que tenham valor próprio.

**Movimentações (entradas/saídas):** na tela de Lançamento, registre o que entrou ou saiu do dinheiro físico
ou de cada banco ("± Entradas/saídas"). O valor do mês é atualizado na hora; remover desfaz.
"Copiar faturas do mês anterior" copia apenas as faturas.

**Pagar fatura:** ao marcar "Paga" e salvar, o valor é descontado do saldo do banco do cartão naquele mês;
ao desmarcar, é devolvido. Mudar o valor de uma fatura já paga ajusta a diferença.

Regras: vencimento = mês + dia de vencimento do cartão (dia 31 vira o último dia em meses curtos).
Conta corrente: total disponível = físico + saldos bancários; patrimônio líquido = disponível − devido.
Poupança = soma das poupanças (em reais). Patrimônio total = patrimônio líquido + poupança · Total devido = faturas não pagas · Patrimônio = disponível − devido.
