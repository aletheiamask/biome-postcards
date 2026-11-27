// ส่งข้อมูลและไฟล์ของแอดออนไปให้เว็บ Tacoparoni (หน้า /biome-postcards และ wiki)
// ใช้: node tools/site.mjs <โฟลเดอร์ repo ของเว็บ>   (ค่าเริ่มต้น ../Tacoparoni/site)
// รันหลัง `node tools/build.mjs --pack --release` ทุกครั้งที่ปล่อยเวอร์ชันใหม่ แล้วเพิ่มแถวใน src/lib/releases.ts ของเว็บ
// สิ่งที่เขียน: src/lib/bpc-data.json, public/assets/bpc/**, public/downloads/biome-postcards/BiomePostcards-<ver>.mcaddon
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import * as T from "../content/cards.js";
import { PACK } from "../content/pack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(process.argv[2] ?? join(ROOT, "..", "Tacoparoni", "site"));
if (!existsSync(join(SITE, "src/lib/site.ts"))) {
  console.error(`site: ไม่พบ repo ของเว็บที่ ${SITE}`);
  process.exit(1);
}
const VER = PACK.version.join(".");
const p = (...a) => join(ROOT, ...a);
const out = (rel) => {
  const f = join(SITE, rel);
  mkdirSync(dirname(f), { recursive: true });
  return f;
};

// ขยายภาพพิกเซลแบบ nearest ให้คมเมื่อเว็บย่อขยาย (เว็บใส่ image-rendering: pixelated ด้วย)
function scaled(src, k) {
  const a = PNG.sync.read(readFileSync(src));
  const b = new PNG({ width: a.width * k, height: a.height * k });
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const s = ((y / k | 0) * a.width + (x / k | 0)) * 4;
      a.data.copy(b.data, (y * b.width + x) * 4, s, s + 4);
    }
  }
  return PNG.sync.write(b);
}

let n = 0;
const put = (rel, buf) => (writeFileSync(out(rel), buf), n++);

const all = [...T.CARDS, ...T.BONUS_CARDS];
for (const c of all) {
  put(`public/assets/bpc/cards/${c.id}.png`, scaled(p(`RP/textures/blocks/pin_board/${c.id}.png`), 4));
}
for (const id of ["plains", "cherry_grove", "deep_dark"]) put(`public/assets/bpc/cards/${id}_foil.png`, scaled(p(`RP/textures/blocks/pin_board/${id}_foil.png`), 4));
const decor = [...T.SETS.map((s) => s.reward), T.GRAND_REWARD.id, ...T.SOUVENIRS.map((s) => s.id)];
for (const id of decor) put(`public/assets/bpc/items/${id}.png`, scaled(p(`RP/textures/blocks/decor/${id}.png`), 4));
for (const id of ["album", "blank_postcard", "pin_board"]) put(`public/assets/bpc/items/${id}.png`, scaled(p(`RP/textures/items/${id}.png`), 4));
put("public/assets/bpc/icon.png", readFileSync(p("RP/pack_icon.png")));
// แบนเนอร์การ์ดแจ้งเตือน GIF จาก tools/banner.mjs
for (const t of ["forests", "cold", "dry", "wet", "underground", "otherworld"]) {
  for (const ext of ["gif", "png"]) {
    const src = p(`art/out/web/banner-${t}.${ext}`);
    if (!existsSync(src)) {
      console.error(`site: ไม่พบ ${src} (รัน node tools/banner.mjs ก่อน)`);
      process.exit(1);
    }
    put(`public/assets/bpc/banner-${t}.${ext}`, readFileSync(src));
  }
}

const addon = p(`dist/BiomePostcards-${VER}.mcaddon`);
if (!existsSync(addon)) {
  console.error(`site: ไม่พบ ${addon} (รัน node tools/build.mjs --pack --release ก่อน)`);
  process.exit(1);
}
copyFileSync(addon, out(`public/downloads/biome-postcards/BiomePostcards-${VER}.mcaddon`));

const card = (c) => ({ id: c.id, en: c.en, th: c.th, rarity: c.rarity, ...(c.set ? { set: c.set } : {}), ...(c.kind ? { kind: c.kind } : {}), biomes: c.biomes, ...(c.window ? { window: c.window } : {}), ...(c.experimental ? { experimental: true } : {}) });
const data = {
  version: VER,
  minEngine: PACK.minEngine.join("."),
  modules: PACK.modules,
  cards: T.CARDS.map(card),
  bonus: T.BONUS_CARDS.map(card),
  ignored: T.IGNORED,
  sets: T.SETS.map((s) => ({ id: s.id, en: s.en, th: s.th, reward: s.reward, rewardEn: s.rewardEn, rewardTh: s.rewardTh, ...(s.light ? { light: s.light } : {}) })),
  grand: { id: T.GRAND_REWARD.id, en: T.GRAND_REWARD.en, th: T.GRAND_REWARD.th, light: T.GRAND_REWARD.light },
  souvenirs: T.SOUVENIRS.map((s) => ({ id: s.id, en: s.en, th: s.th, need: s.need, price: s.price })),
};
writeFileSync(out("src/lib/bpc-data.json"), JSON.stringify(data, null, 2) + "\n");
console.log(`site ok: ${SITE} · ภาพ ${n} ไฟล์ · ข้อมูลการ์ด ${data.cards.length}+${data.bonus.length} · BiomePostcards-${VER}.mcaddon`);
