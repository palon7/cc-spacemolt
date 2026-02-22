// ---------------------------------------------------------------------------
// Game data cache — fetches map + stations from SpaceMolt API once at startup
// + per-system PoI cache (lazy-loaded on demand)
// ---------------------------------------------------------------------------

import { debug } from '../logger/debug-logger.js';

const MAP_URL = 'https://game.spacemolt.com/api/map';
const STATIONS_URL = 'https://game.spacemolt.com/api/stations';
const SYSTEM_URL = 'https://game.spacemolt.com/api/map/system';

export interface MapSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  online: number;
  connections: string[];
  empire?: string;
  empire_color?: string;
  is_stronghold?: boolean;
  is_home?: boolean;
}

export interface Empire {
  id: string;
  name: string;
}

export interface Station {
  id: string;
  name: string;
  description: string;
  empire: string;
  empire_name: string;
  system_id: string;
  system_name: string;
  services: Record<string, boolean>;
  condition: string;
  condition_text: string;
  satisfaction_pct: number;
  facility_count: number;
  defense_level: number;
}

export interface CachedGameData {
  systems: MapSystem[];
  empires: Empire[];
  stations: Station[];
}

const EMPTY_DATA: CachedGameData = { systems: [], empires: [], stations: [] };

// ---------------------------------------------------------------------------
// PoI cache — lazy-loads per-system PoI data from /api/map/system/:id
// ---------------------------------------------------------------------------

export interface PoiInfo {
  id: string;
  name: string;
  type: string;
}

export class PoiCache {
  private poiById = new Map<string, PoiInfo>();
  private cachedSystems = new Set<string>();
  private fetchingSet = new Set<string>();

  /** Synchronously look up a PoI name from cache. Returns null if not cached. */
  getPoiName(poiId: string): string | null {
    return this.poiById.get(poiId)?.name ?? null;
  }

  /** Whether the given system's PoIs have been fetched and cached. */
  hasSystem(systemId: string): boolean {
    return this.cachedSystems.has(systemId);
  }

  /** Fetch PoI data for a system and cache it. No-op if already cached or in-flight. */
  async fetchSystem(systemId: string): Promise<void> {
    if (this.cachedSystems.has(systemId) || this.fetchingSet.has(systemId)) return;
    this.fetchingSet.add(systemId);
    try {
      const url = `${SYSTEM_URL}/${systemId}`;
      debug('poi-cache', `Fetching system PoIs: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        debug('poi-cache', `Failed to fetch system ${systemId}: ${res.status}`);
        return;
      }
      const json = (await res.json()) as {
        pois?: Array<{ id: string; name: string; type: string }>;
      };
      const pois = json.pois ?? [];
      for (const poi of pois) {
        this.poiById.set(poi.id, { id: poi.id, name: poi.name, type: poi.type });
      }
      this.cachedSystems.add(systemId);
      debug('poi-cache', `Cached ${pois.length} PoIs for system ${systemId}`);
    } catch (err) {
      debug('poi-cache', `Error fetching system ${systemId}: ${err}`);
    } finally {
      this.fetchingSet.delete(systemId);
    }
  }
}

export async function fetchGameData(): Promise<CachedGameData> {
  try {
    debug('game-data', `Fetching map from ${MAP_URL}`);
    debug('game-data', `Fetching stations from ${STATIONS_URL}`);

    const [mapRes, stationsRes] = await Promise.all([fetch(MAP_URL), fetch(STATIONS_URL)]);

    if (!mapRes.ok) {
      console.error(`Failed to fetch map: ${mapRes.status}`);
      return EMPTY_DATA;
    }
    if (!stationsRes.ok) {
      console.error(`Failed to fetch stations: ${stationsRes.status}`);
      return EMPTY_DATA;
    }

    const mapJson = (await mapRes.json()) as { systems?: MapSystem[] };
    const stationsJson = (await stationsRes.json()) as {
      empires?: Empire[];
      stations?: Station[];
    };

    const data: CachedGameData = {
      systems: mapJson.systems ?? [],
      empires: stationsJson.empires ?? [],
      stations: stationsJson.stations ?? [],
    };

    return data;
  } catch (err) {
    console.error('Failed to fetch game data:', err);
    return EMPTY_DATA;
  }
}
