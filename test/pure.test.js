// โมดูลบริสุทธิ์และตารางเนื้อหา: registry, record, lore, migrations, seasons, stamps
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MAIN, MAIN_TOTAL, auditBiomes, cardByBoard, cardById, cardForKey, lookup } from "../BP/scripts/registry/biomeRegistry.js";
import { CARDS, IGNORED, LORE_EN, SETS, SOUVENIRS } from "../BP/scripts/registry/cards.generated.js";
import { CURRENT, migrateAlbum, migrateCollection, migrateFlags, upgrade } from "../BP/scripts/systems/migrations.js";
import { activeFestivals, festivalYear, inWindow } from "../BP/scripts/systems/seasons.js";
import { pickStamp } from "../BP/scripts/systems/stamps.js";
import { MAX_LINE, MAX_LINES, format, loreEnglish, loreFor, loreParts } from "../BP/scripts/util/lore.js";
import { STAMPS, decode, dimCode, dimensionIdOf, encode, itemTypeFor, normalize, parseItemType, sameOrigin } from "../BP/scripts/util/record.js";
import { STRINGS } from "../content/strings.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const game = JSON.parse(readFileSync(join(ROOT, "test/fixtures/game-biomes.json"), "utf8"));
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));

// ---------- registry ----------
test("registry: ทุกไบโอมของเกม 1.26.63 มีการ์ดหลัก หรืออยู่ในรายการไม่นับ", () => {
  let withCard = 0;
  for (const id of game.stable) {
    const hit = lookup(id);
    if (IGNORED.includes(id)) {
      assert.equal(hit, null, id);
      continue;
    }
    assert.ok(hit && hit.card.kind === "biome" && !hit.card.bonus, `${id} ต้องได้การ์ดหลัก`);
    assert.equal(hit.key, hit.card.id);
    withCard++;
  }
  assert.equal(withCard, 87);
  assert.equal(MAIN_TOTAL, 31);
});

test("registry: ตารางไม่มี biome id ที่เกมไม่รู้จัก ยกเว้นตัว experimental", () => {
  const a = auditBiomes(game.stable);
  assert.deepEqual(a.missing, []);
  assert.deepEqual(a.unknown, []);
  assert.deepEqual(a.experimentalOff, game.experimental);
  assert.equal(a.total, 89);
  assert.equal(a.ignored, 2);
  assert.equal(lookup("minecraft:ice_caves").card.id, "ice_caves");
  assert.equal(lookup("minecraft:ice_caves").card.bonus, true);
});

test("registry: ไบโอมที่ไม่รู้จักได้การ์ดลึกลับ 1 ใบต่อ biome id", () => {
  const other = lookup("biomesodiscovery:redwood");
  assert.equal(other.card.id, "mystery");
  assert.equal(other.key, "mystery:biomesodiscovery:redwood");
  assert.equal(other.bio, "biomesodiscovery:redwood");
  assert.equal(lookup("minecraft:brand_new_biome").card.id, "mystery"); // เกมอัปเดตก่อนแอดออน
  assert.equal(lookup("biomesodiscovery:redwood", false), null);
  assert.equal(lookup(undefined), null);
  assert.equal(cardForKey("mystery:any:thing").id, "mystery");
  assert.equal(cardForKey("plains").id, "plains");
  assert.equal(cardForKey("nope"), undefined);
});

test("registry: id, board และ biome ไม่ซ้ำ และทุกการ์ดหลักอยู่ในชุดเดียวพอดี", () => {
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  assert.equal(new Set(CARDS.map((c) => c.board)).size, CARDS.length);
  const biomes = CARDS.flatMap((c) => c.biomes);
  assert.equal(new Set(biomes).size, biomes.length);
  for (const c of CARDS) {
    assert.ok(c.board >= 1 && c.board <= 63, c.id);
    assert.equal(cardByBoard(c.board), c);
    assert.equal(cardById(c.id), c);
  }
  const inSets = SETS.flatMap((s) => s.cards);
  assert.equal(inSets.length, MAIN.length);
  assert.deepEqual([...inSets].sort(), MAIN.map((c) => c.id).sort());
  for (const s of SETS) assert.ok(s.cards.length > 0, s.id);
  for (const s of SOUVENIRS) assert.ok(s.need >= 1 && s.need <= MAIN_TOTAL && s.price > 0, s.id);
});

// ---------- record ----------
test("record: แปลงเป็น JSON และกลับได้ครบทุกฟิลด์", () => {
  const rec = { card: "cherry_grove", foil: true, d: 12, x: -880, z: 1302, yr: 2026, dim: "o", by: "Somchai", kind: "copy", from: "Malee", st: "storm", nm: "Trip with Mom" };
  assert.deepEqual(decode(encode(rec)), rec);
  const mystery = { card: "mystery", d: 3, x: 1, z: 2, dim: "other:dim", by: "A", bio: "other:biome" };
  assert.deepEqual(decode(encode(mystery)), mystery);
});

test("record: normalize ทิ้งฟิลด์ที่ไม่รู้จักหรือชนิดผิด", () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize({ card: "not_a_card" }), null);
  assert.deepEqual(normalize({ card: "mystery", foil: true }), { card: "mystery" }); // การ์ดที่ไม่มีรุ่นฟอยล์
  assert.deepEqual(normalize({ card: "plains", d: "3", x: NaN, z: 4.9, junk: 1, st: "sunny", kind: "orig", from: "X" }), { card: "plains", z: 4 });
  assert.equal(normalize({ card: "plains", by: "a".repeat(99) }).by.length, 32);
  assert.equal(decode("{bad json"), null);
  assert.equal(decode(undefined), null);
  assert.equal(decode('"text"'), null);
});

test("record: sameOrigin เทียบข้อมูลการค้นพบ ไม่เทียบชื่อผู้พบและชื่อจากทั่ง และใบสำเนาไม่ใช่ใบต้นฉบับ", () => {
  const mine = { card: "plains", d: 7, x: -12, z: 40, dim: "o", by: "Somchai" };
  assert.equal(sameOrigin(mine, { ...mine, by: "NewName", nm: "Home" }), true);
  assert.equal(sameOrigin(mine, { ...mine, d: 8 }), false);
  assert.equal(sameOrigin(mine, { ...mine, dim: "n" }), false);
  assert.equal(sameOrigin(mine, { ...mine, foil: true, st: "night" }), false);
  assert.equal(sameOrigin({ ...mine, foil: true, st: "night" }, { ...mine, foil: true, st: "rain" }), false);
  assert.equal(sameOrigin(mine, { ...mine, kind: "copy", from: "Somchai" }), false);
  assert.equal(sameOrigin(mine, { card: "plains" }), false); // ใบจาก /give ไม่มีข้อมูล
  assert.equal(sameOrigin({ card: "mystery", bio: "bod:a", d: 1, x: 2, z: 3 }, { card: "mystery", bio: "bod:b", d: 1, x: 2, z: 3 }), false);
  assert.equal(sameOrigin({ card: "fest_new_year", yr: 2026, by: "A" }, { card: "fest_new_year", yr: 2026, by: "B" }), true);
  assert.equal(sameOrigin({ card: "fest_new_year", yr: 2026 }, { card: "fest_new_year", yr: 2027 }), false);
  assert.equal(sameOrigin(mine, null), false);
  assert.equal(sameOrigin({ card: "nope" }, { card: "nope" }), false);
});

test("record: ชนิดไอเท็ม ↔ การ์ด ครบทุกใบ", () => {
  for (const c of CARDS) {
    assert.deepEqual(parseItemType(itemTypeFor(c.id, false)), { card: c.id, foil: false });
    if (c.foil) assert.deepEqual(parseItemType(itemTypeFor(c.id, true)), { card: c.id, foil: true });
    else assert.equal(itemTypeFor(c.id, true), itemTypeFor(c.id, false));
  }
  for (const bad of ["bpc:postcard_nope", "bpc:postcard_mystery_foil", "minecraft:stick", "bpc:album", undefined, 5]) assert.equal(parseItemType(bad), null);
});

test("record: รหัสมิติ มิติจากแอดออนอื่นใช้ id เต็ม", () => {
  assert.equal(dimCode("minecraft:overworld"), "o");
  assert.equal(dimCode("minecraft:nether"), "n");
  assert.equal(dimCode("minecraft:the_end"), "e");
  assert.equal(dimCode("other:moon"), "other:moon");
  for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end", "other:moon"]) assert.equal(dimensionIdOf(dimCode(id)), id);
});

// ---------- lore ----------
test("lore: ทุกบรรทัดไม่เกิน 50 ตัวอักษรทั้งอังกฤษและไทย และไม่เกิน 20 บรรทัด", () => {
  const long = "W".repeat(32);
  for (const c of CARDS) {
    const variants = [
      { card: c.id },
      { card: c.id, d: 99999999, x: -30000000, z: -30000000, by: long, bio: "x".repeat(96), kind: "copy", from: long },
      { card: c.id, yr: 2099, by: long },
      ...STAMPS.map((st) => ({ card: c.id, d: 1, x: 2, z: 3, by: long, st, kind: "copy", from: long })),
    ];
    for (const rec of variants) {
      const parts = loreParts(rec, c);
      assert.ok(parts.length >= 2 && parts.length <= MAX_LINES);
      for (const [key, ...args] of parts) {
        assert.ok(STRINGS[key], `ไม่มี lang key ${key}`);
        for (const template of STRINGS[key]) {
          const line = format(template, args);
          assert.ok(line.length <= MAX_LINE, `${line.length} ตัวอักษร: ${line}`);
        }
      }
      for (const line of loreEnglish(rec, c)) assert.ok(line.length <= MAX_LINE);
    }
  }
});

test("lore: เนื้อหาตามชนิดของโปสการ์ด", () => {
  const keys = (rec) => loreParts(rec, cardById(rec.card)).map((p) => p[0]);
  assert.deepEqual(keys({ card: "plains", d: 12, x: -880, z: 1302, by: "Somchai" }), ["bpc.lore.found", "bpc.lore.by", "bpc.lore.rarity.common"]);
  assert.deepEqual(keys({ card: "plains" }), ["bpc.lore.unknown", "bpc.lore.rarity.common"]); // ได้จาก /give
  assert.deepEqual(keys({ card: "fest_songkran", yr: 2027, by: "A" }), ["bpc.lore.festival", "bpc.lore.by", "bpc.lore.rarity.rare"]);
  assert.deepEqual(keys({ card: "mystery", d: 1, x: 2, z: 3, bio: "a:b" }), ["bpc.lore.found", "bpc.lore.biome", "bpc.lore.rarity.rare"]);
  assert.deepEqual(keys({ card: "deep_dark", d: 1, x: 2, z: 3, st: "moon", kind: "copy", from: "B" }).slice(-2), ["bpc.lore.stamp.moon", "bpc.lore.copy"]);
  const raw = loreFor({ card: "plains", d: 12, x: -880, z: 1302 }, cardById("plains"));
  assert.deepEqual(raw[0], { rawtext: [{ translate: "bpc.lore.found", with: ["12", "-880", "1302"] }] });
  assert.equal(loreEnglish({ card: "plains", d: 12, x: -880, z: 1302 }, cardById("plains"))[0], "§7Day 12 · X -880 Z 1302");
  for (const key of Object.keys(STRINGS).filter((k) => k.startsWith("bpc.lore."))) assert.ok(LORE_EN[key], key);
});

// ---------- migrations ----------
test("migrations: ข้อมูลใหม่ ถูกต้อง ใหม่กว่า และเสีย", () => {
  assert.equal(CURRENT, 1);
  assert.deepEqual(migrateCollection(null), { data: { v: 1, cards: {} }, status: "new" });
  const good = { v: 1, cards: { plains: { d: 3 } } };
  assert.equal(migrateCollection(good).status, "ok");
  assert.equal(migrateCollection(good).data, good);
  const newer = { v: 2, cards: { plains: {} }, extra: true };
  assert.deepEqual(migrateCollection(newer), { data: newer, status: "newer" }); // ห้ามลด schema
  for (const bad of ["text", 5, [], { v: "1", cards: {} }, { v: 1 }, { v: 1, cards: [] }, { v: 0, cards: {} }, { cards: {} }]) {
    assert.deepEqual(migrateCollection(bad), { data: { v: 1, cards: {} }, status: "reset" });
  }
  assert.deepEqual(migrateAlbum(null), { data: { v: 1, items: [] }, status: "new" });
  assert.equal(migrateAlbum({ v: 1, items: [{ card: "plains" }] }).status, "ok");
  assert.equal(migrateAlbum({ v: 1, items: {} }).status, "reset");
  assert.equal(migrateAlbum({ v: 9, items: [] }).status, "newer");
});

test("migrations: ไล่อัปเกรดทีละเวอร์ชันจนถึงปัจจุบัน", () => {
  const steps = { 1: (d) => ({ ...d, v: 2, a: 1 }), 2: (d) => ({ ...d, v: 3, b: d.a + 1 }) };
  assert.deepEqual(upgrade({ v: 1, cards: {} }, steps, 3), { v: 3, cards: {}, a: 1, b: 2 });
  assert.deepEqual(upgrade({ v: 2, cards: {}, a: 5 }, steps, 3), { v: 3, cards: {}, a: 5, b: 6 });
  assert.equal(upgrade({ v: 1, cards: {} }, { 2: steps[2] }, 3), null); // ขาดขั้น
  assert.deepEqual(upgrade({ v: 3 }, steps, 3), { v: 3 });
});

test("migrations: ธงของผู้เล่น", () => {
  assert.deepEqual(migrateFlags(null), { album: false, welcome: false, sets: [], grand: false });
  assert.deepEqual(migrateFlags({ album: 1, welcome: true, sets: ["dry", 5], grand: 0, junk: 1 }), { album: true, welcome: true, sets: ["dry"], grand: false });
  assert.deepEqual(migrateFlags("x"), { album: false, welcome: false, sets: [], grand: false });
});

// ---------- seasons ----------
test("seasons: ช่วงเทศกาลรวมวันปลายและข้ามปีได้", () => {
  const newYear = ["12-28", "01-03"];
  assert.equal(inWindow(utc(2026, 12, 27), newYear), false);
  assert.equal(inWindow(utc(2026, 12, 28), newYear), true);
  assert.equal(inWindow(utc(2026, 12, 31), newYear), true);
  assert.equal(inWindow(utc(2027, 1, 3), newYear), true);
  assert.equal(inWindow(utc(2027, 1, 4), newYear), false);
  assert.equal(inWindow(utc(2026, 4, 11), ["04-12", "04-16"]), false);
  assert.equal(inWindow(utc(2026, 4, 12), ["04-12", "04-16"]), true);
  assert.equal(inWindow(utc(2026, 4, 16), ["04-12", "04-16"]), true);
  assert.equal(inWindow(utc(2026, 4, 17), ["04-12", "04-16"]), false);
  assert.equal(festivalYear(utc(2026, 12, 30), newYear), 2027);
  assert.equal(festivalYear(utc(2027, 1, 2), newYear), 2027);
  assert.equal(festivalYear(utc(2026, 4, 13), ["04-12", "04-16"]), 2026);
});

test("seasons: มีเทศกาล 4 ใบ ช่วงไม่ทับกัน และแต่ละช่วงยาวอย่างน้อย 5 วัน", () => {
  const days = new Map();
  for (let d = 0; d < 365; d++) {
    const active = activeFestivals(new Date(Date.UTC(2026, 0, 1 + d, 12)));
    assert.ok(active.length <= 1);
    if (active.length) days.set(active[0].id, (days.get(active[0].id) ?? 0) + 1);
  }
  assert.deepEqual([...days.keys()].sort(), ["fest_halloween", "fest_midyear", "fest_new_year", "fest_songkran"]);
  for (const [id, n] of days) assert.ok(n >= 5, `${id} ${n} วัน`);
  assert.deepEqual(activeFestivals(utc(2026, 10, 31)).map((c) => c.id), ["fest_halloween"]);
  assert.deepEqual(activeFestivals(utc(2026, 11, 10)), []);
});

// ---------- stamps ----------
test("stamps: ลำดับ พายุ > คืนพระจันทร์เต็มดวง > ฝน > กลางคืน", () => {
  const pick = (weather, timeOfDay, moonPhase = 4) => pickStamp({ weather, timeOfDay, moonPhase });
  assert.equal(pick("Thunder", 6000), "storm");
  assert.equal(pick("Thunder", 18000, 0), "storm");
  assert.equal(pick("Clear", 18000, 0), "moon");
  assert.equal(pick("Rain", 18000, 0), "moon");
  assert.equal(pick("Rain", 6000), "rain");
  assert.equal(pick("Rain", 18000), "rain");
  assert.equal(pick("Clear", 18000), "night");
  assert.equal(pick("Clear", 6000), null);
  assert.equal(pick("Clear", 6000, 0), null); // พระจันทร์เต็มดวงตอนกลางวันไม่นับ
  assert.equal(pick("Clear", 12999), null);
  assert.equal(pick("Clear", 13000), "night");
  assert.equal(pick("Clear", 22999), "night");
  assert.equal(pick("Clear", 23000), null);
});

// ---------- ตารางเนื้อหาและไฟล์ที่สร้าง ----------
test("content: มีภาพครบทุกใบ", () => {
  for (const c of CARDS) {
    for (const suffix of c.foil ? ["", "_foil"] : [""]) {
      assert.ok(existsSync(join(ROOT, `RP/textures/items/postcards/${c.id}${suffix}.png`)), `ภาพโปสการ์ด ${c.id}${suffix}`);
      assert.ok(existsSync(join(ROOT, `RP/textures/blocks/pin_board/${c.id}${suffix}.png`)), `ภาพบอร์ด ${c.id}${suffix}`);
    }
  }
  for (const s of SOUVENIRS) assert.ok(existsSync(join(ROOT, `RP/${s.icon}.png`)), s.icon);
});

// client ของเกมอ่าน custom component ในไอเท็มไม่ได้: ขึ้น error ทุกไอเท็มทุกครั้งที่เข้าโลก และผู้เล่นเห็นข้อความแดงว่าแพ็กโหลดไม่สำเร็จ (05 ข้อ U17)
test("content: ไฟล์ไอเท็มที่สร้างมีแต่ component ของเกม ไม่มี custom component", () => {
  const dir = join(ROOT, "BP/items");
  const files = readdirSync(dir).filter((n) => n.endsWith(".json"));
  assert.ok(files.length >= 70);
  for (const name of files) {
    const components = JSON.parse(readFileSync(join(dir, name), "utf8"))["minecraft:item"].components;
    for (const key of Object.keys(components)) assert.ok(key.startsWith("minecraft:"), `${name}: ${key}`);
  }
  const main = readFileSync(join(ROOT, "BP/scripts/main.js"), "utf8");
  assert.ok(!main.includes("itemComponentRegistry"), "main.js ต้องไม่ลงทะเบียน item custom component");
  assert.ok(main.includes("world.afterEvents.itemUse.subscribe(onItemUse)"));
});

test("content: lang key ที่สคริปต์ใช้มีในไฟล์ภาษา และ en/th มีตัวแทนค่าเท่ากัน", () => {
  const lang = new Set(readFileSync(join(ROOT, "RP/texts/en_US.lang"), "utf8").split("\n").filter(Boolean).map((l) => l.slice(0, l.indexOf("="))));
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const f = join(dir, name);
      if (statSync(f).isDirectory()) walk(f);
      else if (name.endsWith(".js") && name !== "cards.generated.js") files.push(f);
    }
  };
  walk(join(ROOT, "BP/scripts"));
  let checked = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/"((?:bpc|tile)\.[A-Za-z0-9_.:]+)"/g)) {
      assert.ok(lang.has(m[1]), `${f}: ไม่มี lang key ${m[1]}`);
      checked++;
    }
    for (const m of src.matchAll(/`((?:bpc|tile)\.[A-Za-z0-9_.]*)\$\{/g)) {
      assert.ok([...lang].some((k) => k.startsWith(m[1])), `${f}: ไม่มี lang key ขึ้นต้นด้วย ${m[1]}`);
      checked++;
    }
  }
  assert.ok(checked > 60, `ตรวจได้ ${checked} จุด`);
  const count = (s) => (s.match(/%s/g) ?? []).length;
  for (const [key, [en, th]] of Object.entries(STRINGS)) assert.equal(count(en), count(th), key);
});
