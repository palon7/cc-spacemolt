import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ToolCallEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { LuCheck, LuX } from 'react-icons/lu';

// ─── G helpers: styled game-text spans ───────────────────────────────────────
const G = {
  item: (v: unknown): ReactNode => <span className="text-yellow-400 font-bold">{String(v)}</span>,
  system: (v: unknown): ReactNode => <span className="text-cyan-300 font-bold">{String(v)}</span>,
  poi: (v: unknown): ReactNode => <span className="text-purple-400">{String(v)}</span>,
  credits: (v: unknown): ReactNode => (
    <>
      <span className="text-green-400">{String(v)}</span>
      <span className="text-green-400/60">cr</span>
    </>
  ),
  player: (v: unknown): ReactNode => <span className="text-white font-bold">{String(v)}</span>,
  qty: (v: unknown): ReactNode => (
    <>
      <span className="text-yellow-400/60">x</span>
      <span className="text-yellow-400">{String(v)}</span>
    </>
  ),
  ship: (v: unknown): ReactNode => <span className="text-blue-400 font-bold">{String(v)}</span>,
  fuel: (cur: unknown, max: unknown): ReactNode => (
    <span className="text-yellow-400">
      {String(cur)}/{String(max)}
    </span>
  ),
  cargo: (cur: unknown, max: unknown): ReactNode => (
    <span className="text-cyan-400">
      {String(cur)}/{String(max)}
    </span>
  ),
  damage: (v: unknown): ReactNode => (
    <span className="text-red-400 font-bold">{String(v)} dmg</span>
  ),
  xp: (label: string, v: unknown): ReactNode => (
    <span className="text-cyan-400">
      +{String(v)} {label} XP
    </span>
  ),
  channel: (v: unknown): ReactNode => <span className="text-cyan-400">{String(v)}</span>,
  dim: (v: unknown): ReactNode => <span className="text-zinc-500">{String(v)}</span>,
  empire: (v: unknown): ReactNode => <span className="text-orange-400">{String(v)}</span>,
  security: (v: unknown): ReactNode => <span className="text-blue-300">{String(v)}</span>,
};

// ─── Tool emoji ───────────────────────────────────────────────────────────────
const TOOL_EMOJI: Record<string, string> = {
  mine: '⛏️',
  travel: '🚀',
  jump: '🚀',
  dock: '🛬',
  undock: '🛫',
  login: '🔑',
  get_status: '📊',
  sell: '💰',
  buy: '🛒',
  craft: '🔧',
  refuel: '⛽',
  deposit_items: '📦',
  withdraw_items: '📤',
  get_notifications: '🔔',
  chat: '💬',
  get_ship: '🚢',
  get_poi: '📍',
  view_market: '🏪',
  get_system: '🌐',
  scan: '🔍',
  attack: '⚔️',
  forum_reply: '💬',
  captains_log_add: '📓',
};

function getToolEmoji(shortName: string): string {
  return TOOL_EMOJI[shortName] ?? '⚪';
}

// ─── Action description ───────────────────────────────────────────────────────
function formatAction(shortName: string, input: Record<string, unknown>): ReactNode {
  const itemId = input.item_id ?? input.item_name ?? '';
  const qty = input.quantity;

  switch (shortName) {
    case 'mine':
      return 'Mine';
    case 'travel':
      return <>Travel → {G.poi(input.target_poi ?? '')}</>;
    case 'jump':
      return <>Jump → {G.system(input.target_system ?? '')}</>;
    case 'dock':
      return 'Dock';
    case 'undock':
      return 'Undock';
    case 'login':
      return 'Login';
    case 'get_status':
      return 'Get Status';
    case 'sell':
      return qty !== undefined ? (
        <>
          Sell {G.item(itemId)} {G.qty(qty)}
        </>
      ) : (
        <>Sell {G.item(itemId)}</>
      );
    case 'buy':
      return qty !== undefined ? (
        <>
          Buy {G.item(itemId)} {G.qty(qty)}
        </>
      ) : (
        <>Buy {G.item(itemId)}</>
      );
    case 'craft': {
      const recipe = input.recipe_id ?? itemId;
      return qty !== undefined ? (
        <>
          Craft {G.item(recipe)} {G.qty(qty)}
        </>
      ) : (
        <>Craft {G.item(recipe)}</>
      );
    }
    case 'refuel':
      return 'Refuel';
    case 'deposit_items':
      return qty !== undefined ? (
        <>
          Deposit {G.item(itemId)} {G.qty(qty)}
        </>
      ) : (
        <>Deposit {G.item(itemId)}</>
      );
    case 'withdraw_items':
      return qty !== undefined ? (
        <>
          Withdraw {G.item(itemId)} {G.qty(qty)}
        </>
      ) : (
        <>Withdraw {G.item(itemId)}</>
      );
    case 'get_notifications':
      return 'Get Notifications';
    case 'chat': {
      const ch = input.channel ?? '';
      const msg = String(input.content ?? input.message ?? '');
      return (
        <>
          Chat [{G.channel(ch)}]: {msg.length > 40 ? msg.slice(0, 40) + '…' : msg}
        </>
      );
    }
    case 'get_ship':
      return 'Get Ship';
    case 'get_poi':
      return 'Get POI';
    case 'view_market': {
      const mItem = input.item_id;
      return mItem ? <>View Market ({G.item(mItem)})</> : 'View Market';
    }
    case 'get_system':
      return 'Get System';
    case 'scan':
      return <>Scan {G.player(input.target_id ?? input.target_name ?? '')}</>;
    case 'attack':
      return <>Attack {G.player(input.target_id ?? input.target_name ?? '')}</>;
    case 'forum_reply':
      return 'Forum Reply';
    case 'captains_log_add':
      return "Captain's Log";
    default: {
      const filtered = Object.entries(input).filter(([k]) => k !== 'session_id');
      if (filtered.length === 0) return shortName;
      const paramStr = filtered
        .slice(0, 3)
        .map(([k, v]) => {
          if (k === 'password') return `${k}: ****`;
          const val = typeof v === 'string' ? v : JSON.stringify(v);
          return `${k}: ${val.slice(0, 30)}`;
        })
        .join(', ');
      return `${shortName} (${paramStr})`;
    }
  }
}

// ─── Result summary ───────────────────────────────────────────────────────────
interface ResultSummary {
  label: ReactNode;
  lines: ReactNode[];
}

function parseResultSummary(shortName: string, content: string): ResultSummary {
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  if (json) return formatJsonResult(shortName, json);

  const textLines = content.split('\n').filter((l) => l.trim());
  if (textLines.length <= 3) return { label: '', lines: textLines };
  return { label: '', lines: [...textLines.slice(0, 3), `(+${textLines.length - 3} more lines)`] };
}

function formatJsonResult(shortName: string, json: Record<string, unknown>): ResultSummary {
  switch (shortName) {
    case 'mine':
      return fMine(json);
    case 'travel':
      return fTravel(json);
    case 'jump':
      return fJump(json);
    case 'dock':
      return fDock(json);
    case 'undock':
      return { label: 'Undocked', lines: [] };
    case 'login':
      return fLogin(json);
    case 'get_status':
      return fStatus(json);
    case 'sell':
      return fSell(json);
    case 'buy':
      return fBuy(json);
    case 'craft':
      return fCraft(json);
    case 'refuel':
      return fRefuel(json);
    case 'deposit_items':
      return fDeposit(json);
    case 'withdraw_items':
      return fWithdraw(json);
    case 'get_notifications':
      return fNotifications(json);
    case 'chat':
      return fChat(json);
    case 'get_ship':
      return fShip(json);
    case 'get_poi':
      return fPoi(json);
    case 'view_market':
      return fMarket(json);
    case 'get_system':
      return fSystem(json);
    case 'scan':
      return fScan(json);
    case 'attack':
      return fAttack(json);
    default:
      return fGeneric(json);
  }
}

function fMine(j: Record<string, unknown>): ResultSummary {
  const name = j.resource_name ?? j.resource_id ?? 'Unknown';
  const qty = j.quantity ?? 1;
  const remaining = j.remaining_display ?? j.remaining;
  return {
    label: (
      <>
        {G.item(name)} {G.qty(qty)}
        {remaining ? <> (remaining: {G.dim(remaining)})</> : null}
      </>
    ),
    lines: [],
  };
}

function fTravel(j: Record<string, unknown>): ResultSummary {
  const poi = j.poi_name ?? j.poi_id ?? j.target_poi ?? '';
  const lines: ReactNode[] = [];
  const players = j.online_players as Array<Record<string, unknown>> | undefined;
  if (players && players.length > 0) {
    lines.push(
      <>
        Online:{' '}
        {players.slice(0, 5).map((p, i) => {
          const name = p.username ?? p.name ?? 'Unknown';
          const tag = p.clan_tag ? ` [${String(p.clan_tag)}]` : '';
          return (
            <span key={i}>
              {i > 0 ? ', ' : ''}
              {G.player(`${String(name)}${tag}`)}
            </span>
          );
        })}
        {players.length > 5 ? ` (+${players.length - 5} more)` : ''}
      </>,
    );
  }
  return { label: <>Arrived: {G.poi(poi)}</>, lines };
}

function fJump(j: Record<string, unknown>): ResultSummary {
  const from = j.from_system ?? '';
  const to = j.system ?? j.target_system ?? '';
  const xpParts: ReactNode[] = [];
  if (j.exploration_xp) xpParts.push(G.xp('explore', j.exploration_xp));
  if (j.navigation_xp) xpParts.push(G.xp('nav', j.navigation_xp));
  return {
    label: (
      <>
        {from ? (
          <>
            {G.system(from)} → {G.system(to)}
          </>
        ) : (
          <>Jumped to: {G.system(to)}</>
        )}
        {xpParts.length > 0 ? (
          <>
            {' '}
            (
            {xpParts.map((x, i) => (
              <span key={i}>
                {i > 0 ? ', ' : ''}
                {x}
              </span>
            ))}
            )
          </>
        ) : null}
      </>
    ),
    lines: [],
  };
}

function fDock(j: Record<string, unknown>): ResultSummary {
  const base = j.base_name ?? j.base ?? j.station_name ?? j.poi_name ?? '';
  const condition = j.station_condition ?? j.condition;
  const lines: ReactNode[] = [];
  if (j.storage_credits !== undefined || j.storage_items !== undefined) {
    lines.push(
      <>
        Storage: {G.credits(j.storage_credits ?? 0)},{' '}
        {G.dim(String(j.storage_items ?? 0) + ' items')}
      </>,
    );
  }
  return {
    label: (
      <>
        Docked: {G.poi(base)}
        {condition ? <> ({G.dim(condition)})</> : null}
      </>
    ),
    lines,
  };
}

function fLogin(j: Record<string, unknown>): ResultSummary {
  const username = j.username ?? '';
  const lines: ReactNode[] = [];
  const log = j.captains_log as Array<Record<string, unknown>> | undefined;
  if (log && log.length > 0) {
    const firstLine = String(log[0].entry ?? '').split('\n')[0];
    const t = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
    lines.push(
      <>
        Log: <span className="text-zinc-500 italic">{t}</span>
      </>,
    );
  }
  const unread = j.unread_chat as Record<string, number> | undefined;
  if (unread) {
    const entries = Object.entries(unread).filter(([, count]) => count > 0);
    if (entries.length > 0) {
      lines.push(
        <>
          Unread:{' '}
          {entries.map(([ch, count], i) => (
            <span key={ch}>
              {i > 0 ? ', ' : ''}
              {G.channel(ch)}: <span className="text-yellow-400">{count}</span>
            </span>
          ))}
        </>,
      );
    }
  }
  return { label: <>Login OK: {G.player(username)}</>, lines };
}

function fStatus(j: Record<string, unknown>): ResultSummary {
  const player = j.player as Record<string, unknown> | undefined;
  const ship = j.ship as Record<string, unknown> | undefined;
  const name = player?.username ?? j.username ?? '';
  const credits = player?.credits ?? j.credits ?? '';
  const lines: ReactNode[] = [];
  if (ship) {
    lines.push(
      <>
        Ship: {G.ship(ship.class ?? ship.name ?? '?')} | Fuel:{' '}
        {G.fuel(ship.fuel ?? '?', ship.max_fuel ?? '?')} | Cargo:{' '}
        {G.cargo(ship.cargo_used ?? '?', ship.cargo_space ?? '?')}
      </>,
    );
  }
  return {
    label: (
      <>
        {G.player(name)} | {G.credits(credits)}
      </>
    ),
    lines,
  };
}

function fSell(j: Record<string, unknown>): ResultSummary {
  const item = j.item_name ?? j.item_id ?? '';
  const qty = j.quantity ?? '';
  const total = j.total_price ?? j.credits_earned ?? '';
  return {
    label: total ? (
      <>
        Sold {G.item(item)} {G.qty(qty)} for {G.credits(total)}
      </>
    ) : (
      <>
        Sold {G.item(item)} {G.qty(qty)}
      </>
    ),
    lines: [],
  };
}

function fBuy(j: Record<string, unknown>): ResultSummary {
  const item = j.item_name ?? j.item_id ?? '';
  const qty = j.quantity ?? '';
  const total = j.total_price ?? j.credits_spent ?? '';
  return {
    label: total ? (
      <>
        Bought {G.item(item)} {G.qty(qty)} for {G.credits(total)}
      </>
    ) : (
      <>
        Bought {G.item(item)} {G.qty(qty)}
      </>
    ),
    lines: [],
  };
}

function fCraft(j: Record<string, unknown>): ResultSummary {
  const item = j.item_name ?? j.recipe_id ?? '';
  const qty = j.quantity ?? j.count ?? 1;
  return {
    label: (
      <>
        Crafted {G.item(item)} {G.qty(qty)}
      </>
    ),
    lines: [],
  };
}

function fRefuel(j: Record<string, unknown>): ResultSummary {
  const fuel = j.fuel_added ?? j.fuel ?? '';
  const cost = j.cost ?? j.credits_spent ?? '';
  return {
    label: cost ? (
      <>
        Refueled <span className="text-yellow-400">+{String(fuel)}</span> ({G.credits(cost)})
      </>
    ) : (
      <>
        Refueled <span className="text-yellow-400">+{String(fuel)}</span>
      </>
    ),
    lines: [],
  };
}

function fDeposit(j: Record<string, unknown>): ResultSummary {
  const item = j.item_name ?? j.item_id ?? '';
  const qty = j.quantity ?? '';
  return {
    label: (
      <>
        Deposited {G.item(item)} {G.qty(qty)}
      </>
    ),
    lines: [],
  };
}

function fWithdraw(j: Record<string, unknown>): ResultSummary {
  const item = j.item_name ?? j.item_id ?? '';
  const qty = j.quantity ?? '';
  return {
    label: (
      <>
        Withdrew {G.item(item)} {G.qty(qty)}
      </>
    ),
    lines: [],
  };
}

function fNotifications(j: Record<string, unknown>): ResultSummary {
  const count = Number(j.count ?? 0);
  if (count === 0) return { label: G.dim('No notifications'), lines: [] };
  const notifications = j.notifications as Array<Record<string, unknown>> | undefined;
  if (!notifications) {
    return {
      label: (
        <>
          <span className="text-yellow-400">{count}</span> notification(s)
        </>
      ),
      lines: [],
    };
  }
  const lines: ReactNode[] = notifications.slice(0, 5).map((n, i) => {
    const type = String(n.type ?? '');
    const msg = String(n.message ?? n.content ?? JSON.stringify(n));
    const t = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
    return (
      <span key={i}>
        [{G.channel(type)}] {t}
      </span>
    );
  });
  if (notifications.length > 5) lines.push(G.dim(`(+${notifications.length - 5} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> notification(s)
      </>
    ),
    lines,
  };
}

function fChat(j: Record<string, unknown>): ResultSummary {
  const channel = j.channel ?? '';
  const content = String(j.content ?? j.message ?? '');
  return {
    label: (
      <>
        Chat [{G.channel(channel)}]: {content}
      </>
    ),
    lines: [],
  };
}

function fShip(j: Record<string, unknown>): ResultSummary {
  const shipData = (j.ship ?? j) as Record<string, unknown>;
  const classData = j.class as Record<string, unknown> | undefined;
  const cls =
    classData?.name ?? classData?.class ?? shipData.class_id ?? shipData.ship_class ?? '?';
  const fuel = shipData.fuel ?? '?';
  const maxFuel = shipData.max_fuel ?? '?';
  const cargo = shipData.cargo_used ?? j.cargo_used ?? '?';
  const maxCargo = shipData.cargo_capacity ?? j.cargo_max ?? shipData.cargo_space ?? '?';
  return {
    label: (
      <>
        {G.ship(cls)} | Fuel: {G.fuel(fuel, maxFuel)} | Cargo: {G.cargo(cargo, maxCargo)}
      </>
    ),
    lines: [],
  };
}

function fPoi(j: Record<string, unknown>): ResultSummary {
  const poi = j.poi as Record<string, unknown> | undefined;
  const name = poi?.name ?? '';
  const poiType = poi?.type ?? '';
  const lines: ReactNode[] = [];
  const resources = j.resources as Array<Record<string, unknown>> | undefined;
  if (resources && resources.length > 0) {
    for (const r of resources) {
      const rName = r.name ?? r.resource_id ?? '';
      const richness = r.richness ?? '';
      const remaining = r.remaining_display ?? '';
      lines.push(
        <>
          {G.item(rName)} richness:<span className="text-yellow-400">{String(richness)}</span>
          {remaining ? <> ({G.dim(remaining)})</> : null}
        </>,
      );
    }
  }
  return {
    label: (
      <>
        {G.poi(name)}
        {poiType ? <> ({G.dim(poiType)})</> : null}
      </>
    ),
    lines,
  };
}

function fMarket(j: Record<string, unknown>): ResultSummary {
  const base = j.base ?? '';
  const items = j.items as Array<Record<string, unknown>> | undefined;
  const count = items?.length ?? 0;
  const lines: ReactNode[] = [];
  if (items) {
    for (const item of items.slice(0, 8)) {
      const name = item.item_name ?? item.item_id ?? '';
      const bestBuy = item.best_buy as number | undefined;
      const bestSell = item.best_sell as number | undefined;
      lines.push(
        <>
          {G.item(name)}
          {bestSell && bestSell > 0 ? (
            <>
              {' '}
              sell:<span className="text-green-400">{bestSell}cr</span>
            </>
          ) : null}
          {bestBuy && bestBuy > 0 ? (
            <>
              {' '}
              buy:<span className="text-green-300">{bestBuy}cr</span>
            </>
          ) : null}
        </>,
      );
    }
    if (items.length > 8) lines.push(G.dim(`(+${items.length - 8} more)`));
  }
  return {
    label: (
      <>
        {G.poi(base)} ({G.dim(`${count} items`)})
      </>
    ),
    lines,
  };
}

function fSystem(j: Record<string, unknown>): ResultSummary {
  const sys = (j.system ?? j) as Record<string, unknown>;
  const name = sys.name ?? sys.system_name ?? '';
  const emp = sys.empire ?? '';
  const security = sys.security_status ?? sys.police_level ?? '';
  const lines: ReactNode[] = [];
  if (security) lines.push(<>Security: {G.security(security)}</>);
  return {
    label: (
      <>
        System: {G.system(name)}
        {emp ? <> ({G.empire(emp)})</> : null}
      </>
    ),
    lines,
  };
}

function fScan(j: Record<string, unknown>): ResultSummary {
  const target = j.target_name ?? j.target_id ?? '';
  return { label: <>Scanned: {G.player(target)}</>, lines: [] };
}

function fAttack(j: Record<string, unknown>): ResultSummary {
  const target = j.target_name ?? j.target_id ?? '';
  const damage = j.damage ?? '';
  return {
    label: damage ? (
      <>
        Attack → {G.player(target)} ({G.damage(damage)})
      </>
    ) : (
      <>Attack → {G.player(target)}</>
    ),
    lines: [],
  };
}

function fGeneric(j: Record<string, unknown>): ResultSummary {
  if (typeof j.message === 'string') {
    const m = j.message;
    return { label: m.length > 80 ? m.slice(0, 80) + '…' : m, lines: [] };
  }
  if (typeof j.result === 'string') {
    const r = j.result;
    return { label: r.length > 80 ? r.slice(0, 80) + '…' : r, lines: [] };
  }
  const str = JSON.stringify(j);
  if (str.length <= 120) return { label: str, lines: [] };
  const keys = Object.keys(j).slice(0, 5);
  const lines: ReactNode[] = keys.map((k) => (
    <>
      {k}: {String(j[k]).slice(0, 60)}
    </>
  ));
  if (Object.keys(j).length > 5) lines.push(G.dim(`(+${Object.keys(j).length - 5} more fields)`));
  return { label: '', lines };
}

// ─── Content formatter ────────────────────────────────────────────────────────
function formatContent(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SpacemoltToolBlock({
  entry,
  result,
}: {
  entry: ToolCallEntry;
  result?: ToolResultEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const shortName = entry.toolName.slice('mcp__spacemolt__'.length);
  const emoji = getToolEmoji(shortName);
  const action = formatAction(shortName, entry.input);

  const isPending = !result;
  const isError = result?.isError ?? false;
  const summary = result && !isError ? parseResultSummary(shortName, result.content) : null;

  const badgeClass = isPending
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : isError
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-purple-500/10 text-purple-400 border-purple-500/20';

  return (
    <div>
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
      >
        {/* State icon */}
        {isPending ? (
          <span className="shrink-0 w-3 h-3 rounded-full border border-t-amber-400 border-amber-400/20 animate-spin" />
        ) : isError ? (
          <span className="shrink-0 text-red-500">
            <LuX size={16} />
          </span>
        ) : (
          <span className="shrink-0 text-emerald-500">
            <LuCheck size={12} />
          </span>
        )}

        {/* GAME badge */}
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-mono ${badgeClass}`}>
          GAME
        </span>

        {/* Emoji + action */}
        <span className="text-xs font-mono text-zinc-400 truncate min-w-0">
          {emoji} {action}
        </span>

        {/* Timestamp */}
        <span className="text-xs text-zinc-700 font-mono ml-auto shrink-0">
          {entry.timestamp.slice(11, 19)}
        </span>
      </div>

      {/* Collapsed summary */}
      {result && !expanded && (
        <div className="ml-4 mt-0.5 text-xs font-mono">
          {isError ? (
            <div className="text-red-400/60 truncate">{result.content.trim().slice(0, 80)}</div>
          ) : summary ? (
            <>
              <div className="text-zinc-400">{summary.label}</div>
              {summary.lines.map((line, i) => (
                <div key={i} className="text-zinc-500">
                  {line}
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-1.5">
          {/* Summary section (purple) */}
          {summary && (
            <div className="px-3 py-2 rounded-md border bg-purple-500/5 border-purple-500/10">
              <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Summary</div>
              <div className="text-sm font-mono space-y-0.5">
                <div className="text-zinc-300">{summary.label}</div>
                {summary.lines.map((line, i) => (
                  <div key={i} className="text-zinc-500">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div
            className={`px-3 py-2 rounded-md border overflow-x-auto ${
              isPending
                ? 'bg-amber-500/5 border-amber-500/10'
                : isError
                  ? 'bg-red-500/5 border-red-500/10'
                  : 'bg-purple-500/5 border-purple-500/10'
            }`}
          >
            <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Input</div>
            <pre
              className={`text-sm font-mono whitespace-pre-wrap break-words ${
                isPending ? 'text-amber-200/70' : isError ? 'text-red-200/60' : 'text-purple-200/60'
              }`}
            >
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`px-3 py-2 rounded-md border overflow-x-auto ${
                isError ? 'bg-red-500/5 border-red-500/10' : 'bg-purple-500/5 border-purple-500/10'
              }`}
            >
              <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">
                {isError ? 'Error' : 'Result'}
              </div>
              <pre
                className={`text-sm font-mono whitespace-pre-wrap break-words ${
                  isError ? 'text-red-200/60' : 'text-purple-200/60'
                }`}
              >
                {formatContent(result.content)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
