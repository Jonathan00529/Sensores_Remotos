import type {
  ControlComparison,
  DashboardData,
  DepCollection,
  DepartamentoInfo,
  ExcelRow,
  MunCollection,
  MunFeature,
  MunicipioRecord,
  QualityCheck,
} from '../types';
import { deptCode2, munKey, normalizeDept, normalizeName } from './normalize';
import { aggregate } from './stats';

export const EXPECTED_COLUMNS = [
  'Municipio',
  'Departamento',
  'Area_Municipio_ha',
  'Area_Inundada_ha',
  '%_Area_inundada',
] as const;

/**
 * Valores de referencia para el control de calidad. NO se muestran como
 * resultados: la interfaz siempre calcula los indicadores a partir del Excel y
 * sólo compara contra estos valores para detectar errores de procesamiento.
 */
export const REFERENCE_CONTROLS = {
  registros: 180,
  departamentos: 9,
  areaMunicipio: 11_530_660.18,
  areaInundada: 285_168.52,
  pctPonderado: 2.4731,
  pctPromedio: 2.3531,
};

/** Tolerancia relativa para comparar porcentajes del Excel con áreas. */
const PCT_TOLERANCE = 1e-6;

/** Entidad especial "Area En Litigio Cauca - Huila". */
export function isSpecialEntity(code: string, depto: string): boolean {
  return /^0+$/.test(String(code)) || normalizeName(depto) === 'n a';
}

export function joinData(
  rawRows: Record<string, unknown>[],
  municipios: MunCollection,
  departamentos: DepCollection,
  meta: { sourceModified: Date | null; sheetName: string },
): DashboardData {
  const checks: QualityCheck[] = [];

  // ---------- 1. Estructura del Excel ----------
  const cols = rawRows.length ? Object.keys(rawRows[0]) : [];
  const missingCols = EXPECTED_COLUMNS.filter((c) => !cols.includes(c));
  checks.push({
    id: 'columns',
    label: 'Columnas requeridas del Excel',
    status: missingCols.length ? 'error' : 'ok',
    detail: missingCols.length
      ? `Faltan columnas: ${missingCols.join(', ')}`
      : `Hoja "${meta.sheetName}": ${EXPECTED_COLUMNS.length} columnas esperadas presentes.`,
  });

  const rows: ExcelRow[] = rawRows.map((r) => ({
    Municipio: String(r['Municipio'] ?? '').trim(),
    Departamento: String(r['Departamento'] ?? '').trim(),
    Area_Municipio_ha: Number(r['Area_Municipio_ha']),
    Area_Inundada_ha: Number(r['Area_Inundada_ha']),
    '%_Area_inundada': Number(r['%_Area_inundada']),
  }));

  // ---------- 2. Valores nulos / negativos / inconsistentes ----------
  const badValues: string[] = [];
  const badPct: string[] = [];
  rows.forEach((r, i) => {
    const tag = `Fila ${i + 2}: ${r.Municipio || '(sin nombre)'} – ${r.Departamento || '(sin depto)'}`;
    const issues: string[] = [];
    if (!r.Municipio) issues.push('municipio vacío');
    if (!r.Departamento) issues.push('departamento vacío');
    if (!Number.isFinite(r.Area_Municipio_ha) || r.Area_Municipio_ha <= 0) issues.push('área municipal nula o ≤ 0');
    if (!Number.isFinite(r.Area_Inundada_ha) || r.Area_Inundada_ha < 0) issues.push('área inundada nula o negativa');
    if (r.Area_Inundada_ha > r.Area_Municipio_ha) issues.push('área inundada > área municipal');
    if (!Number.isFinite(r['%_Area_inundada']) || r['%_Area_inundada'] < 0 || r['%_Area_inundada'] > 100)
      issues.push('porcentaje fuera de [0, 100]');
    if (issues.length) badValues.push(`${tag}: ${issues.join('; ')}`);
    else {
      const calc = (r.Area_Inundada_ha / r.Area_Municipio_ha) * 100;
      const diff = Math.abs(calc - r['%_Area_inundada']);
      if (diff > Math.max(PCT_TOLERANCE, Math.abs(calc) * PCT_TOLERANCE))
        badPct.push(`${tag}: Excel ${r['%_Area_inundada'].toFixed(6)} % vs calculado ${calc.toFixed(6)} %`);
    }
  });
  checks.push({
    id: 'values',
    label: 'Valores nulos, negativos o inconsistentes',
    status: badValues.length ? 'error' : 'ok',
    detail: badValues.length ? `${badValues.length} registro(s) con problemas.` : `Los ${rows.length} registros tienen áreas válidas.`,
    items: badValues,
  });
  checks.push({
    id: 'pct',
    label: 'Coherencia % = área inundada / área municipal × 100',
    status: badPct.length ? 'warn' : 'ok',
    detail: badPct.length
      ? `${badPct.length} porcentaje(s) no coinciden con las áreas.`
      : `Los ${rows.length} porcentajes coinciden con las áreas (tolerancia relativa ${PCT_TOLERANCE}).`,
    items: badPct,
  });

  // ---------- 3. Duplicados en clave municipio + departamento ----------
  const keyCount = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = munKey(r.Municipio, r.Departamento);
    keyCount.set(k, [...(keyCount.get(k) ?? []), i]);
  });
  const dupExcel = [...keyCount.entries()].filter(([, v]) => v.length > 1).map(([, v]) => v.map((i) => `${rows[i].Municipio} – ${rows[i].Departamento} (fila ${i + 2})`).join(' | '));
  checks.push({
    id: 'dup-excel',
    label: 'Duplicados municipio + departamento en el Excel',
    status: dupExcel.length ? 'error' : 'ok',
    detail: dupExcel.length ? `${dupExcel.length} clave(s) duplicada(s).` : 'Sin claves duplicadas.',
    items: dupExcel,
  });

  // ---------- 4. Índices geográficos ----------
  const specialCodes = new Set<string>();
  const geoIndex = new Map<string, MunFeature[]>();
  const munFeatureByCode = new Map<string, MunFeature>();
  const dupCodes: string[] = [];
  for (const f of municipios.features) {
    const p = f.properties;
    if (munFeatureByCode.has(p.MpCodigo)) dupCodes.push(`${p.MpCodigo} (${p.MpNombre})`);
    munFeatureByCode.set(p.MpCodigo, f);
    if (isSpecialEntity(p.MpCodigo, p.Depto)) {
      specialCodes.add(p.MpCodigo);
      continue;
    }
    const k = munKey(p.MpNombre, p.Depto);
    geoIndex.set(k, [...(geoIndex.get(k) ?? []), f]);
  }
  const dupGeo = [...geoIndex.entries()].filter(([, v]) => v.length > 1).map(([, v]) => v.map((f) => `${f.properties.MpNombre} – ${f.properties.Depto} (${f.properties.MpCodigo})`).join(' | '));
  checks.push({
    id: 'dup-geo',
    label: 'Unicidad de MpCodigo y de municipio + departamento en el GeoJSON',
    status: dupGeo.length || dupCodes.length ? 'error' : 'ok',
    detail:
      dupGeo.length || dupCodes.length
        ? `${dupCodes.length} código(s) y ${dupGeo.length} clave(s) de nombre repetidos.`
        : `${municipios.features.length} entidades; MpCodigo único y claves nombre + departamento únicas.`,
    items: [...dupCodes.map((c) => `MpCodigo repetido: ${c}`), ...dupGeo],
  });
  checks.push({
    id: 'special',
    label: 'Entidades especiales excluidas de las estadísticas',
    status: 'ok',
    detail: specialCodes.size
      ? `${specialCodes.size} entidad(es) tratadas como territorio especial (no municipio).`
      : 'No se encontraron entidades especiales.',
    items: [...specialCodes].map((c) => {
      const p = munFeatureByCode.get(c)!.properties;
      return `${p.MpNombre} (MpCodigo ${p.MpCodigo}, Depto ${p.Depto})`;
    }),
  });

  // ---------- 5. Departamentos ----------
  const deptByCode = new Map<string, DepartamentoInfo>();
  const deptByNorm = new Map<string, string>();
  for (const f of departamentos.features) {
    const p = f.properties;
    const c2 = deptCode2(p.DeCodigo);
    if (isSpecialEntity(c2, p.DeNombre) || normalizeName(p.DeNombre).startsWith('area en litigio')) continue;
    deptByCode.set(c2, { deCodigo: c2, geoName: p.DeNombre, excelName: null });
    deptByNorm.set(normalizeDept(p.DeNombre), c2);
  }
  // Consistencia GeoJSON municipal ↔ departamental: Depto debe corresponder al prefijo de MpCodigo.
  const munDeptMismatch: string[] = [];
  for (const f of municipios.features) {
    const p = f.properties;
    if (specialCodes.has(p.MpCodigo)) continue;
    const byName = deptByNorm.get(normalizeDept(p.Depto));
    const byCode = deptCode2(p.MpCodigo);
    if (byName !== byCode) munDeptMismatch.push(`${p.MpNombre} (${p.MpCodigo}): Depto "${p.Depto}" → ${byName ?? 'sin correspondencia'}; prefijo código ${byCode}`);
  }
  checks.push({
    id: 'geo-dept',
    label: 'Coherencia Depto ↔ prefijo DIVIPOLA en el GeoJSON municipal',
    status: munDeptMismatch.length ? 'warn' : 'ok',
    detail: munDeptMismatch.length
      ? `${munDeptMismatch.length} municipio(s) con Depto distinto al prefijo de su código (informativo; no afecta a los registros del Excel si no figuran en él).`
      : 'Todos los municipios del GeoJSON pertenecen al departamento indicado por su código (incluye homologación de San Andrés).',
    items: munDeptMismatch,
  });

  const excelDepts = [...new Set(rows.map((r) => r.Departamento))];
  const unmatchedDepts: string[] = [];
  for (const d of excelDepts) {
    const c = deptByNorm.get(normalizeDept(d));
    if (c) deptByCode.get(c)!.excelName = d;
    else unmatchedDepts.push(d);
  }
  checks.push({
    id: 'dept-join',
    label: 'Unión de departamentos (Excel → DeNombre / DeCodigo)',
    status: unmatchedDepts.length ? 'error' : 'ok',
    detail: unmatchedDepts.length
      ? `${unmatchedDepts.length} departamento(s) del Excel sin correspondencia.`
      : `Los ${excelDepts.length} departamentos del Excel tienen correspondencia en el GeoJSON departamental.`,
    items: unmatchedDepts.length
      ? unmatchedDepts
      : excelDepts.map((d) => `${d} → DeCodigo ${deptByNorm.get(normalizeDept(d))}`),
  });

  // ---------- 6. Unión municipal ----------
  const records: MunicipioRecord[] = [];
  const unmatched: string[] = [];
  const wrongDept: string[] = [];
  const usedCodes = new Map<string, number>();
  rows.forEach((r, i) => {
    const candidates = geoIndex.get(munKey(r.Municipio, r.Departamento)) ?? [];
    let mpCodigo: string | null = null;
    let deCodigo: string | null = deptByNorm.get(normalizeDept(r.Departamento)) ?? null;
    if (candidates.length === 1) {
      mpCodigo = candidates[0].properties.MpCodigo;
      const prefix = deptCode2(mpCodigo);
      if (deCodigo && prefix !== deCodigo)
        wrongDept.push(`${r.Municipio} – ${r.Departamento}: MpCodigo ${mpCodigo} pertenece al departamento ${prefix}`);
      deCodigo = deCodigo ?? prefix;
      if (usedCodes.has(mpCodigo)) unmatched.push(`${r.Municipio} – ${r.Departamento}: geometría ${mpCodigo} ya asignada a la fila ${usedCodes.get(mpCodigo)! + 2}`);
      usedCodes.set(mpCodigo, i);
    } else if (candidates.length > 1) {
      unmatched.push(`${r.Municipio} – ${r.Departamento} (fila ${i + 2}): unión ambigua (${candidates.length} geometrías)`);
    } else {
      // Sugerencias para el usuario (NO se aplican automáticamente).
      const nm = normalizeName(r.Municipio);
      const sameName = municipios.features
        .filter((f) => !specialCodes.has(f.properties.MpCodigo) && normalizeName(f.properties.MpNombre) === nm)
        .map((f) => `${f.properties.MpNombre} – ${f.properties.Depto} (${f.properties.MpCodigo})`);
      unmatched.push(
        `${r.Municipio} – ${r.Departamento} (fila ${i + 2}): sin correspondencia${sameName.length ? `. Mismo nombre en: ${sameName.join(', ')}` : ''}`,
      );
    }
    records.push({
      rowIndex: i,
      municipio: r.Municipio,
      departamento: r.Departamento,
      areaMunicipioHa: r.Area_Municipio_ha,
      areaInundadaHa: r.Area_Inundada_ha,
      pctInundada: r['%_Area_inundada'],
      mpCodigo,
      deCodigo,
    });
  });
  const matched = records.filter((r) => r.mpCodigo).length;
  checks.push({
    id: 'mun-join',
    label: 'Unión municipal (Municipio + Departamento → MpNombre + Depto)',
    status: unmatched.length ? 'error' : 'ok',
    detail: `${matched} de ${records.length} registros asociados de forma inequívoca a su geometría (MpCodigo).`,
    items: unmatched,
  });
  checks.push({
    id: 'mun-dept',
    label: 'Municipio asociado al departamento correcto (prefijo DIVIPOLA)',
    status: wrongDept.length ? 'error' : 'ok',
    detail: wrongDept.length
      ? `${wrongDept.length} registro(s) con departamento inconsistente.`
      : 'El prefijo de cada MpCodigo coincide con el DeCodigo del departamento del registro.',
    items: wrongDept,
  });
  const uniqueNames = new Set(records.map((r) => normalizeName(r.municipio))).size;
  const repeated = [...new Set(records.map((r) => normalizeName(r.municipio)))]
    .map((n) => records.filter((r) => normalizeName(r.municipio) === n))
    .filter((g) => g.length > 1)
    .map((g) => g.map((r) => `${r.municipio} – ${r.departamento} (${r.mpCodigo ?? 's/c'})`).join(' | '));
  checks.push({
    id: 'homonyms',
    label: 'Municipios homónimos resueltos por departamento',
    status: 'ok',
    detail: `${uniqueNames} nombres únicos en ${records.length} registros; los homónimos se distinguen por la clave compuesta.`,
    items: repeated,
  });

  // ---------- 7. Controles de referencia ----------
  const agg = aggregate(records);
  const ctrl = (label: string, expected: number, computed: number, tolerance: number, unit: string, decimals: number): ControlComparison => ({
    label,
    expected,
    computed,
    tolerance,
    unit,
    decimals,
    ok: Math.abs(expected - computed) <= tolerance,
  });
  const controls: ControlComparison[] = [
    ctrl('Registros municipales', REFERENCE_CONTROLS.registros, agg.count, 0, '', 0),
    ctrl('Departamentos', REFERENCE_CONTROLS.departamentos, agg.departments, 0, '', 0),
    ctrl('Área municipal acumulada', REFERENCE_CONTROLS.areaMunicipio, agg.areaMunicipio, 0.01, 'ha', 2),
    ctrl('Área inundada acumulada', REFERENCE_CONTROLS.areaInundada, agg.areaInundada, 0.01, 'ha', 2),
    ctrl('Afectación territorial ponderada', REFERENCE_CONTROLS.pctPonderado, agg.pctPonderado, 0.00005, '%', 4),
    ctrl('Promedio aritmético de % municipales', REFERENCE_CONTROLS.pctPromedio, agg.pctPromedio, 0.00005, '%', 4),
  ];
  const failed = controls.filter((c) => !c.ok);
  checks.push({
    id: 'controls',
    label: 'Controles de referencia (totales calculados vs. esperados)',
    status: failed.length ? 'error' : 'ok',
    detail: failed.length
      ? `${failed.length} control(es) no coinciden con los valores de referencia.`
      : 'Todos los totales calculados coinciden con los valores de referencia (tolerancia de redondeo).',
    items: failed.map((c) => `${c.label}: esperado ${c.expected}, calculado ${c.computed}`),
  });

  const recordByCode = new Map<string, MunicipioRecord>();
  for (const r of records) if (r.mpCodigo) recordByCode.set(r.mpCodigo, r);

  return {
    records,
    municipios,
    departamentos,
    recordByCode,
    deptByCode,
    munFeatureByCode,
    specialCodes,
    checks,
    controls,
    sourceModified: meta.sourceModified,
    sheetName: meta.sheetName,
  };
}
