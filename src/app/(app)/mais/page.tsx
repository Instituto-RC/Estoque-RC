import Link from "next/link";
import { Upload, Truck, MapPin, Building2, Users, ClipboardList, BarChart3, ChevronRight } from "lucide-react";
import { SignOutButton } from "./SignOutButton";

export const metadata = { title: "Mais" };

const links = [
  { href: "/mais/importar", label: "Importar planilha", icon: Upload },
  { href: "/inventario", label: "Inventário", icon: ClipboardList },
  { href: "/mais/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/mais/locais", label: "Locais de armazenamento", icon: MapPin },
  { href: "/mais/centros", label: "Centros de distribuição", icon: Building2 },
  { href: "/mais/usuarios", label: "Usuários e profissionais", icon: Users },
  { href: "/mais/relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function MaisPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Mais</h1>
      <ul className="divide-y divide-marfim/70 overflow-hidden rounded-2xl bg-white ring-1 ring-marfim">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex h-14 items-center gap-3 px-4">
              <Icon size={20} className="text-azul-600" />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight size={18} className="text-marfim" />
            </Link>
          </li>
        ))}
      </ul>
      <SignOutButton />
    </div>
  );
}
