import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Search, Table2 } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import type { DashboardData, MunicipioRecord, Selection } from '../types';
import { fmtNum } from '../utils/format';
import { normalizeName } from '../utils/normalize';

type Col = 'departamento' | 'municipio' | 'mpCodigo' | 'areaMunicipioHa' | 'areaInundadaHa' | 'pctInundada';

const COLUMNS: { key: Col; label: string; num?: boolean; decimals?: number }[] = [
  { key: 'departamento', label: 'Departamento' },
  { key: 'municipio', label: 'Municipio' },
  { key: 'mpCodigo', label: 'Código DIVIPOLA' },
  { key: 'areaMunicipioHa', label: 'Área municipal (ha)', num: true, decimals: 2 },
  { key: 'areaInundadaHa', label: 'Área inundada (ha)', num: true, decimals: 2 },
  { key: 'pctInundada', label: '% área inundada', num: true, decimals: 3 },
];

interface Props {
  data: DashboardData;
  records: MunicipioRecord[];
  deCodigo: string | null;
  onDept: (code: string | null) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export default function MunicipalTable({ data, records, deCodigo, onDept, selection, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: Col; dir: 1 | -1 }>({ key: 'areaInundadaHa', dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const n = normalizeName(q);
    const list = records.filter((r) => !n || normalizeName(r.municipio).includes(n) || (r.mpCodigo ?? '').includes(n));
    const k = sort.key;
    return [...list].sort((a, b) => {
      const va = a[k] ?? '';
      const vb = b[k] ?? '';
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return c * sort.dir || a.municipio.localeCompare(b.municipio, 'es');
    });
  }, [records, q, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => setPage(0), [q, records, pageSize]);
  useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [page, pages]);

  // Selección en el mapa → ubicar la fila en la tabla.
  const selCode = selection?.kind === 'municipio' ? selection.code : null;
  useEffect(() => {
    if (!selCode) return;
    const i = rows.findIndex((r) => r.mpCodigo === selCode);
    if (i >= 0) setPage(Math.floor(i / pageSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCode]);
  useEffect(() => {
    if (!selCode) return;
    // Desplaza sólo el contenedor de la tabla (no la página).
    const wrap = bodyRef.current;
    const el = wrap?.querySelector<HTMLTableRowElement>(`tr[data-code="${selCode}"]`);
    if (wrap && el) {
      const top = el.offsetTop - 40;
      if (top < wrap.scrollTop || top > wrap.scrollTop + wrap.clientHeight - 80) wrap.scrollTop = top;
    }
  }, [selCode, page]);

  const toggleSort = (key: Col) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: COLUMNS.find((c) => c.key === key)?.num ? -1 : 1 }));

  const exportRows = () =>
    rows.map((r) => ({
      Departamento: r.departamento,
      Municipio: r.municipio,
      Codigo_DIVIPOLA: r.mpCodigo ?? '',
      Area_Municipio_ha: r.areaMunicipioHa,
      Area_Inundada_ha: r.areaInundadaHa,
      '%_Area_inundada': r.pctInundada,
    }));

  const exportCsv = () => {
    const ws = utils.json_to_sheet(exportRows());
    const csv = utils.sheet_to_csv(ws, { FS: ';' });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'municipios_areas_inundadas.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const exportXlsx = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(exportRows()), 'Municipios');
    writeFile(wb, 'municipios_areas_inundadas.xlsx');
  };

  const visible = rows.slice(page * pageSize, page * pageSize + pageSize);
  const depts = [...data.deptByCode.values()].filter((d) => d.excelName).sort((a, b) => a.excelName!.localeCompare(b.excelName!, 'es'));

  return (
    <section className="table-card" aria-label="Tabla de municipios">
      <div className="table-head">
        <div className="section-title">
          <Table2 size={16} /> Municipios con información <small>· {fmtNum(rows.length, 0)} de {fmtNum(data.records.length, 0)} registros</small>
        </div>
        <div className="table-tools">
          <div className="combo small">
            <Search size={14} className="combo-icon" />
            <input placeholder="Buscar municipio o código…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en la tabla" />
          </div>
          <select value={deCodigo ?? ''} onChange={(e) => onDept(e.target.value || null)} aria-label="Filtrar por departamento">
            <option value="">Todos los departamentos</option>
            {depts.map((d) => (
              <option key={d.deCodigo} value={d.deCodigo}>
                {d.excelName}
              </option>
            ))}
          </select>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Download size={14} /> CSV
          </button>
          <button className="btn" onClick={exportXlsx} disabled={!rows.length}>
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>
      </div>
      <div className="table-wrap" ref={bodyRef}>
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => toggleSort(c.key)}>
                    {c.label}
                    {sort.key === c.key ? sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="muted" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  Sin registros para los filtros activos.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr
                key={r.rowIndex}
                data-code={r.mpCodigo ?? ''}
                className={r.mpCodigo === selCode ? 'sel' : ''}
                onClick={() => r.mpCodigo && onSelect({ kind: 'municipio', code: r.mpCodigo })}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && r.mpCodigo && onSelect({ kind: 'municipio', code: r.mpCodigo })}
              >
                <td>{r.departamento}</td>
                <td className="strong">{r.municipio}</td>
                <td className="mono">{r.mpCodigo ?? '—'}</td>
                <td className="num">{fmtNum(r.areaMunicipioHa, 2)}</td>
                <td className="num">{fmtNum(r.areaInundadaHa, 2)}</td>
                <td className="num">
                  <span className="pct-cell">
                    <i style={{ width: `${Math.max(2, Math.min(60, (r.pctInundada / 20) * 60))}px` }} />
                    {fmtNum(r.pctInundada, 3)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <label className="inline-field">
          Filas
          <select value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>
            {[10, 15, 25, 50, 100, 200].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <span>
          {rows.length ? `${fmtNum(page * pageSize + 1, 0)}–${fmtNum(Math.min(rows.length, (page + 1) * pageSize), 0)} de ${fmtNum(rows.length, 0)}` : '0 registros'}
        </span>
        <button className="icon-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button className="icon-btn" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
