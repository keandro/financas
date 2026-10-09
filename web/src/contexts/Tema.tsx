import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "escuro" | "claro";
const TemaCtx = createContext<{ tema: Tema; alternar: () => void }>({ tema: "escuro", alternar: () => {} });

function temaSalvo(): Tema {
  try {
    return localStorage.getItem("tema") === "claro" ? "claro" : "escuro";
  } catch {
    return "escuro";
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaSalvo);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
    try {
      localStorage.setItem("tema", tema);
    } catch {
      /* armazenamento indisponível: só não lembra a escolha */
    }
  }, [tema]);

  return (
    <TemaCtx.Provider value={{ tema, alternar: () => setTema((t) => (t === "escuro" ? "claro" : "escuro")) }}>
      {children}
    </TemaCtx.Provider>
  );
}

export const useTema = () => useContext(TemaCtx);
