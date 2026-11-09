import { useState } from 'react';
import { Home, Layers, Map as MapIcon, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClassBreaks, MapVariable } from '../types';
import { BASEMAPS, type BasemapId } from './basemaps';
import { fmtBreak } from '../utils/format';
import { NO_DATA_COLOR, ZERO_COLOR } from '../utils/stats';

export function VariableToggle({ value, onChange }: { value: MapVariable; onChange: (v: MapVariable) => void }) {
  return (
    <div className="map-card seg" role="radiogroup" aria-label="Variable cartográfica">
      <button role="radio" aria-checked={value === 'area'} className={value === 'area' ? 'on' : ''} onClick={() => onChange('area')}>
        Área inundada (ha)
      </button>
      <button role="radio" aria-checked={value === 'pct'} className={value === 'pct' ? 'on' : ''} onClick={() => onChange('pct')}>
        % de área inundada
      </button>
    </div>
  );
}

interface LayerPanelProps {
  basemap: BasemapId;
  onBasemap: (b: BasemapId) => void;
  showMunicipios: boolean;
  showDepartamentos: boolean;
  onToggleMunicipios: () => void;
  onToggleDepartamentos: () => void;
}

export function LayerPanel(p: LayerPanelProps) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 720);
  return (
    <div className="map-card layer-panel">
      <button className="layer-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Layers size={15} /> Capas y mapa base {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="layer-body">
          <div className="layer-group">
            <div className="layer-label">Mapa base</div>
            {BASEMAPS.map((b) => (
              <label key={b.id} className="radio">
                <input type="radio" name="basemap" checked={p.basemap === b.id} onChange={() => p.onBasemap(b.id)} />
                {b.label}
              </label>
            ))}
          </div>
          <div className="layer-group">
            <div className="layer-label">Capas vectoriales</div>
            <label className="radio">
              <input type="checkbox" checked={p.showMunicipios} onChange={p.onToggleMunicipios} /> Municipios
            </label>
            <label className="radio">
              <input type="checkbox" checked={p.showDepartamentos} onChange={p.onToggleDepartamentos} /> Departamentos
            </label>
            {!p.showMunicipios && p.showDepartamentos && <p className="hint">Coroplético departamental: clic para consultar.</p>}
            {p.showMunicipios && p.showDepartamentos && <p className="hint">Desactive municipios para seleccionar departamentos con clic.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface LegendProps {
  variable: MapVariable;
  breaks: ClassBreaks;
  scale: 'municipal' | 'departamental';
}

export function Legend({ variable, breaks, scale }: LegendProps) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 720);
  const unit = variable === 'area' ? 'ha' : '%';
  const title = variable === 'area' ? 'Área inundada (ha)' : '% de área inundada';
  const items = breaks.colors.map((c, i) => {
    const lo = i === 0 ? breaks.min : breaks.breaks[i - 1];
    const hi = i === breaks.colors.length - 1 ? breaks.max : breaks.breaks[i];
    const label =
      i === 0 ? `< ${fmtBreak(hi, variable)}` : i === breaks.colors.length - 1 ? `≥ ${fmtBreak(lo, variable)}` : `${fmtBreak(lo, variable)} – ${fmtBreak(hi, variable)}`;
    return { c, label };
  });
  return (
    <div className="map-card legend">
      <button className="legend-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <MapIcon size={14} />
        <span>
          {title}
          <small> · escala {scale}</small>
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {open && (
        <>
          <ul>
            {[...items].reverse().map((it) => (
              <li key={it.label}>
                <i style={{ background: it.c }} /> {it.label} {unit}
              </li>
            ))}
            <li className="sep">
              <i style={{ background: ZERO_COLOR }} /> 0 {unit} (con registro)
            </li>
            <li>
              <i style={{ background: NO_DATA_COLOR }} /> Sin información
            </li>
            <li>
              <i className="sw-filtered" /> Excluido por filtros
            </li>
            <li>
              <i className="sw-litigio" /> Área en litigio (excluida)
            </li>
          </ul>
          <p className="legend-note">{breaks.method}. Clases de visualización estadística; no son categorías oficiales de amenaza ni riesgo.</p>
        </>
      )}
    </div>
  );
}

export function HomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="map-card icon-btn home-btn" onClick={onClick} title="Vista nacional" aria-label="Volver a la vista nacional">
      <Home size={16} />
    </button>
  );
}
