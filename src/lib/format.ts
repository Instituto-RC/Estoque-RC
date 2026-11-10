export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | null | undefined, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(v ?? 0));

export const STATUS_STYLE: Record<string, string> = {
  "Sem estoque": "bg-st-sem/10 text-st-sem ring-st-sem/30",
  "Quase sem estoque": "bg-st-quase/10 text-st-quase ring-st-quase/30",
  "Estoque baixo": "bg-st-baixo/10 text-st-baixo ring-st-baixo/30",
  "Estoque moderado": "bg-st-moderado/10 text-st-moderado ring-st-moderado/30",
  "Estoque confortável": "bg-st-ok/10 text-st-ok ring-st-ok/30",
};

export const STATUS_ORDER = [
  "Sem estoque",
  "Quase sem estoque",
  "Estoque baixo",
  "Estoque moderado",
  "Estoque confortável",
];
