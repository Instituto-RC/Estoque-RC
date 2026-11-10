import { createClient } from "@/lib/supabase/server";
import { ProductList, type ProductRow } from "./ProductList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produtos" };

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_product_stock")
    .select("product_id, code, name, unit, balance, min_stock, status, processes, location_name, avg_cost, needs_review, active")
    .order("code");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-azul-600">Cadastro</p>
        <h1 className="text-3xl">Produtos</h1>
      </div>
      <ProductList rows={(data ?? []) as ProductRow[]} initialStatus={status ?? ""} />
    </div>
  );
}
