// 鑑定書（静止画）：特許の出願書類のような体裁。番号つきの欄・図・所見・判子。保存と共有に使う。

import { RANKS, type Verdict } from './appraise';

const W = 1080;
const H = 1350;
const SANS = "'Noto Sans JP', 'Hiragino Sans', sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

export interface Spec {
  mirrors: number;
  liquid: string; // 水・オイル・はちみつ
  count: number; // 入れた粒
  items?: string[]; // 中身の内訳（「青のガラス玉 3」のように、多い順）
}

function img(src: string) {
  return new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(i);
    i.src = src;
  });
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 紙はどのランクでも同じ。良し悪しは、大きく押した評価のスタンプ（SS〜E）で見せる
export const GRADES = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
interface Theme {
  paper: string;
  ink: string;
  sub: string;
  seal: string;
}
function themeOf(_rank: number): Theme {
  return { paper: '#f4f3ef', ink: '#1d1d1b', sub: 'rgba(29,29,27,.55)', seal: 'rgba(178,52,42,.9)' };
}

// 評価のスタンプ：ゴム印のように、枠と大きな文字。インクのかすれを少し残す
function gradeStamp(x: CanvasRenderingContext2D, grade: string, cx: number, cy: number, tilt: number, seed: number) {
  const S = 300;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const red = '#b2342a';
  g.strokeStyle = red;
  g.fillStyle = red;
  g.translate(S / 2, S / 2);
  // 二重の丸枠
  g.lineWidth = 9;
  g.beginPath();
  g.arc(0, 0, 128, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 112, 0, Math.PI * 2);
  g.stroke();
  // 文字
  const size = grade.length > 1 ? 128 : 168;
  g.font = `700 ${size}px ${SANS}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(grade, 0, 4);
  g.font = `500 20px ${MONO}`;
  g.fillText('GRADE', 0, -82);
  g.fillText('KOSUKUMA', 0, 88);
  // かすれ：ところどころインクが乗らない
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  let r = seed;
  const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.6;
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 6; i++) {
    g.globalAlpha = 0.18;
    g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 20 + rnd() * 40, 4 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  x.save();
  x.translate(cx, cy);
  x.rotate(tilt);
  x.globalAlpha = 0.88;
  x.globalCompositeOperation = 'multiply';
  x.drawImage(c, -S / 2, -S / 2);
  x.restore();
}

// 欄：番号（タイプ）と見出し、その下に値
function field(x: CanvasRenderingContext2D, T: Theme, no: string, label: string, value: string, px: number, py: number, size = 28) {
  x.textAlign = 'left';
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText(`[${no}]`, px, py);
  x.font = `500 17px ${SANS}`;
  x.fillText(label, px + 54, py);
  x.fillStyle = T.ink;
  x.font = `400 ${size}px ${SANS}`;
  x.fillText(value, px + 54, py + size + 12);
}

function rule(x: CanvasRenderingContext2D, T: Theme, y: number, w = 1, dash = false) {
  x.save();
  x.strokeStyle = T.ink;
  x.lineWidth = w;
  if (dash) x.setLineDash([3, 5]);
  x.beginPath();
  x.moveTo(72, y);
  x.lineTo(W - 72, y);
  x.stroke();
  x.restore();
}

export async function drawCard(scope: HTMLCanvasElement, name: string, v: Verdict, domain: string, spec?: Spec): Promise<HTMLCanvasElement> {
  const T = themeOf(v.rank);
  await Promise.all([
    document.fonts.load(`400 40px 'Noto Sans JP'`, name + '万華鏡鑑定書所見図'),
    document.fonts.load(`700 40px 'Noto Sans JP'`, v.rankName + '万華鏡鑑定書'),
    document.fonts.load(`500 40px 'Noto Sans JP'`, '鑑定番号日士鏡液粒名称結果所見図中身種こすくまくん'),
    document.fonts.load(`400 20px 'Noto Sans JP'`, (spec?.items ?? []).join('') + (spec?.liquid ?? '') + 'ほか種個'),
    document.fonts.load(`400 20px 'IBM Plex Mono'`),
    document.fonts.load(`500 20px 'IBM Plex Mono'`),
  ]).catch(() => {});
  const kuma = await img('/appraiser.png');
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.textBaseline = 'alphabetic';

  // 紙
  x.fillStyle = T.paper;
  x.fillRect(0, 0, W, H);
  const id = x.getImageData(0, 0, W, H);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    id.data[i] += n;
    id.data[i + 1] += n;
    id.data[i + 2] += n;
  }
  x.putImageData(id, 0, 0);
  const d = new Date();
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const no = `KM ${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(hash(name + d.getTime()) % 10000).padStart(4, '0')}`;

  // 表題
  x.fillStyle = T.sub;
  x.font = `400 18px ${MONO}`;
  x.textAlign = 'left';
  x.fillText('(19)  KALEIDOSCOPE MAKER', 72, 100);
  x.textAlign = 'right';
  x.fillText('(11)', W - 72, 100);
  x.fillStyle = T.ink;
  x.textAlign = 'left';
  x.font = `700 58px ${SANS}`;
  x.fillText('万華鏡鑑定書', 72, 170);
  x.textAlign = 'right';
  x.font = `500 40px ${MONO}`;
  x.fillText(no, W - 72, 166);
  rule(x, T, 198, 3);

  // 欄
  field(x, T, '21', '鑑定番号', no, 72, 246, 24);
  field(x, T, '22', '鑑定日', ymd, 72, 326, 24);
  field(x, T, '72', '鑑定士', 'こすくまくん', 72, 406, 24);
  const sp = spec ?? { mirrors: 8, liquid: '―', count: 0 };

  // 鑑定結果（右上）
  const rx = 560;
  x.textAlign = 'left';
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[58]', rx, 246);
  x.font = `500 17px ${SANS}`;
  x.fillText('鑑定結果', rx + 54, 246);
  x.fillStyle = T.ink;
  let fs = 50;
  do {
    x.font = `700 ${fs}px ${SANS}`;
    fs -= 2;
  } while (x.measureText(v.rankName).width > W - 72 - rx && fs > 28);
  x.fillText(v.rankName, rx, 316);
  // 目盛り：0〜6 の7段
  const bx = rx;
  const bw = W - 72 - rx;
  const by = 370;
  x.fillRect(bx, by, bw, 2);
  x.font = `400 14px ${MONO}`;
  for (let i = 0; i < RANKS.length; i++) {
    const tx = bx + (bw * i) / (RANKS.length - 1);
    x.fillRect(tx - 0.5, by - 8, 1, 18);
    x.textAlign = 'center';
    x.fillStyle = i === v.rank ? '#b2342a' : T.sub;
    x.fillText(String(i), tx, by + 32);
    x.fillStyle = T.ink;
  }
  const mx = bx + bw * v.pos;
  x.fillStyle = '#b2342a';
  x.beginPath();
  x.moveTo(mx, by - 4);
  x.lineTo(mx - 9, by - 20);
  x.lineTo(mx + 9, by - 20);
  x.closePath();
  x.fill();
  x.fillStyle = T.sub;
  x.font = `400 15px ${SANS}`;
  x.textAlign = 'left';
  x.fillText(RANKS[0], bx, by + 58);
  x.textAlign = 'right';
  x.fillText(RANKS[RANKS.length - 1], bx + bw, by + 58);
  rule(x, T, 470);

  // 名称
  x.textAlign = 'left';
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[54]', 72, 512);
  x.font = `500 17px ${SANS}`;
  x.fillText('名称', 126, 512);
  x.fillStyle = T.ink;
  fs = 52;
  const label = `「${name}」`;
  do {
    x.font = `500 ${fs}px ${SANS}`;
    fs -= 2;
  } while (x.measureText(label).width > W - 200 && fs > 28);
  x.fillText(label, 112, 580);
  rule(x, T, 616, 1, true);

  // 図：万華鏡と引き出し線
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[57]', 72, 656);
  x.font = `500 17px ${SANS}`;
  x.fillText('図', 126, 656);
  const cx = 300;
  const cy = 858;
  const r = 186;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.18)';
  x.shadowBlur = 18;
  x.shadowOffsetY = 6;
  x.beginPath();
  x.arc(cx, cy, r + 8, 0, Math.PI * 2);
  x.fillStyle = '#c9ccd0';
  x.fill();
  x.restore();
  x.save();
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.clip();
  x.drawImage(scope, cx - r, cy - r, r * 2, r * 2);
  x.restore();
  x.strokeStyle = T.ink;
  x.lineWidth = 1;
  x.beginPath();
  x.arc(cx, cy, r + 8, 0, Math.PI * 2);
  x.stroke();
  // 引き出し線：図の中の点から右の注記へ（特許の図のように）。画の上では白い縁取りで見えるように
  const tx0 = 560;
  const callout = (ang: number, k: number, ty: number) => {
    const a = (ang * Math.PI) / 180;
    const px = cx + Math.cos(a) * r * k;
    const py = cy + Math.sin(a) * r * k;
    const pts: [number, number][] = [
      [px, py],
      [tx0 - 34, ty],
      [tx0 - 10, ty],
    ];
    x.save();
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (const [w, col] of [
      [4, 'rgba(255,255,255,.85)'],
      [1.2, T.ink],
    ] as const) {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      pts.forEach(([qx, qy], i) => (i ? x.lineTo(qx, qy) : x.moveTo(qx, qy)));
      x.stroke();
    }
    x.fillStyle = '#fff';
    x.strokeStyle = T.ink;
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(px, py, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.restore();
  };
  const tag = (no: string, label: string, ty: number) => {
    x.textAlign = 'left';
    x.fillStyle = T.sub;
    x.font = `400 17px ${MONO}`;
    x.fillText(`[${no}]`, tx0, ty + 6);
    x.font = `500 17px ${SANS}`;
    x.fillText(label, tx0 + 54, ty + 6);
  };

  callout(-45, 0.88, 676);
  x.textAlign = 'left';
  x.fillStyle = T.ink;
  x.font = `400 18px ${MONO}`;
  x.fillText('FIG. 1', tx0, 682);
  x.fillStyle = T.sub;
  x.font = `400 15px ${MONO}`;
  x.fillText(`${sp.mirrors}-MIRROR VIEW`, tx0, 704);

  // 溶液：筒いっぱいに満ちているので、縁の近くを指す
  callout(-12, 0.84, 752);
  tag('52', '溶液', 752);
  x.fillStyle = T.ink;
  x.font = `400 26px ${SANS}`;
  x.fillText(sp.liquid, tx0 + 54, 792);

  // 入れた粒
  callout(10, 0.42, 838);
  tag('53', '入れた粒', 838);
  x.fillStyle = T.ink;
  x.font = `400 26px ${SANS}`;
  x.fillText(`${sp.count} 個`, tx0 + 54, 878);

  // 中身の内訳：名前と数を、幅に合わせて折り返す。入りきらない分は「ほか n 種」
  const items = sp.items ?? [];
  callout(36, 0.66, 924);
  tag('55', items.length ? `中身（${items.length} 種）` : '中身', 924);
  x.fillStyle = T.ink;
  x.font = `400 19px ${SANS}`;
  const lw = W - 72 - (tx0 + 54);
  const gap = x.measureText('　').width;
  const rows: string[][] = [[]];
  let used = 0;
  let shown = 0;
  const MAX_ROWS = 3; // 4 行目は評価のスタンプにかかる
  for (const it of items.length ? items : ['なし']) {
    const w = x.measureText(it).width;
    const row = rows[rows.length - 1];
    if (row.length && used + gap + w > lw) {
      if (rows.length === MAX_ROWS) break;
      rows.push([it]);
      used = w;
    } else {
      row.push(it);
      used += (row.length > 1 ? gap : 0) + w;
    }
    shown++;
  }
  if (shown < items.length) {
    const last = rows[rows.length - 1];
    const more = `ほか ${items.length - shown + (last.length > 1 ? 1 : 0)} 種`;
    if (last.length > 1) last.pop();
    last.push(more);
  }
  rows.forEach((row, i) => x.fillText(row.join('　'), tx0 + 54, 960 + i * 30));

  rule(x, T, 1076, 1, true);

  // 所見：こすくまくんの一言
  x.textAlign = 'left';
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[59]', 72, 1116);
  x.font = `500 17px ${SANS}`;
  x.fillText('所見', 126, 1116);
  const kw = 112;
  const kh = (kuma.naturalHeight / Math.max(1, kuma.naturalWidth)) * kw || 140;
  x.save();
  x.filter = 'brightness(1.08)';
  x.drawImage(kuma, 84, 1132, kw, kh);
  x.restore();
  x.fillStyle = T.ink;
  x.font = `400 30px ${SANS}`;
  const lines = v.line.split('\n');
  lines.forEach((l, i) => x.fillText((i === 0 ? '「' : '　') + l + (i === lines.length - 1 ? '」' : ''), 216, 1182 + i * 44));

  // 評価のスタンプ：所見の右に、大きく斜めに押す
  const hs = hash(name + v.rank);
  gradeStamp(x, GRADES[v.rank] ?? 'C', W - 205, 1150, -0.2 + ((hs % 100) / 100) * 0.24, hs || 7);

  // 下の帯
  rule(x, T, H - 64, 1);
  x.fillStyle = T.sub;
  x.font = `400 16px ${MONO}`;
  x.textAlign = 'left';
  x.fillText(domain, 72, H - 36);
  x.textAlign = 'right';
  x.fillText(`${ymd}  p.1/1`, W - 72, H - 36);
  return c;
}
