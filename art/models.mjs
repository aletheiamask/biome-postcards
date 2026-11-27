// โมเดล 3 มิติของบล็อกทั้งหมด (Pin Board, แผงขาย, ของตกแต่ง 12 ชิ้น) เขียนเป็นสเปกด้วย tools/models.mjs
// npm run build อ่านไฟล์นี้แล้วสร้าง geometry + เท็กซ์เจอร์ลง RP และไฟล์ Blockbench ลง art/blockbench/
//
// พิกัด: บล็อกกิน x −8..8, y 0..16, z −8..8 ด้านหน้าของโมเดล = ทิศเหนือ (−z) ซึ่งเกมหมุนให้หันหาผู้เล่นตอนวาง
// สี: ชุดสีของบล็อกในเกม (ไม้ ดินเผา ทอง หิน น้ำแข็ง ออบซิเดียน อเมทิสต์) ไม่มีเส้นขอบดำ
// กล่องที่หน้าทับกันบนระนาบเดียวจะกะพริบในเกม: ต่อรูปทรงด้วยกล่องที่ไม่ซ้อนกัน หรือเหลื่อมกันอย่างน้อย 0.5
import { existsSync, readFileSync } from "node:fs";
import { Model, art, bevel, grain, layers, sheet, solid, vstripes } from "../tools/models.mjs";

// ---------- ชุดสี ----------
export const P = {
  oak: { base: "#b8945f", dark: "#9c7f4e", light: "#c7a56d", line: "#7e6237" },
  spruce: { base: "#7a5a34", dark: "#64482a", light: "#8b693f", line: "#553a1f" },
  darkoak: { base: "#4f3218", dark: "#3e2912", light: "#5f3f20", line: "#2e1d0c" },
  bark: { base: "#6d5433", dark: "#594328", light: "#7e6237" },
  clay: { base: "#985e43", dark: "#874f37", light: "#aa6c4e", line: "#6f3f2b" },
  soil: { base: "#3b2a1a", dark: "#2c1f13", light: "#4a3521" },
  gold: { base: "#f5cc27", dark: "#dc9613", light: "#fdf55f", line: "#b26411" },
  stone: { base: "#7d7d7d", dark: "#686868", light: "#8f8f8f", line: "#565656" },
  slate: { base: "#515151", dark: "#3d3d43", light: "#646464", line: "#2f2f34" },
  ice: { base: "#91b4fe", dark: "#74a0f5", light: "#b8d1ff", shine: "#e6f0ff" },
  snow: { base: "#f9fefe", dark: "#dcebf0", light: "#ffffff" },
  sand: { base: "#dbcfa3", dark: "#c9ba88", light: "#e6ddb5" },
  obsidian: { base: "#15101f", dark: "#0b0812", light: "#2b2147", glint: "#3b2754" },
  amethyst: { base: "#8561bf", dark: "#6a4ba0", light: "#a678f1", shine: "#d9b8ff" },
  portal: { base: "#7b2fd0", dark: "#5c1cc4", light: "#a35cf0", shine: "#dcb0ff" },
  leaves: { base: "#4c8b2b", dark: "#3a6f20", light: "#62a637", shine: "#7fc04a" },
  spruceLeaves: { base: "#3f7a3f", dark: "#2f5f33", light: "#56974f" },
  cactus: { base: "#5b8f2f", dark: "#487526", light: "#6fa63a", spine: "#d9e6a8" },
  water: { base: "#3f76e4", dark: "#2f5fd0", light: "#5d8ff0", shine: "#a9c6ff" },
  pad: { base: "#2f8a2c", dark: "#237022", light: "#46a53e" },
  petal: { base: "#f2a2c8", dark: "#d97fae", light: "#ffd0e6", heart: "#ffd23d" },
  shell: { base: "#f6dccb", dark: "#e3a68f", light: "#fff1e6", line: "#cf8a72" },
  cork: { base: "#b98a5a", dark: "#a67c4a", light: "#cfa070" },
  red: { base: "#b02e26", dark: "#8e2019", light: "#c93a31" },
  white: { base: "#f0f0ea", dark: "#d8d8d0", light: "#ffffff" },
  glass: { line: "#cfeaf0", shine: "#ffffff" },
  paper: "#fbf8ee",
  ember: "#f08a2a",
  cyan: { base: "#2fd0d0", light: "#8ff0f0" },
};

// ---------- ตัววาดที่ใช้ซ้ำ ----------
/** พื้นผิวของวัสดุจากชุดสี (สีพื้น + จุดเข้ม/อ่อน) */
const M = (p, amount = 0.26) => grain(p.base, { dark: p.dark, light: p.light, amount });
/** วัสดุ + เส้นเข้มที่ขอบล่าง ใช้กับฐานและขอบกระถาง */
const lip = (p, amount = 0.26) => layers(M(p, amount), (cv, w, h) => void cv.hline(0, h - 1, w, p.line ?? p.dark));
/** กระจกแบบบล็อกแก้วของเกม: โปร่ง มีเส้นขอบและประกาย */
const glass = (extra) =>
  layers(
    (cv, w, h) => {
      cv.box(0, 0, w, h, P.glass.line);
      cv.px(1, 1, P.glass.shine).px(2, 1, P.glass.shine).px(1, 2, P.glass.shine);
      if (w > 4 && h > 4) cv.px(w - 2, h - 2, P.glass.shine);
    },
    extra,
  );
/** ฐานไม้ของถ้วยรางวัล (ใช้ร่วมกันในชุดถ้วยรางวัล) */
function plinth(m, y = 0, w = 8, d = 8, p = P.darkoak) {
  m.cube("plinth", [-w / 2, y, -d / 2], [w, 2, d], { side: layers(M(p), bevel(p.light, p.line)), up: layers(M(p), bevel(p.light, null)), down: M(p) }, { share: true });
}

const models = [];
const model = (id, opts, build) => {
  const m = new Model(id, opts);
  build(m);
  models.push(m);
};

// ============================================================
// ถ้วยรางวัลชุดสะสม
// ============================================================

// บอนไซป่า: กระถางดินเผา ลำต้นคด พุ่มใบ 3 ก้อน
model("trophy_forests", { tex: [32, 32] }, (m) => {
  const soilTop = layers(M(P.clay), (cv, w, h) => void cv.rect(1, 1, w - 2, h - 2, P.soil.base).px(2, 2, P.soil.light).px(w - 3, h - 3, P.soil.dark).px(4, 3, P.soil.dark));
  m.cube("pot_foot", [-3, 0, -2], [6, 1, 4], M(P.clay), { share: true, hide: "up" });
  m.cube("pot", [-4, 1, -3], [8, 3, 6], { side: layers(M(P.clay), (cv, w) => void cv.hline(0, 0, w, P.clay.light).hline(0, 1, w, P.clay.line)), up: soilTop, down: M(P.clay) });
  // ลำต้นสองท่อนเยื้องกัน: หน้าบนของท่อนล่างและหน้าล่างของท่อนบนโผล่ครึ่งหนึ่ง ต้องมีหน้า
  m.cube("trunk_low", [-1, 4, -1], [2, 3, 2], M(P.bark, 0.4), { share: true, hide: "down" });
  m.cube("trunk_high", [0, 7, -1], [2, 2, 2], M(P.bark, 0.4), { share: true });
  m.cube("branch", [-2, 6, -0.5], [1, 1, 1], M(P.bark, 0.4), { share: true, hide: "east west" });
  const leaf = layers(grain(P.leaves.base, { dark: P.leaves.dark, light: P.leaves.light, amount: 0.5 }), (cv, w, h, key) => {
    cv.px(1, 1, P.leaves.shine).px(w - 2, 2, P.leaves.shine).px(2, h - 2, P.leaves.dark);
  });
  m.cube("crown", [-2, 9, -3], [6, 4, 6], leaf);
  m.cube("crown_top", [-1, 13, -2], [4, 1, 4], leaf, { hide: "down" });
  m.cube("crown_side", [-6, 6, -2], [4, 3, 4], leaf);
  m.cube("crown_front", [-1, 10, -4], [4, 2, 1], leaf, { hide: "south" });
  m.cube("crown_east", [4, 10, -2], [1, 2, 4], leaf, { hide: "west" });
  m.cube("crown_back", [0, 10, 3], [3, 2, 1], leaf, { hide: "north" });
});

// ผลึกน้ำแข็ง: แท่งน้ำแข็ง 4 แท่งบนฐานไม้ที่มีหิมะ
model("trophy_cold", { tex: [32, 32] }, (m) => {
  plinth(m);
  m.cube("snow", [-3.5, 2, -3.5], [7, 0.5, 7], { side: solid(P.snow.dark), up: M(P.snow, 0.2) }, { share: true });
  const ice = layers(M(P.ice, 0.3), (cv, w, h) => {
    cv.vline(0, 0, h, P.ice.light);
    if (w > 1) cv.vline(w - 1, 0, h, P.ice.dark);
    cv.px(Math.min(1, w - 1), 1, P.ice.shine).px(Math.min(1, w - 1), 2, P.ice.shine);
  });
  const shard = (name, x, z, w, h, rot) => {
    const pivot = [x + w / 2, 2.5, z + w / 2];
    // แท่งที่เอียงยกมุมฐานขึ้นพ้นหิมะ จึงต้องมีหน้าล่าง
    m.cube(name, [x, 2.5, z], [w, h, w], { side: ice, up: solid(P.ice.shine), down: solid(P.ice.dark) }, { share: true, rot, pivot });
    if (w > 1) m.cube(`${name}_tip`, [x + 0.5, 2.5 + h, z + 0.5], [w - 1, 1, w - 1], { side: solid(P.ice.light), up: solid(P.ice.shine) }, { share: true, rot, pivot });
  };
  shard("main", -1.5, -1.5, 3, 9, [0, 45, 0]);
  shard("left", -4, -0.5, 2, 5, [0, 0, 22.5]);
  shard("right", 1.5, 0, 2, 4, [0, 0, -22.5]);
  shard("front", -0.5, -3.5, 1, 3, [22.5, 0, 0]);
});

// นาฬิกาทราย: แผ่นไม้บนล่าง เสา 4 ต้น กระเปาะแก้วสองชั้น ทรายไหลผ่านคอ
model("trophy_dry", { tex: [32, 32] }, (m) => {
  const wood = layers(M(P.spruce), bevel(P.spruce.light, P.spruce.line));
  m.cube("plate_bottom", [-4, 0, -4], [8, 2, 8], { side: wood, up: M(P.spruce), down: M(P.spruce) }, { share: true });
  m.cube("plate_top", [-4, 12, -4], [8, 2, 8], { side: wood, up: layers(M(P.spruce), bevel(P.spruce.light, null)), down: M(P.spruce) }, { share: true });
  for (const [i, [x, z]] of [[-4, -4], [3, -4], [-4, 3], [3, 3]].entries()) m.cube(`post_${i}`, [x, 2, z], [1, 10, 1], M(P.spruce, 0.3), { share: true, hide: "up down" });
  const G = "#dfeff5";
  const glassy = (sandRows, fromTop) => (cv, w, h) => {
    cv.fill(G);
    cv.vline(0, 0, h, "#f4fbff").vline(w - 1, 0, h, "#bcd9e3");
    for (let r = 0; r < sandRows; r++) {
      const y = fromTop ? r : h - 1 - r;
      const inset = fromTop ? r : 0; // ทรายบนไหลลงเป็นกรวย
      cv.hline(1 + inset, y, Math.max(0, w - 2 - inset * 2), r === 0 && !fromTop ? P.sand.dark : P.sand.base);
    }
    cv.px(1, fromTop ? h - 1 : 0, "#ffffff");
  };
  // ไหล่ของกระเปาะ (ขอบกว้าง 1 หน่วยรอบคอ) โผล่ให้เห็น ต้องมีหน้าบน/ล่าง
  m.cube("bulb_low", [-3, 2, -3], [6, 3, 6], { side: glassy(2, false), up: solid(G) }, { share: true });
  m.cube("shoulder_low", [-2, 5, -2], [4, 1, 4], { side: glassy(0, false), up: solid(G) }, { share: true });
  m.cube("neck", [-1, 6, -1], [2, 2, 2], { side: (cv, w, h) => void cv.fill(G).vline(0, 0, h, "#f4fbff").vline(w - 1, 0, h, P.sand.base) }, { share: true });
  m.cube("shoulder_high", [-2, 8, -2], [4, 1, 4], { side: glassy(1, true), down: solid(G) }, { share: true });
  m.cube("bulb_high", [-3, 9, -3], [6, 3, 6], { side: glassy(2, true), down: solid(G) }, { share: true });
});

// อ่างบัว: อ่างหินสองชั้น น้ำ ใบบัว และดอกบัวชมพู
model("trophy_wet", { tex: [64, 32] }, (m) => {
  const st = M(P.stone, 0.34);
  m.cube("foot", [-3, 0, -3], [6, 1, 6], st, { share: true, hide: "up" });
  m.cube("bowl_low", [-5, 1, -5], [10, 2, 10], { side: layers(st, (cv, w, h) => void cv.hline(0, h - 1, w, P.stone.line)), down: st }, { share: true });
  m.cube("bowl", [-6, 3, -6], [12, 2, 12], { side: layers(st, bevel(P.stone.light, P.stone.line)), down: st }, { share: true });
  // ขอบอ่าง 4 ด้าน (ไม่ซ้อนกัน) สูงกว่าผิวน้ำครึ่งหน่วย
  const rimTop = (cv) => void cv.fill(P.stone.light);
  m.cube("rim_n", [-6, 5, -6], [12, 1.5, 1], { side: st, up: rimTop }, { hide: "down" });
  m.cube("rim_s", [-6, 5, 5], [12, 1.5, 1], { side: st, up: rimTop }, { hide: "down" });
  m.cube("rim_w", [-6, 5, -5], [1, 1.5, 10], { side: st, up: rimTop }, { hide: "down north south" });
  m.cube("rim_e", [5, 5, -5], [1, 1.5, 10], { side: st, up: rimTop }, { hide: "down north south" });
  const water = layers(grain(P.water.base, { dark: P.water.dark, light: P.water.light, amount: 0.3 }), (cv) => {
    cv.hline(1, 2, 3, P.water.shine).hline(6, 7, 2, P.water.shine).px(2, 6, P.water.shine).px(7, 3, P.water.shine);
  });
  m.cube("water", [-5, 5, -5], [10, 1, 10], { up: water });
  const pad = (cv, w, h) => {
    cv.fill(P.pad.base).px(0, 0, "_").px(w - 1, 0, "_").px(0, h - 1, "_").px(w - 1, h - 1, "_");
    cv.px(1, 1, P.pad.light).px(2, 1, P.pad.light).vline(Math.floor(w / 2), Math.floor(h / 2), Math.ceil(h / 2), "_").px(w - 2, h - 2, P.pad.dark);
  };
  m.cube("pad_big", [-4, 6, 0], [4, 0.25, 4], { up: pad, side: solid(P.pad.dark) }, { share: true });
  m.cube("pad_small", [1, 6, 1], [3, 0.25, 3], { up: pad, side: solid(P.pad.dark) }, { share: true });
  // ดอกบัว: กลีบนอก 4 กลีบเป็นกากบาท กลีบในยกสูง เกสรเหลือง
  const outer = { side: solid(P.petal.dark), up: M(P.petal, 0.3) };
  m.cube("petal_we", [-3, 6, -3], [4, 0.75, 2], outer, { share: true });
  m.cube("petal_n", [-2, 6, -4], [2, 0.75, 1], outer, { share: true, hide: "south" });
  m.cube("petal_s", [-2, 6, -1], [2, 0.75, 1], outer, { share: true, hide: "north" });
  m.cube("bud", [-2, 6.75, -3], [2, 1.25, 2], { side: layers(solid(P.petal.light), (cv, w, h) => void cv.hline(0, h - 1, w, P.petal.base)), up: (cv) => void cv.fill(P.petal.light).px(0, 0, P.petal.heart).px(1, 1, P.petal.heart) }, { share: true });
});

// เปลือกหอยที่ระลึก: หอยเชลล์ตั้งบนฐานไม้ ลายสันแผ่จากขั้ว
model("trophy_fields", { tex: [32, 32] }, (m) => {
  plinth(m, 0, 8, 6);
  const fan = (dir) =>
    sheet(dir, [-5, 5], [2, 11], (cv, w, h) => {
      cv.fill(P.shell.base);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ang = Math.atan2(x + 0.5 - w / 2, h - y - 0.3);
          const t = ((ang + Math.PI) / 0.3) % 1;
          if (t < 0.34) cv.px(x, y, P.shell.dark);
          else if (t > 0.72 && y < 5) cv.px(x, y, P.shell.light);
        }
      }
      cv.rect(Math.floor(w / 2) - 1, h - 2, 2, 2, P.shell.line);
    });
  const edge = solid(P.shell.dark);
  const rows = [
    ["hinge", -1, 2, 2, 1],
    ["r1", -2, 3, 4, 1],
    ["r2", -3, 4, 6, 1],
    ["r3", -4, 5, 8, 2],
    ["r4", -5, 7, 10, 2],
    ["r5", -4, 9, 8, 1],
    ["r6", -3, 10, 6, 1],
  ];
  for (const [name, x, y, w, h] of rows) m.cube(name, [x, y, -1], [w, h, 2], { north: fan("north"), south: fan("south"), east: edge, west: edge, up: solid(P.shell.light), down: edge });
});

// หินเรืองแสง: จีโอดผ่าครึ่ง เปลือกหินเข้ม ชั้นแคลไซต์ขาว โพรงอเมทิสต์กับผลึกฟ้า
model("trophy_underground", { tex: [64, 32] }, (m) => {
  const rock = layers(M(P.slate, 0.4), (cv, w, h) => void cv.px(1, Math.min(1, h - 1), P.slate.light).px(w - 2, h - 1, P.slate.line));
  // ครึ่งหลัง: ก้อนหินทรงมน
  m.cube("body", [-6, 2, -1], [12, 8, 4], {
    side: rock,
    up: rock,
    down: rock,
    // ผนังด้านในของโพรง (เห็นผ่านช่องเปิด)
    north: layers(grain(P.amethyst.dark, { dark: "#3a2f5a", light: P.amethyst.base, amount: 0.55 }), (cv) => {
      cv.px(3, 2, P.amethyst.shine).px(8, 3, P.cyan.light).px(5, 5, P.amethyst.light).px(9, 5, P.amethyst.shine).px(2, 5, P.cyan.base).px(6, 2, P.amethyst.light);
    }),
  });
  m.cube("back_top", [-5, 10, -1], [10, 1, 3], rock, { hide: "down" });
  m.cube("back_tip", [-3, 11, -1], [6, 1, 2], rock, { hide: "down" });
  m.cube("back_bottom", [-5, 1, -1], [10, 1, 3], rock, { hide: "up" });
  m.cube("back_foot", [-3, 0, -1], [6, 1, 2], rock, { hide: "up" });
  m.cube("back_bulge", [-5, 3, 3], [10, 6, 1], rock, { hide: "north" });
  // ครึ่งหน้า (หน้าตัด): วงหินรอบโพรง ลายหน้าตัดวาดเป็นแผ่นเดียว เปลือกเข้มด้านนอก แคลไซต์ติดขอบโพรง
  const hole = (x, y) => x >= 2 && x < 10 && y >= 3 && y < 9 && !((x === 2 || x === 9) && (y === 3 || y === 8));
  const cutFace = sheet("north", [-6, 6], [0, 12], (cv, w, h) => {
    M(P.slate, 0.4)(cv, w, h, "cut");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (hole(x, y)) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => hole(x + dx, y + dy));
        const near2 = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => hole(x + dx, y + dy));
        if (near) cv.px(x, y, "#e4e5e0");
        else if (near2 && (x * 7 + y * 3) % 4 !== 0) cv.px(x, y, "#c2c4bd");
      }
    }
  });
  const ring = { north: cutFace, south: rock, east: rock, west: rock, up: rock, down: rock };
  m.cube("f_foot", [-3, 0, -3], [6, 1, 2], ring, { hide: "south up" });
  m.cube("f_low", [-5, 1, -3], [10, 1, 2], ring, { hide: "south" });
  m.cube("f_sill", [-4, 2, -3], [8, 1, 2], ring, { hide: "south down east west" });
  m.cube("f_west", [-6, 2, -3], [2, 8, 2], ring, { hide: "south" });
  m.cube("f_east", [4, 2, -3], [2, 8, 2], ring, { hide: "south" });
  m.cube("f_head", [-4, 9, -3], [8, 1, 2], ring, { hide: "south up east west" });
  m.cube("f_high", [-5, 10, -3], [10, 1, 2], ring, { hide: "south" });
  m.cube("f_tip", [-3, 11, -3], [6, 1, 2], ring, { hide: "south down" });
  for (const [name, x, y] of [["c_ne", 3, 8], ["c_nw", -4, 8], ["c_se", 3, 3], ["c_sw", -4, 3]]) m.cube(name, [x, y, -3], [1, 1, 2], ring, { hide: "south" });
  const gem = (p) => layers(M(p, 0.4), (cv, w, h) => void cv.vline(0, 0, h, p.light).px(0, 0, p.shine ?? p.light));
  const aqua = { base: P.cyan.base, dark: "#22a8b0", light: P.cyan.light, shine: "#ffffff" };
  m.cube("gem_a", [-3.5, 3, -2.5], [2, 3.5, 1.5], gem(P.amethyst), { share: true, hide: "down" });
  m.cube("gem_b", [1, 3, -2.5], [2, 2.5, 1.5], gem(P.amethyst), { share: true, hide: "down" });
  m.cube("gem_c", [-1, 3, -2], [1.5, 5, 1], gem(aqua), { share: true, hide: "down" });
  m.cube("gem_d", [2, 7, -2], [1, 2, 1], gem(P.amethyst), { share: true, hide: "up" });
});

// เศษประตูมิติ: ประตูออบซิเดียนจิ๋วที่แตก ม่านประตูสีม่วง และเศษลอย
model("trophy_otherworld", { tex: [32, 32] }, (m) => {
  plinth(m);
  const obs = layers(grain(P.obsidian.base, { dark: P.obsidian.dark, light: P.obsidian.light, amount: 0.4 }), (cv, w, h) => void cv.px(0, 0, P.obsidian.glint).px(w - 1, Math.floor(h / 2), P.obsidian.glint));
  m.cube("pillar_w", [-4, 2, -1], [2, 10, 2], obs, { hide: "down" });
  m.cube("pillar_e", [2, 2, -1], [2, 6, 2], obs, { hide: "down" });
  m.cube("lintel", [-2, 10, -1], [3, 2, 2], obs, { hide: "west" });
  m.cube("sill", [-2, 2, -1], [4, 1, 2], obs, { hide: "west east down" });
  const film = (cv, w, h, key) => {
    grain(P.portal.base, { dark: P.portal.dark, light: P.portal.light, amount: 0.55, seed: key })(cv, w, h, key);
    cv.px(1, 2, P.portal.shine).px(2, 4, P.portal.shine).px(1, 5, P.portal.light);
    // มุมบนฝั่งเสาที่หักเว้าแหว่ง
    const broken = key.endsWith("north") ? 0 : w - 1;
    cv.px(broken, 0, "_").px(broken, 1, "_").px(broken === 0 ? 1 : w - 2, 0, "_");
  };
  m.cube("film", [-2, 3, -0.5], [4, 7, 1], { north: film, south: film, east: solid(P.portal.dark), up: solid(P.portal.light) }, {});
  m.cube("chunk", [2, 2, 2], [2, 1, 1.5], obs, { share: true, hide: "down" });
  m.cube("shard", [2.5, 9.5, -0.5], [1.5, 1.5, 1], layers(solid(P.portal.light), (cv) => void cv.px(0, 0, P.portal.shine)), { share: true, rot: [0, 0, 45] });
  m.cube("ember_a", [-3.5, 2, -3.5], [1, 0.5, 1], solid(P.ember), { share: true, hide: "down" });
  m.cube("ember_b", [1.5, 2, -3], [1, 0.5, 1], solid("#ffd23d"), { share: true, hide: "down" });
});

// ============================================================
// รางวัลใหญ่
// ============================================================

// ลูกโลกนักเดินทาง: ลูกโลกบนขาตั้งทอง มีโครงยึดด้านข้าง
model("traveler_globe", { tex: [64, 32] }, (m) => {
  const gold = layers(M(P.gold, 0.3), bevel(P.gold.light, P.gold.line));
  m.cube("base", [-3, 0, -3], [6, 1, 6], { side: gold, up: M(P.gold, 0.3), down: M(P.gold, 0.3) }, { share: true });
  m.cube("base_top", [-2, 1, -2], [4, 1, 4], { side: gold, up: M(P.gold, 0.3) }, { share: true, hide: "down" });
  m.cube("stem", [-1, 2, -1], [2, 4, 2], M(P.gold, 0.3), { share: true, hide: "down up" });
  const sea = grain(P.water.base, { dark: P.water.dark, light: P.water.light, amount: 0.25 });
  const L = { g: "#4f9a35", G: "#3d7f2a", l: "#6fb548", s: "#e6ddb5", w: "#f9fefe" };
  const land = (rows, x = 0, y = 0) => layers(sea, art(rows, L, x, y));
  // ลูกกลม: แกนกลาง 6×8×6 กับแผ่นนูน 4 ด้านที่ไม่ซ้อนกัน (เดิมเป็นกล่องซ้อน 3 ใบ หน้าข้างทับระนาบเดียวกันจึงกะพริบ)
  // แผ่นดินวาดบนหน้าที่เห็นเต็ม
  m.cube("globe_core", [-3, 6, -3], [6, 8, 6], { side: sea, up: land([".ww...", "wwww..", ".ww..."], 0, 1), down: land(["..ww..", ".wwww.", "..ww.."], 0, 1) });
  const lobe = (face, rows) => ({ north: sea, south: sea, east: sea, west: sea, up: sea, down: sea, [face]: land(rows) });
  const back = { east: "west", west: "east", north: "south", south: "north" };
  const lobes = [
    ["globe_e", [3, 7, -3], [1, 6, 6], "east", [".gg...", "gGGg..", ".gGg.l", "..g.ll", "....l.", "......"]],
    ["globe_w", [-4, 7, -3], [1, 6, 6], "west", ["......", "..gg..", ".gGGg.", ".gGg..", "..gs..", "......"]],
    ["globe_n", [-3, 7, -4], [6, 6, 1], "north", ["..gg..", ".gGGg.", "gGGGg.", ".gGg..", "..gg.l", "....ll"]],
    ["globe_s", [-3, 7, 3], [6, 6, 1], "south", ["g.....", "gg..g.", ".g.gGg", "...gGg", "....g.", "......"]],
  ];
  for (const [name, from, size, face, rows] of lobes) m.cube(name, from, size, lobe(face, rows), { hide: back[face] });
  const brass = M(P.gold, 0.2);
  m.cube("arm_low", [-5, 5, -0.5], [4, 1, 1], brass, { hide: "east" });
  m.cube("arc", [-6, 5, -0.5], [1, 10, 1], brass, {});
  m.cube("arm_high", [-5, 14, -0.5], [5.5, 1, 1], brass, { hide: "west" });
});

// ============================================================
// ของที่ระลึกจากแผงขาย
// ============================================================

// ลูกแก้วหิมะ: ฐานไม้ โดมแก้ว ข้างในมีต้นสนกับพื้นหิมะ
model("souvenir_snow_globe", { tex: [64, 32] }, (m) => {
  const wood = layers(M(P.spruce), bevel(P.spruce.light, P.spruce.line));
  m.cube("base", [-4, 0, -4], [8, 3, 8], { side: layers(wood, (cv, w) => void cv.hline(2, 1, w - 4, P.gold.base)), up: M(P.spruce), down: M(P.spruce) }, { share: true });
  m.cube("snow", [-3, 3, -3], [6, 1, 6], { side: solid(P.snow.dark), up: M(P.snow, 0.2) }, { share: true });
  m.cube("trunk", [-0.5, 4, -0.5], [1, 1, 1], solid(P.bark.base), { share: true, hide: "up down" });
  const pine = layers(M(P.spruceLeaves, 0.4), (cv, w) => void cv.px(0, 0, P.snow.base).px(w - 1, 0, P.snow.base));
  m.cube("pine_low", [-2, 5, -2], [4, 2, 4], { side: pine, up: layers(M(P.spruceLeaves, 0.4), (cv, w, h) => void cv.px(0, 0, P.snow.base).px(w - 1, h - 1, P.snow.base)), down: M(P.spruceLeaves, 0.4) }, { share: true });
  m.cube("pine_mid", [-1, 7, -1], [2, 2, 2], { side: pine, up: solid(P.snow.base) }, { share: true, hide: "down" });
  m.cube("pine_top", [-0.5, 9, -0.5], [1, 1, 1], solid(P.snow.light), { share: true, hide: "down" });
  // โดมแก้ว: โปร่ง เห็นของข้างใน มีเกล็ดหิมะบนผิวแก้ว
  const flakes = (cv, w, h, key) => {
    const spots = key.includes("up") ? [[2, 2], [5, 4]] : [[2, 3], [5, 1], [w - 3, 4]];
    for (const [x, y] of spots) cv.px(x, y, "#ffffff");
  };
  // โดมสามชั้นให้ดูกลม: ชั้นล่างกว้างสุด แล้วสอบเข้าหายอด ผิวแก้ววาดแค่เส้นมุมกับประกาย ไม่ตีกรอบทุกชั้น (กรอบซ้อนกันจะรกจนไม่เห็นต้นสน)
  const pane = (extra) => layers((cv, w, h) => void cv.vline(0, 0, h, P.glass.line).vline(w - 1, 0, h, P.glass.line).px(1, 1, P.glass.shine).px(1, 2, P.glass.shine), extra);
  const lid = (cv, w, h) => void cv.box(0, 0, w, h, P.glass.line).px(1, 1, P.glass.shine);
  // ไหล่ของโดมแต่ละชั้น (ขอบ 1 หน่วยที่ชั้นบนไม่ได้คลุม) ต้องมีหน้าบน: กรอบเส้นแก้ว ตรงกลางโปร่ง
  const shoulder = (cv, w, h) => void cv.box(0, 0, w, h, P.glass.line);
  m.cube("dome", [-4, 3, -4], [8, 5, 8], { side: pane(flakes), up: shoulder }, { share: true });
  m.cube("dome_mid", [-3, 8, -3], [6, 2, 6], { side: pane(), up: shoulder }, { share: true });
  m.cube("dome_cap", [-2, 10, -2], [4, 1, 4], { side: pane(), up: lid }, { share: true });
});

// กระบองเพชรในกระถาง: กระถางดินเผาปากผาย ต้นกระบองเพชรสองแขน ดอกชมพู
model("souvenir_cactus_pot", { tex: [64, 32] }, (m) => {
  m.cube("pot", [-3, 0, -3], [6, 4, 6], { side: M(P.clay), down: M(P.clay) }, { share: true });
  m.cube("pot_rim", [-4, 4, -4], [8, 2, 8], {
    side: layers(M(P.clay), bevel(P.clay.light, P.clay.line)),
    up: layers(M(P.clay), (cv, w, h) => void cv.rect(1, 1, w - 2, h - 2, P.soil.base).px(2, 2, P.soil.light).px(5, 4, P.soil.dark)),
    down: M(P.clay),
  }, { share: true });
  const skin = layers(M(P.cactus, 0.3), (cv, w, h) => {
    for (let x = 1; x < w; x += 2) cv.vline(x, 0, h, P.cactus.dark);
    for (let y = 1; y < h; y += 3) cv.px((y % 2) * 2, y, P.cactus.spine);
  });
  const tip = M(P.cactus, 0.3);
  m.cube("trunk", [-2, 6, -2], [4, 8, 4], { side: skin, up: tip }, { share: true, hide: "down" });
  m.cube("arm_w", [-5, 8, -1], [3, 2, 2], { north: skin, south: skin, up: tip, down: tip, west: skin }, {});
  m.cube("arm_w_up", [-5, 10, -1], [2, 3, 2], { side: skin, up: tip }, { share: true, hide: "down" });
  m.cube("arm_e", [2, 9, -1], [3, 2, 2], { north: skin, south: skin, up: tip, down: tip, east: skin }, {});
  m.cube("arm_e_up", [3, 11, -1], [2, 2, 2], { side: skin, up: tip }, { share: true, hide: "down" });
  m.cube("flower", [-1, 14, -1], [2, 1, 2], { side: solid(P.petal.base), up: (cv) => void cv.fill(P.petal.light).px(0, 0, P.petal.heart) }, { share: true, hide: "down" });
});

// โหลเปลือกหอย: โหลแก้ว จุกไม้ก๊อก ข้างในมีทรายกับเปลือกหอย
model("souvenir_shell_jar", { tex: [64, 32] }, (m) => {
  m.cube("sand", [-3.5, 0.5, -3.5], [7, 3, 7], { side: M(P.sand, 0.3), up: M(P.sand, 0.3) }, { share: true });
  m.cube("shell_pink", [-2.5, 3.5, -2.5], [2, 1, 2], { side: solid(P.petal.base), up: (cv) => void cv.fill(P.petal.light).px(1, 1, P.petal.dark) }, { share: true, hide: "down" });
  m.cube("shell_cream", [0.5, 3.5, -0.5], [2, 1.5, 1.5], { side: solid(P.shell.base), up: solid(P.shell.light) }, { share: true, hide: "down" });
  m.cube("shell_orange", [-1.5, 3.5, 1], [1.5, 1, 1.5], { side: solid(P.shell.line), up: solid(P.shell.dark) }, { share: true, hide: "down" });
  const tag = art(["pp", "pp"], { p: P.paper }, 3, 4);
  // ไหล่โหล (ขอบ 1 หน่วยรอบคอ) ต้องมีหน้าบน: กรอบเส้นแก้ว ตรงกลางโปร่งเพราะคออยู่ทับ
  m.cube("jar", [-4, 0, -4], [8, 10, 8], { north: glass(tag), south: glass(), east: glass(), west: glass(), up: (cv, w, h) => void cv.box(0, 0, w, h, P.glass.line), down: glass() }, {});
  m.cube("neck", [-3, 10, -3], [6, 1, 6], { side: glass() }, { share: true });
  const cork = layers(M(P.cork, 0.4), bevel(P.cork.light, P.cork.dark));
  m.cube("lid", [-3, 11, -3], [6, 2, 6], { side: cork, up: M(P.cork, 0.4), down: M(P.cork, 0.4) }, { share: true });
});

// เข็มทิศทอง: เข็มทิศพกตั้งบนขาไม้ หน้าปัดหันมาด้านหน้า
model("souvenir_golden_compass", { tex: [32, 32] }, (m) => {
  m.cube("stand", [-3, 0, -2], [6, 1, 4], layers(M(P.darkoak), bevel(P.darkoak.light, P.darkoak.line)), { share: true });
  m.cube("prop", [-1, 1, 0], [2, 3, 1], M(P.darkoak), { share: true, hide: "down" });
  // ตัวเรือนกลมจากแถบแนวตั้งที่ไม่ซ้อนกัน หน้าปัดวาดเป็นแผ่นเดียว ขอบของแถบตรงกับรูปทรงในภาพหน้าปัดพอดี (ไม่มีพิกเซลโปร่งบนหน้า)
  const dial = sheet("north", [-5, 5], [1, 11], (cv, w, h) => {
    const D = { o: P.gold.base, O: P.gold.dark, h: P.gold.light, c: "#fff6e0", C: "#eadfc4", r: "#d83a3a", R: "#a82828", s: "#6c7178", k: "#3b2a1a" };
    cv.grid(0, 0, [
      "...hhhh...",
      ".hhooooOO.",
      ".hoccccoO.",
      "hoccrcccoO",
      "hocccrccoO",
      "hoccskccoO",
      "hocsccCcoO",
      ".occCCCcO.",
      ".OoooooOO.",
      "...OOOO...",
    ], D);
  });
  const back = sheet("south", [-5, 5], [1, 11], (cv, w, h) => {
    M(P.gold, 0.3)(cv, w, h, "back");
    cv.box(2, 2, 6, 6, P.gold.dark).px(4, 4, P.gold.light).px(5, 5, P.gold.light);
  });
  const rim = M(P.gold, 0.3);
  const strips = [
    ["mid", -2, 1, 4, 10],
    ["in_w", -4, 2, 2, 8],
    ["in_e", 2, 2, 2, 8],
    ["out_w", -5, 4, 1, 4],
    ["out_e", 4, 4, 1, 4],
  ];
  for (const [name, x, y, w, h] of strips) m.cube(name, [x, y, -2], [w, h, 2], { north: dial, south: back, east: rim, west: rim, up: rim, down: rim });
  m.cube("crown", [-1, 11, -1.5], [2, 1.5, 1], M(P.gold, 0.3), { share: true, hide: "down" });
});

// ============================================================
// แผงขายของที่ระลึก: เคาน์เตอร์ไม้ เสา 4 ต้น หลังคาผ้าใบแดงขาว บนเคาน์เตอร์มีชั้นโปสการ์ด
// ============================================================
model("souvenir_stand", { tex: [64, 64] }, (m) => {
  const C = { p: P.paper, b: "#8fc7ff", g: "#6fb548", k: "#ffb7dc", y: "#e8d591", s: "#cfc6b0" };
  const planks = (cv, w, h, key) => {
    M(P.oak, 0.3)(cv, w, h, key);
    for (let x = 3; x < w; x += 4) cv.vline(x, 0, h, P.oak.line);
    cv.hline(0, h - 1, w, P.oak.line);
  };
  const card = (c) => ["pppp", "p" + c + c + "p", "p" + c + c + "p", "pggp", "pppp"];
  const front = layers(planks, art(card("b"), C, 0, 2), art(card("k"), C, 5, 2), art(card("y"), C, 10, 2));
  m.cube("counter", [-7, 0, -7], [14, 8, 14], { side: front, down: M(P.oak, 0.3) }, { share: true });
  m.cube("top", [-8, 8, -8], [16, 1, 16], {
    side: layers(M(P.spruce), bevel(P.spruce.light, P.spruce.line)),
    up: (cv, w, h, key) => {
      M(P.spruce, 0.3)(cv, w, h, key);
      for (let y = 3; y < h; y += 4) cv.hline(0, y, w, P.spruce.line);
    },
    down: M(P.spruce),
  }, { share: true });
  // เสาเยื้องเข้ามาครึ่งหน่วย ให้อยู่หลังชายผ้าใบ (ถ้าหน้าเสาอยู่ระนาบเดียวกับชายผ้าใบจะกะพริบ)
  for (const [i, [x, z]] of [[-7.5, -7.5], [6.5, -7.5], [-7.5, 6.5], [6.5, 6.5]].entries()) m.cube(`post_${i}`, [x, 9, z], [1, 5, 1], M(P.darkoak, 0.3), { share: true, hide: "up down" });
  const cloth = [P.red.base, P.red.base, P.white.base, P.white.base];
  const stripeSide = layers(vstripes(cloth, 1), (cv, w, h) => void cv.hline(0, h - 1, w, P.red.dark));
  m.cube("awning", [-8, 14, -8], [16, 2, 16], { side: stripeSide, up: vstripes(cloth, 1), down: vstripes([P.red.dark, P.red.dark, P.white.dark, P.white.dark], 1) }, { share: true });
  // ชายผ้าใบหยัก: แผ่นบางห้อยใต้หลังคา 4 ด้าน (ไม่ซ้อนกันที่มุม)
  const valance = (cv, w, h) => {
    for (let x = 0; x < w; x++) {
      cv.px(x, 0, cloth[x % 4]);
      if (x % 4 === 1 || x % 4 === 2) cv.px(x, 1, x % 4 < 2 ? P.red.dark : P.white.dark);
    }
  };
  // ปลายของแผ่นหน้า/หลังอยู่ที่มุมนอกสุด เห็นจากด้านข้าง: แถวบนสีแดงตามลาย แถวล่างโปร่งตามหยัก
  const valanceEnd = (cv) => void cv.px(0, 0, P.red.base);
  m.cube("valance_n", [-8, 12, -8], [16, 2, 0.5], { north: valance, south: valance, east: valanceEnd, west: valanceEnd }, {});
  m.cube("valance_s", [-8, 12, 7.5], [16, 2, 0.5], { north: valance, south: valance, east: valanceEnd, west: valanceEnd }, {});
  m.cube("valance_w", [-8, 12, -7.5], [0.5, 2, 15], { east: valance, west: valance }, {});
  m.cube("valance_e", [7.5, 12, -7.5], [0.5, 2, 15], { east: valance, west: valance }, {});
  // ของบนเคาน์เตอร์
  const rackFace = layers(M(P.darkoak, 0.2), art(card("b"), C, 1, 0), art(card("g"), C, 5, 0), art(card("y"), C, 9, 0));
  m.cube("rack", [-7, 9, -1], [14, 5, 2], { north: rackFace, south: rackFace, east: M(P.darkoak, 0.2), west: M(P.darkoak, 0.2), up: M(P.darkoak, 0.2) }, {});
  m.cube("stack", [-5, 9, -6], [4, 1, 3], { side: solid(C.s), up: art(["pppp", "pbbp", "pggp"], C) }, { share: true, hide: "down" });
  m.cube("emerald", [3, 9, 3], [2, 2, 2], layers(solid("#17dd62"), (cv) => void cv.px(0, 0, "#7ff5b0").px(1, 1, "#0e8f3a")), { share: true, hide: "down" });
});

// ============================================================
// Pin Board: กรอบไม้นูน แผ่นไม้ก๊อก โปสการ์ดเป็นแผ่นยกจากพื้น หมุดเป็นก้อน
// หน้าด้านหน้าใช้ภาพของการ์ด (material instance "card" ขนาด 32×32 ที่ tools/art.mjs วาด) โดยตัดส่วนของภาพมาแปะแต่ละชิ้น
// ภาพ 2 พิกเซล = 1 หน่วย: กรอบ 2 พิกเซล, กระดาษ x 4..28 y 6..27, หมุดของการ์ดที่ (15,4), หมุดของบอร์ดเปล่าที่ (8,7) และ (22,20)
// ============================================================
/** พื้นที่บนภาพการ์ดของหน้าด้านหน้า (ทิศเหนือ) สำหรับกล่องที่กิน x0..x1, y0..y1: ซ้ายของภาพ = ตะวันออก */
// เท็กซ์เจอร์ของโมเดลใช้พื้นที่ uv 64×64 (ภาพการ์ด 32×32 จึงคูณ 2): `S` พิกเซลของภาพการ์ด = S × 2 หน่วย uv
const S = 2;
const cardUv = (x0, y0, x1, y1) => [(8 - x1) * 2, (16 - y1) * 2, (x1 - x0) * 2, (y1 - y0) * 2].map((v) => v * S);
const texel = (u, v, w, h) => [u, v, w, h].map((n) => n * S);
const sampleCard = new URL("../RP/textures/blocks/pin_board/plains.png", import.meta.url);
model("pin_board", { tex: [64, 64], density: 2, extra: existsSync(sampleCard) ? { card: readFileSync(sampleCard) } : {} }, (m) => {
  const W = { base: "#7a4a2a", dark: "#6b4025", light: "#8a5632", line: "#5a3418" };
  const wood = (cv, w, h, key) => {
    M(W, 0.3)(cv, w, h, key);
    for (let y = 2; y < h; y += 6) cv.hline(0, y, w, W.line);
  };
  const Z = 6.5; // หน้ากรอบ
  const bar = (name, x0, y0, x1, y1, hide) =>
    m.cube(name, [x0, y0, Z], [x1 - x0, y1 - y0, 8 - Z], { all: wood }, { bone: "board", uv: { north: cardUv(x0, y0, x1, y1) }, mi: { north: "card" }, hide });
  bar("frame_top", -8, 15, 8, 16, "");
  bar("frame_bottom", -8, 0, 8, 1, "");
  bar("frame_east", 7, 1, 8, 15, "up down");
  bar("frame_west", -8, 1, -7, 15, "up down");
  m.cube("cork", [-7, 1, 7.5], [14, 14, 0.5], { south: wood }, { bone: "board", uv: { north: cardUv(-7, 1, 7, 15) }, mi: { north: "card" } });
  // โปสการ์ด: แผ่นหนาครึ่งหน่วย ขอบกระดาษใช้สีจากขอบของภาพ (แถวล่างสุดและคอลัมน์ริมเป็นสีกระดาษหรือขอบฟอยล์)
  m.cube("card", [-6, 2.5, 7], [12, 10.5, 0.5], null, {
    bone: "card",
    uv: { north: texel(4, 6, 24, 21), east: texel(4, 6, 1, 21), west: texel(27, 6, 1, 21), up: texel(4, 26, 24, 1), down: texel(4, 26, 24, 1) },
    mi: "card",
  });
  const pin = (name, bone, u, v, z) => {
    const x1 = 8 - u / 2;
    const y1 = 16 - v / 2;
    m.cube(name, [x1 - 1, y1 - 1, z], [1, 1, 0.75], null, { bone, uv: Object.fromEntries(["north", "east", "west", "up", "down"].map((k) => [k, texel(u, v, 2, 2)])), mi: "card" });
  };
  // หมุดอยู่เหนือขอบบนของการ์ด จึงต้องแตะแผ่นก๊อก (z 7.5) เหมือนหมุดอีกสองตัว ไม่ลอยค้าง
  pin("pin_card", "card", 15, 4, 6.75);
  pin("pin_red", "pins", 8, 7, 6.75);
  pin("pin_blue", "pins", 22, 20, 6.75);
});

export const MODELS = models;
