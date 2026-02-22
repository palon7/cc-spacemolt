// ---------------------------------------------------------------------------
// SpaceMolt WebSocket message types (backend-internal)
// Ported from viewer/src/state/types.ts
// ---------------------------------------------------------------------------

export type SpaceMoltMessage<T = unknown> = {
  type: string;
  payload?: T;
};

export type WelcomePayload = {
  version?: string;
  tick_rate?: number;
  current_tick?: number;
  server_time?: number;
  motd?: string;
};

export type Player = {
  id?: string;
  username?: string;
  credits?: number;
  current_system?: string;
  current_poi?: string;
  docked_at_base?: string | null;
  anonymous?: boolean;
  is_cloaked?: boolean;
  status_message?: string;
  clan_tag?: string;
  primary_color?: string;
  secondary_color?: string;
};

export type CargoItem = {
  item_id: string;
  quantity: number;
};

export type ShipModule = {
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
  mining_power?: number;
  mining_range?: number;
  [key: string]: unknown;
};

export type Ship = {
  id?: string;
  owner_id?: string;
  class_id?: string;
  name?: string;
  hull?: number;
  max_hull?: number;
  shield?: number;
  max_shield?: number;
  shield_recharge?: number;
  armor?: number;
  speed?: number;
  fuel?: number;
  max_fuel?: number;
  cargo_used?: number;
  cargo_capacity?: number;
  cpu_used?: number;
  cpu_capacity?: number;
  power_used?: number;
  power_capacity?: number;
  weapon_slots?: number;
  defense_slots?: number;
  utility_slots?: number;
  modules?: string[];
  cargo?: CargoItem[];
};

export type StateUpdatePayload = {
  tick?: number;
  player?: Player;
  ship?: Ship;
  modules?: ShipModule[];
  in_combat?: boolean;
  travel_progress?: number;
  travel_destination?: string;
  travel_type?: string;
  travel_arrival_tick?: number;
};

export type ErrorPayload = {
  code?: string;
  message?: string;
  wait_seconds?: number;
};

export type CombatUpdatePayload = {
  attacker?: string;
  target?: string;
  damage?: number;
  shield_hit?: number;
  hull_hit?: number;
  destroyed?: boolean;
};

export type PlayerDiedPayload = {
  killer_name?: string;
  respawn_base?: string;
  cause?: string;
};

export type ScanDetectedPayload = {
  scanner_username?: string;
  scanner_ship_class?: string;
  message?: string;
};

export type MiningYieldPayload = {
  resource_id?: string;
  quantity?: number;
  remaining?: number;
};

export type ChatMessagePayload = {
  channel?: string;
  sender?: string;
  content?: string;
};

export type TradeOfferPayload = {
  from_name?: string;
  offer_credits?: number;
  request_credits?: number;
  trade_id?: string;
};

export type SkillLevelUpPayload = {
  skill_id?: string;
  new_level?: number;
};

export type PoiMovementPayload = {
  username?: string;
  clan_tag?: string;
  poi_name?: string;
};

export type OkPayload = {
  type?: string;
  message?: string;
  action?: string;
  arrival_tick?: number;
  destination?: string;
  category?: string;
  author?: string;
  title?: string;
};

export type ReconnectedPayload = {
  message?: string;
  was_pilotless?: boolean;
  tick?: number;
};

export type StateChangePayload = {
  message?: string;
  system?: string;
  poi?: string;
  prev_system?: string;
  prev_poi?: string;
};
