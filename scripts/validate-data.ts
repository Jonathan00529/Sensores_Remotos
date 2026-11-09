/**
 * Validación de la integración Excel ↔ GeoJSON desde la línea de comandos.
 * Uso: npm run validate  (sale con código 1 si hay errores).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { read } from 'xlsx';
import { joinData } from '../src/utils/join';
import { parseWorkbook, SHEET_NAME } from '../src/utils/loadData';

const dir = resolve(import.meta.dirname, '../public/data');
const wb = read(readFileSync(`${dir}/Areas_Inundadas_Municipios_Frente_Frio.xlsx`), { type: 'buffer', cellDates: true });
const { rows, modified } = parseWorkbook(wb);
const dep = JSON.parse(readFileSync(`${dir}/departamentos_simplificado.geojson`, 'utf8'));
const mun = JSON.parse(readFileSync(`${dir}/municipios_simplificado.geojson`, 'utf8'));
const data = joinData(rows, mun, dep, { sourceModified: modified, sheetName: SHEET_NAME });

const icon = { ok: '✔', warn: '⚠', error: '✖' } as const;
for (const c of data.checks) {
  console.log(`${icon[c.status]} ${c.label}\n    ${c.detail}`);
  if (c.status !== 'ok') for (const i of c.items ?? []) console.log(`      - ${i}`);
}
console.log('\nControles de referencia:');
for (const c of data.controls)
  console.log(`  ${c.ok ? '✔' : '✖'} ${c.label.padEnd(40)} esperado ${String(c.expected).padStart(14)}  calculado ${c.computed.toFixed(c.decimals).padStart(14)} ${c.unit}`);
console.log(`\nFecha de modificación del Excel: ${modified?.toISOString() ?? 'no disponible'}`);
const errors = data.checks.filter((c) => c.status === 'error').length;
process.exit(errors ? 1 : 0);
