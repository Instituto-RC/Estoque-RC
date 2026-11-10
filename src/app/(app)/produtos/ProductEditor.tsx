"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanLine, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, inputCls } from "@/components/ui";
import { Scanner } from "@/components/ProductPicker";
import { useLookups, canWrite, friendlyError } from "@/lib/lookups";
import { useSettings } from "@/lib/settings";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ProductEditor({ product, processIds = [], photoUrl = null }: { product?: Record<string, any>; processIds?: string[]; photoUrl?: string | null }) {
  const router = useRouter();
  const lk = useLookups();
  const isNew = !product;
  const [f, setF] = useState({
    name: product?.name ?? "", description: product?.description ?? "", unit_id: product?.unit_id ?? "",
    min_stock: product?.min_stock?.toString() ?? "", max_stock: product?.max_stock?.toString() ?? "",
    initial_unit_cost: product?.initial_unit_cost?.toString() ?? "", default_location_id: product?.default_location_id ?? "",
    preferred_supplier_id: product?.preferred_supplier_id ?? "", barcode: product?.barcode ?? "", manufacturer_ref: product?.manufacturer_ref ?? "",
    active: product?.active ?? true,
  });
  const [procs, setProcs] = useState<string[]>(processIds);
  const st = useSettings();
  useEffect(() => { if (isNew && st.loaded) setF((x) => (x.min_stock === "" ? { ...x, min_stock: String(st.num("estoque_minimo_padrao")) } : x)); }, [isNew, st.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const can = canWrite(lk.role);
  const lotRule = lk.processes.filter((p) => procs.includes(p.id)).some((p) => p.requires_lot);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!f.name.trim()) return setMsg({ type: "error", text: "Informe o nome do produto." });
    if (!f.unit_id) return setMsg({ type: "error", text: "Informe a unidade de medida." });
    if (!procs.length) return setMsg({ type: "error", text: "Selecione ao menos um processo." });
    if (n(f.min_stock) === null) return setMsg({ type: "error", text: "Informe o estoque mínimo." });
    setBusy(true);
    const sb = createClient();
    try {
      let photo_path = product?.photo_path ?? null;
      if (photo) {
        photo_path = `${crypto.randomUUID()}.${photo.name.split(".").pop() || "jpg"}`;
        const { error } = await sb.storage.from("product-photos").upload(photo_path, photo, { contentType: photo.type });
        if (error) throw error;
      }
      const row = {
        name: f.name.trim(), description: f.description.trim() || null, unit_id: f.unit_id, min_stock: n(f.min_stock) ?? 0, max_stock: n(f.max_stock),
        initial_unit_cost: n(f.initial_unit_cost), default_location_id: f.default_location_id || null, preferred_supplier_id: f.preferred_supplier_id || null,
        barcode: f.barcode.trim() || null, manufacturer_ref: f.manufacturer_ref.trim() || null, active: f.active, photo_path,
      };
      let id = product?.id as string | undefined;
      if (isNew) {
        const { data, error } = await sb.from("products").insert(row).select("id, code").single();
        if (error) throw error;
        id = data.id;
      } else {
        const { error } = await sb.from("products").update(row).eq("id", id!);
        if (error) throw error;
        await sb.from("product_processes").delete().eq("product_id", id!);
      }
      const { error: pe } = await sb.from("product_processes").insert(procs.map((process_id) => ({ product_id: id!, process_id })));
      if (pe) throw pe;
      if (isNew) router.push(`/produtos/${id}`);
      else { setMsg({ type: "ok", text: "Cadastro atualizado." }); router.refresh(); }
    } catch (err) {
      setMsg({ type: "error", text: friendlyError((err as Error).message) });
    } finally { setBusy(false); }
  }

  if (lk.loaded && !can) return isNew ? <Alert type="warn">Seu perfil não cadastra produtos.</Alert> : null;

  return (
    <form onSubmit={save} className="space-y-4">
      <Card title={isNew ? "Dados do produto" : "Editar cadastro"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do produto" required className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
          <Field label="Processos" required className="sm:col-span-2" hint={lotRule ? "Este produto exigirá lote e validade nas entradas." : "Lote opcional; a validade segue a regra do processo (Mais → Processos)."}>
            <div className="flex flex-wrap gap-2">
              {lk.processes.map((p) => {
                const on = procs.includes(p.id);
                return (
                  <button type="button" key={p.id} onClick={() => setProcs(on ? procs.filter((x) => x !== p.id) : [...procs, p.id])}
                    className={`h-10 rounded-full px-4 text-sm font-semibold ring-1 ${on ? "bg-azul text-ouro ring-azul" : "bg-white ring-marfim"}`}>
                    {p.name}{p.requires_lot ? " · lote" : ""}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Unidade de medida" required>
            <select className={inputCls} value={f.unit_id} onChange={set("unit_id")}>
              <option value="">—</option>
              {lk.units.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Custo de 1ª entrada (R$)"><input className={inputCls} inputMode="decimal" value={f.initial_unit_cost} onChange={set("initial_unit_cost")} /></Field>
          <Field label="Estoque mínimo" required><input className={inputCls} inputMode="decimal" value={f.min_stock} onChange={set("min_stock")} /></Field>
          <Field label="Estoque máximo" hint="Opcional — usado na sugestão de compra"><input className={inputCls} inputMode="decimal" value={f.max_stock} onChange={set("max_stock")} /></Field>
          <Field label="Local padrão">
            <select className={inputCls} value={f.default_location_id} onChange={set("default_location_id")}>
              <option value="">—</option>
              {lk.locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Fornecedor preferencial">
            <select className={inputCls} value={f.preferred_supplier_id} onChange={set("preferred_supplier_id")}>
              <option value="">—</option>
              {lk.suppliers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Código de barras">
            <div className="flex gap-2">
              <input className={inputCls} value={f.barcode} onChange={set("barcode")} inputMode="numeric" />
              <button type="button" onClick={() => setScan(true)} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-azul text-ouro" aria-label="Ler código"><ScanLine size={20} /></button>
            </div>
          </Field>
          <Field label="Código / REF do fabricante"><input className={inputCls} value={f.manufacturer_ref} onChange={set("manufacturer_ref")} /></Field>
          <Field label="Descrição" className="sm:col-span-2"><textarea className={`${inputCls} h-20 py-2`} value={f.description} onChange={set("description")} /></Field>
          <Field label="Foto" hint="Opcional" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-marfim" />}
              <label className={`${inputCls} flex flex-1 cursor-pointer items-center gap-2`}>
                <Camera size={18} className="text-azul-600" />
                <span className="truncate text-sm">{photo ? photo.name : "Tirar foto ou escolher"}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setPhoto(file); if (file) setPreview(URL.createObjectURL(file)); }} />
              </label>
              {preview && <button type="button" onClick={() => { setPhoto(null); setPreview(null); }} className="grid h-12 w-12 place-items-center rounded-xl bg-neve" aria-label="Remover foto"><Trash2 size={18} /></button>}
            </div>
          </Field>
          {!isNew && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-5 w-5 accent-[#23272F]" /> Produto ativo
            </label>
          )}
        </div>
      </Card>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Salvando..." : isNew ? "Cadastrar produto" : "Salvar alterações"}</Button>
      {scan && <Scanner onClose={() => setScan(false)} onCode={(c) => { setScan(false); setF((x) => ({ ...x, barcode: c })); }} />}
    </form>
  );
}
