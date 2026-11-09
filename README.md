# Dashboard de Áreas Inundadas – Frente Frío en Colombia

Aplicación web geoespacial (React + TypeScript + Vite + Leaflet + Recharts) para visualizar y analizar las áreas inundadas por el frente frío a escala nacional, departamental y municipal.

Los tres archivos de entrada se leen **en el navegador** en cada carga (no hay datos copiados en el código):

| Archivo | Uso |
|---|---|
| `public/data/Areas_Inundadas_Municipios_Frente_Frio.xlsx` (hoja `Orden x dpto`) | Estadísticas por municipio (SheetJS) |
| `public/data/departamentos_simplificado.geojson` | Capa departamental (`DeNombre`, `DeCodigo`) |
| `public/data/municipios_simplificado.geojson` | Capa municipal (`MpNombre`, `MpCodigo`, `Depto`) |

## Requisitos

- Node.js 20 o superior y npm.

## Ejecución local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # compila en dist/
npm run preview    # sirve dist/ localmente
npm run validate   # valida la unión Excel ↔ GeoJSON desde la terminal (sale con código 1 si hay errores)
```

## Funcionalidades

- **KPI** dinámicos: municipios, departamentos, Σ área inundada, Σ área municipal y **% ponderado = Σ inundada / Σ municipal × 100** (nunca el promedio de porcentajes).
- **Mapa** (≈ 75 % del ancho en escritorio): mapas base Satelital (Esri World Imagery), Topográfico (Esri World Topographic Map) y Estándar (OpenStreetMap); capas de municipios y departamentos activables por separado; coroplético por **área inundada (ha)** o **% de área inundada** con leyenda dinámica; tooltip al pasar el cursor; panel de detalle al hacer clic (código DIVIPOLA, posición dentro del departamento, etc.); zoom automático y botón de vista nacional.
  - Con la capa municipal activa, los departamentos se dibujan como límites. Al desactivar municipios, la capa departamental pasa a coroplético agregado y se puede consultar con clic (también desde el filtro, los gráficos o el enlace del panel municipal).
  - Gris = **sin información** (municipio sin registro en el Excel; nunca se asume 0). Un registro con 0 ha tendría su propio color.
  - El “Area En Litigio Cauca - Huila” (`MpCodigo 00000`, `Depto N/A`) se dibuja con trama y se excluye de todas las estadísticas.
- **Filtros** sincronizados con mapa, KPI, gráficos y tabla: departamento, municipio (búsqueda), rango de %, rango de área inundada y disponibilidad (todos / con / sin información).
- **Gráficos**: área inundada por departamento (con participación), % ponderado por departamento, top 10 por área, top 10 por %, y distribución por intervalos (fijos, cuantiles del mapa o amplitud igual configurable). Clic en una barra → localiza la entidad en el mapa.
- **Tabla** con ordenamiento, búsqueda, filtro por departamento, paginación, formato es-CO y exportación CSV/Excel; sincronizada con el mapa en ambos sentidos.
- **Control de calidad** automático al cargar (ver abajo).

Las clases del mapa son **cuantiles (5 clases)** calculados sobre los 180 registros: son clases de visualización estadística, no categorías oficiales de amenaza o riesgo.

## Integración de datos

1. **Normalización** (`src/utils/normalize.ts`): elimina tildes y diacríticos, pasa a minúsculas, sustituye puntuación por espacio y colapsa espacios.
2. **Unión municipal** por la clave compuesta *municipio + departamento* (`Municipio|Departamento` ↔ `MpNombre|Depto`). Una vez unida, la clave de trabajo es `MpCodigo`. No se hacen coincidencias aproximadas: lo que no une de forma exacta e inequívoca se reporta.
3. **Unión departamental** por nombre normalizado → `DeCodigo` (2 dígitos), con tabla de equivalencias explícita para San Andrés (`San Andrés y Providencia` ↔ `San Andrés Providencia y Santa Catalina`) y Bogotá (`DeCodigo 11001`).
4. **Validaciones** (`src/utils/join.ts`): columnas, nulos/negativos, coherencia del % con las áreas, duplicados en Excel y GeoJSON, registros sin geometría, departamentos sin correspondencia, prefijo DIVIPOLA del municipio = código del departamento, homónimos y controles de referencia.

Resultado con los archivos actuales: **180/180** registros unidos, **9/9** departamentos, totales iguales a los de referencia (11.530.660,18 ha; 285.168,52 ha; 2,4731 %; promedio simple 2,3531 %). Hay un aviso informativo: en el GeoJSON municipal, *Bogotá, D.C.* (`11001`) figura con `Depto = Cundinamarca`, aunque su código corresponde al Distrito Capital; no afecta a los datos porque Bogotá no está en el Excel.

Si los totales calculados no coinciden con los controles, o la unión falla, la interfaz muestra un aviso en rojo y el detalle en la sección **Control de calidad**. Los valores de referencia están en `REFERENCE_CONTROLS` y sólo se usan para comparar.

## Rendimiento

- Los archivos se descargan y procesan una sola vez (`useDashboardData`).
- Leaflet con renderizado **canvas** (`preferCanvas`) y panes separados. La capa municipal se crea una sola vez; los filtros y el cambio de variable sólo ejecutan `setStyle` sobre los polígonos existentes.
- Agregados memoizados; gráficos y tabla con carga diferida (`React.lazy`); dependencias pesadas en chunks separados.
- Los GeoJSON fuente no se modifican.

## Publicación en GitHub Pages

1. Cree un repositorio (por ejemplo `dashboard-inundaciones`) y suba el proyecto a la rama `main`:
   ```bash
   git init && git add . && git commit -m "Dashboard de áreas inundadas"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El workflow `.github/workflows/deploy.yml` se ejecuta en cada push a `main`: instala dependencias, corre `npm run validate`, compila con `VITE_BASE=/<repositorio>/` y publica `dist/`.
4. La aplicación queda en `https://<usuario>.github.io/<repositorio>/`.

**Ruta base (`base`)**: `vite.config.ts` usa `VITE_BASE` si está definida (el workflow la toma del nombre del repositorio) y, si no, una base relativa `./`, que también funciona en GitHub Pages con cualquier nombre de repositorio. Para compilar manualmente con la base explícita: `VITE_BASE=/mi-repo/ npm run build`. Los datos se cargan con `import.meta.env.BASE_URL + 'data/…'`, por lo que siguen siendo accesibles tras el despliegue.

## Mapas base y atribución

- **Esri World Imagery** y **Esri World Topographic Map**: uso con atribución visible a Esri y sus proveedores (incluida en el mapa). Revise los términos de Esri si el tablero tendrá uso comercial o tráfico alto.
- **OpenStreetMap**: atribución “© OpenStreetMap contributors” obligatoria y uso moderado según la [política de teselas de la OSMF](https://operations.osmfoundation.org/policies/tiles/).

## Estructura

```text
public/data/            Excel y GeoJSON originales
scripts/validate-data.ts  Validación por línea de comandos
src/
  types/                Tipos de datos
  utils/                normalize, join (unión + validación), stats, loadData, format
  hooks/                useDashboardData, useFilteredData
  maps/                 MapView (Leaflet), overlays (leyenda, capas, variable), basemaps
  charts/               Gráficos Recharts
  components/           Header, KPI, filtros, panel de información, tabla, control de calidad
  styles/               CSS (variables, layout responsive)
```

## Nota sobre SheetJS

Se usa `xlsx@0.18.5` de npm. SheetJS publica versiones más recientes en su propio CDN (`https://cdn.sheetjs.com/`); si desea actualizar: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Los avisos de `npm audit` de la versión 0.18.5 se refieren al procesamiento de archivos no confiables; aquí sólo se lee el Excel incluido en el proyecto.
