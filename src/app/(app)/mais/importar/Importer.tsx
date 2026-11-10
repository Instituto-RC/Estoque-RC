"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Wrench, Info, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parsePlanilha, type ImportPayload, type Level } from "@/lib/import/planilha";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { useLookups, friendlyError } from "@/lib/lookups";
import { brl, num } from "@/lib/format";

const LEVELS: { key: Level; label: string; icon: React.ReactNode; cls: string }[] = [
  { key: "erro", label: "Erros (linhas não importadas)", icon: <XCircle size={16} />, cls: "text-st-sem" },
  { key: "aviso", label: "Avisos (importado, revisar depois)", icon: <AlertTriangle size={16} />, cls: "text-st-quase" },
  { key: "correcao", label: "Correções automáticas", icon: <Wrench size={16} />, cls: "text-azul" },
  { key: "info", label: "Informações", icon: <Info size={16} />, cls: "text-azul-600" },
];

export function Importer() {
  const lk = useLookups();
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Level | "">("");
  const [result, setResult] = useState<Record<string, number | string> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [valRes, setValRes] = useState<{ atualizados: number; separados: number; ignorados: number; avisos: { code: string; msg: string }[] } | null>(null);

  // Somente ambiente local de testes (NEXT_PUBLIC_TEST_IMPORT_URL=1): ?arquivo=<url> carrega a planilha sem o seletor de arquivos
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_IMPORT_URL !== "1") return;
    const url = new URLSearchParams(window.location.search).get("arquivo");
    if (!url) return;
    (async () => {
      const r = await fetch(url);
      const b = await r.blob();
      onFile(new File([b], decodeURIComponent(url.split("/").pop() || "planilha.xlsx")));
    })();
  }, []);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null); setResult(null); setPayload(null); setReading(true);
    try {
      const buf = await f.arrayBuffer();
      setPayload(parsePlanilha(new Uint8Array(buf), f.name));
    } catch (e) {
      setErr("Não foi possível ler o arquivo. Envie a planilha .xlsx original. " + (e as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function doImport() {
    if (!payload) return;
    setSaving(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("import_planilha_completa", { p: payload });
    setSaving(false);
    if (error) return setErr(friendlyError(error.message));
    setResult(data as Record<string, number | string>);
  }

  async function onlyValidities() {
    if (!payload) return;
    setSaving(true); setErr(null); setValRes(null);
    const { data, error } = await createClient().rpc("aplicar_validades", { p: payload.validades });
    setSaving(false);
    if (error) return setErr(friendlyError(error.message));
    setValRes(data);
  }

  if (lk.loaded && lk.role !== "admin")
    return (<><PageHeader eyebrow="Mais" title="Importar planilha" back="/mais" /><Alert type="warn">Somente administradores podem importar a planilha.</Alert></>);

  const s = payload?.summary;
  const blocking = (s?.errors ?? 0) > 0 && payload!.products.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Mais" title="Importar planilha" back="/mais" />

      <Card>
        <p className="text-sm text-azul-600">
          Envie a <b className="text-azul">Planilha de Controle de Estoque</b> (.xlsx). Nada é gravado antes da sua confirmação. A carga pode ser refeita
          enquanto não houver movimentações lançadas pelo sistema — ela substitui a carga anterior.
        </p>
        <label className="mt-4 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-marfim bg-neve text-azul-600 hover:border-azul">
          <FileSpreadsheet size={28} />
          <span className="text-sm font-medium">{reading ? "Lendo e conferindo..." : payload ? payload.file_name : "Escolher arquivo .xlsx"}</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </Card>

      {err && <Alert type="error">{err}</Alert>}

      {result && (
        <Alert type="ok">
          <CheckCircle2 size={16} className="mr-1 inline" />
          Importação concluída: {num(Number(result.products))} produtos, {num(Number(result.entries))} entradas, {num(Number(result.exits))} saídas.
          Saldo {num(Number(result.entries_qty) - Number(result.exits_qty))} un. · Valor em estoque {brl(Number(result.entries_value) - Number(result.exits_value))}.{" "}
          <Link href="/" className="font-semibold underline">Ver painel</Link>
        </Alert>
      )}

      {s && (
        <>
          <Card title="Conferência com a planilha (RELA_GERA)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-azul-600">
                  <tr><th className="py-1">Indicador</th><th className="py-1 text-right">Planilha</th><th className="py-1 text-right">Sistema</th><th></th></tr>
                </thead>
                <tbody className="divide-y divide-marfim/70">
                  <Row label="Variedade de itens" a={s.planilha.variedade} b={s.products} fmt={num} />
                  <Row label="Quantidade em estoque" a={s.planilha.quantidade} b={s.balance_qty} fmt={num} />
                  <Row label="Total de compras" a={s.entries_value} b={s.entries_value} fmt={brl} />
                  <Row label="Total de saídas (R$)" a={s.exits_value_planilha} b={s.exits_value} fmt={brl} note="42 saídas tinham o valor calculado com a quantidade de outra linha" />
                  <Row label="Valor total em estoque" a={s.planilha.valor} b={s.stock_value} fmt={brl} note="diferença = correção das saídas" />
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-7">
              {[["Com validade", s.validades_lidas ?? 0], ["Produtos", s.products], ["Fornecedores", s.suppliers], ["Locais", s.locations], ["Centros", s.centers], ["Entradas", s.entries], ["Saídas", s.exits]].map(([l, n]) => (
                <div key={l as string} className="rounded-xl bg-neve p-2"><p className="font-display text-xl">{num(n as number)}</p><p className="text-[11px] text-azul-600">{l}</p></div>
              ))}
            </div>
          </Card>

          <Card title="O que foi encontrado">
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filter === "" ? "bg-azul text-ouro ring-azul" : "ring-marfim"}`}>Tudo ({payload!.issues.length})</button>
              {LEVELS.map((l) => (
                <button key={l.key} onClick={() => setFilter(l.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filter === l.key ? "bg-azul text-ouro ring-azul" : "ring-marfim"}`}>
                  {l.label.split(" (")[0]} ({payload!.issues.filter((i) => i.level === l.key).length})
                </button>
              ))}
            </div>
            <ul className="max-h-[28rem] space-y-1.5 overflow-auto pr-1">
              {payload!.issues.filter((i) => !filter || i.level === filter).map((i, n) => {
                const L = LEVELS.find((l) => l.key === i.level)!;
                return (
                  <li key={n} className="flex gap-2 rounded-lg bg-neve px-3 py-2 text-sm">
                    <span className={`mt-0.5 shrink-0 ${L.cls}`}>{L.icon}</span>
                    <span><span className="mr-1 text-[11px] font-semibold text-azul-600">{i.sheet}{i.row ? ` · linha ${i.row}` : ""}</span>{i.message}</span>
                  </li>
                );
              })}
            </ul>
            {s.products_review > 0 && <p className="mt-3 text-sm text-azul-600">{s.products_review} produtos ficarão marcados com “revisar cadastro”.</p>}
          </Card>

          {valRes && (
            <Alert type="ok">
              Validades aplicadas: {valRes.atualizados} produtos datados{valRes.separados ? ", " + valRes.separados + " separados em vários lotes" : ""}{valRes.ignorados ? ", " + valRes.ignorados + " sem saldo importado" : ""}.
              {valRes.avisos?.length ? <span className="mt-1 block text-xs">{valRes.avisos.map((a) => a.code + ": " + a.msg).join(" · ")}</span> : null}
            </Alert>
          )}
          {payload!.validades.length > 0 && (
            <Button variant="ghost" onClick={onlyValidities} disabled={saving} className="w-full">
              Atualizar só as validades ({payload!.validades.length} produtos) — não mexe nas movimentações
            </Button>
          )}
          <Button onClick={doImport} disabled={saving || blocking || !!result} className="w-full">
            <Upload size={18} /> {saving ? "Gravando no banco..." : result ? "Importado" : "Confirmar e importar"}
          </Button>
        </>
      )}
    </div>
  );
}

function Row({ label, a, b, fmt, note }: { label: string; a: number | null; b: number; fmt: (n: number) => string; note?: string }) {
  const same = a !== null && Math.abs(a - b) < 0.01;
  return (
    <tr>
      <td className="py-2">{label}{note && !same && <span className="block text-[11px] text-azul-600">{note}</span>}</td>
      <td className="py-2 text-right tabular-nums">{a === null ? "—" : fmt(a)}</td>
      <td className="py-2 text-right font-semibold tabular-nums">{fmt(b)}</td>
      <td className="py-2 pl-2 text-right">{same ? <span className="text-st-ok">✓</span> : <span className="text-st-baixo">corrigido</span>}</td>
    </tr>
  );
}
