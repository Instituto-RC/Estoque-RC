import { createClient } from "@/lib/supabase/server";
import { Reports } from "./Reports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios" };

export default async function Page() {
  const sb = await createClient();
  const [{ data: monthly }, { data: stock }, { data: totals }, { data: bySupplier }, { data: byDest }] = await Promise.all([
    sb.from("v_monthly_movements").select("*").order("month"),
    sb.from("v_product_stock").select("product_id, code, name, unit, balance, min_stock, max_stock, status, total_spent, pct_stock, abc_class, suggested_purchase, last_exit_at, last_movement_at, avg_cost, stock_value, preferred_supplier_id").eq("active", true),
    sb.from("v_totals").select("*").maybeSingle(),
    sb.from("stock_movements").select("total_cost, suppliers(name)").eq("type", "ENTRADA").limit(10000),
    sb.from("stock_movements").select("quantity, total_cost, destinations(name)").eq("type", "SAIDA").limit(10000),
  ]);
  return <Reports monthly={monthly ?? []} stock={stock ?? []} totals={totals} bySupplier={bySupplier ?? []} byDest={byDest ?? []} />;
}
