import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, AlertTriangle, CalendarClock, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, num, STATUS_ORDER } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { ExpiryBadge } from "@/components/ExpiryBadge";

export const dynamic = "force-dynamic";

type Row = {
  product_id: string;
  code: string;
  name: string;
  balance: number;
  min_stock: number;
  stock_value: number;
  status: string;
  active: boolean;
};

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ data: stock }, { data: lots }, { data: monthly }, { data: totals }] = await Promise.all([
    supabase.from("v_product_stock").select("product_id, code, name, balance, min_stock, stock_value, status, active").eq("active", true),
    supabase.from("v_expiry_summary").select("*"),
    supabase.from("v_monthly_movements").select("*").order("month", { ascending: false }).limit(1),
    supabase.from("v_totals").select("*").maybeSingle(),
  ]);

  const rows = (stock ?? []) as Row[];
  const totalValue = Number(totals?.stock_value ?? 0);
  const totalQty = Number(totals?.qty_in_stock ?? 0);
  const byStatus = [...STATUS_ORDER, "Sem mínimo definido"].map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));
  const critical = rows
    .filter((r) => ["Sem estoque", "Quase sem estoque", "Estoque baixo"].includes(r.status) && Number(r.min_stock) > 0)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    .slice(0, 8);
  const month = monthly?.[0];
  const empty = rows.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-azul-600">Visão geral</p>
        <h1 className="text-3xl">Estoque</h1>
      </div>

      {empty && (
        <Link
          href="/mais/importar"
          className="flex items-center gap-4 rounded-2xl bg-azul p-5 text-neve"
        >
          <Upload className="shrink-0 text-ouro" />
          <div>
            <p className="font-semibold">Comece importando a planilha atual</p>
            <p className="text-sm text-marfim">Produtos, fornecedores, locais e movimentações vão direto para o banco.</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Itens cadastrados" value={num(rows.length)} />
        <Kpi label="Unidades em estoque" value={num(totalQty)} />
        <Kpi label="Valor em estoque" value={brl(totalValue)} wide />
        <Kpi label="Saídas no mês" value={brl(month?.exits_value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/entradas" className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-azul font-semibold uppercase tracking-wide text-ouro">
          <ArrowDownToLine size={20} /> Entrada
        </Link>
        <Link href="/saidas" className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-ouro font-semibold uppercase tracking-wide text-azul">
          <ArrowUpFromLine size={20} /> Saída
        </Link>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-marfim">
        <h2 className="mb-3 text-lg">Situação dos produtos</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {byStatus.map(({ s, n }) => (
            <Link key={s} href={`/produtos?status=${encodeURIComponent(s)}`} className="rounded-xl bg-neve p-3">
              <p className="font-display text-2xl">{n}</p>
              <StatusBadge status={s} />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-marfim">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-st-quase" />
            <h2 className="text-lg">Repor primeiro</h2>
          </div>
          {critical.length === 0 ? (
            <p className="text-sm text-azul-600">Nenhum item abaixo do mínimo.</p>
          ) : (
            <ul className="divide-y divide-marfim/70">
              {critical.map((r) => (
                <li key={r.product_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-azul-600">
                      {r.code} · saldo {num(r.balance)} / mín. {num(r.min_stock)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-marfim">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-st-baixo" />
            <h2 className="text-lg">Validade</h2>
          </div>
          <ul className="space-y-1.5">
            {["vencido", "critico", "atencao", "aviso", "sem_validade"].map((b) => {
              const r = (lots ?? []).find((x: { expiry_status: string }) => x.expiry_status === b) as { lots: number; qty: number; value: number } | undefined;
              return (
                <li key={b} className="flex items-center justify-between gap-2 text-sm">
                  <ExpiryBadge status={b} />
                  <span className="tabular-nums text-azul-600">{num(r?.lots ?? 0)} lotes · {brl(r?.value ?? 0)}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/inventario" className="mt-2 inline-block text-sm font-semibold underline">Ver validades</Link>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-4 ring-1 ring-marfim ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <p className="text-xs font-medium text-azul-600">{label}</p>
      <p className="mt-1 font-display text-2xl leading-tight">{value}</p>
    </div>
  );
}
