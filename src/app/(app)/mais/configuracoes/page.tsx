"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, PageHeader, inputCls } from "@/components/ui";
import { useLookups, friendlyError } from "@/lib/lookups";
import { useSettings } from "@/lib/settings";

export default function ConfiguracoesPage() {
  const lk = useLookups();
  const s = useSettings();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.loaded) setDraft(Object.fromEntries(s.rows.map((r) => [r.key, r.value]))); }, [s.loaded, s.rows]);

  const isAdmin = lk.role === "admin";
  const groups = Array.from(new Set(s.rows.map((r) => r.grp)));
  const changed = s.rows.filter((r) => JSON.stringify(r.value) !== JSON.stringify(draft[r.key]));

  async function save() {
    setMsg(null);
    for (const r of changed) {
      if (r.kind === "number" && (draft[r.key] === "" || isNaN(Number(draft[r.key])) || Number(draft[r.key]) < 0))
        return setMsg({ type: "error", text: `Valor inválido em "${r.label}".` });
    }
    const q = Number(draft.status_quase_pct), b = Number(draft.status_baixo_pct), m = Number(draft.status_moderado_pct);
    if (!(q < b && b < m)) return setMsg({ type: "error", text: "As faixas de status precisam ser crescentes: quase sem < baixo < moderado." });
    const c = Number(draft.validade_critica_dias), a = Number(draft.validade_atencao_dias), v = Number(draft.validade_aviso_dias);
    if (!(c <= a && a <= v)) return setMsg({ type: "error", text: "Os prazos de validade precisam ser crescentes: crítico ≤ atenção ≤ aviso." });
    if (!(Number(draft.abc_a_pct) < Number(draft.abc_b_pct))) return setMsg({ type: "error", text: "Curva ABC: classe A precisa ser menor que B." });
    setBusy(true);
    const sb = createClient();
    for (const r of changed) {
      const value = r.kind === "number" ? Number(draft[r.key]) : r.kind === "boolean" ? Boolean(draft[r.key]) : String(draft[r.key] ?? "");
      const { error } = await sb.from("app_settings").update({ value }).eq("key", r.key);
      if (error) { setBusy(false); return setMsg({ type: "error", text: friendlyError(error.message) }); }
    }
    setBusy(false);
    setMsg({ type: "ok", text: `${changed.length} parâmetro(s) salvo(s). As regras já valem para todo o sistema.` });
    s.reload();
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Administração" title="Configurações" back="/mais" />
      {!isAdmin && lk.loaded && <Alert type="info">Somente o administrador altera os parâmetros. Você pode consultá-los.</Alert>}
      <p className="text-sm text-azul-600">
        Regras de lote e validade por processo ficam em <Link href="/mais/cadastros/processos" className="font-semibold underline">Processos</Link>; mínimo, máximo e local de cada produto em{" "}
        <Link href="/mais/parametros" className="font-semibold underline">Parâmetros por produto</Link>.
      </p>
      {groups.map((g) => (
        <Card key={g} title={g}>
          <div className="divide-y divide-marfim/70">
            {s.rows.filter((r) => r.grp === g).map((r) => (
              <div key={r.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_14rem] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.description && <p className="text-xs text-azul-600">{r.description}</p>}
                </div>
                {r.kind === "boolean" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled={!isAdmin} checked={Boolean(draft[r.key])} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.checked })} className="h-6 w-6 accent-[#23272F]" />
                    {draft[r.key] ? "Ligado" : "Desligado"}
                  </label>
                ) : r.kind === "choice" ? (
                  <select disabled={!isAdmin} className={`${inputCls} h-11`} value={String(draft[r.key] ?? "")} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })}>
                    {(r.options ?? []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ) : (
                  <input disabled={!isAdmin} className={`${inputCls} h-11`} inputMode={r.kind === "number" ? "decimal" : "text"} value={String(draft[r.key] ?? "")} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {isAdmin && <Button className="w-full" disabled={busy || changed.length === 0} onClick={save}>{busy ? "Salvando..." : changed.length ? `Salvar ${changed.length} alteração(ões)` : "Nada alterado"}</Button>}
    </div>
  );
}
