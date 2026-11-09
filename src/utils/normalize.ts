/**
 * Normalización de nombres para la unión Excel ↔ GeoJSON.
 * - Elimina tildes y diacríticos (NFD + remoción de marcas combinantes).
 * - Minúsculas.
 * - Sustituye puntuación (.,-'’/()) por espacio.
 * - Colapsa espacios repetidos y recorta extremos.
 * No realiza coincidencias aproximadas: dos nombres sólo se unen si su forma
 * normalizada es idéntica (o si existe una equivalencia explícita abajo).
 */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:'’`´"()/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tabla de equivalencias explícitas de nombres de departamento.
 * Clave y valor en forma normalizada. Se documenta cada caso:
 *  - San Andrés: el GeoJSON municipal usa "San Andrés y Providencia" y el
 *    departamental "San Andrés Providencia y Santa Catalina".
 *  - Bogotá: el GeoJSON departamental usa "Bogotá, D.C.".
 */
export const DEPT_ALIASES: Record<string, string> = {
  'san andres y providencia': 'san andres providencia y santa catalina',
  'san andres providencia y santa catalina': 'san andres providencia y santa catalina',
  'archipielago de san andres providencia y santa catalina': 'san andres providencia y santa catalina',
  'bogota': 'bogota d c',
  'bogota dc': 'bogota d c',
};

export function normalizeDept(value: unknown): string {
  const n = normalizeName(value);
  return DEPT_ALIASES[n] ?? n;
}

/** Clave compuesta municipio + departamento. */
export function munKey(municipio: unknown, departamento: unknown): string {
  return `${normalizeName(municipio)}|${normalizeDept(departamento)}`;
}

/** Código departamental de 2 dígitos (Bogotá figura como "11001" en el GeoJSON departamental). */
export function deptCode2(code: string): string {
  return String(code).padStart(2, '0').slice(0, 2);
}
