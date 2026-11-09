import { CalendarDays, Database, Waves } from 'lucide-react';

interface Props {
  sourceModified: Date | null;
  sheetName: string;
  qualityStatus: 'ok' | 'warn' | 'error';
  onQuality: () => void;
}

export default function Header({ sourceModified, sheetName, qualityStatus, onQuality }: Props) {
  const date = sourceModified
    ? sourceModified.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'No disponible en los datos';
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Waves size={20} />
        </div>
        <div>
          <h1>Dashboard de Áreas Inundadas – Frente Frío en Colombia</h1>
          <p>Visualización y análisis de la afectación territorial por municipio y departamento</p>
        </div>
      </div>
      <div className="meta">
        <span title={`Archivo Excel, hoja "${sheetName}"`}>
          <Database size={13} /> Fuente: Areas_Inundadas_Municipios_Frente_Frio.xlsx · límites: GeoJSON departamental y municipal
        </span>
        <span title="Fecha de última modificación registrada en los metadatos del archivo Excel">
          <CalendarDays size={13} /> Actualización de datos: {date}
        </span>
        <button className={`qa-pill ${qualityStatus}`} onClick={onQuality}>
          {qualityStatus === 'ok' ? 'Validación OK' : qualityStatus === 'warn' ? 'Validación con avisos' : 'Errores de validación'}
        </button>
      </div>
    </header>
  );
}
