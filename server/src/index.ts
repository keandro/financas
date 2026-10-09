import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "./db/index.js";
import { tratarErros } from "./lib/http.js";
import { bancosRouter } from "./routes/bancos.js";
import { lancamentosRouter } from "./routes/lancamentos.js";
import { resumoRouter } from "./routes/resumo.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hora: new Date().toISOString() });
});

app.use("/api/bancos", bancosRouter);
app.use("/api/lancamentos", lancamentosRouter);
app.use("/api", resumoRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});
app.use(tratarErros);

// em produção (após `npm run build`), o próprio servidor entrega o site
const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("/{*rota}", (_req, res) => res.sendFile("index.html", { root: WEB_DIST }));
}

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
