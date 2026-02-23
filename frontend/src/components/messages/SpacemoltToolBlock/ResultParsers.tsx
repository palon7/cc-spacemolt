import type { ReactNode } from 'react';
import { G, type ResultSummary } from './GameText';

// Runtime-checked accessors — avoid `as` casts throughout parsers
function asArr(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

// Dispatch table: shortName → parser
const PARSERS: Record<string, (j: Record<string, unknown>) => ResultSummary> = {
  mine: fMine,
  travel: fTravel,
  jump: fJump,
  dock: fDock,
  undock: () => ({ label: 'Undocked', lines: [] }),
  login: fLogin,
  get_status: fStatus,
  sell: fSell,
  buy: fBuy,
  craft: fCraft,
  refuel: fRefuel,
  deposit_items: fDeposit,
  withdraw_items: fWithdraw,
  get_notifications: fNotifications,
  chat: fChat,
  get_ship: fShip,
  get_poi: fPoi,
  view_market: fMarket,
  get_system: fSystem,
  scan: fScan,
  attack: fAttack,
  forum_reply: fForumReply,
  captains_log_add: fCaptainsLog,
  accept_mission: fAcceptMission,
  complete_mission: fCompleteMission,
  get_missions: fMissions,
  get_active_missions: fActiveMissions,
  find_route: fRoute,
  search_systems: fSearchSystems,
  get_cargo: fCargo,
  estimate_purchase: fEstimate,
  faction_info: fFactionInfo,
  faction_list: fFactionList,
  forum_list: fForumList,
  forum_get_thread: fForumThread,
  buy_insurance: fBuyInsurance,
  get_insurance_quote: fInsuranceQuote,
  shipyard_showroom: fShipyard,
  get_chat_history: fChatHistory,
  get_commands: fCommands,
};

export function parseResultSummary(shortName: string, content: string): ResultSummary {
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  if (json) return (PARSERS[shortName] ?? fGeneric)(json);

  const textLines = content.split('\n').filter((l) => l.trim());
  if (textLines.length <= 3) return { label: '', lines: textLines };
  return { label: '', lines: [...textLines.slice(0, 3), `(+${textLines.length - 3} more lines)`] };
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
  const players = asArr(j.online_players);
  const lines: ReactNode[] = [];
  if (players.length > 0) {
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
  const log = asArr(j.captains_log);
  if (log.length > 0) {
    const firstLine = asStr(log[0].entry).split('\n')[0];
    const t = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
    lines.push(
      <>
        Log: <span className="text-zinc-500 italic">{t}</span>
      </>,
    );
  }
  const unread = asObj(j.unread_chat) as Record<string, number>;
  const unreadEntries = Object.entries(unread).filter(([, count]) => count > 0);
  if (unreadEntries.length > 0) {
    lines.push(
      <>
        Unread:{' '}
        {unreadEntries.map(([ch, count], i) => (
          <span key={ch}>
            {i > 0 ? ', ' : ''}
            {G.channel(ch)}: <span className="text-yellow-400">{count}</span>
          </span>
        ))}
      </>,
    );
  }
  return { label: <>Login OK: {G.player(username)}</>, lines };
}

function fStatus(j: Record<string, unknown>): ResultSummary {
  const player = asObj(j.player);
  const ship = asObj(j.ship);
  const name = player.username ?? j.username ?? '';
  const credits = player.credits ?? j.credits ?? '';
  const lines: ReactNode[] = [];
  if (j.ship !== undefined) {
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
  const notifications = asArr(j.notifications);
  if (notifications.length === 0) {
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
    const type = asStr(n.type);
    const msg = asStr(n.message ?? n.content, JSON.stringify(n));
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
  const content = asStr(j.content ?? j.message);
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
  const shipData = asObj(j.ship ?? j);
  const classData = asObj(j.class);
  const cls = classData.name ?? classData.class ?? shipData.class_id ?? shipData.ship_class ?? '?';
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
  const poi = asObj(j.poi);
  const name = poi.name ?? '';
  const poiType = poi.type ?? '';
  const resources = asArr(j.resources);
  const lines: ReactNode[] = resources.map((r, i) => {
    const rName = r.name ?? r.resource_id ?? '';
    const richness = r.richness ?? '';
    const remaining = r.remaining_display ?? '';
    return (
      <span key={i}>
        {G.item(rName)} richness:<span className="text-yellow-400">{String(richness)}</span>
        {remaining ? <> ({G.dim(remaining)})</> : null}
      </span>
    );
  });
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
  const items = asArr(j.items);
  const lines: ReactNode[] = items.slice(0, 8).map((item, i) => {
    const name = item.item_name ?? item.item_id ?? '';
    const bestBuy = typeof item.best_buy === 'number' ? item.best_buy : undefined;
    const bestSell = typeof item.best_sell === 'number' ? item.best_sell : undefined;
    return (
      <span key={i}>
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
      </span>
    );
  });
  if (items.length > 8) lines.push(G.dim(`(+${items.length - 8} more)`));
  return {
    label: (
      <>
        {G.poi(base)} ({G.dim(`${items.length} items`)})
      </>
    ),
    lines,
  };
}

function fSystem(j: Record<string, unknown>): ResultSummary {
  const sys = asObj(j.system ?? j);
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

function fForumReply(j: Record<string, unknown>): ResultSummary {
  const msg = asStr(j.message, 'Reply posted');
  return { label: msg.length > 80 ? msg.slice(0, 80) + '…' : msg, lines: [] };
}

function fCaptainsLog(j: Record<string, unknown>): ResultSummary {
  const at = typeof j.created_at === 'string' ? ` (${j.created_at})` : '';
  return { label: <>Log entry added{G.dim(at)}</>, lines: [] };
}

function fAcceptMission(j: Record<string, unknown>): ResultSummary {
  const title = asStr(j.title ?? j.mission_id, 'Mission');
  const type = asStr(j.type);
  return {
    label: (
      <>
        {title}
        {type ? <> ({G.dim(type)})</> : null}
      </>
    ),
    lines: [],
  };
}

function fCompleteMission(j: Record<string, unknown>): ResultSummary {
  const msg = asStr(j.message, 'Mission completed');
  return { label: msg.length > 80 ? msg.slice(0, 80) + '…' : msg, lines: [] };
}

function fMissions(j: Record<string, unknown>): ResultSummary {
  const missions = asArr(j.missions);
  const lines: ReactNode[] = missions.slice(0, 3).map((m, i) => {
    const title = asStr(m.title ?? m.mission_id);
    const diff = m.difficulty !== undefined ? ` [diff:${String(m.difficulty)}]` : '';
    return (
      <span key={i}>
        {title}
        {G.dim(diff)}
      </span>
    );
  });
  if (missions.length > 3) lines.push(G.dim(`(+${missions.length - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{missions.length}</span> mission(s)
      </>
    ),
    lines,
  };
}

function fActiveMissions(j: Record<string, unknown>): ResultSummary {
  const missions = asArr(j.missions);
  const lines: ReactNode[] = missions.slice(0, 3).map((m, i) => {
    const title = asStr(m.title ?? m.mission_id);
    const progress = asObj(m.progress).percent_complete;
    const pct = progress !== undefined ? ` ${String(progress)}%` : '';
    return (
      <span key={i}>
        {title}
        {G.dim(pct)}
      </span>
    );
  });
  if (missions.length > 3) lines.push(G.dim(`(+${missions.length - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{missions.length}</span> active mission(s)
      </>
    ),
    lines,
  };
}

function fRoute(j: Record<string, unknown>): ResultSummary {
  if (!j.found) return { label: G.dim('No route found'), lines: [] };
  const route = asArr(j.route);
  const dest = route.length > 0 ? asStr(route[route.length - 1].name) : '';
  const lines: ReactNode[] = route.slice(0, 5).map((s, i) => (
    <span key={i}>
      {i > 0 ? '→ ' : ''}
      {G.system(s.name ?? s.system_id ?? '')}
    </span>
  ));
  if (route.length > 5) lines.push(G.dim(`(+${route.length - 5} more)`));
  return {
    label: (
      <>
        Route to {G.system(dest)} ({G.dim(`${route.length} hops`)})
      </>
    ),
    lines,
  };
}

function fSearchSystems(j: Record<string, unknown>): ResultSummary {
  const systems = asArr(j.systems);
  const total = j.total_found ?? systems.length;
  const lines: ReactNode[] = systems.slice(0, 5).map((s, i) => {
    const name = asStr(s.name ?? s.system_id);
    const emp = s.empire ? ` (${String(s.empire)})` : '';
    return (
      <span key={i}>
        {G.system(name)}
        {G.dim(emp)}
      </span>
    );
  });
  return {
    label: (
      <>
        <span className="text-yellow-400">{String(total)}</span> system(s) found
      </>
    ),
    lines,
  };
}

function fCargo(j: Record<string, unknown>): ResultSummary {
  const used = j.used ?? '?';
  const capacity = j.capacity ?? '?';
  const cargo = asArr(j.cargo);
  const lines: ReactNode[] = cargo.slice(0, 5).map((c, i) => {
    const name = asStr(c.name ?? c.item_id);
    const qty = c.quantity;
    return (
      <span key={i}>
        {G.item(name)}
        {qty !== undefined ? <> {G.qty(qty)}</> : null}
      </span>
    );
  });
  if (cargo.length > 5) lines.push(G.dim(`(+${cargo.length - 5} more)`));
  return { label: <>Cargo: {G.cargo(used, capacity)}</>, lines };
}

function fEstimate(j: Record<string, unknown>): ResultSummary {
  const total = j.total_price ?? j.estimated_cost ?? j.cost;
  if (total !== undefined) return { label: <>Estimated: {G.credits(total)}</>, lines: [] };
  return fGeneric(j);
}

function fFactionInfo(j: Record<string, unknown>): ResultSummary {
  const faction = asObj(j.faction ?? j);
  const name = asStr(faction.name ?? j.name);
  const tag = faction.tag ? ` [${String(faction.tag)}]` : '';
  const leader = faction.leader_username ?? faction.leader;
  const members = faction.member_count;
  const lines: ReactNode[] = [];
  if (leader) lines.push(<>Leader: {G.player(leader)}</>);
  if (members !== undefined)
    lines.push(
      <>
        Members: <span className="text-yellow-400">{String(members)}</span>
      </>,
    );
  return {
    label: (
      <>
        {G.player(name)}
        {G.dim(tag)}
      </>
    ),
    lines,
  };
}

function fFactionList(j: Record<string, unknown>): ResultSummary {
  const factions = asArr(j.factions);
  const lines: ReactNode[] = factions.slice(0, 5).map((f, i) => {
    const name = asStr(f.name);
    const tag = f.tag ? ` [${String(f.tag)}]` : '';
    return (
      <span key={i}>
        {G.player(name)}
        {G.dim(tag)}
      </span>
    );
  });
  if (factions.length > 5) lines.push(G.dim(`(+${factions.length - 5} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{factions.length}</span> faction(s)
      </>
    ),
    lines,
  };
}

function fForumList(j: Record<string, unknown>): ResultSummary {
  const threads = asArr(j.threads);
  const lines: ReactNode[] = threads.slice(0, 3).map((t, i) => {
    const title = asStr(t.title);
    const author = t.author ? ` — ${String(t.author)}` : '';
    return (
      <span key={i}>
        {title.length > 50 ? title.slice(0, 50) + '…' : title}
        {G.dim(author)}
      </span>
    );
  });
  if (threads.length > 3) lines.push(G.dim(`(+${threads.length - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{threads.length}</span> thread(s)
      </>
    ),
    lines,
  };
}

function fForumThread(j: Record<string, unknown>): ResultSummary {
  const replies = asArr(j.replies);
  const lines: ReactNode[] = replies.slice(0, 3).map((r, i) => {
    const author = asStr(r.author);
    const content = asStr(r.content);
    const preview = content.length > 50 ? content.slice(0, 50) + '…' : content;
    return (
      <span key={i}>
        {G.player(author)}: {G.dim(preview)}
      </span>
    );
  });
  if (replies.length > 3) lines.push(G.dim(`(+${replies.length - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{replies.length}</span> reply(s)
      </>
    ),
    lines,
  };
}

function fBuyInsurance(j: Record<string, unknown>): ResultSummary {
  const lines: ReactNode[] = [];
  if (j.risk_score !== undefined) lines.push(<>Risk score: {G.dim(j.risk_score)}</>);
  return {
    label: (
      <>
        Premium: {G.credits(j.premium ?? '?')} | Coverage: {G.credits(j.coverage ?? '?')}
      </>
    ),
    lines,
  };
}

function fInsuranceQuote(j: Record<string, unknown>): ResultSummary {
  const premium = j.premium ?? j.estimated_premium;
  const coverage = j.coverage ?? j.estimated_coverage;
  if (premium !== undefined || coverage !== undefined) {
    return {
      label: (
        <>
          Premium: {G.credits(premium ?? '?')} | Coverage: {G.credits(coverage ?? '?')}
        </>
      ),
      lines: [],
    };
  }
  return fGeneric(j);
}

function fShipyard(j: Record<string, unknown>): ResultSummary {
  const baseName = asStr(j.base_name ?? j.base_id);
  const ships = asArr(j.ships);
  const count = j.count ?? ships.length;
  const lines: ReactNode[] = ships.slice(0, 5).map((s, i) => {
    const cls = asStr(s.class_name ?? s.class_id ?? s.name);
    return (
      <span key={i}>
        {G.ship(cls)}
        {s.price !== undefined ? <> {G.credits(s.price)}</> : null}
      </span>
    );
  });
  return {
    label: (
      <>
        {G.poi(baseName)} ({G.dim(`${String(count)} ships`)})
      </>
    ),
    lines,
  };
}

function fChatHistory(j: Record<string, unknown>): ResultSummary {
  const messages = asArr(j.messages);
  const total = j.total_count ?? messages.length;
  const lines: ReactNode[] = messages.slice(0, 3).map((m, i) => {
    const from = asStr(m.from ?? m.username ?? m.sender);
    const content = asStr(m.content ?? m.message ?? m.text);
    const preview = content.length > 50 ? content.slice(0, 50) + '…' : content;
    return (
      <span key={i}>
        {from ? <>{G.player(from)}: </> : null}
        {G.dim(preview)}
      </span>
    );
  });
  if (Number(total) > 3) lines.push(G.dim(`(+${Number(total) - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{String(total)}</span> message(s)
      </>
    ),
    lines,
  };
}

function fCommands(j: Record<string, unknown>): ResultSummary {
  const count = asArr(j.commands).length;
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> commands
      </>
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
