// Marca Instituto RC — vetores extraídos do Brandbook v1.0.
// Regras aplicadas (Brandbook):
//  - Fundo Azul Profundo: brasão em Ouro Fosco, logotipo em Branco Neve.
//  - Fundos claros (Branco Neve, Marfim, Ouro Fosco): brasão e logotipo em Azul Profundo.
//  - Tamanhos mínimos digitais: brasão 25px, logotipo 85px, assinatura horizontal 145px, vertical 240px.
import { MARKS, PATTERNS } from "./marks-data";

type Tone = "onDark" | "onLight";
const COLORS = {
  onDark: { brasao: "#D4C9BE", text: "#F2F2F2" },
  onLight: { brasao: "#23272F", text: "#23272F" },
};

type Mark = { vb: string; tr: string; paths: readonly { d: string; eo: boolean }[] };

function Svg({
  mark,
  className,
  title,
  colorFor,
  height,
}: {
  mark: Mark;
  className?: string;
  title: string;
  colorFor: (i: number, total: number) => string;
  height?: number;
}) {
  return (
    <svg viewBox={mark.vb} className={className} height={height} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <g transform={`translate(${mark.tr})`}>
        {mark.paths.map((p, i) => (
          <path key={i} d={p.d} fillRule={p.eo ? "evenodd" : undefined} fill={colorFor(i, mark.paths.length)} />
        ))}
      </g>
    </svg>
  );
}

/** Brasão (símbolo). Mínimo 25px. */
export function Brasao({ tone = "onDark", className, height }: { tone?: Tone; className?: string; height?: number }) {
  return <Svg mark={MARKS.brasao} className={className} height={height} title="Brasão Instituto RC" colorFor={() => COLORS[tone].brasao} />;
}

/** Logotipo (somente texto). Mínimo 85px de largura. */
export function Logotipo({ tone = "onDark", className, height }: { tone?: Tone; className?: string; height?: number }) {
  return <Svg mark={MARKS.logotipo} className={className} height={height} title="Instituto RC" colorFor={() => COLORS[tone].text} />;
}

/** Assinatura visual (brasão + logotipo). Horizontal mín. 145px; vertical mín. 240px. */
export function Assinatura({
  tone = "onDark",
  orientation = "horizontal",
  className,
  height,
}: {
  tone?: Tone;
  orientation?: "horizontal" | "vertical";
  className?: string;
  height?: number;
}) {
  const mark = orientation === "horizontal" ? MARKS.horizontal : MARKS.vertical;
  // os 2 últimos paths são o brasão (escudo + sorriso)
  return (
    <Svg
      mark={mark}
      className={className}
      height={height}
      title="Instituto RC"
      colorFor={(i, total) => (i >= total - 2 ? COLORS[tone].brasao : COLORS[tone].text)}
    />
  );
}

export type PatternName = keyof typeof PATTERNS;

/** Patterns geométricos oficiais: Raiz Modular, Fluxo em Transição, Território Bruto, Centro Vivo. */
export function Pattern({
  name,
  color = "#2E333D",
  background = "transparent",
  className,
}: {
  name: PatternName;
  color?: string;
  background?: string;
  className?: string;
}) {
  const p = PATTERNS[name];
  const id = `clip-${name}`;
  return (
    <svg viewBox={p.vb} className={className} aria-hidden xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id={id}>
          <rect width="100%" height="100%" />
        </clipPath>
      </defs>
      <rect width="100%" height="100%" fill={background} />
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(${p.tr})`}>
          {p.paths.map((s, i) => (
            <path key={i} d={s.d} fill={s.bg ? background : color} />
          ))}
        </g>
      </g>
    </svg>
  );
}
