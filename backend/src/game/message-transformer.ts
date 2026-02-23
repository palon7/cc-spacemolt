// ---------------------------------------------------------------------------
// Transform SpaceMolt WS messages into shared GameState / GameEvent types
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { GameState, GameEvent } from '../state/types.js';
import type {
  StateUpdatePayload,
  CombatUpdatePayload,
  PlayerDiedPayload,
  ScanDetectedPayload,
  MiningYieldPayload,
  ChatMessagePayload,
  TradeOfferPayload,
  SkillLevelUpPayload,
  PoiMovementPayload,
  OkPayload,
  ReconnectedPayload,
  StateChangePayload,
  PirateWarningPayload,
  PirateCombatPayload,
  ActionResultPayload,
} from './types.js';

// ---------------------------------------------------------------------------
// State merging
// ---------------------------------------------------------------------------

export function mergeStateUpdate(prev: GameState | null, update: StateUpdatePayload): GameState {
  const base: GameState = prev ?? {
    tick: 0,
    player: {
      username: '',
      empire: '',
      credits: 0,
      current_system: '',
      current_poi: '',
      skills: {},
      skill_xp: {},
      stats: {},
    },
    ship: {
      class_id: '',
      name: '',
      hull: 0,
      max_hull: 0,
      shield: 0,
      max_shield: 0,
      shield_recharge: 0,
      armor: 0,
      speed: 0,
      fuel: 0,
      max_fuel: 0,
      cargo_used: 0,
      cargo_capacity: 0,
      cpu_used: 0,
      cpu_capacity: 0,
      power_used: 0,
      power_capacity: 0,
      weapon_slots: 0,
      defense_slots: 0,
      utility_slots: 0,
      cargo: [],
    },
    modules: [],
    in_combat: false,
    travel_progress: null,
    travel_destination: null,
    travel_type: null,
    travel_arrival_tick: null,
  };

  return {
    tick: update.tick ?? base.tick,
    player: update.player ? { ...base.player, ...stripUndefined(update.player) } : base.player,
    ship: update.ship
      ? {
          ...base.ship,
          ...stripUndefined(update.ship),
          cargo: update.ship.cargo ?? base.ship.cargo,
        }
      : base.ship,
    modules: update.modules
      ? update.modules.map((m) => ({
          ...m,
          id: m.id,
          name: m.name,
          type: m.type,
          type_id: m.type_id,
          quality: m.quality,
          quality_grade: m.quality_grade,
          cpu_usage: m.cpu_usage,
          power_usage: m.power_usage,
          wear: m.wear,
          wear_status: m.wear_status,
        }))
      : base.modules,
    in_combat: update.in_combat ?? base.in_combat,
    // Travel fields: server omits these when not traveling, so treat
    // missing (undefined) as null to clear stale travel state.
    travel_progress: update.travel_progress ?? null,
    travel_destination: update.travel_destination ?? null,
    travel_type: update.travel_type ?? null,
    travel_arrival_tick: update.travel_arrival_tick ?? null,
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result as Partial<T>;
}

// ---------------------------------------------------------------------------
// Event transformation
// ---------------------------------------------------------------------------

function asPayload<T>(payload: unknown): T {
  return (payload ?? {}) as T;
}

function shortJson(obj: unknown, max = 240): string {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= max) return s;
    return s.slice(0, max) + '…';
  } catch {
    return String(obj);
  }
}

function getDisplayLabel(type: string, payload: unknown): string | undefined {
  if (type !== 'ok') return undefined;
  const p = asPayload<OkPayload>(payload);
  if (p.arrival_tick != null) return 'travel';
  if (p.type === 'auto_dock' || p.type === 'auto_undock') return p.type;
  if (p.type === 'new_forum_post') return 'forum';
  return undefined;
}

function formatUsername(content: { username?: string; clan_tag?: string }): string {
  const name = content.username ?? '?';
  const clan = content.clan_tag ? ` [${content.clan_tag}]` : '';
  return name + clan;
}

export function transformEventMessage(type: string, payload: unknown): GameEvent {
  const summary = summarize(type, payload);
  const label = getDisplayLabel(type, payload);
  const event: GameEvent = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    type,
    summary,
  };
  if (label) event.label = label;
  return event;
}

function summarize(type: string, payload: unknown): string {
  switch (type) {
    case 'combat_update': {
      const p = asPayload<CombatUpdatePayload>(payload);
      if (p.destroyed) return `${p.attacker ?? '?'} destroyed ${p.target ?? '?'}!`;
      return `${p.attacker ?? '?'} attacked ${p.target ?? '?'}! ${p.damage ?? '?'} damages. (Shield:${p.shield_hit ?? '?'} Hull:${p.hull_hit ?? '?'})`;
    }
    case 'mining_yield': {
      const p = asPayload<MiningYieldPayload>(payload);
      const name = p.resource_name ?? p.resource_id ?? '?';
      const remaining = p.remaining_display ?? p.remaining ?? '?';
      return `${name} x${p.quantity ?? '?'} (${remaining} remaining)`;
    }
    case 'pirate_warning': {
      const p = asPayload<PirateWarningPayload>(payload);
      const bossTag = p.is_boss ? ' [BOSS]' : '';
      const delay = p.delay_ticks ? ` (in ${p.delay_ticks} ticks)` : '';
      return `${p.pirate_name ?? '?'} (${p.pirate_tier ?? '?'}${bossTag}) detected you!${delay}`;
    }
    case 'pirate_combat': {
      const p = asPayload<PirateCombatPayload>(payload);
      const bossTag = p.is_boss ? ' [BOSS]' : '';
      const damageType = p.damage_type ? ` ${p.damage_type}` : ' unknown';
      return `${p.pirate_name ?? '?'}${bossTag} dealt ${p.damage ?? '?'}${damageType} damage. Hull: ${p.your_hull ?? '?'}/${p.your_max_hull ?? '?'} Shield: ${p.your_shield ?? '?'}`;
    }
    case 'action_result': {
      const p = asPayload<ActionResultPayload>(payload);
      return p.result?.message ?? `${p.command ?? '?'} completed`;
    }
    case 'chat_message': {
      const p = asPayload<ChatMessagePayload>(payload);
      return `#${p.channel ?? '?'} <${p.sender ?? '?'}> ${p.content ?? ''}`;
    }
    case 'skill_level_up': {
      const p = asPayload<SkillLevelUpPayload>(payload);
      return `Skill ${p.skill_id ?? '?'} leveled up to ${p.new_level ?? '?'}!`;
    }
    case 'poi_arrival': {
      const p = asPayload<PoiMovementPayload>(payload);
      return `${formatUsername(p)} arrived at ${p.poi_name ?? '?'}`;
    }
    case 'poi_departure': {
      const p = asPayload<PoiMovementPayload>(payload);
      return `${formatUsername(p)} departed from ${p.poi_name ?? '?'}`;
    }
    case 'scan_detected': {
      const p = asPayload<ScanDetectedPayload>(payload);
      return `Scanned by ${p.scanner_username ?? '?'} (Ship: ${p.scanner_ship_class ?? '?'}): ${p.message ?? ''}`;
    }
    case 'ok': {
      const p = asPayload<OkPayload>(payload);
      if (p.arrival_tick != null) {
        const action = p.action ?? p.message ?? 'ok';
        return `${action} arrival_tick=${p.arrival_tick} dest=${p.destination ?? '?'}`;
      }
      if (p.type === 'auto_dock' || p.type === 'auto_undock') return p.message ?? '';
      if (p.type === 'new_forum_post')
        return `[${p.category ?? '?'}] ${p.title ?? '?'} (by ${p.author ?? '?'})`;
      return shortJson(payload, 220);
    }
    case 'error': {
      const p = asPayload<{ code?: string; message?: string; wait_seconds?: number }>(payload);
      return `Error Code: ${p.code ?? '?'} Message: ${p.message ?? '?'} wait=${p.wait_seconds ?? '-'}`;
    }
    case 'state_change': {
      const p = asPayload<StateChangePayload>(payload);
      if (p.system && p.poi) {
        if (p.prev_system && p.prev_system !== p.system)
          return `Traveled to ${p.system} / ${p.poi}`;
        return `Arrived at ${p.poi}`;
      }
      return p.message ?? shortJson(payload, 220);
    }
    case 'player_died': {
      const p = asPayload<PlayerDiedPayload>(payload);
      if (p.killer_name)
        return `Killed by ${p.killer_name} Respawn: ${p.respawn_base ?? '?'} Cause: ${p.cause ?? '?'}`;
      return `You died because ${p.cause ?? '?'} Respawn: ${p.respawn_base ?? '?'}`;
    }
    case 'reconnected': {
      const p = asPayload<ReconnectedPayload>(payload);
      const ticks = p.ticks_remaining ?? p.tick ?? '?';
      return `${p.message ?? 'Reconnected'}${p.was_pilotless ? ' (was pilotless)' : ''} Ticks remaining: ${ticks}`;
    }
    case 'trade_offer_received': {
      const p = asPayload<TradeOfferPayload>(payload);
      return `Trade offer from ${p.from_name ?? '?'} Offer Credits: ${p.offer_credits ?? 0} Request Credits: ${p.request_credits ?? 0} Trade ID: ${p.trade_id ?? '?'}`;
    }
    case 'pilotless_ship':
      return 'Your ship is pilotless!';
    default:
      return shortJson(payload, 240);
  }
}
