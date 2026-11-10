"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Setting = {
  key: string; value: unknown; label: string; description: string | null; grp: string;
  kind: "number" | "boolean" | "text" | "choice"; options: { v: string; l: string }[] | null; sort: number;
};

export const SETTING_DEFAULTS: Record<string, unknown> = {
  estoque_minimo_padrao: 1, fefo_modo: "avisar", bloquear_vencido: true, validade_critica_dias: 30, validade_atencao_dias: 60,
  validade_aviso_dias: 90, validade_minima_entrada_dias: 0, sem_giro_dias: 60, compra_multiplicador: 2, permitir_saldo_negativo: false,
};

export function useSettings() {
  const [map, setMap] = useState<Record<string, unknown>>(SETTING_DEFAULTS);
  const [rows, setRows] = useState<Setting[]>([]);
  const [loaded, setLoaded] = useState(false);
  async function reload() {
    const { data } = await createClient().from("app_settings").select("*").order("sort");
    const list = (data ?? []) as Setting[];
    setRows(list);
    setMap({ ...SETTING_DEFAULTS, ...Object.fromEntries(list.map((r) => [r.key, r.value])) });
    setLoaded(true);
  }
  useEffect(() => { reload(); }, []);
  const num = (k: string) => Number(map[k] ?? SETTING_DEFAULTS[k] ?? 0);
  const bool = (k: string) => Boolean(map[k] ?? SETTING_DEFAULTS[k]);
  const text = (k: string) => String(map[k] ?? SETTING_DEFAULTS[k] ?? "");
  return { map, rows, loaded, reload, num, bool, text };
}
