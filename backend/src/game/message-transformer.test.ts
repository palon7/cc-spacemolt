import { describe, it, expect } from 'vitest';
import { mergeStateUpdate, transformEventMessage } from './message-transformer.js';
import type { GameState } from '../state/types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseShip = {
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
};
const basePlayer = {
  username: '',
  empire: '',
  credits: 0,
  current_system: '',
  current_poi: '',
  skills: {},
  skill_xp: {},
  stats: {},
};

const emptyState: GameState = {
  tick: 1,
  player: basePlayer,
  ship: baseShip,
  modules: [],
  in_combat: false,
  travel_progress: null,
  travel_destination: null,
  travel_type: null,
  travel_arrival_tick: null,
};

// ---------------------------------------------------------------------------
// mergeStateUpdate
// ---------------------------------------------------------------------------

describe('mergeStateUpdate', () => {
  it('prev=null -> applies update to default state', () => {
    const result = mergeStateUpdate(null, {
      tick: 5,
      player: { username: 'Alice', credits: 100 },
    });
    expect(result.tick).toBe(5);
    expect(result.player.username).toBe('Alice');
    expect(result.player.credits).toBe(100);
    expect(result.in_combat).toBe(false);
  });

  it('merges partial update into existing state', () => {
    const prev: GameState = {
      ...emptyState,
      player: { ...basePlayer, username: 'Alice', credits: 500 },
    };
    const result = mergeStateUpdate(prev, { tick: 2, player: { credits: 600 } });
    expect(result.player.username).toBe('Alice');
    expect(result.player.credits).toBe(600);
  });

  it('undefined fields do not overwrite existing values', () => {
    const prev: GameState = { ...emptyState, player: { ...basePlayer, username: 'Bob' } };
    const result = mergeStateUpdate(prev, { tick: 2, player: { username: undefined } });
    expect(result.player.username).toBe('Bob');
  });

  it('ship.cargo is updated', () => {
    const prev: GameState = {
      ...emptyState,
      ship: {
        ...baseShip,
        cargo: [
          { id: 'a', name: 'Iron', quantity: 10, mass: 1, base_price: 5, resource_id: 'iron' },
        ],
      },
    };
    const result = mergeStateUpdate(prev, { tick: 2, ship: { cargo: [] } });
    expect(result.ship.cargo).toEqual([]);
  });

  it('modules is updated', () => {
    const mod = {
      id: 'm1',
      name: 'Mining Laser',
      type: 'weapon',
      type_id: 'ml1',
      quality: 1,
      quality_grade: 'standard',
      cpu_usage: 5,
      power_usage: 10,
      wear: 0.1,
      wear_status: 'good',
    };
    const result = mergeStateUpdate(emptyState, { tick: 2, modules: [mod] });
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]!.name).toBe('Mining Laser');
  });

  it('null -> value -> null transition for travel fields', () => {
    // null -> value
    const traveling = mergeStateUpdate(emptyState, {
      tick: 2,
      travel_progress: 0.5,
      travel_destination: 'Mars',
      travel_type: 'jump',
      travel_arrival_tick: 100,
    });
    expect(traveling.travel_progress).toBe(0.5);
    expect(traveling.travel_destination).toBe('Mars');

    // value -> null (arrival)
    const arrived = mergeStateUpdate(traveling, {
      tick: 3,
      travel_progress: null,
      travel_destination: null,
      travel_type: null,
      travel_arrival_tick: null,
    });
    expect(arrived.travel_progress).toBeNull();
    expect(arrived.travel_destination).toBeNull();
  });

  it('travel fields are cleared when omitted from state_update', () => {
    const traveling = mergeStateUpdate(emptyState, {
      tick: 2,
      travel_progress: 0.5,
      travel_destination: 'Mars',
      travel_type: 'jump',
      travel_arrival_tick: 100,
    });
    expect(traveling.travel_progress).toBe(0.5);

    // Server omits travel fields after arrival
    const afterArrival = mergeStateUpdate(traveling, { tick: 3 });
    expect(afterArrival.travel_progress).toBeNull();
    expect(afterArrival.travel_destination).toBeNull();
    expect(afterArrival.travel_type).toBeNull();
    expect(afterArrival.travel_arrival_tick).toBeNull();
  });

  it('in_combat is updated', () => {
    const result = mergeStateUpdate(emptyState, { tick: 2, in_combat: true });
    expect(result.in_combat).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transformEventMessage
// ---------------------------------------------------------------------------

describe('transformEventMessage - combat', () => {
  it('combat_update (not destroyed)', () => {
    const e = transformEventMessage('combat_update', {
      attacker: 'A',
      target: 'B',
      damage: 50,
      shield_hit: 30,
      hull_hit: 20,
    });
    expect(e.summary).toBe('A attacked B! 50 damages. (Shield:30 Hull:20)');
    expect(e.type).toBe('combat_update');
  });

  it('combat_update (destroyed=true)', () => {
    const e = transformEventMessage('combat_update', {
      attacker: 'A',
      target: 'B',
      destroyed: true,
    });
    expect(e.summary).toBe('A destroyed B!');
  });
});

describe('transformEventMessage - mining/trade', () => {
  it('mining_yield (with resource_name and remaining_display)', () => {
    const e = transformEventMessage('mining_yield', {
      resource_id: 'iron',
      resource_name: 'Iron Ore',
      quantity: 5,
      remaining: 95,
      remaining_display: 'unlimited',
    });
    expect(e.summary).toBe('Iron Ore x5 (unlimited remaining)');
  });

  it('mining_yield (legacy format without resource_name)', () => {
    const e = transformEventMessage('mining_yield', {
      resource_id: 'iron',
      quantity: 5,
      remaining: 95,
    });
    expect(e.summary).toBe('iron x5 (95 remaining)');
  });

  it('trade_offer_received', () => {
    const e = transformEventMessage('trade_offer_received', {
      from_name: 'Trader',
      trade_id: 't1',
      offer_credits: 100,
      request_credits: 50,
    });
    expect(e.summary).toContain('Trader');
    expect(e.summary).toContain('t1');
    expect(e.type).toBe('trade_offer_received');
  });
});

describe('transformEventMessage - chat/social', () => {
  it('chat_message', () => {
    const e = transformEventMessage('chat_message', {
      channel: 'general',
      sender: 'Alice',
      content: 'hi',
    });
    expect(e.summary).toBe('#general <Alice> hi');
  });

  it('skill_level_up', () => {
    const e = transformEventMessage('skill_level_up', { skill_id: 'mining', new_level: 2 });
    expect(e.summary).toBe('Skill mining leveled up to 2!');
  });
});

describe('transformEventMessage - movement', () => {
  it('poi_arrival', () => {
    const e = transformEventMessage('poi_arrival', {
      username: 'Bob',
      poi_name: 'Station Alpha',
      clan_tag: 'RED',
    });
    expect(e.summary).toBe('Bob(clan=RED) arrived at Station Alpha');
  });

  it('poi_departure', () => {
    const e = transformEventMessage('poi_departure', {
      username: 'Bob',
      poi_name: 'Station Alpha',
      clan_tag: null,
    });
    expect(e.summary).toBe('Bob(clan=No clan) departed from Station Alpha');
  });

  it('poi_departure (clan_tag="")', () => {
    const e = transformEventMessage('poi_departure', {
      username: 'Bob',
      poi_name: 'Station Alpha',
      clan_tag: '',
    });
    expect(e.summary).toBe('Bob(clan=No clan) departed from Station Alpha');
  });

  it('state_change (different system) -> Traveled to', () => {
    const e = transformEventMessage('state_change', {
      system: 'NewSystem',
      poi: 'Gate',
      prev_system: 'OldSystem',
    });
    expect(e.summary).toBe('Traveled to NewSystem / Gate');
  });

  it('state_change (same system) -> Arrived at', () => {
    const e = transformEventMessage('state_change', {
      system: 'Same',
      poi: 'Station',
      prev_system: 'Same',
    });
    expect(e.summary).toBe('Arrived at Station');
  });

  it('state_change (message fallback)', () => {
    const e = transformEventMessage('state_change', { message: 'Undocking...' });
    expect(e.summary).toBe('Undocking...');
  });
});

describe('transformEventMessage - ok variants', () => {
  it('ok (with arrival_tick) -> label=travel', () => {
    const e = transformEventMessage('ok', { arrival_tick: 100, destination: 'X', action: 'jump' });
    expect(e.label).toBe('travel');
    expect(e.summary).toContain('arrival_tick=100');
  });

  it('ok (auto_dock) -> label=auto_dock', () => {
    const e = transformEventMessage('ok', { type: 'auto_dock', message: 'docked at station' });
    expect(e.label).toBe('auto_dock');
    expect(e.summary).toBe('docked at station');
  });

  it('ok (auto_undock) -> label=auto_undock', () => {
    const e = transformEventMessage('ok', { type: 'auto_undock', message: 'undocked' });
    expect(e.label).toBe('auto_undock');
  });

  it('ok (new_forum_post) -> label=forum', () => {
    const e = transformEventMessage('ok', {
      type: 'new_forum_post',
      category: 'news',
      title: 'Hello',
      author: 'Alice',
    });
    expect(e.label).toBe('forum');
    expect(e.summary).toBe('[news] Hello (by Alice)');
  });

  it('ok (other) -> JSON string', () => {
    const e = transformEventMessage('ok', { type: 'something_else', data: 123 });
    expect(e.label).toBeUndefined();
    expect(e.summary).toContain('"type":"something_else"');
  });
});

describe('transformEventMessage - pirates', () => {
  it('pirate_warning (no boss, no delay)', () => {
    const e = transformEventMessage('pirate_warning', {
      pirate_name: 'Sentinel',
      pirate_tier: 'medium',
      is_boss: false,
      delay_ticks: 0,
    });
    expect(e.summary).toBe('Sentinel (medium) detected you!');
  });

  it('pirate_warning (boss with delay)', () => {
    const e = transformEventMessage('pirate_warning', {
      pirate_name: 'Dreadnought',
      pirate_tier: 'boss',
      is_boss: true,
      delay_ticks: 2,
    });
    expect(e.summary).toBe('Dreadnought (boss [BOSS]) detected you! (in 2 ticks)');
  });

  it('pirate_combat (not boss)', () => {
    const e = transformEventMessage('pirate_combat', {
      pirate_name: 'Raider',
      pirate_tier: 'small',
      is_boss: false,
      damage: 15,
      damage_type: 'explosive',
      your_hull: 85,
      your_max_hull: 100,
      your_shield: 50,
    });
    expect(e.summary).toBe('Raider dealt 15 explosive damage. Hull: 85/100 Shield: 50');
  });

  it('pirate_combat (boss)', () => {
    const e = transformEventMessage('pirate_combat', {
      pirate_name: 'Dreadnought',
      pirate_tier: 'boss',
      is_boss: true,
      damage: 80,
      damage_type: 'energy',
      your_hull: 20,
      your_max_hull: 100,
      your_shield: 0,
    });
    expect(e.summary).toBe('Dreadnought [BOSS] dealt 80 energy damage. Hull: 20/100 Shield: 0');
  });
});

describe('transformEventMessage - action_result', () => {
  it('action_result with result.message', () => {
    const e = transformEventMessage('action_result', {
      command: 'mine',
      result: { message: 'Mining complete' },
    });
    expect(e.summary).toBe('Mining complete');
  });

  it('action_result without result.message (fallback)', () => {
    const e = transformEventMessage('action_result', {
      command: 'jump',
      result: { total_earned: 500 },
    });
    expect(e.summary).toBe('jump completed');
  });
});

describe('transformEventMessage - death/danger', () => {
  it('player_died (with killer)', () => {
    const e = transformEventMessage('player_died', {
      killer_name: 'Pirate',
      cause: 'combat',
      respawn_base: 'Haven',
    });
    expect(e.summary).toBe('Killed by Pirate Respawn: Haven Cause: combat');
  });

  it('player_died (no killer)', () => {
    const e = transformEventMessage('player_died', { cause: 'starvation', respawn_base: 'Haven' });
    expect(e.summary).toBe('You died because starvation Respawn: Haven');
  });

  it('scan_detected', () => {
    const e = transformEventMessage('scan_detected', {
      scanner_username: 'Spy',
      scanner_ship_class: 'scout',
      message: 'beep',
    });
    expect(e.summary).toBe('Scanned by Spy (Ship: scout): beep');
  });
});

describe('transformEventMessage - system', () => {
  it('error', () => {
    const e = transformEventMessage('error', {
      code: 'E001',
      message: 'Fuel empty',
      wait_seconds: 10,
    });
    expect(e.summary).toBe('Error Code: E001 Message: Fuel empty wait=10');
  });

  it('reconnected (ticks_remaining)', () => {
    const e = transformEventMessage('reconnected', {
      message: 'Welcome back',
      was_pilotless: true,
      ticks_remaining: 42,
    });
    expect(e.summary).toBe('Welcome back (was pilotless) Ticks remaining: 42');
  });

  it('reconnected (fallback to tick for backwards compat)', () => {
    const e = transformEventMessage('reconnected', {
      message: 'Welcome back',
      was_pilotless: false,
      tick: 10,
    });
    expect(e.summary).toBe('Welcome back Ticks remaining: 10');
  });

  it('pilotless_ship', () => {
    const e = transformEventMessage('pilotless_ship', {});
    expect(e.summary).toBe('Your ship is pilotless!');
  });
});

describe('transformEventMessage - unknown/common', () => {
  it('unknown type -> JSON string', () => {
    const e = transformEventMessage('some_unknown_event', { foo: 'bar' });
    expect(e.summary).toContain('"foo":"bar"');
  });

  it('all events contain ts and type', () => {
    const e = transformEventMessage('mining_yield', {
      resource_id: 'x',
      quantity: 1,
      remaining: 0,
    });
    expect(e.ts).toBeDefined();
    expect(e.type).toBe('mining_yield');
  });
});
