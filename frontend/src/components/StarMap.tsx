import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState, TravelHistoryEntry } from '@cc-spacemolt/shared';
import { useMapData, resolveSystem, type MapData } from '../hooks/useMapData';

// ── display constants ────────────────────────────────────────────────
const BG_COLOR = '#0a0a12';
const EDGE_COLOR = 'rgba(70, 90, 130, 0.12)';
const EDGE_WIDTH = 1;

const NODE_RADIUS = 2;
const NODE_RADIUS_STATION = 2.5;
const NODE_RADIUS_CURRENT = 4;
const NODE_RADIUS_DEST = 3;
const NODE_COLOR_DEFAULT = '#2a3550';
const NODE_COLOR_CURRENT = '#00ff88';
const NODE_COLOR_DEST = '#cc44ff';

const TRAVEL_LINE_COLOR = 'rgba(0, 200, 255, 0.35)';
const TRAVEL_LINE_WIDTH = 1.5;
const TRAVEL_DOT_COLOR = '#ff8c00';
const TRAVEL_DOT_RADIUS = 3;

const LABEL_FONT = "'JetBrains Mono', monospace";
const LABEL_RANGE_PX = 200;
const LABEL_ZOOM_THRESHOLD = 0.08;

const LERP_SPEED = 0.08;
const GLOW_SPEED = 0.03;

const INITIAL_ZOOM = 0.12;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 2;
const ZOOM_FACTOR = 1.15;

interface StarMapProps {
  gameState: GameState;
  travelHistory: TravelHistoryEntry[];
}

export function StarMap({ gameState, travelHistory }: StarMapProps) {
  const { data: mapData } = useMapData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const animTarget = useRef<{ x: number; y: number } | null>(null);
  const animCurrent = useRef<{ x: number; y: number } | null>(null);
  const zoom = useRef(INITIAL_ZOOM);
  const glowPhase = useRef(0);
  const rafId = useRef(0);
  const canvasSize = useRef({ w: 0, h: 0 });
  const prevSystem = useRef<string | null>(null);

  // Drag state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartCenter = useRef({ x: 0, y: 0 });
  const [tracking, setTracking] = useState(true); // auto-follow current system
  const trackingRef = useRef(true);
  trackingRef.current = tracking;

  const [showHistory, setShowHistory] = useState(true);
  const showHistoryRef = useRef(true);
  showHistoryRef.current = showHistory;

  const travelHistoryRef = useRef(travelHistory);
  travelHistoryRef.current = travelHistory;

  const routeCountsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!mapData) return;
    const counts = new Map<string, number>();
    for (const entry of travelHistory) {
      const a = resolveSystem(mapData, entry.from);
      const b = resolveSystem(mapData, entry.to);
      if (!a || !b) continue;
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    routeCountsRef.current = counts;
  }, [travelHistory, mapData]);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const mapDataRef = useRef<MapData | null>(null);
  mapDataRef.current = mapData;

  // ── ResizeObserver ──────────────────────────────────────────────────
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvasSize.current = { w: canvas.width, h: canvas.height };
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapData]);

  // ── Update animation target on system change ───────────────────────
  useEffect(() => {
    if (!mapData) return;
    const currentName = gameState.player.current_system;
    const sys = resolveSystem(mapData, currentName);
    if (!sys) return;

    const target = { x: sys.x, y: sys.y };

    if (!animCurrent.current || prevSystem.current === null) {
      animCurrent.current = { ...target };
    }
    // Only auto-follow if tracking is enabled
    if (trackingRef.current) {
      animTarget.current = target;
    }
    prevSystem.current = currentName;
  }, [gameState.player.current_system, mapData]);

  // ── Re-center handler ──────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    const md = mapDataRef.current;
    const gs = gameStateRef.current;
    if (!md) return;
    const sys = resolveSystem(md, gs.player.current_system);
    if (!sys) return;
    animTarget.current = { x: sys.x, y: sys.y };
    setTracking(true);
  }, []);

  // ── Drag + wheel ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current * factor));
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragStartCenter.current = {
        x: animCurrent.current?.x ?? 0,
        y: animCurrent.current?.y ?? 0,
      };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const z = zoom.current;
      const newCenter = {
        x: dragStartCenter.current.x - dx / z,
        y: dragStartCenter.current.y - dy / z,
      };
      animCurrent.current = newCenter;
      animTarget.current = newCenter;
      // Stop auto-tracking once user drags
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setTracking(false);
      }
    };

    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        canvas.style.cursor = 'grab';
      }
    };

    // ── Touch events ──────────────────────────────────────────────
    let pinchStartDist = 0;
    let pinchStartZoom = 0;

    const getTouchDist = (t: TouchList) =>
      Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging.current = true;
        dragStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        dragStartCenter.current = {
          x: animCurrent.current?.x ?? 0,
          y: animCurrent.current?.y ?? 0,
        };
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        pinchStartDist = getTouchDist(e.touches);
        pinchStartZoom = zoom.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0]!.clientX - dragStart.current.x;
        const dy = e.touches[0]!.clientY - dragStart.current.y;
        const z = zoom.current;
        const newCenter = {
          x: dragStartCenter.current.x - dx / z,
          y: dragStartCenter.current.y - dy / z,
        };
        animCurrent.current = newCenter;
        animTarget.current = newCenter;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          setTracking(false);
        }
      } else if (e.touches.length === 2 && pinchStartDist > 0) {
        const dist = getTouchDist(e.touches);
        const scale = dist / pinchStartDist;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom * scale));

        // Zoom towards the midpoint between the two fingers so the pinched
        // world position stays fixed under the user's fingers.
        const rect = canvas.getBoundingClientRect();
        const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left;
        const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top;
        const halfW = rect.width / 2;
        const halfH = rect.height / 2;
        // Offset of the pinch midpoint from the canvas centre (CSS px)
        const dx = midX - halfW;
        const dy = midY - halfH;
        const currentCenter = animCurrent.current ?? { x: 0, y: 0 };
        // World-space coordinates under the pinch midpoint (at old zoom)
        const worldX = dx / zoom.current + currentCenter.x;
        const worldY = dy / zoom.current + currentCenter.y;
        // Shift the camera so that world point stays under the pinch midpoint
        zoom.current = newZoom;
        animCurrent.current = { x: worldX - dx / newZoom, y: worldY - dy / newZoom };
        animTarget.current = { ...animCurrent.current };
        setTracking(false);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isDragging.current = false;
        pinchStartDist = 0;
      } else if (e.touches.length === 1) {
        // Transition from pinch back to single-finger drag
        isDragging.current = true;
        dragStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        dragStartCenter.current = {
          x: animCurrent.current?.x ?? 0,
          y: animCurrent.current?.y ?? 0,
        };
        pinchStartDist = 0;
      }
    };

    // Reset all touch state when the interaction is interrupted (incoming call, etc.)
    const onTouchCancel = () => {
      isDragging.current = false;
      pinchStartDist = 0;
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel, { passive: true });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [mapData]);

  // ── Main render loop ───────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const md = mapDataRef.current;
      const gs = gameStateRef.current;
      const canvas = canvasRef.current;
      if (!md || !canvas) {
        rafId.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId.current = requestAnimationFrame(loop);
        return;
      }

      // Interpolate pan (only when not dragging)
      if (!isDragging.current && animCurrent.current && animTarget.current) {
        const dx = animTarget.current.x - animCurrent.current.x;
        const dy = animTarget.current.y - animCurrent.current.y;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          animCurrent.current.x += dx * LERP_SPEED;
          animCurrent.current.y += dy * LERP_SPEED;
        } else {
          animCurrent.current.x = animTarget.current.x;
          animCurrent.current.y = animTarget.current.y;
        }
      }

      glowPhase.current += GLOW_SPEED;
      draw(ctx, md, gs);
      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return (
    <div ref={containerCallbackRef} className="w-full h-full relative overflow-hidden">
      {!mapData ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-600">
          Loading map...
        </div>
      ) : null}
      <canvas ref={canvasRef} className="block w-full h-full" style={{ touchAction: 'none' }} />
      <button
        onClick={() => setShowHistory((v) => !v)}
        className={`absolute bottom-1.5 ${!tracking ? 'right-14' : 'right-1.5'} p-1 rounded bg-zinc-800/80 border border-zinc-700/50 hover:bg-zinc-700/80 transition-colors ${showHistory ? 'text-orange-400' : 'text-zinc-600'}`}
        title={showHistory ? 'Hide travel history' : 'Show travel history'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 17 8 12 13 17 18 7 21 12" />
        </svg>
      </button>
      {!tracking && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] rounded bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 transition-colors"
          title="Center on current system"
        >
          Re-center
        </button>
      )}
    </div>
  );

  // ── Drawing function ───────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D, md: MapData, gs: GameState): void {
    const { w: W, h: H } = canvasSize.current;
    if (W === 0 || H === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cw = W / dpr;
    const ch = H / dpr;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    const centerX = animCurrent.current?.x ?? 0;
    const centerY = animCurrent.current?.y ?? 0;
    const z = zoom.current;

    const toScreen = (wx: number, wy: number): [number, number] => [
      (wx - centerX) * z + cw / 2,
      (wy - centerY) * z + ch / 2,
    ];

    const margin = 40;
    const inView = (sx: number, sy: number) =>
      sx > -margin && sx < cw + margin && sy > -margin && sy < ch + margin;

    const currentSys = resolveSystem(md, gs.player.current_system);
    const destSys = gs.travel_destination ? resolveSystem(md, gs.travel_destination) : null;

    // ── Edges ──────────────────────────────────────────────────────
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = EDGE_WIDTH;
    const drawnEdges = new Set<string>();

    for (const sys of md.systems) {
      const [ax, ay] = toScreen(sys.x, sys.y);
      for (const cid of sys.connections) {
        const key = sys.id < cid ? `${sys.id}:${cid}` : `${cid}:${sys.id}`;
        if (drawnEdges.has(key)) continue;
        drawnEdges.add(key);

        const other = md.byId.get(cid);
        if (!other) continue;

        const [bx, by] = toScreen(other.x, other.y);
        if (!inView(ax, ay) && !inView(bx, by)) continue;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    // ── Travel history routes ──────────────────────────────────────
    if (showHistoryRef.current && routeCountsRef.current.size > 0) {
      ctx.lineWidth = 2;
      for (const [key, count] of routeCountsRef.current) {
        const [idA, idB] = key.split(':');
        const sysA = md.byId.get(idA!);
        const sysB = md.byId.get(idB!);
        if (!sysA || !sysB) continue;
        const [ax, ay] = toScreen(sysA.x, sysA.y);
        const [bx, by] = toScreen(sysB.x, sysB.y);
        if (!inView(ax, ay) && !inView(bx, by)) continue;
        const alpha = count === 1 ? 0.25 : count === 2 ? 0.45 : 0.65;
        ctx.strokeStyle = `rgba(255, 160, 40, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    // ── Travel line ────────────────────────────────────────────────
    if (currentSys && destSys) {
      const [ax, ay] = toScreen(currentSys.x, currentSys.y);
      const [bx, by] = toScreen(destSys.x, destSys.y);

      ctx.strokeStyle = TRAVEL_LINE_COLOR;
      ctx.lineWidth = TRAVEL_LINE_WIDTH;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      if (gs.travel_progress != null) {
        const p = gs.travel_progress;
        const px = ax + (bx - ax) * p;
        const py = ay + (by - ay) * p;
        ctx.beginPath();
        ctx.arc(px, py, TRAVEL_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = TRAVEL_DOT_COLOR;
        ctx.fill();
      }
    }

    // ── Nodes ──────────────────────────────────────────────────────
    for (const sys of md.systems) {
      const [sx, sy] = toScreen(sys.x, sys.y);
      if (!inView(sx, sy)) continue;

      const isCurrent = sys === currentSys;
      const isDest = sys === destSys;
      const hasStation = md.stationsBySystemId.has(sys.id);

      if (isCurrent) {
        const glowAlpha = 0.08 + 0.1 * Math.sin(glowPhase.current);
        const glowRadius = NODE_RADIUS_CURRENT * 5;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
        grad.addColorStop(0, `rgba(0, 255, 136, ${glowAlpha * 2})`);
        grad.addColorStop(1, `rgba(0, 255, 136, 0)`);
        ctx.beginPath();
        ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      if (isDest && !isCurrent) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, NODE_RADIUS_DEST * 4);
        grad.addColorStop(0, 'rgba(204, 68, 255, 0.15)');
        grad.addColorStop(1, 'rgba(204, 68, 255, 0)');
        ctx.beginPath();
        ctx.arc(sx, sy, NODE_RADIUS_DEST * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      let r: number;
      let color: string;
      if (isCurrent) {
        r = NODE_RADIUS_CURRENT;
        color = NODE_COLOR_CURRENT;
      } else if (isDest) {
        r = NODE_RADIUS_DEST;
        color = NODE_COLOR_DEST;
      } else if (hasStation) {
        r = NODE_RADIUS_STATION;
        color = sys.empire_color ?? '#3a4a65';
      } else {
        r = NODE_RADIUS;
        color = sys.empire_color ?? NODE_COLOR_DEFAULT;
      }

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // ── Labels ─────────────────────────────────────────────────────
    const cx = cw / 2;
    const cy = ch / 2;

    if (currentSys) {
      const [sx, sy] = toScreen(currentSys.x, currentSys.y);
      ctx.font = `bold 10px ${LABEL_FONT}`;
      ctx.fillStyle = NODE_COLOR_CURRENT;
      ctx.fillText(currentSys.name, sx + NODE_RADIUS_CURRENT + 4, sy + 3);
    }

    if (destSys && destSys !== currentSys) {
      const [sx, sy] = toScreen(destSys.x, destSys.y);
      ctx.font = `9px ${LABEL_FONT}`;
      ctx.fillStyle = NODE_COLOR_DEST;
      ctx.fillText(destSys.name, sx + NODE_RADIUS_DEST + 3, sy + 3);
    }

    // Capital (is_home) labels — always visible
    ctx.font = `8px ${LABEL_FONT}`;
    for (const sys of md.systems) {
      if (!sys.is_home || sys === currentSys || sys === destSys) continue;
      const [sx, sy] = toScreen(sys.x, sys.y);
      if (!inView(sx, sy)) continue;
      ctx.fillStyle = 'rgba(180, 175, 140, 0.35)';
      ctx.fillText(sys.name, sx + NODE_RADIUS_STATION + 3, sy + 3);
    }

    // Nearby labels — only when zoomed in enough
    if (z >= LABEL_ZOOM_THRESHOLD) {
      for (const sys of md.systems) {
        if (sys === currentSys || sys === destSys || sys.is_home) continue;
        const [sx, sy] = toScreen(sys.x, sys.y);
        const dx = sx - cx;
        const dy = sy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > LABEL_RANGE_PX) continue;
        if (!inView(sx, sy)) continue;

        const alpha = Math.max(0.15, 0.5 * (1 - dist / LABEL_RANGE_PX));
        const hasStation = md.stationsBySystemId.has(sys.id);
        if (hasStation) {
          ctx.fillStyle = `rgba(180, 175, 160, ${alpha * 1.2})`;
        } else {
          ctx.fillStyle = `rgba(150, 160, 180, ${alpha})`;
        }
        const r = hasStation ? NODE_RADIUS_STATION : NODE_RADIUS;
        ctx.fillText(sys.name, sx + r + 3, sy + 3);
      }
    }
  }
}
