// ลูปค้นพบ + ที่เก็บความคืบหน้า + ชุดสะสม บนตัวแทนของ @minecraft/server
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GameMode, mock, world } from "@minecraft/server";
import { keysOf } from "@minecraft/server-ui";
import { MYSTERY_LIMIT, loadSettings, saveSettings } from "../BP/scripts/config.js";
import { MAIN, MAIN_TOTAL, cardForKey } from "../BP/scripts/registry/biomeRegistry.js";
import { SETS } from "../BP/scripts/registry/cards.generated.js";
import * as album from "../BP/scripts/systems/album.js";
import * as store from "../BP/scripts/systems/collectionStore.js";
import * as discovery from "../BP/scripts/systems/discovery.js";
import * as notify from "../BP/scripts/systems/notify.js";
import { toRecord } from "../BP/scripts/systems/postcardFactory.js";
import { forgetWeather, onWeatherChange } from "../BP/scripts/systems/stamps.js";
import { itemTypeFor } from "../BP/scripts/util/record.js";

const NOW = new Date(Date.UTC(2026, 10, 10, 12)); // ไม่อยู่ในช่วงเทศกาล
let step = 0;

beforeEach(() => {
  mock.reset();
  store.unloadAll();
  discovery.resetState();
  notify.resetState();
  forgetWeather();
  discovery.setClock(() => NOW);
  loadSettings(world);
  store.migrateWorld();
});

const types = (p) => p.container.items().map((i) => i.typeId);
/** โปสการ์ดที่อยู่ในช่องของอัลบั้ม ตามลำดับที่ค้นพบ เขียนเป็นชนิดไอเท็มที่จะได้เมื่อหยิบออก */
const postcards = (p) =>
  store.keys(p).filter((key) => !store.get(p, key).out).map((key) => itemTypeFor(cardForKey(key).id, store.get(p, key).foil));
/** โปสการ์ดที่เป็นไอเท็มในกระเป๋า */
const carried = (p) => types(p).filter((t) => t.startsWith("bpc:postcard_"));
const restocks = (p) => keysOf(p.actionBars).filter((k) => k === "bpc.msg.restocked").length;
const col = (p) => JSON.parse(p.getDynamicProperty("bpc:col") ?? "null");
/** ย้ายผู้เล่นไปไบโอมอื่น (ไกลพอให้เช็คใหม่) แล้วเช็ค */
function visit(p, biome) {
  step += 100;
  p.moveTo(step, 64, 0);
  p.dimension.biome = () => biome;
  discovery.checkPlayer(p);
}

test("ค้นพบไบโอมใหม่: โปสการ์ดเข้าอัลบั้ม ไม่เข้ากระเป๋า บันทึกความคืบหน้า และมีฟีดแบ็ก", () => {
  const p = mock.player({ name: "Somchai" });
  world.day = 7;
  visit(p, "minecraft:cherry_grove");
  assert.deepEqual(postcards(p), ["bpc:postcard_cherry_grove"]);
  assert.deepEqual(types(p), ["bpc:album"]); // เข้ากระเป๋าแค่อัลบั้มเล่มแรก
  assert.equal(p.dimension.drops.length, 0);
  const saved = col(p);
  assert.equal(saved.v, 1);
  assert.deepEqual(saved.cards.cherry_grove, { t: Math.floor(NOW.getTime() / 1000), d: 7, x: step, z: 0, dim: "o" });
  // หยิบออกจากช่อง: ได้ไอเท็มที่มีข้อมูลการค้นพบครบ
  assert.equal(album.takeOut(p, "cherry_grove"), "ok");
  const item = p.container.items().find((i) => i.typeId === "bpc:postcard_cherry_grove");
  assert.deepEqual(toRecord(item), { card: "cherry_grove", d: 7, x: step, z: 0, dim: "o", by: "Somchai" });
  assert.deepEqual(keysOf(item.lore), ["bpc.lore.found", "bpc.lore.by", "bpc.lore.rarity.uncommon"]);
  assert.equal(p.titles.length, 1);
  assert.deepEqual(keysOf(p.titles[0].title), ["bpc.card.cherry_grove"]);
  assert.deepEqual(keysOf(p.titles[0].options.subtitle), ["bpc.toast.new"]);
  assert.deepEqual(p.titles[0].options.subtitle.rawtext[0].with, ["1", String(MAIN_TOTAL)]);
  assert.ok(p.titles[0].options.stayDuration > 0);
  assert.ok(p.dimension.particles > 0 && p.dimension.particles <= 15);
  assert.equal(p.sounds.length, 1);
});

test("โปสการ์ดใบแรกได้อัลบั้ม 1 เล่มที่ตายแล้วไม่หาย ครั้งเดียว", () => {
  const p = mock.player();
  visit(p, "minecraft:plains");
  const album = p.container.items().find((i) => i.typeId === "bpc:album");
  assert.ok(album && album.keepOnDeath);
  assert.equal(p.titles.length, 1); // การ์ดของอัลบั้มรอคิวต่อจากการ์ดโปสการ์ด
  mock.advance(200);
  assert.deepEqual(keysOf(p.titles[1].title), ["item.bpc:album"]);
  assert.deepEqual(keysOf(p.titles[1].options.subtitle), ["bpc.toast.album"]);
  visit(p, "minecraft:forest");
  assert.equal(types(p).filter((t) => t === "bpc:album").length, 1);
  assert.equal(JSON.parse(p.getDynamicProperty("bpc:flags")).album, true);
});

test("เดินข้ามขอบไบโอมไปมา: ได้การ์ดครั้งเดียว ไม่ซ้ำ", () => {
  const p = mock.player();
  for (const biome of ["minecraft:plains", "minecraft:forest", "minecraft:plains", "minecraft:sunflower_plains", "minecraft:forest"]) visit(p, biome);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_forest"]);
  assert.deepEqual(carried(p), []);
  assert.equal(restocks(p), 0); // ช่องเต็มอยู่: กลับมากี่รอบก็ไม่มีใบใหม่
  mock.advance(400);
  // การ์ดแจ้งเตือนเรียงตามลำดับ: โปสการ์ดก่อน แล้วจึงอัลบั้ม แม้อัลบั้มจะเกิดก่อนโปสการ์ดใบที่สอง
  assert.deepEqual(p.titles.map((t) => keysOf(t.title)[0]), ["bpc.card.plains", "bpc.card.forest", "item.bpc:album"]);
});

test("ขยับไม่ถึง 8 บล็อกไม่เรียก getBiome ใหม่ และการขยับแนวดิ่งนับด้วย", () => {
  const p = mock.player();
  let calls = 0;
  p.dimension.biome = () => {
    calls++;
    return "minecraft:plains";
  };
  discovery.checkPlayer(p);
  discovery.checkPlayer(p);
  p.moveTo(5, 64, 2);
  discovery.checkPlayer(p);
  assert.equal(calls, 1);
  p.moveTo(5, 64, 5);
  discovery.checkPlayer(p);
  assert.equal(calls, 2);
  p.dimension.biome = () => "minecraft:lush_caves"; // ลงถ้ำใต้จุดเดิม
  p.moveTo(5, 20, 5);
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_lush_caves"]);
});

test("เข้า Nether และ End ได้การ์ดของมิตินั้น แม้พิกัดเดิม", () => {
  const p = mock.player();
  p.dimension.biome = () => "minecraft:plains";
  discovery.checkPlayer(p);
  for (const [dim, biome] of [["minecraft:nether", "minecraft:hell"], ["minecraft:the_end", "minecraft:the_end"]]) {
    const d = world.getDimension(dim);
    d.biome = () => biome;
    p.moveTo(0, 64, 0, d);
    discovery.checkPlayer(p);
  }
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_nether", "bpc:postcard_the_end"]);
  assert.equal(col(p).cards.nether.dim, "n");
  assert.equal(col(p).cards.the_end.dim, "e");
});

test("ไบโอมที่ไม่นับ ผู้ชม ผู้เล่นที่ตาย และโหมดสร้างสรรค์ที่ถูกปิด ไม่ได้โปสการ์ด", () => {
  const p = mock.player();
  visit(p, "minecraft:river");
  p.mode = GameMode.Spectator;
  visit(p, "minecraft:plains");
  p.mode = GameMode.Survival;
  p.health = 0;
  visit(p, "minecraft:plains");
  assert.deepEqual(postcards(p), []);
  p.health = 20; // เกิดใหม่ที่เดิม ต้องได้โดยไม่ต้องขยับ
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
  p.mode = GameMode.Creative;
  visit(p, "minecraft:forest");
  assert.equal(postcards(p).length, 2); // ค่าเริ่มต้น: โหมดสร้างสรรค์ได้ตามปกติ
  saveSettings(world, { creative: false });
  visit(p, "minecraft:desert");
  assert.equal(postcards(p).length, 2);
});

test("chunk ยังไม่โหลด: ข้ามรอบนี้ แล้วรอบหน้าได้โดยไม่ต้องขยับ", () => {
  const p = mock.player();
  p.dimension.biome = () => null;
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), []);
  p.dimension.biome = () => "minecraft:plains";
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
});

test("กระเป๋าเต็มตอนค้นพบ: โปสการ์ดยังเข้าอัลบั้ม มีแต่อัลบั้มเล่มแรกที่ตกที่เท้าพร้อมข้อความ", () => {
  const p = mock.player();
  p.container.fill();
  visit(p, "minecraft:plains");
  visit(p, "minecraft:forest");
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_forest"]);
  assert.deepEqual(p.dimension.drops.map((d) => d.item.typeId), ["bpc:album"]);
  assert.ok(keysOf(p.actionBars).includes("bpc.msg.inventory_full"));
  assert.equal(album.takeOut(p, "plains"), "full"); // หยิบออกตอนกระเป๋าเต็มไม่ได้ และช่องไม่เปลี่ยน
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_forest"]);
});

test("หยิบออกแล้วกลับไปไบโอมนั้น: ช่องที่ว่างได้ใบใหม่ครั้งเดียว แจ้งทาง actionbar และความคืบหน้าไม่ลด", () => {
  const p = mock.player({ name: "Somchai" });
  visit(p, "minecraft:plains");
  visit(p, "minecraft:forest");
  mock.advance(400);
  const titles = p.titles.length;
  assert.equal(album.takeOut(p, "plains"), "ok");
  assert.equal(album.takeOut(p, "plains"), "changed"); // ช่องว่างแล้ว หยิบซ้ำไม่ได้
  assert.equal(col(p).cards.plains.out, true);
  assert.deepEqual(postcards(p), ["bpc:postcard_forest"]);
  assert.deepEqual(carried(p), ["bpc:postcard_plains"]);
  assert.deepEqual(store.counts(p), { main: 2, mystery: 0, bonus: 0, foil: 0 });

  visit(p, "minecraft:forest"); // ไบโอมอื่น: ช่องของ plains ยังว่าง
  assert.equal(col(p).cards.plains.out, true);
  visit(p, "minecraft:sunflower_plains"); // ไบโอมของการ์ดใบเดียวกัน: ได้ใบใหม่เข้าช่อง
  assert.equal(col(p).cards.plains.out, undefined);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains", "bpc:postcard_forest"]);
  assert.equal(restocks(p), 1);
  assert.ok(keysOf(p.actionBars.at(-1)).includes("bpc.card.plains"));
  visit(p, "minecraft:plains"); // ช่องเต็มแล้ว: ไม่มีอะไรเพิ่ม
  assert.equal(restocks(p), 1);
  assert.deepEqual(carried(p), ["bpc:postcard_plains"]); // ใบที่หยิบออกยังอยู่กับผู้เล่น
  mock.advance(400);
  assert.equal(p.titles.length, titles); // ใบใหม่ของการ์ดที่เคยได้แล้วไม่ขึ้นการ์ดแจ้งเตือน
  // ใบใหม่มีข้อมูลการค้นพบครั้งแรก เหมือนใบเดิม
  assert.equal(album.takeOut(p, "plains"), "ok");
  const [first, second] = p.container.items().filter((i) => i.typeId === "bpc:postcard_plains").map(toRecord);
  assert.deepEqual(second, first);
});

test("หยิบออก: เขียนข้อมูลไม่สำเร็จไม่ให้ไอเท็ม และเติมช่องไม่สำเร็จลองใหม่รอบหน้าได้", () => {
  const p = mock.player();
  visit(p, "minecraft:plains");
  p.failWrites = true;
  assert.equal(album.takeOut(p, "plains"), "error");
  assert.deepEqual(carried(p), []);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
  p.failWrites = false;
  assert.equal(album.takeOut(p, "plains"), "ok");
  p.failWrites = true;
  visit(p, "minecraft:plains"); // เติมช่องไม่ได้: ไม่แจ้งว่าได้ใบใหม่
  assert.equal(restocks(p), 0);
  assert.deepEqual(postcards(p), []);
  p.failWrites = false;
  visit(p, "minecraft:plains");
  assert.equal(restocks(p), 1);
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
  assert.deepEqual(carried(p), ["bpc:postcard_plains"]);
});

test("ไบโอมจากแอดออนอื่น: การ์ดลึกลับ 1 ใบต่อ biome id ไม่นับในเป้าหมายหลัก", () => {
  const p = mock.player();
  visit(p, "bod:redwood");
  visit(p, "bod:redwood");
  visit(p, "bod:maple");
  assert.deepEqual(postcards(p), ["bpc:postcard_mystery", "bpc:postcard_mystery"]);
  assert.deepEqual(Object.keys(col(p).cards), ["mystery:bod:redwood", "mystery:bod:maple"]);
  assert.deepEqual(store.counts(p), { main: 0, mystery: 2, bonus: 0, foil: 0 });
  assert.equal(album.slotRecord(p, "mystery:bod:redwood").bio, "bod:redwood");
  assert.equal(album.takeOut(p, "mystery:bod:maple"), "ok"); // ช่องของการ์ดลึกลับแยกตาม biome id
  assert.equal(toRecord(p.container.items().find((i) => i.typeId === "bpc:postcard_mystery")).bio, "bod:maple");
  visit(p, "bod:redwood");
  assert.equal(restocks(p), 0);
  visit(p, "bod:maple");
  assert.equal(restocks(p), 1);
  assert.deepEqual(keysOf(p.titles[0].options.subtitle), ["bpc.toast.bonus"]);
  saveSettings(world, { mystery: false });
  visit(p, "bod:birch");
  assert.equal(postcards(p).length, 2);
});

test("การ์ดลึกลับจำกัดจำนวนต่อผู้เล่น", () => {
  const p = mock.player();
  const cards = {};
  for (let i = 0; i < MYSTERY_LIMIT - 1; i++) cards[`mystery:x:b${i}`] = { d: 1 };
  p.setDynamicProperty("bpc:col", JSON.stringify({ v: 1, cards }));
  visit(p, "x:new1");
  visit(p, "x:new2");
  assert.equal(store.has(p, "mystery:x:new1"), true);
  assert.equal(store.has(p, "mystery:x:new2"), false);
  assert.equal(postcards(p).length, MYSTERY_LIMIT);
  assert.equal(store.counts(p).mystery, MYSTERY_LIMIT);
});

test("ฟอยล์: ค้นพบตอนมีแสตมป์ได้ฟอยล์เลย ได้ครั้งเดียวต่อการ์ด และใบในช่องกลายเป็นฟอยล์", () => {
  const p = mock.player();
  world.timeOfDay = 14000;
  visit(p, "minecraft:plains");
  assert.deepEqual(postcards(p), ["bpc:postcard_plains_foil"]);
  assert.equal(col(p).cards.plains.foil, true);
  assert.equal(col(p).cards.plains.st, "night");
  assert.deepEqual(keysOf(p.titles[0].options.subtitle), ["bpc.toast.foil"]);
  assert.equal(album.slotRecord(p, "plains").st, "night");

  world.timeOfDay = 6000;
  visit(p, "minecraft:forest"); // กลางวัน: การ์ดปกติ
  assert.deepEqual(postcards(p), ["bpc:postcard_plains_foil", "bpc:postcard_forest"]);
  assert.equal(album.takeOut(p, "forest"), "ok"); // หยิบใบปกติออกไปก่อน
  world.timeOfDay = 14000;
  visit(p, "minecraft:forest"); // กลางคืน: ช่องกลายเป็นฟอยล์ และกลับมาเต็ม
  assert.equal(col(p).cards.forest.out, undefined);
  assert.equal(restocks(p), 0); // ได้ฟอยล์ขึ้นการ์ดแจ้งเตือน ไม่ใช่ข้อความใบใหม่
  visit(p, "minecraft:forest"); // ครั้งที่สาม: ไม่ได้อีก
  visit(p, "minecraft:plains");
  assert.deepEqual(postcards(p), ["bpc:postcard_plains_foil", "bpc:postcard_forest_foil"]);
  assert.deepEqual(carried(p), ["bpc:postcard_forest"]); // ใบปกติที่หยิบออกไปยังอยู่
  assert.deepEqual(store.counts(p), { main: 2, mystery: 0, bonus: 0, foil: 2 });
  mock.advance(1000);
  assert.equal(p.titles.filter((t) => keysOf(t.options.subtitle)[0] === "bpc.toast.foil").length, 2);
  assert.equal(album.takeOut(p, "forest"), "ok");
  assert.equal(toRecord(p.container.items().find((i) => i.typeId === "bpc:postcard_forest_foil")).st, "night");
  visit(p, "bod:redwood"); // การ์ดลึกลับไม่มีฟอยล์
  assert.equal(postcards(p).at(-1), "bpc:postcard_mystery");
});

test("ฟอยล์: ปิดได้ในการตั้งค่า และอากาศมาจาก event weatherChange", () => {
  const p = mock.player();
  onWeatherChange({ dimension: "minecraft:overworld", newWeather: "Thunder" });
  assert.equal(world.getDynamicProperty("bpc:wx:o"), "Thunder");
  visit(p, "minecraft:plains");
  assert.equal(col(p).cards.plains.st, "storm");
  forgetWeather(); // โหลดสคริปต์ใหม่: ต้องจำอากาศจาก world DP
  visit(p, "minecraft:forest");
  assert.equal(col(p).cards.forest.st, "storm");
  const nether = world.getDimension("minecraft:nether");
  nether.biome = () => "minecraft:hell";
  p.moveTo(0, 64, 0, nether);
  discovery.checkPlayer(p); // Nether ไม่มีอากาศ
  assert.equal(col(p).cards.nether.foil, undefined);
  saveSettings(world, { foil: false });
  p.moveTo(0, 64, 0, world.getDimension("minecraft:overworld"));
  visit(p, "minecraft:desert");
  assert.equal(postcards(p).at(-1), "bpc:postcard_desert");
});

test("การ์ดเทศกาล: ได้ใบละครั้งในช่วงเทศกาล นับแยกจากการ์ดหลัก", () => {
  const p = mock.player();
  discovery.setClock(() => new Date(Date.UTC(2026, 9, 31, 12)));
  p.dimension.biome = () => "minecraft:plains";
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), ["bpc:postcard_fest_halloween"]);
  assert.equal(col(p).cards.fest_halloween.yr, 2026);
  assert.deepEqual(album.slotRecord(p, "fest_halloween"), { card: "fest_halloween", yr: 2026, by: p.name });
  discovery.checkPlayer(p); // รอบถัดไปได้การ์ดไบโอมโดยไม่ต้องขยับ
  discovery.checkPlayer(p);
  assert.deepEqual(postcards(p), ["bpc:postcard_fest_halloween", "bpc:postcard_plains"]);
  assert.deepEqual(store.counts(p), { main: 1, mystery: 0, bonus: 1, foil: 0 });

  // หยิบการ์ดเทศกาลออก: นอกช่วงเทศกาลช่องยังว่าง ในช่วงเทศกาลได้ใบใหม่ (ปีเดิมของใบแรก)
  assert.equal(album.takeOut(p, "fest_halloween"), "ok");
  discovery.setClock(() => NOW);
  visit(p, "minecraft:plains");
  assert.equal(col(p).cards.fest_halloween.out, true);
  discovery.setClock(() => new Date(Date.UTC(2027, 9, 30, 12)));
  visit(p, "minecraft:plains");
  assert.equal(col(p).cards.fest_halloween.out, undefined);
  assert.equal(col(p).cards.fest_halloween.yr, 2026);
  assert.equal(restocks(p), 1);

  const q = mock.player({ name: "Q" });
  saveSettings(world, { seasonal: false });
  discovery.checkPlayer(q);
  assert.deepEqual(postcards(q), ["bpc:postcard_plains"]);
});

test("ชุดสะสม: ครบชุดได้รางวัลครั้งเดียว ครบทุกชุดได้ Traveler's Globe", () => {
  const p = mock.player();
  const got = () => [...types(p), ...p.dimension.drops.map((d) => d.item.typeId)];
  visit(p, "minecraft:desert");
  visit(p, "minecraft:savanna");
  assert.ok(!got().includes("bpc:trophy_dry"));
  visit(p, "minecraft:mesa");
  assert.equal(got().filter((t) => t === "bpc:trophy_dry").length, 1);
  assert.deepEqual(JSON.parse(p.getDynamicProperty("bpc:flags")).sets, ["dry"]);
  mock.advance(400);
  assert.ok(p.titles.some((t) => keysOf(t.title)[0] === "bpc.set.dry" && keysOf(t.options.subtitle)[0] === "bpc.toast.set"));
  for (const card of MAIN) visit(p, card.biomes[0]);
  for (const set of SETS) assert.equal(got().filter((t) => t === set.reward).length, 1, set.id);
  assert.equal(got().filter((t) => t === "bpc:traveler_globe").length, 1);
  mock.advance(4000);
  const shown = p.titles.map((t) => keysOf(t.title)[0]);
  for (const set of SETS) assert.ok(shown.includes(`bpc.set.${set.id}`), set.id);
  assert.equal(shown.at(-1), "bpc.toast.all_sets"); // ครบทุกชุดแสดงเป็นใบสุดท้าย
  assert.ok(shown.includes("bpc.toast.more")); // การ์ดที่เข้าคิวเกินจำนวนถูกรวมเป็นใบสรุป
  assert.equal(notify.waiting(p.id), 0);
  assert.equal(store.counts(p).main, MAIN_TOTAL);
  assert.equal(postcards(p).length, MAIN_TOTAL); // ทุกใบอยู่ในอัลบั้ม ไม่มีใบไหนเข้ากระเป๋าหรือตกพื้น
  assert.equal(got().filter((t) => t.startsWith("bpc:postcard_")).length, 0);
  assert.ok(p.getDynamicProperty("bpc:col").length < 4000); // ห่างจากขีด 32,767 มาก
});

test("โลกที่ schema ใหม่กว่าแอดออน: หยุดเขียนข้อมูล และแจ้งผู้เล่นครั้งเดียว", () => {
  world.setDynamicProperty("bpc:schema", 99);
  store.migrateWorld();
  const p = mock.player();
  visit(p, "minecraft:plains");
  assert.deepEqual(types(p), []);
  assert.equal(p.getDynamicProperty("bpc:col"), undefined);
  assert.equal(world.getDynamicProperty("bpc:schema"), 99);
  store.welcome(p);
  store.welcome(p);
  assert.deepEqual(keysOf(p.messages), ["bpc.msg.schema_newer"]);

  world.setDynamicProperty("bpc:schema", 1);
  store.migrateWorld();
  const q = mock.player({ name: "Q" });
  const newer = JSON.stringify({ v: 5, cards: { plains: {} }, future: true });
  q.setDynamicProperty("bpc:col", newer);
  visit(q, "minecraft:forest");
  assert.deepEqual(types(q), []);
  assert.equal(q.getDynamicProperty("bpc:col"), newer); // ข้อมูลของเวอร์ชันใหม่ไม่ถูกแตะ
});

test("ข้อมูลเสีย: เก็บของเดิมไว้ที่ _bak แล้วเริ่มใหม่ และข้อมูลรอดการโหลดสคริปต์ใหม่", () => {
  const p = mock.player();
  p.setDynamicProperty("bpc:col", "{oops");
  visit(p, "minecraft:plains");
  assert.equal(p.getDynamicProperty("bpc:col_bak"), "{oops");
  assert.deepEqual(Object.keys(col(p).cards), ["plains"]);

  const q = mock.player({ name: "Q" });
  q.setDynamicProperty("bpc:col", '{"v":1,"cards":[]}');
  visit(q, "minecraft:plains");
  assert.equal(q.getDynamicProperty("bpc:col_bak"), '{"v":1,"cards":[]}');

  store.unloadAll(); // เหมือน /reload: แคชหาย ต้องโหลดจาก DP ได้เอง
  discovery.resetState();
  visit(p, "minecraft:plains");
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
});

test("เขียน DP ไม่สำเร็จ: ไม่ให้โปสการ์ด และลองใหม่ได้ภายหลัง", () => {
  const p = mock.player();
  p.failWrites = true;
  visit(p, "minecraft:plains");
  assert.deepEqual(types(p), []);
  assert.equal(store.has(p, "plains"), false);
  p.failWrites = false;
  visit(p, "minecraft:plains");
  assert.deepEqual(postcards(p), ["bpc:postcard_plains"]);
});

test("ติดตั้งในโลกเก่า: ข้อความต้อนรับบอกให้ไปเยือนไบโอมอีกครั้ง ครั้งเดียว", () => {
  world.day = 50;
  const p = mock.player();
  store.welcome(p);
  store.welcome(p);
  assert.deepEqual(keysOf(p.messages), ["bpc.msg.welcome_old_world"]);
  world.day = 2;
  const q = mock.player({ name: "Q" });
  store.welcome(q);
  assert.deepEqual(q.messages, []);
  assert.equal(JSON.parse(q.getDynamicProperty("bpc:flags")).welcome, true);
});

test("ลูป: หมุนเวียนผู้เล่นทีละกลุ่ม ทุกคนถูกเช็คหนึ่งครั้งใน 3 รอบ และคนหนึ่งพังไม่กระทบคนอื่น", () => {
  const players = [0, 1, 2, 3, 4].map((i) => mock.player({ name: `P${i}`, x: i * 100 }));
  players[0].getGameMode = () => {
    throw new Error("boom");
  };
  discovery.tick();
  assert.deepEqual(players.map((p) => postcards(p).length), [0, 0, 0, 1, 0]);
  discovery.tick();
  discovery.tick();
  assert.deepEqual(players.map((p) => postcards(p).length), [0, 1, 1, 1, 1]);
  discovery.tick();
  discovery.tick();
  discovery.tick();
  assert.deepEqual(players.map((p) => postcards(p).length), [0, 1, 1, 1, 1]);
});

test("ดีบัก: actionbar แสดง biome id ของผู้เล่นที่เปิดไว้", () => {
  const p = mock.player();
  assert.equal(discovery.toggleDebug(p.id), true);
  discovery.tick();
  assert.match(p.actionBars.at(-1), /^minecraft:plains -> plains \| loop \d+ ms$/);
  assert.equal(discovery.toggleDebug(p.id), false);
});
