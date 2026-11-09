const cache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const k = `${min}-${max}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat('es-CO', { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(k, f);
  }
  return f;
}

/** Número con separador de miles "." y decimal "," (es-CO). */
export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf(decimals, decimals).format(v);
}

export function fmtHa(v: number | null | undefined, decimals = 2): string {
  return v == null ? '—' : `${fmtNum(v, decimals)} ha`;
}

export function fmtPct(v: number | null | undefined, decimals = 2): string {
  return v == null ? '—' : `${fmtNum(v, decimals)} %`;
}

/** Formato compacto para ejes (12,3 mil). */
export function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1e6) return `${fmtNum(v / 1e6, 1)} M`;
  if (Math.abs(v) >= 1e3) return `${fmtNum(v / 1e3, 1)} mil`;
  return fmtNum(v, v < 10 ? 1 : 0);
}

/** Etiqueta corta para límites de clase. */
export function fmtBreak(v: number, variable: 'area' | 'pct'): string {
  if (variable === 'pct') return fmtNum(v, v < 1 ? 2 : 1);
  return fmtNum(v, v < 10 ? 1 : 0);
}
