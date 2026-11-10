import Link from "next/link";
import { Upload, Truck, MapPin, Building2, Users, ClipboardList, BarChart3, ChevronRight, Send, Layers, Ruler, Stethoscope, KeyRound } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Mais" };

const groups = [
  { title: "Estoque", links: [
    { href: "/inventario", label: "Inventário e validades", icon: ClipboardList },
    { href: "/mais/relatorios", label: "Relatórios e lista de compras", icon: BarChart3 },
  ] },
  { title: "Cadastros", links: [
    { href: "/mais/cadastros/fornecedores", label: "Fornecedores", icon: Truck },
    { href: "/mais/cadastros/locais", label: "Locais de armazenamento", icon: MapPin },
    { href: "/mais/cadastros/centros", label: "Centros de distribuição", icon: Building2 },
    { href: "/mais/cadastros/destinos", label: "Destinos de saída", icon: Send },
    { href: "/mais/cadastros/profissionais", label: "Profissionais", icon: Stethoscope },
    { href: "/mais/cadastros/processos", label: "Processos (regras de lote)", icon: Layers },
    { href: "/mais/cadastros/unidades", label: "Unidades de medida", icon: Ruler },
  ] },
  { title: "Administração", links: [
    { href: "/mais/importar", label: "Importar planilha", icon: Upload },
    { href: "/mais/usuarios", label: "Usuários e permissões", icon: Users },
    { href: "/mais/senha", label: "Alterar minha senha", icon: KeyRound },
  ] },
];

export default function MaisPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Mais" />
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.15em] text-azul-600">{g.title}</p>
          <ul className="divide-y divide-marfim/70 overflow-hidden rounded-2xl bg-white ring-1 ring-marfim">
            {g.links.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="flex h-14 items-center gap-3 px-4 active:bg-neve">
                  <Icon size={20} className="text-azul-600" />
                  <span className="flex-1 font-medium">{label}</span>
                  <ChevronRight size={18} className="text-marfim" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <SignOutButton />
    </div>
  );
}
