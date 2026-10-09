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
| POST/DELETE | `/api/lancamentos/:mes/movimentacoes[/:id]` | Entrada/saída de dinheiro físico (soma/subtrai na hora; remover desfaz) |
| GET | `/api/resumo/:mes` | Totais, variação, distribuição, faturas |
| GET | `/api/historico/:mes?n=12` | Evolução dos últimos N meses |
| GET | `/api/vencimentos` | Faturas não pagas, por data de vencimento |
| GET | `/api/meses` | Meses com lançamento |

**Desativar × excluir:** desativar esconde o banco dos lançamentos novos e mantém o histórico.
Excluir apaga tudo (os totais de meses passados mudam). Faça um `npm run backup` antes, por garantia.

**Movimentações de dinheiro físico:** na tela de Lançamento, registre entradas e saídas do dia (valor, data, descrição);
o total do dinheiro físico do mês é atualizado na hora. Remover uma movimentação desfaz o valor.

**Pagar fatura:** ao marcar "Paga" e salvar, o valor é descontado do saldo do banco do cartão naquele mês;
ao desmarcar, é devolvido. Mudar o valor de uma fatura já paga ajusta a diferença.

Regras: vencimento = mês + dia de vencimento do cartão (dia 31 vira o último dia em meses curtos).
Total disponível = físico + saldos · Total devido = faturas não pagas · Patrimônio = disponível − devido.
