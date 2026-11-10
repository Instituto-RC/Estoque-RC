"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine, Menu, ClipboardList, BarChart3 } from "lucide-react";

const items = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/entradas", label: "Entrada", icon: ArrowDownToLine },
  { href: "/saidas", label: "Saída", icon: ArrowUpFromLine },
  { href: "/mais", label: "Mais", icon: Menu },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-azul-600 bg-azul md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-ouro" : "text-marfim/70"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const path = usePathname();
  const all = [
    ...items.slice(0, 4),
    { href: "/inventario", label: "Inventário", icon: ClipboardList },
    { href: "/mais/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/mais", label: "Cadastros e mais", icon: Menu },
  ];
  return (
    <nav className="hidden md:block">
      <ul className="space-y-1">
        {all.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : href === "/mais" ? path === "/mais" || (path.startsWith("/mais/") && !path.startsWith("/mais/relatorios")) : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  active ? "bg-azul-600 text-ouro" : "text-marfim hover:bg-azul-700"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
