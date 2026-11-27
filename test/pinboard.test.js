// Pin Board บนตัวแทนของ @minecraft/server (พฤติกรรมบนเอนจินจริงตรวจด้วย testpack บน BDS)
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ItemStack, mock, world } from "@minecraft/server";
import { keysOf } from "@minecraft/server-ui";
import { loadSettings, saveSettings } from "../BP/scripts/config.js";
import * as store from "../BP/scripts/systems/collectionStore.js";
import { cleanPins, deliverReturns, guardBreak, listPins, pinKey, registerPinBoardComponent } from "../BP/scripts/systems/pinBoard.js";
import { create, toRecord } from "../BP/scripts/systems/postcardFactory.js";

const OVERWORLD = "minecraft:overworld";
const REC = { card: "cherry_grove", d: 12, x: -880, z: 1302, dim: "o", by: "Somchai" };
const KEY = "bpc:pin:o:1,2,3";
let board;

beforeEach(() => {
  mock.reset();
  store.unloadAll();
  loadSettings(world);
  const reg = mock.registry();
  registerPinBoardComponent(reg);
  board = reg.components.get("bpc:pin_board");
});

const newBoard = (states = {}, x = 1, dim = OVERWORLD) =>
  mock.block(dim, x, 2, 3, "bpc:pin_board", { "bpc:page": 0, "bpc:slot": 0, "bpc:foil": false, "minecraft:cardinal_direction": "north", ...states });
const card = (block) => block.permutation.getState("bpc:page") * 16 + block.permutation.getState("bpc:slot");
const hold = (p, item) => p.container.setItem(0, item);
const tap = (block, player) => board.onPlayerInteract({ block, player, dimension: block.dimension });
const smash = (block, entitySource) => board.onBreak({ block, brokenBlockPermutation: block.permutation, dimension: block.dimension, entitySource });
const pinned = (key = KEY) => JSON.parse(world.getDynamicProperty(key) ?? "null");
const types = (p) => p.container.items().map((i) => i.typeId);

test("แขวน: ถือโปสการ์ดแตะบอร์ดว่าง ภาพขึ้นตาม state ข้อมูลลง world DP และไอเท็มหมดมือ", () => {
  const p = mock.player({ name: "Somchai" });
  const block = newBoard();
  hold(p, create(REC));
  tap(block, p);
  assert.equal(card(block), 6);
  assert.equal(block.permutation.getState("bpc:foil"), false);
  assert.equal(block.permutation.getState("minecraft:cardinal_direction"), "north"); // ทิศไม่เปลี่ยน
  assert.deepEqual(pinned(), { r: REC, by: "Somchai", id: p.id });
  assert.deepEqual(types(p), []);
  assert.equal(pinKey(OVERWORLD, block.location), KEY);
});

test("ถอด: มือเปล่าแตะบอร์ดที่มีการ์ด ได้ใบเดิมคืนและไม่มี DP ค้าง", () => {
  const p = mock.player();
  const block = newBoard();
  const named = create({ ...REC, foil: true, st: "moon" });
  named.nameTag = "Our trip";
  hold(p, named);
  tap(block, p);
  assert.equal(block.permutation.getState("bpc:foil"), true);
  hold(p, new ItemStack("minecraft:stick")); // ถือของอื่น: ไม่ถอด
  tap(block, p);
  assert.equal(card(block), 6);
  hold(p, undefined);
  tap(block, p);
  assert.equal(card(block), 0);
  assert.equal(block.permutation.getState("bpc:foil"), false);
  assert.equal(pinned(), null);
  assert.deepEqual(types(p), ["bpc:postcard_cherry_grove_foil"]);
  assert.deepEqual(toRecord(p.container.items()[0]), { ...REC, foil: true, st: "moon", nm: "Our trip" });
  assert.equal(p.container.items()[0].nameTag, "Our trip");
});

test("มือเปล่าหรือถือของอื่นแตะบอร์ดว่าง: ไม่มีอะไรเกิด", () => {
  const p = mock.player();
  const block = newBoard();
  tap(block, p);
  hold(p, new ItemStack("minecraft:stick"));
  tap(block, p);
  tap(block, undefined);
  assert.equal(card(block), 0);
  assert.equal(pinned(), null);
  assert.deepEqual(types(p), ["minecraft:stick"]);
});

test("โปสการ์ดจาก /give ไม่มีข้อมูล: แขวนและถอดได้ lore บอกว่าไม่ทราบที่มา", () => {
  const p = mock.player();
  const block = newBoard();
  hold(p, new ItemStack("bpc:postcard_deep_dark"));
  tap(block, p);
  assert.equal(card(block), 27);
  tap(block, p);
  assert.deepEqual(keysOf(p.container.items()[0].lore), ["bpc.lore.unknown", "bpc.lore.rarity.rare"]);
});

test("บอร์ดยึด state เป็นหลัก: DP กำพร้าถูกล้าง และบอร์ดที่วางด้วยคำสั่งยังถอดการ์ดได้", () => {
  const p = mock.player();
  const empty = newBoard();
  world.setDynamicProperty(KEY, JSON.stringify({ r: REC, by: "X", id: "x" }));
  tap(empty, p); // บอร์ดว่างแต่มี DP ค้าง
  assert.equal(pinned(), null);
  assert.deepEqual(types(p), []);

  const byCommand = newBoard({ "bpc:slot": 6 }, 5); // /setblock พร้อม state ไม่มี DP
  tap(byCommand, p);
  assert.deepEqual(types(p), ["bpc:postcard_cherry_grove"]);
  assert.deepEqual(toRecord(p.container.items()[0]), { card: "cherry_grove" });

  const mismatch = newBoard({ "bpc:slot": 1 }, 9); // DP เป็นการ์ดอื่น: ทิ้งรายละเอียดที่ไม่ตรง
  world.setDynamicProperty("bpc:pin:o:9,2,3", JSON.stringify({ r: REC, by: "X", id: "x" }));
  hold(p, undefined);
  tap(mismatch, p);
  assert.deepEqual(toRecord(p.container.items()[0]), { card: "plains" });
  assert.equal(pinned("bpc:pin:o:9,2,3"), null);
});

test("บอร์ดแตกทุกสาเหตุ: โปสการ์ดดรอปคืน ไม่มี DP ค้าง", () => {
  const p = mock.player();
  const block = newBoard();
  hold(p, create(REC));
  tap(block, p);
  smash(block);
  const drops = block.dimension.drops;
  assert.equal(drops.length, 1);
  assert.deepEqual(toRecord(drops[0].item), REC);
  assert.deepEqual(drops[0].location, { x: 1.5, y: 2.5, z: 3.5 });
  assert.equal(pinned(), null);
  smash(newBoard({}, 20)); // บอร์ดว่างแตก: ไม่มีอะไรดรอป
  assert.equal(drops.length, 1);
});

test("ownerLock: คนอื่นถอดหรือทุบไม่ได้ เจ้าของทำได้ และปิดล็อกแล้วเป็นของส่วนกลาง", () => {
  const owner = mock.player({ name: "Somchai" });
  const other = mock.player({ name: "Malee" });
  const block = newBoard();
  hold(owner, create(REC));
  tap(block, owner);

  const tryBreak = (player) => {
    const e = { block, dimension: block.dimension, player, cancel: false };
    guardBreak(e);
    return e.cancel;
  };
  assert.equal(tryBreak(other), false); // ค่าเริ่มต้น: ไม่ล็อก
  saveSettings(world, { ownerLock: true });
  tap(block, other);
  assert.equal(card(block), 6);
  assert.deepEqual(types(other), []);
  assert.deepEqual(keysOf(other.actionBars), ["bpc.msg.board_locked"]);
  assert.deepEqual(other.actionBars[0].rawtext[0].with, ["Somchai"]);
  assert.equal(tryBreak(other), true);
  assert.equal(other.actionBars.length, 2);
  assert.equal(tryBreak(owner), false);
  assert.equal(tryBreak({ ...other, id: other.id }) && card(block) === 6, true);
  guardBreak({ block: mock.block(OVERWORLD, 50, 2, 3, "minecraft:stone"), dimension: block.dimension, player: other, cancel: false });

  tap(block, owner);
  assert.deepEqual(types(owner), ["bpc:postcard_cherry_grove"]);
  saveSettings(world, { ownerLock: false });
  hold(owner, create(REC));
  tap(block, owner);
  hold(owner, undefined);
  tap(block, other); // ปิดล็อก: ใครก็ถอดได้เหมือนกรอบไอเท็ม
  assert.deepEqual(types(other), ["bpc:postcard_cherry_grove"]);
});

test("ownerLock: บอร์ดแตกด้วยมือคนอื่นหรือระเบิด โปสการ์ดกลับไปหาเจ้าของ ไม่ดรอปให้คนอื่นเก็บ", () => {
  saveSettings(world, { ownerLock: true });
  const owner = mock.player({ name: "Somchai" });
  const other = mock.player({ name: "Malee" });
  const pin = (x) => {
    const block = newBoard({}, x);
    hold(owner, create({ ...REC, d: x }));
    tap(block, owner);
    hold(owner, undefined);
    return block;
  };
  const drops = world.getDimension(OVERWORLD).drops;

  smash(pin(1), other); // เจ้าของออนไลน์: เข้ากระเป๋าเจ้าของ
  assert.equal(drops.length, 0);
  assert.deepEqual(owner.container.items().map((i) => toRecord(i).d), [1]);

  smash(pin(2), owner); // เจ้าของทุบเอง: ดรอปตามปกติ
  assert.equal(drops.length, 1);

  owner.isValid = false; // เจ้าของออฟไลน์: เก็บไว้ให้
  owner.container.setItem(0, undefined);
  const b3 = pin(3);
  const b4 = pin(4);
  smash(b3); // ระเบิด ไม่มีผู้กระทำ
  smash(b4, other);
  assert.equal(drops.length, 1);
  assert.equal(JSON.parse(world.getDynamicProperty(`bpc:ret:${owner.id}`)).length, 2);
  assert.deepEqual(listPins(), []);

  owner.isValid = true; // เจ้าของกลับเข้าโลก
  assert.equal(deliverReturns(owner), 2);
  assert.deepEqual(owner.container.items().map((i) => toRecord(i).d).sort(), [3, 4]);
  assert.equal(world.getDynamicProperty(`bpc:ret:${owner.id}`), undefined);
  assert.equal(deliverReturns(owner), 0);
});

test("มิติจากแอดออนอื่นใช้คีย์แยก และ /bpc:pinsclean ล้างเฉพาะ DP ที่บอร์ดหายไปแล้ว", () => {
  const p = mock.player();
  const moon = newBoard({}, 1, "other:moon");
  hold(p, create(REC));
  tap(moon, p);
  assert.deepEqual(listPins(), ["bpc:pin:other:moon:1,2,3"]);

  const kept = newBoard({}, 7);
  hold(p, create(REC));
  tap(kept, p);
  world.setDynamicProperty("bpc:pin:o:100,2,3", JSON.stringify({ r: REC })); // chunk ไม่โหลด: ข้าม
  mock.block(OVERWORLD, 200, 2, 3, "minecraft:stone"); // บอร์ดถูก /fill ทับ
  world.setDynamicProperty("bpc:pin:o:200,2,3", JSON.stringify({ r: REC }));
  newBoard({}, 300); // บอร์ดว่างแต่ DP ค้าง
  world.setDynamicProperty("bpc:pin:o:300,2,3", JSON.stringify({ r: REC }));
  assert.deepEqual(cleanPins(), { removed: 2, skipped: 1 });
  assert.deepEqual(listPins().sort(), ["bpc:pin:o:100,2,3", "bpc:pin:o:7,2,3", "bpc:pin:other:moon:1,2,3"]);
});
