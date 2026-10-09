import { formatarNumero } from "../lib/formato";
import { inputClasse } from "./ui";

interface Props {
  valor: number | null;
  onChange: (centavos: number | null) => void;
  permitirNegativo?: boolean;
  /** símbolo à esquerda (padrão "R$") */
  simbolo?: string;
  /** casas decimais (2 para dinheiro, 4 para cotação) */
  casas?: 2 | 4;
  id?: string;
  "aria-label"?: string;
}

/**
 * Campo de dinheiro com máscara: os dígitos entram como centavos.
 * Digitar "-" alterna o sinal (quando permitido). Campo vazio = sem valor (null).
 */
export function CampoMoeda({ valor, onChange, permitirNegativo, simbolo = "R$", casas = 2, ...rest }: Props) {
  const formatar = (v: number) =>
    casas === 2 ? formatarNumero(v) : (v / 10 ** casas).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  function mudar(texto: string) {
    const digitos = texto.replace(/\D/g, "").replace(/^0+/, "");
    if (!digitos && !texto.includes("0")) return onChange(null);
    const absoluto = Number(digitos.slice(0, 13) || "0");
    const negativo = permitirNegativo && (texto.match(/-/g)?.length ?? 0) % 2 === 1;
    onChange(negativo ? -absoluto : absoluto);
  }

  const texto = valor === null ? "" : (valor < 0 ? "-" : "") + formatar(Math.abs(valor));

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">{simbolo}</span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        placeholder={casas === 2 ? "0,00" : "0,0000"}
        value={texto}
        onChange={(e) => mudar(e.target.value)}
        onFocus={(e) => e.target.select()}
        className={`${inputClasse} ${simbolo.length > 2 ? "pl-12" : "pl-10"} text-right tabular-nums ${valor !== null && valor < 0 ? "text-red-600 dark:text-red-400" : ""}`}
      />
    </div>
  );
}
