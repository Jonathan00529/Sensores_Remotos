import type { Aggregate, ClassBreaks, DeptAggregate, MunicipioRecord } from '../types';

export function aggregate(records: MunicipioRecord[]): Aggregate {
  let areaMunicipio = 0;
  let areaInundada = 0;
  let pctSum = 0;
  const depts = new Set<string>();
  for (const r of records) {
    areaMunicipio += r.areaMunicipioHa;
    areaInundada += r.areaInundadaHa;
    pctSum += r.pctInundada;
    depts.add(r.deCodigo ?? r.departamento);
  }
  return {
    count: records.length,
    departments: depts.size,
    areaMunicipio,
    areaInundada,
    pctPonderado: areaMunicipio > 0 ? (areaInundada / areaMunicipio) * 100 : 0,
    pctPromedio: records.length ? pctSum / records.length : 0,
  };
}

/** Agregados por departamento (porcentaje ponderado, nunca promedio de porcentajes). */
export function aggregateByDept(
  records: MunicipioRecord[],
  nameOf: (deCodigo: string) => string,
): DeptAggregate[] {
  const groups = new Map<string, MunicipioRecord[]>();
  for (const r of records) {
    const k = r.deCodigo ?? r.departamento;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const total = records.reduce((s, r) => s + r.areaInundadaHa, 0);
  const out: DeptAggregate[] = [];
  for (const [code, g] of groups) {
    const a = aggregate(g);
    let maxArea: MunicipioRecord | null = null;
    let maxPct: MunicipioRecord | null = null;
    for (const r of g) {
      if (!maxArea || r.areaInundadaHa > maxArea.areaInundadaHa) maxArea = r;
      if (!maxPct || r.pctInundada > maxPct.pctInundada) maxPct = r;
    }
    out.push({
      ...a,
      deCodigo: code,
      name: nameOf(code),
      maxArea,
      maxPct,
      sharePct: total > 0 ? (a.areaInundada / total) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.areaInundada - a.areaInundada);
}

/** Posición (1 = mayor) de un registro dentro de su departamento según un valor. */
export function rankWithinDept(
  record: MunicipioRecord,
  all: MunicipioRecord[],
  value: (r: MunicipioRecord) => number,
): { rank: number; total: number } {
  const peers = all.filter((r) => r.deCodigo === record.deCodigo);
  const sorted = [...peers].sort((a, b) => value(b) - value(a));
  return { rank: sorted.indexOf(record) + 1, total: peers.length };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Redondeo a 2 cifras significativas para límites de clase legibles. */
export function niceRound(v: number): number {
  if (v === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / mag) * mag;
}

/** Paleta secuencial amarillo claro → rojo oscuro (ColorBrewer YlOrRd, 5 clases). */
export const SEQ_COLORS = ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'];
export const NO_DATA_COLOR = '#c9ced6';
export const ZERO_COLOR = '#f4f1e1';

/**
 * Clasificación por cuantiles (5 clases) con límites redondeados.
 * Son clases de visualización estadística, NO categorías oficiales de amenaza o riesgo.
 */
export function quantileBreaks(values: number[], colors = SEQ_COLORS): ClassBreaks {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  const n = colors.length;
  if (v.length === 0) return { breaks: [], colors: [colors[n - 1]], min: 0, max: 0, method: 'Sin datos' };
  const raw: number[] = [];
  for (let i = 1; i < n; i++) raw.push(niceRound(quantile(v, i / n)));
  const breaks = [...new Set(raw)].filter((b) => b > v[0] && b < v[v.length - 1]);
  return {
    breaks,
    colors: colors.slice(colors.length - breaks.length - 1),
    min: v[0],
    max: v[v.length - 1],
    method: `Cuantiles (${breaks.length + 1} clases)`,
  };
}

export function classIndex(value: number, cb: ClassBreaks): number {
  let i = 0;
  while (i < cb.breaks.length && value >= cb.breaks[i]) i++;
  return i;
}

export function colorFor(value: number | null | undefined, cb: ClassBreaks): string {
  if (value == null || !Number.isFinite(value)) return NO_DATA_COLOR;
  if (value === 0) return ZERO_COLOR;
  return cb.colors[classIndex(value, cb)];
}

export interface HistogramBin {
  label: string;
  from: number;
  to: number;
  count: number;
  areaInundada: number;
}

export type BinMode = 'fixed' | 'quantile' | 'equal';

export const FIXED_PCT_EDGES = [0, 0.1, 0.5, 1, 2, 5, 10, 20, 100];

/** Distribución de municipios por intervalos de % de afectación. */
export function histogram(
  records: MunicipioRecord[],
  mode: BinMode,
  opts: { equalBins?: number; quantile?: ClassBreaks; domainMax?: number } = {},
): HistogramBin[] {
  let edges: number[];
  const vals = records.map((r) => r.pctInundada);
  const maxVal = opts.domainMax ?? Math.max(0, ...vals);
  if (mode === 'fixed') {
    edges = FIXED_PCT_EDGES.filter((_e, i, a) => i === 0 || a[i - 1] < maxVal);
    if (edges.length < 2) edges = [0, Math.max(1, maxVal)];
  } else if (mode === 'quantile' && opts.quantile) {
    edges = [0, ...opts.quantile.breaks, Math.max(maxVal, ...opts.quantile.breaks)];
  } else {
    const n = Math.max(2, opts.equalBins ?? 8);
    const top = Math.ceil(maxVal) || 1;
    edges = Array.from({ length: n + 1 }, (_, i) => (top * i) / n);
  }
  const bins: HistogramBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const last = i === edges.length - 2;
    const inBin = records.filter((r) => r.pctInundada >= from && (last ? r.pctInundada <= to : r.pctInundada < to));
    const f = (x: number) => (x < 1 ? x.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : x.toLocaleString('es-CO', { maximumFractionDigits: 1 }));
    bins.push({
      label: last && mode === 'fixed' && to === 100 ? `≥ ${f(from)}` : `${f(from)}–${f(to)}`,
      from,
      to,
      count: inBin.length,
      areaInundada: inBin.reduce((s, r) => s + r.areaInundadaHa, 0),
    });
  }
  return bins;
}
