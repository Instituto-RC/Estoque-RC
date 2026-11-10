// Leitor da "Planilha de Controle de Estoque 4.0" do Instituto RC.
// Regras derivadas da auditoria completa da planilha (ver docs/AUDITORIA_PLANILHA.md).
import * as XLSX from "xlsx";

export type Level = "erro" | "aviso" | "correcao" | "info";
export type Issue = { level: Level; sheet: string; row?: number; message: string };

export type ProductIn = {
  code: string;
  name: string;
  unit: string | null;
  min_stock: number | null;
  cost: number | null;
  processes: string[];
  registered_at: string | null;
  location: string | null;
  needs_review: boolean;
  review_notes: string;
};
export type EntryIn = {
  row: number; date: string; product_code: string; invoice: string | null; responsible: string | null;
  unit_cost: number; qty: number; supplier: string; location: string | null; center: string | null;
};
export type ExitIn = {
  row: number; date: string; product_code: string; responsible: string | null; qty: number;
  unit_cost: number; center: string | null; destination: string | null;
};

export type ImportPayload = {
  file_name: string;
  units: { code: string; name: string }[];
  processes: { name: string; requires_lot: boolean }[];
  centers: { name: string; address: string | null; responsible: string | null; phone: string | null }[];
  locations: { name: string; notes: string | null }[];
  suppliers: { name: string; email: string | null; phone: string | null; notes: string | null }[];
  professionals: { name: string; email: string | null; phone: string | null }[];
  destinations: string[];
  products: ProductIn[];
  entries: EntryIn[];
  exits: ExitIn[];
  validades: { code: string; validades: { date: string; qty: number | null }[] }[];
  summary: Summary;
  issues: Issue[];
};

export type Summary = {
  products: number; suppliers: number; locations: number; centers: number; professionals: number;
  entries: number; exits: number;
  entries_qty: number; exits_qty: number; balance_qty: number;
  entries_value: number; exits_value: number; exits_value_planilha: number;
  stock_value: number; stock_value_planilha: number;
  planilha: { variedade: number | null; quantidade: number | null; valor: number | null };
  products_review: number; negative_balance: { code: string; name: string; balance: number }[];
  errors: number; warnings: number; corrections: number;
  validades_lidas: number;
};

const REQUIRED: Record<string, { headerRow: number; headers: Record<string, string> }> = {
  CADA_PROD: { headerRow: 4, headers: { C: "Código", D: "Nome do produto", E: "Estoque mínimo", F: "Data de cadastro", G: "Custo unitário", H: "Unidade", I: "PROCESSOS" } },
  CADA_FORN: { headerRow: 4, headers: { C: "Nome do fornecedor" } },
  CADA_LOCA: { headerRow: 4, headers: { C: "Local de Armazenamento" } },
  CADA_CENT: { headerRow: 4, headers: { C: "Nome" } },
  CADA_PROF: { headerRow: 4, headers: { C: "Nome do profissional" } },
  MOVI_ENTR: { headerRow: 4, headers: { C: "Data", D: "Produto", H: "Custo unitário", I: "Qtde", J: "Fornecedor", N: "Local", O: "Centro" } },
  MOVI_SAID: { headerRow: 5, headers: { C: "Data", D: "Produto", G: "Respons", H: "Qtde", K: "Centro", L: "Destino" } },
};

export const NO_SUPPLIER = "FORNECEDOR NÃO INFORMADO";
const PLACEHOLDER_SUPPLIERS = new Set(["FORNECEDOR 2", "FORNECEDOR", "FORNECEDOR 1"]);
const LOT_PROCESSES = new Set(["IMPLANTE", "HOF"]);
const UNIT_NAMES: Record<string, string> = { UNID: "Unidade", ML: "Mililitro", L: "Litro", CX: "Caixa", PC: "Peça", PCT: "Pacote" };

const spaces = (s: string) => s.replace(/\s+/g, " ").trim();
const unaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const keyOf = (s: unknown) => spaces(String(s ?? "")).toUpperCase();
const str = (v: unknown) => (v === null || v === undefined ? null : spaces(String(v)) || null);
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

function excelDate(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return null;
}

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Converte um texto/valor de validade em data ISO. Aceita serial do Excel, dd/mm/aaaa, dd/mm/aa, mm/aaaa, aaaa-mm-dd. */
export function parseExpiry(v: unknown): string | null {
  if (typeof v === "number") return excelDate(v);
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v !== "string") return null;
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= lastDay(y, +m[2])) return iso(y, +m[2], +m[1]);
    return null;
  }
  m = t.match(/^(\d{1,2})[/.-](\d{4}|\d{2})$/);
  if (m) {
    const y = +m[2] < 100 ? 2000 + +m[2] : +m[2];
    if (+m[1] >= 1 && +m[1] <= 12) return iso(y, +m[1], lastDay(y, +m[1]));
  }
  return null;
}

/** Uma célula pode ter várias validades: "10 - 05/2027; 5 - 08/2027", "05/2027 (10)" ou "10x 03/2028 e 4x 06/2028". */
export function parseExpiryCell(v: unknown): { list: { date: string; qty: number | null }[]; bad: string[] } {
  if (v === null || v === undefined || v === "") return { list: [], bad: [] };
  if (typeof v === "number" || v instanceof Date) {
    const d = parseExpiry(v);
    return d ? { list: [{ date: d, qty: null }], bad: [] } : { list: [], bad: [String(v)] };
  }
  const parts = String(v).split(/[;\n|]+|,(?!\d)|\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  const list: { date: string; qty: number | null }[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    const direct = parseExpiry(p);
    if (direct) { list.push({ date: direct, qty: null }); continue; }
    let qty: number | null = null;
    let txt = p;
    let m = p.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|un\.?|unid\.?|-|:)\s*(.+)$/i);
    if (m && /\d{1,2}[/.-]\d{2,4}/.test(m[2])) { qty = Number(m[1].replace(",", ".")); txt = m[2]; }
    else {
      m = p.match(/^(.+?)\s*\((\d+(?:[.,]\d+)?)\)$/);
      if (m) { txt = m[1]; qty = Number(m[2].replace(",", ".")); }
    }
    txt = txt.replace(/^(val\.?|validade:?|venc\.?)\s*/i, "").trim();
    const d = parseExpiry(txt);
    if (d) list.push({ date: d, qty });
    else bad.push(p);
  }
  return { list, bad };
}

function normDestination(v: string | null) {
  if (!v) return null;
  const u = unaccent(v).toUpperCase();
  if (u === "CLINICA") return "CLÍNICA";
  if (u === "DEVOLUCAO") return "DEVOLUÇÃO";
  if (u === "CONSULTORIO DR. RAFAEL" || u === "CONSULTORIO DR RAFAEL") return "CONSULTÓRIO DR. RAFAEL";
  return v.toUpperCase();
}

export function parsePlanilha(data: ArrayBuffer | Uint8Array, fileName: string): ImportPayload {
  const wb = XLSX.read(data, { type: "array", cellFormula: true, cellDates: false });
  const issues: Issue[] = [];
  const add = (level: Level, sheet: string, message: string, row?: number) => issues.push({ level, sheet, row, message });
  const v = (sheet: string, addr: string) => wb.Sheets[sheet]?.[addr]?.v;
  const lastRow = (sheet: string) => (wb.Sheets[sheet]?.["!ref"] ? XLSX.utils.decode_range(wb.Sheets[sheet]["!ref"]!).e.r + 1 : 0);

  // ---- estrutura
  for (const [sheet, spec] of Object.entries(REQUIRED)) {
    if (!wb.Sheets[sheet]) {
      add("erro", sheet, `Aba ${sheet} não encontrada. Envie a planilha original de controle de estoque.`);
      continue;
    }
    for (const [col, h] of Object.entries(spec.headers)) {
      const got = String(v(sheet, `${col}${spec.headerRow}`) ?? "");
      if (!unaccent(got).toUpperCase().includes(unaccent(h).toUpperCase()))
        add("erro", sheet, `Cabeçalho inesperado em ${col}${spec.headerRow}: esperado "${h}", encontrado "${got}".`);
    }
  }
  const empty = (): ImportPayload => ({
    file_name: fileName, units: [], processes: [], centers: [], locations: [], suppliers: [], professionals: [], destinations: [],
    products: [], entries: [], exits: [], validades: [], issues, summary: summarize([], [], [], issues, 0, 0, 0, 0, 0, { variedade: null, quantidade: null, valor: null }, []),
  });
  if (issues.some((i) => i.level === "erro")) return empty();

  // ---- CADA_CENT
  const centers: ImportPayload["centers"] = [];
  for (let r = 5; r <= lastRow("CADA_CENT"); r++) {
    const name = str(v("CADA_CENT", `C${r}`));
    if (!name) continue;
    centers.push({ name: name.toUpperCase(), address: str(v("CADA_CENT", `D${r}`)), responsible: str(v("CADA_CENT", `E${r}`)), phone: str(v("CADA_CENT", `F${r}`)) });
  }
  const centerKeys = new Set(centers.map((c) => c.name));

  // ---- CADA_LOCA
  const locations: ImportPayload["locations"] = [];
  const locKeys = new Set<string>();
  for (let r = 5; r <= lastRow("CADA_LOCA"); r++) {
    const name = str(v("CADA_LOCA", `C${r}`));
    if (!name) continue;
    const k = name.toUpperCase();
    if (locKeys.has(k)) { add("aviso", "CADA_LOCA", `Local duplicado "${name}" ignorado.`, r); continue; }
    locKeys.add(k);
    locations.push({ name: k, notes: str(v("CADA_LOCA", `D${r}`)) });
  }

  // ---- CADA_FORN
  const suppliers: ImportPayload["suppliers"] = [];
  const supKeys = new Set<string>();
  for (let r = 5; r <= lastRow("CADA_FORN"); r++) {
    const name = str(v("CADA_FORN", `C${r}`));
    if (!name) continue;
    const k = name.toUpperCase();
    if (supKeys.has(k)) { add("aviso", "CADA_FORN", `Fornecedor duplicado "${name}" ignorado.`, r); continue; }
    supKeys.add(k);
    suppliers.push({ name: k, email: str(v("CADA_FORN", `D${r}`)), phone: str(v("CADA_FORN", `E${r}`)), notes: str(v("CADA_FORN", `F${r}`)) });
  }

  // ---- CADA_PROF
  const professionals: ImportPayload["professionals"] = [];
  const profKeys = new Set<string>();
  for (let r = 5; r <= lastRow("CADA_PROF"); r++) {
    const name = str(v("CADA_PROF", `C${r}`));
    if (!name) continue;
    const k = name.toUpperCase();
    if (profKeys.has(k)) continue;
    profKeys.add(k);
    professionals.push({ name: k, email: str(v("CADA_PROF", `D${r}`)), phone: str(v("CADA_PROF", `E${r}`)) });
  }

  // ---- CADA_PROD
  const products: ProductIn[] = [];
  const byKey = new Map<string, ProductIn>();
  const codes = new Set<string>();
  let maxCode = 0;
  const unitSet = new Set<string>();
  const procSet = new Set<string>();
  let trimmedNames = 0;
  for (let r = 5; r <= lastRow("CADA_PROD"); r++) {
    const code = str(v("CADA_PROD", `C${r}`))?.toUpperCase() ?? null;
    const rawName = v("CADA_PROD", `D${r}`);
    const name = str(rawName);
    if (!code && !name) continue;
    if (!code) { add("erro", "CADA_PROD", `Produto "${name}" sem código. Linha ignorada.`, r); continue; }
    const n = code.match(/^IRC(\d+)$/) ? Number(code.slice(3)) : NaN;
    if (!isNaN(n)) maxCode = Math.max(maxCode, n);
    if (!name) { add("aviso", "CADA_PROD", `Código ${code} sem nome de produto — linha ignorada.`, r); continue; }
    if (codes.has(code)) { add("erro", "CADA_PROD", `Código ${code} repetido — linha ignorada.`, r); continue; }
    codes.add(code);
    if (!/^IRC\d{4}$/.test(code)) add("aviso", "CADA_PROD", `Código ${code} fora do padrão IRC0000.`, r);
    const notes: string[] = [];
    if (typeof rawName === "string" && rawName !== spaces(rawName)) trimmedNames++;

    const unit = str(v("CADA_PROD", `H${r}`))?.toUpperCase() ?? null;
    if (unit && str(v("CADA_PROD", `H${r}`)) !== unit) add("correcao", "CADA_PROD", `${code}: unidade "${str(v("CADA_PROD", `H${r}`))}" padronizada para "${unit}".`, r);
    if (!unit) { notes.push("Sem unidade de medida"); }
    else unitSet.add(unit);

    const procRaw = str(v("CADA_PROD", `I${r}`));
    const procs = procRaw ? Array.from(new Set(procRaw.toUpperCase().split("/").map((s) => spaces(s)).filter(Boolean))) : [];
    if (procs.length > 1) add("correcao", "CADA_PROD", `${code}: processo "${procRaw}" dividido em ${procs.join(" + ")}.`, r);
    if (!procs.length) notes.push("Sem processo");
    procs.forEach((p) => procSet.add(p));

    const min = num(v("CADA_PROD", `E${r}`));
    if (min === null) notes.push("Sem estoque mínimo");
    const cost = num(v("CADA_PROD", `G${r}`));
    if (cost === null) notes.push("Sem custo de primeira entrada");

    const rawDate = v("CADA_PROD", `F${r}`);
    const date = excelDate(rawDate);
    if (rawDate != null && rawDate !== "" && !date) add("correcao", "CADA_PROD", `${code}: data de cadastro inválida "${rawDate}" — será usada a data da 1ª entrada.`, r);

    const prod: ProductIn = { code, name, unit, min_stock: min, cost, processes: procs, registered_at: date, location: null, needs_review: notes.length > 0, review_notes: notes.join("; ") };
    const k = keyOf(name);
    const dup = byKey.get(k);
    if (dup) {
      prod.needs_review = true;
      prod.review_notes = [prod.review_notes, `Nome idêntico ao ${dup.code} — as movimentações da planilha ficam no ${dup.code}`].filter(Boolean).join("; ");
      add("aviso", "CADA_PROD", `${code} tem o mesmo nome de ${dup.code} ("${name}"). Movimentações vinculadas ao ${dup.code}, como na planilha. Revise se é duplicado.`, r);
    } else byKey.set(k, prod);
    if (notes.length) add("aviso", "CADA_PROD", `${code} ${name}: ${notes.join(", ")} — marcado para revisão.`, r);
    products.push(prod);
  }

  if (trimmedNames) add("correcao", "CADA_PROD", `${trimmedNames} nomes de produto tinham espaços extras (início/fim/duplos). Na planilha isso faz o PROCV falhar; no sistema os nomes foram limpos.`);

  const supplierFor = (raw: string | null, row: number, counter: { placeholder: number; blank: number }) => {
    if (!raw) { counter.blank++; return NO_SUPPLIER; }
    const k = raw.toUpperCase();
    if (PLACEHOLDER_SUPPLIERS.has(k)) { counter.placeholder++; return NO_SUPPLIER; }
    if (!supKeys.has(k)) { supKeys.add(k); suppliers.push({ name: k, email: null, phone: null, notes: "Criado pela importação (aparece nas entradas)" }); add("correcao", "MOVI_ENTR", `Fornecedor "${raw}" não estava cadastrado — criado.`, row); }
    return k;
  };
  const locationFor = (raw: string | null, sheet: string, row: number) => {
    if (!raw) return null;
    const k = raw.toUpperCase();
    if (!locKeys.has(k)) { locKeys.add(k); locations.push({ name: k, notes: "Criado pela importação" }); add("correcao", sheet, `Local "${raw}" não estava cadastrado — criado.`, row); }
    return k;
  };
  const centerFor = (raw: string | null, sheet: string, row: number) => {
    if (!raw) return centers[0]?.name ?? null;
    const k = raw.toUpperCase();
    if (!centerKeys.has(k)) { centerKeys.add(k); centers.push({ name: k, address: null, responsible: null, phone: null }); add("correcao", sheet, `Centro "${raw}" não estava cadastrado — criado.`, row); }
    return k;
  };
  const profFor = (raw: string | null) => {
    if (!raw) return null;
    const k = raw.toUpperCase();
    if (!profKeys.has(k)) { profKeys.add(k); professionals.push({ name: k, email: null, phone: null }); }
    return k;
  };

  // ---- MOVI_ENTR
  const entries: EntryIn[] = [];
  const supCounter = { placeholder: 0, blank: 0 };
  let noMonthE = 0, zeroEntries = 0;
  for (let r = 5; r <= lastRow("MOVI_ENTR"); r++) {
    const rawP = v("MOVI_ENTR", `D${r}`);
    if (rawP == null || String(rawP).trim() === "") continue;
    const date = excelDate(v("MOVI_ENTR", `C${r}`));
    const qty = num(v("MOVI_ENTR", `I${r}`));
    const cost = num(v("MOVI_ENTR", `H${r}`));
    if (!date) { add("erro", "MOVI_ENTR", `Data inválida "${v("MOVI_ENTR", `C${r}`)}" — linha ignorada.`, r); continue; }
    let prod = byKey.get(keyOf(rawP));
    if (qty === 0) {
      zeroEntries++;
      const loc0 = locationFor(str(v("MOVI_ENTR", `N${r}`)), "MOVI_ENTR", r);
      if (prod && !prod.location && loc0) prod.location = loc0;
      continue;
    }
    if (qty === null || qty < 0) { add("erro", "MOVI_ENTR", `Quantidade inválida "${v("MOVI_ENTR", `I${r}`)}" — linha ignorada.`, r); continue; }
    if (!prod) {
      // nome incompleto: se for o início do nome de exatamente 1 produto cadastrado, vincula a ele
      const k = keyOf(rawP);
      const cands = products.filter((p) => keyOf(p.name).startsWith(k));
      if (cands.length === 1) {
        prod = cands[0];
        prod.needs_review = true;
        prod.review_notes = [prod.review_notes, `Entrada da linha ${r} veio com nome incompleto "${spaces(String(rawP))}" e foi vinculada a este produto`].filter(Boolean).join("; ");
        add("correcao", "MOVI_ENTR", `Produto "${spaces(String(rawP))}" não existe com esse nome; é o início de ${prod.code} "${prod.name}" (mesmo custo/data). Entrada vinculada ao ${prod.code} — na planilha essas unidades ficavam fora do inventário.`, r);
      }
    }
    if (!prod) {
      maxCode++;
      const code = `IRC${String(maxCode).padStart(4, "0")}`;
      prod = { code, name: spaces(String(rawP)), unit: str(v("MOVI_ENTR", `E${r}`))?.toUpperCase() || "UNID", min_stock: null, cost: cost, processes: [], registered_at: date, location: null, needs_review: true, review_notes: "Produto não estava no cadastro — criado pela importação a partir da entrada" };
      if (prod.unit) unitSet.add(prod.unit);
      products.push(prod); byKey.set(keyOf(rawP), prod); codes.add(code);
      add("correcao", "MOVI_ENTR", `Produto "${prod.name}" não existe no CADA_PROD — criado como ${code} (revisar).`, r);
    }
    const f = wb.Sheets.MOVI_ENTR[`H${r}`]?.f;
    if (f && !f.includes(`D${r},`)) add("info", "MOVI_ENTR", `Custo unitário vinha de fórmula apontando para a linha de cima (${f}); valor ${cost} conferido com o cadastro.`, r);
    const qf = wb.Sheets.MOVI_ENTR[`I${r}`]?.f;
    if (qf) add("info", "MOVI_ENTR", `Quantidade era uma conta (${qf}) — importado o resultado ${qty}.`, r);
    if (!(typeof v("MOVI_ENTR", `B${r}`) === "number")) noMonthE++;
    const location = locationFor(str(v("MOVI_ENTR", `N${r}`)), "MOVI_ENTR", r);
    if (!prod.location && location) prod.location = location;
    if (!prod.registered_at) prod.registered_at = date;
    if (prod.cost === null && cost !== null) { prod.cost = cost; prod.review_notes = prod.review_notes.replace("Sem custo de primeira entrada", "Custo de 1ª entrada preenchido pela 1ª entrada da planilha"); if (prod.review_notes === "Custo de 1ª entrada preenchido pela 1ª entrada da planilha") { prod.needs_review = false; prod.review_notes = ""; } add("correcao", "CADA_PROD", `${prod.code}: custo de 1ª entrada vazio — preenchido com R$ ${cost} da primeira entrada.`, r); }
    entries.push({
      row: r, date, product_code: prod.code, invoice: str(v("MOVI_ENTR", `F${r}`)), responsible: profFor(str(v("MOVI_ENTR", `G${r}`))),
      unit_cost: cost ?? prod.cost ?? 0, qty, supplier: supplierFor(str(v("MOVI_ENTR", `J${r}`)), r, supCounter),
      location, center: centerFor(str(v("MOVI_ENTR", `O${r}`)), "MOVI_ENTR", r),
    });
    if (cost === null) add("aviso", "MOVI_ENTR", `Entrada sem custo unitário — usado o custo do cadastro.`, r);
  }
  if (supCounter.placeholder + supCounter.blank > 0) {
    if (!supKeys.has(NO_SUPPLIER)) { supKeys.add(NO_SUPPLIER); suppliers.push({ name: NO_SUPPLIER, email: null, phone: null, notes: "Entradas da planilha sem fornecedor real" }); }
    add("aviso", "MOVI_ENTR", `${supCounter.placeholder} entradas com fornecedor "Fornecedor 2" (texto de exemplo do modelo) e ${supCounter.blank} sem fornecedor → registradas como "${NO_SUPPLIER}".`);
  }
  if (zeroEntries) add("info", "MOVI_ENTR", `${zeroEntries} entradas com quantidade 0 (produto lançado sem estoque). Não alteram saldo nem valor; o local foi aproveitado para o cadastro do produto.`);
  if (noMonthE) add("correcao", "MOVI_ENTR", `${noMonthE} entradas estavam sem a fórmula de mês (coluna B) e ficavam fora do relatório mensal da planilha. No sistema o mês vem da data.`);

  // ---- MOVI_SAID
  const exits: ExitIn[] = [];
  const destSet = new Set<string>();
  let noMonthS = 0, wrongTotal = 0, exitsValuePlan = 0;
  const destFix: Record<string, number> = {};
  for (let r = 6; r <= lastRow("MOVI_SAID"); r++) {
    const rawP = v("MOVI_SAID", `D${r}`);
    if (rawP == null || String(rawP).trim() === "") continue;
    const date = excelDate(v("MOVI_SAID", `C${r}`));
    const qty = num(v("MOVI_SAID", `H${r}`));
    if (!date) { add("erro", "MOVI_SAID", `Data inválida "${v("MOVI_SAID", `C${r}`)}" — linha ignorada.`, r); continue; }
    if (qty === null || qty <= 0) { add("erro", "MOVI_SAID", `Quantidade inválida "${v("MOVI_SAID", `H${r}`)}" — linha ignorada.`, r); continue; }
    const prod = byKey.get(keyOf(rawP));
    if (!prod) { add("erro", "MOVI_SAID", `Saída de produto não cadastrado "${rawP}" — linha ignorada.`, r); continue; }
    const unitCost = prod.cost ?? 0; // regra da planilha: Total de Saídas = custo de 1ª entrada × qtde
    const planTotal = num(v("MOVI_SAID", `J${r}`)) ?? 0;
    exitsValuePlan += planTotal;
    if (Math.abs(planTotal - unitCost * qty) > 0.01) {
      wrongTotal++;
      add("correcao", "MOVI_SAID", `${prod.code} ${prod.name}: "Total de Saídas" na planilha R$ ${round2(planTotal)} usava a quantidade de outra linha; correto R$ ${round2(unitCost * qty)} (${qty} × R$ ${unitCost}).`, r);
    }
    if (!(typeof v("MOVI_SAID", `B${r}`) === "number")) noMonthS++;
    const dest = normDestination(str(v("MOVI_SAID", `L${r}`)));
    if (dest && str(v("MOVI_SAID", `L${r}`)) !== dest) { const k0 = `${str(v("MOVI_SAID", `L${r}`))} → ${dest}`; destFix[k0] = (destFix[k0] ?? 0) + 1; }
    if (dest) destSet.add(dest);
    exits.push({ row: r, date, product_code: prod.code, responsible: profFor(str(v("MOVI_SAID", `G${r}`))), qty, unit_cost: unitCost, center: centerFor(str(v("MOVI_SAID", `K${r}`)), "MOVI_SAID", r), destination: dest });
  }
  Object.entries(destFix).forEach(([k0, n0]) => add("correcao", "MOVI_SAID", `Destino padronizado: ${k0} (${n0} saídas).`));
  if (noMonthS) add("correcao", "MOVI_SAID", `${noMonthS} saídas estavam sem a fórmula de mês (coluna B) e ficavam fora do relatório mensal da planilha.`);
  if (wrongTotal) add("correcao", "MOVI_SAID", `${wrongTotal} saídas tinham o valor (R$) calculado com a quantidade da linha de baixo. Valores recalculados.`);
  const extLinks = Object.keys(wb.Sheets.MOVI_SAID).filter((k) => wb.Sheets.MOVI_SAID[k]?.f?.includes("[1]")).length;
  if (extLinks) add("info", "MOVI_SAID", `${extLinks} fórmulas apontavam para outro arquivo (link externo "[1]CADA_PROD"). Ignorado: o sistema usa o cadastro importado.`);

  // ---- validades do inventário (INVE_CENT "Validade Produto" e, se existir, coluna de validade no INVE_GERA)
  const valByCode = new Map<string, { date: string; qty: number | null }[]>();
  const readValidity = (sheet: string, headerRow: number, codeCol: string) => {
    const ws = wb.Sheets[sheet];
    if (!ws?.["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    let col: string | null = null;
    for (let c = range.s.c; c <= range.e.c; c++) { const a = XLSX.utils.encode_col(c); if (/valid|venc/i.test(String(v(sheet, `${a}${headerRow}`) ?? ""))) { col = a; break; } }
    if (!col) return;
    let bad = 0;
    for (let r = headerRow + 1; r <= range.e.r + 1; r++) {
      const code = str(v(sheet, `${codeCol}${r}`))?.toUpperCase();
      if (!code || !codes.has(code)) continue;
      const { list, bad: b } = parseExpiryCell(v(sheet, `${col}${r}`));
      if (b.length) { bad++; add("aviso", sheet, `${code}: validade "${b.join("; ")}" não reconhecida (use dd/mm/aaaa ou mm/aaaa).`, r); }
      if (list.length && !valByCode.has(code)) valByCode.set(code, list);
    }
    return bad;
  };
  readValidity("INVE_CENT", 6, "C");
  readValidity("INVE_GERA", 4, "C");
  const validades = Array.from(valByCode.entries()).map(([code, list]) => ({ code, validades: list }));
  if (validades.length) {
    const expired = validades.filter((x) => x.validades.some((d) => d.date < new Date().toISOString().slice(0, 10))).length;
    add("info", "INVE_CENT", `${validades.length} produtos com validade no inventário — aplicadas ao saldo importado (vira o lote "Saldo importado" com validade).${expired ? ` ${expired} já estão vencidos e ficarão bloqueados para saída.` : ""}`);
  } else add("aviso", "INVE_CENT", "Nenhuma validade preenchida na coluna \"Validade Produto\" do inventário. O saldo importado fica sem validade até a conferência.");

  // ---- saldo e totais
  const bal = new Map<string, number>();
  entries.forEach((e) => bal.set(e.product_code, (bal.get(e.product_code) ?? 0) + e.qty));
  exits.forEach((e) => bal.set(e.product_code, (bal.get(e.product_code) ?? 0) - e.qty));
  const negative = products.filter((p) => (bal.get(p.code) ?? 0) < 0).map((p) => ({ code: p.code, name: p.name, balance: bal.get(p.code)! }));
  negative.forEach((n) => {
    const p = products.find((x) => x.code === n.code)!;
    p.needs_review = true;
    p.review_notes = [p.review_notes, `Saldo negativo na planilha (${n.balance}) — fazer contagem e ajuste`].filter(Boolean).join("; ");
    add("aviso", "INVE_GERA", `${n.code} ${n.name}: saídas maiores que entradas (saldo ${n.balance}). Importado como está; ajuste após contagem física.`);
  });
  const noMov = products.filter((p) => !bal.has(p.code)).length;
  if (noMov) add("info", "CADA_PROD", `${noMov} produtos cadastrados sem nenhuma movimentação (entram com saldo zero).`);
  const planilha = { variedade: num(v("RELA_GERA", "D4")), quantidade: num(v("RELA_GERA", "D5")), valor: num(v("RELA_GERA", "D6")) };

  const units = Array.from(unitSet).map((code) => ({ code, name: UNIT_NAMES[code] ?? code }));
  const processes = Array.from(procSet).map((name) => ({ name, requires_lot: LOT_PROCESSES.has(name) }));
  const payload: ImportPayload = {
    file_name: fileName, units, processes, centers, locations, suppliers, professionals, destinations: Array.from(destSet),
    products, entries, exits, validades, issues,
    summary: summarize(products, entries, exits, issues, suppliers.length, locations.length, centers.length, professionals.length, exitsValuePlan, planilha, negative),
  };
  payload.summary.validades_lidas = validades.length;
  return payload;
}

function summarize(
  products: ProductIn[], entries: EntryIn[], exits: ExitIn[], issues: Issue[], suppliers: number, locations: number, centers: number, professionals: number,
  exitsValuePlan: number, planilha: Summary["planilha"], negative: Summary["negative_balance"],
): Summary {
  const eq = entries.reduce((a, e) => a + e.qty, 0);
  const sq = exits.reduce((a, e) => a + e.qty, 0);
  const ev = entries.reduce((a, e) => a + e.qty * e.unit_cost, 0);
  const sv = exits.reduce((a, e) => a + e.qty * e.unit_cost, 0);
  return {
    products: products.length, suppliers, locations, centers, professionals,
    entries: entries.length, exits: exits.length, entries_qty: eq, exits_qty: sq, balance_qty: eq - sq,
    entries_value: round2(ev), exits_value: round2(sv), exits_value_planilha: round2(exitsValuePlan),
    stock_value: round2(ev - sv), stock_value_planilha: round2(ev - exitsValuePlan), planilha,
    products_review: products.filter((p) => p.needs_review).length, negative_balance: negative,
    errors: issues.filter((i) => i.level === "erro").length, warnings: issues.filter((i) => i.level === "aviso").length,
    corrections: issues.filter((i) => i.level === "correcao").length,
    validades_lidas: 0,
  };
}
