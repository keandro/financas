/**
 * Cria uma cópia consistente do banco em /backups (na raiz do projeto).
 * Funciona mesmo com o servidor rodando (usa a API de backup do SQLite).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { db } from "../db/index.js";

const pasta = fileURLToPath(new URL("../../../backups", import.meta.url));
mkdirSync(pasta, { recursive: true });

const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const destino = join(pasta, `financas-${carimbo}.db`);

await db.backup(destino);
console.log(`Backup salvo em ${destino}`);
