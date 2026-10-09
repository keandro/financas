import { createContext, useContext, useState, type ReactNode } from "react";
import { mesAtual } from "../lib/mes";

const MesCtx = createContext<{ mes: string; setMes: (m: string) => void }>({ mes: mesAtual(), setMes: () => {} });

/** Mês selecionado, compartilhado entre Dashboard e Lançamento. */
export function MesProvider({ children }: { children: ReactNode }) {
  const [mes, setMes] = useState(mesAtual);
  return <MesCtx.Provider value={{ mes, setMes }}>{children}</MesCtx.Provider>;
}

export const useMes = () => useContext(MesCtx);
