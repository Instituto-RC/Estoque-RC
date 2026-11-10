"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export type PickProduct = {
  product_id: string;
  code: string;
  name: string;
  unit: string | null;
  balance: number;
  avg_cost: number;
  initial_unit_cost: number | null;
  location_id: string | null;
  location_name: string | null;
  requires_lot: boolean;
  processes: string | null;
  status: string;
  barcode: string | null;
  manufacturer_ref: string | null;
  preferred_supplier_id: string | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ProductPicker({ value, onChange }: { value: PickProduct | null; onChange: (p: PickProduct | null) => void }) {
  const [all, setAll] = useState<PickProduct[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [scan, setScan] = useState(false);

  useEffect(() => {
    createClient()
      .from("v_product_stock")
      .select("product_id, code, name, unit, balance, avg_cost, initial_unit_cost, location_id, location_name, requires_lot, processes, status, barcode, manufacturer_ref, preferred_supplier_id")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setAll((data ?? []) as PickProduct[]));
  }, []);

  const list = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return all.slice(0, 30);
    const words = n.split(/\s+/);
    return all.filter((p) => { const t = norm(`${p.code} ${p.name} ${p.barcode ?? ""} ${p.manufacturer_ref ?? ""}`); return words.every((w) => t.includes(w)); }).slice(0, 40);
  }, [all, q]);

  function byCode(code: string) {
    const c = code.trim().toUpperCase();
    const p = all.find((x) => x.barcode === code.trim() || x.code === c || (x.manufacturer_ref ?? "").toUpperCase() === c);
    if (p) { onChange(p); setQ(""); setOpen(false); }
    else { setQ(code); setOpen(true); }
  }

  if (value)
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 ring-2 ring-azul">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-azul-600">{value.code}{value.processes ? ` · ${value.processes}` : ""}</p>
          <p className="font-medium leading-snug">{value.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-azul-600">
            <span>Saldo {num(value.balance, 2)} {value.unit ?? ""}</span>
            <StatusBadge status={value.status} />
            {value.requires_lot && <span className="rounded-full bg-ouro px-2 py-0.5 font-semibold text-azul">Exige lote</span>}
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neve" aria-label="Trocar produto">
          <X size={18} />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <div className="flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-marfim focus-within:ring-2 focus-within:ring-azul">
          <Search size={18} className="text-azul-600" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (list.length === 1) { onChange(list[0]); setQ(""); setOpen(false); } else byCode(q); } }}
            placeholder="Nome, código IRC ou código de barras"
            className="h-full flex-1 bg-transparent outline-none"
            inputMode="search"
            autoComplete="off"
          />
        </label>
        <button type="button" onClick={() => setScan(true)} className="grid h-12 w-12 place-items-center rounded-xl bg-azul text-ouro" aria-label="Ler código de barras">
          <ScanLine size={22} />
        </button>
      </div>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl bg-white shadow-lg ring-1 ring-marfim">
          {list.length === 0 && <li className="p-3 text-sm text-azul-600">Nenhum produto encontrado.</li>}
          {list.map((p) => (
            <li key={p.product_id}>
              <button type="button" onClick={() => { onChange(p); setQ(""); setOpen(false); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-neve">
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-azul-600">{p.code}</span>
                  <span className="block truncate text-sm">{p.name}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-azul-600">{num(p.balance, 2)} {p.unit ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {scan && <Scanner onClose={() => setScan(false)} onCode={(c) => { setScan(false); byCode(c); }} />}
    </div>
  );
}

/** Leitor de código de barras pela câmera (BarcodeDetector nativo; disponível no Chrome/Android e Safari 17+). */
export function Scanner({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (globalThis as any).BarcodeDetector;
    (async () => {
      if (!BD) { setErr("Este navegador não lê código de barras pela câmera. Digite o código abaixo."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new BD({ formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "data_matrix", "upc_a", "upc_e", "itf"] });
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await det.detect(video.current);
            if (codes.length) { onCode(codes[0].rawValue); return; }
          } catch {}
          requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr("Não foi possível abrir a câmera. Verifique a permissão ou digite o código.");
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-azul/95 p-4 text-neve">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-lg">Ler código</p>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg bg-azul-600" aria-label="Fechar"><X /></button>
      </div>
      {!err && <video ref={video} className="aspect-[3/4] w-full rounded-2xl bg-black object-cover" playsInline muted />}
      {err && <p className="rounded-xl bg-azul-600 p-3 text-sm">{err}</p>}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onCode(manual); }}>
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Digitar código" className="h-12 flex-1 rounded-xl bg-azul-700 px-3 text-neve outline-none ring-1 ring-azul-600" />
        <button className="h-12 rounded-xl bg-ouro px-4 font-semibold text-azul">OK</button>
      </form>
    </div>
  );
}
