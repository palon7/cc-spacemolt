// ---------------------------------------------------------------------------
// Shared types between backend and frontend
// ---------------------------------------------------------------------------

import type { ParsedEntry } from 'claude-code-client';

/** Maximum number of game events kept in memory (frontend and backend). */
export const MAX_GAME_EVENTS = 500;

export type AgentStatus = 'idle' | 'starting' | 'running' | 'interrupted' | 'done' | 'error';

export interface SessionMeta {
  sessionId: string;
  model: string;
  tools: string[];
  mcpServers: Array<{ name: string; status: string }>;
  totalCostUsd: number;
  numTurns: number;
  inputTokens: number;
  outputTokens: number;
  isCompacting: boolean;
  contextWindow: number;
  supportsInput: boolean;
}

// ---------------------------------------------------------------------------
// Game types (from Spacemolt)
// ---------------------------------------------------------------------------

export interface CargoItem {
  item_id: string;
  quantity: number;
}

export interface ShipState {
  class_id: string;
  name: string;
  hull: number;
  max_hull: number;
  shield: number;
  max_shield: number;
  shield_recharge: number;
  armor: number;
  speed: number;
  fuel: number;
  max_fuel: number;
  cargo_used: number;
  cargo_capacity: number;
  cpu_used: number;
  cpu_capacity: number;
  power_used: number;
  power_capacity: number;
  weapon_slots: number;
  defense_slots: number;
  utility_slots: number;
  cargo: CargoItem[];
}

export interface PlayerState {
  username: string;
  empire: string;
  credits: number;
  current_system: string;
  current_poi: string;
  current_poi_name?: string;
  skills: Record<string, number>;
  skill_xp: Record<string, number>;
  stats: Record<string, number>;
}

export interface ShipModule {
  id: string;
  name: string;
  type: string;
  type_id: string;
  quality: number;
  quality_grade: string;
  cpu_usage: number;
  power_usage: number;
  wear: number;
  wear_status: string;
  [key: string]: unknown;
}

export interface GameState {
  tick: number;
  player: PlayerState;
  ship: ShipState;
  modules: ShipModule[];
  in_combat: boolean;
  travel_progress: number | null;
  travel_destination: string | null;
  travel_type: string | null;
  travel_arrival_tick: number | null;
}

export interface GameEvent {
  id: string;
  ts: string;
  type: string;
  summary: string;
  label?: string;
  color?: string;
}

export interface TravelHistoryEntry {
  from: string;
  to: string;
  ts: string;
}

// ---------------------------------------------------------------------------
// Session history
// ---------------------------------------------------------------------------

export interface SessionSummary {
  sessionId: string;
  model: string;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  startedAt: string;
  lastModified: string;
  entryCount: number;
  lastMessage?: string;
}

// ---------------------------------------------------------------------------
// WebSocket protocol messages
// ---------------------------------------------------------------------------

/** Client -> Server */
export type ClientMessage =
  | { type: 'start'; instructions?: string }
  | { type: 'send_message'; text: string }
  | { type: 'resume'; message?: string }
  | { type: 'reset' }
  | { type: 'interrupt' }
  | { type: 'abort' }
  | { type: 'select_session'; sessionId: string };

/** Server -> Client */
export type ServerMessage =
  | { type: 'entry'; entry: ParsedEntry }
  | { type: 'meta'; meta: SessionMeta }
  | {
      type: 'config';
      initialPrompt: string;
      agentAvatarUrl?: string;
      userName?: string;
      userAvatarUrl?: string;
    }
  | { type: 'status'; status: AgentStatus }
  | { type: 'clear_streaming' }
  | { type: 'reset' }
  | { type: 'state_update'; state: GameState }
  | { type: 'game_event'; event: GameEvent }
  | { type: 'game_events'; events: GameEvent[] }
  | { type: 'game_status'; status: GameConnectionStatus; message?: string }
  | { type: 'travel_history'; history: TravelHistoryEntry[] }
  | { type: 'travel_history_update'; entry: TravelHistoryEntry }
  | { type: 'error'; message: string };

export type GameConnectionStatus = 'connecting' | 'connected' | 'error' | 'paused';
