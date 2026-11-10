import { Construction } from "lucide-react";

export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">{title}</h1>
      <div className="rounded-2xl bg-white p-6 ring-1 ring-marfim">
        <Construction className="mb-3 text-ouro-600" />
        <p className="font-medium">{description}</p>
        <p className="mt-1 text-sm text-azul-600">Em construção · {phase}</p>
      </div>
    </div>
  );
}
