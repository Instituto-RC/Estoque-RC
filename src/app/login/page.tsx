"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Brasao, Logotipo, Pattern } from "@/components/brand/Brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg({ type: "error", text: "E-mail ou senha inválidos." });
      else {
        router.replace("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-azul text-neve lg:flex-row">
      {/* Painel de marca (desktop) */}
      <section className="relative hidden flex-1 lg:block">
        <Pattern name="raiz-modular" color="#D4C9BE" background="#23272F" className="absolute inset-0 h-full w-full opacity-[0.10]" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logotipo tone="onDark" className="h-8 w-auto" />
          <div>
            <p className="font-display text-6xl leading-[1.1]">
              Onde se forma a<br />
              <span className="text-ouro">elite da odontologia.</span>
            </p>
            <p className="mt-6 max-w-md text-marfim">Controle de estoque do Instituto RC — materiais, lotes e validades em um só lugar.</p>
          </div>
          <p className="text-xs text-marfim/60">Instituto RC © {new Date().getFullYear()}</p>
        </div>
      </section>

      {/* Formulário */}
      <section className="relative flex flex-1 flex-col justify-center px-6 py-10 lg:max-w-xl lg:bg-azul-700">
        <Pattern
          name="centro-vivo"
          color="#2E333D"
          background="transparent"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 opacity-70 lg:hidden"
        />
        <div className="relative mx-auto w-full max-w-sm">
          {/* Brasão com área de proteção (0,5X) */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="p-4">
              <Brasao tone="onDark" className="h-24 w-auto" />
            </div>
            <Logotipo tone="onDark" className="mt-4 h-6 w-auto" />
            <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-ouro">Controle de estoque</span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-marfim">E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl border border-azul-600 bg-azul px-4 text-neve outline-none transition placeholder:text-marfim/40 focus:border-ouro"
                placeholder="seu@email.com"
              />
            </label>
            {mode === "login" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-marfim">Senha</span>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-azul-600 bg-azul px-4 pr-12 text-neve outline-none transition focus:border-ouro"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-1 top-1 grid h-10 w-10 place-items-center text-marfim"
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {msg && (
              <p
                role="alert"
                className={`rounded-lg px-3 py-2 text-sm ${msg.type === "error" ? "bg-st-sem/25 text-red-100" : "bg-st-ok/25 text-green-100"}`}
              >
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-ouro text-sm font-semibold uppercase tracking-[0.12em] text-azul transition hover:bg-[#ddd3c9] active:scale-[0.99] disabled:opacity-60"
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
        <p className="relative mt-12 text-center text-xs text-marfim/50 lg:hidden">Instituto RC © {new Date().getFullYear()} · Manaus - AM</p>
      </section>
    </main>
  );
}
