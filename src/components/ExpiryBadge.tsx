const STYLE: Record<string, [string, string]> = {
  vencido: ["bg-st-sem text-white", "Vencido"],
  critico: ["bg-st-sem/10 text-st-sem ring-1 ring-inset ring-st-sem/30", "Crítico"],
  atencao: ["bg-st-quase/10 text-st-quase ring-1 ring-inset ring-st-quase/30", "Atenção"],
  aviso: ["bg-st-baixo/10 text-st-baixo ring-1 ring-inset ring-st-baixo/30", "Aviso"],
  ok: ["bg-st-ok/10 text-st-ok ring-1 ring-inset ring-st-ok/30", "OK"],
  sem_validade: ["bg-marfim/50 text-azul-600", "Sem validade"],
};

export const EXPIRY_LABEL: Record<string, string> = Object.fromEntries(Object.entries(STYLE).map(([k, v]) => [k, v[1]]));

export function ExpiryBadge({ status, days }: { status: string | null; days?: number | null }) {
  if (!status) return null;
  const [cls, label] = STYLE[status] ?? STYLE.ok;
  const extra = days === null || days === undefined || status === "sem_validade" ? "" : days < 0 ? ` há ${-days}d` : ` ${days}d`;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}{extra}</span>;
}
