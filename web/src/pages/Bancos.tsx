import { useState, type FormEvent } from "react";
import { CampoMoeda } from "../components/CampoMoeda";
import { Aviso, Botao, Bolinha, Painel, inputClasse } from "../components/ui";
import { api, type Banco, type BancoEntrada, type TipoConta } from "../lib/api";
import { NOME_MOEDA, SIMBOLO, formatarBRL, type Moeda } from "../lib/formato";
import { useApi } from "../lib/useApi";

const CORES_SUGERIDAS = ["#8A05BE", "#EC7000", "#F5C400", "#0070AF", "#CC092F", "#FF7A00", "#00A868", "#1E3A8A", "#64748B"];

export function BancosPage() {
  const { dados: bancos, erro, carregando, recarregar } = useApi(api.bancos, []);
  const [editando, setEditando] = useState<Banco | TipoConta | null>(null);
  const [excluindo, setExcluindo] = useState<Banco | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const ativosDo = (tipo: TipoConta) => bancos?.filter((b) => b.ativo && b.tipo === tipo) ?? [];
  const inativos = bancos?.filter((b) => !b.ativo) ?? [];

  async function alternarAtivo(b: Banco) {
    setErroAcao(null);
    try {
      await api.atualizarBanco(b.id, { ativo: !b.ativo });
      recarregar();
    } catch (e) {
      setErroAcao((e as Error).message);
    }
  }

  const cards = (lista: Banco[]) =>
    lista.map((b) => (
      <CardBanco key={b.id} banco={b} onEditar={() => setEditando(b)} onAlternar={() => alternarAtivo(b)} onExcluir={() => setExcluindo(b)} />
    ));

  const secao = (tipo: TipoConta, titulo: string, botao: string, vazio: string) => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <Botao variante="primario" onClick={() => setEditando(tipo)}>
          {botao}
        </Botao>
      </div>
      {bancos && ativosDo(tipo).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{vazio}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards(ativosDo(tipo))}</div>
    </section>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Bancos e cartões</h1>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando && !bancos && <p className="text-slate-500">Carregando...</p>}

      {secao("banco", "Bancos", "+ Novo banco", "Nenhum banco ativo.")}
      {secao("outro", "Poupança", "+ Nova poupança", "Nenhuma poupança cadastrada (ex.: Tesouro Direto, CDB).")}

      {inativos.length > 0 && (
        <div>
          <button className="text-sm text-slate-500 hover:underline" onClick={() => setMostrarInativos((v) => !v)}>
            {mostrarInativos ? "▾" : "▸"} Inativos ({inativos.length})
          </button>
          {mostrarInativos && <div className="mt-3 grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">{cards(inativos)}</div>}
        </div>
      )}

      {excluindo && (
        <ConfirmarExclusao
          banco={excluindo}
          onFechar={() => setExcluindo(null)}
          onExcluido={() => {
            setExcluindo(null);
            recarregar();
          }}
        />
      )}

      {editando && (
        <FormBanco
          banco={typeof editando === "string" ? null : editando}
          tipo={typeof editando === "string" ? editando : editando.tipo}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function CardBanco({ banco, onEditar, onAlternar, onExcluir }: { banco: Banco; onEditar: () => void; onAlternar: () => void; onExcluir: () => void }) {
  const c = banco.cartao;
  return (
    <Painel className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: banco.cor }} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bolinha cor={banco.cor} className="size-4" />
          <h3 className="text-lg font-semibold">{banco.nome}</h3>
        </div>
        {!banco.ativo && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800">Inativo</span>}
      </div>

      <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {banco.tipo === "outro" ? (
          <p>
            💰 {NOME_MOEDA[banco.moeda]} ({SIMBOLO[banco.moeda]})
          </p>
        ) : c && c.ativo ? (
          <>
            <p>
              💳 Cartão: {c.dia_fechamento ? `fecha dia ${c.dia_fechamento} · ` : ""}vence dia {c.dia_vencimento}
            </p>
            <p className="mt-1">Limite: {c.limite_centavos !== null ? <b className="text-slate-800 dark:text-slate-200">{formatarBRL(c.limite_centavos)}</b> : "não informado"}</p>
          </>
        ) : (
          <p>Sem cartão de crédito</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Botao onClick={onEditar}>Editar</Botao>
        <Botao variante={banco.ativo ? "perigo" : "secundario"} onClick={onAlternar}>
          {banco.ativo ? "Desativar" : "Reativar"}
        </Botao>
        <Botao variante="fantasma" onClick={onExcluir} className="ml-auto text-red-600 dark:text-red-400" aria-label={`Excluir ${banco.nome}`}>
          🗑 Excluir
        </Botao>
      </div>
    </Painel>
  );
}

function FormBanco({ banco, tipo, onFechar, onSalvo }: { banco: Banco | null; tipo: TipoConta; onFechar: () => void; onSalvo: () => void }) {
  const cartaoAtual = banco?.cartao?.ativo ? banco.cartao : null;
  const [nome, setNome] = useState(banco?.nome ?? "");
  const [cor, setCor] = useState(banco?.cor ?? CORES_SUGERIDAS[0]);
  const [moeda, setMoeda] = useState<Moeda>(banco?.moeda ?? "BRL");
  const [temCartao, setTemCartao] = useState(!!cartaoAtual);
  const [fechamento, setFechamento] = useState(cartaoAtual?.dia_fechamento?.toString() ?? "");
  const [vencimento, setVencimento] = useState(cartaoAtual?.dia_vencimento?.toString() ?? "");
  const [limite, setLimite] = useState<number | null>(cartaoAtual?.limite_centavos ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const venc = Number(vencimento);
    const fech = fechamento ? Number(fechamento) : null;
    if (temCartao && !(venc >= 1 && venc <= 31)) return setErro("Informe o dia de vencimento (1 a 31).");
    if (temCartao && fech !== null && !(fech >= 1 && fech <= 31)) return setErro("Dia de fechamento deve ser entre 1 e 31.");

    const dados: BancoEntrada = {
      ...(banco ? {} : { tipo }),
      ...(tipo === "outro" ? { moeda } : {}),
      nome,
      cor,
      // sem cartão: no banco novo não envia; no existente envia null (desativa o cartão)
      cartao: temCartao ? { dia_vencimento: venc, dia_fechamento: fech, limite_centavos: limite, ativo: true } : banco?.cartao ? null : undefined,
    };

    setSalvando(true);
    try {
      if (banco) await api.atualizarBanco(banco.id, dados);
      else await api.criarBanco(dados);
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onFechar}>
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">{banco ? `Editar ${banco.nome}` : tipo === "outro" ? "Nova poupança" : "Novo banco"}</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Nome</span>
          <input className={inputClasse} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        </label>

        <div className="space-y-1">
          <span className="text-sm font-medium">Cor de identificação</span>
          <div className="flex flex-wrap items-center gap-2">
            {CORES_SUGERIDAS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCor(c)}
                className={`size-8 rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-slate-900 ${cor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-emerald-500" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded" aria-label="Cor personalizada" />
          </div>
        </div>

        {tipo === "outro" && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Moeda</span>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
              {(["BRL", "USD", "EUR"] as Moeda[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoeda(m)}
                  aria-pressed={moeda === m}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    moeda === m
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {NOME_MOEDA[m]} ({SIMBOLO[m]})
                </button>
              ))}
            </div>
            {banco && moeda !== banco.moeda && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Os valores já lançados não são convertidos: passam a ser lidos em {NOME_MOEDA[moeda]}.</p>
            )}
          </div>
        )}

        {tipo === "banco" && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={temCartao} onChange={(e) => setTemCartao(e.target.checked)} className="size-4 accent-emerald-600" />
          Possui cartão de crédito
        </label>
        )}

        {tipo === "banco" && temCartao && (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Dia de fechamento <span className="text-slate-400">(opcional)</span></span>
              <input className={inputClasse} type="number" min={1} max={31} value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Dia de vencimento</span>
              <input className={inputClasse} type="number" min={1} max={31} value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="text-sm">Limite do cartão <span className="text-slate-400">(opcional)</span></span>
              <CampoMoeda aria-label="Limite do cartão" valor={limite} onChange={setLimite} />
            </label>
          </div>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex justify-end gap-2 pt-2">
          <Botao type="button" variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Botao>
        </div>
      </form>
    </div>
  );
}

function ConfirmarExclusao({ banco, onFechar, onExcluido }: { banco: Banco; onFechar: () => void; onExcluido: () => void }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // com histórico, exige digitar o nome do banco para confirmar
  const exigeNome = banco.lancamentos > 0;
  const liberado = !exigeNome || confirmacao.trim().toLowerCase() === banco.nome.trim().toLowerCase();

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      await api.excluirBanco(banco.id);
      onExcluido();
    } catch (e) {
      setErro((e as Error).message);
      setExcluindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-red-200 bg-white p-5 shadow-2xl dark:border-red-900/60 dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Excluir {banco.nome}?</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Isso apaga <b>definitivamente</b> o banco{banco.cartao ? ", o cartão" : ""}
          {banco.lancamentos > 0 ? (
            <>
              {" "}e <b>{banco.lancamentos} {banco.lancamentos === 1 ? "lançamento" : "lançamentos"}</b> (saldos e faturas de todos os meses). Os totais dos meses
              anteriores vão mudar.
            </>
          ) : (
            ". Ele não tem lançamentos."
          )}
        </p>
        {banco.lancamentos > 0 && banco.ativo && (
          <Aviso>Se você só não usa mais esse banco, prefira <b>Desativar</b>: ele some dos lançamentos novos e o histórico continua.</Aviso>
        )}
        {exigeNome && (
          <label className="block space-y-1">
            <span className="text-sm">
              Digite <b>{banco.nome}</b> para confirmar
            </span>
            <input className={inputClasse} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoFocus />
          </label>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="excluir" onClick={excluir} disabled={!liberado || excluindo}>
            {excluindo ? "Excluindo..." : "Excluir definitivamente"}
          </Botao>
        </div>
      </div>
    </div>
  );
}
