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
    document.fonts.load(`500 40px 'Noto Sans JP'`, '鑑定番号日士鏡液粒名称結果所見図こすくまくん'),
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
  field(x, T, '51', '鏡', `${sp.mirrors} 枚`, 560, 246, 24);
  field(x, T, '52', '溶液', sp.liquid, 560, 326, 24);
  field(x, T, '53', '入れた粒', `${sp.count} 個`, 560, 406, 24);
  rule(x, T, 470);

  // 名称
  x.textAlign = 'left';
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[54]', 72, 512);
  x.font = `500 17px ${SANS}`;
  x.fillText('名称', 126, 512);
  x.fillStyle = T.ink;
  let fs = 52;
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
  // 引き出し線
  x.beginPath();
  x.moveTo(cx + r * 0.62, cy - r * 0.62);
  x.lineTo(cx + r + 40, cy - r - 10);
  x.stroke();
  x.fillStyle = T.ink;
  x.font = `400 18px ${MONO}`;
  x.fillText('FIG. 1', cx + r + 46, cy - r - 4);
  x.fillStyle = T.sub;
  x.font = `400 15px ${MONO}`;
  x.fillText(`${sp.mirrors}-MIRROR VIEW`, cx + r + 46, cy - r + 18);

  // 鑑定結果（右の列）
  const rx = 560;
  x.fillStyle = T.sub;
  x.font = `400 17px ${MONO}`;
  x.fillText('[58]', rx, 730);
  x.font = `500 17px ${SANS}`;
  x.fillText('鑑定結果', rx + 54, 730);
  x.fillStyle = T.ink;
  fs = 56;
  do {
    x.font = `700 ${fs}px ${SANS}`;
    fs -= 2;
  } while (x.measureText(v.rankName).width > W - 72 - rx && fs > 30);
  x.fillText(v.rankName, rx, 806);
  // 目盛り：0〜6 の7段
  const bx = rx;
  const bw = W - 72 - rx;
  const by = 870;
  x.fillRect(bx, by, bw, 2);
  x.font = `400 14px ${MONO}`;
  for (let i = 0; i < RANKS.length; i++) {
    const tx = bx + (bw * i) / (RANKS.length - 1);
    x.fillRect(tx - 0.5, by - 8, 1, 18);
    x.textAlign = 'center';
    x.fillStyle = i === v.rank ? '#b2342a' : T.sub;
    x.fillText(String(i), tx, by + 34);
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
  x.fillText(RANKS[0], bx, by + 62);
  x.textAlign = 'right';
  x.fillText(RANKS[RANKS.length - 1], bx + bw, by + 62);

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
