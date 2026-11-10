// Assinatura provisória. Substituir pelos arquivos oficiais do Brand Pack (brasão + logotipo).
export function Logo({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const color = tone === "light" ? "text-neve" : "text-azul";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`grid h-9 w-9 place-items-center rounded-lg font-display text-sm ${
          tone === "light" ? "bg-ouro text-azul" : "bg-azul text-ouro"
        }`}
        aria-hidden
      >
        RC
      </span>
      <span className={`font-display text-lg leading-none ${color}`}>
        Instituto RC
        <span className={`block text-[11px] font-sans font-medium tracking-[0.18em] uppercase ${tone === "light" ? "text-ouro" : "text-azul-600"}`}>
          Estoque
        </span>
      </span>
    </div>
  );
}
