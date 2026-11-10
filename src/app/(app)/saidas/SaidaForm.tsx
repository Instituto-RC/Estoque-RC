"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProductPicker, type PickProduct } from "@/components/ProductPicker";
import { Alert, Button, Card, Field, PageHeader, fmtDate, inputCls, today } from "@/components/ui";
import { useLookups, friendlyError } from "@/lib/lookups";
import { useSettings } from "@/lib/settings";
import { num } from "@/lib/format";
import { ExpiryBadge } from "@/components/ExpiryBadge";

type LotRow = {
  lot_id: string; lot_number: string | null; expiry_date: string | null; is_legacy: boolean; balance: number;
  days_to_expiry: number | null; fefo_rank: number | null; expiry_status: string; entry_date: string | null;
};
type PlanItem = { lot: LotRow; qty: number };

export function SaidaForm() {
  const lk = useLookups();
  const st = useSettings();
  const [product, setProduct] = useState<PickProduct | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [auto, setAuto] = useState(true);
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [dest, setDest] = useState("");
  const [proc, setProc] = useState("");
  const [center, setCenter] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error" | "warn"; text: string } | null>(null);

  const blockExpired = st.bool("bloquear_vencido");
  const fefoMode = st.text("fefo_modo");

  useEffect(() => { if (lk.centers.length && !center) setCenter(lk.centers[0].id); }, [lk.centers, center]);
  useEffect(() => { if (lk.destinations.length && !dest) setDest(lk.destinations.find((d) => d.name === "CLÍNICA")?.id ?? lk.destinations[0].id); }, [lk.destinations, dest]);
  useEffect(() => {
    setLots([]); setLotId(""); setMsg(null);
    if (!product) return;
    const first = product.processes?.split("/")[0];
    setProc(lk.processes.find((p) => p.name === first)?.id ?? "");
    createClient().from("v_lot_stock").select("lot_id, lot_number, expiry_date, is_legacy, balance, days_to_expiry, fefo_rank, expiry_status, entry_date")
      .eq("product_id", product.product_id).gt("balance", 0).order("fefo_rank")
      .then(({ data }) => {
        const rows = (data ?? []) as LotRow[];
        setLots(rows);
        const firstOk = rows.find((r) => r.expiry_status !== "vencido" || !blockExpired);
        if (firstOk) setLotId(firstOk.lot_id);
      });
  }, [product, lk.processes, blockExpired]);

  const usable = useMemo(() => lots.filter((l) => !(blockExpired && l.expiry_status === "vencido")), [lots, blockExpired]);
  const firstLot = usable[0];
  const q = Number(qty.replace(",", "."));
  const available = usable.reduce((a, l) => a + Number(l.balance), 0);

  const plan: PlanItem[] = useMemo(() => {
    if (!(q > 0)) return [];
    if (!auto) { const l = lots.find((x) => x.lot_id === lotId); return l ? [{ lot: l, qty: q }] : []; }
    const out: PlanItem[] = []; let left = q;
    for (const l of usable) { if (left <= 0) break; const take = Math.min(left, Number(l.balance)); out.push({ lot: l, qty: Math.round(take * 100) / 100 }); left -= take; }
    return out;
  }, [q, auto, lotId, lots, usable]);
  const planTotal = plan.reduce((a, p) => a + p.qty, 0);
  const sel = lots.find((l) => l.lot_id === lotId);
  const outOfOrder = !auto && sel && firstLot && sel.lot_id !== firstLot.lot_id && (firstLot.expiry_date ?? "9999") < (sel.expiry_date ?? "9999");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!product) return setMsg({ type: "error", text: "Selecione o produto." });
    if (!(q > 0)) return setMsg({ type: "error", text: "Informe a quantidade." });
    if (!st.bool("permitir_saldo_negativo") && q > available + 1e-9) return setMsg({ type: "error", text: `Saldo disponível ${num(available, 2)}${lots.length > usable.length ? " (lotes vencidos não entram)" : ""}.` });
    if (!plan.length || Math.abs(planTotal - q) > 1e-9) return setMsg({ type: "error", text: auto ? "Não há saldo suficiente nos lotes válidos." : `O lote selecionado tem só ${num(sel?.balance, 2)}. Ative a distribuição automática.` });
    if (outOfOrder && fefoMode === "bloquear") return setMsg({ type: "error", text: `Use primeiro o lote que vence em ${fmtDate(firstLot!.expiry_date)} (regra FEFO).` });
    if (!dest) return setMsg({ type: "error", text: "Informe o destino." });
    setSaving(true);
    const sb = createClient();
    try {
      for (const p of plan) {
        const { error } = await sb.from("stock_movements").insert({
          type: "SAIDA", product_id: product.product_id, lot_id: p.lot.lot_id, quantity: p.qty, destination_id: dest,
          process_id: proc || null, center_id: center || null, occurred_at: date, reason: note.trim() || null,
        });
        if (error) throw error;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMsg({ type: "ok", text: `Saída registrada: ${q} ${product.unit ?? ""} de ${product.name}${plan.length > 1 ? ` (${plan.length} lotes)` : ""}.` });
      setProduct(null); setQty(""); setNote("");
    } catch (err) {
      setMsg({ type: "error", text: friendlyError((err as Error).message) });
    } finally { setSaving(false); }
  }

  const lotLabel = (l: LotRow) => (l.is_legacy ? "Saldo importado da planilha" : `Lote ${l.lot_number ?? "s/ nº"}`);

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader eyebrow="Movimentação" title="Saída" />
      {msg && <Alert type={msg.type}>{msg.type === "ok" && <CheckCircle2 size={16} className="mr-1 inline" />}{msg.text}</Alert>}

      <Card><Field label="Produto" required><ProductPicker value={product} onChange={setProduct} /></Field></Card>

      {product && (
        <>
          <Card title="Lotes — vence primeiro, sai primeiro">
            {lots.length === 0 ? <p className="text-sm text-azul-600">Sem saldo disponível.</p> : (
              <>
                <label className="mb-3 flex items-center gap-2 rounded-xl bg-ouro/30 p-3 text-sm font-medium">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-5 w-5 accent-[#23272F]" />
                  <Sparkles size={16} /> Distribuir automaticamente pelos lotes que vencem primeiro
                </label>
                <ul className="space-y-2">
                  {lots.map((l) => {
                    const expired = l.expiry_status === "vencido";
                    const disabled = expired && blockExpired;
                    const inPlan = plan.find((p) => p.lot.lot_id === l.lot_id);
                    return (
                      <li key={l.lot_id}>
                        <label className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${(!auto && lotId === l.lot_id) || (auto && inPlan) ? "bg-azul/5 ring-2 ring-azul" : "ring-marfim"} ${disabled ? "opacity-60" : ""}`}>
                          {!auto && <input type="radio" name="lot" disabled={disabled} checked={lotId === l.lot_id} onChange={() => setLotId(l.lot_id)} className="h-5 w-5 accent-[#23272F]" />}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {lotLabel(l)}
                              {firstLot?.lot_id === l.lot_id && <span className="rounded-full bg-azul px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ouro">Usar primeiro</span>}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-azul-600">
                              {l.expiry_date ? `Validade ${fmtDate(l.expiry_date)}` : "Sem validade cadastrada"}
                              <ExpiryBadge status={l.expiry_status} days={l.days_to_expiry} />
                              {l.entry_date && <span>· entrou {fmtDate(l.entry_date)}</span>}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-semibold tabular-nums">{num(l.balance, 2)}</span>
                            {inPlan && <span className="block text-[11px] font-semibold text-st-ok">sai {num(inPlan.qty, 2)}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {outOfOrder && (
                  <div className="mt-3"><Alert type={fefoMode === "bloquear" ? "error" : "warn"}>Existe lote que vence antes ({fmtDate(firstLot!.expiry_date)}). {fefoMode === "bloquear" ? "A regra FEFO está em modo bloquear." : "Recomendado usar o lote marcado como \"Usar primeiro\"."}</Alert></div>
                )}
              </>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade" required hint={`Disponível ${num(available, 2)}`}>
                <input className={inputCls} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
              </Field>
              <Field label="Data">
                <input type="date" className={inputCls} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Destino" required className="col-span-2">
                <select className={inputCls} value={dest} onChange={(e) => setDest(e.target.value)}>
                  {lk.destinations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Processo">
                <select className={inputCls} value={proc} onChange={(e) => setProc(e.target.value)}>
                  <option value="">—</option>
                  {lk.processes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Centro">
                <select className={inputCls} value={center} onChange={(e) => setCenter(e.target.value)}>
                  {lk.centers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Observação" className="col-span-2">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            {plan.length > 0 && (
              <p className="mt-3 rounded-xl bg-neve p-3 text-sm">
                <b>Vai sair:</b> {plan.map((p) => `${num(p.qty, 2)} do ${lotLabel(p.lot).toLowerCase()}${p.lot.expiry_date ? ` (vence ${fmtDate(p.lot.expiry_date)})` : ""}`).join(" + ")}
              </p>
            )}
          </Card>
          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
          <Button type="submit" variant="gold" disabled={saving} className="w-full">{saving ? "Salvando..." : "Registrar saída"}</Button>
        </>
      )}
    </form>
  );
}
