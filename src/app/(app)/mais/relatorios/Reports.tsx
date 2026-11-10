"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button, Card, PageHeader, fmtDate } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, num } from "@/lib/format";
import { exportXlsx } from "@/lib/exportXlsx";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ml = (m: string) => { const [y, mm] = m.split("-"); return `${MONTHS[Number(mm) - 1]}/${y.slice(2)}`; };

export function Reports({ monthly, stock, totals, bySupplier, byDest }: { monthly: Any[]; stock: Any[]; totals: Any | null; bySupplier: Any[]; byDest: Any[] }) {
  const [idle, setIdle] = useState(60);
  let acc = 0;
  const months: Any[] = monthly.map((m) => { acc += Number(m.entries_value) - Number(m.exits_value); return { ...m, acc }; });
  const max = Math.max(1, ...months.map((m) => Math.max(Number(m.entries_value), Number(m.exits_value))));

  const sup = useMemo(() => agg(bySupplier, (r) => r.suppliers?.name ?? "—", (r) => Number(r.total_cost)), [bySupplier]);
  const dest = useMemo(() => agg(byDest, (r) => r.destinations?.name ?? "—", (r) => Number(r.total_cost)), [byDest]);
  const abc = ["A", "B", "C"].map((c) => { const it = stock.filter((s) => s.abc_class === c); return { c, n: it.length, v: it.reduce((a, s) => a + Number(s.total_spent), 0) }; });
  const relevance = [...stock].sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 15);
  const limit = new Date(Date.now() - idle * 86400000).toISOString().slice(0, 10);
  const idleItems = stock.filter((s) => Number(s.balance) > 0 && (!s.last_exit_at || s.last_exit_at < limit)).sort((a, b) => Number(b.stock_value) - Number(a.stock_value));
  const buy = stock.filter((s) => Number(s.suggested_purchase) > 0).sort((a, b) => a.name.localeCompare(b.name));

  function exportAll() {
    exportXlsx(`relatorios-estoque-rc-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Análise mensal", rows: months.map((m) => ({ Mês: ml(m.month), "Entradas (qtd)": m.entries_qty, "Saídas (qtd)": m.exits_qty, "Entradas (R$)": m.entries_value, "Saídas (R$)": m.exits_value, "Saldo acumulado (R$)": m.acc })) },
      { name: "Compras sugeridas", rows: buy.map((s) => ({ Código: s.code, Produto: s.name, Unidade: s.unit, Saldo: s.balance, Mínimo: s.min_stock, Máximo: s.max_stock, "Sugestão de compra": s.suggested_purchase, "Custo médio": s.avg_cost, "Valor estimado": Number(s.suggested_purchase) * Number(s.avg_cost) })) },
      { name: `Sem saída ${idle} dias`, rows: idleItems.map((s) => ({ Código: s.code, Produto: s.name, Saldo: s.balance, "Última saída": s.last_exit_at, "Valor parado": s.stock_value })) },
      { name: "Gasto por fornecedor", rows: sup.map(([k, v]) => ({ Fornecedor: k, "Total (R$)": v })) },
      { name: "Consumo por destino", rows: dest.map(([k, v]) => ({ Destino: k, "Total (R$)": v })) },
      { name: "Curva ABC", rows: stock.map((s) => ({ Código: s.code, Produto: s.name, Classe: s.abc_class, "Total de gastos": s.total_spent })) },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Mais" title="Relatórios" back="/mais" action={<Button variant="ghost" className="h-10 px-3" onClick={exportAll}><Download size={16} /> Excel</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <K l="Variedade de itens" v={num(totals?.products)} />
        <K l="Quantidade em estoque" v={num(totals?.qty_in_stock)} />
        <K l="Valor total em estoque" v={brl(totals?.stock_value)} />
        <K l="Total de compras" v={brl(totals?.total_spent)} />
        <K l="Acima do mínimo" v={num(totals?.above_min)} />
        <K l="Abaixo do mínimo" v={num(totals?.below_min)} />
      </div>

      <Card title="Entradas × saídas por mês (R$)">
        {months.length === 0 ? <p className="text-sm text-azul-600">Sem dados.</p> : (
          <>
            <div className="flex h-44 items-end gap-3 overflow-x-auto pb-1">
              {months.map((m) => (
                <div key={m.month} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div className="w-1/2 rounded-t bg-azul" style={{ height: `${(Number(m.entries_value) / max) * 100}%` }} title={`Entradas ${brl(m.entries_value)}`} />
                    <div className="w-1/2 rounded-t bg-ouro" style={{ height: `${(Number(m.exits_value) / max) * 100}%` }} title={`Saídas ${brl(m.exits_value)}`} />
                  </div>
                  <span className="text-[11px] text-azul-600">{ml(m.month)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-xs"><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-azul" />Entradas</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-ouro" />Saídas</span></div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-azul-600"><tr><th>Mês</th><th className="text-right">Entr. (qtd)</th><th className="text-right">Saídas (qtd)</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Estoque total</th></tr></thead>
                <tbody className="divide-y divide-marfim/70">
                  {months.map((m) => (
                    <tr key={m.month}><td className="py-1.5">{ml(m.month)}</td><td className="text-right tabular-nums">{num(m.entries_qty)}</td><td className="text-right tabular-nums">{num(m.exits_qty)}</td><td className="text-right tabular-nums">{brl(m.entries_value)}</td><td className="text-right tabular-nums">{brl(m.exits_value)}</td><td className="text-right font-semibold tabular-nums">{brl(m.acc)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Lista de compras (${buy.length})`}>
          <ul className="max-h-80 divide-y divide-marfim/70 overflow-auto">
            {buy.map((s) => (
              <li key={s.product_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/produtos/${s.product_id}`} className="min-w-0"><p className="truncate font-medium">{s.name}</p><p className="text-xs text-azul-600">{s.code} · saldo {num(s.balance, 2)} / mín. {num(s.min_stock)}</p></Link>
                <span className="shrink-0 font-semibold">+{num(s.suggested_purchase, 2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-azul-600">Sugestão: completar até o estoque máximo; sem máximo cadastrado, até 2× o mínimo.</p>
        </Card>

        <Card title="Itens sem saída">
          <div className="mb-2 flex gap-2">{[30, 60, 90, 180].map((d) => <button key={d} onClick={() => setIdle(d)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${idle === d ? "bg-azul text-ouro ring-azul" : "ring-marfim"}`}>{d} dias</button>)}</div>
          <p className="mb-2 text-sm">{idleItems.length} itens · {brl(idleItems.reduce((a, s) => a + Number(s.stock_value), 0))} parados</p>
          <ul className="max-h-64 divide-y divide-marfim/70 overflow-auto">
            {idleItems.slice(0, 60).map((s) => (
              <li key={s.product_id} className="flex justify-between gap-3 py-1.5 text-sm"><span className="truncate">{s.code} · {s.name}</span><span className="shrink-0 text-xs text-azul-600">{s.last_exit_at ? fmtDate(s.last_exit_at) : "nunca"}</span></li>
            ))}
          </ul>
        </Card>

        <Card title="Curva ABC (gastos)">
          <div className="grid grid-cols-3 gap-2 text-center">
            {abc.map((a) => <div key={a.c} className="rounded-xl bg-neve p-3"><p className="font-display text-2xl">{a.c}</p><p className="text-sm">{a.n} itens</p><p className="text-xs text-azul-600">{brl(a.v)}</p></div>)}
          </div>
          <p className="mt-2 text-xs text-azul-600">A = itens que somam 80% dos gastos; B = próximos 15%; C = restante.</p>
        </Card>

        <Card title="Relevância no estoque (volume)">
          <ul className="divide-y divide-marfim/70">
            {relevance.map((s, i) => (
              <li key={s.product_id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="truncate">{i + 1}. {s.name}</span>
                <span className="shrink-0 text-xs text-azul-600">{num(s.balance)} · {(Number(s.pct_stock ?? 0) * 100).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Gasto por fornecedor">
          <Bars rows={sup} />
        </Card>
        <Card title="Consumo por destino (R$)">
          <Bars rows={dest} />
        </Card>
      </div>
      <p className="text-center text-xs text-azul-600">Status por produto: <StatusBadge status="Estoque baixo" /> etc. seguem a mesma regra da planilha.</p>
    </div>
  );
}

function agg(rows: Any[], key: (r: Any) => string, val: (r: Any) => number) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}
function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="space-y-2">
      {rows.slice(0, 12).map(([k, v]) => (
        <li key={k} className="text-sm">
          <div className="flex justify-between gap-2"><span className="truncate">{k}</span><span className="shrink-0 tabular-nums">{brl(v)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-neve"><div className="h-2 rounded-full bg-azul" style={{ width: `${(v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
function K({ l, v }: { l: string; v: string }) {
  return <div className="rounded-2xl bg-white p-3 ring-1 ring-marfim"><p className="text-xs text-azul-600">{l}</p><p className="font-display text-xl leading-tight">{v}</p></div>;
}
