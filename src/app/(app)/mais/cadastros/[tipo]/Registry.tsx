"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { useLookups, canWrite, friendlyError } from "@/lib/lookups";

type Col = { key: string; label: string; type?: "text" | "email" | "tel" | "bool" | "textarea"; required?: boolean; upper?: boolean };
export const REGISTRIES = {
  fornecedores: { table: "suppliers", title: "Fornecedores", cols: [
    { key: "name", label: "Nome do fornecedor", required: true, upper: true }, { key: "cnpj", label: "CNPJ" }, { key: "phone", label: "Telefone", type: "tel" },
    { key: "whatsapp", label: "WhatsApp", type: "tel" }, { key: "email", label: "E-mail", type: "email" }, { key: "contact", label: "Contato" }, { key: "notes", label: "Observações", type: "textarea" },
  ] as Col[] },
  locais: { table: "locations", title: "Locais de armazenamento", cols: [{ key: "name", label: "Local", required: true, upper: true }, { key: "notes", label: "Observações", type: "textarea" }] as Col[] },
  centros: { table: "distribution_centers", title: "Centros de distribuição", cols: [
    { key: "name", label: "Nome", required: true, upper: true }, { key: "address", label: "Endereço" }, { key: "responsible", label: "Responsável" }, { key: "phone", label: "Telefone", type: "tel" },
  ] as Col[] },
  destinos: { table: "destinations", title: "Destinos de saída", cols: [{ key: "name", label: "Destino", required: true, upper: true }] as Col[] },
  profissionais: { table: "professionals", title: "Profissionais", cols: [{ key: "name", label: "Nome", required: true, upper: true }, { key: "email", label: "E-mail", type: "email" }, { key: "phone", label: "Telefone", type: "tel" }] as Col[] },
  processos: { table: "processes", title: "Processos", cols: [{ key: "name", label: "Processo", required: true, upper: true }, { key: "requires_lot", label: "Exige número de lote", type: "bool" }, { key: "requires_expiry", label: "Exige validade", type: "bool" }] as Col[] },
  unidades: { table: "units", title: "Unidades de medida", cols: [{ key: "code", label: "Sigla", required: true, upper: true }, { key: "name", label: "Descrição", required: true }] as Col[] },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function Registry({ tipo }: { tipo: keyof typeof REGISTRIES }) {
  const cfg = REGISTRIES[tipo];
  const lk = useLookups();
  const can = canWrite(lk.role);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const titleKey = cfg.cols[0].key;

  async function load() {
    const { data } = await createClient().from(cfg.table).select("*").order(titleKey);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const row: Record<string, any> = {};
    for (const c of cfg.cols) {
      let v = edit[c.key];
      if (c.type === "bool") v = !!v;
      else { v = (v ?? "").toString().trim(); if (c.upper) v = v.toUpperCase(); if (v === "") v = null; }
      if (c.required && !v) return setMsg({ type: "error", text: `Informe ${c.label.toLowerCase()}.` });
      row[c.key] = v;
    }
    row.active = edit.active ?? true;
    setBusy(true);
    const sb = createClient();
    const { error } = edit.id ? await sb.from(cfg.table).update(row).eq("id", edit.id) : await sb.from(cfg.table).insert(row);
    setBusy(false);
    if (error) return setMsg({ type: "error", text: friendlyError(error.message) });
    setMsg({ type: "ok", text: "Salvo." }); setEdit(null); load();
  }

  const list = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Cadastros" title={cfg.title} back="/mais"
        action={can && !edit ? <Button className="h-10 px-3" onClick={() => setEdit(tipo === "processos" ? { active: true, requires_expiry: true } : { active: true })}><Plus size={16} /> Novo</Button> : undefined} />
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {edit && (
        <form onSubmit={save}>
          <Card title={edit.id ? "Editar" : "Novo"}>
            <div className="grid gap-3 sm:grid-cols-2">
              {cfg.cols.map((c) => (
                <Field key={c.key} label={c.label} required={c.required} className={c.type === "textarea" ? "sm:col-span-2" : ""}>
                  {c.type === "bool" ? (
                    <input type="checkbox" checked={!!edit[c.key]} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.checked })} className="h-6 w-6 accent-[#23272F]" />
                  ) : c.type === "textarea" ? (
                    <textarea className={`${inputCls} h-20 py-2`} value={edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })} />
                  ) : (
                    <input type={c.type ?? "text"} className={inputCls} value={edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })} />
                  )}
                </Field>
              ))}
              {edit.id && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-5 w-5 accent-[#23272F]" /> Ativo</label>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>Salvar</Button>
            </div>
          </Card>
        </form>
      )}

      <label className="flex h-11 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-marfim">
        <Search size={16} className="text-azul-600" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-full flex-1 bg-transparent outline-none" />
      </label>
      {list.length === 0 ? <Empty>Nenhum registro.</Empty> : (
        <ul className="divide-y divide-marfim/70 overflow-hidden rounded-2xl bg-white ring-1 ring-marfim">
          {list.map((r) => (
            <li key={r.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${r.active === false ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <p className="truncate font-medium">{r[titleKey]}{tipo === "unidades" ? ` — ${r.name}` : ""}</p>
                <p className="truncate text-xs text-azul-600">
                  {cfg.cols.slice(1).filter((c) => c.type !== "bool" && r[c.key] && !(tipo === "unidades" && c.key === "name")).map((c) => r[c.key]).join(" · ")}
                  {tipo === "processos" ? [r.requires_lot ? "Exige lote" : "Lote opcional", r.requires_expiry ? "exige validade" : "validade opcional"].join(" · ") : ""}
                  {r.active === false ? " · inativo" : ""}
                </p>
              </div>
              {can && <button onClick={() => setEdit({ ...r })} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neve" aria-label="Editar"><Pencil size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
