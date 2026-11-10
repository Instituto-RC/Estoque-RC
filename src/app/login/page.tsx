"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ type: "error", text: "E-mail ou senha inválidos." });
      } else {
        router.replace("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/mais/senha`,
      });
      setMsg(
        error
          ? { type: "error", text: "Não foi possível enviar o e-mail. Tente novamente." }
          : { type: "ok", text: "Enviamos um link para redefinir sua senha." },
      );
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-dvh flex-col bg-azul text-neve">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-sm">
          <Logo tone="light" className="mb-12" />
          <h1 className="text-4xl leading-[1.1] text-neve">
            Controle de
            <br />
            <span className="text-ouro">estoque</span>
          </h1>
          <p className="mt-3 text-sm text-marfim">Entre com o e-mail cadastrado pelo administrador.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-marfim">E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl border border-azul-600 bg-azul-700 px-4 text-neve outline-none placeholder:text-marfim/50 focus:border-ouro"
                placeholder="nome@institutorcodontologia.com"
              />
            </label>
            {mode === "login" && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-marfim">Senha</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-azul-600 bg-azul-700 px-4 text-neve outline-none focus:border-ouro"
                />
              </label>
            )}

            {msg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${msg.type === "error" ? "bg-st-sem/20 text-red-200" : "bg-st-ok/20 text-green-200"}`}>
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-ouro font-semibold uppercase tracking-wide text-azul transition active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "reset" : "login");
                setMsg(null);
              }}
              className="w-full py-2 text-sm text-marfim underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Esqueci minha senha" : "Voltar para o login"}
            </button>
          </form>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-marfim/60">Instituto RC Odontologia · Manaus - AM</p>
    </main>
  );
}
