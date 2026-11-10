"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProductPicker, type PickProduct } from "@/components/ProductPicker";
import { Alert, Button, Card, Field, PageHeader, inputCls, today } from "@/components/ui";
import { useLookups, canWrite, friendlyError } from "@/lib/lookups";
import { brl } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export function EntradaForm() {
  const lk = useLookups();
  const st = useSettings();
  const [product, setProduct] = useState<PickProduct | null>(null);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [location, setLocation] = useState("");
  const [center, setCenter] = useState("");
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => { if (lk.centers.length && !center) setCenter(lk.centers[0].id); }, [lk.centers, center]);
  useEffect(() => {
    if (!product) return;
    const c = product.avg_cost || product.initial_unit_cost || 0;
    setCost(c ? String(Math.round(c * 100) / 100) : "");
    setLocation(product.location_id ?? "");
    setSupplier(product.preferred_supplier_id ?? "");
  }, [product]);

  const q = Number(qty.replace(",", "."));
  const c = Number(cost.replace(",", "."));
  const needLot = product?.requires_lot ?? false;
  const needExpiry = product?.requires_expiry ?? true;
  const minDays = st.num("validade_minima_entrada_dias");
  const daysLeft = expiry ? Math.round((new Date(expiry).getTime() - new Date(date).getTime()) / 86400000) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!product) return setMsg({ type: "error", text: "Selecione o produto." });
    if (!(q > 0)) return setMsg({ type: "error", text: "Informe a quantidade." });
    if (!(c >= 0) || cost === "") return setMsg({ type: "error", text: "Informe o custo unitário." });
    if (!expiry && needExpiry) return setMsg({ type: "error", text: "Validade é obrigatória." });
    if (needLot && !lot.trim()) return setMsg({ type: "error", text: "Número do lote é obrigatório para IMPLANTE e HOF." });
    if (expiry && expiry < date) return setMsg({ type: "error", text: "A validade informada já está vencida." });
    setSaving(true);
    const sb = createClient();
    try {
      // lote: reaproveita se já existir (produto + lote + validade)
      const lotNumber = lot.trim().toUpperCase() || null;
      let lotQ = sb.from("lots").select("id").eq("product_id", product.product_id).eq("is_legacy", false);
      lotQ = expiry ? lotQ.eq("expiry_date", expiry) : lotQ.is("expiry_date", null);
      lotQ = lotNumber ? lotQ.eq("lot_number", lotNumber) : lotQ.is("lot_number", null);
      const { data: found } = await lotQ.maybeSingle();
      let lotId = found?.id as string | undefined;
      if (!lotId) {
        const { data: created, error } = await sb.from("lots").insert({ product_id: product.product_id, lot_number: lotNumber, expiry_date: expiry || null, supplier_id: supplier || null }).select("id").single();
        if (error) throw error;
        lotId = created.id;
      }
      let photoPath: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        photoPath = `${date.slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("invoices").upload(photoPath, photo, { contentType: photo.type });
        if (error) throw error;
      }
      const { error } = await sb.from("stock_movements").insert({
        type: "ENTRADA", product_id: product.product_id, lot_id: lotId, quantity: q, unit_cost: c,
        supplier_id: supplier || null, invoice_number: invoice.trim() || null, invoice_photo_path: photoPath,
        location_id: location || null, center_id: center || null, occurred_at: date,
      });
      if (error) throw error;
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMsg({ type: "ok", text: `Entrada registrada: ${q} ${product.unit ?? ""} de ${product.name}.` });
      setProduct(null); setQty(""); setLot(""); setExpiry(""); setPhoto(null);
    } catch (err) {
      setMsg({ type: "error", text: friendlyError((err as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  if (lk.loaded && !canWrite(lk.role))
    return (<><PageHeader eyebrow="Movimentação" title="Entrada" /><Alert type="warn">Seu perfil não registra entradas. Fale com o administrador.</Alert></>);

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader eyebrow="Movimentação" title="Entrada" />
      {msg && <Alert type={msg.type}>{msg.type === "ok" && <CheckCircle2 size={16} className="mr-1 inline" />}{msg.text}</Alert>}

      <Card>
        <Field label="Produto" required><ProductPicker value={product} onChange={setProduct} /></Field>
      </Card>

      {product && (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade" required>
                <input className={inputCls} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
              </Field>
              <Field label="Custo unitário (R$)" required>
                <input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
            {q > 0 && c >= 0 && <p className="mt-2 text-sm text-azul-600">Total da entrada: <b className="text-azul">{brl(q * c)}</b></p>}
          </Card>

          <Card title="Lote e validade">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lote" required={needLot} hint={needLot ? "Obrigatório (IMPLANTE/HOF)" : "Opcional"}>
                <input className={inputCls} value={lot} onChange={(e) => setLot(e.target.value)} autoCapitalize="characters" />
              </Field>
              <Field label="Validade" required={needExpiry} hint={daysLeft !== null && minDays > 0 && daysLeft < minDays ? "Atenção: vence em " + daysLeft + " dias (mínimo configurado: " + minDays + ")." : undefined}>
                <input type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Origem e local">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fornecedor">
                <select className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">—</option>
                  {lk.suppliers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Nota fiscal" hint="Opcional">
                <input className={inputCls} value={invoice} onChange={(e) => setInvoice(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Local de armazenamento">
                <select className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="">—</option>
                  {lk.locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Centro de distribuição">
                <select className={inputCls} value={center} onChange={(e) => setCenter(e.target.value)}>
                  {lk.centers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Data da entrada">
                <input type="date" className={inputCls} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Foto da nota" hint="Opcional">
                <label className={`${inputCls} flex cursor-pointer items-center gap-2`}>
                  <Camera size={18} className="text-azul-600" />
                  <span className="truncate text-sm">{photo ? photo.name : "Tirar foto ou escolher"}</span>
                  <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              </Field>
            </div>
          </Card>

          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Salvando..." : "Registrar entrada"}</Button>
        </>
      )}
    </form>
  );
}
