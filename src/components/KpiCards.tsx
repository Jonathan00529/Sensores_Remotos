import { Building2, Landmark, Percent, Ruler, Waves } from 'lucide-react';
import type { Aggregate } from '../types';
import { fmtNum } from '../utils/format';

interface Props {
  kpis: Aggregate;
  total: Aggregate;
  filtered: boolean;
}

export default function KpiCards({ kpis, total, filtered }: Props) {
  const cards = [
    { icon: Building2, label: 'Municipios analizados', value: fmtNum(kpis.count, 0), sub: filtered ? `de ${fmtNum(total.count, 0)}` : 'registros del Excel' },
    { icon: Landmark, label: 'Departamentos afectados', value: fmtNum(kpis.departments, 0), sub: filtered ? `de ${fmtNum(total.departments, 0)}` : 'con registros' },
    { icon: Waves, label: 'Área inundada acumulada', value: fmtNum(kpis.areaInundada, 2), unit: 'ha', sub: filtered ? `${fmtNum(total.areaInundada ? (kpis.areaInundada / total.areaInundada) * 100 : 0, 1)} % del total` : 'Σ área inundada', accent: true },
    { icon: Ruler, label: 'Área municipal acumulada', value: fmtNum(kpis.areaMunicipio, 2), unit: 'ha', sub: 'Σ área de los municipios' },
    { icon: Percent, label: 'Afectación territorial ponderada', value: fmtNum(kpis.pctPonderado, 4), unit: '%', sub: 'Σ inundada / Σ municipal × 100', accent: true },
  ];
  return (
    <section className="kpis" aria-label="Indicadores principales">
      {cards.map((c) => (
        <div key={c.label} className={`kpi${c.accent ? ' accent' : ''}`}>
          <div className="kpi-label">
            <c.icon size={14} /> {c.label}
          </div>
          <div className="kpi-value">
            {c.value}
            {c.unit && <small> {c.unit}</small>}
          </div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}
    </section>
  );
}
