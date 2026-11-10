"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, PageHeader, inputCls } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useLookups, canWrite, friendlyError } from "@/lib/lookups";
import { num } from "@/lib/format";

type Row = {
  product_id: string; code: string; name: string; unit: string | null; processes: string | null; balance: number; status: string;
  min_stock: number; max_stock: number | null; location_id: string | null; preferred_supplier_id: string | null; active: boolean;
};
type Edit = Partial<Pick<Row, "min_stock" | "max_stock" | "location_id" | "preferred_supplier_id" | "active">>;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ParametrosPage() {
  const lk = useLookups();
  const can = canWrite(lk.role);
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [q, setQ] = useState("");
  const [proc, setProc] = useState("");
  const [bulkMin, setBulkMin] = useState("");
  const [bulkMax, setBulkMax] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await createClient().from("v_product_stock")
      .select("product_id, code, name, unit, processes, balance, status, min_stock, max_stock, location_id, preferred_supplier_id, active").order("code");
    setRows((data ?? []) as Row[]);
    setEdits({});
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (!q || norm(`${r.code} ${r.name}`).includes(norm(q))) && (!proc || (r.processes ?? "").split("/").includes(proc))), [rows, q, proc]);
  const val = <K extends keyof Edit>(r: Row, k: K) => (edits[r.product_id]?.[k] !== undefined ? edits[r.product_id][k] : r[k]) as Row[K];
  const setVal = (id: string, k: keyof Edit, v: unknown) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const dirty = Object.keys(edits).length;

  function applyBulk() {
    const mn = bulkMin.trim() === "" ? null : Number(bulkMin.replace(",", "."));
    const mx = bulkMax.trim() === "" ? null : Number(bulkMax.replace(",", "."));
    if (mn === null && mx === null) return;
    if ((mn !== null && (isNaN(mn) || mn < 0)) || (mx !== null && (isNaN(mx) || mx < 0))) return setMsg({ type: "error", text: "Valores inválidos." });
    setEdits((e) => {
      const n = { ...e };
      filtered.forEach((r) => { n[r.product_id] = { ...n[r.product_id], ...(mn !== null ? { min_stock: mn } : {}), ...(mx !== null ? { max_stock: mx } : {}) }; });
      return n;
    });
    setMsg({ type: "ok", text: `Aplicado a ${filtered.length} produtos filtrados. Revise e clique em Salvar.` });
  }

  async function save() {
    setMsg(null);
    for (const [id, e] of Object.entries(edits)) {
      const r = rows.find((x) => x.product_id === id)!;
      const mn = Number(e.min_stock ?? r.min_stock); const mx = e.max_stock !== undefined ? e.max_stock : r.max_stock;
      if (isNaN(mn) || mn < 0) return setMsg({ type: "error", text: `${r.code}: estoque mínimo inválido.` });
      if (mx !== null && mx !== undefined && (isNaN(Number(mx)) || Number(mx) < mn)) return setMsg({ type: "error", text: `${r.code}: máximo precisa ser maior ou igual ao mínimo.` });
    }
    setBusy(true);
    const sb = createClient();
    for (const [id, e] of Object.entries(edits)) {
      const patch: Record<string, unknown> = {};
      if (e.min_stock !== undefined) patch.min_stock = Number(e.min_stock);
      if (e.max_stock !== undefined) patch.max_stock = e.max_stock === null || (e.max_stock as unknown) === "" ? null : Number(e.max_stock);
      if (e.location_id !== undefined) patch.default_location_id = e.location_id || null;
      if (e.preferred_supplier_id !== undefined) patch.preferred_supplier_id = e.preferred_supplier_id || null;
      if (e.active !== undefined) patch.active = e.active;
      const { error } = await sb.from("products").update(patch).eq("id", id);
      if (error) { setBusy(false); return setMsg({ type: "error", text: friendlyError(error.message) }); }
    }
    setBusy(false);
    setMsg({ type: "ok", text: `${dirty} produto(s) atualizado(s).` });
    load();
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Administração" title="Parâmetros por produto" back="/mais" />
      <p className="text-sm text-azul-600">Edite mínimo, máximo, local padrão, fornecedor preferencial e se o produto está ativo. O status e a lista de compras recalculam na hora.</p>
      <div className="flex flex-wrap gap-2">
        <label className="flex h-11 min-w-[14rem] flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-marfim">
          <Search size={16} className="text-azul-600" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-full flex-1 bg-transparent outline-none" />
        </label>
        <select value={proc} onChange={(e) => setProc(e.target.value)} className="h-11 rounded-xl bg-white px-2 text-sm ring-1 ring-marfim">
          <option value="">Todos os processos</option>
          {lk.processes.map((p) => <option key={p.id}>{p.name}</option>)}
        </select>
      </div>
      {can && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-marfim">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-azul-600">Aplicar aos {filtered.length} filtrados</span>
          <input className={`${inputCls} h-11 w-32`} placeholder="Mínimo" inputMode="decimal" value={bulkMin} onChange={(e) => setBulkMin(e.target.value)} />
          <input className={`${inputCls} h-11 w-32`} placeholder="Máximo" inputMode="decimal" value={bulkMax} onChange={(e) => setBulkMax(e.target.value)} />
          <Button variant="ghost" className="h-11" onClick={applyBulk}>Aplicar</Button>
        </div>
      )}
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-marfim">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-azul text-left text-xs text-ouro">
            <tr>{["Código", "Produto", "Saldo", "Status", "Mínimo", "Máximo", "Local padrão", "Fornecedor preferencial", "Ativo"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-marfim/60">
            {filtered.map((r) => (
              <tr key={r.product_id} className={edits[r.product_id] ? "bg-ouro/20" : ""}>
                <td className="px-3 py-1.5 font-semibold text-azul-600">{r.code}</td>
                <td className="max-w-[16rem] px-3 py-1.5"><span className="line-clamp-2">{r.name}</span></td>
                <td className="px-3 py-1.5 tabular-nums">{num(r.balance, 2)} {r.unit ?? ""}</td>
                <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                <td className="px-2 py-1.5"><input disabled={!can} className="h-9 w-20 rounded-lg px-2 ring-1 ring-marfim" inputMode="decimal" value={String(val(r, "min_stock") ?? "")} onChange={(e) => setVal(r.product_id, "min_stock", e.target.value)} /></td>
                <td className="px-2 py-1.5"><input disabled={!can} className="h-9 w-20 rounded-lg px-2 ring-1 ring-marfim" inputMode="decimal" value={String(val(r, "max_stock") ?? "")} onChange={(e) => setVal(r.product_id, "max_stock", e.target.value === "" ? null : e.target.value)} /></td>
                <td className="px-2 py-1.5">
                  <select disabled={!can} className="h-9 w-40 rounded-lg px-1 ring-1 ring-marfim" value={String(val(r, "location_id") ?? "")} onChange={(e) => setVal(r.product_id, "location_id", e.target.value)}>
                    <option value="">—</option>{lk.locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select disabled={!can} className="h-9 w-48 rounded-lg px-1 ring-1 ring-marfim" value={String(val(r, "preferred_supplier_id") ?? "")} onChange={(e) => setVal(r.product_id, "preferred_supplier_id", e.target.value)}>
                    <option value="">—</option>{lk.suppliers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5"><input disabled={!can} type="checkbox" checked={Boolean(val(r, "active"))} onChange={(e) => setVal(r.product_id, "active", e.target.checked)} className="h-5 w-5 accent-[#23272F]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can && (
        <div className="sticky bottom-20 z-20 md:bottom-4">
          <Button className="w-full shadow-lg" disabled={busy || dirty === 0} onClick={save}>{busy ? "Salvando..." : dirty ? `Salvar ${dirty} produto(s)` : "Nenhuma alteração"}</Button>
        </div>
      )}
    </div>
  );
}
