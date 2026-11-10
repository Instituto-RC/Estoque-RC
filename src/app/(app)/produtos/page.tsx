import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductList, type ProductRow } from "./ProductList";
import { PageHeader } from "@/components/ui";

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
      <PageHeader eyebrow="Cadastro" title="Produtos" action={<Link href="/produtos/novo" className="inline-flex h-10 items-center gap-1 rounded-xl bg-azul px-3 text-sm font-semibold uppercase tracking-wide text-ouro"><Plus size={16} /> Novo</Link>} />
      <ProductList rows={(data ?? []) as ProductRow[]} initialStatus={status ?? ""} />
    </div>
  );
}
