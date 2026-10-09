/**
 * Cada item é uma migration. NUNCA altere uma já existente:
 * para mudar o esquema, adicione um novo item ao final.
 */
export const migrations: string[] = [
  // 1 — esquema inicial
  `
  CREATE TABLE bancos (
    id         INTEGER PRIMARY KEY,
    nome       TEXT    NOT NULL,
    cor        TEXT    NOT NULL,
    ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE cartoes (
    id              INTEGER PRIMARY KEY,
    banco_id        INTEGER NOT NULL UNIQUE REFERENCES bancos(id),
    dia_fechamento  INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento  INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
  );

  CREATE TABLE dinheiro_fisico (
    mes            TEXT    PRIMARY KEY,
    valor_centavos INTEGER NOT NULL
  );

  CREATE TABLE saldos (
    mes            TEXT    NOT NULL,
    banco_id       INTEGER NOT NULL REFERENCES bancos(id),
    valor_centavos INTEGER NOT NULL,
    PRIMARY KEY (mes, banco_id)
  );

  CREATE TABLE faturas (
    mes            TEXT    NOT NULL,
    cartao_id      INTEGER NOT NULL REFERENCES cartoes(id),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
    paga           INTEGER NOT NULL DEFAULT 0 CHECK (paga IN (0, 1)),
    PRIMARY KEY (mes, cartao_id)
  );
  `,

  // 2 — limite do cartão de crédito (opcional)
  `
  ALTER TABLE cartoes ADD COLUMN limite_centavos INTEGER CHECK (limite_centavos >= 0);
  `,

  // 3 — movimentações manuais do dinheiro físico (entradas > 0, saídas < 0)
  `
  CREATE TABLE movimentacoes_dinheiro (
    id             INTEGER PRIMARY KEY,
    mes            TEXT    NOT NULL,
    data           TEXT    NOT NULL,
    descricao      TEXT    NOT NULL DEFAULT '',
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos <> 0),
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_movimentacoes_mes ON movimentacoes_dinheiro (mes);
  `,

  // 4 — movimentações também em bancos (banco_id NULL = dinheiro físico)
  `
  ALTER TABLE movimentacoes_dinheiro ADD COLUMN banco_id INTEGER REFERENCES bancos(id);
  `,

  // 5 — "outros dinheiros" (aplicações etc.): contas sem cartão, guardadas junto com os bancos
  `
  ALTER TABLE bancos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'banco' CHECK (tipo IN ('banco', 'outro'));
  `,

  // 6 — moeda dos "outros dinheiros" + cotação mensal (taxa = reais por 1 unidade × 10000)
  `
  ALTER TABLE bancos ADD COLUMN moeda TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL', 'USD', 'EUR'));
  CREATE TABLE cotacoes (
    mes   TEXT    NOT NULL,
    moeda TEXT    NOT NULL CHECK (moeda IN ('USD', 'EUR')),
    taxa  INTEGER NOT NULL CHECK (taxa > 0),
    PRIMARY KEY (mes, moeda)
  );
  `,

  // 7 — ouro (XAU) e prata (XAG) em gramas: recria bancos/cotacoes para ampliar o CHECK de moeda
  `
  CREATE TABLE bancos_novo (
    id         INTEGER PRIMARY KEY,
    nome       TEXT    NOT NULL,
    cor        TEXT    NOT NULL,
    ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em  TEXT    NOT NULL DEFAULT (datetime('now')),
    tipo       TEXT    NOT NULL DEFAULT 'banco' CHECK (tipo IN ('banco', 'outro')),
    moeda      TEXT    NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL', 'USD', 'EUR', 'XAU', 'XAG'))
  );
  INSERT INTO bancos_novo (id, nome, cor, ativo, criado_em, tipo, moeda)
    SELECT id, nome, cor, ativo, criado_em, tipo, moeda FROM bancos;
  DROP TABLE bancos;
  ALTER TABLE bancos_novo RENAME TO bancos;

  CREATE TABLE cotacoes_nova (
    mes   TEXT    NOT NULL,
    moeda TEXT    NOT NULL CHECK (moeda IN ('USD', 'EUR', 'XAU', 'XAG')),
    taxa  INTEGER NOT NULL CHECK (taxa > 0),
    PRIMARY KEY (mes, moeda)
  );
  INSERT INTO cotacoes_nova SELECT mes, moeda, taxa FROM cotacoes;
  DROP TABLE cotacoes;
  ALTER TABLE cotacoes_nova RENAME TO cotacoes;
  `,
];
