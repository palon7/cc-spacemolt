import type { ReactNode } from 'react';
import { G, type ResultSummary } from './GameText';

export function parseResultSummary(shortName: string, content: string): ResultSummary {
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
    case 'forum_reply':
      return fForumReply(json);
    case 'captains_log_add':
      return fCaptainsLog(json);
    case 'accept_mission':
      return fAcceptMission(json);
    case 'complete_mission':
      return fCompleteMission(json);
    case 'get_missions':
      return fMissions(json);
    case 'get_active_missions':
      return fActiveMissions(json);
    case 'find_route':
      return fRoute(json);
    case 'search_systems':
      return fSearchSystems(json);
    case 'get_cargo':
      return fCargo(json);
    case 'estimate_purchase':
      return fEstimate(json);
    case 'faction_info':
      return fFactionInfo(json);
    case 'faction_list':
      return fFactionList(json);
    case 'forum_list':
      return fForumList(json);
    case 'forum_get_thread':
      return fForumThread(json);
    case 'buy_insurance':
      return fBuyInsurance(json);
    case 'get_insurance_quote':
      return fInsuranceQuote(json);
    case 'shipyard_showroom':
      return fShipyard(json);
    case 'get_chat_history':
      return fChatHistory(json);
    case 'get_commands':
      return fCommands(json);
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

function fForumReply(j: Record<string, unknown>): ResultSummary {
  const msg = typeof j.message === 'string' ? j.message : 'Reply posted';
  return { label: msg.length > 80 ? msg.slice(0, 80) + '…' : msg, lines: [] };
}

function fCaptainsLog(j: Record<string, unknown>): ResultSummary {
  const at = typeof j.created_at === 'string' ? ` (${j.created_at})` : '';
  return { label: <>Log entry added{G.dim(at)}</>, lines: [] };
}

function fAcceptMission(j: Record<string, unknown>): ResultSummary {
  const title = String(j.title ?? j.mission_id ?? 'Mission');
  const type = String(j.type ?? '');
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
  const msg = typeof j.message === 'string' ? j.message : 'Mission completed';
  return { label: msg.length > 80 ? msg.slice(0, 80) + '…' : msg, lines: [] };
}

function fMissions(j: Record<string, unknown>): ResultSummary {
  const missions = j.missions as Array<Record<string, unknown>> | undefined;
  const count = missions?.length ?? 0;
  const lines: ReactNode[] = (missions ?? []).slice(0, 3).map((m, i) => {
    const title = String(m.title ?? m.mission_id ?? '');
    const diff = m.difficulty !== undefined ? ` [diff:${String(m.difficulty)}]` : '';
    return (
      <span key={i}>
        {title}
        {G.dim(diff)}
      </span>
    );
  });
  if (count > 3) lines.push(G.dim(`(+${count - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> mission(s)
      </>
    ),
    lines,
  };
}

function fActiveMissions(j: Record<string, unknown>): ResultSummary {
  const missions = j.missions as Array<Record<string, unknown>> | undefined;
  const count = missions?.length ?? 0;
  const lines: ReactNode[] = (missions ?? []).slice(0, 3).map((m, i) => {
    const title = String(m.title ?? m.mission_id ?? '');
    const progress = (m.progress as Record<string, unknown> | undefined)?.percent_complete;
    const pct = progress !== undefined ? ` ${String(progress)}%` : '';
    return (
      <span key={i}>
        {title}
        {G.dim(pct)}
      </span>
    );
  });
  if (count > 3) lines.push(G.dim(`(+${count - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> active mission(s)
      </>
    ),
    lines,
  };
}

function fRoute(j: Record<string, unknown>): ResultSummary {
  const found = j.found as boolean | undefined;
  if (!found) return { label: G.dim('No route found'), lines: [] };
  const route = j.route as Array<Record<string, unknown>> | undefined;
  const hops = route?.length ?? 0;
  const dest = route && route.length > 0 ? String(route[route.length - 1].name ?? '') : '';
  const lines: ReactNode[] = (route ?? []).slice(0, 5).map((s, i) => (
    <span key={i}>
      {i > 0 ? '→ ' : ''}
      {G.system(s.name ?? s.system_id ?? '')}
    </span>
  ));
  if (hops > 5) lines.push(G.dim(`(+${hops - 5} more)`));
  return {
    label: (
      <>
        Route to {G.system(dest)} ({G.dim(`${hops} hops`)})
      </>
    ),
    lines,
  };
}

function fSearchSystems(j: Record<string, unknown>): ResultSummary {
  const systems = j.systems as Array<Record<string, unknown>> | undefined;
  const total = j.total_found ?? systems?.length ?? 0;
  const lines: ReactNode[] = (systems ?? []).slice(0, 5).map((s, i) => {
    const name = String(s.name ?? s.system_id ?? '');
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
  const cargo = j.cargo as Array<Record<string, unknown>> | undefined;
  const lines: ReactNode[] = (cargo ?? []).slice(0, 5).map((c, i) => {
    const name = String(c.name ?? c.item_id ?? '');
    const qty = c.quantity;
    return (
      <span key={i}>
        {G.item(name)}
        {qty !== undefined ? <> {G.qty(qty)}</> : null}
      </span>
    );
  });
  if ((cargo?.length ?? 0) > 5) lines.push(G.dim(`(+${(cargo?.length ?? 0) - 5} more)`));
  return { label: <>Cargo: {G.cargo(used, capacity)}</>, lines };
}

function fEstimate(j: Record<string, unknown>): ResultSummary {
  const total = j.total_price ?? j.estimated_cost ?? j.cost;
  if (total !== undefined) return { label: <>Estimated: {G.credits(total)}</>, lines: [] };
  return fGeneric(j);
}

function fFactionInfo(j: Record<string, unknown>): ResultSummary {
  const faction = (j.faction ?? j) as Record<string, unknown>;
  const name = String(faction.name ?? j.name ?? '');
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
  const factions = j.factions as Array<Record<string, unknown>> | undefined;
  const count = factions?.length ?? 0;
  const lines: ReactNode[] = (factions ?? []).slice(0, 5).map((f, i) => {
    const name = String(f.name ?? '');
    const tag = f.tag ? ` [${String(f.tag)}]` : '';
    return (
      <span key={i}>
        {G.player(name)}
        {G.dim(tag)}
      </span>
    );
  });
  if (count > 5) lines.push(G.dim(`(+${count - 5} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> faction(s)
      </>
    ),
    lines,
  };
}

function fForumList(j: Record<string, unknown>): ResultSummary {
  const threads = j.threads as Array<Record<string, unknown>> | undefined;
  const count = threads?.length ?? 0;
  const lines: ReactNode[] = (threads ?? []).slice(0, 3).map((t, i) => {
    const title = String(t.title ?? '');
    const author = t.author ? ` — ${String(t.author)}` : '';
    return (
      <span key={i}>
        {title.length > 50 ? title.slice(0, 50) + '…' : title}
        {G.dim(author)}
      </span>
    );
  });
  if (count > 3) lines.push(G.dim(`(+${count - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> thread(s)
      </>
    ),
    lines,
  };
}

function fForumThread(j: Record<string, unknown>): ResultSummary {
  const replies = j.replies as Array<Record<string, unknown>> | undefined;
  const count = replies?.length ?? 0;
  const lines: ReactNode[] = (replies ?? []).slice(0, 3).map((r, i) => {
    const author = String(r.author ?? '');
    const content = String(r.content ?? '');
    const preview = content.length > 50 ? content.slice(0, 50) + '…' : content;
    return (
      <span key={i}>
        {G.player(author)}: {G.dim(preview)}
      </span>
    );
  });
  if (count > 3) lines.push(G.dim(`(+${count - 3} more)`));
  return {
    label: (
      <>
        <span className="text-yellow-400">{count}</span> reply(s)
      </>
    ),
    lines,
  };
}

function fBuyInsurance(j: Record<string, unknown>): ResultSummary {
  const premium = j.premium;
  const coverage = j.coverage;
  const lines: ReactNode[] = [];
  const riskScore = j.risk_score;
  if (riskScore !== undefined) lines.push(<>Risk score: {G.dim(riskScore)}</>);
  return {
    label: (
      <>
        Premium: {G.credits(premium ?? '?')} | Coverage: {G.credits(coverage ?? '?')}
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
  const baseName = String(j.base_name ?? j.base_id ?? '');
  const ships = j.ships as Array<Record<string, unknown>> | undefined;
  const count = j.count ?? ships?.length ?? 0;
  const lines: ReactNode[] = (ships ?? []).slice(0, 5).map((s, i) => {
    const cls = String(s.class_name ?? s.class_id ?? s.name ?? '');
    const price = s.price;
    return (
      <span key={i}>
        {G.ship(cls)}
        {price !== undefined ? <> {G.credits(price)}</> : null}
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
  const messages = j.messages as Array<Record<string, unknown>> | undefined;
  const total = j.total_count ?? messages?.length ?? 0;
  const lines: ReactNode[] = (messages ?? []).slice(0, 3).map((m, i) => {
    const from = String(m.from ?? m.username ?? m.sender ?? '');
    const content = String(m.content ?? m.message ?? m.text ?? '');
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
  const commands = j.commands as Array<Record<string, unknown>> | undefined;
  const count = commands?.length ?? 0;
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
