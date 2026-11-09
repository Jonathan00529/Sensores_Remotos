import { useMemo } from 'react';
import { X, MapPin, Landmark, Trophy, ArrowRight } from 'lucide-react';
import type { DashboardData, Selection } from '../types';
import { aggregateByDept, rankWithinDept } from '../utils/stats';
import { deptCode2 } from '../utils/normalize';
import { fmtHa, fmtNum, fmtPct } from '../utils/format';

interface Props {
  data: DashboardData;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onClose: () => void;
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`ip-stat${strong ? ' strong' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function InfoPanel({ data, selection, onSelect, onClose }: Props) {
  const allByDept = useMemo(
    () => aggregateByDept(data.records, (c) => data.deptByCode.get(c)?.excelName ?? data.deptByCode.get(c)?.geoName ?? c),
    [data],
  );
  if (!selection) return null;

  if (selection.kind === 'municipio') {
    const f = data.munFeatureByCode.get(selection.code);
    if (!f) return null;
    const p = f.properties;
    const r = data.recordByCode.get(p.MpCodigo);
    const dc = deptCode2(p.MpCodigo);
    const deptName = r?.departamento ?? data.deptByCode.get(dc)?.geoName ?? p.Depto;
    const rankA = r ? rankWithinDept(r, data.records, (x) => x.areaInundadaHa) : null;
    const rankP = r ? rankWithinDept(r, data.records, (x) => x.pctInundada) : null;
    return (
      <aside className="map-card info-panel" aria-label="Información del municipio">
        <header>
          <div className="ip-kicker">
            <MapPin size={13} /> Municipio
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        <h3>{p.MpNombre}</h3>
        <button className="link" onClick={() => onSelect({ kind: 'departamento', code: dc })}>
          {deptName} <ArrowRight size={12} />
        </button>
        <Stat label="Código DIVIPOLA" value={p.MpCodigo} />
        {r ? (
          <>
            <Stat label="Área municipal" value={fmtHa(r.areaMunicipioHa)} />
            <Stat label="Área inundada" value={fmtHa(r.areaInundadaHa)} strong />
            <Stat label="Afectación" value={fmtPct(r.pctInundada, 3)} strong />
            <div className="ip-bar" title="Proporción del territorio municipal inundado">
              <div style={{ width: `${Math.min(100, r.pctInundada)}%` }} />
            </div>
            {rankA && rankP && (
              <div className="ip-rank">
                <Trophy size={13} />
                <div>
                  Posición en {r.departamento}:
                  <br />
                  <b>#{rankA.rank}</b> de {rankA.total} por área inundada · <b>#{rankP.rank}</b> de {rankP.total} por % de afectación
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="ip-nodata">Sin información: este municipio no tiene registro en el Excel. No se le asigna valor cero.</p>
        )}
      </aside>
    );
  }

  const info = data.deptByCode.get(selection.code);
  const a = allByDept.find((d) => d.deCodigo === selection.code);
  return (
    <aside className="map-card info-panel" aria-label="Información del departamento">
      <header>
        <div className="ip-kicker">
          <Landmark size={13} /> Departamento
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>
      <h3>{info?.geoName ?? selection.code}</h3>
      <Stat label="Código" value={selection.code} />
      {a ? (
        <>
          <Stat label="Municipios con información" value={fmtNum(a.count, 0)} />
          <Stat label="Área municipal acumulada" value={fmtHa(a.areaMunicipio)} />
          <Stat label="Área inundada acumulada" value={fmtHa(a.areaInundada)} strong />
          <Stat label="Afectación ponderada" value={fmtPct(a.pctPonderado, 3)} strong />
          <Stat label="Participación en el total inundado" value={fmtPct(a.sharePct, 1)} />
          {a.maxArea && (
            <button className="ip-top" onClick={() => onSelect({ kind: 'municipio', code: a.maxArea!.mpCodigo! })}>
              <span>Mayor área inundada</span>
              <b>{a.maxArea.municipio}</b>
              <small>{fmtHa(a.maxArea.areaInundadaHa)}</small>
            </button>
          )}
          {a.maxPct && (
            <button className="ip-top" onClick={() => onSelect({ kind: 'municipio', code: a.maxPct!.mpCodigo! })}>
              <span>Mayor % de afectación</span>
              <b>{a.maxPct.municipio}</b>
              <small>{fmtPct(a.maxPct.pctInundada, 2)}</small>
            </button>
          )}
          <p className="ip-foot">Calculado sobre todos los registros del Excel. % ponderado = Σ área inundada / Σ área municipal × 100.</p>
        </>
      ) : (
        <p className="ip-nodata">Sin información: ningún municipio de este departamento figura en el Excel.</p>
      )}
    </aside>
  );
}
