import type { ReactNode } from 'react';
import { G } from './GameText';

function itemQtyNode(id: unknown, qty: unknown): ReactNode {
  return qty !== undefined ? (
    <>
      {G.item(id)} {G.qty(qty)}
    </>
  ) : (
    <>{G.item(id)}</>
  );
}

export function formatActionDetail(
  shortName: string,
  input: Record<string, unknown>,
): ReactNode | null {
  const itemId = input.item_id ?? input.item_name ?? '';
  const qty = input.quantity;

  switch (shortName) {
    case 'travel':
      return <>→ {G.poi(input.target_poi ?? '')}</>;
    case 'jump':
      return <>→ {G.system(input.target_system ?? '')}</>;
    case 'sell':
    case 'buy':
      return itemQtyNode(itemId, qty);
    case 'craft': {
      const recipe = input.recipe_id ?? itemId;
      return itemQtyNode(recipe, qty);
    }
    case 'deposit_items':
    case 'withdraw_items':
      return itemQtyNode(itemId, qty);
    case 'chat': {
      const ch = input.channel ?? '';
      const msg = String(input.content ?? input.message ?? '');
      return (
        <>
          [{G.channel(ch)}]: {msg.length > 40 ? msg.slice(0, 40) + '…' : msg}
        </>
      );
    }
    case 'view_market': {
      const mItem = input.item_id;
      return mItem ? <>{G.item(mItem)}</> : null;
    }
    case 'scan':
      return <>{G.player(input.target_id ?? input.target_name ?? '')}</>;
    case 'attack':
      return <>→ {G.player(input.target_id ?? input.target_name ?? '')}</>;
    case 'forum_reply': {
      const msg = String(input.content ?? input.message ?? '');
      return msg.length > 40 ? <>{msg.slice(0, 40)}…</> : <>{msg}</>;
    }
    case 'captains_log_add': {
      const entry = String(input.entry ?? '').split('\n')[0];
      return entry.length > 40 ? <>{entry.slice(0, 40)}…</> : <>{entry}</>;
    }
    case 'accept_mission':
    case 'complete_mission':
      return <>{G.dim(input.mission_id ?? '')}</>;
    case 'find_route':
      return <>→ {G.system(input.target_system ?? '')}</>;
    case 'search_systems':
      return <>{G.dim(input.query ?? '')}</>;
    case 'create_buy_order':
    case 'create_sell_order': {
      const ordItem = input.item_id ?? '';
      const ordQty = input.quantity;
      return ordQty !== undefined ? (
        <>
          {G.item(ordItem)} {G.qty(ordQty)} @ {G.credits(input.price_each ?? '?')}
        </>
      ) : (
        <>{G.item(ordItem)}</>
      );
    }
    case 'estimate_purchase': {
      const estItem = input.item_id ?? '';
      return itemQtyNode(estItem, input.quantity);
    }
    case 'withdraw_credits':
      return <>{G.credits(input.amount ?? '')}</>;
    case 'faction_info':
      return <>{G.dim(input.faction_tag ?? input.faction_id ?? '')}</>;
    case 'forum_get_thread': {
      const tid = String(input.thread_id ?? '');
      return <>{G.dim(tid.slice(0, 8))}</>;
    }
    case 'get_chat_history': {
      const ch = input.channel ?? '';
      return <>[{G.channel(ch)}]</>;
    }
    case 'get_guide': {
      const topic = input.topic;
      return topic ? <>{G.dim(topic)}</> : null;
    }
    default: {
      const filtered = Object.entries(input).filter(([k]) => k !== 'session_id');
      if (filtered.length === 0) return null;
      return filtered
        .slice(0, 3)
        .map(([k, v]) => {
          if (k === 'password') return `${k}: ****`;
          const json = typeof v === 'string' ? v : JSON.stringify(v);
          const val = json ?? String(v ?? '');
          return `${k}: ${val.slice(0, 30)}`;
        })
        .join(', ');
    }
  }
}

export function formatContent(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
