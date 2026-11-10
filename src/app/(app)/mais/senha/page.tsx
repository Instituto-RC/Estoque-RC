"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, PageHeader, inputCls } from "@/components/ui";

export default function SenhaPage() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (p1.length < 8) return setMsg({ type: "error", text: "A senha precisa ter pelo menos 8 caracteres." });
    if (p1 !== p2) return setMsg({ type: "error", text: "As senhas não conferem." });
    const { error } = await createClient().auth.updateUser({ password: p1 });
    setMsg(error ? { type: "error", text: error.message } : { type: "ok", text: "Senha alterada." });
    if (!error) { setP1(""); setP2(""); }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader eyebrow="Conta" title="Alterar senha" back="/mais" />
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <Card>
        <div className="space-y-3">
          <Field label="Nova senha"><input type="password" className={inputCls} value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Repita a nova senha"><input type="password" className={inputCls} value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></Field>
        </div>
      </Card>
      <Button type="submit" className="w-full">Salvar senha</Button>
    </form>
  );
}
