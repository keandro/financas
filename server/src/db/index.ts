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

  db.transaction(() => {
    pendentes.forEach((sql) => db.exec(sql));
    db.pragma(`user_version = ${migrations.length}`);
  })();
  console.log(`[db] migrations aplicadas: ${atual + 1}..${migrations.length}`);
}

migrar();
