import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  const name = profile?.full_name || user.email?.split("@")[0] || "";

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-8 bg-azul p-5 md:flex md:min-h-dvh">
        <Logo tone="light" />
        <SideNav />
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-azul px-4 py-3 md:hidden">
          <Logo tone="light" />
          <span className="max-w-[40%] truncate text-xs text-marfim">{name}</span>
        </header>
        <main className="pb-safe mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
