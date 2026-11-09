import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import bbox from '@turf/bbox';
import 'leaflet/dist/leaflet.css';
import type {
  ClassBreaks,
  DashboardData,
  DepFeature,
  DeptAggregate,
  Filters,
  MapVariable,
  MunFeature,
  Selection,
} from '../types';
import { BASEMAPS, type BasemapId } from './basemaps';
import { colorFor, NO_DATA_COLOR } from '../utils/stats';
import { deptCode2 } from '../utils/normalize';
import { fmtHa, fmtPct } from '../utils/format';

export const COLOMBIA_BOUNDS = L.latLngBounds([-4.25, -79.05], [13.45, -66.85]);
const SELECT_COLOR = '#00b4d8';

export interface MapViewProps {
  data: DashboardData;
  variable: MapVariable;
  munBreaks: ClassBreaks;
  deptBreaks: ClassBreaks;
  filters: Filters;
  filteredCodes: Set<string>;
  byDept: DeptAggregate[];
  selection: Selection;
  basemap: BasemapId;
  showMunicipios: boolean;
  showDepartamentos: boolean;
  /** Relleno inferior/derecho para que el panel de información no tape el zoom. */
  fitPadding: { right: number; bottom: number };
  homeSignal: number;
  onSelect: (s: Selection) => void;
}

function featureBounds(f: MunFeature | DepFeature): L.LatLngBounds {
  const [minX, minY, maxX, maxY] = bbox(f);
  return L.latLngBounds([minY, minX], [maxY, maxX]);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Crea panes con orden de dibujo fijo: municipios < departamentos < selección. */
function Panes() {
  const map = useMap();
  useMemo(() => {
    const mk = (name: string, z: number) => {
      if (!map.getPane(name)) map.createPane(name).style.zIndex = String(z);
    };
    mk('municipios', 410);
    mk('departamentos', 420);
    mk('seleccion', 430);
    // Con renderizado en canvas, cada pane tiene su propio <canvas>: los panes
    // superiores no interactivos no deben capturar el puntero.
    map.getPane('seleccion')!.style.pointerEvents = 'none';
  }, [map]);
  return null;
}

// ---------------------------------------------------------------------------
// Capa municipal: se crea UNA vez; los cambios de filtros/variable sólo llaman
// a setStyle (no se vuelven a crear los 1.122 polígonos).
// ---------------------------------------------------------------------------
function MunicipiosLayer(props: MapViewProps) {
  const map = useMap();
  const { data, variable, munBreaks, filters, filteredCodes, showMunicipios, onSelect } = props;
  const layerRef = useRef<L.GeoJSON | null>(null);
  const styleRef = useRef<(f: MunFeature) => L.PathOptions>(() => ({}));
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const variableRef = useRef(variable);
  variableRef.current = variable;

  styleRef.current = (f: MunFeature): L.PathOptions => {
    const code = f.properties.MpCodigo;
    if (data.specialCodes.has(code))
      return { color: '#6b7280', weight: 0.8, dashArray: '3 3', fillColor: '#9ca3af', fillOpacity: 0.25, opacity: 0.8 };
    if (filters.deCodigo && deptCode2(code) !== filters.deCodigo)
      return { color: '#94a3b8', weight: 0.2, opacity: 0.25, fillOpacity: 0 };
    const rec = data.recordByCode.get(code);
    if (rec) {
      if (filteredCodes.has(code)) {
        const v = variable === 'area' ? rec.areaInundadaHa : rec.pctInundada;
        return { color: '#4b5563', weight: 0.5, opacity: 0.9, fillColor: colorFor(v, munBreaks), fillOpacity: 0.88 };
      }
      // Registro existente pero excluido por los filtros.
      return { color: '#64748b', weight: 0.4, opacity: 0.6, fillColor: '#ffffff', fillOpacity: 0.18 };
    }
    if (filters.availability === 'with' || filters.mpCodigo)
      return { color: '#94a3b8', weight: 0.2, opacity: 0.35, fillOpacity: 0 };
    return {
      color: '#8a94a3',
      weight: 0.3,
      opacity: 0.7,
      fillColor: NO_DATA_COLOR,
      fillOpacity: filters.availability === 'without' ? 0.75 : 0.5,
    };
  };

  // Creación única.
  useEffect(() => {
    const layer = L.geoJSON(data.municipios, {
      pane: 'municipios',
      style: (f) => styleRef.current(f as MunFeature),
      onEachFeature: (f, lyr) => {
        const feat = f as MunFeature;
        const p = feat.properties;
        lyr.bindTooltip(
          () => {
            if (data.specialCodes.has(p.MpCodigo))
              return `<div class="tt"><div class="tt-title">${escapeHtml(p.MpNombre)}</div><div class="tt-sub">Territorio especial — excluido de las estadísticas</div></div>`;
            const r = data.recordByCode.get(p.MpCodigo);
            const v = variableRef.current;
            const row = (lbl: string, val: string, on: boolean) =>
              `<div class="tt-row${on ? ' on' : ''}"><span>${lbl}</span><b>${val}</b></div>`;
            return `<div class="tt"><div class="tt-title">${escapeHtml(p.MpNombre)}</div><div class="tt-sub">${escapeHtml(r?.departamento ?? p.Depto)}</div>${
              r
                ? row('Área municipal', fmtHa(r.areaMunicipioHa), false) +
                  row('Área inundada', fmtHa(r.areaInundadaHa), v === 'area') +
                  row('% inundado', fmtPct(r.pctInundada, 3), v === 'pct')
                : '<div class="tt-nodata">Sin información en el Excel</div>'
            }</div>`;
          },
          { sticky: true, direction: 'top', offset: [0, -8], opacity: 1, className: 'map-tooltip' },
        );
        lyr.on({
          mouseover: (e) => {
            const t = e.target as L.Path;
            t.setStyle({ weight: 2, color: '#0f172a', opacity: 1 });
          },
          mouseout: (e) => layer.resetStyle(e.target as L.Path),
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (data.specialCodes.has(p.MpCodigo)) return;
            onSelectRef.current({ kind: 'municipio', code: p.MpCodigo });
          },
        });
      },
    });
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [data, map]);

  // Visibilidad.
  useEffect(() => {
    const l = layerRef.current;
    if (!l) return;
    if (showMunicipios) l.addTo(map);
    else l.remove();
  }, [showMunicipios, map]);

  // Actualización selectiva de estilos.
  useEffect(() => {
    layerRef.current?.setStyle((f) => styleRef.current(f as MunFeature));
  }, [variable, munBreaks, filters, filteredCodes]);

  return null;
}

// ---------------------------------------------------------------------------
// Capa departamental. Con la capa municipal activa se dibuja sólo como
// límites (encima, no interactiva); sin ella, como coroplético departamental
// con selección por clic.
// ---------------------------------------------------------------------------
function DepartamentosLayer(props: MapViewProps) {
  const map = useMap();
  const { data, variable, deptBreaks, byDept, showMunicipios, showDepartamentos, filters, onSelect } = props;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const interactive = !showMunicipios;

  const aggByCode = useMemo(() => new Map(byDept.map((d) => [d.deCodigo, d])), [byDept]);
  const ctxRef = useRef({ aggByCode, variable });
  ctxRef.current = { aggByCode, variable };

  const style = (f: DepFeature): L.PathOptions => {
    const c = deptCode2(f.properties.DeCodigo);
    const special = c === '00';
    if (!interactive)
      return { color: '#111827', weight: filters.deCodigo === c ? 2.2 : 1.3, opacity: 0.85, fill: false, dashArray: special ? '4 3' : undefined };
    if (special) return { color: '#6b7280', weight: 0.8, dashArray: '3 3', fillColor: '#9ca3af', fillOpacity: 0.25 };
    const a = aggByCode.get(c);
    const dimmed = filters.deCodigo && filters.deCodigo !== c;
    const v = a ? (variable === 'area' ? a.areaInundada : a.pctPonderado) : null;
    return {
      color: '#1f2937',
      weight: 1,
      opacity: dimmed ? 0.35 : 0.9,
      fillColor: a ? colorFor(v, deptBreaks) : NO_DATA_COLOR,
      fillOpacity: dimmed ? 0.1 : a ? 0.85 : 0.45,
    };
  };
  const styleRef = useRef(style);
  styleRef.current = style;

  const layer = useMemo(() => {
    return L.geoJSON(data.departamentos, {
      pane: 'departamentos',
      interactive,
      style: (f) => styleRef.current(f as DepFeature),
      onEachFeature: (f, lyr) => {
        if (!interactive) return;
        const p = (f as DepFeature).properties;
        const c = deptCode2(p.DeCodigo);
        lyr.bindTooltip(
          () => {
            if (c === '00') return `<div class="tt"><div class="tt-title">${escapeHtml(p.DeNombre)}</div><div class="tt-sub">Territorio especial</div></div>`;
            const a = ctxRef.current.aggByCode.get(c);
            const v = ctxRef.current.variable;
            const row = (lbl: string, val: string, on: boolean) => `<div class="tt-row${on ? ' on' : ''}"><span>${lbl}</span><b>${val}</b></div>`;
            return `<div class="tt"><div class="tt-title">${escapeHtml(p.DeNombre)}</div><div class="tt-sub">Departamento · código ${escapeHtml(p.DeCodigo)}</div>${
              a
                ? row('Municipios con información', String(a.count), false) +
                  row('Área inundada', fmtHa(a.areaInundada), v === 'area') +
                  row('% ponderado', fmtPct(a.pctPonderado, 3), v === 'pct')
                : '<div class="tt-nodata">Sin información (según filtros activos)</div>'
            }</div>`;
          },
          { sticky: true, direction: 'top', offset: [0, -8], opacity: 1, className: 'map-tooltip' },
        );
        lyr.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: 2.5, color: '#0f172a' }),
          mouseout: (e) => (e.target as L.Path).setStyle(styleRef.current(f as DepFeature)),
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (c !== '00') onSelectRef.current({ kind: 'departamento', code: c });
          },
        });
      },
    });
  }, [data, interactive]);

  useEffect(() => {
    map.getPane('departamentos')!.style.pointerEvents = interactive ? '' : 'none';
  }, [interactive, map]);

  useEffect(() => {
    if (showDepartamentos) layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [layer, showDepartamentos, map]);

  useEffect(() => {
    layer.setStyle((f) => styleRef.current(f as DepFeature));
  });

  return null;
}

// ---------------------------------------------------------------------------
// Resaltado de la selección + zoom automático.
// ---------------------------------------------------------------------------
function SelectionLayer({ data, selection, fitPadding, homeSignal }: MapViewProps) {
  const map = useMap();
  const deptFeatures = useMemo(() => {
    const m = new Map<string, DepFeature>();
    for (const f of data.departamentos.features) m.set(deptCode2(f.properties.DeCodigo), f);
    return m;
  }, [data]);

  const feature = useMemo(() => {
    if (!selection) return null;
    return selection.kind === 'municipio' ? data.munFeatureByCode.get(selection.code) ?? null : deptFeatures.get(selection.code) ?? null;
  }, [selection, data, deptFeatures]);

  useEffect(() => {
    if (!feature) return;
    const halo = L.geoJSON(feature, { pane: 'seleccion', interactive: false, style: { color: '#0f172a', weight: 6, opacity: 0.55, fill: false } });
    const line = L.geoJSON(feature, { pane: 'seleccion', interactive: false, style: { color: SELECT_COLOR, weight: 3, opacity: 1, fill: false } });
    halo.addTo(map);
    line.addTo(map);
    return () => {
      halo.remove();
      line.remove();
    };
  }, [feature, map]);

  useEffect(() => {
    if (!feature || !selection) return;
    map.flyToBounds(featureBounds(feature), {
      paddingTopLeft: [40, 60],
      paddingBottomRight: [40 + fitPadding.right, 40 + fitPadding.bottom],
      maxZoom: selection.kind === 'municipio' ? 11 : 9,
      duration: 0.6,
    });
    // fitPadding se lee en el momento del zoom; no debe disparar otro zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, map]);

  useEffect(() => {
    if (homeSignal > 0) map.flyToBounds(COLOMBIA_BOUNDS, { duration: 0.6 });
  }, [homeSignal, map]);

  return null;
}

function ClickToClear({ onSelect }: { onSelect: (s: Selection) => void }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onSelect(null);
    map.on('click', h);
    return () => {
      map.off('click', h);
    };
  }, [map, onSelect]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function MapView(props: MapViewProps) {
  const bm = BASEMAPS.find((b) => b.id === props.basemap) ?? BASEMAPS[0];
  return (
    <MapContainer
      bounds={COLOMBIA_BOUNDS}
      preferCanvas
      zoomSnap={0.25}
      zoomDelta={0.5}
      zoomControl={false}
      minZoom={4}
      maxBounds={COLOMBIA_BOUNDS.pad(0.8)}
      className="leaflet-map"
      attributionControl
    >
      <TileLayer key={bm.id} url={bm.url} attribution={bm.attribution} maxZoom={bm.maxZoom} />
      <Panes />
      <ZoomControl />
      <MunicipiosLayer {...props} />
      <DepartamentosLayer {...props} />
      <SelectionLayer {...props} />
      <ClickToClear onSelect={props.onSelect} />
      <InvalidateOnResize />
    </MapContainer>
  );
}

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const z = L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' });
    z.addTo(map);
    return () => {
      z.remove();
    };
  }, [map]);
  return null;
}
