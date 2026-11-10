import { STATUS_STYLE } from "@/lib/format";

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        STATUS_STYLE[status] ?? "bg-marfim/40 text-azul ring-marfim"
      }`}
    >
      {status}
    </span>
  );
}
