// แบนเนอร์การ์ดแจ้งเตือนแบบ GIF สำหรับเว็บและหน้าโปรเจกต์ (ไม่ได้ใช้ในแพ็ก)
// ประกอบจากชั้นภาพเดียวกับในเกม: ฉาก art/out/toast/anims/toast_<ธีม>_bg|fg.png (แถบ 8 เฟรม 80×16), เงา, ภาพโปสการ์ด 16×16
// ตัวหนังสือใช้ฟอนต์ 3×5 ของ pxl (ภาษาอังกฤษ) แล้วขยาย 6 เท่าแบบ nearest
// ใช้: node tools/banner.mjs   → art/out/web/banner-<ธีม>.gif + .png (เฟรมแรก)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import * as T from "../content/cards.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.PXL_HOME || !existsSync(join(process.env.PXL_HOME, "src"))) {
  console.error("ตั้งตัวแปร PXL_HOME ให้ชี้โฟลเดอร์ของ pxl ก่อน (ใช้ฟอนต์และตัวเขียน GIF ของ pxl)");
  process.exit(1);
}
const PXL = join(process.env.PXL_HOME, "src");
const { encodeGif } = await import(pathToFileURL(join(PXL, "node/gif.ts")).href);
const { Img } = await import(pathToFileURL(join(PXL, "core/image.ts")).href);
const { glyph } = await import(pathToFileURL(join(PXL, "core/font.ts")).href);

const PICKS = [
  ["forests", "cherry_grove"],
  ["cold", "ice_spikes"],
  ["dry", "desert"],
  ["wet", "jungle"],
  ["underground", "deep_dark"],
  ["otherworld", "nether"],
];
const W = 82, H = 18, F = 8, MS = 125, K = 6;
const png = (rel) => PNG.sync.read(readFileSync(join(ROOT, rel)));
const shade = png("art/out/toast/sprites/toast_shade.png");

function frame(theme, pic, name, f) {
  const buf = new Float32Array(W * H * 3);
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 3;
    buf[i] += (r - buf[i]) * a;
    buf[i + 1] += (g - buf[i + 1]) * a;
    buf[i + 2] += (b - buf[i + 2]) * a;
  };
  const blit = (img, sx, sy, sw, sh, dx, dy) => {
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = ((sy + y) * img.width + sx + x) * 4;
      put(dx + x, dy + y, img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3] / 255);
    }
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const text = (s, x, y, col) => {
    for (const ch of s) {
      const g = glyph(ch);
      for (let gy = 0; gy < g.length; gy++) for (let gx = 0; gx < g[gy].length; gx++) {
        if (g[gy][gx] !== "#") continue;
        put(x + gx + 1, y + gy + 1, 0, 0, 0, 0.6);
        put(x + gx, y + gy, ...hex(col), 1);
      }
      x += (g[0]?.length ?? 3) + 1;
    }
  };
  // กรอบ
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 30, 30, 31, 1);
  blit(theme.bg, f * 80, 0, 80, 16, 1, 1);
  blit(shade, 0, 0, 80, 16, 1, 1);
  blit(pic, 0, 0, 16, 16, 2, 1);
  text("NEW POSTCARD!", 21, 3, "#ffe066");
  text(name.toUpperCase(), 21, 10, "#ffffff");
  blit(theme.fg, f * 80, 0, 80, 16, 1, 1);
  for (let x = 1; x < W - 1; x++) put(x, 0, 255, 255, 255, 0.25), put(x, H - 1, 0, 0, 0, 0.4);

  const img = new Img(W * K, H * K);
  for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) {
    const i = (((y / K) | 0) * W + ((x / K) | 0)) * 3;
    img.data[y * W * K + x] = ((Math.round(buf[i]) << 24) | (Math.round(buf[i + 1]) << 16) | (Math.round(buf[i + 2]) << 8) | 255) >>> 0;
  }
  return img;
}

const toPng = (img) => {
  const p = new PNG({ width: img.w, height: img.h });
  img.data.forEach((c, i) => p.data.writeUInt32BE(c >>> 0, i * 4));
  return PNG.sync.write(p);
};

const out = join(ROOT, "art/out/web");
mkdirSync(out, { recursive: true });
for (const [id, cardId] of PICKS) {
  const card = T.CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`banner: ไม่พบการ์ด ${cardId}`);
  const theme = { bg: png(`art/out/toast/anims/toast_${id}_bg.png`), fg: png(`art/out/toast/anims/toast_${id}_fg.png`) };
  const pic = png(`RP/textures/items/postcards/${card.id}.png`);
  const frames = Array.from({ length: F }, (_, f) => frame(theme, pic, card.en, f));
  writeFileSync(join(out, `banner-${id}.gif`), encodeGif(frames.map((img) => ({ img, ms: MS }))));
  writeFileSync(join(out, `banner-${id}.png`), toPng(frames[0]));
}
console.log(`banner ok: ${PICKS.length} ภาพ → art/out/web/`);
