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
];
