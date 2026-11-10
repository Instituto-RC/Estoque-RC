"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-st-sem ring-1 ring-marfim"
    >
      <LogOut size={18} /> Sair
    </button>
  );
}
