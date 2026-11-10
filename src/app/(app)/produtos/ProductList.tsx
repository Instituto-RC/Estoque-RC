"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, num, STATUS_ORDER } from "@/lib/format";

export type ProductRow = {
  product_id: string;
  code: string;
  name: string;
  unit: string | null;
  balance: number;
  min_stock: number;
  status: string;
  processes: string | null;
  location_name: string | null;
  avg_cost: number;
  needs_review: boolean;
  active: boolean;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ProductList({ rows, initialStatus }: { rows: ProductRow[]; initialStatus: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [proc, setProc] = useState("");

  const processes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => (r.processes ?? "").split("/").filter(Boolean)))).sort(),
    [rows],
  );

  const [review, setReview] = useState(false);
  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return rows.filter(
      (r) =>
        (!nq || norm(`${r.code} ${r.name}`).includes(nq)) &&
        (!status || r.status === status) &&
        (!proc || (r.processes ?? "").split("/").includes(proc)) &&
        (!review || r.needs_review),
    );
  }, [rows, q, status, proc, review]);

  return (
    <>
      <div className="sticky top-[60px] z-20 -mx-4 space-y-2 bg-neve px-4 pb-2 pt-1 md:top-0">
        <label className="flex h-12 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-marfim focus-within:ring-azul">
          <Search size={18} className="text-azul-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou código IRC"
            className="h-full flex-1 bg-transparent outline-none"
            inputMode="search"
          />
        </label>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 flex-1 rounded-xl bg-white px-2 text-sm ring-1 ring-marfim">
            <option value="">Todos os status</option>
            {[...STATUS_ORDER, "Sem mínimo definido"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={proc} onChange={(e) => setProc(e.target.value)} className="h-10 flex-1 rounded-xl bg-white px-2 text-sm ring-1 ring-marfim">
            <option value="">Todos os processos</option>
            {processes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between"><p className="text-xs text-azul-600">{num(filtered.length)} de {num(rows.length)} produtos</p><label className="flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} className="accent-[#23272F]" /> Só “revisar cadastro” ({rows.filter((r) => r.needs_review).length})</label></div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-azul-600 ring-1 ring-marfim">
          Nenhum produto ainda. Importe a planilha em <b>Mais → Importar planilha</b>.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.product_id}><Link href={`/produtos/${r.product_id}`} className="block rounded-2xl bg-white p-3 ring-1 ring-marfim active:bg-neve">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-azul-600">
                    {r.code}
                    {r.processes ? ` · ${r.processes}` : ""}
                  </p>
                  <p className="font-medium leading-snug">{r.name}</p>
                  <p className="mt-1 text-xs text-azul-600">
                    {r.location_name ?? "Sem local"} · custo médio {brl(r.avg_cost)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl leading-none">{num(r.balance, 2)}</p>
                  <p className="text-[11px] text-azul-600">{r.unit ?? ""} · mín. {num(r.min_stock)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.needs_review && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-st-quase">
                    <AlertCircle size={12} /> revisar cadastro
                  </span>
                )}
              </div>
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
