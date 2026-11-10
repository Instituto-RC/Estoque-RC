"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardCheck, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, PageHeader, fmtDate, inputCls } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, num } from "@/lib/format";
import { useLookups, canWrite, friendlyError } from "@/lib/lookups";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TYPE: Record<string, string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste", TRANSFERENCIA: "Transferência" };
const REASONS = ["Contagem física", "Perda / avaria", "Vencido", "Devolução ao fornecedor", "Correção de lançamento"];

export function ProductDetail({ product, stock, lots, monthly, movs }: { product: Any; stock: Any | null; lots: Any[]; monthly: Any[]; movs: Any[] }) {
  const router = useRouter();
  const lk = useLookups();
  const can = canWrite(lk.role);
  const [editLot, setEditLot] = useState<string | null>(null);
  const [lotNum, setLotNum] = useState("");
  const [lotExp, setLotExp] = useState("");
  const [adj, setAdj] = useState(false);
  const [counted, setCounted] = useState("");
  const [adjLot, setAdjLot] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  let acc = 0;
  const rows: Any[] = monthly.map((m) => { acc += Number(m.entries_qty) - Number(m.exits_qty); return { ...m, acc }; });
  const lotsWithBalance = lots.filter((l) => Number(l.balance) !== 0 || !l.is_legacy);
  const balance = Number(stock?.balance ?? 0);

  async function saveLot(id: string) {
    setBusy(true); setMsg(null);
    const { error } = await createClient().from("lots").update({ lot_number: lotNum.trim().toUpperCase() || null, expiry_date: lotExp || null, is_legacy: false }).eq("id", id);
    setBusy(false);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    setEditLot(null); router.refresh();
  }

  async function saveAdjust() {
    const c = Number(counted.replace(",", "."));
    if (counted === "" || isNaN(c) || c < 0) return setMsg({ type: "error", text: "Informe a quantidade contada." });
    const lot = lots.find((l) => l.lot_id === adjLot);
    const base = lot ? Number(lot.balance) : balance;
    const diff = Math.round((c - base) * 100) / 100;
    if (diff === 0) return setMsg({ type: "ok", text: "Contagem confere com o sistema. Nenhum ajuste necessário." });
    setBusy(true); setMsg(null);
    const { error } = await createClient().from("stock_movements").insert({ type: "AJUSTE", product_id: product.id, lot_id: adjLot || null, quantity: diff, reason: `${reason} (sistema ${base}, contado ${c})` });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    setMsg({ type: "ok", text: `Ajuste de ${diff > 0 ? "+" : ""}${diff} registrado.` }); setAdj(false); setCounted(""); router.refresh();
  }

  async function markReviewed() {
    const { error } = await createClient().from("products").update({ needs_review: false, review_notes: null }).eq("id", product.id);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    router.refresh();
  }

  return (
    <>
      <PageHeader eyebrow={`${product.code}${stock?.processes ? ` · ${stock.processes}` : ""}`} title={product.name} back="/produtos" />
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {product.needs_review && (
        <Alert type="warn">
          <AlertCircle size={16} className="mr-1 inline" /> <b>Revisar cadastro:</b> {product.review_notes}
          {can && <button onClick={markReviewed} className="ml-2 font-semibold underline">Marcar como revisado</button>}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Estoque atual" value={`${num(balance, 2)} ${stock?.unit ?? ""}`} extra={<StatusBadge status={stock?.status ?? null} />} />
        <Kpi label="Estoque mínimo" value={num(product.min_stock)} extra={<span className="text-xs text-azul-600">{stock?.location_name ?? "Sem local"}</span>} />
        <Kpi label="Custo médio" value={brl(stock?.avg_cost)} extra={<span className="text-xs text-azul-600">Curva {stock?.abc_class}</span>} />
        <Kpi label="Valor em estoque" value={brl(stock?.stock_value)} extra={<span className="text-xs text-azul-600">Giro {num(stock?.turnover, 2)}</span>} />
      </div>

      <Card title="Lotes e validades">
        {lotsWithBalance.length === 0 ? <p className="text-sm text-azul-600">Nenhum lote.</p> : (
          <ul className="divide-y divide-marfim/70">
            {lotsWithBalance.map((l) => (
              <li key={l.lot_id} className="py-2">
                {editLot === l.lot_id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Lote" value={lotNum} onChange={(e) => setLotNum(e.target.value)} />
                    <input className={inputCls} type="date" value={lotExp} onChange={(e) => setLotExp(e.target.value)} />
                    <Button variant="ghost" type="button" onClick={() => setEditLot(null)}>Cancelar</Button>
                    <Button type="button" disabled={busy} onClick={() => saveLot(l.lot_id)}>Salvar</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{l.is_legacy ? "Saldo importado da planilha" : `Lote ${l.lot_number ?? "s/ nº"}`}</p>
                      <p className={`text-xs ${l.days_to_expiry !== null && l.days_to_expiry < 0 ? "text-st-sem" : "text-azul-600"}`}>{l.expiry_date ? `Validade ${fmtDate(l.expiry_date)}` : "Sem validade — informe ao conferir"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{num(l.balance, 2)}</span>
                      {can && <button onClick={() => { setEditLot(l.lot_id); setLotNum(l.lot_number ?? ""); setLotExp(l.expiry_date ?? ""); }} className="grid h-9 w-9 place-items-center rounded-lg bg-neve" aria-label="Editar lote"><Pencil size={15} /></button>}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {can && !adj && <Button variant="ghost" className="mt-3 w-full" onClick={() => setAdj(true)}><ClipboardCheck size={18} /> Contagem / ajuste de estoque</Button>}
        {adj && (
          <div className="mt-3 grid gap-3 rounded-xl bg-neve p-3 sm:grid-cols-2">
            <Field label="Lote contado">
              <select className={inputCls} value={adjLot} onChange={(e) => setAdjLot(e.target.value)}>
                <option value="">Produto inteiro (sem lote)</option>
                {lots.map((l) => <option key={l.lot_id} value={l.lot_id}>{l.is_legacy ? "Saldo importado" : `Lote ${l.lot_number ?? "s/ nº"}`} — {num(l.balance, 2)}</option>)}
              </select>
            </Field>
            <Field label="Quantidade contada" required><input className={inputCls} inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
            <Field label="Motivo" className="sm:col-span-2">
              <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Button variant="ghost" type="button" onClick={() => setAdj(false)}>Cancelar</Button>
            <Button type="button" disabled={busy} onClick={saveAdjust}>Registrar ajuste</Button>
          </div>
        )}
      </Card>

      <Card title="Análise mensal">
        {rows.length === 0 ? <p className="text-sm text-azul-600">Sem movimentações.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-azul-600"><tr><th className="py-1">Mês</th><th className="py-1 text-right">Entradas</th><th className="py-1 text-right">Saídas</th><th className="py-1 text-right">Estoque</th><th className="py-1 text-right">Gasto</th></tr></thead>
              <tbody className="divide-y divide-marfim/70">
                {rows.map((r) => {
                  const [y, m] = String(r.month).split("-");
                  return (
                    <tr key={r.month}><td className="py-1.5">{MONTHS[Number(m) - 1]}/{y.slice(2)}</td><td className="py-1.5 text-right tabular-nums">{num(r.entries_qty, 2)}</td><td className="py-1.5 text-right tabular-nums">{num(r.exits_qty, 2)}</td><td className="py-1.5 text-right font-semibold tabular-nums">{num(r.acc, 2)}</td><td className="py-1.5 text-right tabular-nums">{brl(r.entries_value)}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Movimentações">
        {movs.length === 0 ? <p className="text-sm text-azul-600">Nenhuma.</p> : (
          <ul className="divide-y divide-marfim/70">
            {movs.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{TYPE[m.type]} · {fmtDate(m.occurred_at)}</p>
                  <p className="truncate text-xs text-azul-600">
                    {[m.suppliers?.name, m.destinations?.name, m.locations?.name, m.invoice_number && `NF ${m.invoice_number}`, m.responsible_name, m.reason].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-semibold tabular-nums ${m.type === "SAIDA" || Number(m.quantity) < 0 ? "text-st-sem" : "text-st-ok"}`}>{m.type === "SAIDA" ? "−" : Number(m.quantity) > 0 ? "+" : ""}{num(Math.abs(Number(m.quantity)) * (m.type === "AJUSTE" && Number(m.quantity) < 0 ? -1 : 1), 2)}</p>
                  <p className="text-[11px] text-azul-600">{brl(m.total_cost)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Kpi({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-marfim">
      <p className="text-xs text-azul-600">{label}</p>
      <p className="font-display text-xl leading-tight">{value}</p>
      <div className="mt-1">{extra}</div>
    </div>
  );
}
