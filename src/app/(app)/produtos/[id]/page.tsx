import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductEditor } from "../ProductEditor";
import { ProductDetail } from "./ProductDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [{ data: p }, { data: stock }, { data: procs }, { data: lots }, { data: monthly }, { data: movs }] = await Promise.all([
    sb.from("products").select("*").eq("id", id).maybeSingle(),
    sb.from("v_product_stock").select("*").eq("product_id", id).maybeSingle(),
    sb.from("product_processes").select("process_id").eq("product_id", id),
    sb.from("v_lot_stock").select("*").eq("product_id", id).order("expiry_date", { ascending: true, nullsFirst: false }),
    sb.from("v_product_monthly").select("month, entries_qty, exits_qty, entries_value, exits_value").eq("product_id", id).order("month"),
    sb.from("stock_movements").select("id, type, quantity, unit_cost, total_cost, occurred_at, responsible_name, reason, invoice_number, lot_id, suppliers(name), destinations(name), locations!stock_movements_location_id_fkey(name)").eq("product_id", id).order("occurred_at", { ascending: false }).order("created_at", { ascending: false }).limit(60),
  ]);
  if (!p) notFound();
  let photoUrl: string | null = null;
  if (p.photo_path) photoUrl = (await sb.storage.from("product-photos").createSignedUrl(p.photo_path, 3600)).data?.signedUrl ?? null;
  return (
    <div className="space-y-4">
      <ProductDetail stock={stock} lots={lots ?? []} monthly={monthly ?? []} movs={movs ?? []} product={p} />
      <ProductEditor product={p} processIds={(procs ?? []).map((x) => x.process_id)} photoUrl={photoUrl} />
    </div>
  );
}
