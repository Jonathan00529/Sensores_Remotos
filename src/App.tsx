import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { AlertOctagon, Loader2, SlidersHorizontal, X } from 'lucide-react';
import type { DashboardData, Filters, MapVariable, Selection } from './types';
import { useDashboardData } from './hooks/useDashboardData';
import { defaultFilters, isRangeActive, useFilteredData } from './hooks/useFilteredData';
import { aggregate, aggregateByDept, quantileBreaks } from './utils/stats';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import FiltersPanel from './components/FiltersPanel';
import InfoPanel from './components/InfoPanel';
import QualityPanel from './components/QualityPanel';
import MapView from './maps/MapView';
import { HomeButton, LayerPanel, Legend, VariableToggle } from './maps/MapOverlays';
import type { BasemapId } from './maps/basemaps';

// Componentes secundarios con carga diferida (Recharts y la tabla no bloquean el mapa).
const Charts = lazy(() => import('./charts/Charts'));
const MunicipalTable = lazy(() => import('./components/MunicipalTable'));

export default function App() {
  const state = useDashboardData();
  if (state.status === 'loading')
    return (
      <div className="splash">
        <Loader2 className="spin" size={28} />
        <p>Cargando datos geoespaciales…</p>
        <small>{state.step}</small>
      </div>
    );
  if (state.status === 'error')
    return (
      <div className="splash error">
        <AlertOctagon size={30} />
        <p>No fue posible cargar los datos del dashboard</p>
        <small>{state.error}</small>
        <small>Verifique que los tres archivos estén en public/data/ y que la ruta base (base) de Vite corresponda al repositorio.</small>
      </div>
    );
  return <Dashboard data={state.data} />;
}

function Dashboard({ data }: { data: DashboardData }) {
  const defaults = useMemo(() => defaultFilters(data), [data]);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [variable, setVariable] = useState<MapVariable>('area');
  const [basemap, setBasemap] = useState<BasemapId>('topo');
  const [showMun, setShowMun] = useState(true);
  const [showDep, setShowDep] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [homeSignal, setHomeSignal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const qaRef = useRef<HTMLElement>(null);

  const { filtered, filteredCodes, kpis, byDept, nameOf } = useFilteredData(data, filters);
  const total = useMemo(() => aggregate(data.records), [data]);

  // Clases fijas calculadas sobre el conjunto completo (la leyenda no cambia con los filtros).
  const munBreaks = useMemo(
    () => ({
      area: quantileBreaks(data.records.map((r) => r.areaInundadaHa)),
      pct: quantileBreaks(data.records.map((r) => r.pctInundada)),
    }),
    [data],
  );
  const deptBreaks = useMemo(() => {
    const all = aggregateByDept(data.records, nameOf);
    return { area: quantileBreaks(all.map((d) => d.areaInundada)), pct: quantileBreaks(all.map((d) => d.pctPonderado)) };
  }, [data, nameOf]);

  /** Selección desde gráficos o tabla: además lleva la vista al mapa. */
  const selectAndShow = useCallback((s: Selection) => {
    setSelection(s);
    document.querySelector('.map-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const goHome = useCallback(() => {
    setSelection(null);
    setHomeSignal((n) => n + 1);
  }, []);

  const onFilters = useCallback(
    (f: Filters) => {
      const prev = filters;
      if (f.mpCodigo && f.mpCodigo !== prev.mpCodigo) setSelection({ kind: 'municipio', code: f.mpCodigo });
      else if (f.deCodigo !== prev.deCodigo) {
        if (f.deCodigo) setSelection({ kind: 'departamento', code: f.deCodigo });
        else {
          setSelection(null);
          setHomeSignal((n) => n + 1);
        }
      } else if (!f.mpCodigo && prev.mpCodigo) setSelection((s) => (s?.kind === 'municipio' && s.code === prev.mpCodigo ? null : s));
      setFilters(f);
    },
    [filters],
  );
  const resetFilters = useCallback(() => {
    setFilters(defaults);
    goHome();
  }, [defaults, goHome]);

  const activeCount =
    (filters.deCodigo ? 1 : 0) +
    (filters.mpCodigo ? 1 : 0) +
    (filters.pctRange[0] !== defaults.pctRange[0] || filters.pctRange[1] !== defaults.pctRange[1] ? 1 : 0) +
    (filters.areaRange[0] !== defaults.areaRange[0] || filters.areaRange[1] !== defaults.areaRange[1] ? 1 : 0) +
    (filters.availability !== 'all' ? 1 : 0);

  const qaStatus = data.checks.some((c) => c.status === 'error') ? 'error' : data.checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
  const failedControls = data.controls.filter((c) => !c.ok);
  const integrationErrors = data.checks.filter((c) => c.status === 'error');

  const legendScale = showMun ? 'municipal' : 'departamental';
  const legendBreaks = showMun ? munBreaks[variable] : deptBreaks[variable];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 720;

  const filtersPanel = (
    <FiltersPanel data={data} filters={filters} defaults={defaults} onChange={onFilters} onReset={resetFilters} activeCount={activeCount} />
  );

  return (
    <div className="app">
      <Header
        sourceModified={data.sourceModified}
        sheetName={data.sheetName}
        qualityStatus={qaStatus}
        onQuality={() => qaRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {(failedControls.length > 0 || integrationErrors.length > 0) && (
        <div className="alert" role="alert">
          <AlertOctagon size={16} />
          <div>
            <b>Atención: la validación de datos detectó problemas.</b>{' '}
            {failedControls.length > 0 && <>Los totales calculados no coinciden con los controles esperados ({failedControls.map((c) => c.label).join(', ')}). </>}
            {integrationErrors.length > 0 && <>Errores de integración: {integrationErrors.map((c) => c.label).join('; ')}. </>}
            Revise la sección de control de calidad.
          </div>
        </div>
      )}

      <KpiCards kpis={kpis} total={total} filtered={activeCount > 0} />

      <main className="main">
        <aside className={`sidebar${filtersOpen ? ' open' : ''}`}>
          <button className="sidebar-close" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
            <X size={18} />
          </button>
          {filtersPanel}
        </aside>

        <div className="map-wrap">
          <MapView
            data={data}
            variable={variable}
            munBreaks={munBreaks[variable]}
            deptBreaks={deptBreaks[variable]}
            filters={filters}
            filteredCodes={filteredCodes}
            byDept={byDept}
            selection={selection}
            basemap={basemap}
            showMunicipios={showMun}
            showDepartamentos={showDep}
            fitPadding={isMobile ? { right: 0, bottom: 0 } : { right: 340, bottom: 0 }}
            homeSignal={homeSignal}
            onSelect={setSelection}
          />
          <div className="map-tl">
            <VariableToggle value={variable} onChange={setVariable} />
            <LayerPanel
              basemap={basemap}
              onBasemap={setBasemap}
              showMunicipios={showMun}
              showDepartamentos={showDep}
              onToggleMunicipios={() => setShowMun((v) => !v)}
              onToggleDepartamentos={() => setShowDep((v) => !v)}
            />
            <button className="map-card btn-filters" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={14} /> Filtros {activeCount > 0 && <span className="badge">{activeCount}</span>}
            </button>
          </div>
          <div className="map-bl">{(showMun || showDep) && <Legend variable={variable} breaks={legendBreaks} scale={legendScale} />}</div>
          <div className="map-br">
            <HomeButton onClick={goHome} />
          </div>
          {selection && (
            <div className="map-tr">
              <InfoPanel data={data} selection={selection} onSelect={setSelection} onClose={goHome} />
            </div>
          )}
          {filters.availability !== 'without' && filtered.length === 0 && (
            <div className="map-empty map-card">Ningún municipio cumple los filtros activos.</div>
          )}
        </div>
      </main>

      <Suspense fallback={<div className="lazy">Cargando gráficos…</div>}>
        <Charts records={filtered} byDept={byDept} pctBreaks={munBreaks.pct} selection={selection} onSelect={selectAndShow} />
      </Suspense>

      <Suspense fallback={<div className="lazy">Cargando tabla…</div>}>
        <MunicipalTable
          data={data}
          records={filtered}
          deCodigo={filters.deCodigo}
          onDept={(c) => onFilters({ ...filters, deCodigo: c, mpCodigo: null })}
          selection={selection}
          onSelect={selectAndShow}
        />
      </Suspense>

      <QualityPanel ref={qaRef} data={data} />

      <footer className="footer">
        <p>
          Datos: <code>Areas_Inundadas_Municipios_Frente_Frio.xlsx</code> (hoja “{data.sheetName}”), <code>departamentos_simplificado.geojson</code>,{' '}
          <code>municipios_simplificado.geojson</code>. Indicadores calculados dinámicamente en el navegador. Las clases cartográficas son de visualización estadística y no
          representan categorías oficiales de amenaza o riesgo.
        </p>
        <p>
          {isRangeActive(filters, defaults) ? 'Filtros de rango activos. ' : ''}Mapas base: Esri World Imagery, Esri World Topographic Map y OpenStreetMap (ver atribución en el
          mapa).
        </p>
      </footer>
    </div>
  );
}
