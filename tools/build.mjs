#!/usr/bin/env node
// สร้างไฟล์ทั้งหมดของแอดออนจาก content/*.js
// ใช้: node tools/build.mjs [--pack] [--release] [--lock]
//   --pack     สร้าง dist/BiomePostcards-<ver>.mcaddon
//   --release  ล้มถ้ายังมีภาพชั่วคราว
//   --lock     เขียน content/ids.lock.json (ทำตอนปล่อยเวอร์ชันแรก)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { zipSync } from "fflate";
import * as T from "../content/cards.js";
import { PACK } from "../content/pack.js";
import { STRINGS } from "../content/strings.js";
import { THEMES } from "../BP/scripts/util/toastCode.js";
import { MODELS } from "../art/models.mjs";
import { labUi, toastUi } from "./ui.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const NS = T.NAMESPACE;
const FV = PACK.formatVersion;
const VER = PACK.version.join(".");
const LAB = Boolean(process.env.BPC_UI_LAB); // หน้าทดลอง UI สำหรับ tools/look.mjs sync --lab ห้ามใช้กับแพ็กที่แจก
const p = (...s) => join(ROOT, ...s);
let fileCount = 0;
const write = (rel, data) => {
  const f = p(rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, data);
  fileCount++;
};
const json = (rel, obj) => write(rel, JSON.stringify(obj, null, 2) + "\n");

const ALL = [...T.CARDS, ...T.BONUS_CARDS];
/** ธีมของการ์ดแจ้งเตือน: การ์ดหลักใช้ชุดสะสม การ์ดพิเศษกำหนดเองด้วย theme หรือใช้ตามชนิด */
const themeOf = (c) => c.theme ?? c.set ?? (c.kind === "festival" ? "festival" : "mystery");
const hasFoil = (c) => c.biomes.length > 0; // เฉพาะการ์ดไบโอมที่มีรุ่นฟอยล์
const variants = (c) => (hasFoil(c) ? [false, true] : [false]);
const TRINKETS = [
  ...T.SETS.map((s) => ({ id: s.reward, en: s.rewardEn, th: s.rewardTh, rgb: s.rgb, light: s.light })),
  T.GRAND_REWARD,
  ...T.SOUVENIRS,
];

// ---------- ตรวจตาราง ----------
function idsSnapshot() {
  return {
    cards: Object.fromEntries(ALL.map((c) => [c.id, c.board])),
    items: [
      ...ALL.flatMap((c) => variants(c).map((f) => `${NS}:postcard_${c.id}${f ? "_foil" : ""}`)),
      `${NS}:album`,
      `${NS}:blank_postcard`,
    ],
    blocks: [`${NS}:pin_board`, `${NS}:souvenir_stand`, ...TRINKETS.map((t) => `${NS}:${t.id}`)],
  };
}

function validate() {
  const errs = [];
  const idRe = /^[a-z0-9_]+$/;
  const seenId = new Set();
  const seenBoard = new Map();
  const seenBiome = new Map();
  const setIds = new Set(T.SETS.map((s) => s.id));
  for (const c of ALL) {
    if (!idRe.test(c.id)) errs.push(`id ไม่ถูกรูปแบบ: ${c.id}`);
    if (seenId.has(c.id)) errs.push(`id ซ้ำ: ${c.id}`);
    seenId.add(c.id);
    if (!Number.isInteger(c.board) || c.board < 1 || c.board > 63) errs.push(`board นอกช่วง 1-63: ${c.id}`);
    if (seenBoard.has(c.board)) errs.push(`board ${c.board} ซ้ำ: ${c.id} กับ ${seenBoard.get(c.board)}`);
    seenBoard.set(c.board, c.id);
    if (!["common", "uncommon", "rare"].includes(c.rarity)) errs.push(`rarity ผิด: ${c.id}`);
    if (!c.en || !c.th) errs.push(`ไม่มีชื่อ en/th: ${c.id}`);
    if (!Array.isArray(c.rgb) || c.rgb.length !== 3) errs.push(`rgb ต้องมี 3 สี: ${c.id}`);
    for (const b of c.biomes) {
      if (seenBiome.has(b)) errs.push(`ไบโอม ${b} ซ้ำ: ${c.id} กับ ${seenBiome.get(b)}`);
      seenBiome.set(b, c.id);
      if (T.IGNORED.includes(b)) errs.push(`ไบโอม ${b} อยู่ในรายการไม่นับ: ${c.id}`);
    }
    if (!THEMES.includes(themeOf(c))) errs.push(`ไม่มีธีมการ์ดแจ้งเตือน ${themeOf(c)}: ${c.id}`);
    if (c.window && !(c.window.length === 2 && c.window.every((w) => /^\d\d-\d\d$/.test(w)))) errs.push(`window ผิดรูปแบบ: ${c.id}`);
  }
  for (const c of T.CARDS) {
    if (!setIds.has(c.set)) errs.push(`ไม่มีชุด ${c.set}: ${c.id}`);
    if (!c.biomes.length) errs.push(`การ์ดหลักต้องมีไบโอม: ${c.id}`);
  }
  for (const c of T.BONUS_CARDS) {
    if (!["mystery", "biome", "festival"].includes(c.kind)) errs.push(`kind ผิด: ${c.id}`);
    if (c.kind === "festival" && !c.window) errs.push(`การ์ดเทศกาลต้องมี window: ${c.id}`);
  }
  for (const s of T.SETS) if (!T.CARDS.some((c) => c.set === s.id)) errs.push(`ชุดว่าง: ${s.id}`);
  for (const s of T.SOUVENIRS) if (s.need > T.CARDS.length) errs.push(`need เกินจำนวนการ์ด: ${s.id}`);
  for (const [k, v] of Object.entries(STRINGS)) if (!Array.isArray(v) || v.length !== 2) errs.push(`ข้อความต้องมี [en, th]: ${k}`);
  for (const [k, v] of Object.entries(STRINGS)) if (v.some((x) => /[\r\n]/.test(x))) errs.push(`ข้อความห้ามมีขึ้นบรรทัดใหม่ (ไฟล์ .lang ไม่รองรับ): ${k}`);

  // กฎเหล็ก: ID ที่ปล่อยแล้วห้ามหายหรือเปลี่ยน
  const lockFile = p("content/ids.lock.json");
  if (existsSync(lockFile) && !args.has("--lock")) {
    const lock = JSON.parse(readFileSync(lockFile, "utf8"));
    const now = idsSnapshot();
    for (const [id, board] of Object.entries(lock.cards)) {
      if (!(id in now.cards)) errs.push(`การ์ดที่ปล่อยแล้วหาย: ${id}`);
      else if (now.cards[id] !== board) errs.push(`board ของการ์ดที่ปล่อยแล้วเปลี่ยน: ${id} ${board} → ${now.cards[id]}`);
    }
    for (const k of ["items", "blocks"]) for (const id of lock[k]) if (!now[k].includes(id)) errs.push(`${k} ที่ปล่อยแล้วหาย: ${id}`);
  }
  if (errs.length) {
    console.error("build ล้ม:\n- " + errs.join("\n- "));
    process.exit(1);
  }
}

// ---------- manifest ----------
function emitManifests() {
  const meta = { authors: PACK.authors, license: PACK.license, url: PACK.url, product_type: "addon" };
  const header = (name, uuid) => ({ name, description: PACK.description, uuid, version: PACK.version, min_engine_version: PACK.minEngine });
  json("BP/manifest.json", {
    format_version: 2,
    header: header(PACK.name, PACK.uuids.bp),
    modules: [
      { type: "data", uuid: PACK.uuids.bpData, version: PACK.version },
      { type: "script", language: "javascript", uuid: PACK.uuids.bpScript, entry: "scripts/main.js", version: PACK.version },
    ],
    dependencies: [
      { uuid: PACK.uuids.rp, version: PACK.version },
      ...Object.entries(PACK.modules).map(([module_name, version]) => ({ module_name, version })),
    ],
    metadata: meta,
  });
  json("RP/manifest.json", {
    format_version: 2,
    header: header(`${PACK.name} Resources`, PACK.uuids.rp),
    modules: [{ type: "resources", uuid: PACK.uuids.rpModule, version: PACK.version }],
    dependencies: [{ uuid: PACK.uuids.bp, version: PACK.version }],
    capabilities: ["pbr"],
    metadata: meta,
  });
}

// ---------- ไอเท็ม ----------
// menu_category ต้องตรงกับหมวดใน item catalog ไม่เช่นนั้นเกมเตือนทุกไอเท็ม
const MENU = { category: "items" };
const item = (id, components) => ({ format_version: FV, "minecraft:item": { description: { identifier: `${NS}:${id}`, menu_category: MENU }, components } });
const icon = (key) => ({ textures: { default: key } });

// ไอเท็มห้ามมี custom component: client ของเกมอ่านไม่ได้ ("not present in the Schema") ทุกไอเท็มทุกครั้งที่เข้าโลก
// และผู้เล่นเห็นข้อความแดง "At least one of your resource or behavior packs failed to load" (05 ข้อ U17)
// การใช้ไอเท็มรับที่ world.afterEvents.itemUse (systems/itemUse.js)
function emitItems() {
  for (const c of ALL) {
    for (const foil of variants(c)) {
      const id = `postcard_${c.id}${foil ? "_foil" : ""}`;
      json(`BP/items/${id}.json`, item(id, {
        "minecraft:icon": icon(`${NS}_${id}`),
        "minecraft:max_stack_size": 1,
        "minecraft:display_name": { value: `item.${NS}:${id}` },
        "minecraft:tags": { tags: [`${NS}:postcard`] },
        ...(foil ? { "minecraft:glint": true } : {}),
      }));
    }
  }
  json("BP/items/album.json", item("album", {
    "minecraft:icon": icon(`${NS}_album`),
    "minecraft:max_stack_size": 1,
    "minecraft:display_name": { value: `item.${NS}:album` },
  }));
  json("BP/items/blank_postcard.json", item("blank_postcard", {
    "minecraft:icon": icon(`${NS}_blank_postcard`),
    "minecraft:max_stack_size": 64,
    "minecraft:display_name": { value: `item.${NS}:blank_postcard` },
  }));
  // ไอเท็มวาง Pin Board: ไอคอนแบนแบบกรอบรูปของเกม (โมเดลบล็อกเป็นแผ่นบาง ถือแล้วเห็นแต่สันกับด้านหลัง)
  json("BP/items/pin_board.json", item("pin_board", {
    "minecraft:icon": icon(`${NS}_pin_board`),
    "minecraft:display_name": { value: `tile.${NS}:pin_board.name` },
    "minecraft:block_placer": { block: `${NS}:pin_board`, replace_block_item: true },
  }));
  // ไอเท็มวางบล็อกของตกแต่ง ให้ไอคอนในกระเป๋าเป็นภาพแบน
  for (const t of TRINKETS) {
    json(`BP/items/${t.id}.json`, item(t.id, {
      "minecraft:icon": icon(`${NS}_${t.id}`),
      "minecraft:display_name": { value: `tile.${NS}:${t.id}.name` },
      "minecraft:block_placer": { block: `${NS}:${t.id}`, replace_block_item: true },
    }));
  }
}

// ---------- บล็อก ----------
const block = (id, description, components, permutations) => ({
  format_version: FV,
  "minecraft:block": { description: { identifier: `${NS}:${id}`, menu_category: MENU, ...description }, components, ...(permutations ? { permutations } : {}) },
});
const RENDER = "alpha_test_single_sided";

// ---------- โมเดล 3 มิติ (art/models.mjs): geometry + เท็กซ์เจอร์ลง RP และไฟล์ Blockbench ลง art/blockbench ----------
const BUILT = new Map();
function emitModels() {
  for (const m of MODELS) {
    const out = m.build();
    BUILT.set(m.id, out);
    json(`RP/models/blocks/${m.id}.geo.json`, out.geo);
    write(`RP/textures/blocks/models/${m.id}.png`, out.png);
    write(`art/blockbench/${m.id}.bbmodel`, JSON.stringify(out.bbmodel));
  }
}
/** กล่องเลือก/ชนจากขอบเขตของโมเดล ปัดออกเป็นจำนวนเต็มและไม่เกินขอบบล็อก */
function boxOf(id) {
  const { origin, size } = BUILT.get(id).bounds;
  const lim = [[-8, 8], [0, 16], [-8, 8]];
  const lo = origin.map((v, k) => Math.max(lim[k][0], Math.floor(v)));
  const hi = origin.map((v, k) => Math.min(lim[k][1], Math.ceil(v + size[k])));
  return { origin: lo, size: hi.map((v, k) => v - lo[k]) };
}
const modelTexture = (id) => `${NS}_model_${id}`;
const dir = (d) => `q.block_state('minecraft:cardinal_direction') == '${d}'`;
/** หมุนตามทิศที่วาง: ด้านหน้าของโมเดล (ทิศเหนือ) หันหาผู้เล่น */
const FACING = {
  traits: { "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 } },
  permutations: [
    { condition: dir("south"), components: { "minecraft:transformation": { rotation: [0, 180, 0] } } },
    { condition: dir("west"), components: { "minecraft:transformation": { rotation: [0, 90, 0] } } },
    { condition: dir("east"), components: { "minecraft:transformation": { rotation: [0, 270, 0] } } },
  ],
};

function emitBlocks() {
  // Pin Board: เลขการ์ด = page × 16 + slot (0 = ว่าง) รองรับ 63 การ์ด
  // หน้าของกรอบ ไม้ก๊อก โปสการ์ด และหมุดใช้ภาพของการ์ด (material "card") ส่วนไม้ด้านข้างและด้านหลังใช้เท็กซ์เจอร์ของโมเดล
  const mats = (tex) => ({
    "*": { texture: modelTexture("pin_board"), render_method: RENDER },
    card: { texture: tex, render_method: RENDER },
  });
  const permutations = [...FACING.permutations];
  for (const c of ALL) {
    const at = `q.block_state('${NS}:page') == ${c.board >> 4} && q.block_state('${NS}:slot') == ${c.board & 15}`;
    if (!hasFoil(c)) {
      permutations.push({ condition: at, components: { "minecraft:material_instances": mats(`${NS}_board_${c.id}`) } });
      continue;
    }
    for (const foil of [false, true]) {
      permutations.push({
        condition: `${at} && q.block_state('${NS}:foil') == ${foil}`,
        components: { "minecraft:material_instances": mats(`${NS}_board_${c.id}${foil ? "_foil" : ""}`) },
      });
    }
  }
  // โครง "card" (แผ่นโปสการ์ด + หมุดของการ์ด) เห็นเมื่อมีการ์ด โครง "pins" (หมุดของบอร์ดเปล่า) เห็นเมื่อว่าง
  const hasCard = `q.block_state('${NS}:page') != 0 || q.block_state('${NS}:slot') != 0`;
  json("BP/blocks/pin_board.json", block("pin_board", {
    states: {
      [`${NS}:page`]: [0, 1, 2, 3],
      [`${NS}:slot`]: { values: { min: 0, max: 15 } },
      [`${NS}:foil`]: [false, true],
    },
    traits: FACING.traits,
  }, {
    "minecraft:geometry": { identifier: `geometry.${NS}.pin_board`, bone_visibility: { card: hasCard, pins: `!(${hasCard})` } },
    "minecraft:material_instances": mats(`${NS}_board_empty`),
    "minecraft:collision_box": false,
    "minecraft:selection_box": { origin: [-8, 0, 6], size: [16, 16, 2] },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 0.4 },
    "minecraft:destructible_by_explosion": { explosion_resistance: 1 },
    "minecraft:light_dampening": 0,
    "minecraft:map_color": "#b98a5a",
    "minecraft:movable": { movement_type: "immovable" },
    [`${NS}:pin_board`]: {},
  }, permutations));

  json("BP/blocks/souvenir_stand.json", block("souvenir_stand", {}, {
    "minecraft:geometry": { identifier: `geometry.${NS}.souvenir_stand` },
    "minecraft:material_instances": { "*": { texture: modelTexture("souvenir_stand"), render_method: RENDER } },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 1 },
    "minecraft:light_dampening": 0,
    "minecraft:map_color": "#b98a5a",
    [`${NS}:souvenir_stand`]: {},
  }));

  // ของตกแต่ง: โมเดลของตัวเอง หันหน้าหาผู้เล่นตอนวาง กล่องเลือกและกล่องชนตามขนาดโมเดล
  for (const t of TRINKETS) {
    const box = boxOf(t.id);
    json(`BP/blocks/${t.id}.json`, block(t.id, { traits: FACING.traits }, {
      "minecraft:geometry": { identifier: `geometry.${NS}.${t.id}` },
      "minecraft:material_instances": { "*": { texture: modelTexture(t.id), render_method: RENDER, ambient_occlusion: 0.0 } },
      "minecraft:collision_box": box,
      "minecraft:selection_box": box,
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0.2 },
      "minecraft:light_dampening": 0,
      ...(t.light ? { "minecraft:light_emission": t.light } : {}),
      "minecraft:map_color": t.rgb[0],
    }, FACING.permutations));
  }

  write("RP/blocks.json", JSON.stringify({
    format_version: "1.21.40",
    [`${NS}:pin_board`]: { sound: "wood" },
    [`${NS}:souvenir_stand`]: { sound: "wood" },
    ...Object.fromEntries(TRINKETS.map((t) => [`${NS}:${t.id}`, { sound: "stone" }])),
  }, null, 2) + "\n");
}

// ---------- สูตรคราฟต์และหมวดในกระเป๋าสร้างสรรค์ ----------
function emitRecipes() {
  const R = "1.20.10";
  const mc = (i) => ({ item: `minecraft:${i}` });
  json("BP/recipes/album.json", {
    format_version: R,
    "minecraft:recipe_shapeless": {
      description: { identifier: `${NS}:album` },
      tags: ["crafting_table"],
      ingredients: [mc("book"), mc("paper"), mc("paper")],
      unlock: [mc("book")],
      result: { item: `${NS}:album` },
    },
  });
  json("BP/recipes/pin_board.json", {
    format_version: R,
    "minecraft:recipe_shaped": {
      description: { identifier: `${NS}:pin_board` },
      tags: ["crafting_table"],
      pattern: ["###", "#P#", "###"],
      key: { "#": mc("stick"), P: { tag: "minecraft:planks" } },
      unlock: [mc("stick")],
      result: { item: `${NS}:pin_board` },
    },
  });
  json("BP/recipes/souvenir_stand.json", {
    format_version: R,
    "minecraft:recipe_shaped": {
      description: { identifier: `${NS}:souvenir_stand` },
      tags: ["crafting_table"],
      pattern: ["PBP", "PCP"],
      key: { P: { tag: "minecraft:planks" }, B: { item: `${NS}:blank_postcard` }, C: mc("chest") },
      unlock: [{ item: `${NS}:blank_postcard` }],
      result: { item: `${NS}:souvenir_stand` },
    },
  });
  for (const dye of T.DYES) {
    json(`BP/recipes/blank_postcard_${dye}.json`, {
      format_version: R,
      "minecraft:recipe_shapeless": {
        description: { identifier: `${NS}:blank_postcard_${dye}` },
        tags: ["crafting_table"],
        ingredients: [mc("paper"), mc(`${dye}_dye`)],
        unlock: [mc("paper")],
        result: { item: `${NS}:blank_postcard` },
      },
    });
  }
}

function emitCatalog() {
  json("BP/item_catalog/crafting_item_catalog.json", {
    format_version: "1.21.60",
    "minecraft:crafting_items_catalog": {
      categories: [{
        category_name: "items",
        groups: [
          { items: [`${NS}:album`, `${NS}:blank_postcard`, `${NS}:pin_board`, `${NS}:souvenir_stand`, ...TRINKETS.map((t) => `${NS}:${t.id}`)] },
          {
            group_identifier: { icon: `${NS}:postcard_${T.CARDS[0].id}`, name: `${NS}:itemGroup.name.postcards` },
            items: idsSnapshot().items.filter((i) => i.includes(":postcard_")),
          },
        ],
      }],
    },
  });
}

// ---------- ภาพ ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
function canvas(w, h, fill) {
  const png = new PNG({ width: w, height: h });
  const cv = {
    png, w, h,
    set(x, y, c) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3] ?? 255;
    },
    rect(x, y, rw, rh, c) {
      for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) cv.set(i, j, c);
    },
  };
  if (fill) cv.rect(0, 0, w, h, fill);
  return cv;
}
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
function digits(cv, x, y, n, c) {
  for (const ch of String(n)) {
    const g = DIGITS[+ch];
    for (let i = 0; i < 15; i++) if (g[i] === "1") cv.set(x + (i % 3), y + ((i / 3) | 0), c);
    x += 4;
  }
}
// ภาพชั่วคราว: ฟ้า/พื้น/จุดเด่นมุมซ้ายบน + เลขมุมขวาล่าง (ไม่สมมาตร ใช้ดูทิศและการกลับด้าน)
function scene(size, [sky, ground, accent], n) {
  const s = size / 16;
  const cv = canvas(size, size, hex("#3b2a1a"));
  cv.rect(s, s, size - 2 * s, size - 2 * s, hex(sky));
  cv.rect(s, 9 * s, size - 2 * s, 6 * s, hex(ground));
  cv.rect(2 * s, 2 * s, 4 * s, 4 * s, hex(accent));
  if (n !== undefined) digits(cv, size - s - 4 * String(n).length, size - s - 6, n, hex("#ffffff"));
  return cv;
}
function flat(size, [a, b], n) {
  const s = size / 16;
  const cv = canvas(size, size, hex(a));
  cv.rect(3 * s, 3 * s, size - 6 * s, size - 6 * s, hex(b));
  if (n !== undefined) digits(cv, 2 * s, 2 * s, n, hex("#ffffff"));
  return cv;
}
// รุ่นฟอยล์ประกอบจากภาพปกติ: ขอบกระดาษของโปสการ์ด (สี PAPER ใน art/postcards.px.js) กลายเป็นทองระยิบ
// ภาพที่ไม่มีสีขอบมาตรฐาน (เช่นภาพที่ศิลปินวาดใหม่) จะได้แสตมป์ทองมุมขวาบนแทน
const PAPER = [0xf4, 0xef, 0xe2];
const GOLD = [[0xff, 0xf3, 0xa0], [0xff, 0xd2, 0x3d], [0xe6, 0xb9, 0x3a], [0xff, 0xd2, 0x3d]];
function foilOver(buf) {
  const img = PNG.sync.read(buf);
  let swapped = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i] !== PAPER[0] || img.data[i + 1] !== PAPER[1] || img.data[i + 2] !== PAPER[2] || img.data[i + 3] !== 255) continue;
      const gold = GOLD[(x + y) % 4];
      img.data[i] = gold[0]; img.data[i + 1] = gold[1]; img.data[i + 2] = gold[2];
      swapped++;
    }
  }
  if (swapped) return PNG.sync.write(img);
  const s = img.width / 16;
  const r = 2 * s;
  const cx = img.width - r - s - 1;
  const cy = r + s;
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const i = (y * img.width + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  };
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= r) put(cx + dx, cy + dy, d === 0 ? hex("#fff6c2") : hex("#ffd23d"));
      else if (d === r + 1) put(cx + dx, cy + dy, hex("#8a5a12"));
    }
  }
  return PNG.sync.write(img);
}

const PH_FILE = "art/placeholders.json";
const ph = existsSync(p(PH_FILE)) ? JSON.parse(readFileSync(p(PH_FILE), "utf8")) : {};
const sha = (b) => createHash("sha1").update(b).digest("hex");
// คืนภาพจริงถ้ามี ถ้าไม่มี (หรือยังเป็นภาพชั่วคราวรุ่นเก่า) สร้างภาพชั่วคราวใหม่
function ensureImage(rel, make) {
  const f = p(rel);
  if (existsSync(f)) {
    const cur = readFileSync(f);
    if (ph[rel] !== sha(cur)) {
      delete ph[rel];
      return cur;
    }
  }
  const buf = PNG.sync.write(make().png);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, buf);
  ph[rel] = sha(buf);
  return buf;
}

function emitTextures() {
  const items = {};
  const terrain = {};
  const I = "RP/textures/items";
  const B = "RP/textures/blocks";
  for (const c of ALL) {
    const small = ensureImage(`${I}/postcards/${c.id}.png`, () => scene(16, c.rgb, c.board));
    const big = ensureImage(`${B}/pin_board/${c.id}.png`, () => scene(32, c.rgb, c.board));
    items[`${NS}_postcard_${c.id}`] = { textures: `textures/items/postcards/${c.id}` };
    terrain[`${NS}_board_${c.id}`] = { textures: `textures/blocks/pin_board/${c.id}` };
    if (hasFoil(c)) {
      write(`${I}/postcards/${c.id}_foil.png`, foilOver(small));
      write(`${B}/pin_board/${c.id}_foil.png`, foilOver(big));
      items[`${NS}_postcard_${c.id}_foil`] = { textures: `textures/items/postcards/${c.id}_foil` };
      terrain[`${NS}_board_${c.id}_foil`] = { textures: `textures/blocks/pin_board/${c.id}_foil` };
    }
  }
  ensureImage(`${I}/album.png`, () => flat(16, ["#7a4a2a", "#e8d9b0"]));
  ensureImage(`${I}/blank_postcard.png`, () => flat(16, ["#3b2a1a", "#f4efe2"]));
  items[`${NS}_album`] = { textures: "textures/items/album" };
  items[`${NS}_blank_postcard`] = { textures: "textures/items/blank_postcard" };
  ensureImage(`${B}/pin_board/empty.png`, () => flat(32, ["#7a4a2a", "#c79a63"]));
  terrain[`${NS}_board_empty`] = { textures: "textures/blocks/pin_board/empty" };
  ensureImage(`${I}/pin_board.png`, () => flat(16, ["#7a4a2a", "#c79a63"]));
  items[`${NS}_pin_board`] = { textures: "textures/items/pin_board" };
  // เท็กซ์เจอร์ของโมเดล 3 มิติ (emitModels เขียนไฟล์ไว้แล้ว)
  for (const id of BUILT.keys()) terrain[modelTexture(id)] = { textures: `textures/blocks/models/${id}` };
  // ไอคอนของของตกแต่ง (ภาพแบน 16×16 ใช้ทั้งในกระเป๋าและบนการ์ดแจ้งเตือน)
  TRINKETS.forEach((t, i) => {
    ensureImage(`${B}/decor/${t.id}.png`, () => {
      const cv = canvas(16, 16, [0, 0, 0, 0]);
      cv.rect(4, 12, 8, 3, hex(t.rgb[1]));
      cv.rect(5, 4, 6, 8, hex(t.rgb[0]));
      digits(cv, 5, 5, i + 1, hex("#ffffff"));
      return cv;
    });
    items[`${NS}_${t.id}`] = { textures: `textures/blocks/decor/${t.id}` };
  });
  ensureImage("RP/textures/ui/bpc_lock.png", () => flat(16, ["#2b2b2b", "#8a8a8a"]));
  ensureImage("RP/pack_icon.png", () => scene(256, T.CARDS[5].rgb));
  ensureImage("BP/pack_icon.png", () => scene(256, T.CARDS[5].rgb));

  json("RP/textures/item_texture.json", { resource_pack_name: NS, texture_name: "atlas.items", texture_data: items });
  json("RP/textures/terrain_texture.json", { resource_pack_name: NS, texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: terrain });
  write(PH_FILE, JSON.stringify(Object.fromEntries(Object.entries(ph).sort()), null, 2) + "\n");
  return Object.keys(ph).length;
}

// ---------- ภาษา ----------
function emitLang() {
  const en = [];
  const th = [];
  const add = (k, e, t) => {
    en.push(`${k}=${e}`);
    th.push(`${k}=${t}`);
  };
  for (const [k, [e, t]] of Object.entries(STRINGS)) add(k, e, t);
  const [pe, pt] = STRINGS[`${NS}.item.postcard`];
  const [fe, ft] = STRINGS[`${NS}.item.postcard_foil`];
  for (const c of ALL) {
    add(`${NS}.card.${c.id}`, c.en, c.th);
    add(`item.${NS}:postcard_${c.id}`, pe.replace("%s", c.en), pt.replace("%s", c.th));
    if (hasFoil(c)) add(`item.${NS}:postcard_${c.id}_foil`, fe.replace("%s", c.en), ft.replace("%s", c.th));
  }
  for (const s of T.SETS) add(`${NS}.set.${s.id}`, s.en, s.th);
  for (const t of TRINKETS) add(`tile.${NS}:${t.id}.name`, t.en, t.th);
  write("RP/texts/en_US.lang", en.join("\n") + "\n");
  write("RP/texts/th_TH.lang", th.join("\n") + "\n");
  json("RP/texts/languages.json", ["en_US", "th_TH"]);
  json("RP/texts/language_names.json", [["en_US", "English (US)"], ["th_TH", "ไทย (ประเทศไทย)"]]);
}

// ---------- ตารางสำหรับสคริปต์ ----------
function emitRegistry() {
  const mcid = (b) => `minecraft:${b}`;
  const cards = ALL.map((c) => ({
    id: c.id,
    board: c.board,
    rarity: c.rarity,
    kind: c.kind ?? "biome",
    bonus: !T.CARDS.includes(c),
    foil: hasFoil(c),
    ...(c.set ? { set: c.set } : {}),
    theme: themeOf(c),
    biomes: c.biomes.map(mcid),
    ...(c.window ? { window: c.window } : {}),
    ...(c.experimental ? { experimental: true } : {}),
  }));
  const sets = T.SETS.map((s) => ({ id: s.id, reward: `${NS}:${s.reward}`, cards: T.CARDS.filter((c) => c.set === s.id).map((c) => c.id) }));
  const souvenirs = T.SOUVENIRS.map((s) => ({ id: `${NS}:${s.id}`, need: s.need || T.CARDS.length, price: s.price, icon: `textures/blocks/decor/${s.id}` }));
  const loreEn = Object.fromEntries(Object.entries(STRINGS).filter(([k]) => k.startsWith(`${NS}.lore.`)).map(([k, v]) => [k, v[0]]));
  const lines = [
    "// สร้างอัตโนมัติจาก content/ ด้วย tools/build.mjs ห้ามแก้มือ",
    `export const NS = ${JSON.stringify(NS)};`,
    `export const VERSION = ${JSON.stringify(VER)};`,
    `export const CARDS = ${JSON.stringify(cards)};`,
    `export const IGNORED = ${JSON.stringify(T.IGNORED.map(mcid))};`,
    `export const SETS = ${JSON.stringify(sets)};`,
    `export const GRAND_REWARD = ${JSON.stringify(`${NS}:${T.GRAND_REWARD.id}`)};`,
    `export const SOUVENIRS = ${JSON.stringify(souvenirs)};`,
    `export const LORE_EN = ${JSON.stringify(loreEn)};`,
    "",
  ];
  write("BP/scripts/registry/cards.generated.js", lines.join("\n"));
}

// ---------- .mcaddon ----------
function packAddon() {
  const files = {};
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const f = join(dir, name);
      if (statSync(f).isDirectory()) walk(f, `${prefix}${name}/`);
      else files[`${prefix}${name}`] = new Uint8Array(readFileSync(f));
    }
  };
  walk(p("BP"), "BiomePostcards_BP/");
  walk(p("RP"), "BiomePostcards_RP/");
  // เครดิตและเงื่อนไขการใช้ติดไปกับแพ็กทั้งสอง (ไฟล์ที่เกมไม่รู้จักในโฟลเดอร์แพ็กไม่มีผลกับการโหลด)
  for (const dir of ["BiomePostcards_BP/", "BiomePostcards_RP/"]) {
    files[`${dir}LICENSE.txt`] = new Uint8Array(readFileSync(p("LICENSE")));
    files[`${dir}CREDITS.txt`] = new Uint8Array(readFileSync(p("CREDITS.md")));
  }
  // เวลาในไฟล์ zip ตายตัว: build ซ้ำจากโค้ดเดิมได้ไฟล์เดิมทุกไบต์ (SHA-256 บนเว็บกับที่อัปโหลดที่อื่นจึงตรงกัน)
  const zip = zipSync(files, { level: 9, mtime: new Date(2026, 0, 1) });
  const out = `dist/BiomePostcards-${VER}.mcaddon`;
  write(out, zip);
  return `${out} ${(zip.length / 1024).toFixed(0)} KB`;
}

// ---------- รัน ----------
validate();
for (const d of ["BP/items", "BP/blocks", "BP/recipes", "BP/item_catalog", "RP/texts", "RP/models", "RP/ui"]) rmSync(p(d), { recursive: true, force: true });
emitManifests();
emitItems();
emitModels();
emitBlocks();
emitRecipes();
emitCatalog();
const placeholders = emitTextures();
emitLang();
emitRegistry();
if (LAB) {
  if (args.has("--pack")) {
    console.error("build ล้ม: ห้ามทำแพ็กแจกขณะเปิด BPC_UI_LAB");
    process.exit(1);
  }
  for (const [rel, obj] of Object.entries(labUi())) json(rel, obj);
} else {
  for (const [rel, obj] of Object.entries(toastUi(T))) json(rel, obj);
}
if (args.has("--lock")) json("content/ids.lock.json", idsSnapshot());
if (args.has("--release") && placeholders) {
  console.error(`build ล้ม: ยังมีภาพชั่วคราว ${placeholders} ไฟล์ (ดู ${PH_FILE})`);
  process.exit(1);
}
const packed = args.has("--pack") ? ` · ${packAddon()}` : "";
console.log(`build ok: ${fileCount} ไฟล์ · การ์ดหลัก ${T.CARDS.length} · พิเศษ ${T.BONUS_CARDS.length} · ภาพชั่วคราว ${placeholders}${packed}`);
