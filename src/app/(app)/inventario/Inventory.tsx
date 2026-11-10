"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { PageHeader, Button, Empty, fmtDate } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, num, STATUS_ORDER } from "@/lib/format";
import { exportXlsx } from "@/lib/exportXlsx";
import { ExpiryBadge, EXPIRY_LABEL } from "@/components/ExpiryBadge";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);

export function Inventory({ stock, centers, lots }: { stock: Any[]; centers: Any[]; lots: Any[] }) {
  const [tab, setTab] = useState<"geral" | "centro" | "validade">("geral");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const centerNames = Array.from(new Set(centers.map((c) => c.center_name).filter(Boolean)));
  const [center, setCenter] = useState(centerNames[0] ?? "");

  const f = (r: Any) => (!q || norm(`${r.code} ${r.name}`).includes(norm(q))) && (!status || r.status === status);
  const geral = useMemo(() => stock.filter(f), [stock, q, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const cent = useMemo(() => centers.filter((c) => c.center_name === center).filter(f), [centers, center, q, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const val = useMemo(() => lots.filter((l) => !q || norm(`${l.code} ${l.name}`).includes(norm(q))), [lots, q]);
  const legacyCount = lots.filter((l) => l.is_legacy).length;

  function exportAll() {
    exportXlsx(`inventario-estoque-rc-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Inventário geral", rows: stock.map((r) => ({ Código: r.code, Produto: r.name, Processo: r.processes, Localização: r.location_name, "Estoque mínimo": r.min_stock, Entradas: r.entries_qty, Saídas: r.exits_qty, "Estoque atual": r.balance, Status: r.status, "Total de gastos": r.total_spent, "% de gastos": r.pct_spent, "% no estoque": r.pct_stock, "Custo médio": r.avg_cost, "Giro (saídas/mín.)": r.turnover, "Curva ABC": r.abc_class, "Valor em estoque": r.stock_value })) },
      { name: "Por centro", rows: centers.map((r) => ({ Centro: r.center_name, Código: r.code, Produto: r.name, "Estoque mínimo": r.min_stock, Entradas: r.entries_qty, Saídas: r.exits_qty, "Estoque atual": r.balance, Status: r.status, "Total de gastos": r.total_spent, "Próxima validade": r.next_expiry })) },
      { name: "Lotes e validades", rows: lots.map((l) => ({ Código: l.code, Produto: l.name, Lote: l.is_legacy ? "SALDO IMPORTADO" : l.lot_number, Validade: l.expiry_date, "Dias p/ vencer": l.days_to_expiry, Situação: EXPIRY_LABEL[l.expiry_status] ?? l.expiry_status, "Ordem de uso (FEFO)": l.fefo_rank, Saldo: l.balance, "Valor (R$)": l.value })) },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Estoque" title="Inventário" action={<Button variant="ghost" onClick={exportAll} className="h-10 px-3"><Download size={16} /> Excel</Button>} />

      <div className="grid grid-cols-3 rounded-xl bg-white p-1 ring-1 ring-marfim">
        {([["geral", "Geral"], ["centro", "Por centro"], ["validade", "Validades"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-10 rounded-lg text-sm font-semibold ${tab === k ? "bg-azul text-ouro" : "text-azul-600"}`}>{l}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-marfim">
          <Search size={16} className="text-azul-600" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-full flex-1 bg-transparent outline-none" />
        </label>
        {tab !== "validade" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-40 rounded-xl bg-white px-2 text-sm ring-1 ring-marfim">
            <option value="">Todos status</option>
            {[...STATUS_ORDER, "Sem mínimo definido"].map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {tab === "centro" && centerNames.length > 1 && (
          <select value={center} onChange={(e) => setCenter(e.target.value)} className="h-11 rounded-xl bg-white px-2 text-sm ring-1 ring-marfim">
            {centerNames.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>

      {tab === "geral" && (geral.length === 0 ? <Empty>Nenhum item.</Empty> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-marfim">
          <table className="w-full min-w-[1060px] text-sm">
            <thead className="bg-azul text-left text-xs text-ouro">
              <tr>{["Código", "Produto", "Local", "Mín.", "Entr.", "Saídas", "Atual", "Status", "Gastos", "% gastos", "% estoque", "Custo médio", "Giro", "ABC", "Próx. validade"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-marfim/60">
              {geral.map((r) => (
                <tr key={r.product_id} className="hover:bg-neve">
                  <td className="px-3 py-2 font-semibold text-azul-600"><Link href={`/produtos/${r.product_id}`}>{r.code}</Link></td>
                  <td className="max-w-[16rem] px-3 py-2"><Link href={`/produtos/${r.product_id}`} className="line-clamp-2">{r.name}</Link></td>
                  <td className="px-3 py-2 text-xs">{r.location_name ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{num(r.min_stock)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(r.entries_qty, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(r.exits_qty, 2)}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{num(r.balance, 2)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 tabular-nums">{brl(r.total_spent)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.pct_spent)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.pct_stock)}</td>
                  <td className="px-3 py-2 tabular-nums">{brl(r.avg_cost)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(r.turnover, 2)}</td>
                  <td className="px-3 py-2 font-semibold">{r.abc_class}</td>
                  <td className="px-3 py-2 text-xs">{r.next_expiry ? fmtDate(r.next_expiry) : Number(r.balance) > 0 ? "sem validade" : "—"}{Number(r.lots_with_balance) > 1 ? ` · ${r.lots_with_balance} lotes` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === "centro" && (cent.length === 0 ? <Empty>Nenhum item neste centro.</Empty> : (
        <ul className="space-y-2">
          {cent.map((r) => (
            <li key={`${r.center_id}-${r.product_id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-marfim">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-azul-600">{r.code}</p>
                <p className="truncate text-sm font-medium">{r.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-azul-600"><StatusBadge status={r.status} /> mín. {num(r.min_stock)} · gastos {brl(r.total_spent)}{r.next_expiry ? ` · vence ${fmtDate(r.next_expiry)}` : ""}</div>
              </div>
              <p className="font-display text-xl">{num(r.balance, 2)}</p>
            </li>
          ))}
        </ul>
      ))}

      {tab === "validade" && <Validities lots={val} legacyCount={legacyCount} />}
    </div>
  );
}

const BUCKETS = ["vencido", "critico", "atencao", "aviso", "ok", "sem_validade"];

function Validities({ lots, legacyCount }: { lots: Any[]; legacyCount: number }) {
  const [bucket, setBucket] = useState("");
  const counts = Object.fromEntries(BUCKETS.map((b) => [b, lots.filter((l) => l.expiry_status === b)]));
  const shown = lots.filter((l) => !bucket || l.expiry_status === bucket);
  const groups = new Map<string, Any[]>();
  shown.forEach((l) => { const k = l.product_id; groups.set(k, [...(groups.get(k) ?? []), l]); });
  const ordered = Array.from(groups.values()).map((g) => g.sort((a, b) => (a.fefo_rank ?? 99) - (b.fefo_rank ?? 99)))
    .sort((a, b) => (a[0].expiry_date ?? "9999").localeCompare(b[0].expiry_date ?? "9999"));
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {BUCKETS.map((b) => (
          <button key={b} onClick={() => setBucket(bucket === b ? "" : b)} className={`rounded-xl bg-white p-2 text-left ring-1 ${bucket === b ? "ring-2 ring-azul" : "ring-marfim"}`}>
            <ExpiryBadge status={b} />
            <p className="mt-1 font-display text-xl leading-none">{counts[b].length}</p>
            <p className="text-[11px] text-azul-600">{brl(counts[b].reduce((a: number, l: Any) => a + Number(l.value || 0), 0))}</p>
          </button>
        ))}
      </div>
      {legacyCount > 0 && (
        <p className="rounded-xl bg-ouro/40 px-3 py-2 text-sm">
          {legacyCount} lotes vieram da planilha como “saldo importado”. Os que tinham validade no inventário já estão datados; os demais aparecem em “Sem validade”.
        </p>
      )}
      {ordered.length === 0 ? <Empty>Nenhum lote nesta faixa.</Empty> : (
        <ul className="space-y-2">
          {ordered.map((g) => (
            <li key={g[0].product_id} className="rounded-2xl bg-white p-3 ring-1 ring-marfim">
              <Link href={`/produtos/${g[0].product_id}`} className="block">
                <p className="text-xs font-semibold text-azul-600">{g[0].code}</p>
                <p className="text-sm font-medium">{g[0].name}</p>
              </Link>
              <ul className="mt-2 divide-y divide-marfim/60">
                {g.map((l) => (
                  <li key={l.lot_id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0 text-xs">
                      <span className="mr-2 font-semibold">{l.fefo_rank === 1 ? "① Usar primeiro" : `${l.fefo_rank}º`}</span>
                      {l.is_legacy ? "Saldo importado" : `Lote ${l.lot_number ?? "s/ nº"}`} · {l.expiry_date ? fmtDate(l.expiry_date) : "sem validade"}
                      <span className="ml-2"><ExpiryBadge status={l.expiry_status} days={l.days_to_expiry} /></span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{num(l.balance, 2)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
