import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { Pattern } from "@/components/brand/Brand";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  almoxarife: "Almoxarife",
  profissional: "Profissional",
  leitura: "Consulta",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  const name = profile?.full_name || user.email?.split("@")[0] || "";
  const role = ROLE_LABEL[profile?.role ?? ""] ?? "";

  return (
    <div className="min-h-dvh md:flex">
      <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden bg-azul p-5 md:flex md:min-h-dvh">
        <Logo tone="onDark" className="mb-10" />
        <SideNav />
        <div className="mt-auto pt-8">
          <p className="truncate text-sm font-medium text-neve">{name}</p>
          <p className="text-xs text-ouro">{role}</p>
        </div>
        <Pattern name="territorio-bruto" color="#2E333D" className="pointer-events-none absolute -bottom-10 -right-16 h-56 w-56" />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between bg-azul px-4 md:hidden">
          <Logo tone="onDark" />
          <div className="text-right leading-tight">
            <p className="max-w-[9rem] truncate text-xs font-medium text-neve">{name}</p>
            <p className="text-[10px] text-ouro">{role}</p>
          </div>
        </header>
        <main className="pb-safe mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
