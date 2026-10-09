import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MesProvider } from "./contexts/Mes";
import { TemaProvider } from "./contexts/Tema";
import { BancosPage } from "./pages/Bancos";
import { DashboardPage } from "./pages/Dashboard";
import { LancamentoPage } from "./pages/Lancamento";

export default function App() {
  return (
    <TemaProvider>
      <MesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/lancamento" element={<LancamentoPage />} />
              <Route path="/bancos" element={<BancosPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MesProvider>
    </TemaProvider>
  );
}
