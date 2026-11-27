// โมเดล 3 มิติของบล็อก (art/models.mjs + tools/models.mjs): ตรวจสิ่งที่ทำให้ภาพในเกมผิดโดยไม่มี error ใน log
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { MODELS } from "../art/models.mjs";
import * as T from "../content/cards.js";
import { FACES, Model, sheet, solid } from "../tools/models.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = new Map(MODELS.map((m) => [m.id, m.build()]));
const TRINKETS = [...T.SETS.map((s) => s.reward), T.GRAND_REWARD.id, ...T.SOUVENIRS.map((s) => s.id)];

test("โมเดล: มีครบทุกบล็อก และไฟล์ที่ build สร้างตรงกับสเปก", () => {
  const ids = ["pin_board", "souvenir_stand", ...TRINKETS];
  assert.deepEqual([...built.keys()].sort(), [...ids].sort());
  for (const id of ids) {
    const out = built.get(id);
    const geo = JSON.parse(readFileSync(join(ROOT, `RP/models/blocks/${id}.geo.json`), "utf8"));
    assert.deepEqual(geo, JSON.parse(JSON.stringify(out.geo)), `${id}: RP/models ไม่ตรงกับสเปก (รัน npm run build)`);
    assert.ok(readFileSync(join(ROOT, `RP/textures/blocks/models/${id}.png`)).equals(out.png), `${id}: เท็กซ์เจอร์ไม่ตรงกับสเปก (รัน npm run build)`);
    assert.ok(existsSync(join(ROOT, `art/blockbench/${id}.bbmodel`)), `${id}: ไม่มีไฟล์ Blockbench`);
    const block = JSON.parse(readFileSync(join(ROOT, `BP/blocks/${id}.json`), "utf8"))["minecraft:block"];
    assert.equal(block.components["minecraft:geometry"].identifier, `geometry.bpc.${id}`);
    assert.equal(block.components["minecraft:material_instances"]["*"].texture, `bpc_model_${id}`);
  }
  const terrain = JSON.parse(readFileSync(join(ROOT, "RP/textures/terrain_texture.json"), "utf8")).texture_data;
  for (const id of ids) assert.equal(terrain[`bpc_model_${id}`].textures, `textures/blocks/models/${id}`);
});

test("โมเดล: อยู่ในขอบเขตที่เกมรับ และ uv ทุกหน้าอยู่ในเท็กซ์เจอร์", () => {
  for (const [id, out] of built) {
    const desc = out.geo["minecraft:geometry"][0].description;
    for (const bone of out.geo["minecraft:geometry"][0].bones) {
      for (const cube of bone.cubes) {
        for (let k = 0; k < 3; k++) {
          const [lo, hi] = [cube.origin[k], cube.origin[k] + cube.size[k]];
          // เกมรับ geometry ของบล็อกไม่เกิน 30×30×30 เราจำกัดให้อยู่ในบล็อกเดียว (ยื่นได้ไม่เกิน 1 หน่วยสำหรับชิ้นที่หมุน)
          const [min, max] = k === 1 ? [0, 16] : [-8, 8];
          assert.ok(lo >= min - 1 && hi <= max + 1, `${id}: กล่องเกินขอบบล็อก ${JSON.stringify(cube.origin)} ${JSON.stringify(cube.size)}`);
        }
        for (const [face, { uv, uv_size: size }] of Object.entries(cube.uv)) {
          const xs = [uv[0], uv[0] + size[0]];
          const ys = [uv[1], uv[1] + size[1]];
          assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= desc.texture_width && Math.min(...ys) >= 0 && Math.max(...ys) <= desc.texture_height, `${id}: uv ของหน้า ${face} เกินเท็กซ์เจอร์`);
        }
      }
    }
  }
});

// หน้าของกล่องสองใบที่หันทางเดียวกัน อยู่ระนาบเดียวกัน และซ้อนกัน จะกะพริบในเกม (z-fighting)
// ยกเว้นส่วนที่ซ้อนกันนั้นจมอยู่ในกล่องใบที่สาม (มองไม่เห็น)
test("โมเดล: ไม่มีหน้าที่มองเห็นซ้อนกันบนระนาบเดียว", () => {
  const AXIS = { north: [2, -1], south: [2, 1], east: [0, 1], west: [0, -1], up: [1, 1], down: [1, -1] };
  const problems = [];
  for (const m of MODELS) {
    const { faces } = m.layout();
    const boxes = m.cubes.map((c, i) => ({ c, i, lo: c.from, hi: c.from.map((v, k) => v + c.size[k]), rotated: Boolean(c.opts.rot) }));
    const inside = (p, b) => [0, 1, 2].every((k) => p[k] > b.lo[k] + 1e-6 && p[k] < b.hi[k] - 1e-6);
    for (const a of boxes) {
      for (const b of boxes) {
        if (a.i >= b.i || a.rotated || b.rotated) continue;
        for (const face of FACES) {
          if (!faces[a.i][face] || !faces[b.i][face]) continue;
          const [ax, sign] = AXIS[face];
          const pa = sign > 0 ? a.hi[ax] : a.lo[ax];
          const pb = sign > 0 ? b.hi[ax] : b.lo[ax];
          if (Math.abs(pa - pb) > 1e-6) continue;
          const [u, v] = [0, 1, 2].filter((k) => k !== ax);
          const lo = [Math.max(a.lo[u], b.lo[u]), Math.max(a.lo[v], b.lo[v])];
          const hi = [Math.min(a.hi[u], b.hi[u]), Math.min(a.hi[v], b.hi[v])];
          if (hi[0] - lo[0] < 1e-6 || hi[1] - lo[1] < 1e-6) continue;
          // จุดตัวอย่างในส่วนที่ซ้อนกัน เลื่อนออกนอกหน้าเล็กน้อย: ถ้าทุกจุดอยู่ในกล่องอื่น แปลว่ามองไม่เห็น
          let visible = false;
          for (let s = 0.125; s < 1 && !visible; s += 0.25) {
            for (let t = 0.125; t < 1 && !visible; t += 0.25) {
              const p = [0, 0, 0];
              p[ax] = pa + sign * 0.01;
              p[u] = lo[0] + (hi[0] - lo[0]) * s;
              p[v] = lo[1] + (hi[1] - lo[1]) * t;
              if (!boxes.some((o) => o.i !== a.i && o.i !== b.i && !o.rotated && inside(p, o))) visible = true;
            }
          }
          if (visible) problems.push(`${m.id}: หน้า ${face} ของ "${a.c.name}" กับ "${b.c.name}"`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("ตัวสร้างโมเดล: แกน x กลับในไฟล์ของเกม หน้าบน/ล่างกลับ uv และแผ่นภาพตัดส่วนตามตำแหน่งของกล่อง", () => {
  const m = new Model("t", { tex: [16, 16] });
  const dial = sheet("north", [-2, 2], [0, 2], (cv) => void cv.fill("#000000").px(0, 0, "#ff0000").px(3, 0, "#00ff00"));
  m.cube("east_half", [0, 0, 0], [2, 2, 1], { north: dial, up: solid("#0000ff") });
  m.cube("west_half", [-2, 0, 0], [2, 2, 1], { north: dial });
  const out = m.build();
  const [east, west] = out.geo["minecraft:geometry"][0].bones[0].cubes;
  assert.deepEqual(east.origin, [-2, 0, 0]); // x 0..2 ในสเปก = −2..0 ในไฟล์ของเกม
  assert.deepEqual(west.origin, [0, 0, 0]);
  assert.ok(east.uv.up.uv_size[0] < 0 && east.uv.up.uv_size[1] < 0);
  assert.ok(east.uv.north.uv_size[0] > 0);
  // ซ้ายของภาพหน้าเหนือ = ตะวันออก: กล่องฝั่งตะวันออกได้ครึ่งซ้ายของแผ่น (จุดแดง) ฝั่งตะวันตกได้ครึ่งขวา (จุดเขียว)
  const png = PNG.sync.read(out.png);
  const at = ([u, v]) => [...png.data.slice((v * png.width + u) * 4, (v * png.width + u) * 4 + 3)];
  assert.deepEqual(at(east.uv.north.uv), [255, 0, 0]);
  assert.deepEqual(at([west.uv.north.uv[0] + 1, west.uv.north.uv[1]]), [0, 255, 0]);
  // ไฟล์ Blockbench ใช้พิกัดของสเปกตรง ๆ
  assert.deepEqual(out.bbmodel.elements[0].from, [0, 0, 0]);
  assert.equal(out.bbmodel.meta.model_format, "bedrock_block");
});

test("Pin Board: หน้าด้านหน้าใช้ภาพของการ์ด โครง card/pins สลับตามสถานะ และมีไอเท็มวางที่ใช้ไอคอนแบน", () => {
  const geo = built.get("pin_board").geo["minecraft:geometry"][0];
  assert.deepEqual(geo.bones.map((b) => b.name).sort(), ["board", "card", "pins"]);
  const card = geo.bones.find((b) => b.name === "card").cubes[0];
  assert.equal(card.uv.north.material_instance, "card");
  assert.deepEqual([card.uv.north.uv, card.uv.north.uv_size], [[8, 12], [48, 42]]); // กระดาษ x 4..28, y 6..27 ของภาพ 32×32 ในพื้นที่ uv 64×64
  const block = JSON.parse(readFileSync(join(ROOT, "BP/blocks/pin_board.json"), "utf8"))["minecraft:block"];
  const vis = block.components["minecraft:geometry"].bone_visibility;
  assert.ok(vis.card.includes("!= 0") && vis.pins.startsWith("!("));
  const item = JSON.parse(readFileSync(join(ROOT, "BP/items/pin_board.json"), "utf8"))["minecraft:item"];
  assert.deepEqual(item.components["minecraft:block_placer"], { block: "bpc:pin_board", replace_block_item: true });
  assert.ok(existsSync(join(ROOT, "RP/textures/items/pin_board.png")));
});

test("ของตกแต่ง: หันหน้าตามทิศที่วาง และกล่องเลือกอยู่ในบล็อก", () => {
  for (const id of TRINKETS) {
    const block = JSON.parse(readFileSync(join(ROOT, `BP/blocks/${id}.json`), "utf8"))["minecraft:block"];
    assert.deepEqual(block.description.traits["minecraft:placement_direction"].enabled_states, ["minecraft:cardinal_direction"]);
    assert.equal(block.permutations.length, 3);
    const box = block.components["minecraft:selection_box"];
    assert.ok(box.size.every((v) => v >= 2), `${id}: กล่องเลือกเล็กเกิน`);
    for (let k = 0; k < 3; k++) {
      const [min, max] = k === 1 ? [0, 16] : [-8, 8];
      assert.ok(box.origin[k] >= min && box.origin[k] + box.size[k] <= max, `${id}: กล่องเลือกเกินบล็อก`);
    }
  }
});
