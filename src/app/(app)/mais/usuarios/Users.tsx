"use client";

import { useEffect, useState } from "react";
import { createClient as createBrowser } from "@supabase/supabase-js";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, PageHeader, inputCls } from "@/components/ui";
import { useLookups, friendlyError } from "@/lib/lookups";

type P = { id: string; full_name: string; email: string | null; role: string; active: boolean };
const ROLES = [
  { v: "admin", l: "Administrador", d: "Tudo, inclusive importação e usuários" },
  { v: "almoxarife", l: "Almoxarife", d: "Cadastros, entradas, saídas, inventário" },
  { v: "profissional", l: "Profissional", d: "Registra saídas e consulta saldo" },
  { v: "leitura", l: "Consulta", d: "Somente visualização" },
];

export function Users() {
  const lk = useLookups();
  const [rows, setRows] = useState<P[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [nu, setNu] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await createClient().from("profiles").select("id, full_name, email, role, active").order("full_name");
    setRows((data ?? []) as P[]);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, patch: Partial<P>) {
    setMsg(null);
    const { error } = await createClient().from("profiles").update(patch).eq("id", id);
    if (error) setMsg({ type: "error", text: friendlyError(error.message) });
    load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nu.email.trim() || nu.password.length < 8) return setMsg({ type: "error", text: "Informe e-mail e uma senha provisória com 8+ caracteres." });
    setBusy(true);
    // cliente separado para não trocar a sessão do administrador
    const tmp = createBrowser(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await tmp.auth.signUp({ email: nu.email.trim(), password: nu.password, options: { data: { full_name: nu.name.trim() }, emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    setMsg({ type: "ok", text: "Usuário criado como inativo. Escolha o perfil e ative abaixo. Se a confirmação de e-mail estiver ligada no Supabase, ele precisa confirmar pelo link recebido." });
    setNu({ name: "", email: "", password: "" });
    setTimeout(load, 800);
  }

  if (lk.loaded && lk.role !== "admin") return (<><PageHeader eyebrow="Mais" title="Usuários" back="/mais" /><Alert type="warn">Somente administradores gerenciam usuários.</Alert></>);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Mais" title="Usuários" back="/mais" />
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-2xl bg-white p-3 ring-1 ${r.active ? "ring-marfim" : "ring-st-baixo/50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.full_name || r.email}</p>
                <p className="truncate text-xs text-azul-600">{r.email}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" checked={r.active} onChange={(e) => update(r.id, { active: e.target.checked })} className="h-5 w-5 accent-[#23272F]" />
                {r.active ? "Ativo" : "Inativo"}
              </label>
            </div>
            <select value={r.role} onChange={(e) => update(r.id, { role: e.target.value })} className={`${inputCls} mt-2 h-11`}>
              {ROLES.map((x) => <option key={x.v} value={x.v}>{x.l} — {x.d}</option>)}
            </select>
          </li>
        ))}
      </ul>

      <form onSubmit={create}>
        <Card title="Novo usuário" icon={<UserPlus size={18} />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome"><input className={inputCls} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></Field>
            <Field label="E-mail" required><input type="email" className={inputCls} value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></Field>
            <Field label="Senha provisória" required hint="A pessoa troca em “Esqueci minha senha”"><input type="text" className={inputCls} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></Field>
          </div>
          <Button type="submit" disabled={busy} className="mt-3 w-full">{busy ? "Criando..." : "Criar usuário"}</Button>
        </Card>
      </form>
    </div>
  );
}
