import { useMemo } from 'react';
import type { DashboardData, Filters, MunicipioRecord } from '../types';
import { aggregate, aggregateByDept } from '../utils/stats';

export function defaultFilters(data: DashboardData): Filters {
  const maxPct = Math.max(...data.records.map((r) => r.pctInundada));
  const maxArea = Math.max(...data.records.map((r) => r.areaInundadaHa));
  return {
    deCodigo: null,
    mpCodigo: null,
    pctRange: [0, Math.ceil(maxPct)],
    areaRange: [0, Math.ceil(maxArea)],
    availability: 'all',
  };
}

export function isRangeActive(f: Filters, d: Filters): boolean {
  return (
    f.pctRange[0] !== d.pctRange[0] ||
    f.pctRange[1] !== d.pctRange[1] ||
    f.areaRange[0] !== d.areaRange[0] ||
    f.areaRange[1] !== d.areaRange[1]
  );
}

/** Aplica todos los filtros a los registros estadísticos. */
export function applyFilters(records: MunicipioRecord[], f: Filters): MunicipioRecord[] {
  if (f.availability === 'without') return [];
  return records.filter(
    (r) =>
      (!f.deCodigo || r.deCodigo === f.deCodigo) &&
      (!f.mpCodigo || r.mpCodigo === f.mpCodigo) &&
      r.pctInundada >= f.pctRange[0] &&
      r.pctInundada <= f.pctRange[1] &&
      r.areaInundadaHa >= f.areaRange[0] &&
      r.areaInundadaHa <= f.areaRange[1],
  );
}

export function useFilteredData(data: DashboardData, filters: Filters) {
  return useMemo(() => {
    const filtered = applyFilters(data.records, filters);
    const filteredCodes = new Set(filtered.map((r) => r.mpCodigo!).filter(Boolean));
    const nameOf = (c: string) => data.deptByCode.get(c)?.excelName ?? data.deptByCode.get(c)?.geoName ?? c;
    return {
      filtered,
      filteredCodes,
      kpis: aggregate(filtered),
      byDept: aggregateByDept(filtered, nameOf),
      nameOf,
    };
  }, [data, filters]);
}
