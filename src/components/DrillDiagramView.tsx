import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, SkipBack, SkipForward } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { AnimationKeyframe, DrillJsonData, Position } from '../types/drill';

// ── Colors matching renderer.py / drillRenderer.ts ──────────────────
const GRASS_LIGHT = '#6fbf4a';
const GRASS_DARK = '#63b043';
const LINE_COLOR = '#ffffff';
const GOAL_COLOR = '#ffffff';
const CONE_COLOR = '#f4a261';
const SHOT_COLOR = '#ff6b6b';

const PLAYER_COLORS: Record<string, string> = {
  attacker: '#e63946', defender: '#457b9d', goalkeeper: '#f1fa3c', neutral: '#f4a261',
  ATTACKER: '#e63946', DEFENDER: '#457b9d', GOALKEEPER: '#f1fa3c', NEUTRAL: '#f4a261',
};

// ── Bounds calculation (matches drillRenderer.ts) ───────────────────
interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number; }

function calculateBounds(drill: DrillJsonData, padding = 8): Bounds {
  const xs: number[] = [], ys: number[] = [];
  drill.players?.forEach(p => { xs.push(p.position.x); ys.push(p.position.y); });
  drill.cones?.forEach(c => { xs.push(c.position.x); ys.push(c.position.y); });
  drill.balls?.forEach(b => { xs.push(b.position.x); ys.push(b.position.y); });
  drill.goals?.forEach(g => { xs.push(g.position.x - 4, g.position.x + 4); ys.push(g.position.y - 3, g.position.y + 3); });
  drill.mini_goals?.forEach(g => { xs.push(g.position.x - 2, g.position.x + 2); ys.push(g.position.y - 2, g.position.y + 2); });
  drill.actions?.forEach(a => { if (a.to_position) { xs.push(a.to_position.x); ys.push(a.to_position.y); } });
  if (xs.length === 0) { xs.push(25, 75); } if (ys.length === 0) { ys.push(25, 75); }
  let xMin = Math.max(0, Math.min(...xs) - padding), xMax = Math.min(100, Math.max(...xs) + padding);
  let yMin = Math.max(0, Math.min(...ys) - padding), yMax = Math.min(100, Math.max(...ys) + padding);
  // Minimum size
  if (xMax - xMin < 30) { const c = (xMin + xMax) / 2; xMin = Math.max(0, c - 15); xMax = Math.min(100, c + 15); }
  if (yMax - yMin < 30) { const c = (yMin + yMax) / 2; yMin = Math.max(0, c - 15); yMax = Math.min(100, c + 15); }
  // Extend for field markings goals
  const markings = drill.field?.markings ?? drill.field?.show_markings ?? true;
  const goals = drill.field?.goals ?? 0;
  if (markings && goals >= 1 && yMax > 70) yMax = 100;
  if (markings && goals >= 2 && yMin < 30) yMin = 0;
  return { xMin, xMax, yMin, yMax };
}

// ── Position tracker for action chaining ────────────────────────────
function createTracker(drill: DrillJsonData) {
  const pos: Record<string, Position> = {};
  drill.players?.forEach(p => { pos[p.id] = { ...p.position }; });
  return {
    getPos: (id: string) => pos[id] || { x: 50, y: 50 },
    updatePos: (id: string, x: number, y: number) => { pos[id] = { x, y }; },
  };
}

// ── Component Props ─────────────────────────────────────────────────
interface DrillDiagramViewProps {
  drillJson: DrillJsonData;
  animationJson?: { duration: number; keyframes: AnimationKeyframe[] };
  mode: 'static' | 'animated';
  targetAspectRatio?: number; // e.g. 4/3 — expands field bounds to match this ratio for card previews
}

export function DrillDiagramView({ drillJson, animationJson, mode, targetAspectRatio }: DrillDiagramViewProps) {
  const { colors: tc } = useTheme();
  const ds = create_ds(tc);
  const [svgW, setSvgW] = useState(300);
  const bounds = useMemo(() => {
    const b = calculateBounds(drillJson);
    if (!targetAspectRatio) return b;
    // Expand bounds to match target aspect ratio by adding field padding
    let bw = b.xMax - b.xMin;
    let bh = b.yMax - b.yMin;
    const currentRatio = bw / bh;
    if (currentRatio < targetAspectRatio) {
      // Too tall — expand width
      const newW = bh * targetAspectRatio;
      const cx = (b.xMin + b.xMax) / 2;
      b.xMin = Math.max(0, cx - newW / 2);
      b.xMax = Math.min(100, cx + newW / 2);
      // If clamped, shift the other side
      const actualW = b.xMax - b.xMin;
      if (actualW < newW) {
        if (b.xMin === 0) b.xMax = Math.min(100, newW);
        else b.xMin = Math.max(0, b.xMax - newW);
      }
    } else if (currentRatio > targetAspectRatio) {
      // Too wide — expand height
      const newH = bw / targetAspectRatio;
      const cy = (b.yMin + b.yMax) / 2;
      b.yMin = Math.max(0, cy - newH / 2);
      b.yMax = Math.min(100, cy + newH / 2);
      const actualH = b.yMax - b.yMin;
      if (actualH < newH) {
        if (b.yMin === 0) b.yMax = Math.min(100, newH);
        else b.yMin = Math.max(0, b.yMax - newH);
      }
    }
    return b;
  }, [drillJson, targetAspectRatio]);
  const bw = bounds.xMax - bounds.xMin;
  const bh = bounds.yMax - bounds.yMin;
  const aspectRatio = bw / bh;
  const svgH = svgW / aspectRatio;
  const PAD = 12;
  const fw = svgW - PAD * 2;
  const fh = svgH - PAD * 2;

  const onLayout = (e: LayoutChangeEvent) => setSvgW(e.nativeEvent.layout.width);

  const toSvg = useCallback((fx: number, fy: number) => ({
    x: PAD + ((fx - bounds.xMin) / bw) * fw,
    y: PAD + ((bounds.yMax - fy) / bh) * fh,
  }), [bounds, bw, bh, fw, fh]);

  const fScale = useCallback((fu: number) => (fu / bw) * fw, [bw, fw]);
  const fScaleY = useCallback((fu: number) => (fu / bh) * fh, [bh, fh]);

  // Entity scale: like fScale but capped so entities don't get oversized on tight bounds (e.g. half-field).
  // When bw covers the full field (100), fScale and eScale are identical.
  // When bw is small (e.g. 50 for half-field), eScale limits growth to ~65 field-unit equivalent.
  const eScale = useCallback((fu: number) => {
    const maxBw = targetAspectRatio ? Math.max(bw * 0.8, 40) : Math.max(bw, 65);
    return (fu / maxBw) * fw;
  }, [bw, fw, targetAspectRatio]);

  // ── Animation state ───────────────────────────────────────────────
  const keyframes = animationJson?.keyframes || [];
  const totalDuration = useMemo(() => keyframes.reduce((s, kf, i) => i === 0 ? s : s + (kf.duration || 1000), 0), [keyframes]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCT] = useState(0);
  const [looping, setLooping] = useState(true);
  const [speed, setSpeed] = useState(1);
  const lastTs = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  const getStartPositions = useCallback((): Record<string, Position> => {
    const p: Record<string, Position> = {};
    drillJson.players?.forEach(pl => { p[pl.id] = { x: pl.position.x, y: pl.position.y }; });
    drillJson.balls?.forEach((b, i) => { p[`ball_${i}`] = { x: b.position.x, y: b.position.y }; });
    return p;
  }, [drillJson]);

  const getPositionsAtKf = useCallback((idx: number) => {
    const p = getStartPositions();
    for (let i = 0; i <= idx && i < keyframes.length; i++) {
      const kf = keyframes[i];
      if (kf.positions) Object.entries(kf.positions).forEach(([id, pos]) => { p[id] = { ...pos }; });
    }
    return p;
  }, [keyframes, getStartPositions]);

  const getPositionsAtTime = useCallback((t: number) => {
    if (keyframes.length === 0) return getStartPositions();
    const times: number[] = []; let cum = 0;
    for (let i = 0; i < keyframes.length; i++) { times.push(cum); if (i < keyframes.length - 1) cum += (keyframes[i + 1].duration || 1000); }
    let from = 0;
    for (let i = 0; i < times.length; i++) { if (t >= times[i]) from = i; }
    const to = Math.min(from + 1, keyframes.length - 1);
    if (from >= keyframes.length - 1 || from === to) return getPositionsAtKf(keyframes.length - 1);
    const segDur = times[to] - times[from];
    if (segDur <= 0) return getPositionsAtKf(from);
    const prog = Math.min(1, Math.max(0, (t - times[from]) / segDur));
    const ease = keyframes[to]?.easing || 'linear';
    let e = prog;
    if (ease === 'ease-in') e = prog * prog;
    else if (ease === 'ease-out') e = 1 - (1 - prog) * (1 - prog);
    else if (ease === 'ease-in-out') e = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
    const fp = getPositionsAtKf(from), tp = getPositionsAtKf(to);
    const result: Record<string, Position> = {};
    Object.keys(fp).forEach(id => { const f = fp[id], tt = tp[id] || f; result[id] = { x: f.x + (tt.x - f.x) * e, y: f.y + (tt.y - f.y) * e }; });
    return result;
  }, [keyframes, getStartPositions, getPositionsAtKf]);

  // Animation loop
  useEffect(() => {
    if (!playing) { if (rafId.current) cancelAnimationFrame(rafId.current); return; }
    lastTs.current = null;
    const loop = (ts: number) => {
      if (!lastTs.current) lastTs.current = ts;
      const delta = (ts - lastTs.current) * speed;
      lastTs.current = ts;
      setCT(prev => {
        let n = prev + delta;
        if (n >= totalDuration) { if (looping) n = 0; else { setPlaying(false); return totalDuration; } }
        return n;
      });
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [playing, speed, totalDuration, looping]);

  // Get current override positions for animation
  const overridePos = (mode === 'animated' && (playing || currentTime > 0))
    ? getPositionsAtTime(currentTime)
    : (mode === 'animated' ? getPositionsAtKf(0) : null);

  const getEntityPos = (id: string, origPos: Position): Position => {
    if (overridePos && overridePos[id]) return overridePos[id];
    return origPos;
  };

  // ── Rendering helpers ─────────────────────────────────────────────
  const markings = drillJson.field?.markings ?? drillJson.field?.show_markings ?? true;
  const fieldGoals = drillJson.field?.goals ?? 0;

  const renderGrass = () => {
    const els: React.ReactNode[] = [];
    const stripeWU = 10;
    const stripeWPx = fScale(stripeWU);
    const startIdx = Math.floor((bounds.xMin - 20) / stripeWU);
    const endIdx = Math.ceil((bounds.xMax + 20) / stripeWU);
    for (let si = startIdx; si <= endIdx; si++) {
      const sx = PAD + ((si * stripeWU - bounds.xMin) / bw) * fw;
      els.push(<Rect key={`gs-${si}`} x={sx} y={0} width={stripeWPx} height={svgH} fill={si % 2 === 0 ? GRASS_LIGHT : GRASS_DARK} />);
    }
    return els;
  };

  const renderMarkings = () => {
    if (!markings) return null;
    const els: React.ReactNode[] = [];
    const lw = 1.5;
    // Halfway
    if (bounds.yMin <= 50 && bounds.yMax >= 50) {
      const l = toSvg(bounds.xMin, 50), r = toSvg(bounds.xMax, 50);
      els.push(<Line key="half" x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke={LINE_COLOR} strokeWidth={lw} />);
    }
    // Center circle
    if (bounds.yMin <= 50 && bounds.yMax >= 50 && bounds.xMin <= 50 && bounds.xMax >= 50) {
      const cc = toSvg(50, 50);
      els.push(<Circle key="cc" cx={cc.x} cy={cc.y} r={fScale(10)} stroke={LINE_COLOR} strokeWidth={lw} fill="none" />);
      els.push(<Circle key="ccd" cx={cc.x} cy={cc.y} r={2} fill={LINE_COLOR} />);
    }
    // Penalty area
    const drawPen = (goalY: number, drawGoal: boolean) => {
      const into = goalY === 100 ? -1 : 1;
      const penY = goalY + into * 18, sixY = goalY + into * 6, spotY = goalY + into * 12;
      const k = goalY;
      const gl1 = toSvg(30, goalY), gl2 = toSvg(70, goalY);
      els.push(<Line key={`gl-${k}`} x1={gl1.x} y1={gl1.y} x2={gl2.x} y2={gl2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      const p1 = toSvg(30, penY), p2 = toSvg(70, penY), p3 = toSvg(30, goalY), p4 = toSvg(70, goalY);
      els.push(<Line key={`18t-${k}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`18l-${k}`} x1={p3.x} y1={p3.y} x2={p1.x} y2={p1.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`18r-${k}`} x1={p4.x} y1={p4.y} x2={p2.x} y2={p2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      const s1 = toSvg(42, sixY), s2 = toSvg(58, sixY), s3 = toSvg(42, goalY), s4 = toSvg(58, goalY);
      els.push(<Line key={`6t-${k}`} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`6l-${k}`} x1={s3.x} y1={s3.y} x2={s1.x} y2={s1.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`6r-${k}`} x1={s4.x} y1={s4.y} x2={s2.x} y2={s2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      const spot = toSvg(50, spotY);
      els.push(<Circle key={`spot-${k}`} cx={spot.x} cy={spot.y} r={2} fill={LINE_COLOR} />);
      if (drawGoal) {
        const depth = 3, pw = 2.5, netDir = goalY >= 50 ? 1 : -1;
        const crossbarY = goalY + netDir * depth;
        const gp1 = toSvg(50 - 4, goalY), gp2 = toSvg(50 + 4, goalY);
        const gc1 = toSvg(50 - 4, crossbarY), gc2 = toSvg(50 + 4, crossbarY);
        els.push(<Line key={`gb-${k}`} x1={gp1.x} y1={gp1.y} x2={gp2.x} y2={gp2.y} stroke="gray" strokeWidth={1.5} opacity={0.6} />);
        for (let j = 0; j <= 8; j++) { const nx = 50 - 4 + j; const a = toSvg(nx, goalY), b = toSvg(nx, crossbarY); els.push(<Line key={`gns-${k}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="gray" strokeWidth={0.5} opacity={0.4} />); }
        els.push(<Line key={`glp-${k}`} x1={gp1.x} y1={gp1.y} x2={gc1.x} y2={gc1.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
        els.push(<Line key={`grp-${k}`} x1={gp2.x} y1={gp2.y} x2={gc2.x} y2={gc2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
        els.push(<Line key={`gcb-${k}`} x1={gc1.x} y1={gc1.y} x2={gc2.x} y2={gc2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
      }
    };
    if (bounds.yMax >= 85) drawPen(100, fieldGoals >= 1);
    if (drillJson.field?.type === 'FULL' && bounds.yMin <= 15) drawPen(0, fieldGoals >= 2);
    return els;
  };

  const renderConeLines = () => (drillJson.cone_lines || []).map((cl, i) => {
    const cones = drillJson.cones || [];
    if (cl.from_cone >= cones.length || cl.to_cone >= cones.length) return null;
    const p1 = toSvg(cones[cl.from_cone].position.x, cones[cl.from_cone].position.y);
    const p2 = toSvg(cones[cl.to_cone].position.x, cones[cl.to_cone].position.y);
    return <Line key={`cl-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={CONE_COLOR} strokeWidth={2} opacity={0.8} />;
  });

  const renderCones = () => (drillJson.cones || []).map((c, i) => {
    const p = toSvg(c.position.x, c.position.y);
    const s = eScale(1.2);
    return <Polygon key={`c-${i}`} points={`${p.x},${p.y - s - 2} ${p.x - s},${p.y + s} ${p.x + s},${p.y + s}`} fill={CONE_COLOR} stroke="black" strokeWidth={0.8} />;
  });

  const renderGoals = () => {
    const els: React.ReactNode[] = [];
    // Helper: draw a goal frame with back line, nets, posts, crossbar (matching DiagramCanvas)
    // When anchorFront=true, position is treated as the opening (for mini goals)
    const drawGoal = (rawCx: number, rawCy: number, r: number, w: number, d: number, pw: number, ns: number, keyPrefix: string, anchorFront = false) => {
      let cx = rawCx, cy = rawCy;
      if (anchorFront) {
        if (r === 0) cy = cy - d;
        else if (r === 90) cx = cx - d;
        else if (r === 180) cy = cy + d;
        else cx = cx + d; // 270
      }
      let bl1: any, bl2: any, tl1: any, tl2: any;
      const netLines: {x1:number,y1:number,x2:number,y2:number}[] = [];
      if (r === 0) { bl1 = toSvg(cx-w/2,cy); bl2 = toSvg(cx+w/2,cy); tl1 = toSvg(cx-w/2,cy+d); tl2 = toSvg(cx+w/2,cy+d); for(let j=0;j<ns;j++){const nx=cx-w/2+j*(w/(ns-1));const a=toSvg(nx,cy),b=toSvg(nx,cy+d);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});} }
      else if (r === 90) { bl1 = toSvg(cx,cy-w/2); bl2 = toSvg(cx,cy+w/2); tl1 = toSvg(cx+d,cy-w/2); tl2 = toSvg(cx+d,cy+w/2); for(let j=0;j<ns;j++){const ny=cy-w/2+j*(w/(ns-1));const a=toSvg(cx,ny),b=toSvg(cx+d,ny);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});} }
      else if (r === 180) { bl1 = toSvg(cx-w/2,cy); bl2 = toSvg(cx+w/2,cy); tl1 = toSvg(cx-w/2,cy-d); tl2 = toSvg(cx+w/2,cy-d); for(let j=0;j<ns;j++){const nx=cx-w/2+j*(w/(ns-1));const a=toSvg(nx,cy),b=toSvg(nx,cy-d);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});} }
      else { bl1 = toSvg(cx,cy-w/2); bl2 = toSvg(cx,cy+w/2); tl1 = toSvg(cx-d,cy-w/2); tl2 = toSvg(cx-d,cy+w/2); for(let j=0;j<ns;j++){const ny=cy-w/2+j*(w/(ns-1));const a=toSvg(cx,ny),b=toSvg(cx-d,ny);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});} }
      // Back line (gray)
      els.push(<Line key={`${keyPrefix}-back`} x1={bl1.x} y1={bl1.y} x2={bl2.x} y2={bl2.y} stroke="gray" strokeWidth={1.5} opacity={0.6} />);
      // Net strings (gray, thin)
      netLines.forEach((nl, j) => els.push(<Line key={`${keyPrefix}-net-${j}`} x1={nl.x1} y1={nl.y1} x2={nl.x2} y2={nl.y2} stroke="gray" strokeWidth={0.5} opacity={0.4} />));
      // Posts (white)
      els.push(<Line key={`${keyPrefix}-lp`} x1={bl1.x} y1={bl1.y} x2={tl1.x} y2={tl1.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
      els.push(<Line key={`${keyPrefix}-rp`} x1={bl2.x} y1={bl2.y} x2={tl2.x} y2={tl2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
      // Crossbar (open front)
      els.push(<Line key={`${keyPrefix}-cb`} x1={tl1.x} y1={tl1.y} x2={tl2.x} y2={tl2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
    };
    // Custom full-size goals
    (drillJson.goals || []).forEach((g, i) => {
      if (g.size === 'small') return;
      drawGoal(g.position.x, g.position.y, g.rotation || 0, 8, 3, 2.5, Math.floor(8) + 1, `g-${i}`, false);
    });
    // Mini goals (no rotation flip — mini_goals array uses direct rotation)
    (drillJson.mini_goals || []).forEach((g, i) => {
      drawGoal(g.position.x, g.position.y, g.rotation || 0, 4, 2, 1.8, 5, `mg-${i}`, true);
    });
    return els;
  };

  const renderActions = useMemo(() => {
    const tracker = createTracker(drillJson);
    const arrowOff = eScale(2.5);
    const gapOff = eScale(0.8);
    const lineW = eScale(0.35);
    const ahW = eScale(1.2);
    const ahL = eScale(1.0);

    return (drillJson.actions || []).map((action, i) => {
      let fromFP: Position, toFP: Position;
      let sIsP = true, eIsP = true;

      if (action.type === 'PASS') {
        fromFP = overridePos?.[action.from_player!] || tracker.getPos(action.from_player!);
        toFP = overridePos?.[action.to_player!] || tracker.getPos(action.to_player!);
      } else {
        const pid = action.player!;
        fromFP = overridePos?.[pid] || tracker.getPos(pid);
        toFP = action.to_position || { x: 50, y: 100 };
        eIsP = false;
        if (action.type === 'RUN' || action.type === 'DRIBBLE') tracker.updatePos(pid, toFP.x, toFP.y);
      }

      const from = toSvg(fromFP.x, fromFP.y), to = toSvg(toFP.x, toFP.y);
      const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return null;
      const nx = dx / len, ny = dy / len;
      const sOff = sIsP ? arrowOff : gapOff, eOff = eIsP ? arrowOff : gapOff;
      const sx = from.x + nx * sOff, sy = from.y + ny * sOff;
      const ex = to.x - nx * eOff, ey = to.y - ny * eOff;

      const isShot = action.type === 'SHOT';
      const color = isShot ? SHOT_COLOR : '#ffffff';
      const lw = isShot ? lineW * 1.5 : lineW;
      const curAhW = isShot ? ahW * 1.3 : ahW;
      const curAhL = isShot ? ahL * 1.5 : ahL;
      const a1x = ex - nx * curAhL + ny * curAhW, a1y = ey - ny * curAhL - nx * curAhW;
      const a2x = ex - nx * curAhL - ny * curAhW, a2y = ey - ny * curAhL + nx * curAhW;
      const leX = ex - nx * curAhL, leY = ey - ny * curAhL;

      if (action.type === 'DRIBBLE') {
        const amp = eScale(0.8);
        const ddx = leX - sx, ddy = leY - sy, segLen = Math.sqrt(ddx * ddx + ddy * ddy);
        const perpX = segLen > 0 ? -ddy / segLen : 0, perpY = segLen > 0 ? ddx / segLen : 0;
        let pathD = `M ${sx} ${sy}`;
        for (let t = 1; t <= 50; t++) { const f = t / 50; const wave = amp * Math.sin(8 * Math.PI * f); pathD += ` L ${sx + ddx * f + perpX * wave} ${sy + ddy * f + perpY * wave}`; }
        return <G key={`a-${i}`} opacity={0.85}><Path d={pathD} stroke={color} strokeWidth={lw} fill="none" /><Polygon points={`${ex},${ey} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} /></G>;
      }

      const dash = action.type === 'RUN' ? '8,4' : undefined;
      return <G key={`a-${i}`} opacity={0.85}><Line x1={sx} y1={sy} x2={leX} y2={leY} stroke={color} strokeWidth={lw} strokeDasharray={dash} strokeLinecap="round" /><Polygon points={`${ex},${ey} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} /></G>;
    });
  }, [drillJson, toSvg, fScale, eScale, overridePos]);

  const renderPlayers = () => (drillJson.players || []).map((player, i) => {
    const pp = getEntityPos(player.id, player.position);
    const p = toSvg(pp.x, pp.y);
    const color = PLAYER_COLORS[player.role] || PLAYER_COLORS[player.role?.toLowerCase()] || '#888';
    const r = eScale(1.8);
    const sw = Math.max(1, eScale(0.4));
    return (
      <G key={`p-${i}`}>
        <Circle cx={p.x} cy={p.y} r={r} fill={color} stroke="white" strokeWidth={sw} />
      </G>
    );
  });

  const renderBalls = () => (drillJson.balls || []).map((ball, i) => {
    const bp = getEntityPos(`ball_${i}`, ball.position);
    const p = toSvg(bp.x, bp.y);
    const r = eScale(1.4);
    const bsw = Math.max(0.8, eScale(0.3));
    const pentR = r * 0.45;
    const pentPts = Array.from({ length: 5 }, (_, k) => { const a = (-Math.PI / 2) + (2 * Math.PI * k) / 5; return `${p.x + pentR * Math.cos(a)},${p.y + pentR * Math.sin(a)}`; }).join(' ');
    return <G key={`b-${i}`}><Circle cx={p.x} cy={p.y} r={r} fill="white" stroke="black" strokeWidth={bsw} /><Polygon points={pentPts} fill="black" /></G>;
  });

  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const fmtTime = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; };

  return (
    <View>
      {/* Diagram */}
      <View style={ds.diagramWrap} onLayout={onLayout}>
        <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          {renderGrass()}
          {renderMarkings()}
          {renderConeLines()}
          {renderCones()}
          {renderGoals()}
          {mode === 'static' && renderActions}
          {renderPlayers()}
          {renderBalls()}
        </Svg>
      </View>

      {/* Animation controls */}
      {mode === 'animated' && keyframes.length >= 2 && (
        <View style={ds.controls}>
          <View style={ds.controlRow}>
            <TouchableOpacity onPress={() => { setPlaying(false); setCT(0); }} style={ds.ctrlBtn}><SkipBack size={16} color={tc.foreground} /></TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setPlaying(false);
              let t = 0, prev = 0;
              for (let i = 1; i < keyframes.length; i++) { t += (keyframes[i].duration || 1000); if (t >= currentTime - 50) break; prev = t; }
              setCT(currentTime <= 50 ? 0 : prev);
            }} style={ds.ctrlBtn}><ChevronLeft size={16} color={tc.foreground} /></TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (currentTime >= totalDuration) setCT(0);
              setPlaying(!playing);
            }} style={ds.playBtn}>
              {playing ? <Pause size={20} color={tc.primaryForeground} /> : <Play size={20} color={tc.primaryForeground} style={{ marginLeft: 2 }} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setPlaying(false);
              let t = 0;
              for (let i = 1; i < keyframes.length; i++) { t += (keyframes[i].duration || 1000); if (t > currentTime + 50) { setCT(t); return; } }
              setCT(totalDuration);
            }} style={ds.ctrlBtn}><ChevronRight size={16} color={tc.foreground} /></TouchableOpacity>
            <TouchableOpacity onPress={() => { setPlaying(false); setCT(totalDuration); }} style={ds.ctrlBtn}><SkipForward size={16} color={tc.foreground} /></TouchableOpacity>
          </View>
          {/* Progress bar */}
          <View style={ds.progressWrap}>
            <View style={ds.progressBg}><View style={[ds.progressFill, { width: `${progressPct}%` }]} /></View>
            <Text style={ds.timeText}>{fmtTime(currentTime)} / {fmtTime(totalDuration)}</Text>
          </View>
          {/* Speed + Loop */}
          <View style={ds.controlRow}>
            {[0.5, 1, 1.5, 2].map(s => (
              <TouchableOpacity key={s} style={[ds.speedBtn, speed === s && ds.speedBtnActive]} onPress={() => setSpeed(s)}>
                <Text style={[ds.speedText, speed === s && ds.speedTextActive]}>{s}x</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[ds.loopBtn, looping && ds.loopBtnActive]} onPress={() => setLooping(!looping)}>
              <RefreshCw size={14} color={looping ? tc.primaryForeground : tc.mutedForeground} />
              <Text style={[ds.loopText, looping && ds.loopTextActive]}>Loop</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function create_ds(tc: any) { return StyleSheet.create({
  diagramWrap: { width: '100%', borderRadius: borderRadius.lg, overflow: 'hidden' },
  controls: { marginTop: spacing.sm, gap: spacing.sm },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  ctrlBtn: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressBg: { flex: 1, height: 4, backgroundColor: tc.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: tc.primary, borderRadius: 2 },
  timeText: { fontSize: 11, color: tc.mutedForeground, fontVariant: ['tabular-nums'], minWidth: 70, textAlign: 'right' },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, backgroundColor: tc.card },
  speedBtnActive: { backgroundColor: tc.primary, borderColor: tc.primary },
  speedText: { fontSize: 12, color: tc.mutedForeground },
  speedTextActive: { color: tc.primaryForeground, fontWeight: '600' },
  loopBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, backgroundColor: tc.card },
  loopBtnActive: { backgroundColor: tc.primary, borderColor: tc.primary },
  loopText: { fontSize: 12, color: tc.mutedForeground },
  loopTextActive: { color: tc.primaryForeground, fontWeight: '600' },
}); };
