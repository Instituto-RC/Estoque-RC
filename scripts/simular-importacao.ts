// Uso: npx tsx scripts/simular-importacao.ts "<caminho da planilha.xlsx>"
import fs from "fs";
import { parsePlanilha } from "../src/lib/import/planilha";
const file = process.argv[2];
const buf = fs.readFileSync(file);
const p = parsePlanilha(new Uint8Array(buf), file.split(/[\/]/).pop()!);
console.log(JSON.stringify(p.summary, null, 2));
const by: Record<string, number> = {};
p.issues.forEach((i) => (by[i.level] = (by[i.level] || 0) + 1));
console.log("ocorrências por nível:", by);
for (const lvl of ["erro", "aviso", "correcao", "info"]) {
  console.log(`\n== ${lvl.toUpperCase()}`);
  p.issues.filter((i) => i.level === lvl).forEach((i) => console.log(`[${i.sheet}${i.row ? ":" + i.row : ""}] ${i.message}`));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(p));
console.log("\nunidades", p.units, "\nprocessos", p.processes, "\ncentros", p.centers, "\ndestinos", p.destinations, "\nprofissionais", p.professionals.map((x) => x.name));
console.log("revisar:", p.products.filter((x) => x.needs_review).map((x) => `${x.code} ${x.name} → ${x.review_notes}`).join("\n"));
