import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/** Fila cruda de la hoja "Orden x dpto" del Excel. */
export interface ExcelRow {
  Municipio: string;
  Departamento: string;
  Area_Municipio_ha: number;
  Area_Inundada_ha: number;
  '%_Area_inundada': number;
}

export interface MunicipioProps {
  MpNombre: string;
  MpCodigo: string;
  Depto: string;
}

export interface DepartamentoProps {
  DeNombre: string;
  DeCodigo: string;
}

export type MunFeature = Feature<Polygon | MultiPolygon, MunicipioProps>;
export type DepFeature = Feature<Polygon | MultiPolygon, DepartamentoProps>;
export type MunCollection = FeatureCollection<Polygon | MultiPolygon, MunicipioProps>;
export type DepCollection = FeatureCollection<Polygon | MultiPolygon, DepartamentoProps>;

/** Registro estadístico ya unido a su geometría municipal. */
export interface MunicipioRecord {
  /** Índice de fila en el Excel (0 = primera fila de datos). */
  rowIndex: number;
  municipio: string;
  departamento: string;
  areaMunicipioHa: number;
  areaInundadaHa: number;
  /** Porcentaje leído directamente del Excel. */
  pctInundada: number;
  /** Código DIVIPOLA (MpCodigo) obtenido en la unión; null si no hubo correspondencia. */
  mpCodigo: string | null;
  /** Código del departamento (DeCodigo de 2 dígitos) obtenido en la unión. */
  deCodigo: string | null;
}

export interface DepartamentoInfo {
  deCodigo: string;
  /** Nombre tal como aparece en el GeoJSON departamental. */
  geoName: string;
  /** Nombre tal como aparece en el Excel (si tiene registros). */
  excelName: string | null;
}

export type CheckStatus = 'ok' | 'warn' | 'error';

export interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  items?: string[];
}

export interface ControlComparison {
  label: string;
  expected: number;
  computed: number;
  tolerance: number;
  unit: string;
  decimals: number;
  ok: boolean;
}

export interface DashboardData {
  records: MunicipioRecord[];
  municipios: MunCollection;
  departamentos: DepCollection;
  /** MpCodigo → registro estadístico. */
  recordByCode: Map<string, MunicipioRecord>;
  /** DeCodigo (2 dígitos) → info del departamento. */
  deptByCode: Map<string, DepartamentoInfo>;
  /** MpCodigo → feature municipal. */
  munFeatureByCode: Map<string, MunFeature>;
  /** Códigos de entidades especiales (área en litigio) excluidas de estadísticas. */
  specialCodes: Set<string>;
  checks: QualityCheck[];
  controls: ControlComparison[];
  sourceModified: Date | null;
  sheetName: string;
}

export type MapVariable = 'area' | 'pct';
export type Availability = 'all' | 'with' | 'without';

export interface Filters {
  deCodigo: string | null;
  mpCodigo: string | null;
  pctRange: [number, number];
  areaRange: [number, number];
  availability: Availability;
}

export type Selection =
  | { kind: 'municipio'; code: string }
  | { kind: 'departamento'; code: string }
  | null;

export interface Aggregate {
  count: number;
  departments: number;
  areaMunicipio: number;
  areaInundada: number;
  /** (Σ área inundada / Σ área municipal) × 100 */
  pctPonderado: number;
  /** Promedio aritmético simple (sólo para control de calidad). */
  pctPromedio: number;
}

export interface DeptAggregate extends Aggregate {
  deCodigo: string;
  name: string;
  maxArea: MunicipioRecord | null;
  maxPct: MunicipioRecord | null;
  sharePct: number;
}

export interface ClassBreaks {
  /** Límites internos (n-1 valores para n clases). */
  breaks: number[];
  colors: string[];
  min: number;
  max: number;
  method: string;
}
