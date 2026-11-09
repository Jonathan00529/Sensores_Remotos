import { useEffect, useState } from 'react';

interface Props {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  /** Exponente para el control deslizante (>1 da más resolución a valores bajos). */
  exponent?: number;
  decimals?: number;
}

const STEPS = 1000;

/** Control de rango mínimo–máximo: dos deslizadores + entradas numéricas exactas. */
export default function RangeFilter({ label, unit, min, max, value, onChange, exponent = 1, decimals = 2 }: Props) {
  const toPos = (v: number) => Math.round(Math.pow((v - min) / (max - min || 1), 1 / exponent) * STEPS);
  const toVal = (p: number) => {
    const v = min + Math.pow(p / STEPS, exponent) * (max - min);
    const k = Math.pow(10, decimals);
    return Math.round(v * k) / k;
  };
  const [draft, setDraft] = useState<[string, string]>([String(value[0]), String(value[1])]);
  useEffect(() => setDraft([String(value[0]), String(value[1])]), [value]);

  const commit = (i: 0 | 1, raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return setDraft([String(value[0]), String(value[1])]);
    const next: [number, number] = [...value];
    next[i] = Math.min(max, Math.max(min, n));
    if (next[0] > next[1]) next[i === 0 ? 1 : 0] = next[i];
    onChange(next);
  };

  const p0 = toPos(value[0]);
  const p1 = toPos(value[1]);
  return (
    <div className="range">
      <div className="range-label">
        {label} <small>({unit})</small>
      </div>
      <div className="range-track">
        <div className="range-fill" style={{ left: `${(p0 / STEPS) * 100}%`, right: `${100 - (p1 / STEPS) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={p0}
          aria-label={`${label} mínimo`}
          onChange={(e) => onChange([Math.min(toVal(+e.target.value), value[1]), value[1]])}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={p1}
          aria-label={`${label} máximo`}
          onChange={(e) => onChange([value[0], Math.max(toVal(+e.target.value), value[0])])}
        />
      </div>
      <div className="range-inputs">
        <input
          inputMode="decimal"
          value={draft[0]}
          aria-label={`${label} mínimo (valor)`}
          onChange={(e) => setDraft([e.target.value, draft[1]])}
          onBlur={(e) => commit(0, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(0, (e.target as HTMLInputElement).value)}
        />
        <span>a</span>
        <input
          inputMode="decimal"
          value={draft[1]}
          aria-label={`${label} máximo (valor)`}
          onChange={(e) => setDraft([draft[0], e.target.value])}
          onBlur={(e) => commit(1, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(1, (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>
  );
}
