import { forwardRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ShieldCheck, XCircle } from 'lucide-react';
import type { DashboardData } from '../types';
import { fmtNum } from '../utils/format';

const ICON = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle };

/** Sección de control de calidad de la integración de datos. */
const QualityPanel = forwardRef<HTMLElement, { data: DashboardData }>(function QualityPanel({ data }, ref) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <section className="qa" ref={ref} id="calidad" aria-label="Control de calidad">
      <div className="section-title">
        <ShieldCheck size={16} /> Control de calidad de la integración <small>· ejecutado automáticamente al cargar los archivos</small>
      </div>
      <div className="qa-grid">
        <div className="qa-card">
          <h4>Controles de referencia</h4>
          <table className="qa-table">
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="num">Esperado</th>
                <th className="num">Calculado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.controls.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td className="num">
                    {fmtNum(c.expected, c.decimals)} {c.unit}
                  </td>
                  <td className="num">
                    {fmtNum(c.computed, c.decimals)} {c.unit}
                  </td>
                  <td>{c.ok ? <CheckCircle2 size={15} className="ok" /> : <XCircle size={15} className="error" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="qa-note">
            Los valores calculados provienen del Excel en tiempo de carga; los esperados sólo se usan para comparar (tolerancia de redondeo). El promedio aritmético de
            porcentajes se muestra únicamente como control: el indicador oficial del tablero es el porcentaje ponderado.
          </p>
        </div>
        <div className="qa-card">
          <h4>Validaciones de la unión Excel ↔ GeoJSON</h4>
          <ul className="qa-list">
            {data.checks.map((c) => {
              const I = ICON[c.status];
              const has = !!c.items?.length;
              return (
                <li key={c.id} className={c.status}>
                  <button disabled={!has} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                    <I size={15} className={c.status} />
                    <span>
                      <b>{c.label}</b>
                      <small>{c.detail}</small>
                    </span>
                    {has && (open[c.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </button>
                  {has && open[c.id] && (
                    <ul className="qa-items">
                      {c.items!.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="qa-note">
            Normalización: sin tildes, minúsculas, sin puntuación y espacios colapsados; clave compuesta municipio + departamento; equivalencia explícita de San Andrés
            (“San Andrés y Providencia” ↔ “San Andrés Providencia y Santa Catalina”). No se aplican coincidencias aproximadas automáticas.
          </p>
        </div>
      </div>
    </section>
  );
});

export default QualityPanel;
