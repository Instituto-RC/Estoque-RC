import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const inputCls =
  "h-12 w-full rounded-xl bg-white px-3 text-azul outline-none ring-1 ring-marfim transition placeholder:text-azul-600/50 focus:ring-2 focus:ring-azul disabled:bg-neve disabled:text-azul-600";

export function PageHeader({ eyebrow, title, back, action }: { eyebrow?: string; title: string; back?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-sm text-azul-600">
            <ChevronLeft size={16} /> Voltar
          </Link>
        )}
        {eyebrow && <p className="text-sm text-azul-600">{eyebrow}</p>}
        <h1 className="truncate text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", title, icon }: { children: React.ReactNode; className?: string; title?: string; icon?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-marfim ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h2 className="text-lg">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, required, children, className = "" }: { label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-st-sem">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-azul-600">{hint}</span>}
    </label>
  );
}

export function Button({
  children, variant = "primary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "gold" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-azul text-ouro",
    gold: "bg-ouro text-azul",
    ghost: "bg-white text-azul ring-1 ring-marfim",
    danger: "bg-white text-st-sem ring-1 ring-st-sem/40",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold uppercase tracking-[0.08em] transition active:scale-[0.99] disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function Alert({ type, children }: { type: "error" | "ok" | "warn" | "info"; children: React.ReactNode }) {
  const c = {
    error: "bg-st-sem/10 text-st-sem ring-st-sem/30",
    ok: "bg-st-ok/10 text-st-ok ring-st-ok/30",
    warn: "bg-st-baixo/10 text-st-baixo ring-st-baixo/30",
    info: "bg-azul/5 text-azul ring-marfim",
  }[type];
  return <div role="alert" className={`rounded-xl px-3 py-2.5 text-sm ring-1 ${c}`}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white p-6 text-center text-sm text-azul-600 ring-1 ring-marfim">{children}</p>;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
