import { createClient } from "@/lib/supabase/server";
import { Inventory } from "./Inventory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventário" };

export default async function Page() {
  const sb = await createClient();
  const [{ data: stock }, { data: centers }, { data: lots }] = await Promise.all([
    sb.from("v_product_stock").select("product_id, code, name, unit, location_name, min_stock, entries_qty, exits_qty, balance, status, total_spent, pct_spent, pct_stock, avg_cost, turnover, abc_class, stock_value, processes, needs_review, last_exit_at").eq("active", true).order("code"),
    sb.from("v_center_stock").select("center_id, center_name, product_id, code, name, min_stock, entries_qty, exits_qty, balance, status, total_spent, next_expiry").order("code"),
    sb.from("v_lot_stock").select("lot_id, product_id, code, name, lot_number, expiry_date, is_legacy, balance, days_to_expiry").gt("balance", 0).order("expiry_date", { ascending: true, nullsFirst: false }),
  ]);
  return <Inventory stock={stock ?? []} centers={centers ?? []} lots={lots ?? []} />;
}
