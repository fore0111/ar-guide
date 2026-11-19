// NAsVI「ARガイド」PV（1920×1080 / 30fps / 31秒）
// 描画は時刻 t の純関数 draw(t)。プレビューは実時間再生、書き出しは PV.renderAt(t) でフレーム単位に描画。
const W = 1920, H = 1080, FPS = 30, DUR = 31;
const RENDER = new URLSearchParams(location.search).has('render');
if (RENDER) document.body.classList.add('render');

// 配色はチームロゴ（nasbi-logo.html）のナス紫とヘタの緑を基準とする
const C = { paper: '#f6f3ff', ink: '#1e0b3a', dark: '#130a22', violet: '#6d28d9', lilac: '#a78bfa', deep: '#2e1065', leaf: '#10b981', mint: '#5eead4', yel: '#ffd84a', white: '#ffffff' };
const JP = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
const EN = '"Avenir Next Condensed","Avenir Next","Helvetica Neue",Arial,sans-serif';
const MONO = '"SF Mono",Menlo,monospace';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');

// ---------- 数学・イージング ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;
const eOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const eIn = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hash = (n) => { n |= 0; n = Math.imul(n ^ 61 ^ (n >>> 16), 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
const RAD = Math.PI / 180;

// ---------- 素材 ----------
// 動画は tools/render_pv.mjs が out/cache/<slot>/00001.jpg… へ事前展開したフレーム画像を使用（シークの確実性のため）
const shots = await fetch('shots.json').then((r) => r.json());
const cacheIdx = await fetch('out/cache/index.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const media = {};
await Promise.all(Object.entries(shots.slots).map(([k, v]) => new Promise((ok) => {
  const m = { ...v, video: /\.(mp4|mov|webm|m4v)$/i.test(v.src) };
  media[k] = m;
  if (m.video) {
    const c = cacheIdx[k];
    if (!c || c.src !== v.src) { console.warn('動画の展開が未実施:', k, '→ node tools/render_pv.mjs --prep'); return ok(); }
    Object.assign(m, { dir: `out/cache/${k}/`, count: c.count, w: c.w, h: c.h, frames: new Map(), ready: new Map(), last: null });
    return ok();
  }
  const el = new Image();
  el.onload = () => { m.el = el; m.w = el.naturalWidth; m.h = el.naturalHeight; ok(); };
  el.onerror = () => { console.warn('素材の読込失敗', v.src); ok(); };
  el.src = v.src;
})));
const [bData, eData] = await Promise.all(['../data/buildings.json', '../data/events.json'].map((u) => fetch(u).then((r) => r.json())));

function loadFrame(m, idx) {
  if (m.frames.has(idx)) return m.frames.get(idx);
  const pr = new Promise((ok) => {
    const im = new Image();
    im.onload = () => { m.ready.set(idx, im); ok(im); };
    im.onerror = () => ok(null);
    im.src = m.dir + String(idx + 1).padStart(5, '0') + '.jpg';
  });
  m.frames.set(idx, pr);
  if (m.frames.size > 120) { const old = m.frames.keys().next().value; m.frames.delete(old); m.ready.delete(old); }
  return pr;
}
const needs = [];
function src(slot, lt = 0) {
  const m = media[slot];
  if (!m) return null;
  if (!m.video) return m.el ? m : null;
  if (!m.count) return null;
  const idx = clamp(Math.round(((m.in || 0) + Math.max(0, lt)) * FPS), 0, m.count - 1);
  needs.push([m, idx]);
  const im = m.ready.get(idx);
  if (im) m.last = im;
  return m.last ? { el: m.last, w: m.w, h: m.h } : null;
}

// cover 配置で描画（zoom と pan でケン・バーンズ効果）
function cover(m, x, y, w, h, { zoom = 1, px = 0, py = 0, filter = '' } = {}) {
  if (!m) { ctx.fillStyle = '#1a2238'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / m.w, h / m.h) * zoom;
  const dw = m.w * s, dh = m.h * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (filter) ctx.filter = filter;
  ctx.drawImage(m.el, x + (w - dw) / 2 + px * (dw - w) / 2, y + (h - dh) / 2 + py * (dh - h) / 2, dw, dh);
  ctx.restore();
}

// ---------- 文字 ----------
// 1文字ずつ遅延して出現（mask: ベースライン下を隠し、文字がせり上がる表現）
function txt(s, x, y, o = {}) {
  const { size = 60, weight = 800, font = JP, color = C.white, align = 'left', track = 0, p = 1, stagger = 0.05,
    dy = 0.8, mask = false, stroke = 0, alpha = 1 } = o;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  const chars = [...s];
  const ws = chars.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  if (mask) { ctx.beginPath(); ctx.rect(cx - size, y - size * 1.25, total + size * 2, size * 1.55); ctx.clip(); }
  const n = chars.length;
  chars.forEach((c, i) => {
    const q = clamp(p * (1 + stagger * (n - 1)) - stagger * i);
    const e = eOut(q);
    if (e > 0.001) {
      ctx.globalAlpha = alpha * (mask ? 1 : e);
      const oy = (1 - e) * size * dy * (mask ? 1.4 : 1);
      if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = color; ctx.strokeText(c, cx, y + oy); }
      else { ctx.fillStyle = color; ctx.fillText(c, cx, y + oy); }
    }
    cx += ws[i] + track;
  });
  ctx.restore();
  return total;
}
function measure(s, size, weight = 800, font = JP, track = 0) {
  ctx.font = `${weight} ${size}px ${font}`;
  return ctx.measureText(s).width + track * ([...s].length - 1);
}

// ---------- 共通効果 ----------
const grain = Array.from({ length: 6 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  const g = c.getContext('2d'), id = g.createImageData(480, 270);
  for (let i = 0; i < id.data.length; i += 4) { const v = hash(i * 7 + k * 99991) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
});
function film(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.05;
  ctx.drawImage(grain[Math.floor(t * FPS) % grain.length], 0, 0, W, H);
  ctx.restore();
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
// 場面転換: 緑と紫の色面が左から右へ通過
function wipe(t, c) {
  const cov = eInOut(lin(t, c - 0.3, c)), rev = eInOut(lin(t, c, c + 0.34));
  if (cov <= 0 || rev >= 1) return;
  const cov2 = eInOut(lin(t, c - 0.22, c)), rev2 = eInOut(lin(t, c + 0.08, c + 0.4));
  ctx.fillStyle = C.leaf; ctx.fillRect(W * rev, 0, W * (cov - rev), H);
  ctx.fillStyle = C.violet; ctx.fillRect(W * rev2, 0, Math.max(0, W * (cov2 - rev2)), H);
}

// ---------- ロゴ（nasbi-logo.html のマークを Canvas で再現） ----------
function eggplant(cx, cy, S, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(38 * RAD); ctx.translate(-S / 2, -S / 2);
  const x = 0.27 * S, y = 0.25 * S, w = 0.46 * S, h = 0.68 * S, rx = w / 2, my = y + h * 0.68;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, C.lilac); g.addColorStop(0.42, C.violet); g.addColorStop(1, C.deep);
  ctx.beginPath(); ctx.ellipse(x + rx, my, rx, h * 0.68, 0, Math.PI, 0); ctx.ellipse(x + rx, my, rx, h * 0.32, 0, 0, Math.PI); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.022 * S; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x + w * 0.36, y + h * 0.62, w * 0.17, h * 0.2, 0, Math.PI * 0.75, Math.PI * 1.25); ctx.stroke();
  const bx = 0.36 * S, by = 0.19 * S, bw = 0.28 * S, bh = 0.2 * S;
  const lg = ctx.createLinearGradient(0, by, 0, by + bh); lg.addColorStop(0, C.mint); lg.addColorStop(1, C.leaf);
  ctx.beginPath();
  [[50, 0], [100, 22], [94, 100], [71, 52], [50, 100], [29, 52], [6, 100], [0, 22]].forEach(([px, py], i) => {
    const X = bx + bw * px / 100, Y = by + bh * py / 100; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  });
  ctx.closePath(); ctx.fillStyle = lg; ctx.fill();
  ctx.translate(0.5 * S, 0.22 * S); ctx.rotate(-14 * RAD);
  rrect(-0.022 * S, -0.13 * S, 0.044 * S, 0.13 * S, 0.022 * S); ctx.fillStyle = lg; ctx.fill();
  ctx.restore();
}
// ワードマーク（字間 0.22em、ロゴと同一の書体・配色）
function wordmark(s, cx, y, size, { light = true, p = 1, a = 1 } = {}) {
  ctx.save(); ctx.font = `800 ${size}px "Avenir Next","Futura","Helvetica Neue",sans-serif`; ctx.textBaseline = 'alphabetic';
  const tr = size * 0.22, chars = [...s], ws = chars.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((x, v) => x + v, 0) + tr * (chars.length - 1);
  const g = ctx.createLinearGradient(cx - total / 2, 0, cx + total / 2, 0);
  if (light) { g.addColorStop(0, C.ink); g.addColorStop(1, C.violet); } else { g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#ddd6fe'); g.addColorStop(1, C.lilac); }
  ctx.fillStyle = g;
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    const e = eOut(clamp(p * (1 + 0.12 * (chars.length - 1)) - 0.12 * i));
    ctx.globalAlpha = a * e; ctx.fillText(c, x, y + (1 - e) * size * 0.35); x += ws[i] + tr;
  });
  ctx.restore();
  return total;
}

// ---------- スマートフォン枠 ----------
// 画面内容は slot を横から差し替え（wipe: 0→1 で next が右から進入）
function phone(cx, cy, h, rot, slot, lt, next = null, wipe = 0) {
  const w = h * 0.4615, r = w * 0.16, b = w * 0.032;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 40;
  rrect(-w / 2, -h / 2, w, h, r); ctx.fillStyle = '#08080a'; ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.22)'; rrect(-w / 2, -h / 2, w, h, r); ctx.stroke();
  const sx = -w / 2 + b, sy = -h / 2 + b, sw = w - 2 * b, sh = h - 2 * b;
  ctx.save(); rrect(sx, sy, sw, sh, r - b); ctx.clip();
  cover(src(slot, lt), sx, sy, sw, sh);
  if (next && wipe > 0) {
    const e = eInOut(wipe), ox = sw * (1 - e);
    cover(src(next, 0), sx + ox, sy, sw, sh);
    ctx.fillStyle = C.leaf; ctx.fillRect(sx + ox - 6, sy, 6, sh);
  }
  const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();
  rrect(-w * 0.14, -h / 2 + b + h * 0.012, w * 0.28, h * 0.03, h * 0.015); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
  return { w, h, sx, sy, sw, sh };
}
// 端末ローカル座標（画面内の比率）→ 画面座標
function phonePt(cx, cy, rot, geo, u, v) {
  const lx = geo.sx + geo.sw * u, ly = geo.sy + geo.sh * v;
  return [cx + lx * Math.cos(rot) - ly * Math.sin(rot), cy + lx * Math.sin(rot) + ly * Math.cos(rot)];
}

// ---------- 会場データ（S5 の立体表示用） ----------
const U = { lat: 37.42526, lon: 138.77893 };
const MX = 111320 * Math.cos(U.lat * RAD), MY = 110540;
const toXY = (la, lo) => [(lo - U.lon) * MX, (la - U.lat) * MY];
const blds = bData.buildings.map((b) => {
  const pts = b.ring.map(([la, lo]) => toXY(la, lo));
  let A = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; A += x1 * y2 - x2 * y1; }
  const c = toXY(b.lat, b.lon);
  return { name: b.name, pts, c, d: Math.hypot(c[0], c[1]), hgt: clamp(7 + Math.sqrt(Math.abs(A / 2)) * 0.32, 7, 30), poi: null };
});
const pois = eData.pois.map((p) => {
  const b = p.building ? blds.find((x) => x.name === p.building) : null;
  const o = { name: p.name, title: p.events[0].title, xy: b ? b.c : toXY(p.lat, p.lon), b };
  if (b) b.poi = o;
  return o;
});
function castRay(ox, oy, dx, dy, maxT) {
  let best = null, bt = maxT;
  for (const b of blds) {
    const n = b.pts.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = b.pts[i], [x2, y2] = b.pts[(i + 1) % n];
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den, u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
      if (t > 0.5 && t < bt && u >= 0 && u <= 1) { bt = t; best = b; }
    }
  }
  return { b: best, t: bt };
}

// ---------- 経路探索（S5 のナビゲーション演出用） ----------
// 3m 格子上で建物を障害物として A* 探索し、見通し判定で間引いた後に角を丸める
const NAV = (() => {
  const dest = pois.find((p) => p.title === 'お化け屋敷') || pois.find((p) => p.b);
  const CELL = 3, N = 90, SZ = 2 * N + 1;
  const inPoly = (x, y, pts) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (const b of blds) {
    const xs = b.pts.map((q) => q[0]), ys = b.pts.map((q) => q[1]);
    b.bb = [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) + 3, Math.max(...ys) + 3];
  }
  const owner = new Array(SZ * SZ).fill(null);
  const id = (ix, iy) => (iy + N) * SZ + (ix + N);
  for (let iy = -N; iy <= N; iy++) for (let ix = -N; ix <= N; ix++) {
    const x = ix * CELL, y = iy * CELL;
    for (const b of blds) {
      if (x < b.bb[0] || x > b.bb[2] || y < b.bb[1] || y > b.bb[3]) continue;
      if ([[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([ox, oy]) => inPoly(x + ox, y + oy, b.pts))) { owner[id(ix, iy)] = b; break; }
    }
  }
  // 屋外通路を横断する渡り廊下も建物として登録されているため、建物の通過は高コストで許容（下を通過する想定）
  const inside = (ix, iy) => Math.abs(ix) <= N && Math.abs(iy) <= N;
  const solid = (ix, iy) => { const o = owner[id(ix, iy)]; return o !== null && o !== dest.b; };
  const gx = Math.round(dest.xy[0] / CELL), gy = Math.round(dest.xy[1] / CELL);
  // A*（二分ヒープ）
  const g = new Float32Array(SZ * SZ).fill(Infinity), from = new Int32Array(SZ * SZ).fill(-1);
  const heap = [];
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  g[id(0, 0)] = 0; push(0, id(0, 0));
  const goal = id(gx, gy);
  while (heap.length) {
    const [, k] = pop();
    if (k === goal) break;
    const ix = (k % SZ) - N, iy = Math.floor(k / SZ) - N;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = ix + dx, ny = iy + dy;
      if (!inside(nx, ny)) continue;
      const nk = id(nx, ny), ng = g[k] + (dx && dy ? 1.414 : 1) * (solid(nx, ny) ? 14 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + Math.hypot(gx - nx, gy - ny), nk); }
    }
  }
  let cells = [];
  for (let k = goal; k !== -1; k = from[k]) cells.push(k);
  cells.reverse();
  const cut = cells.findIndex((k) => owner[k] === dest.b);       // 目的の建物へ進入する手前で終了
  if (cut > 0) cells = cells.slice(0, cut);
  let pts = cells.map((k) => [((k % SZ) - N) * CELL, (Math.floor(k / SZ) - N) * CELL]);
  const sight = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 1.5);
    for (let i = 0; i <= n; i++) {
      const x = mix(a[0], b[0], i / n), y = mix(a[1], b[1], i / n);
      if (owner[id(Math.round(x / CELL), Math.round(y / CELL))]) return false;
    }
    return true;
  };
  const sp = [pts[0]];
  for (let i = 0; i < pts.length - 1;) { let j = pts.length - 1; while (j > i + 1 && !sight(pts[i], pts[j])) j--; sp.push(pts[j]); i = j; }
  pts = sp;
  for (let it = 0; it < 3; it++) { // Chaikin の角丸め
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o.push([mix(a[0], b[0], 0.25), mix(a[1], b[1], 0.25)], [mix(a[0], b[0], 0.75), mix(a[1], b[1], 0.75)]);
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  const at = (sdist) => {
    const d = clamp(sdist, 0, len); let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), a = pts[i - 1], b = pts[i];
    return { x: mix(a[0], b[0], f), y: mix(a[1], b[1], f), hx: b[0] - a[0], hy: b[1] - a[1], i, f };
  };
  console.log(`経路: ${Math.round(len)}m / ${pts.length}点`);
  return { dest, pts, cum, len, at };
})();

// ==================== 場面 ====================
// S1 来場者アンケートの回答（raijousya.md の原文）
const VOICES = [
  { t: '「配置図が広い分どうしても見づらかった」', hl: '見づらかった', x: 190, y: 290, r: -2, s: 50, at: 0.25 },
  { t: '「F1-7とかあるけど小さすぎて最初どこかわからなかった」', hl: 'どこかわからなかった', x: 470, y: 475, r: 1.4, s: 46, at: 0.95 },
  { t: '「会場内の案内ナビがあれば」', hl: '案内ナビがあれば', x: 250, y: 665, r: -1, s: 54, at: 1.65 },
  { t: '「スマホで位置情報とつなげてマップ案内できるようにしてほしい」', hl: 'マップ案内できるようにしてほしい', x: 400, y: 850, r: 1.8, s: 44, at: 2.35 },
];
function s1(lt) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.leaf; ctx.fillRect(120, 118, 14, 34);
  txt('来場者アンケートの回答から', 152, 148, { size: 34, weight: 700, color: C.ink, p: lin(lt, 0.05, 0.6), stagger: 0.03 });
  for (const v of VOICES) {
    const q = lin(lt, v.at, v.at + 0.55);
    if (q <= 0) continue;
    const e = eOut(q);
    ctx.save();
    ctx.font = `700 ${v.s}px ${JP}`;
    const tw = ctx.measureText(v.t).width, padX = 34, h = v.s * 2.0;
    ctx.translate(v.x, v.y + (1 - e) * 90); ctx.rotate((v.r + (1 - e) * 4) * RAD); ctx.globalAlpha = clamp(q * 3);
    ctx.save(); ctx.shadowColor = 'rgba(30,11,58,.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rrect(-padX, -h * 0.68, tw + padX * 2, h, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    // 蛍光ペンの強調
    const i = v.t.indexOf(v.hl), x0 = ctx.measureText(v.t.slice(0, i)).width, hw = ctx.measureText(v.hl).width;
    const hp = eInOut(lin(lt, v.at + 0.55, v.at + 1.05));
    ctx.fillStyle = C.yel; ctx.fillRect(x0 - 4, -v.s * 0.42, (hw + 8) * hp, v.s * 0.62);
    ctx.fillStyle = C.ink; ctx.textBaseline = 'alphabetic'; ctx.fillText(v.t, 0, 0);
    ctx.restore();
  }
}

// S2 構内の写真＋事実の一文
const S2CUTS = [['scene1', 0], ['scene2', 0.9], ['scene4', 1.75]];
function s2(lt) {
  const k = S2CUTS.reduce((a, c, i) => (lt >= c[1] ? i : a), 0), cl = lt - S2CUTS[k][1];
  cover(src(S2CUTS[k][0], cl), 0, 0, W, H, { zoom: 1.06 + cl * 0.05, py: k % 2 ? -0.2 : 0.2 });
  const bh = 230 * eOut(lin(lt, 0.2, 0.8));
  ctx.fillStyle = C.dark; ctx.fillRect(0, H - bh, W, bh);
  ctx.fillStyle = C.leaf; ctx.fillRect(0, H - bh, W, 6);
  ctx.save(); ctx.beginPath(); ctx.rect(0, H - bh, W, bh); ctx.clip();
  txt('会場マップへの不満が、いちばん多かった。', 120, H - 88, { size: 72, weight: 800, p: lin(lt, 0.4, 1.3), stagger: 0.035 });
  ctx.restore();
}

// S3 タイトル（製品名 NAsVI と、今回の機能）
function s3(lt) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const lp = lin(lt, 0.25, 1.0);
  const ww = (() => { ctx.font = '800 190px "Avenir Next","Futura","Helvetica Neue",sans-serif'; return ctx.measureText('NAsVI').width + 190 * 0.22 * 4; })();
  const mark = 250, gap = 20, total = mark + gap + ww, x0 = W / 2 - total / 2;
  const up = eInOut(lin(lt, 1.25, 1.85)) * 150;
  eggplant(x0 + mark / 2, 470 - up, mark * eBack(lin(lt, 0.2, 0.75)), lin(lt, 0.2, 0.4));
  wordmark('NAsVI', x0 + mark + gap + ww / 2, 535 - up, 190, { p: lp });
  txt('技大祭の案内 Web アプリ', W / 2, 640 - up, { size: 44, weight: 700, align: 'center', color: C.ink, p: lin(lt, 0.6, 1.2), stagger: 0.03 });
  // 機能の紹介
  const fp = lin(lt, 1.5, 2.1);
  if (fp > 0) {
    const e = eOut(fp);
    ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 60);
    ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - 520, 590, 1040, 2);
    const tag = 'きょう紹介する機能'; ctx.font = `700 30px ${JP}`;
    const tw = ctx.measureText(tag).width + 44;
    rrect(W / 2 - tw / 2, 630, tw, 54, 27); ctx.fillStyle = C.leaf; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, W / 2, 658);
    ctx.restore();
    txt('ARガイド', W / 2, 820, { size: 130, weight: 900, align: 'center', color: C.ink, mask: true, p: lin(lt, 1.6, 2.3), stagger: 0.08 });
    txt('カメラを向けると、企画の場所がわかる', W / 2, 910, { size: 44, weight: 700, align: 'center', color: C.violet, p: lin(lt, 1.9, 2.6), stagger: 0.025 });
  }
}

// S4 実演（端末＋機能説明）
const BEATS = [
  { slot: 'screenFront', jp: 'カメラを向ける', sub: ['正面の建物と、そこでやっている', '企画が出ます'] },
  { slot: 'screenLabels', jp: '会場のどこでも', sub: ['GPS と方位センサーで動くので、', '場所を選びません'] },
  { slot: 'screenFar', jp: '奥の建物もわかる', sub: ['手前の建物に隠れた企画も、', '距離つきで出ます'] },
  { slot: 'screenGuide', jp: 'そのまま案内', sub: ['企画を選ぶと、矢印と距離で', '目的地まで連れていきます'] },
];
const S4_INTRO = 0.4, BEAT = 2.6;
function s4(lt, t) {
  const bi = clamp(Math.floor((lt - S4_INTRO) / BEAT), 0, BEATS.length - 1);
  const bl = lt - S4_INTRO - bi * BEAT;
  const beat = BEATS[bi];
  ctx.fillStyle = C.dark; ctx.fillRect(0, 0, W, H);
  // 端末の背後の色面
  const cp = eOut(lin(lt, 0, 0.8));
  ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(600, H / 2 + 40, 560 * cp, 0, 7); ctx.fill();
  ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.arc(1010, 250, 46 * eBack(lin(lt, 0.3, 0.9)), 0, 7); ctx.fill();
  const enter = eOut(lin(lt, 0, 0.8));
  const cx = 600, cy = H / 2 + 20 + (1 - enter) * 900 + Math.sin(t * 1.3) * 6;
  const rot = (-4 + Math.sin(t * 0.9) * 1.0) * RAD * (0.4 + 0.6 * enter) - (1 - enter) * 0.3;
  const wp = bl > BEAT - 0.35 && bi < BEATS.length - 1 ? lin(bl, BEAT - 0.35, BEAT) : 0;
  const geo = phone(cx, cy, 930, rot, beat.slot, Math.max(0, bl), wp ? BEATS[bi + 1].slot : null, wp);
  if (bl < 0) return;
  const out = eIn(lin(bl, BEAT - 0.3, BEAT));
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(-out * 50, 0);
  const X = 1090;
  txt(`${bi + 1}`, X, 470, { size: 120, weight: 800, font: EN, color: C.mint, p: lin(bl, 0, 0.5) });
  ctx.save(); ctx.globalAlpha = (1 - out) * lin(bl, 0.1, 0.5); ctx.font = `600 34px ${EN}`; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText('/ 4', X + 70, 470); ctx.restore();
  txt(beat.jp, X, 610, { size: 96, weight: 900, mask: true, p: lin(bl, 0.1, 0.8), stagger: 0.06 });
  beat.sub.forEach((line, i) => txt(line, X, 700 + i * 58, { size: 38, weight: 600, p: lin(bl, 0.35 + i * 0.12, 1.1 + i * 0.12), stagger: 0.015, color: '#e3dcf2' }));
  // 引出線（説明 → 画面内の該当箇所）
  const pt = media[beat.slot]?.pt || [0.5, 0.5];
  const [px, py] = phonePt(cx, cy, rot, geo, pt[0], pt[1]);
  const lp = eOut(lin(bl, 0.25, 0.9)), ax = X - 36, ay = 540, mx = mix(ax, px, 0.3);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mix(ax, mx, lin(lp, 0, 0.35)), ay);
  if (lp > 0.35) ctx.lineTo(mix(mx, px, lin(lp, 0.35, 1)), mix(ay, py, lin(lp, 0.35, 1)));
  ctx.stroke();
  if (lp > 0.95) {
    ctx.fillStyle = C.yel; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < BEATS.length; i++) {
    ctx.fillStyle = i === bi ? C.mint : 'rgba(255,255,255,.28)';
    ctx.beginPath(); ctx.arc(X + 8 + i * 34, 880, i === bi ? 9 : 6, 0, 7); ctx.fill();
  }
}

// S5 しくみ（建物データの立体化 → レイキャスト → 目的地までのナビゲーション）
const NAV_A = 2.5, NAV_B = 5.5; // 歩行の開始・到着（場面内の秒）
function s5(lt, t) {
  ctx.fillStyle = C.dark; ctx.fillRect(0, 0, W, H);
  const walk = eInOut(lin(lt, NAV_A, NAV_B)), me = NAV.at(NAV.len * walk);
  const zoomIn = eInOut(lin(lt, NAV_A - 0.9, NAV_A + 0.6)); // 歩行の開始に合わせて拡大
  const th = mix(-0.25, -0.7, eInOut(lin(lt, 0, 6))), k = mix(2.3, 4.4, zoomIn);
  const tilt = 0.52, zs = 0.9;
  // 視点は歩行者を緩やかに追従
  const fx = me.x * 0.85 * zoomIn, fy = me.y * 0.85 * zoomIn, CX = W * 0.66, CY = H * 0.6;
  const cs = Math.cos(th), sn = Math.sin(th);
  const P = (x, y, z = 0) => { const X = x - fx, Y = y - fy, rx = X * cs - Y * sn, ry = X * sn + Y * cs; return [CX + rx * k, CY - ry * k * tilt - z * k * zs, ry]; };
  ctx.save(); ctx.strokeStyle = 'rgba(167,139,250,.10)'; ctx.lineWidth = 1;
  for (let v = -400; v <= 400; v += 20) {
    let [a, b] = [P(v, -400), P(v, 400)]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    [a, b] = [P(-400, v), P(400, v)]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
  // カメラの向き: 最初は周囲を見回し、歩行中は進行方向
  const navOn = lt >= NAV_A - 0.5;
  const sweep = mix(-60, 200, eInOut(lin(lt, 1.3, NAV_A - 0.4)));
  const pathDir = Math.atan2(me.hx, me.hy) / RAD;
  const dir = mix(sweep, sweep + ((((pathDir - sweep) % 360) + 540) % 360 - 180), eInOut(lin(lt, NAV_A - 0.5, NAV_A + 0.1)));
  const rayA = lin(lt, 1.3, 1.7), hit = new Set();
  const drawRays = () => {
    if (rayA <= 0) return;
    ctx.save(); ctx.globalAlpha = rayA;
    const [x0, y0] = P(me.x, me.y);
    for (let i = 0; i <= 30; i++) {
      const a = (dir - 30 + i * 2) * RAD, dx = Math.sin(a), dy = Math.cos(a);
      const r = castRay(me.x, me.y, dx, dy, 200);
      if (r.b) hit.add(r.b);
      const [x1, y1] = P(me.x + dx * r.t, me.y + dy * r.t);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(255,216,74,0)'); g.addColorStop(1, r.b ? 'rgba(255,216,74,.85)' : 'rgba(255,216,74,.12)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  };
  // 経路（地面上の破線）。draw: 0→1 で始点から描画
  const routeP = eOut(lin(lt, NAV_A - 0.6, NAV_A + 0.2));
  const drawRoute = (alpha, width) => {
    if (routeP <= 0) return;
    const end = NAV.len * routeP;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = C.mint; ctx.setLineDash([2, 22]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    NAV.pts.forEach(([x, y], i) => {
      if (NAV.cum[i] > end) return;
      const [X, Y] = P(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    });
    const e = NAV.at(end), [EX, EY] = P(e.x, e.y); ctx.lineTo(EX, EY);
    ctx.stroke(); ctx.restore();
  };
  drawRays();
  drawRoute(1, 12);
  // 建物（現在地から順に立ち上がる）
  const R = lt * 260, arrived = lin(lt, NAV_B - 0.25, NAV_B + 0.15);
  const list = blds.map((b) => ({ b, depth: P(b.c[0], b.c[1])[2] })).sort((a, b) => b.depth - a.depth);
  for (const { b } of list) {
    const gp = clamp((R - b.d) / 90);
    if (gp <= 0) continue;
    const isDest = navOn && b === NAV.dest.b, isP = !!b.poi, isHit = hit.has(b);
    const h = b.hgt * eBack(gp) * (isDest ? 1 + 0.15 * Math.sin(arrived * Math.PI) : 1);
    const base = b.pts.map(([x, y]) => P(x, y)), top = b.pts.map(([x, y]) => P(x, y, h));
    ctx.save(); ctx.globalAlpha = clamp(gp * 1.5);
    ctx.lineWidth = 1.2; ctx.strokeStyle = isDest ? '#fff' : isP ? 'rgba(94,234,212,.9)' : 'rgba(167,139,250,.6)';
    for (let i = 0; i < base.length; i++) {
      const j = (i + 1) % base.length;
      ctx.beginPath(); ctx.moveTo(base[i][0], base[i][1]); ctx.lineTo(base[j][0], base[j][1]); ctx.lineTo(top[j][0], top[j][1]); ctx.lineTo(top[i][0], top[i][1]); ctx.closePath();
      ctx.fillStyle = isDest ? 'rgba(200,150,0,.45)' : isP ? 'rgba(16,120,90,.4)' : 'rgba(70,30,140,.36)'; ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = isDest ? C.yel : isHit ? (isP ? '#7df0c0' : 'rgba(255,216,74,.4)') : isP ? C.leaf : 'rgba(60,30,120,.9)';
    ctx.fill(); if (isHit || isDest) ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  drawRoute(0.45, 8); // 建物の背後に隠れた区間も薄く表示
  // 企画の名称: 見回し中はレイが当たった建物、案内中は目的地のみ
  ctx.save(); ctx.font = `700 28px ${JP}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const p of pois) {
    if (!p.b) continue;
    const isDest = navOn && p === NAV.dest;
    if (!(isDest || (!navOn && hit.has(p.b)))) continue;
    const [x, y] = P(p.xy[0], p.xy[1], p.b.hgt + 4), y2 = y - 64;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y2); ctx.stroke();
    const label = p.title;
    const tw = ctx.measureText(label).width + 28;
    ctx.fillStyle = isDest ? C.yel : '#fff'; rrect(x - tw / 2, y2 - 44, tw, 44, 9); ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText(label, x, y2 - 22);
  }
  ctx.restore();
  // 到着時の波紋
  if (arrived > 0 && arrived < 1) {
    const [dx0, dy0] = P(NAV.dest.xy[0], NAV.dest.xy[1], NAV.dest.b.hgt);
    ctx.strokeStyle = `rgba(255,216,74,${1 - arrived})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(dx0, dy0, 30 + arrived * 220, (30 + arrived * 220) * tilt, 0, 0, 7); ctx.stroke();
  }
  // 歩行者（進行方向の矢印）
  const [ux, uy] = P(me.x, me.y);
  const q = (t * 0.9) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(ux, uy, 12 + q * 50, (12 + q * 50) * tilt, 0, 0, 7); ctx.stroke();
  const ha = dir * RAD, [ax, ay] = P(me.x + Math.sin(ha) * 9, me.y + Math.cos(ha) * 9);
  const ang = Math.atan2(ay - uy, ax - ux);
  ctx.save(); ctx.translate(ux, uy - 6); ctx.rotate(ang + Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(15, 14); ctx.lineTo(0, 6); ctx.lineTo(-15, 14); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  // 説明
  const lg = ctx.createLinearGradient(0, 0, W * 0.5, 0);
  lg.addColorStop(0, 'rgba(19,10,34,.92)'); lg.addColorStop(1, 'rgba(19,10,34,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W * 0.5, H);
  ctx.fillStyle = C.leaf; ctx.fillRect(120, 226, 14, 34);
  txt('しくみ', 152, 256, { size: 34, weight: 700, color: '#fff', p: lin(lt, 0.1, 0.6) });
  txt('建物の形と、カメラの向きから', 120, 370, { size: 66, weight: 900, mask: true, p: lin(lt, 0.2, 1.0), stagger: 0.035 });
  txt('正面の企画を割り出す', 120, 460, { size: 66, weight: 900, mask: true, p: lin(lt, 0.45, 1.2), stagger: 0.035 });
  const statOut = lin(lt, NAV_A - 0.7, NAV_A - 0.4);
  const stats = [[99, '棟', '建物の形状データ'], [13, 'か所', '企画の開催場所']];
  stats.forEach(([n, unit, jp], i) => {
    const sq = lin(lt, 0.8 + i * 0.3, 1.7 + i * 0.3), y = 660 + i * 120;
    ctx.save(); ctx.globalAlpha = eOut(sq * 3) * (1 - statOut); ctx.textBaseline = 'alphabetic';
    ctx.font = `700 96px ${EN}`; ctx.fillStyle = '#fff';
    const num = String(Math.round(n * eOut(sq))); ctx.fillText(num, 120, y);
    const nw = ctx.measureText(num).width;
    ctx.font = `700 36px ${JP}`; ctx.fillText(unit, 120 + nw + 10, y);
    ctx.font = `600 30px ${JP}`; ctx.fillStyle = '#cfc6e6'; ctx.fillText(jp, 330, y - 8);
    ctx.restore();
  });
  // 案内の表示（アプリの案内チップと同一の構成: 矢印＋残距離＋企画名）
  const gp = eOut(lin(lt, NAV_A - 0.4, NAV_A + 0.2));
  if (gp > 0) {
    const remain = Math.round((NAV.len * (1 - walk)) / 5) * 5;
    const done = arrived > 0 || remain < 5;
    const label = done ? `${NAV.dest.title} 付近に到着` : `あと ${remain}m ・ ${NAV.dest.title}`;
    ctx.save(); ctx.globalAlpha = gp; ctx.translate(0, (1 - gp) * 40);
    ctx.font = `800 44px ${JP}`;
    const tw = ctx.measureText(label).width, pw = tw + 150;
    rrect(120, 620, pw, 96, 48); ctx.fillStyle = C.yel; ctx.fill();
    // 矢印: 画面上の進行方向へ回転
    ctx.save(); ctx.translate(176, 668); ctx.rotate(done ? 0 : ang + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(17, 18); ctx.lineTo(0, 9); ctx.lineTo(-17, 18); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
    ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(label, 224, 670);
    ctx.font = `600 30px ${JP}`; ctx.fillStyle = '#cfc6e6'; ctx.fillText('企画を選ぶと、方向と残りの距離を表示します', 124, 770);
    ctx.restore();
  }
  ctx.font = `500 20px ${JP}`; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText('建物データ © OpenStreetMap contributors', 120, 1000);
}

// S6 結び（NAsVI の一機能であることと、チーム名）
function s6(lt) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const ww = (() => { ctx.font = '800 150px "Avenir Next","Futura","Helvetica Neue",sans-serif'; return ctx.measureText('NAsVI').width + 150 * 0.22 * 4; })();
  const mark = 200, gap = 16, x0 = W / 2 - (mark + gap + ww) / 2;
  eggplant(x0 + mark / 2, 370, mark * eBack(lin(lt, 0.15, 0.7)), lin(lt, 0.15, 0.35));
  wordmark('NAsVI', x0 + mark + gap + ww / 2, 422, 150, { p: lin(lt, 0.2, 0.9) });
  ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - 360 * eOut(lin(lt, 0.7, 1.3)), 520, 720 * eOut(lin(lt, 0.7, 1.3)), 2);
  txt('ARガイドは、NAsVI の機能のひとつです。', W / 2, 640, { size: 60, weight: 800, align: 'center', color: C.ink, p: lin(lt, 0.8, 1.7), stagger: 0.03 });
  txt('Team NASBI', W / 2, 800, { size: 50, weight: 800, font: EN, track: 6, align: 'center', color: C.violet, p: lin(lt, 1.4, 2.0) });
  txt('ハッカソン 中間レビュー', W / 2, 860, { size: 30, weight: 600, align: 'center', color: C.ink, p: lin(lt, 1.6, 2.2), stagger: 0.03 });
  const fo = eIn(lin(lt, 3.45, 3.8));
  if (fo > 0) { ctx.save(); ctx.globalAlpha = fo; ctx.fillStyle = C.dark; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ==================== 構成 ====================
const SCENES = [
  { a: 0, b: 4.4, f: s1 }, { a: 4.4, b: 7.0, f: s2 }, { a: 7.0, b: 10.0, f: s3 },
  { a: 10.0, b: 20.8, f: s4 }, { a: 20.8, b: 27.2, f: s5 }, { a: 27.2, b: 31.0, f: s6 },
];

function draw(t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.textAlign = 'left'; ctx.shadowColor = 'transparent';
  const sc = SCENES.find((s) => t >= s.a && t < s.b) || SCENES[SCENES.length - 1];
  sc.f(t - sc.a, t);
  ctx.restore();
  ctx.save(); ctx.textAlign = 'left';
  for (const s of SCENES.slice(1)) wipe(t, s.a);
  ctx.restore();
  film(t);
}

// ---------- 再生・書き出し ----------
window.PV = {
  W, H, FPS, DUR, ready: false,
  async renderAt(t) {
    needs.length = 0; draw(t);         // 1回目で必要な動画フレームを収集
    if (needs.length) { await Promise.all(needs.map(([m, i]) => loadFrame(m, i))); needs.length = 0; draw(t); }
    return cv.toDataURL('image/jpeg', 0.93);
  },
};
await document.fonts.ready;
window.PV.ready = true;

if (!RENDER) {
  let playing = false, t0 = 0, base = 0, cur = 0;
  const seek = document.getElementById('seek'), tc = document.getElementById('tc'), btn = document.getElementById('play');
  const tick = (now) => {
    if (playing) { cur = base + (now - t0) / 1000; if (cur >= DUR) { cur = 0; base = 0; t0 = now; } seek.value = cur; }
    needs.length = 0; draw(cur);
    for (const [m, i] of needs) for (let k = 0; k < 6; k++) if (i + k < m.count) loadFrame(m, i + k); // 先読み
    tc.textContent = cur.toFixed(2) + 's';
    requestAnimationFrame(tick);
  };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? '停止' : '再生'; base = cur; t0 = performance.now(); };
  seek.oninput = () => { cur = Number(seek.value); base = cur; t0 = performance.now(); };
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); btn.click(); } });
  requestAnimationFrame(tick);
}
