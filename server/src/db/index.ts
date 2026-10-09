import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { migrations } from "./migrations.js";

export const DB_PATH =
  process.env.DB_PATH ?? fileURLToPath(new URL("../../data/financas.db", import.meta.url));

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** Aplica, em ordem, as migrations cuja versão é maior que a gravada no banco. */
function migrar() {
  const atual = db.pragma("user_version", { simple: true }) as number;
  const pendentes = migrations.slice(atual);
  if (pendentes.length === 0) return;

  // chaves estrangeiras desligadas durante a migração (permite recriar tabelas, receita oficial do SQLite)
  // e conferidas antes de gravar
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      pendentes.forEach((sql) => db.exec(sql));
      const problemas = db.pragma("foreign_key_check") as unknown[];
      if (problemas.length) throw new Error(`migration quebrou chaves estrangeiras: ${JSON.stringify(problemas)}`);
      db.pragma(`user_version = ${migrations.length}`);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  console.log(`[db] migrations aplicadas: ${atual + 1}..${migrations.length}`);
}

migrar();
