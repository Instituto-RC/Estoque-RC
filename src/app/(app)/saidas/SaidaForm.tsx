"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProductPicker, type PickProduct } from "@/components/ProductPicker";
import { Alert, Button, Card, Field, PageHeader, fmtDate, inputCls, today } from "@/components/ui";
import { useLookups, friendlyError } from "@/lib/lookups";
import { num } from "@/lib/format";

type LotRow = { lot_id: string; lot_number: string | null; expiry_date: string | null; is_legacy: boolean; balance: number; days_to_expiry: number | null };

export function SaidaForm() {
  const lk = useLookups();
  const [product, setProduct] = useState<PickProduct | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [dest, setDest] = useState("");
  const [proc, setProc] = useState("");
  const [center, setCenter] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => { if (lk.centers.length && !center) setCenter(lk.centers[0].id); }, [lk.centers, center]);
  useEffect(() => { if (lk.destinations.length && !dest) setDest(lk.destinations.find((d) => d.name === "CLÍNICA")?.id ?? lk.destinations[0].id); }, [lk.destinations, dest]);
  useEffect(() => {
    setLots([]); setLotId("");
    if (!product) return;
    const first = product.processes?.split("/")[0];
    setProc(lk.processes.find((p) => p.name === first)?.id ?? "");
    createClient().from("v_lot_stock").select("lot_id, lot_number, expiry_date, is_legacy, balance, days_to_expiry")
      .eq("product_id", product.product_id).gt("balance", 0)
      .then(({ data }) => {
        // FEFO: vence primeiro sai primeiro; vencidos por último (bloqueados); saldo importado sem validade depois dos datados
        const rows = ((data ?? []) as LotRow[]).sort((a, b) => {
          const ea = a.expiry_date ?? "9999", eb = b.expiry_date ?? "9999";
          const va = a.days_to_expiry !== null && a.days_to_expiry < 0, vb = b.days_to_expiry !== null && b.days_to_expiry < 0;
          if (va !== vb) return va ? 1 : -1;
          return ea.localeCompare(eb);
        });
        setLots(rows);
        const firstOk = rows.find((r) => !(r.days_to_expiry !== null && r.days_to_expiry < 0));
        if (firstOk) setLotId(firstOk.lot_id);
      });
  }, [product, lk.processes]);

  const q = Number(qty.replace(",", "."));
  const sel = lots.find((l) => l.lot_id === lotId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!product) return setMsg({ type: "error", text: "Selecione o produto." });
    if (!(q > 0)) return setMsg({ type: "error", text: "Informe a quantidade." });
    if (q > product.balance) return setMsg({ type: "error", text: `Saldo insuficiente: disponível ${num(product.balance, 2)}.` });
    if (product.requires_lot && !lotId) return setMsg({ type: "error", text: "Selecione o lote (obrigatório para IMPLANTE e HOF)." });
    if (sel && q > sel.balance) return setMsg({ type: "error", text: `O lote selecionado tem só ${num(sel.balance, 2)}. Faça a saída em mais de um lote.` });
    if (!dest) return setMsg({ type: "error", text: "Informe o destino." });
    setSaving(true);
    const { error } = await createClient().from("stock_movements").insert({
      type: "SAIDA", product_id: product.product_id, lot_id: lotId || null, quantity: q, destination_id: dest,
      process_id: proc || null, center_id: center || null, occurred_at: date, reason: note.trim() || null,
    });
    setSaving(false);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    window.scrollTo({ top: 0, behavior: "smooth" });
      setMsg({ type: "ok", text: `Saída registrada: ${q} ${product.unit ?? ""} de ${product.name}.` });
    setProduct(null); setQty(""); setNote("");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader eyebrow="Movimentação" title="Saída" />
      {msg && <Alert type={msg.type}>{msg.type === "ok" && <CheckCircle2 size={16} className="mr-1 inline" />}{msg.text}</Alert>}

      <Card><Field label="Produto" required><ProductPicker value={product} onChange={setProduct} /></Field></Card>

      {product && (
        <>
          <Card title="Lote (vence primeiro, sai primeiro)">
            {lots.length === 0 ? (
              <p className="text-sm text-azul-600">Sem saldo disponível.</p>
            ) : (
              <ul className="space-y-2">
                {lots.map((l) => {
                  const expired = l.days_to_expiry !== null && l.days_to_expiry < 0;
                  const soon = l.days_to_expiry !== null && l.days_to_expiry >= 0 && l.days_to_expiry <= 30;
                  return (
                    <li key={l.lot_id}>
                      <label className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${lotId === l.lot_id ? "bg-azul/5 ring-2 ring-azul" : "ring-marfim"} ${expired ? "opacity-60" : ""}`}>
                        <input type="radio" name="lot" disabled={expired} checked={lotId === l.lot_id} onChange={() => setLotId(l.lot_id)} className="h-5 w-5 accent-[#23272F]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{l.is_legacy ? "Saldo importado da planilha" : `Lote ${l.lot_number ?? "s/ nº"}`}</span>
                          <span className={`block text-xs ${expired ? "text-st-sem" : soon ? "text-st-quase" : "text-azul-600"}`}>
                            {l.expiry_date ? `Validade ${fmtDate(l.expiry_date)}${expired ? " · VENCIDO" : soon ? ` · vence em ${l.days_to_expiry} dias` : ""}` : "Sem validade cadastrada"}
                          </span>
                        </span>
                        <span className="text-sm font-semibold">{num(l.balance, 2)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade" required>
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
          </Card>
          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
          <Button type="submit" variant="gold" disabled={saving} className="w-full">{saving ? "Salvando..." : "Registrar saída"}</Button>
        </>
      )}
    </form>
  );
}
