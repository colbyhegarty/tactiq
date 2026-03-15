import { RotateCw } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect
} from 'react-native-svg';
import { generateId } from '../../lib/customDrillStorage';
import {
  CustomPlayer,
  DiagramData,
  EditorState,
  FieldPosition,
  PLAYER_COLORS
} from '../../types/customDrill';

// ── Constants matching renderer.py ──────────────────────────────────
const GRASS_LIGHT = '#6fbf4a';
const GRASS_DARK = '#63b043';
const LINE_COLOR = '#ffffff';
const GOAL_COLOR = '#ffffff';
const CONE_COLOR = '#f4a261';
const SHOT_COLOR = '#ff6b6b';

// All in FIELD UNITS (0-100 coordinate space), matching renderer.py
const PLAYER_RADIUS_FU = 1.8;   // ~sqrt(150/pi) ≈ visual radius in field units
const CONE_SIZE_FU = 1.2;
const BALL_RADIUS_FU = 1.5;
const PLAYER_OFFSET_FU = 2.5;   // Arrow offset from player center
const ACTION_GAP_FU = 0.8;      // Arrow gap for non-player endpoints
const ARROW_HEAD_W_FU = 1.2;    // Arrowhead width
const ARROW_HEAD_L_FU = 1.0;    // Arrowhead length
const LINE_WIDTH_FU = 0.35;     // Arrow line width
const DRIBBLE_AMP_FU = 0.8;     // Dribble wave amplitude
const DRIBBLE_FREQ = 8;         // Dribble wave frequency

const PAD = 6; // padding % of canvas

// ── Position Tracker (matches renderer.py PositionTracker) ──────────
function createPositionTracker(diagram: DiagramData) {
  const positions: Record<string, FieldPosition> = {};
  const moved: Record<string, boolean> = {};
  let ballHolder: string | null = null;
  let ballPos: FieldPosition | null = null;

  diagram.players.forEach(p => {
    positions[p.id] = { ...p.position };
    moved[p.id] = false;
  });

  // Find initial ball holder from first action
  if (diagram.actions.length > 0) {
    const first = diagram.actions[0];
    if (first.type === 'PASS') ballHolder = first.fromPlayerId;
    else if ('playerId' in first) ballHolder = first.playerId;
  }

  // Fallback: nearest player to first ball
  if (!ballHolder && diagram.balls.length > 0) {
    const ball = diagram.balls[0];
    let minDist = Infinity;
    diagram.players.forEach(p => {
      const d = Math.hypot(p.position.x - ball.position.x, p.position.y - ball.position.y);
      if (d < minDist) { minDist = d; ballHolder = p.id; }
    });
  }

  if (ballHolder && positions[ballHolder]) ballPos = { ...positions[ballHolder] };
  else if (diagram.balls.length > 0) ballPos = { ...diagram.balls[0].position };

  return {
    getPos: (id: string) => positions[id] || { x: 0, y: 0 },
    isAtStart: (id: string) => !moved[id],
    updatePos: (id: string, x: number, y: number) => {
      positions[id] = { x, y };
      moved[id] = true;
      if (ballHolder === id) ballPos = { x, y };
    },
    transferBall: (toId: string) => {
      ballHolder = toId;
      ballPos = positions[toId] ? { ...positions[toId] } : ballPos;
    },
    getBallHolder: () => ballHolder,
    getBallPos: () => ballPos || { x: 50, y: 50 },
  };
}

// ── Component ───────────────────────────────────────────────────────

interface DiagramCanvasProps {
  diagram: DiagramData;
  tool: EditorState['tool'];
  selectedEntity: EditorState['selectedEntity'];
  pendingActionFrom: string | null;
  onDiagramChange: (diagram: DiagramData) => void;
  onSelectEntity: (entity: EditorState['selectedEntity']) => void;
  onPendingActionChange: (id: string | null) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function DiagramCanvas({
  diagram, tool, selectedEntity, pendingActionFrom,
  onDiagramChange, onSelectEntity, onPendingActionChange, onDragStateChange,
}: DiagramCanvasProps) {
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setSize({ w: width, h: width });
  };

  const padPx = (PAD / 100) * size.w;
  const fw = size.w - padPx * 2;
  const fh = size.h - padPx * 2;

  // Convert field units to SVG pixels
  const fScale = useCallback((fu: number) => (fu / 100) * fw, [fw]);

  // Field coords → SVG pixels (y inverted: field y=0 is bottom)
  const toSvg = useCallback((fx: number, fy: number) => ({
    x: padPx + (fx / 100) * fw,
    y: padPx + ((100 - fy) / 100) * fh,
  }), [padPx, fw, fh]);

  const toField = useCallback((sx: number, sy: number): FieldPosition => ({
    x: Math.max(0, Math.min(100, ((sx - padPx) / fw) * 100)),
    y: Math.max(0, Math.min(100, 100 - ((sy - padPx) / fh) * 100)),
  }), [padPx, fw, fh]);

  const findEntityAt = useCallback((fp: FieldPosition) => {
    for (const p of diagram.players) if (Math.hypot(p.position.x - fp.x, p.position.y - fp.y) < 4) return { type: 'player' as const, id: p.id };
    for (const b of diagram.balls) if (Math.hypot(b.position.x - fp.x, b.position.y - fp.y) < 4) return { type: 'ball' as const, id: b.id };
    for (const c of diagram.cones) if (Math.hypot(c.position.x - fp.x, c.position.y - fp.y) < 4) return { type: 'cone' as const, id: c.id };
    for (const g of diagram.goals) if (Math.hypot(g.position.x - fp.x, g.position.y - fp.y) < 6) return { type: 'goal' as const, id: g.id };
    return null;
  }, [diagram]);

  // ── Touch handlers ────────────────────────────────────────────────
  const handlePress = useCallback((evt: any) => {
    const { locationX, locationY } = evt.nativeEvent;
    const fp = toField(locationX, locationY);
    if (tool === 'select') { onSelectEntity(findEntityAt(fp)); onPendingActionChange(null); return; }
    if (['attacker', 'defender', 'goalkeeper', 'neutral'].includes(tool)) {
      const role = tool.toUpperCase() as CustomPlayer['role'];
      const count = diagram.players.filter(p => p.role === role).length + 1;
      onDiagramChange({ ...diagram, players: [...diagram.players, { id: `${role[0]}${count}`, role, position: fp }] }); return;
    }
    if (tool === 'cone') { onDiagramChange({ ...diagram, cones: [...diagram.cones, { id: generateId(), position: fp }] }); return; }
    if (tool === 'ball') { onDiagramChange({ ...diagram, balls: [...diagram.balls, { id: generateId(), position: fp }] }); return; }
    if (tool === 'goal' || tool === 'minigoal') { onDiagramChange({ ...diagram, goals: [...diagram.goals, { id: generateId(), position: fp, rotation: 0, size: tool === 'goal' ? 'full' : 'mini' }] }); return; }
    if (tool === 'coneline') {
      const cone = diagram.cones.find(c => Math.hypot(c.position.x - fp.x, c.position.y - fp.y) < 5);
      if (!cone) return;
      if (!pendingActionFrom) { onPendingActionChange(cone.id); } else { if (pendingActionFrom !== cone.id) onDiagramChange({ ...diagram, coneLines: [...diagram.coneLines, { id: generateId(), fromConeId: pendingActionFrom, toConeId: cone.id }] }); onPendingActionChange(null); }
      return;
    }
    if (tool === 'pass') {
      const pl = diagram.players.find(p => Math.hypot(p.position.x - fp.x, p.position.y - fp.y) < 5);
      if (!pl) return;
      if (!pendingActionFrom) { onPendingActionChange(pl.id); } else { if (pendingActionFrom !== pl.id) onDiagramChange({ ...diagram, actions: [...diagram.actions, { id: generateId(), type: 'PASS', fromPlayerId: pendingActionFrom, toPlayerId: pl.id }] }); onPendingActionChange(null); }
      return;
    }
    if (['run', 'dribble', 'shot'].includes(tool)) {
      if (!pendingActionFrom) { const pl = diagram.players.find(p => Math.hypot(p.position.x - fp.x, p.position.y - fp.y) < 5); if (pl) onPendingActionChange(pl.id); }
      else { onDiagramChange({ ...diagram, actions: [...diagram.actions, { id: generateId(), type: tool.toUpperCase() as any, playerId: pendingActionFrom, toPosition: fp }] }); onPendingActionChange(null); }
    }
  }, [tool, diagram, pendingActionFrom, toField, findEntityAt, onDiagramChange, onSelectEntity, onPendingActionChange]);

  const handleTouchStart = useCallback((evt: any) => {
    if (tool !== 'select') return;
    const fp = toField(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    const entity = findEntityAt(fp);
    if (entity) {
      onSelectEntity(entity);
      setDragging(true);
      onDragStateChange?.(true);
      let ePos: FieldPosition | null = null;
      if (entity.type === 'player') ePos = diagram.players.find(p => p.id === entity.id)?.position || null;
      else if (entity.type === 'cone') ePos = diagram.cones.find(c => c.id === entity.id)?.position || null;
      else if (entity.type === 'ball') ePos = diagram.balls.find(b => b.id === entity.id)?.position || null;
      else if (entity.type === 'goal') ePos = diagram.goals.find(g => g.id === entity.id)?.position || null;
      if (ePos) dragOffset.current = { x: fp.x - ePos.x, y: fp.y - ePos.y };
    }
  }, [tool, toField, findEntityAt, diagram, onSelectEntity]);

  const handleTouchMove = useCallback((evt: any) => {
    if (!dragging || !selectedEntity) return;
    const fp = toField(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    const np = { x: Math.max(0, Math.min(100, fp.x - dragOffset.current.x)), y: Math.max(0, Math.min(100, fp.y - dragOffset.current.y)) };
    if (selectedEntity.type === 'player') onDiagramChange({ ...diagram, players: diagram.players.map(p => p.id === selectedEntity.id ? { ...p, position: np } : p) });
    else if (selectedEntity.type === 'cone') onDiagramChange({ ...diagram, cones: diagram.cones.map(c => c.id === selectedEntity.id ? { ...c, position: np } : c) });
    else if (selectedEntity.type === 'ball') onDiagramChange({ ...diagram, balls: diagram.balls.map(b => b.id === selectedEntity.id ? { ...b, position: np } : b) });
    else if (selectedEntity.type === 'goal') onDiagramChange({ ...diagram, goals: diagram.goals.map(g => g.id === selectedEntity.id ? { ...g, position: np } : g) });
  }, [dragging, selectedEntity, toField, diagram, onDiagramChange]);

  const handleTouchEnd = useCallback(() => { setDragging(false); onDragStateChange?.(false); }, [onDragStateChange]);

  const handleRotateGoal = useCallback(() => {
    if (!selectedEntity || selectedEntity.type !== 'goal') return;
    onDiagramChange({
      ...diagram,
      goals: diagram.goals.map(g =>
        g.id === selectedEntity.id ? { ...g, rotation: ((g.rotation || 0) + 90) % 360 } : g
      ),
    });
  }, [selectedEntity, diagram, onDiagramChange]);

  // ── Rendering ─────────────────────────────────────────────────────

  // Grass: vertical stripes
  const renderGrass = () => {
    const els: React.ReactNode[] = [];
    const stripeW = fScale(10);
    const start = Math.floor((padPx - stripeW * 2) / stripeW) * stripeW;
    let i = 0;
    for (let x = start; x < size.w + stripeW; x += stripeW) {
      const idx = Math.round(x / stripeW);
      els.push(<Rect key={`gs-${i++}`} x={x} y={0} width={stripeW} height={size.h} fill={idx % 2 === 0 ? GRASS_LIGHT : GRASS_DARK} />);
    }
    return els;
  };

  // Field markings
  const renderMarkings = () => {
    if (!diagram.field.markings) return null;
    const els: React.ReactNode[] = [];
    const lw = 1.5;

    // Halfway line
    const hl = toSvg(0, 50), hr = toSvg(100, 50);
    els.push(<Line key="half" x1={hl.x} y1={hl.y} x2={hr.x} y2={hl.y} stroke={LINE_COLOR} strokeWidth={lw} />);
    // Center circle
    const cc = toSvg(50, 50);
    els.push(<Circle key="cc" cx={cc.x} cy={cc.y} r={fScale(10)} stroke={LINE_COLOR} strokeWidth={lw} fill="none" />);
    els.push(<Circle key="ccd" cx={cc.x} cy={cc.y} r={2} fill={LINE_COLOR} />);

    const drawPenaltyArea = (goalY: number) => {
      const into = goalY === 100 ? -1 : 1;
      const penY = goalY + into * 18, sixY = goalY + into * 6, spotY = goalY + into * 12;
      const k = goalY;
      // Goal line
      const gl1 = toSvg(30, goalY), gl2 = toSvg(70, goalY);
      els.push(<Line key={`gl-${k}`} x1={gl1.x} y1={gl1.y} x2={gl2.x} y2={gl2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      // 18-yard box
      const p1 = toSvg(30, penY), p2 = toSvg(70, penY), p3 = toSvg(30, goalY), p4 = toSvg(70, goalY);
      els.push(<Line key={`18t-${k}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`18l-${k}`} x1={p3.x} y1={p3.y} x2={p1.x} y2={p1.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`18r-${k}`} x1={p4.x} y1={p4.y} x2={p2.x} y2={p2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      // 6-yard box
      const s1 = toSvg(42, sixY), s2 = toSvg(58, sixY), s3 = toSvg(42, goalY), s4 = toSvg(58, goalY);
      els.push(<Line key={`6t-${k}`} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`6l-${k}`} x1={s3.x} y1={s3.y} x2={s1.x} y2={s1.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      els.push(<Line key={`6r-${k}`} x1={s4.x} y1={s4.y} x2={s2.x} y2={s2.y} stroke={LINE_COLOR} strokeWidth={lw} />);
      // Penalty spot
      const spot = toSvg(50, spotY);
      els.push(<Circle key={`spot-${k}`} cx={spot.x} cy={spot.y} r={2} fill={LINE_COLOR} />);
      // Goal with net
      const drawGoal = goalY === 100 ? diagram.field.goals >= 1 : diagram.field.goals >= 2;
      if (drawGoal) renderGoalWithNet(els, 50, goalY, 8, goalY >= 50 ? 1 : -1);
    };
    drawPenaltyArea(100);
    if (diagram.field.type === 'FULL') drawPenaltyArea(0);
    return els;
  };

  // Goal with net (field markings goals)
  const renderGoalWithNet = (els: React.ReactNode[], cx: number, goalLineY: number, width: number, netDir: number) => {
    const pw = 2.5; const depth = 3;
    const crossbarY = goalLineY + netDir * depth;
    const k = `gn-${goalLineY}`;
    const p1 = toSvg(cx - width / 2, goalLineY), p2 = toSvg(cx + width / 2, goalLineY);
    const c1 = toSvg(cx - width / 2, crossbarY), c2 = toSvg(cx + width / 2, crossbarY);
    els.push(<Line key={`${k}-back`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="gray" strokeWidth={1.5} opacity={0.6} />);
    const ns = Math.floor(width) + 1;
    for (let i = 0; i < ns; i++) {
      const nx = cx - width / 2 + i * (width / (ns - 1));
      const a = toSvg(nx, goalLineY), b = toSvg(nx, crossbarY);
      els.push(<Line key={`${k}-ns-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="gray" strokeWidth={0.5} opacity={0.4} />);
    }
    els.push(<Line key={`${k}-lp`} x1={p1.x} y1={p1.y} x2={c1.x} y2={c1.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
    els.push(<Line key={`${k}-rp`} x1={p2.x} y1={p2.y} x2={c2.x} y2={c2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
    els.push(<Line key={`${k}-cb`} x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />);
  };

  // Custom goals (explicit, with rotation + mini goal 180° flip)
  const renderCustomGoals = () => diagram.goals.map((goal, i) => {
    const isMini = goal.size === 'mini';
    const width = isMini ? 4 : 8, depth = isMini ? 2 : 3, pw = isMini ? 1.8 : 2.5;
    const rot = goal.rotation || 0;
    const effectiveRot = isMini ? (rot + 180) % 360 : rot;
    const cx = goal.position.x, cy = goal.position.y;
    const sel = selectedEntity?.type === 'goal' && selectedEntity.id === goal.id;
    const ns = isMini ? 5 : Math.floor(width) + 1;

    type LP = { x1: number; y1: number; x2: number; y2: number };
    let posts: LP[] = [], crossbar: LP, backLine: LP, netLines: LP[] = [];

    const compute = (r: number) => {
      if (r === 0) { // NORTH
        const bl = toSvg(cx-width/2,cy), br = toSvg(cx+width/2,cy), tl = toSvg(cx-width/2,cy+depth), tr = toSvg(cx+width/2,cy+depth);
        posts = [{x1:bl.x,y1:bl.y,x2:tl.x,y2:tl.y},{x1:br.x,y1:br.y,x2:tr.x,y2:tr.y}]; crossbar = {x1:tl.x,y1:tl.y,x2:tr.x,y2:tr.y}; backLine = {x1:bl.x,y1:bl.y,x2:br.x,y2:br.y};
        for(let j=0;j<ns;j++){const nx=cx-width/2+j*(width/(ns-1));const a=toSvg(nx,cy),b=toSvg(nx,cy+depth);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});}
      } else if (r === 90) { // EAST
        const bl=toSvg(cx,cy-width/2),tl=toSvg(cx,cy+width/2),br=toSvg(cx+depth,cy-width/2),tr=toSvg(cx+depth,cy+width/2);
        posts=[{x1:bl.x,y1:bl.y,x2:br.x,y2:br.y},{x1:tl.x,y1:tl.y,x2:tr.x,y2:tr.y}]; crossbar={x1:br.x,y1:br.y,x2:tr.x,y2:tr.y}; backLine={x1:bl.x,y1:bl.y,x2:tl.x,y2:tl.y};
        for(let j=0;j<ns;j++){const ny=cy-width/2+j*(width/(ns-1));const a=toSvg(cx,ny),b=toSvg(cx+depth,ny);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});}
      } else if (r === 180) { // SOUTH
        const bl=toSvg(cx-width/2,cy),br=toSvg(cx+width/2,cy),tl=toSvg(cx-width/2,cy-depth),tr=toSvg(cx+width/2,cy-depth);
        posts=[{x1:bl.x,y1:bl.y,x2:tl.x,y2:tl.y},{x1:br.x,y1:br.y,x2:tr.x,y2:tr.y}]; crossbar={x1:tl.x,y1:tl.y,x2:tr.x,y2:tr.y}; backLine={x1:bl.x,y1:bl.y,x2:br.x,y2:br.y};
        for(let j=0;j<ns;j++){const nx=cx-width/2+j*(width/(ns-1));const a=toSvg(nx,cy),b=toSvg(nx,cy-depth);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});}
      } else { // 270 WEST
        const bl=toSvg(cx,cy-width/2),tl=toSvg(cx,cy+width/2),br=toSvg(cx-depth,cy-width/2),tr=toSvg(cx-depth,cy+width/2);
        posts=[{x1:bl.x,y1:bl.y,x2:br.x,y2:br.y},{x1:tl.x,y1:tl.y,x2:tr.x,y2:tr.y}]; crossbar={x1:br.x,y1:br.y,x2:tr.x,y2:tr.y}; backLine={x1:bl.x,y1:bl.y,x2:tl.x,y2:tl.y};
        for(let j=0;j<ns;j++){const ny=cy-width/2+j*(width/(ns-1));const a=toSvg(cx,ny),b=toSvg(cx-depth,ny);netLines.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y});}
      }
    };
    compute(effectiveRot);
    const center = toSvg(cx, cy);
    return (
      <G key={`goal-${i}`}>
        {sel && <Circle cx={center.x} cy={center.y} r={fScale(6)} stroke="#facc15" strokeWidth={2} strokeDasharray="6,3" fill="none" />}
        <Line x1={backLine!.x1} y1={backLine!.y1} x2={backLine!.x2} y2={backLine!.y2} stroke="gray" strokeWidth={1.5} opacity={0.6} />
        {netLines.map((nl, j) => <Line key={j} x1={nl.x1} y1={nl.y1} x2={nl.x2} y2={nl.y2} stroke="gray" strokeWidth={0.5} opacity={0.4} />)}
        {posts.map((p, j) => <Line key={`p${j}`} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />)}
        <Line x1={crossbar!.x1} y1={crossbar!.y1} x2={crossbar!.x2} y2={crossbar!.y2} stroke={GOAL_COLOR} strokeWidth={pw} strokeLinecap="round" />
      </G>
    );
  });

  // Cone lines (solid orange)
  const renderConeLines = () => diagram.coneLines.map((cl, i) => {
    const fc = diagram.cones.find(c => c.id === cl.fromConeId), tc = diagram.cones.find(c => c.id === cl.toConeId);
    if (!fc || !tc) return null;
    const p1 = toSvg(fc.position.x, fc.position.y), p2 = toSvg(tc.position.x, tc.position.y);
    return <Line key={`cl-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={CONE_COLOR} strokeWidth={2} opacity={0.8} />;
  });

  // Cones (triangle with black edge)
  const renderCones = () => diagram.cones.map((cone, i) => {
    const p = toSvg(cone.position.x, cone.position.y);
    const sel = selectedEntity?.type === 'cone' && selectedEntity.id === cone.id;
    const s = fScale(CONE_SIZE_FU);
    return (
      <G key={`cone-${i}`}>
        {sel && <Circle cx={p.x} cy={p.y} r={s + 4} stroke="#fff" strokeWidth={2} fill="none" />}
        <Polygon points={`${p.x},${p.y-s-2} ${p.x-s},${p.y+s} ${p.x+s},${p.y+s}`} fill={CONE_COLOR} stroke="black" strokeWidth={0.8} />
      </G>
    );
  });

  // Balls (white circle + black pentagon)
  const renderBalls = useMemo(() => {
    return diagram.balls.map((ball, i) => {
      const p = toSvg(ball.position.x, ball.position.y);
      const sel = selectedEntity?.type === 'ball' && selectedEntity.id === ball.id;
      const r = fScale(BALL_RADIUS_FU);
      const pentR = r * 0.5;
      const pentPts = Array.from({ length: 5 }, (_, k) => {
        const angle = (-Math.PI / 2) + (2 * Math.PI * k) / 5;
        return `${p.x + pentR * Math.cos(angle)},${p.y + pentR * Math.sin(angle)}`;
      }).join(' ');
      return (
        <G key={`ball-${i}`}>
          {sel && <Circle cx={p.x} cy={p.y} r={r + 4} stroke="#fff" strokeWidth={2} fill="none" />}
          <Circle cx={p.x} cy={p.y} r={r} fill="white" stroke="black" strokeWidth={1.5} />
          <Polygon points={pentPts} fill="black" />
        </G>
      );
    });
  }, [diagram, selectedEntity, toSvg, fScale]);

  // Actions with PositionTracker for chaining
  const renderActions = useMemo(() => {
    const tracker = createPositionTracker(diagram);
    const lineW = fScale(LINE_WIDTH_FU);
    const ahW = fScale(ARROW_HEAD_W_FU);
    const ahL = fScale(ARROW_HEAD_L_FU);
    const playerOff = fScale(PLAYER_OFFSET_FU);
    const actionGap = fScale(ACTION_GAP_FU);

    return diagram.actions.map((action, i) => {
      let fromFU: FieldPosition, toFU: FieldPosition;
      let startIsPlayer = true, endIsPlayer = true;

      if (action.type === 'PASS') {
        fromFU = tracker.getPos(action.fromPlayerId);
        toFU = tracker.getPos(action.toPlayerId);
        startIsPlayer = tracker.isAtStart(action.fromPlayerId);
        endIsPlayer = tracker.isAtStart(action.toPlayerId);
        tracker.transferBall(action.toPlayerId);
      } else if (action.type === 'RUN') {
        fromFU = tracker.getPos(action.playerId);
        toFU = action.toPosition;
        startIsPlayer = tracker.isAtStart(action.playerId);
        endIsPlayer = false;
        tracker.updatePos(action.playerId, toFU.x, toFU.y);
      } else if (action.type === 'DRIBBLE') {
        fromFU = tracker.getPos(action.playerId);
        toFU = action.toPosition;
        startIsPlayer = tracker.isAtStart(action.playerId);
        endIsPlayer = false;
        tracker.updatePos(action.playerId, toFU.x, toFU.y);
      } else { // SHOT
        fromFU = tracker.getPos(action.playerId);
        toFU = action.toPosition || { x: 50, y: 100 };
        startIsPlayer = tracker.isAtStart(action.playerId);
        endIsPlayer = false;
      }

      const from = toSvg(fromFU.x, fromFU.y);
      const to = toSvg(toFU.x, toFU.y);
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return null;
      const nx = dx / len, ny = dy / len;

      const startOff = startIsPlayer ? playerOff : actionGap;
      const endOff = endIsPlayer ? playerOff : actionGap;
      const sx = from.x + nx * startOff, sy = from.y + ny * startOff;
      const ex = to.x - nx * endOff, ey = to.y - ny * endOff;

      const isShot = action.type === 'SHOT';
      const color = isShot ? SHOT_COLOR : '#ffffff';
      const lw = isShot ? lineW * 1.5 : lineW;
      const curAhW = isShot ? ahW * 1.3 : ahW;
      const curAhL = isShot ? ahL * 1.5 : ahL;
      const sel = selectedEntity?.type === 'action' && selectedEntity.id === action.id;

      // Arrowhead points
      const aex = ex, aey = ey;
      const a1x = aex - nx * curAhL + ny * curAhW, a1y = aey - ny * curAhL - nx * curAhW;
      const a2x = aex - nx * curAhL - ny * curAhW, a2y = aey - ny * curAhL + nx * curAhW;
      const lineEndX = aex - nx * curAhL, lineEndY = aey - ny * curAhL;

      if (action.type === 'DRIBBLE') {
        // Wavy line in field-unit space
        const sLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const amp = fScale(DRIBBLE_AMP_FU);
        const ddx = lineEndX - sx, ddy = lineEndY - sy;
        const segLen = Math.sqrt(ddx * ddx + ddy * ddy);
        const perpX = segLen > 0 ? -ddy / segLen : 0;
        const perpY = segLen > 0 ? ddx / segLen : 0;
        let pathD = `M ${sx} ${sy}`;
        const steps = 50;
        for (let t = 1; t <= steps; t++) {
          const frac = t / steps;
          const wave = amp * Math.sin(DRIBBLE_FREQ * Math.PI * frac);
          pathD += ` L ${sx + ddx * frac + perpX * wave} ${sy + ddy * frac + perpY * wave}`;
        }
        return (
          <G key={`act-${i}`} opacity={sel ? 1 : 0.85}>
            <Path d={pathD} stroke={color} strokeWidth={lw} fill="none" />
            <Polygon points={`${aex},${aey} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} />
          </G>
        );
      }

      const isDashed = action.type === 'RUN';
      return (
        <G key={`act-${i}`} opacity={sel ? 1 : 0.85}>
          <Line x1={sx} y1={sy} x2={lineEndX} y2={lineEndY} stroke={color} strokeWidth={lw} strokeDasharray={isDashed ? '6,4' : undefined} strokeLinecap="round" />
          <Polygon points={`${aex},${aey} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} />
        </G>
      );
    });
  }, [diagram, selectedEntity, toSvg, fScale]);

  // Players (colored circle + white edge)
  const renderPlayers = () => diagram.players.map((player, i) => {
    const p = toSvg(player.position.x, player.position.y);
    const color = PLAYER_COLORS[player.role] || '#f4a261';
    const sel = selectedEntity?.type === 'player' && selectedEntity.id === player.id;
    const pend = pendingActionFrom === player.id;
    const r = fScale(PLAYER_RADIUS_FU);
    return (
      <G key={`p-${i}`}>
        {(sel || pend) && <Circle cx={p.x} cy={p.y} r={r + 4} stroke={pend ? '#facc15' : '#fff'} strokeWidth={2.5} fill="none" />}
        <Circle cx={p.x} cy={p.y} r={r} fill={color} stroke="white" strokeWidth={1.5} />
      </G>
    );
  });

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => tool === 'select'}
        onResponderGrant={(e) => { handlePress(e); handleTouchStart(e); }}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
      >
        <Svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {renderGrass()}
          {renderMarkings()}
          {renderConeLines()}
          {renderCones()}
          {renderCustomGoals()}
          {renderActions}
          {renderPlayers()}
          {renderBalls}
        </Svg>

        {selectedEntity?.type === 'goal' && (() => {
          const goal = diagram.goals.find(g => g.id === selectedEntity.id);
          if (!goal) return null;
          const pos = toSvg(goal.position.x, goal.position.y);
          return (
            <TouchableOpacity
              style={{
                position: 'absolute',
                left: pos.x - 16,
                top: pos.y - fScale(8) - 36,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(74,157,110,0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={handleRotateGoal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RotateCw size={16} color="#fff" />
            </TouchableOpacity>
          );
        })()}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
});
