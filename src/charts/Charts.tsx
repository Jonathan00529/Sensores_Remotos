import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { ClassBreaks, DeptAggregate, MunicipioRecord, Selection } from '../types';
import { colorFor, histogram, type BinMode } from '../utils/stats';
import { fmtCompact, fmtHa, fmtNum, fmtPct } from '../utils/format';

const C_AREA = '#d9480f';
const C_PCT = '#a4161a';
const C_SEL = '#0b6e99';
const AXIS = { fontSize: 11, fill: '#5b6472' };
const GRID = '#e8ebf0';

interface Props {
  records: MunicipioRecord[];
  byDept: DeptAggregate[];
  pctBreaks: ClassBreaks;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

function Card({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`chart-card${wide ? ' wide' : ''}`}>
      <div className="chart-head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="chart-empty">Sin registros para los filtros activos.</div>;
}

function Tip({ active, payload, rows }: TooltipProps<number, string> & { rows: (d: any) => [string, string][] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const r = rows(d);
  return (
    <div className="chart-tip">
      <div className="tt-title">{d.title ?? d.name}</div>
      {d.sub && <div className="tt-sub">{d.sub}</div>}
      {r.map(([k, v]) => (
        <div key={k} className="tt-row">
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

const shortDept = (s: string) => s.replace('La Guajira', 'Guajira');

export default function Charts({ records, byDept, pctBreaks, selection, onSelect }: Props) {
  const [binMode, setBinMode] = useState<BinMode>('fixed');
  const [equalBins, setEqualBins] = useState(8);

  const deptArea = useMemo(
    () => byDept.map((d) => ({ name: d.name, code: d.deCodigo, value: d.areaInundada, share: d.sharePct, n: d.count, title: d.name })),
    [byDept],
  );
  const deptPct = useMemo(
    () =>
      [...byDept]
        .sort((a, b) => b.pctPonderado - a.pctPonderado)
        .map((d) => ({ name: d.name, code: d.deCodigo, value: d.pctPonderado, inund: d.areaInundada, mun: d.areaMunicipio, title: d.name })),
    [byDept],
  );
  const topArea = useMemo(
    () =>
      [...records]
        .sort((a, b) => b.areaInundadaHa - a.areaInundadaHa)
        .slice(0, 10)
        .map((r) => ({ name: r.municipio, code: r.mpCodigo, dept: r.departamento, value: r.areaInundadaHa, pct: r.pctInundada, title: r.municipio, sub: r.departamento })),
    [records],
  );
  const topPct = useMemo(
    () =>
      [...records]
        .sort((a, b) => b.pctInundada - a.pctInundada)
        .slice(0, 10)
        .map((r) => ({ name: r.municipio, code: r.mpCodigo, dept: r.departamento, value: r.pctInundada, area: r.areaInundadaHa, title: r.municipio, sub: r.departamento })),
    [records],
  );
  const bins = useMemo(() => histogram(records, binMode, { equalBins, quantile: pctBreaks }), [records, binMode, equalBins, pctBreaks]);

  const selDept = selection?.kind === 'departamento' ? selection.code : null;
  const selMun = selection?.kind === 'municipio' ? selection.code : null;
  const hBarHeight = (n: number) => Math.max(140, n * 30 + 40);

  return (
    <section className="charts" aria-label="Análisis estadístico">
      <div className="section-title">
        <BarChart3 size={16} /> Análisis estadístico <small>· los gráficos responden a los filtros activos; clic en una barra para localizarla en el mapa</small>
      </div>
      <div className="chart-grid">
        <Card title="Área inundada por departamento" subtitle="Hectáreas acumuladas y participación sobre el total inundado">
          {deptArea.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={hBarHeight(deptArea.length)}>
              <BarChart data={deptArea} layout="vertical" margin={{ top: 4, right: 92, left: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={92} tickFormatter={shortDept} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,.05)' }} content={<Tip rows={(d) => [['Área inundada', fmtHa(d.value)], ['Participación', fmtPct(d.share, 1)], ['Municipios', String(d.n)]]} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(d: any) => onSelect({ kind: 'departamento', code: d.code })} className="clickable">
                  {deptArea.map((d) => (
                    <Cell key={d.code} fill={d.code === selDept ? C_SEL : C_AREA} />
                  ))}
                  <LabelList dataKey="share" position="right" formatter={(v: number) => `${fmtNum(v, 1)}\u00a0%`} style={{ fontSize: 11, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Afectación territorial ponderada por departamento" subtitle="Σ área inundada / Σ área municipal × 100 (no es el promedio de porcentajes)">
          {deptPct.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={hBarHeight(deptPct.length)}>
              <BarChart data={deptPct} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickFormatter={(v) => `${fmtNum(v, 1)} %`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={92} tickFormatter={shortDept} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,.05)' }} content={<Tip rows={(d) => [['% ponderado', fmtPct(d.value, 3)], ['Área inundada', fmtHa(d.inund)], ['Área municipal', fmtHa(d.mun)]]} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(d: any) => onSelect({ kind: 'departamento', code: d.code })} className="clickable">
                  {deptPct.map((d) => (
                    <Cell key={d.code} fill={d.code === selDept ? C_SEL : C_PCT} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => `${fmtNum(v, 2)}\u00a0%`} style={{ fontSize: 11, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top 10 municipios por área inundada" subtitle="Superficie inundada absoluta (ha)">
          {topArea.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={hBarHeight(topArea.length)}>
              <BarChart data={topArea} layout="vertical" margin={{ top: 4, right: 70, left: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="code" tick={<MunTick data={topArea} />} width={150} axisLine={false} tickLine={false} interval={0} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,.05)' }} content={<Tip rows={(d) => [['Área inundada', fmtHa(d.value)], ['% de afectación', fmtPct(d.pct, 2)]]} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(d: any) => onSelect({ kind: 'municipio', code: d.code })} className="clickable">
                  {topArea.map((d) => (
                    <Cell key={d.code} fill={d.code === selMun ? C_SEL : C_AREA} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => fmtNum(v, 0)} style={{ fontSize: 11, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top 10 municipios por % de afectación" subtitle="Proporción del territorio municipal inundado — independiente del tamaño del municipio">
          {topPct.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={hBarHeight(topPct.length)}>
              <BarChart data={topPct} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickFormatter={(v) => `${fmtNum(v, 0)} %`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="code" tick={<MunTick data={topPct} />} width={150} axisLine={false} tickLine={false} interval={0} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,.05)' }} content={<Tip rows={(d) => [['% de afectación', fmtPct(d.value, 3)], ['Área inundada', fmtHa(d.area)]]} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(d: any) => onSelect({ kind: 'municipio', code: d.code })} className="clickable">
                  {topPct.map((d) => (
                    <Cell key={d.code} fill={d.code === selMun ? C_SEL : C_PCT} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => `${fmtNum(v, 2)}\u00a0%`} style={{ fontSize: 11, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card wide title="Distribución de municipios por % de afectación" subtitle="Clases de visualización estadística; no constituyen categorías oficiales de amenaza o riesgo hidrológico">
          <div className="chart-controls">
            <div className="seg seg-sm" role="radiogroup" aria-label="Tipo de intervalos">
              {(
                [
                  ['fixed', 'Intervalos fijos'],
                  ['quantile', 'Cuantiles (clases del mapa)'],
                  ['equal', 'Amplitud igual'],
                ] as [BinMode, string][]
              ).map(([m, l]) => (
                <button key={m} className={binMode === m ? 'on' : ''} role="radio" aria-checked={binMode === m} onClick={() => setBinMode(m)}>
                  {l}
                </button>
              ))}
            </div>
            {binMode === 'equal' && (
              <label className="inline-field">
                N.º de intervalos
                <select value={equalBins} onChange={(e) => setEqualBins(+e.target.value)}>
                  {[4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {records.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins} margin={{ top: 18, right: 12, left: 0, bottom: 4 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: '#cbd2dc' }} tickLine={false} interval={0} label={{ value: '% del territorio municipal inundado', position: 'insideBottom', dy: 10, fontSize: 11, fill: '#5b6472' }} height={38} />
                <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,.05)' }}
                  content={<Tip rows={(d) => [['Municipios', String(d.count)], ['Área inundada', fmtHa(d.areaInundada)]]} />}
                  labelFormatter={(l) => `${l} %`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {bins.map((b) => (
                    <Cell key={b.label} fill={colorFor((b.from + (b.to >= 100 ? b.from * 1.2 : b.to)) / 2, pctBreaks)} stroke="#b45309" strokeOpacity={0.35} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="chart-note">
            Barras coloreadas con la misma escala del mapa (% de afectación). Intervalos fijos: 0–0,1 · 0,1–0,5 · 0,5–1 · 1–2 · 2–5 · 5–10 · 10–20 · ≥ 20 %.
          </p>
        </Card>
      </div>
    </section>
  );
}

/** Etiqueta de eje con municipio + departamento en dos líneas. */
function MunTick({ x, y, payload, data }: any) {
  const d = data.find((r: any) => r.code === payload.value);
  if (!d) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-6} y={-2} textAnchor="end" fontSize={11} fill="#1f2937" fontWeight={500}>
        {d.name.length > 22 ? d.name.slice(0, 21) + '…' : d.name}
      </text>
      <text x={-6} y={10} textAnchor="end" fontSize={10} fill="#6b7280">
        {d.dept}
      </text>
    </g>
  );
}
