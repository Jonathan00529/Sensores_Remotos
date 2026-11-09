import { useMemo, useRef, useState } from 'react';
import { Filter, RotateCcw, Search, X } from 'lucide-react';
import type { Availability, DashboardData, Filters } from '../types';
import RangeFilter from './RangeFilter';
import { normalizeName } from '../utils/normalize';

interface Props {
  data: DashboardData;
  filters: Filters;
  defaults: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  activeCount: number;
}

export default function FiltersPanel({ data, filters, defaults, onChange, onReset, activeCount }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const depts = useMemo(() => {
    const all = [...data.deptByCode.values()].sort((a, b) => a.geoName.localeCompare(b.geoName, 'es'));
    return { with: all.filter((d) => d.excelName), without: all.filter((d) => !d.excelName) };
  }, [data]);

  const munOptions = useMemo(
    () =>
      data.records
        .filter((r) => r.mpCodigo && (!filters.deCodigo || r.deCodigo === filters.deCodigo))
        .sort((a, b) => a.municipio.localeCompare(b.municipio, 'es')),
    [data, filters.deCodigo],
  );

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number>();
  const matches = useMemo(() => {
    const n = normalizeName(q);
    return munOptions.filter((r) => !n || normalizeName(r.municipio).includes(n)).slice(0, 60);
  }, [q, munOptions]);
  const selectedMun = filters.mpCodigo ? data.recordByCode.get(filters.mpCodigo) : null;

  return (
    <div className="filters">
      <div className="panel-title">
        <Filter size={15} /> Filtros {activeCount > 0 && <span className="badge">{activeCount}</span>}
        <button className="btn-ghost" onClick={onReset} disabled={activeCount === 0} title="Limpiar todos los filtros">
          <RotateCcw size={13} /> Limpiar
        </button>
      </div>

      <label className="field">
        <span>Departamento</span>
        <select
          value={filters.deCodigo ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            const keepMun = selectedMun && selectedMun.deCodigo === v;
            set({ deCodigo: v, mpCodigo: keepMun ? filters.mpCodigo : null });
          }}
        >
          <option value="">Todos los departamentos</option>
          <optgroup label="Con información">
            {depts.with.map((d) => (
              <option key={d.deCodigo} value={d.deCodigo}>
                {d.excelName}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sin registros en el Excel">
            {depts.without.map((d) => (
              <option key={d.deCodigo} value={d.deCodigo}>
                {d.geoName}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="field">
        <span>Municipio {filters.deCodigo ? `(${munOptions.length})` : ''}</span>
        {selectedMun ? (
          <div className="chip">
            {selectedMun.municipio} <small>· {selectedMun.departamento}</small>
            <button onClick={() => set({ mpCodigo: null })} aria-label="Quitar municipio">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="combo">
            <Search size={14} className="combo-icon" />
            <input
              placeholder="Buscar municipio…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => (blurTimer.current = window.setTimeout(() => setOpen(false), 150))}
              aria-label="Buscar municipio"
            />
            {open && (
              <ul className="combo-list" role="listbox">
                {matches.length === 0 && <li className="muted">Sin coincidencias</li>}
                {matches.map((r) => (
                  <li
                    key={r.mpCodigo}
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      window.clearTimeout(blurTimer.current);
                      setOpen(false);
                      setQ('');
                      set({ mpCodigo: r.mpCodigo, deCodigo: filters.deCodigo ?? null });
                    }}
                  >
                    {r.municipio} <small>{r.departamento}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <RangeFilter
        label="% de afectación"
        unit="%"
        min={defaults.pctRange[0]}
        max={defaults.pctRange[1]}
        value={filters.pctRange}
        onChange={(v) => set({ pctRange: v })}
        exponent={2}
        decimals={2}
      />
      <RangeFilter
        label="Área inundada"
        unit="ha"
        min={defaults.areaRange[0]}
        max={defaults.areaRange[1]}
        value={filters.areaRange}
        onChange={(v) => set({ areaRange: v })}
        exponent={3}
        decimals={0}
      />

      <div className="field">
        <span>Disponibilidad de información</span>
        <div className="seg seg-sm" role="radiogroup">
          {(
            [
              ['all', 'Todos'],
              ['with', 'Con información'],
              ['without', 'Sin información'],
            ] as [Availability, string][]
          ).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={filters.availability === v} className={filters.availability === v ? 'on' : ''} onClick={() => set({ availability: v })}>
              {l}
            </button>
          ))}
        </div>
        {filters.availability === 'without' && (
          <p className="hint">Se resaltan los municipios sin registro estadístico. Indicadores, gráficos y tabla quedan vacíos porque no hay datos que agregar.</p>
        )}
      </div>
    </div>
  );
}
