// Backend-internal types re-exported from shared and claude-code-client
export type {
  EntryKind,
  BaseEntry,
  SystemEntry,
  ThinkingEntry,
  TextEntry,
  ToolCallEntry,
  ToolResultEntry,
  UserMessageEntry,
  ResultEntry,
  NotificationEntry,
  ParsedEntry,
  StreamJsonMessage,
} from 'claude-code-client';
export type {
  AgentStatus,
  SessionMeta,
  ClientMessage,
  ServerMessage,
  GameState,
  GameEvent,
  TravelHistoryEntry,
  CargoItem,
  ShipState,
  PlayerState,
  ShipModule,
  SessionSummary,
} from '@cc-spacemolt/shared';
export { MAX_GAME_EVENTS } from '@cc-spacemolt/shared';
