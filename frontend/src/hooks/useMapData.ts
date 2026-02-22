import { useState, useEffect } from 'react';

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

export interface MapStation {
  id: string;
  name: string;
  system_id: string;
  system_name: string;
  empire: string;
  condition: string;
  services: Record<string, boolean>;
}

export interface MapData {
  systems: MapSystem[];
  stations: MapStation[];
  byId: Map<string, MapSystem>;
  byName: Map<string, MapSystem>;
  stationsBySystemId: Map<string, MapStation[]>;
}

// Module-level cache — persists across component mounts
let cachedPromise: Promise<MapData> | null = null;
let cachedData: MapData | null = null;

async function fetchMapData(): Promise<MapData> {
  const resp = await fetch('/api/map');
  if (!resp.ok) throw new Error(`Failed to fetch map: ${resp.status}`);

  const json = (await resp.json()) as {
    systems?: MapSystem[];
    stations?: MapStation[];
  };

  const systems = json.systems ?? [];
  const stations = json.stations ?? [];

  const byId = new Map(systems.map((s) => [s.id, s]));
  const byName = new Map(systems.map((s) => [s.name.toLowerCase(), s]));

  const stationsBySystemId = new Map<string, MapStation[]>();
  for (const st of stations) {
    const list = stationsBySystemId.get(st.system_id);
    if (list) list.push(st);
    else stationsBySystemId.set(st.system_id, [st]);
  }

  return { systems, stations, byId, byName, stationsBySystemId };
}

/** Look up a system by ID first, then by name (case-insensitive). */
export function resolveSystem(data: MapData, nameOrId: string): MapSystem | null {
  return data.byId.get(nameOrId) ?? data.byName.get(nameOrId.toLowerCase()) ?? null;
}

export function useMapData(): { data: MapData | null; error: string | null } {
  const [data, setData] = useState<MapData | null>(cachedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedData) {
      setData(cachedData);
      return;
    }
    if (!cachedPromise) cachedPromise = fetchMapData();
    cachedPromise
      .then((d) => {
        cachedData = d;
        setData(d);
      })
      .catch((e: Error) => {
        cachedPromise = null;
        setError(e.message);
      });
  }, []);

  return { data, error };
}
