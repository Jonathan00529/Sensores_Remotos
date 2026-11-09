export type BasemapId = 'satellite' | 'topo' | 'osm';

export interface Basemap {
  id: BasemapId;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

/**
 * Mapas base. Condiciones de uso:
 * - Esri World Imagery / World Topographic Map: uso permitido con atribución
 *   visible ("Powered by Esri" + fuentes). Ver https://www.esri.com/en-us/legal/terms/full-master-agreement
 * - OpenStreetMap: atribución "© OpenStreetMap contributors" obligatoria y uso
 *   moderado según https://operations.osmfoundation.org/policies/tiles/
 */
export const BASEMAPS: Basemap[] = [
  {
    id: 'satellite',
    label: 'Satelital',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Imágenes &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> — Fuente: Esri, Maxar, Earthstar Geographics y GIS User Community',
    maxZoom: 18,
  },
  {
    id: 'topo',
    label: 'Topográfico',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Mapa &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> — Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors y GIS User Community',
    maxZoom: 18,
  },
  {
    id: 'osm',
    label: 'Estándar (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    maxZoom: 19,
  },
];
