"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Opt = { id: string; name: string };
export type Lookups = {
  suppliers: Opt[]; locations: Opt[]; centers: Opt[]; destinations: Opt[]; processes: (Opt & { requires_lot: boolean })[]; units: { id: string; code: string; name: string }[];
  role: string | null; loaded: boolean;
};

export function useLookups(): Lookups {
  const [s, setS] = useState<Lookups>({ suppliers: [], locations: [], centers: [], destinations: [], processes: [], units: [], role: null, loaded: false });
  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const [sup, loc, cen, dest, proc, un, prof] = await Promise.all([
        sb.from("suppliers").select("id, name").eq("active", true).order("name"),
        sb.from("locations").select("id, name").eq("active", true).order("name"),
        sb.from("distribution_centers").select("id, name").eq("active", true).order("name"),
        sb.from("destinations").select("id, name").eq("active", true).order("name"),
        sb.from("processes").select("id, name, requires_lot").eq("active", true).order("name"),
        sb.from("units").select("id, code, name").eq("active", true).order("code"),
        u.user ? sb.from("profiles").select("role").eq("id", u.user.id).single() : Promise.resolve({ data: null }),
      ]);
      setS({
        suppliers: sup.data ?? [], locations: loc.data ?? [], centers: cen.data ?? [], destinations: dest.data ?? [],
        processes: proc.data ?? [], units: un.data ?? [], role: (prof.data as { role?: string } | null)?.role ?? null, loaded: true,
      });
    })();
  }, []);
  return s;
}

export const canWrite = (role: string | null) => role === "admin" || role === "almoxarife";

export function friendlyError(msg: string) {
  if (/row-level security|permission denied/i.test(msg)) return "Seu perfil não tem permissão para esta ação.";
  if (/duplicate key/i.test(msg)) return "Já existe um registro com esses dados.";
  return msg.replace(/^.*?ERROR:\s*/i, "");
}
