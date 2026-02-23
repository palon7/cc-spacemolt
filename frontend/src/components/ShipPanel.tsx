import type { GameState, TravelHistoryEntry } from '@cc-spacemolt/shared';
import { GaugeBar } from './common/GaugeBar';
import { Chip } from './common/Chip';
import { IconInfo } from './common/Icons';
import { StarMap } from './StarMap';
import { useMapData, resolveSystem } from '../hooks/useMapData';

interface ShipPanelProps {
  state: GameState;
  travelHistory: TravelHistoryEntry[];
  onOpenDetail: () => void;
}

export function ShipPanel({ state, travelHistory, onOpenDetail }: ShipPanelProps) {
  const {
    ship,
    player,
    in_combat,
    travel_progress,
    travel_destination,
    travel_type,
    travel_arrival_tick,
    tick,
  } = state;
  const travelPct = Math.round((travel_progress ?? 0) * 100);
  const ticksLeft = travel_arrival_tick ? travel_arrival_tick - tick : null;
  const { data: mapData } = useMapData();
  const currentSystem = mapData ? resolveSystem(mapData, player.current_system) : null;
  const systemDisplayName = currentSystem?.name ?? player.current_system;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.4)' }}
          />
          <h2 className="text-sm font-semibold text-zinc-300 tracking-widest uppercase">Ship</h2>
        </div>
        <div className="flex items-center gap-2">
          {in_combat && (
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse font-bold tracking-wider">
              COMBAT
            </span>
          )}
          <button
            onClick={onOpenDetail}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
            title="Ship Details"
          >
            <IconInfo />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {player.username[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base text-zinc-200 truncate">{player.username}</div>
            <div className="flex items-center gap-1 text-xs truncate">
              <div
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }}
              />
              <span className="font-semibold text-emerald-300 truncate">{systemDisplayName}</span>
              {player.current_poi && (
                <span className="text-zinc-500 truncate">
                  · {player.current_poi_name ?? player.current_poi.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-base text-amber-300">
              {player.credits.toLocaleString()}
            </div>
            <div className="text-2xs text-zinc-600">credits</div>
          </div>
        </div>
        <div className="flex items-baseline justify-between px-1">
          <div>
            <span className="text-base font-medium text-zinc-100">{ship.name}</span>
            <span className="ml-1.5 text-xs text-zinc-600">{ship.class_id.replace(/_/g, ' ')}</span>
          </div>
          <span className="text-xs text-zinc-700 font-mono">T{tick}</span>
        </div>
        <div className="space-y-2">
          <GaugeBar label="Hull" value={ship.hull} max={ship.max_hull} />
          <GaugeBar label="Shield" value={ship.shield} max={ship.max_shield} />
          <GaugeBar label="Fuel" value={ship.fuel} max={ship.max_fuel} />
          <GaugeBar label="Cargo" value={ship.cargo_used} max={ship.cargo_capacity} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          <Chip label="Armor" value={ship.armor} />
          <Chip label="Speed" value={ship.speed} />
          <Chip label="CPU" value={`${ship.cpu_used}/${ship.cpu_capacity}`} />
          <Chip label="PWR" value={`${ship.power_used}/${ship.power_capacity}`} />
        </div>
        {travel_progress != null && (
          <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-2xs uppercase tracking-widest text-cyan-500">Traveling</span>
              </div>
              <span className="text-2xs text-zinc-600 uppercase">{travel_type}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-base font-mono text-cyan-300">{travel_destination}</span>
              <span className="text-xs text-zinc-600">
                ETA {ticksLeft != null ? `${ticksLeft}t` : '?'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-cyan-500/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-1000"
                style={{ width: `${travelPct}%` }}
              />
            </div>
            <div className="text-right mt-0.5">
              <span className="font-mono text-xs text-cyan-400">{travelPct}%</span>
            </div>
          </div>
        )}
        <div>
          <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Cargo</div>
          {ship.cargo?.map((c) => (
            <div
              key={c.item_id}
              className="flex items-center justify-between py-1 px-2 rounded bg-zinc-800/30 border border-zinc-800/50 mb-1"
            >
              <span className="text-sm text-zinc-400">{c.item_id.replace(/_/g, ' ')}</span>
              <span className="font-mono text-sm text-amber-300">&times;{c.quantity}</span>
            </div>
          ))}
          {(!ship.cargo || !ship.cargo.length) && (
            <div className="text-sm text-zinc-700 italic">Empty</div>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-zinc-800" style={{ height: '33%' }}>
        <StarMap gameState={state} travelHistory={travelHistory} />
      </div>
    </div>
  );
}
