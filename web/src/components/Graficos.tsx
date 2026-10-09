import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTema } from "../contexts/Tema";
import type { FaturaDetalhe, Totais } from "../lib/api";
import { formatarBRL, formatarCompacto } from "../lib/formato";
import { nomeMesCurto } from "../lib/mes";

/** Cores do "chrome" dos gráficos (eixos, grade, superfície) e das 3 séries de evolução, por tema. */
function useCores() {
  const { tema } = useTema();
  return tema === "escuro"
    ? { grade: "#1e293b", eixo: "#94a3b8", superficie: "#0f172a", disponivel: "#3987e5", devido: "#d95926", patrimonio: "#199e70" }
    : { grade: "#e2e8f0", eixo: "#64748b", superficie: "#ffffff", disponivel: "#2a78d6", devido: "#eb6834", patrimonio: "#1baf7a" };
}

interface ItemTooltip {
  name?: string | number;
  value?: number | string | null;
  color?: string;
  payload?: { cor?: string; fill?: string };
}

function CaixaTooltip({ active, payload, label }: { active?: boolean; payload?: ItemTooltip[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: p.payload?.cor ?? p.color }} />
          <span>{p.name}:</span>
          <b className="ml-auto tabular-nums text-slate-900 dark:text-slate-100">
            {typeof p.value === "number" ? formatarBRL(p.value) : "sem dados"}
          </b>
        </p>
      ))}
    </div>
  );
}

const Vazio = ({ texto }: { texto: string }) => (
  <div className="grid h-64 place-items-center text-sm text-slate-500 dark:text-slate-400">{texto}</div>
);

/** Donut: distribuição do dinheiro + legenda-tabela com valor e %. */
export function GraficoDistribuicao({ dados }: { dados: { nome: string; cor: string; valor: number }[] }) {
  const cores = useCores();
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total <= 0) return <Vazio texto="Sem saldos positivos neste mês." />;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="62%" outerRadius="92%" paddingAngle={1} stroke={cores.superficie} strokeWidth={2}>
              {dados.map((d) => (
                <Cell key={d.nome} fill={d.cor} />
              ))}
            </Pie>
            <Tooltip content={<CaixaTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-sm font-semibold tabular-nums">{formatarCompacto(total)}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {dados.map((d) => (
          <li key={d.nome} className="flex items-center gap-2">
            <span className="inline-block size-3 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
            <span className="truncate">{d.nome}</span>
            <span className="ml-auto text-xs text-slate-500 tabular-nums dark:text-slate-400">{((d.valor / total) * 100).toFixed(1).replace(".", ",")}%</span>
            <span className="w-28 text-right font-medium tabular-nums">{formatarBRL(d.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Linha: evolução de disponível, devido e patrimônio. Meses sem dados ficam em branco (sem ligar a linha). */
export function GraficoEvolucao({ historico }: { historico: Totais[] }) {
  const cores = useCores();
  if (!historico.some((h) => h.temDados)) return <Vazio texto="Sem histórico ainda." />;

  // corta os meses vazios do início (antes do primeiro lançamento)
  const inicio = historico.findIndex((h) => h.temDados);
  const dados = historico.slice(inicio).map((h) => ({
    rotulo: nomeMesCurto(h.mes),
    disponivel: h.temDados ? h.disponivel : null,
    devido: h.temDados ? h.devido : null,
    patrimonio: h.temDados ? h.patrimonio : null,
  }));

  const series = [
    { chave: "disponivel", nome: "Disponível", cor: cores.disponivel },
    { chave: "devido", nome: "Devido", cor: cores.devido },
    { chave: "patrimonio", nome: "Patrimônio líquido", cor: cores.patrimonio },
  ];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} />
          <XAxis dataKey="rotulo" stroke={cores.eixo} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis stroke={cores.eixo} tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={formatarCompacto} />
          <Tooltip content={<CaixaTooltip />} cursor={{ stroke: cores.eixo, strokeDasharray: "3 3" }} />
          <Legend itemSorter={null} iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s) => (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={2}
              dot={{ r: 3, fill: s.cor, stroke: cores.superficie, strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: cores.superficie, strokeWidth: 2 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras: valor da fatura de cada cartão no mês (cor do banco; faturas pagas ficam esmaecidas). */
export function GraficoFaturas({ faturas }: { faturas: FaturaDetalhe[] }) {
  const cores = useCores();
  const dados = faturas.filter((f) => f.valor_centavos > 0);
  if (dados.length === 0) return <Vazio texto="Nenhuma fatura neste mês." />;

  const linhas = dados.map((f) => ({ nome: f.banco_nome + (f.paga ? " ✓" : ""), valor: f.valor_centavos, cor: f.cor, paga: f.paga }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} />
          <XAxis dataKey="nome" stroke={cores.eixo} tickLine={false} axisLine={false} fontSize={12} interval={0} />
          <YAxis stroke={cores.eixo} tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={formatarCompacto} />
          <Tooltip content={<CaixaTooltip />} cursor={{ fill: cores.grade, opacity: 0.5 }} />
          <Bar dataKey="valor" name="Fatura" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {linhas.map((l) => (
              <Cell key={l.nome} fill={l.cor} fillOpacity={l.paga ? 0.35 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">✓ = fatura paga (barra esmaecida)</p>
    </div>
  );
}
