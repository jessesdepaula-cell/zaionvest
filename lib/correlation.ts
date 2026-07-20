/**
 * Correlação entre estratégias a partir da curva de capital OOS.
 * Usada pra: (a) slider de "correlação máxima" na vitrine — esconde EAs muito
 * parecidos; (b) montar portfólios descorrelacionados.
 *
 * O que importa é a correlação dos RETORNOS, não dos preços absolutos.
 */

export type EquityPoint = { date: string; value: number };

export interface CorrelatableEA {
  id: string;
  wfe: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
  equityCurveOos: EquityPoint[] | null;
}

/** Retornos período-a-período a partir da curva de capital. */
function returns(curve: EquityPoint[] | null): number[] {
  if (!curve || curve.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    if (prev !== 0) out.push((curve[i].value - prev) / prev);
  }
  return out;
}

/** Pearson entre duas séries (alinhadas pelo menor comprimento). */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0; // amostra insuficiente → trata como não-correlacionado
  const xa = a.slice(a.length - n);
  const xb = b.slice(b.length - n);
  const ma = xa.reduce((s, v) => s + v, 0) / n;
  const mb = xb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const va = xa[i] - ma, vb = xb[i] - mb;
    num += va * vb;
    da += va * va;
    db += vb * vb;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/** Correlação entre dois EAs a partir das curvas OOS. */
export function correlationBetween(a: CorrelatableEA, b: CorrelatableEA): number {
  return pearson(returns(a.equityCurveOos), returns(b.equityCurveOos));
}

/**
 * Seleção gulosa diversificada: percorre os EAs (assumindo-os já ordenados por
 * qualidade) e adiciona cada um só se a correlação com TODOS os já escolhidos
 * ficar abaixo de maxCorr. É o que o slider da vitrine aplica.
 */
export function greedyDiversified<T extends CorrelatableEA>(
  eas: T[],
  maxCorr: number
): T[] {
  const picked: T[] = [];
  for (const ea of eas) {
    const tooSimilar = picked.some(
      (p) => Math.abs(correlationBetween(ea, p)) > maxCorr
    );
    if (!tooSimilar) picked.push(ea);
  }
  return picked;
}

// ─── Portfólios prontos (Conservador / Moderado / Agressivo) ─────────────────
// Cada perfil parte de um critério de qualidade diferente, seleciona um cesto
// descorrelacionado (corr < 0.5) e limita o tamanho.

export interface Portfolio<T> {
  profile: "conservador" | "moderado" | "agressivo";
  label: string;
  ddTolerated: number; // % de DD tolerado
  eas: T[];
}

const _num = (v: number | null, fallback: number) => (v == null ? fallback : v);

export function buildPortfolios<T extends CorrelatableEA>(
  eas: T[],
  size = 4
): Portfolio<T>[] {
  const byLowDD = [...eas].sort((a, b) => _num(a.maxDrawdown, 1e9) - _num(b.maxDrawdown, 1e9));
  const byWfe = [...eas].sort((a, b) => _num(b.wfe, -1e9) - _num(a.wfe, -1e9));
  const byPf = [...eas].sort((a, b) => _num(b.profitFactor, -1e9) - _num(a.profitFactor, -1e9));

  return [
    {
      profile: "conservador",
      label: "Conservador",
      ddTolerated: 20,
      eas: greedyDiversified(byLowDD, 0.5).slice(0, size),
    },
    {
      profile: "moderado",
      label: "Moderado",
      ddTolerated: 40,
      eas: greedyDiversified(byWfe, 0.5).slice(0, size),
    },
    {
      profile: "agressivo",
      label: "Agressivo",
      ddTolerated: 60,
      eas: greedyDiversified(byPf, 0.5).slice(0, size),
    },
  ];
}
