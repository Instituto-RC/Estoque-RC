import { notFound } from "next/navigation";
import { Registry, REGISTRIES } from "./Registry";

export default async function Page({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!(tipo in REGISTRIES)) notFound();
  return <Registry tipo={tipo as keyof typeof REGISTRIES} />;
}
