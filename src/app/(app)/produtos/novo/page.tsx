import { PageHeader } from "@/components/ui";
import { ProductEditor } from "../ProductEditor";

export const metadata = { title: "Novo produto" };

export default function Page() {
  return (
    <div>
      <PageHeader eyebrow="Cadastro" title="Novo produto" back="/produtos" />
      <p className="mb-4 text-sm text-azul-600">O código IRC é gerado automaticamente ao salvar.</p>
      <ProductEditor />
    </div>
  );
}
