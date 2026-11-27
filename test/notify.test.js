// คิวการ์ดแจ้งเตือน (systems/notify.js) และรหัสที่ฝังใน title (util/toastCode.js)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { mock, world } from "@minecraft/server";
import { keysOf } from "@minecraft/server-ui";
import { loadSettings, saveSettings } from "../BP/scripts/config.js";
import { CARDS, SETS } from "../BP/scripts/registry/cards.generated.js";
import * as feedback from "../BP/scripts/systems/feedback.js";
import * as notify from "../BP/scripts/systems/notify.js";
import { MAX_WAITING, PACE, RANK } from "../BP/scripts/systems/notify.js";
import { tr } from "../BP/scripts/util/text.js";
import { MARK, PIC, PIC_SET_BASE, THEMES, picCode, themeCode, toastCode } from "../BP/scripts/util/toastCode.js";
import { PNG } from "pngjs";
import * as T from "../content/cards.js";
import { toastPics, toastUi } from "../tools/ui.mjs";

beforeEach(() => {
  mock.reset();
  notify.resetState();
  loadSettings(world);
});

const card = (id, extra = {}) => ({ rank: RANK.card, title: tr(`bpc.card.${id}`), banner: tr("bpc.toast.new", 1, 31), theme: "forests", pic: 6, ...extra });
const album = () => ({ rank: RANK.album, title: tr("item.bpc:album"), banner: tr("bpc.toast.album"), theme: "reward", pic: PIC.album });
const shownKeys = (p) => p.titles.map((t) => keysOf(t.title)[0]);
const codeOf = (title) => title.rawtext.at(-1).text;
const total = (pace) => pace.fadeInDuration + pace.stayDuration + pace.fadeOutDuration;

test("รหัสการ์ด: เป็นรหัสสี § ล้วน ไม่ซ้ำกัน และแยกธีมกับภาพออกจากกันได้", () => {
  assert.equal(THEMES.length, 10);
  assert.match(MARK, /^(§[a-u])+$/);
  const codes = new Set();
  for (const theme of THEMES) {
    for (const pic of [0, 6, 37, PIC.album, PIC.globe, PIC.more, PIC_SET_BASE + 6]) {
      const code = toastCode(theme, pic);
      assert.match(code, /^(§[0-9a-u])+$/, code); // ไม่มีตัวอักษรที่มองเห็นได้ใน title ปกติ
      assert.ok(code.startsWith(MARK) && code.includes(themeCode(theme)) && code.endsWith(picCode(pic)));
      codes.add(code);
      for (const other of THEMES) if (other !== theme) assert.ok(!code.includes(themeCode(other)), `${theme} กับ ${other}`);
    }
  }
  assert.equal(codes.size, THEMES.length * 7);
  assert.ok(!toastCode("forests", 6).includes(picCode(60)) && !toastCode("forests", 16).includes(picCode(6)));
  assert.equal(themeCode("no-such-theme"), themeCode("mystery"));
  assert.equal(picCode(-5), picCode(0));
});

test("รหัสการ์ด: การ์ดทุกใบมีธีมที่รู้จัก และภาพทุกเลขมีในหน้าจอของแพ็ก", () => {
  for (const c of CARDS) assert.ok(THEMES.includes(c.theme), `${c.id}: ${c.theme}`);
  const pics = new Map(toastPics(T));
  for (const c of CARDS) assert.equal(pics.get(c.board), `textures/items/postcards/${c.id}`);
  for (const n of [PIC.album, PIC.globe, PIC.more, ...SETS.map((_, i) => PIC_SET_BASE + i)]) assert.ok(pics.has(n), String(n));
  const ui = toastUi(T);
  const toast = ui["RP/ui/bpc_toast.json"];
  assert.equal(toast.pics.controls.length, pics.size);
  assert.equal(toast.scene_bg.controls.length, THEMES.length);
  assert.equal(toast.scene_fg.controls.length, THEMES.length);
  // title ที่ไม่มีรหัสของเราต้องแสดงด้วย element เดิมของเกม และการซ่อนอยู่ในแผงห่อเท่านั้น
  assert.equal(JSON.stringify(toast.wrap).includes("vanilla_title@hud.hud_title_text"), true);
  const hud = ui["RP/ui/hud_screen.json"];
  assert.deepEqual(Object.keys(hud), ["namespace", "root_panel"]);
  assert.equal(hud.root_panel.modifications[0].value[0].hud_title_text_area.factory.control_ids.hud_title_text, "hud_title_text@bpc_toast.wrap");
});

// เกมคงสัดส่วนของภาพไว้ (keep_ratio เริ่มต้นเป็น true): ภาพที่สัดส่วนไม่ตรงกับกล่องจะถูกวาดเล็กกว่ากล่องและอยู่กลาง
// ป้ายมุมเคยพังเพราะข้อนี้ (แถบ 1×1 / 1×2 ในกล่องที่กว้างตามข้อความ): docs/bugfix/2026-11-10-0.10.0-ป้ายการ์ดแจ้งเตือน
test("ภาพของการ์ด: กล่องที่สัดส่วนไม่ตรงกับภาพ หรือกว้างตามข้อความ ต้องตั้ง keep_ratio: false", () => {
  const toast = toastUi(T)["RP/ui/bpc_toast.json"];
  const texSize = (texture) => {
    const file = new URL(`../RP/${texture}.png`, import.meta.url);
    if (!existsSync(file)) return undefined;
    const png = PNG.sync.read(readFileSync(file));
    return [png.width, png.height];
  };
  const px = (v, parent) => (typeof v === "number" ? v : v === "100%" ? parent : undefined); // ขนาดแบบอื่น (เช่น "100%c + 8px") ถือว่าไม่รู้ค่า
  const checked = [];
  const walk = (name, raw, parent) => {
    const ref = /@bpc_toast\.(\w+)$/.exec(name)?.[1];
    const c = ref ? { ...toast[ref], ...raw } : raw;
    const size = c.size ?? ["100%", "100%"];
    const box = [px(size[0], parent[0]), px(size[1], parent[1])];
    if (c.type === "image") {
      const tex = c.uv_size ?? texSize(c.texture);
      if (tex) {
        const same = box[0] !== undefined && box[1] !== undefined && Math.abs(box[0] / box[1] - tex[0] / tex[1]) < 1e-6;
        if (!same) assert.equal(c.keep_ratio, false, `${name}: กล่อง ${JSON.stringify(size)} กับภาพ ${tex.join("×")} สัดส่วนไม่ตรงกัน ต้องมี keep_ratio: false`);
        checked.push(name.split("@")[0]);
      }
    }
    for (const child of c.controls ?? []) for (const [n, v] of Object.entries(child)) walk(n, v, box);
  };
  walk("card_area@bpc_toast.card_area", {}, [undefined, undefined]);
  for (const must of ["banner", "fill", "frame", "shine", "shade"]) assert.ok(checked.includes(must), `ไม่ได้ตรวจ ${must}: ${checked.join(" ")}`);
  assert.ok(checked.length > THEMES.length * 2 + 30, `ตรวจภาพได้ ${checked.length} ภาพ`);
  assert.equal(toast.banner.keep_ratio, false);
  assert.equal(toast.banner.controls[0].fill.keep_ratio, false);
});

test("คิว: ใบแรกแสดงทันทีพร้อมรหัสต่อท้ายชื่อ ใบถัดไปรอจนใบก่อนจบ", () => {
  const p = mock.player();
  notify.push(p, card("plains", { theme: "fields", pic: 1 }));
  notify.push(p, card("forest"));
  assert.deepEqual(shownKeys(p), ["bpc.card.plains"]);
  assert.equal(codeOf(p.titles[0].title), toastCode("fields", 1));
  assert.deepEqual(keysOf(p.titles[0].options.subtitle), ["bpc.toast.new"]);
  assert.deepEqual({ ...p.titles[0].options, subtitle: 0 }, { ...PACE.normal, subtitle: 0 });
  mock.advance(total(PACE.normal));
  assert.equal(p.titles.length, 1); // ยังอยู่ในช่วงเว้นระหว่างใบ
  mock.advance(10);
  assert.deepEqual(shownKeys(p), ["bpc.card.plains", "bpc.card.forest"]);
  assert.equal(notify.waiting(p.id), 0);
  mock.advance(200);
  assert.equal(p.titles.length, 2);
  notify.push(p, card("taiga")); // คิวว่างแล้ว: แสดงทันทีอีกครั้ง
  assert.equal(p.titles.length, 3);
});

test("คิว: เรียงโปสการ์ด → อัลบั้ม → ครบชุด → ครบทุกชุด และคงลำดับเดิมในกลุ่มเดียวกัน", () => {
  const p = mock.player();
  notify.push(p, card("a"));
  notify.push(p, { ...album(), rank: RANK.grand, title: tr("bpc.toast.all_sets") });
  notify.push(p, { ...album(), rank: RANK.set, title: tr("bpc.set.dry") });
  notify.push(p, album());
  notify.push(p, card("b"));
  notify.push(p, card("c"));
  mock.advance(2000);
  assert.deepEqual(shownKeys(p), ["bpc.card.a", "bpc.card.b", "bpc.card.c", "item.bpc:album", "bpc.set.dry", "bpc.toast.all_sets"]);
});

test("คิว: เมื่อยังรออีกตั้งแต่ 2 ใบ ใบที่แสดงค้างสั้นลง", () => {
  const p = mock.player();
  for (const id of ["a", "b", "c", "d"]) notify.push(p, card(id));
  mock.advance(2000);
  assert.deepEqual(p.titles.map((t) => t.options.stayDuration), [PACE.normal.stayDuration, PACE.fast.stayDuration, PACE.normal.stayDuration, PACE.normal.stayDuration]);
});

test("คิว: โปสการ์ดที่รอเกินจำนวนรวมเป็นใบสรุปใบเดียว ส่วนรางวัลไม่ถูกรวม", () => {
  const p = mock.player();
  const extra = 5;
  for (let i = 0; i < 1 + MAX_WAITING + extra; i++) notify.push(p, card(`c${i}`));
  notify.push(p, album());
  assert.equal(notify.waiting(p.id), MAX_WAITING + 2); // โปสการ์ดที่รอ + ใบสรุป + อัลบั้ม
  mock.advance(4000);
  const keys = shownKeys(p);
  assert.equal(keys.length, 1 + MAX_WAITING + 2);
  assert.equal(keys.at(-2), "bpc.toast.more");
  assert.equal(keys.at(-1), "item.bpc:album");
  const summary = p.titles.at(-2);
  assert.deepEqual(summary.title.rawtext[0].with, [String(extra)]);
  assert.equal(codeOf(summary.title), toastCode("reward", PIC.more));
});

test("คิว: ปิดการ์ดในตั้งค่า = title ธรรมดาไม่มีรหัส", () => {
  saveSettings(world, { toast: false });
  const p = mock.player();
  notify.push(p, card("plains"));
  assert.deepEqual(p.titles[0].title, { rawtext: [{ translate: "bpc.card.plains" }] });
  assert.equal(p.titles[0].options.stayDuration, PACE.plain.stayDuration);
  saveSettings(world, { toast: true });
});

test("คิว: ผู้เล่นออกจากโลก คิวถูกล้างและตัวจับเวลาที่ค้างไม่ทำอะไร", () => {
  const p = mock.player();
  const q = mock.player({ name: "Other" });
  notify.push(p, card("a"));
  notify.push(p, card("b"));
  notify.push(q, card("x"));
  notify.forget(p.id);
  notify.push(p, card("c")); // เข้าใหม่ทันที: เริ่มคิวใหม่ ตัวจับเวลาของคิวเก่าต้องไม่ดึงใบถัดไปเร็วเกิน
  notify.push(p, card("d"));
  mock.advance(40);
  assert.deepEqual(shownKeys(p), ["bpc.card.a", "bpc.card.c"]);
  p.isValid = false; // ออกจริง
  mock.advance(2000);
  assert.deepEqual(shownKeys(p), ["bpc.card.a", "bpc.card.c"]);
  assert.equal(notify.waiting(p.id), 0);
  assert.deepEqual(shownKeys(q), ["bpc.card.x"]);
});

// water_splash_particle ของเกมอ่าน variable.direction ถ้าไม่ส่ง content log ของ client ขึ้น Molang error ทุกชิ้น (เห็นในเกมจริง 11 พ.ย. 2569)
test("อนุภาคของธีมชุ่มชื้นส่ง variable.direction ไปด้วย ธีมอื่นไม่ส่ง", () => {
  const p = mock.player();
  feedback.discovered(p, CARDS.find((c) => c.theme === "wet"), { main: 1 });
  assert.equal(p.dimension.lastParticle.id, "minecraft:water_splash_particle");
  const dir = p.dimension.lastParticle.vars.values["variable.direction"];
  assert.ok(dir && dir.y > 0 && Math.abs(Math.hypot(dir.x, dir.z) - 1) < 1e-9);
  const q = mock.player();
  feedback.discovered(q, CARDS.find((c) => c.theme === "forests"), { main: 1 });
  assert.equal(q.dimension.lastParticle.vars, undefined);
});

test("คิว: อนุภาคไม่เกิน 15 ชิ้นและเสียงหนึ่งครั้งต่อใบ เล่นตอนใบนั้นแสดง", () => {
  const p = mock.player();
  const fx = { particle: "minecraft:villager_happy", count: 12, sound: "random.orb", pitch: 1.2 };
  notify.push(p, card("a", { fx }));
  notify.push(p, card("b", { fx: { ...fx, count: 15 } }));
  assert.equal(p.dimension.particles, 12);
  assert.equal(p.sounds.length, 1);
  mock.advance(200);
  assert.equal(p.dimension.particles, 27);
  assert.equal(p.sounds.length, 2);
});
