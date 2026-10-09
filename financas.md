# Projeto: Dashboard de Finanças Pessoais (mensal)

## Objetivo
Crie um sistema web local de finanças pessoais. NÃO é um controle de gastos:
eu não registro cada pagamento. Eu registro apenas, mês a mês, **quanto dinheiro
eu tenho** e **quanto eu devo em cartões de crédito**.

## Regras de negócio
1. **Dinheiro físico**: um valor por mês (dinheiro em espécie).
2. **Bancos**: eu cadastro cada banco manualmente (nome, cor de identificação).
   - Posso adicionar, editar e desativar bancos (desativar, não apagar, para manter o histórico).
   - Cada banco tem um **saldo por mês**.
3. **Cartões de crédito**: cada banco pode ter um cartão.
   - Cada cartão tem **dia de fechamento** (opcional) e **dia de vencimento** próprios.
   - Para cada mês eu informo o **valor da fatura** e marco se já foi **paga**.
4. **Visão mensal**: todos os valores pertencem a um mês (formato YYYY-MM).
   - Botão "Copiar mês anterior" para iniciar um novo mês com os valores do mês passado e eu só ajustar.
5. **Cálculos por mês**:
   - Total disponível = dinheiro físico + soma dos saldos bancários
   - Total devido = soma das faturas não pagas
   - Patrimônio líquido = total disponível − total devido
   - Variação em relação ao mês anterior (valor e %)

## Dashboard (moderno)
- Seletor de mês no topo (setas ← → e dropdown).
- Cards de resumo: Total disponível, Total devido, Patrimônio líquido, Variação vs mês anterior.
- Gráfico de pizza/donut: distribuição do dinheiro (físico + cada banco, usando a cor do banco).
- Gráfico de linha: evolução mensal de disponível, devido e patrimônio líquido (últimos 12 meses).
- Gráfico de barras: fatura por cartão no mês.
- Lista "Próximos vencimentos": faturas não pagas ordenadas pela data, com destaque
  para vencidas (vermelho) e que vencem em até 7 dias (amarelo).
- Tema escuro por padrão, com opção de claro. Layout responsivo (funcionar no celular).

## Telas
1. **Dashboard** (descrito acima)
2. **Lançamento do mês**: formulário com dinheiro físico, saldo de cada banco ativo
   e fatura de cada cartão (com checkbox "paga").
3. **Bancos e cartões**: CRUD de bancos e configuração dos cartões (dias de fechamento/vencimento).

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + Recharts
- Backend: Node.js + Express + TypeScript
- Banco de dados: SQLite (better-sqlite3), arquivo local
- Valores monetários armazenados como **inteiros em centavos** (nunca float)
- Interface em português, moeda em BRL (formato R$ 1.234,56), datas em pt-BR

## Modelo de dados sugerido
- `bancos` (id, nome, cor, ativo, criado_em)
- `cartoes` (id, banco_id, dia_fechamento, dia_vencimento, ativo)
- `dinheiro_fisico` (mes, valor_centavos) — único por mês
- `saldos` (mes, banco_id, valor_centavos) — único por (mes, banco_id)
- `faturas` (mes, cartao_id, valor_centavos, paga) — único por (mes, cartao_id)
  - a data de vencimento é derivada de `mes` + `dia_vencimento` (tratar meses com menos dias)

## Forma de trabalho (IMPORTANTE)
- Trabalhe de forma **incremental**, uma etapa por vez.
- Antes de começar, mostre a estrutura de pastas e o plano de etapas.
- Ao fim de cada etapa: diga exatamente quais comandos eu devo rodar no terminal
  e **pare**. Eu vou colar a saída do terminal e só então você segue.
- Etapas sugeridas:
  1. Setup do projeto (monorepo simples: /server e /web) e scripts de dev
  2. Banco SQLite + migrations + seed de exemplo
  3. API REST (bancos, cartões, lançamentos do mês, resumo mensal, histórico)
  4. Tela de bancos e cartões
  5. Tela de lançamento do mês + "copiar mês anterior"
  6. Dashboard com cards e gráficos
  7. Próximos vencimentos + polimento visual e responsividade
- Explique brevemente conceitos novos antes do código, sem textos longos.
- Inclua um README com como rodar e como fazer backup do arquivo SQLite.