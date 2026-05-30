import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Session } from '../types/session';
import { Drill, DrillJsonData, PdfSettings, defaultPdfSettings } from '../types/drill';
import { convertToDrillJson } from './drillConverter';

// ── Inline SVG generator for custom drill diagrams ──────────────────
// Mirrors DrillDiagramView rendering logic as plain SVG markup for the PDF.

const GRASS_LIGHT = '#6fbf4a';
const GRASS_DARK  = '#63b043';
const LINE_COLOR  = '#ffffff';
const GOAL_COLOR  = '#ffffff';
const CONE_COLOR  = '#f4a261';
const SHOT_COLOR  = '#ff6b6b';
const PLAYER_COLORS: Record<string, string> = {
  attacker: '#e63946', defender: '#457b9d', goalkeeper: '#f1fa3c', neutral: '#f4a261',
  ATTACKER: '#e63946', DEFENDER: '#457b9d', GOALKEEPER: '#f1fa3c', NEUTRAL: '#f4a261',
};

function calcBounds(dj: DrillJsonData, pad = 8) {
  const xs: number[] = [], ys: number[] = [];
  dj.players?.forEach(p => { xs.push(p.position.x); ys.push(p.position.y); });
  dj.cones?.forEach(c => { xs.push(c.position.x); ys.push(c.position.y); });
  dj.balls?.forEach(b => { xs.push(b.position.x); ys.push(b.position.y); });
  dj.goals?.forEach(g => { xs.push(g.position.x - 4, g.position.x + 4); ys.push(g.position.y - 3, g.position.y + 3); });
  dj.mini_goals?.forEach(g => { xs.push(g.position.x - 2, g.position.x + 2); ys.push(g.position.y - 2, g.position.y + 2); });
  dj.actions?.forEach(a => { if (a.to_position) { xs.push(a.to_position.x); ys.push(a.to_position.y); } });
  if (xs.length === 0) { xs.push(25, 75); } if (ys.length === 0) { ys.push(25, 75); }
  let xMin = Math.max(0, Math.min(...xs) - pad), xMax = Math.min(100, Math.max(...xs) + pad);
  let yMin = Math.max(0, Math.min(...ys) - pad), yMax = Math.min(100, Math.max(...ys) + pad);
  if (xMax - xMin < 30) { const c = (xMin + xMax) / 2; xMin = Math.max(0, c - 15); xMax = Math.min(100, c + 15); }
  if (yMax - yMin < 30) { const c = (yMin + yMax) / 2; yMin = Math.max(0, c - 15); yMax = Math.min(100, c + 15); }
  const markings = dj.field?.markings ?? (dj.field as any)?.show_markings ?? true;
  const goals = dj.field?.goals ?? 0;
  if (markings && goals >= 1 && yMax > 70) yMax = 100;
  if (markings && goals >= 2 && yMin < 30) yMin = 0;
  if (markings) { const dL = 50 - xMin, dR = xMax - 50, m = Math.max(dL, dR); xMin = 50 - m; xMax = 50 + m; }
  return { xMin, xMax, yMin, yMax };
}

function diagramToSvgString(dj: DrillJsonData, W = 440, H = 330): string {
  const PAD = 0;
  const rawBounds = calcBounds(dj);

  // Force the viewport to 4:3 by expanding the shorter dimension so the
  // rendered diagram matches library drill SVGs (which are always 4:3).
  const bw0 = rawBounds.xMax - rawBounds.xMin;
  const bh0 = rawBounds.yMax - rawBounds.yMin;
  const targetRatio = 4 / 3; // field units width:height
  let bounds = { ...rawBounds };
  if (bw0 / bh0 > targetRatio) {
    // Too wide — expand height
    const newBh = bw0 / targetRatio;
    const cy = (rawBounds.yMin + rawBounds.yMax) / 2;
    bounds.yMin = Math.max(0, cy - newBh / 2);
    bounds.yMax = Math.min(100, cy + newBh / 2);
  } else {
    // Too tall — expand width
    const newBw = bh0 * targetRatio;
    const cx = (rawBounds.xMin + rawBounds.xMax) / 2;
    bounds.xMin = Math.max(0, cx - newBw / 2);
    bounds.xMax = Math.min(100, cx + newBw / 2);
  }

  const bw = bounds.xMax - bounds.xMin, bh = bounds.yMax - bounds.yMin;
  const fw = W - PAD * 2, fh = H - PAD * 2;
  const markings = dj.field?.markings ?? (dj.field as any)?.show_markings ?? true;
  const fieldGoals = dj.field?.goals ?? 0;

  const tx = (fx: number) => PAD + ((fx - bounds.xMin) / bw) * fw;
  const ty = (fy: number) => PAD + ((fy - bounds.yMin) / bh) * fh;
  const fs = (u: number) => (u / bw) * fw; // field scale
  const es = (u: number) => (u / Math.max(bw, bh)) * Math.min(fw, fh); // entity scale

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${W} ${H}" style="display:block;">`;

  // Grass stripes
  const sw = 10, spx = fs(sw);
  const si0 = Math.floor((bounds.xMin - 20) / sw), si1 = Math.ceil((bounds.xMax + 20) / sw);
  for (let si = si0; si <= si1; si++) {
    const sx = PAD + ((si * sw - bounds.xMin) / bw) * fw;
    svg += `<rect x="${sx}" y="0" width="${spx}" height="${H}" fill="${si % 2 === 0 ? GRASS_LIGHT : GRASS_DARK}"/>`;
  }

  // Field markings
  if (markings) {
    const lw = 1.5;
    const L = (x1: number, y1: number, x2: number, y2: number, extra = '') =>
      `<line x1="${tx(x1)}" y1="${ty(y1)}" x2="${tx(x2)}" y2="${ty(y2)}" stroke="${LINE_COLOR}" stroke-width="${lw}" ${extra}/>`;
    const C = (cx: number, cy: number, r: number, extra = '') =>
      `<circle cx="${tx(cx)}" cy="${ty(cy)}" r="${r}" stroke="${LINE_COLOR}" stroke-width="${lw}" fill="none" ${extra}/>`;

    if (bounds.yMin <= 50 && bounds.yMax >= 50) svg += L(bounds.xMin, 50, bounds.xMax, 50);
    if (bounds.yMin <= 50 && bounds.yMax >= 50 && bounds.xMin <= 50 && bounds.xMax >= 50) {
      svg += C(50, 50, fs(10));
      svg += `<circle cx="${tx(50)}" cy="${ty(50)}" r="2" fill="${LINE_COLOR}"/>`;
    }

    const drawPen = (goalY: number, drawGoal: boolean) => {
      const into = goalY === 100 ? -1 : 1;
      const penY = goalY + into * 18, sixY = goalY + into * 6, spotY = goalY + into * 12;
      svg += L(30, goalY, 70, goalY);
      svg += L(30, penY, 70, penY); svg += L(30, goalY, 30, penY); svg += L(70, goalY, 70, penY);
      svg += L(42, sixY, 58, sixY); svg += L(42, goalY, 42, sixY); svg += L(58, goalY, 58, sixY);
      svg += `<circle cx="${tx(50)}" cy="${ty(spotY)}" r="2" fill="${LINE_COLOR}"/>`;
      if (drawGoal) {
        const depth = 3, pw = 2.5, netDir = goalY >= 50 ? 1 : -1;
        const crossY = goalY + netDir * depth;
        svg += `<line x1="${tx(46)}" y1="${ty(goalY)}" x2="${tx(54)}" y2="${ty(goalY)}" stroke="gray" stroke-width="1.5" opacity="0.6"/>`;
        for (let j = 0; j <= 8; j++) { const nx = 46 + j; svg += `<line x1="${tx(nx)}" y1="${ty(goalY)}" x2="${tx(nx)}" y2="${ty(crossY)}" stroke="gray" stroke-width="0.5" opacity="0.4"/>`; }
        svg += `<line x1="${tx(46)}" y1="${ty(goalY)}" x2="${tx(46)}" y2="${ty(crossY)}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
        svg += `<line x1="${tx(54)}" y1="${ty(goalY)}" x2="${tx(54)}" y2="${ty(crossY)}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
        svg += `<line x1="${tx(46)}" y1="${ty(crossY)}" x2="${tx(54)}" y2="${ty(crossY)}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
      }
    };
    if (bounds.yMax >= 85) drawPen(100, fieldGoals >= 1);
    if (dj.field?.type === 'FULL' && bounds.yMin <= 15) drawPen(0, fieldGoals >= 2);
  }

  // Cone lines
  const cones = dj.cones || [];
  (dj.cone_lines || []).forEach(cl => {
    if (cl.from_cone >= cones.length || cl.to_cone >= cones.length) return;
    const p1 = cones[cl.from_cone].position, p2 = cones[cl.to_cone].position;
    svg += `<line x1="${tx(p1.x)}" y1="${ty(p1.y)}" x2="${tx(p2.x)}" y2="${ty(p2.y)}" stroke="${CONE_COLOR}" stroke-width="2" opacity="0.8"/>`;
  });

  // Cones
  const mScaleCone = markings ? 2/3 : 1;
  cones.forEach(c => {
    const px = tx(c.position.x), py = ty(c.position.y);
    const s = es(1.2) * mScaleCone;
    svg += `<polygon points="${px},${py - s - 2} ${px - s},${py + s} ${px + s},${py + s}" fill="${CONE_COLOR}" stroke="black" stroke-width="0.8"/>`;
  });

  // Goals helper
  const drawGoalSvg = (rawCx: number, rawCy: number, r: number, w: number, d: number, pw: number, ns: number, anchorFront = false) => {
    let cx = rawCx, cy = rawCy;
    if (anchorFront) {
      if (r === 0) cy -= d; else if (r === 90) cx -= d; else if (r === 180) cy += d; else cx += d;
    }
    let bl1x: number, bl1y: number, bl2x: number, bl2y: number;
    let tl1x: number, tl1y: number, tl2x: number, tl2y: number;
    const nets: string[] = [];
    if (r === 0) {
      bl1x = tx(cx-w/2); bl1y = ty(cy); bl2x = tx(cx+w/2); bl2y = ty(cy);
      tl1x = tx(cx-w/2); tl1y = ty(cy+d); tl2x = tx(cx+w/2); tl2y = ty(cy+d);
      for (let j = 0; j < ns; j++) { const nx = cx-w/2+j*(w/(ns-1)); nets.push(`<line x1="${tx(nx)}" y1="${ty(cy)}" x2="${tx(nx)}" y2="${ty(cy+d)}" stroke="gray" stroke-width="0.5" opacity="0.4"/>`); }
    } else if (r === 90) {
      bl1x = tx(cx); bl1y = ty(cy-w/2); bl2x = tx(cx); bl2y = ty(cy+w/2);
      tl1x = tx(cx+d); tl1y = ty(cy-w/2); tl2x = tx(cx+d); tl2y = ty(cy+w/2);
      for (let j = 0; j < ns; j++) { const ny = cy-w/2+j*(w/(ns-1)); nets.push(`<line x1="${tx(cx)}" y1="${ty(ny)}" x2="${tx(cx+d)}" y2="${ty(ny)}" stroke="gray" stroke-width="0.5" opacity="0.4"/>`); }
    } else if (r === 180) {
      bl1x = tx(cx-w/2); bl1y = ty(cy); bl2x = tx(cx+w/2); bl2y = ty(cy);
      tl1x = tx(cx-w/2); tl1y = ty(cy-d); tl2x = tx(cx+w/2); tl2y = ty(cy-d);
      for (let j = 0; j < ns; j++) { const nx = cx-w/2+j*(w/(ns-1)); nets.push(`<line x1="${tx(nx)}" y1="${ty(cy)}" x2="${tx(nx)}" y2="${ty(cy-d)}" stroke="gray" stroke-width="0.5" opacity="0.4"/>`); }
    } else {
      bl1x = tx(cx); bl1y = ty(cy-w/2); bl2x = tx(cx); bl2y = ty(cy+w/2);
      tl1x = tx(cx-d); tl1y = ty(cy-w/2); tl2x = tx(cx-d); tl2y = ty(cy+w/2);
      for (let j = 0; j < ns; j++) { const ny = cy-w/2+j*(w/(ns-1)); nets.push(`<line x1="${tx(cx)}" y1="${ty(ny)}" x2="${tx(cx-d)}" y2="${ty(ny)}" stroke="gray" stroke-width="0.5" opacity="0.4"/>`); }
    }
    svg += `<line x1="${bl1x}" y1="${bl1y}" x2="${bl2x}" y2="${bl2y}" stroke="gray" stroke-width="1.5" opacity="0.6"/>`;
    nets.forEach(n => { svg += n; });
    svg += `<line x1="${bl1x}" y1="${bl1y}" x2="${tl1x}" y2="${tl1y}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
    svg += `<line x1="${bl2x}" y1="${bl2y}" x2="${tl2x}" y2="${tl2y}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
    svg += `<line x1="${tl1x}" y1="${tl1y}" x2="${tl2x}" y2="${tl2y}" stroke="${GOAL_COLOR}" stroke-width="${pw}" stroke-linecap="round"/>`;
  };

  // Full goals
  (dj.goals || []).forEach(g => { if (g.size !== 'small') drawGoalSvg(g.position.x, g.position.y, g.rotation || 0, 8, 3, 2.5, 9, false); });
  // Mini goals
  const mgScale = markings ? 3/4 : 1;
  (dj.mini_goals || []).forEach(g => { drawGoalSvg(g.position.x, g.position.y, g.rotation || 0, 4*mgScale, 2*mgScale, 1.8*mgScale, 5, true); });

  // Actions
  const tracker: Record<string, {x: number, y: number}> = {};
  (dj.players || []).forEach(p => { tracker[p.id] = { ...p.position }; });
  const mScaleAct = markings ? 3/4 : 1;
  const arrowOff = es(2.5) * mScaleAct, gapOff = es(0.8) * mScaleAct;
  const lineW = es(0.35) * mScaleAct, ahW = es(1.2) * mScaleAct, ahL = es(1.0) * mScaleAct;

  (dj.actions || []).forEach(action => {
    let fromFP: {x:number,y:number}, toFP: {x:number,y:number};
    let sIsP = true, eIsP = true;
    if (action.type === 'PASS') {
      fromFP = tracker[action.from_player!] || { x: 50, y: 50 };
      toFP = tracker[action.to_player!] || { x: 50, y: 50 };
    } else {
      const pid = action.player!;
      fromFP = tracker[pid] || { x: 50, y: 50 };
      toFP = action.to_position || { x: 50, y: 100 };
      eIsP = false;
      if (action.type === 'RUN' || action.type === 'DRIBBLE') tracker[pid] = { ...toFP };
    }
    const from = { x: tx(fromFP.x), y: ty(fromFP.y) }, to = { x: tx(toFP.x), y: ty(toFP.y) };
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx*dx + dy*dy);
    if (len < 2) return;
    const nx = dx/len, ny = dy/len;
    const sOff = sIsP ? arrowOff : gapOff, eOff = eIsP ? arrowOff : gapOff;
    const sx = from.x + nx*sOff, sy = from.y + ny*sOff;
    const ex = to.x - nx*eOff, ey = to.y - ny*eOff;
    const color = action.type === 'SHOT' ? SHOT_COLOR : '#ffffff';
    const lw = action.type === 'SHOT' ? lineW*1.5 : lineW;
    const cAhW = action.type === 'SHOT' ? ahW*1.3 : ahW, cAhL = action.type === 'SHOT' ? ahL*1.5 : ahL;
    const leX = ex - nx*cAhL, leY = ey - ny*cAhL;
    const a1x = leX + ny*cAhW, a1y = leY - nx*cAhW, a2x = leX - ny*cAhW, a2y = leY + nx*cAhW;
    if (action.type === 'DRIBBLE') {
      const amp = es(0.8)*mScaleAct, ddx = leX-sx, ddy = leY-sy, segLen = Math.sqrt(ddx*ddx+ddy*ddy);
      const perpX = segLen > 0 ? -ddy/segLen : 0, perpY = segLen > 0 ? ddx/segLen : 0;
      let d = `M ${sx} ${sy}`;
      for (let t = 1; t <= 50; t++) { const f = t/50; const wave = amp*Math.sin(8*Math.PI*f); d += ` L ${sx+ddx*f+perpX*wave} ${sy+ddy*f+perpY*wave}`; }
      svg += `<path d="${d}" stroke="${color}" stroke-width="${lw}" fill="none" opacity="0.85"/>`;
    } else {
      const dash = action.type === 'RUN' ? 'stroke-dasharray="8,4"' : '';
      svg += `<line x1="${sx}" y1="${sy}" x2="${leX}" y2="${leY}" stroke="${color}" stroke-width="${lw}" stroke-linecap="round" ${dash} opacity="0.85"/>`;
    }
    svg += `<polygon points="${ex},${ey} ${a1x},${a1y} ${a2x},${a2y}" fill="${color}" opacity="0.85"/>`;
  });

  // Players
  const pScale = markings ? 3/4 : 1;
  (dj.players || []).forEach(p => {
    const px = tx(p.position.x), py = ty(p.position.y);
    const color = PLAYER_COLORS[p.role] || PLAYER_COLORS[p.role?.toLowerCase()] || '#888';
    const r = es(1.8) * pScale, sw2 = Math.max(1, es(0.4) * pScale);
    svg += `<circle cx="${px}" cy="${py}" r="${r}" fill="${color}" stroke="white" stroke-width="${sw2}"/>`;
  });

  // Balls
  const mScaleBall = markings ? 3/4 : 1;
  (dj.balls || []).forEach(b => {
    const px = tx(b.position.x), py = ty(b.position.y);
    const r = es(1.4) * mScaleBall, bsw = Math.max(0.8, es(0.3)*mScaleBall);
    const pentR = r * 0.45;
    const pts = Array.from({length:5},(_,k)=>{const a=(-Math.PI/2)+(2*Math.PI*k)/5;return `${px+pentR*Math.cos(a)},${py+pentR*Math.sin(a)}`;}).join(' ');
    svg += `<circle cx="${px}" cy="${py}" r="${r}" fill="white" stroke="black" stroke-width="${bsw}"/>`;
    svg += `<polygon points="${pts}" fill="black"/>`;
  });

  svg += `</svg>`;
  return svg;
}

function formatTime(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

function formatBulletPoints(text: string): string[] {
  return text
    .split(/\n|(?:\d+\.\s)/)
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

// Minimalistic SVG icons (inline, no emoji)
const icons = {
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  timer: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 3px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  note: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  checkbox: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
};

function buildSessionHtml(session: Session, drillDetails?: Record<string, Drill>, pdfSettings?: PdfSettings): string {
  const settings = pdfSettings || defaultPdfSettings;
  const totalDuration = session.activities.reduce((s, a) => s + a.duration_minutes, 0);

  const dateStr = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  let html = `
    <div style="font-family: -apple-system, 'Helvetica Neue', Helvetica, sans-serif; max-width: 780px; margin: 0 auto; padding: 20px 16px; color: #1a1a1a;">
      <!-- Header -->
      <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #111;">${session.title || 'Training Session'}</h1>
        <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: #555; align-items: center;">
          ${dateStr ? `<span>${icons.calendar} ${dateStr}</span>` : ''}
          ${session.session_time ? `<span>${icons.clock} ${session.session_time}</span>` : ''}
          ${session.team_name ? `<span>${icons.users} ${session.team_name}</span>` : ''}
          <span>${icons.timer} ${totalDuration} min total</span>
        </div>
      </div>
  `;

  if (session.session_goals) {
    html += `
      <div style="background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">${icons.target} Session Goals</div>
        <p style="margin: 0; font-size: 12px; color: #333; line-height: 1.5;">${session.session_goals}</p>
      </div>
    `;
  }

  // Activities
  html += `<div style="font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">Activities</div>`;

  let currentTime = 0;
  session.activities.forEach((activity) => {
    const title = activity.title || activity.drill_name || 'Activity';
    const description = activity.description || '';
    const drillData = activity.library_drill_id && drillDetails ? drillDetails[activity.library_drill_id] : null;
    const instructions = drillData?.instructions || activity.drill_instructions || '';
    const setup = drillData?.setup || activity.drill_setup || '';

    const showDiagram = settings.includeDiagram && (activity.drill_svg_url || activity.drill_diagram_data);

    let diagramHtml = '';
    if (settings.includeDiagram) {
      if (activity.drill_svg_url) {
        diagramHtml = `<img src="${activity.drill_svg_url}" style="width: 100%; height: auto; display: block;">`;
      } else if (activity.drill_diagram_data) {
        const djData = convertToDrillJson(activity.drill_diagram_data);
        diagramHtml = diagramToSvgString(djData);
      }
    }
    const showSetup = settings.includeSetup && setup;
    const showInstructions = settings.includeInstructions && instructions;
    const hasTextContent = showSetup || showInstructions || description;

    html += `
      <div style="margin-bottom: 12px; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 6px 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; font-size: 12px; color: #111;">
            <span style="color: #16a34a; font-family: monospace; margin-right: 6px;">${formatTime(currentTime)}</span>
            ${title.toUpperCase()}
          </div>
          <div style="font-size: 11px; color: #666; font-weight: 600;">${icons.timer} ${activity.duration_minutes} min</div>
        </div>
        <div style="padding: 10px 12px;">
    `;

    if (showDiagram && hasTextContent) {
      // Diagram + text side by side
      html += `<div style="display: flex; gap: 10px; align-items: flex-start;">`;
      html += `<div style="flex-shrink: 0; border-radius: 6px; overflow: hidden; width: 220px;">${diagramHtml}</div>`;
      html += `<div style="flex: 1; min-width: 0;">`;
      if (description) {
        html += `<p style="color: #444; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">${description}</p>`;
      }
      if (showSetup) {
        const setupPoints = formatBulletPoints(setup);
        if (setupPoints.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
      if (showInstructions) {
        const points = formatBulletPoints(instructions);
        if (points.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${points.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
      html += `</div></div>`;
    } else if (showDiagram && !hasTextContent) {
      // Diagram only
      html += `<div style="margin-bottom: 8px; border-radius: 6px; overflow: hidden; max-width: 280px;">${diagramHtml}</div>`;
    } else if (!showDiagram && hasTextContent) {
      // No diagram — put setup and instructions side by side when both present
      if (description) {
        html += `<p style="color: #444; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">${description}</p>`;
      }
      if (showSetup && showInstructions) {
        const setupPoints = formatBulletPoints(setup);
        const instrPoints = formatBulletPoints(instructions);
        html += `<div style="display: flex; gap: 12px; align-items: flex-start;">`;
        if (setupPoints.length > 0) {
          html += `
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
        if (instrPoints.length > 0) {
          html += `
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${instrPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
        html += `</div>`;
      } else if (showSetup) {
        const setupPoints = formatBulletPoints(setup);
        if (setupPoints.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      } else if (showInstructions) {
        const points = formatBulletPoints(instructions);
        if (points.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${points.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
    }

    if (activity.activity_notes) {
      html += `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 5px 10px; border-radius: 6px; margin-top: 6px;">
          <span style="font-size: 10px; color: #166534;">${icons.note} ${activity.activity_notes}</span>
        </div>
      `;
    }

    html += '</div></div>';
    currentTime += activity.duration_minutes;
  });

  // Equipment
  if (session.equipment.length > 0) {
    html += `
      <div style="margin-top: 16px; page-break-inside: avoid;">
        <div style="font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">Equipment Checklist</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${session.equipment.map(e => `<span style="display: inline-flex; align-items: center; gap: 5px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 16px; padding: 4px 12px; font-size: 11px;">${icons.checkbox} ${e.name}${e.quantity ? ` (×${e.quantity})` : ''}</span>`).join('')}
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Generate a PDF from a session and return the file URI.
 */
export async function exportSessionToPDF(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<string> {
  const html = buildSessionHtml(session, drillDetails, pdfSettings);

  const fullHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 12mm; }
          }
        </style>
      </head>
      <body style="margin: 0; background: white;">
        ${html}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({
    html: fullHtml,
    base64: false,
  });

  return uri;
}

/**
 * Generate PDF and immediately open native share sheet.
 */
export async function exportAndSharePDF(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<void> {
  const uri = await exportSessionToPDF(session, drillDetails, pdfSettings);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${session.title || 'Session'} PDF`,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Generate PDF and return the URI for use with email/SMS composing.
 */
export async function generatePDFUri(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<string> {
  return exportSessionToPDF(session, drillDetails, pdfSettings);
}
