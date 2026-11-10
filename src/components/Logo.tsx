import { Assinatura, Brasao } from "@/components/brand/Brand";

/** Cabeçalho: assinatura horizontal oficial + rótulo do sistema. */
export function Logo({ tone = "onDark", className = "" }: { tone?: "onDark" | "onLight"; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Assinatura tone={tone} className="h-7 w-auto" />
      <span
        className={`border-l pl-3 text-[10px] font-semibold uppercase tracking-[0.2em] ${
          tone === "onDark" ? "border-azul-600 text-ouro" : "border-marfim text-azul-600"
        }`}
      >
        Estoque
      </span>
    </div>
  );
}

export function LogoMark({ className = "h-7 w-auto" }: { className?: string }) {
  return <Brasao tone="onDark" className={className} />;
}
