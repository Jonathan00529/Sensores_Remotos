import { read, utils, type WorkBook } from 'xlsx';
import type { DashboardData, DepCollection, MunCollection } from '../types';
import { joinData } from './join';

export const DATA_FILES = {
  excel: 'data/Areas_Inundadas_Municipios_Frente_Frio.xlsx',
  departamentos: 'data/departamentos_simplificado.geojson',
  municipios: 'data/municipios_simplificado.geojson',
} as const;

export const SHEET_NAME = 'Orden x dpto';

/** Ruta relativa a la base de despliegue (funciona en local y en GitHub Pages). */
export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function fetchOk(url: string, label: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`No se pudo descargar ${label} (${url}): ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`No se pudo cargar ${label} (${url}): HTTP ${res.status}`);
  return res;
}

export function parseWorkbook(wb: WorkBook): { rows: Record<string, unknown>[]; modified: Date | null } {
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`El Excel no contiene la hoja "${SHEET_NAME}". Hojas disponibles: ${wb.SheetNames.join(', ')}`);
  const rows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
  const m = wb.Props?.ModifiedDate ?? wb.Props?.CreatedDate ?? null;
  return { rows, modified: m ? new Date(m) : null };
}

function assertCollection(obj: unknown, label: string, props: string[]): void {
  const fc = obj as { type?: string; features?: { properties?: Record<string, unknown> }[] };
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features))
    throw new Error(`${label} no es un FeatureCollection GeoJSON válido.`);
  const p = fc.features[0]?.properties ?? {};
  const missing = props.filter((k) => !(k in p));
  if (missing.length) throw new Error(`${label} no contiene los atributos: ${missing.join(', ')}`);
}

export type LoadProgress = (step: string) => void;

export async function loadDashboardData(onProgress?: LoadProgress): Promise<DashboardData> {
  onProgress?.('Descargando archivos…');
  const [xlsRes, depRes, munRes] = await Promise.all([
    fetchOk(dataUrl(DATA_FILES.excel), 'el Excel de áreas inundadas'),
    fetchOk(dataUrl(DATA_FILES.departamentos), 'el GeoJSON de departamentos'),
    fetchOk(dataUrl(DATA_FILES.municipios), 'el GeoJSON de municipios'),
  ]);
  onProgress?.('Procesando Excel…');
  const wb = read(new Uint8Array(await xlsRes.arrayBuffer()), { type: 'array', cellDates: true });
  const { rows, modified } = parseWorkbook(wb);

  onProgress?.('Procesando geometrías…');
  const [departamentos, municipios] = (await Promise.all([depRes.json(), munRes.json()])) as [DepCollection, MunCollection];
  assertCollection(departamentos, 'departamentos_simplificado.geojson', ['DeNombre', 'DeCodigo']);
  assertCollection(municipios, 'municipios_simplificado.geojson', ['MpNombre', 'MpCodigo', 'Depto']);

  onProgress?.('Uniendo datos y validando…');
  return joinData(rows, municipios, departamentos, { sourceModified: modified, sheetName: SHEET_NAME });
}
