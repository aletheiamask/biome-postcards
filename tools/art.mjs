#!/usr/bin/env node
// วาดภาพทั้งหมดด้วย pxl แล้วคัดลอกเข้า RP (ภาพที่ได้ถูก commit ไว้ คนอื่นจึงไม่ต้องมี pxl)
// ใช้: node tools/art.mjs [--preview] [--only a,b]
//   --preview  สร้างภาพขยายของแผ่นรวมไว้ตรวจด้วยตาที่ art/out/_preview/
//   --only     วาดเฉพาะชื่อที่ระบุ (ไม่คัดลอกเข้า RP)
// ต้องมีเครื่องมือวาดภาพพิกเซล pxl: ตั้งตัวแปร PXL_HOME ให้ชี้โฟลเดอร์ของ pxl (ที่มี bin/pxl.js)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import * as T from "../content/cards.js";
import { THEMES } from "../BP/scripts/util/toastCode.js";
import { TOAST_ART } from "./ui.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PXL = process.env.PXL_HOME ? join(process.env.PXL_HOME, "bin", "pxl.js") : null;
const argv = process.argv.slice(2);
const preview = argv.includes("--preview");
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
if (!PXL || !existsSync(PXL)) {
  console.error(`ไม่พบ pxl${PXL ? ` ที่ ${PXL}` : ""} (ตั้งตัวแปร PXL_HOME ให้ชี้โฟลเดอร์ของ pxl ที่มี bin/pxl.js)`);
  process.exit(1);
}

const cards = [...T.CARDS, ...T.BONUS_CARDS];
const trinkets = [...T.SETS.map((s) => s.reward), T.GRAND_REWARD.id, ...T.SOUVENIRS.map((s) => s.id)];
writeFileSync(
  join(ROOT, "art/_data.px.js"),
  `// สร้างอัตโนมัติโดย tools/art.mjs จาก content/cards.js\nglobalThis.BPC = ${JSON.stringify({ cards: cards.map((c) => ({ id: c.id, rarity: c.rarity })), trinkets })}\n`,
);

const args = [PXL, "build", "art/postcards.px.js", "--out", "art/out"];
if (!preview) args.push("--no-preview");
if (only) args.push("--only", only);
const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
if (run.status !== 0 || /error/i.test(run.stderr)) {
  console.error((run.stdout + run.stderr).trim());
  process.exit(1);
}
if (only) {
  console.log(`art ok: วาดเฉพาะ ${only} (ไม่ได้คัดลอกเข้า RP)`);
  process.exit(0);
}

// คัดลอกเข้า RP พร้อมตรวจขนาด
const out = (name) => join(ROOT, "art/out/sprites", `${name}.png`);
const jobs = [
  ...cards.map((c) => [`item_${c.id}`, `RP/textures/items/postcards/${c.id}.png`, 16]),
  ...cards.map((c) => [`board_${c.id}`, `RP/textures/blocks/pin_board/${c.id}.png`, 32]),
  ["board_empty", "RP/textures/blocks/pin_board/empty.png", 32],
  ["album", "RP/textures/items/album.png", 16],
  ["blank_postcard", "RP/textures/items/blank_postcard.png", 16],
  ["pin_board_item", "RP/textures/items/pin_board.png", 16],
  ["lock", "RP/textures/ui/bpc_lock.png", 16],
  ...trinkets.map((id) => [id, `RP/textures/blocks/decor/${id}.png`, 16]),
];
const errors = [];
for (const [name, dest, size] of jobs) {
  if (!existsSync(out(name))) {
    errors.push(`ไม่มีภาพ ${name}`);
    continue;
  }
  const buf = readFileSync(out(name));
  const img = PNG.sync.read(buf);
  if (img.width !== size || img.height !== size) errors.push(`${name} ขนาด ${img.width}×${img.height} ต้องเป็น ${size}×${size}`);
  mkdirSync(dirname(join(ROOT, dest)), { recursive: true });
  writeFileSync(join(ROOT, dest), buf);
}

// ไอคอนแพ็ก 256×256: ขยายภาพบอร์ด Cherry Grove 8 เท่าแบบคมชัด
if (existsSync(out("board_cherry_grove"))) {
  const src = PNG.sync.read(readFileSync(out("board_cherry_grove")));
  const icon = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const s = ((y >> 3) * src.width + (x >> 3)) * 4;
      src.data.copy(icon.data, (y * 256 + x) * 4, s, s + 4);
    }
  }
  const buf = PNG.sync.write(icon);
  for (const dest of ["RP/pack_icon.png", "BP/pack_icon.png"]) writeFileSync(join(ROOT, dest), buf);
}

// ---------- การ์ดแจ้งเตือน (art/toast.px.js): แถบเฟรมของฉากแต่ละธีม + ชิ้นส่วนกรอบ ----------
const TOAST_OUT = "art/out/toast";
const toastRun = spawnSync(process.execPath, [PXL, "build", "art/toast.px.js", "--out", TOAST_OUT, "--no-preview"], { cwd: ROOT, encoding: "utf8" });
if (toastRun.status !== 0 || /error/i.test(toastRun.stderr)) {
  console.error((toastRun.stdout + toastRun.stderr).trim());
  process.exit(1);
}
const TOAST_FRAMES = TOAST_ART.frames;
const TOAST_FRAME = [TOAST_ART.frameW, TOAST_ART.frameH];
const toastJobs = [
  ...THEMES.flatMap((t) => ["bg", "fg"].map((layer) => [`anims/toast_${t}_${layer}`, `${t}_${layer}`, TOAST_FRAME[0] * TOAST_FRAMES, TOAST_FRAME[1]])),
  ["sprites/toast_frame", "frame", 164, 36],
  ["sprites/toast_shade", "shade", 80, 16],
  ["sprites/toast_shine", "shine", 12, 16],
  ["sprites/toast_banner_edge", "banner_edge", 1, 1],
  ["sprites/toast_banner_fill", "banner_fill", 1, 2],
];
const toastImages = {};
for (const [src, name, w, h] of toastJobs) {
  const file = join(ROOT, TOAST_OUT, `${src}.png`);
  if (!existsSync(file)) {
    errors.push(`ไม่มีภาพ ${src}`);
    continue;
  }
  const buf = readFileSync(file);
  const img = PNG.sync.read(buf);
  if (img.width !== w || img.height !== h) errors.push(`${src} ขนาด ${img.width}×${img.height} ต้องเป็น ${w}×${h}`);
  toastImages[name] = img;
  const dest = join(ROOT, "RP/textures/bpc/toast", `${name}.png`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

// แผ่นตรวจด้วยตา: การ์ดทุกธีมที่เฟรม 0 และ 4 ประกอบแบบเดียวกับในเกม (ฉาก 2 เท่า + เงา + ภาพไอเท็ม + ชั้นหน้า + กรอบ + ป้าย)
if (preview && !errors.length) {
  const [CW, CH, GAP, ZOOM] = [164, 36, 6, 2];
  const sheet = new PNG({ width: (CW + GAP) * 2 + GAP, height: (CH + 8 + GAP) * THEMES.length + GAP });
  sheet.data.fill(0);
  for (let i = 0; i < sheet.width * sheet.height; i++) sheet.data.set([58, 58, 64, 255], i * 4);
  const blend = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= sheet.width || y >= sheet.height || !a) return;
    const o = (y * sheet.width + x) * 4;
    for (const [k, v] of [r, g, b].entries()) sheet.data[o + k] = Math.round(sheet.data[o + k] + ((v - sheet.data[o + k]) * a) / 255);
  };
  const draw = (img, sx, sy, sw, sh, dx, dy, scale) => {
    for (let y = 0; y < sh * scale; y++) {
      for (let x = 0; x < sw * scale; x++) {
        const o = ((sy + Math.floor(y / scale)) * img.width + sx + Math.floor(x / scale)) * 4;
        blend(dx + x, dy + y, img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]);
      }
    }
  };
  const sample = (theme) => [...T.CARDS, ...T.BONUS_CARDS].find((c) => (c.theme ?? c.set ?? c.kind) === theme);
  THEMES.forEach((theme, row) => {
    const card = sample(theme);
    const icon = card ? PNG.sync.read(readFileSync(out(`item_${card.id}`))) : PNG.sync.read(readFileSync(out("album")));
    [0, 4].forEach((frame, col) => {
      const x0 = GAP + col * (CW + GAP);
      const y0 = GAP + 8 + row * (CH + 8 + GAP);
      draw(toastImages[`${theme}_bg`], frame * TOAST_FRAME[0], 0, ...TOAST_FRAME, x0 + 2, y0 + 2, 2);
      draw(toastImages.shade, 0, 0, 80, 16, x0 + 2, y0 + 2, 2);
      draw(icon, 0, 0, 16, 16, x0 + 2, y0 + 2, 2);
      draw(toastImages[`${theme}_fg`], frame * TOAST_FRAME[0], 0, ...TOAST_FRAME, x0 + 2, y0 + 2, 2);
      draw(toastImages.frame, 0, 0, CW, CH, x0, y0, 1);
      for (let y = 0; y < 13; y++) for (let x = 0; x < 62; x++) blend(x0 + CW + 4 - 62 + x, y0 - 5 + y, 30, 30, 31, 255);
      for (let y = 0; y < 11; y++) for (let x = 0; x < 60; x++) blend(x0 + CW + 3 - 60 + x, y0 - 4 + y, ...(y < 6 ? [255, 224, 102] : [242, 182, 42]), 255);
    });
  });
  const big = new PNG({ width: sheet.width * ZOOM, height: sheet.height * ZOOM });
  for (let y = 0; y < big.height; y++) {
    for (let x = 0; x < big.width; x++) sheet.data.copy(big.data, (y * big.width + x) * 4, (Math.floor(y / ZOOM) * sheet.width + Math.floor(x / ZOOM)) * 4, (Math.floor(y / ZOOM) * sheet.width + Math.floor(x / ZOOM)) * 4 + 4);
  }
  mkdirSync(join(ROOT, "art/out/_preview"), { recursive: true });
  writeFileSync(join(ROOT, "art/out/_preview/toast_sheet.png"), PNG.sync.write(big));
}

if (errors.length) {
  console.error(`art ล้ม:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`art ok: ${jobs.length + toastJobs.length} ภาพ + ไอคอนแพ็ก${preview ? " · แผ่นรวมอยู่ที่ art/out/_preview/" : ""}`);
