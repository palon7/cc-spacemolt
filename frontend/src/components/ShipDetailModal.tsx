import type { GameState } from '@cc-spacemolt/shared';
import { GaugeBar } from './common/GaugeBar';
import { Chip } from './common/Chip';
import { LuX } from 'react-icons/lu';
import { Modal } from './common/Modal';

interface ShipDetailModalProps {
  state: GameState;
  onClose: () => void;
}

const KNOWN_KEYS = new Set([
  'id',
  'name',
  'type',
  'type_id',
  'quality',
  'quality_grade',
  'cpu_usage',
  'power_usage',
  'wear',
  'wear_status',
]);

export function ShipDetailModal({ state, onClose }: ShipDetailModalProps) {
  const { ship, modules, player } = state;

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{ship.name}</h3>
          <span className="text-xs text-zinc-500">{ship.class_id.replace(/_/g, ' ')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <LuX size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        <div className="space-y-2.5">
          <GaugeBar label="Hull" value={ship.hull} max={ship.max_hull} />
          <GaugeBar label="Shield" value={ship.shield} max={ship.max_shield} />
          <GaugeBar label="Fuel" value={ship.fuel} max={ship.max_fuel} />
          <GaugeBar label="Cargo" value={ship.cargo_used} max={ship.cargo_capacity} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Ship Stats</div>
          <div className="grid grid-cols-4 gap-1.5">
            <Chip label="Armor" value={ship.armor} />
            <Chip label="Speed" value={ship.speed} />
            <Chip label="Recharge" value={`${ship.shield_recharge}/t`} />
            <Chip label="Wpn" value={ship.weapon_slots} />
            <Chip label="CPU" value={`${ship.cpu_used}/${ship.cpu_capacity}`} />
            <Chip label="Power" value={`${ship.power_used}/${ship.power_capacity}`} />
            <Chip label="Def" value={ship.defense_slots} />
            <Chip label="Util" value={ship.utility_slots} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-2">
            Modules ({modules.length})
          </div>
          {modules.map((m) => {
            const wc =
              m.wear === 0 ? 'text-emerald-400' : m.wear < 50 ? 'text-amber-400' : 'text-red-400';
            const extra = Object.entries(m).filter(([k, v]) => !KNOWN_KEYS.has(k) && v != null);
            return (
              <div
                key={m.id}
                className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50 mb-1.5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-medium text-zinc-200">{m.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 border border-zinc-700">
                    {m.quality_grade}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                  <span className="text-zinc-500">
                    CPU <span className="text-zinc-400">{m.cpu_usage}</span>
                  </span>
                  <span className="text-zinc-500">
                    PWR <span className="text-zinc-400">{m.power_usage}</span>
                  </span>
                  <span className="text-zinc-500">
                    Wear{' '}
                    <span className={wc}>
                      {m.wear}% {m.wear_status}
                    </span>
                  </span>
                  {extra.map(([k, v]) => (
                    <span key={k} className="text-zinc-500">
                      {k.replace(/_/g, ' ')} <span className="text-cyan-400">{String(v)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {modules.length === 0 && (
            <div className="text-sm text-zinc-600 italic py-2">No modules installed</div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-2">
            Cargo ({ship.cargo?.length || 0})
          </div>
          <div className="space-y-1">
            {ship.cargo?.map((c) => (
              <div
                key={c.item_id}
                className="flex items-center justify-between py-1.5 px-2.5 rounded bg-zinc-800/30 border border-zinc-800/50"
              >
                <span className="text-sm text-zinc-300">{c.item_id.replace(/_/g, ' ')}</span>
                <span className="font-mono text-sm text-amber-300">&times;{c.quantity}</span>
              </div>
            ))}
            {(!ship.cargo || !ship.cargo.length) && (
              <div className="text-sm text-zinc-600 italic">Empty</div>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Skills</div>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(player.skills).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between px-2 py-1 rounded bg-zinc-800/30"
              >
                <span className="text-sm text-zinc-400">{k.replace(/_/g, ' ')}</span>
                <span className="font-mono text-sm text-violet-400">Lv.{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
