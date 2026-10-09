import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
};

export function exigir(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new HttpError(400, msg);
}

export const ehCentavos = (v: unknown): v is number => Number.isSafeInteger(v);
export const ehDia = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31;
export const ehCor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
