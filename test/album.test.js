// อัลบั้ม (ข้อมูล + หน้าจอ), แผงขายของที่ระลึก, ฟอร์มตั้งค่า และคำสั่ง
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { BiomeTypes, CustomCommandStatus, ItemStack, mock, world } from "@minecraft/server";
import { keysOf, press, pressIndex, ui } from "@minecraft/server-ui";
import { ALBUM_LIMIT, loadSettings, settings } from "../BP/scripts/config.js";
import { registerCommands } from "../BP/scripts/dev/commands.js";
import { MAIN_TOTAL } from "../BP/scripts/registry/biomeRegistry.js";
import { CARDS, SOUVENIRS } from "../BP/scripts/registry/cards.generated.js";
import * as album from "../BP/scripts/systems/album.js";
import * as store from "../BP/scripts/systems/collectionStore.js";
import * as discovery from "../BP/scripts/systems/discovery.js";
import * as notify from "../BP/scripts/systems/notify.js";
import { PACE } from "../BP/scripts/systems/notify.js";
import { create, toRecord } from "../BP/scripts/systems/postcardFactory.js";
import { buy, openShop, registerSouvenirComponent } from "../BP/scripts/systems/souvenir.js";
import { onItemUse } from "../BP/scripts/systems/itemUse.js";
import { openAlbum } from "../BP/scripts/ui/albumForms.js";
import { resetSessions } from "../BP/scripts/ui/forms.js";
import { openSettings } from "../BP/scripts/ui/settingsForm.js";
import { THEMES } from "../BP/scripts/util/toastCode.js";
import { readFileSync } from "node:fs";

const flush = () => new Promise((r) => setTimeout(r, 0));
const REC = { card: "cherry_grove", d: 12, x: -880, z: 1302, dim: "o", by: "Somchai" };

beforeEach(() => {
  mock.reset();
  ui.reset();
  store.unloadAll();
  discovery.resetState();
  notify.resetState();
  resetSessions();
  discovery.setClock(() => new Date(Date.UTC(2026, 10, 10, 12)));
  loadSettings(world);
  store.migrateWorld();
});

const types = (p) => p.container.items().map((i) => i.typeId);
const postcardCount = (p) => types(p).filter((t) => t.startsWith("bpc:postcard_")).length;
const stored = (p) => JSON.parse(p.getDynamicProperty("bpc:album") ?? '{"items":[]}').items;
let step = 0;
/** ย้ายผู้เล่นไปไบโอมทีละแห่ง (ไกลพอให้ลูปค้นพบเช็คใหม่ทุกครั้ง) */
function discover(p, ...biomes) {
  for (const biome of biomes) {
    step += 100;
    p.moveTo(1000 + step, 64, 0);
    p.dimension.biome = () => biome;
    discovery.checkPlayer(p);
  }
}

// ---------- ข้อมูล ----------
test("ฝากทั้งหมด: ไอเท็มออกจากกระเป๋า record เข้าอัลบั้มครบทุกฟิลด์", () => {
  const p = mock.player();
  const named = create({ ...REC, card: "plains", st: "storm", foil: true });
  named.nameTag = "Trip with Mom";
  for (const item of [create(REC), named, new ItemStack("bpc:postcard_mystery"), new ItemStack("minecraft:stick", 3)]) p.container.addItem(item);
  assert.deepEqual(album.depositAll(p), { code: "ok", count: 3 });
  assert.deepEqual(types(p), ["minecraft:stick"]);
  assert.deepEqual(stored(p), [REC, { ...REC, card: "plains", st: "storm", foil: true, nm: "Trip with Mom" }, { card: "mystery" }]);
  assert.deepEqual(album.depositAll(p), { code: "none", count: 0 });
});

test("อัลบั้มเต็ม 64 ใบ: ไม่รับเพิ่ม และฝากได้บางส่วนเมื่อเหลือที่ไม่พอ", () => {
  const p = mock.player();
  store.saveAlbum(p, Array.from({ length: ALBUM_LIMIT - 2 }, () => ({ card: "plains" })));
  for (let i = 0; i < 3; i++) p.container.addItem(create({ card: "forest", d: i }));
  assert.deepEqual(album.depositAll(p), { code: "partial", count: 2 });
  assert.equal(stored(p).length, ALBUM_LIMIT);
  assert.equal(postcardCount(p), 1);
  assert.deepEqual(album.depositAll(p), { code: "full", count: 0 });
  assert.equal(postcardCount(p), 1);
  assert.ok(p.getDynamicProperty("bpc:album").length < 32767);
});

test("ถอน: ได้ไอเท็มคืนพร้อมข้อมูลเดิม และจำนวนโปสการ์ดรวมไม่เปลี่ยน", () => {
  const p = mock.player();
  p.container.addItem(create(REC));
  p.container.addItem(create({ card: "plains", d: 1, x: 2, z: 3 }));
  album.depositAll(p);
  const list = store.album(p);
  assert.equal(album.withdraw(p, 0, JSON.stringify(list[0])), "ok");
  assert.equal(postcardCount(p) + stored(p).length, 2);
  assert.deepEqual(toRecord(p.container.items()[0]), REC);
  assert.deepEqual(keysOf(p.container.items()[0].lore), ["bpc.lore.found", "bpc.lore.by", "bpc.lore.rarity.uncommon"]);
  assert.deepEqual(stored(p), [{ card: "plains", d: 1, x: 2, z: 3 }]);
});

test("ถอน: กระเป๋าเต็มหรือรายการเปลี่ยนระหว่างฟอร์มเปิด ต้องไม่แตะข้อมูล", () => {
  const p = mock.player();
  store.saveAlbum(p, [REC, { card: "plains" }]);
  const before = p.getDynamicProperty("bpc:album");
  p.container.fill();
  assert.equal(album.withdraw(p, 0, JSON.stringify(REC)), "full");
  assert.equal(album.withdraw(p, 1, JSON.stringify(REC)), "changed"); // ช่องนี้ไม่ใช่ใบที่ผู้เล่นเห็นแล้ว
  assert.equal(album.withdraw(p, 5, JSON.stringify(REC)), "changed");
  assert.equal(p.getDynamicProperty("bpc:album"), before);
  assert.equal(postcardCount(p), 0);
});

test("ฝาก: บันทึกไม่สำเร็จต้องคืนไอเท็ม ไม่เกิดของหายหรือของซ้ำ", () => {
  const p = mock.player();
  p.container.addItem(create(REC));
  store.album(p); // โหลดก่อน แล้วจำลองการเขียนล้ม
  p.failWrites = true;
  assert.equal(album.depositAll(p).code, "error");
  p.failWrites = false;
  assert.equal(postcardCount(p), 1);
  assert.deepEqual(toRecord(p.container.items()[0]), REC);
  assert.equal(store.album(p).length, 0);
});

test("สำเนา: ใช้การ์ดเปล่า 1 ใบ ได้ใบสำเนาที่ไม่นับเป็นการค้นพบ และไม่เป็นฟอยล์", () => {
  const p = mock.player({ name: "Somchai" });
  world.timeOfDay = 14000;
  discover(p, "minecraft:plains", "bod:redwood"); // plains ได้เป็นฟอยล์
  const before = p.getDynamicProperty("bpc:col");
  assert.equal(album.makeCopy(p, "plains"), "need_blank");
  p.container.addItem(new ItemStack("bpc:blank_postcard", 2));
  assert.equal(album.makeCopy(p, "plains"), "ok");
  assert.equal(album.makeCopy(p, "mystery:bod:redwood"), "ok");
  assert.equal(album.makeCopy(p, "plains"), "need_blank");
  assert.equal(album.makeCopy(p, "forest"), "changed"); // ยังไม่ได้ค้นพบ
  assert.ok(!types(p).includes("bpc:blank_postcard"));
  const copies = p.container.items().map(toRecord).filter((r) => r && r.kind === "copy");
  assert.equal(copies.length, 2);
  const plainsCopy = copies.find((r) => r.card === "plains");
  assert.deepEqual({ foil: plainsCopy.foil, by: plainsCopy.by, from: plainsCopy.from, d: plainsCopy.d }, { foil: undefined, by: "Somchai", from: "Somchai", d: 0 });
  assert.equal(copies.find((r) => r.card === "mystery").bio, "bod:redwood");
  assert.ok(keysOf(p.container.items().find((i) => toRecord(i)?.kind === "copy").lore).includes("bpc.lore.copy"));
  assert.equal(p.getDynamicProperty("bpc:col"), before);

  const friend = mock.player({ name: "Malee" }); // ผู้รับถือสำเนา: ไม่มีความคืบหน้าเพิ่ม
  friend.container.addItem(p.container.items().find((i) => toRecord(i)?.kind === "copy"));
  assert.deepEqual(store.counts(friend), { main: 0, mystery: 0, bonus: 0, foil: 0 });
});

// ---------- ช่องของการ์ดและซองท้ายเล่ม ----------
test("เก็บคืน: ใบต้นฉบับกลับเข้าช่องพร้อมชื่อจากทั่ง ส่วนสำเนา ใบของเพื่อน ใบจาก /give และใบซ้ำเข้าซองท้ายเล่ม", () => {
  const p = mock.player({ name: "Somchai" });
  discover(p, "minecraft:plains", "minecraft:forest", "bod:redwood");
  for (const key of ["plains", "forest", "mystery:bod:redwood"]) assert.equal(album.takeOut(p, key), "ok");
  assert.deepEqual(album.slotsIn(p), []);
  p.container.items().find((i) => i.typeId === "bpc:postcard_plains").nameTag = "Home"; // ตั้งชื่อบนทั่ง
  const friend = { card: "forest", d: 3, x: 9, z: 9, dim: "o", by: "Malee" }; // ใบต้นฉบับของเพื่อน คนละการค้นพบ
  p.container.addItem(new ItemStack("bpc:blank_postcard", 1));
  assert.equal(album.makeCopy(p, "plains"), "ok"); // สำเนาของการ์ดที่ช่องว่างอยู่
  for (const item of [create(friend), new ItemStack("bpc:postcard_plains"), new ItemStack("bpc:postcard_mystery")]) p.container.addItem(item);

  assert.deepEqual(album.depositAll(p), { code: "ok", count: 7 });
  assert.equal(postcardCount(p), 0);
  assert.deepEqual(album.slotsIn(p), ["plains", "forest", "mystery:bod:redwood"]);
  const saved = JSON.parse(p.getDynamicProperty("bpc:col")).cards;
  assert.equal(saved.plains.nm, "Home");
  assert.ok(Object.values(saved).every((r) => r.out === undefined));
  // ซองท้ายเล่ม: ข้อมูลบนใบไม่เปลี่ยน
  assert.deepEqual(stored(p).map((r) => [r.card, r.kind ?? r.by ?? "-"]), [["plains", "copy"], ["forest", "Malee"], ["plains", "-"], ["mystery", "-"]]);
  assert.deepEqual(stored(p)[1], friend);

  // หยิบออกอีกครั้ง: ชื่อจากทั่งไปกับไอเท็ม และไม่ค้างในช่อง
  assert.equal(album.takeOut(p, "plains"), "ok");
  const again = p.container.items().find((i) => i.typeId === "bpc:postcard_plains");
  assert.equal(again.nameTag, "Home");
  assert.equal(toRecord(again).by, "Somchai");
  assert.equal(JSON.parse(p.getDynamicProperty("bpc:col")).cards.plains.nm, undefined);

  // ช่องเต็มอยู่แล้ว: ใบต้นฉบับที่ถืออยู่อีกใบเข้าซองท้ายเล่ม ไม่ทับช่อง
  discover(p, "minecraft:plains"); // กลับไปไบโอมเดิม ช่องได้ใบใหม่
  assert.deepEqual(album.slotsIn(p), ["plains", "forest", "mystery:bod:redwood"]);
  assert.deepEqual(album.depositAll(p), { code: "ok", count: 1 });
  assert.equal(stored(p).at(-1).nm, "Home");
  assert.equal(stored(p).length, 5);
});

test("เก็บคืน: ใบฟอยล์กับใบปกติเป็นคนละใบ ใบปกติเก่าไม่กลับเข้าช่องที่กลายเป็นฟอยล์แล้ว", () => {
  const p = mock.player();
  discover(p, "minecraft:plains");
  assert.equal(album.takeOut(p, "plains"), "ok");
  world.timeOfDay = 14000;
  discover(p, "minecraft:plains"); // ได้ฟอยล์: ช่องกลับมาเต็มเป็นใบฟอยล์
  assert.equal(album.takeOut(p, "plains"), "ok");
  assert.deepEqual(types(p).filter((t) => t.startsWith("bpc:postcard_")), ["bpc:postcard_plains", "bpc:postcard_plains_foil"]);
  assert.deepEqual(album.depositAll(p), { code: "ok", count: 2 });
  assert.deepEqual(album.slotsIn(p), ["plains"]);
  assert.deepEqual(stored(p).map((r) => [r.card, Boolean(r.foil)]), [["plains", false]]);
});

test("เก็บคืน: บันทึกช่องไม่สำเร็จคืนไอเท็ม และซองท้ายเล่มเต็มแล้วใบต้นฉบับยังกลับเข้าช่องได้", () => {
  const p = mock.player({ name: "Somchai" });
  discover(p, "minecraft:plains");
  assert.equal(album.takeOut(p, "plains"), "ok");
  p.failWrites = true;
  assert.deepEqual(album.depositAll(p), { code: "error", count: 0 });
  p.failWrites = false;
  assert.equal(postcardCount(p), 1);
  assert.deepEqual(album.slotsIn(p), []);
  assert.equal(toRecord(p.container.items().find((i) => i.typeId === "bpc:postcard_plains")).by, "Somchai");

  store.saveAlbum(p, Array.from({ length: ALBUM_LIMIT }, () => ({ card: "forest" })));
  p.container.addItem(create(REC)); // ใบของคนอื่น: ไม่มีที่ในซองท้ายเล่ม
  assert.deepEqual(album.depositAll(p), { code: "partial", count: 1 });
  assert.deepEqual(album.slotsIn(p), ["plains"]);
  assert.deepEqual(types(p).filter((t) => t.startsWith("bpc:postcard_")), ["bpc:postcard_cherry_grove"]);
  assert.deepEqual(album.depositAll(p), { code: "full", count: 0 });
});

// ---------- หน้าจอ ----------
test("หน้าจอ: ใช้อัลบั้ม → หน้าแรก → คอลเลกชัน → รายละเอียด → กลับ โดยข้อมูลไม่เปลี่ยน", async () => {
  const p = mock.player({ name: "Somchai" });
  discover(p, "minecraft:plains", "bod:redwood");
  const before = [p.getDynamicProperty("bpc:col"), types(p).join()];
  ui.queue.push(press("bpc.ui.album.view"), pressIndex(0), press("bpc.ui.back"), press("bpc.ui.next"), press("bpc.ui.back"));
  onItemUse({ source: p, itemStack: new ItemStack("bpc:album", 1) });
  await flush();
  const [home, list, detail, list2, list3, home2] = ui.shown;
  assert.equal(ui.shown.length, 6);
  assert.deepEqual(keysOf(home.title), ["bpc.ui.album.title"]);
  assert.deepEqual(keysOf(home.body), ["bpc.ui.album.owner", "bpc.ui.album.body", "bpc.ui.album.body2"]);
  assert.deepEqual(home.body.rawtext[0].with, ["Somchai"]); // อัลบั้มเปิดข้อมูลของคนที่เปิด
  assert.deepEqual(home.body.rawtext[2].with, ["1", String(MAIN_TOTAL)]);
  assert.equal(home.buttons.length, 5);
  assert.ok(home.buttons.every((b) => b.icon && keysOf(b.text).length === 1));
  // คอลเลกชัน: หน้าละ 8 ปุ่ม + นำทาง 3 ปุ่มท้ายรายการ, การ์ดที่ยังไม่ได้เป็น ??? พร้อมไอคอนล็อก
  assert.deepEqual(list.title.rawtext[0].with, ["1", "4"]);
  assert.equal(list.buttons.length, 11);
  assert.deepEqual(keysOf(list.buttons[0].text), ["bpc.card.plains"]);
  assert.equal(list.buttons[0].icon, "textures/items/postcards/plains");
  assert.deepEqual(keysOf(list.buttons[1].text), ["bpc.ui.locked"]);
  assert.equal(list.buttons[1].icon, "textures/ui/bpc_lock");
  assert.deepEqual(list.buttons.slice(-3).map((b) => keysOf(b.text)[0]), ["bpc.ui.prev", "bpc.ui.next", "bpc.ui.back"]);
  assert.deepEqual(keysOf(detail.title), ["bpc.card.plains"]);
  assert.deepEqual(keysOf(detail.body), ["bpc.ui.detail.found", "bpc.ui.detail.pos", "bpc.rarity.common", "bpc.ui.detail.in_album"]);
  assert.deepEqual(detail.buttons.map((b) => keysOf(b.text)[0]), ["bpc.ui.detail.take", "bpc.ui.back"]);
  assert.deepEqual(list2.title.rawtext[0].with, ["1", "4"]); // กลับมาหน้าเดิม
  assert.deepEqual(list3.title.rawtext[0].with, ["2", "4"]);
  assert.deepEqual(keysOf(home2.title), ["bpc.ui.album.title"]);
  assert.deepEqual([p.getDynamicProperty("bpc:col"), types(p).join()], before);
});

test("หน้าจอ: การ์ดพิเศษที่ได้แล้วต่อท้ายคอลเลกชัน และ ??? กดแล้วไม่เปิดรายละเอียด", async () => {
  const p = mock.player();
  discover(p, "bod:redwood");
  // 31 การ์ดหลัก + 1 ลึกลับ = 32 รายการ = 4 หน้า หน้าสุดท้ายมี 8 ปุ่ม
  ui.queue.push(press("bpc.ui.album.view"), press("bpc.ui.prev"), pressIndex(7), press("bpc.ui.back"), pressIndex(0));
  await openAlbum(p);
  const last = ui.shown[2];
  assert.deepEqual(last.title.rawtext[0].with, ["4", "4"]);
  assert.deepEqual(keysOf(last.buttons[7].text), ["bpc.card.mystery"]);
  const detail = ui.shown[3];
  assert.deepEqual(keysOf(detail.title), ["bpc.card.mystery"]);
  assert.ok(detail.body.rawtext.some((part) => part.text === "bod:redwood"));
  assert.deepEqual(ui.shown[5].title.rawtext[0].with, ["4", "4"]); // กด ??? แล้วยังอยู่หน้าเดิม
  assert.equal(ui.shown.length, 6);
});

test("หน้าจอ: หยิบออกจากรายการ เก็บคืน และปิดกลางทาง", async () => {
  const p = mock.player();
  discover(p, "minecraft:plains", "minecraft:forest");
  store.saveAlbum(p, [REC]); // ซองท้ายเล่มมีใบของคนอื่น 1 ใบ
  const postcardsHeld = () => types(p).filter((t) => t.startsWith("bpc:postcard_"));
  ui.queue.push(press("bpc.ui.album.withdraw"), pressIndex(1), pressIndex(1)); // forest จากช่อง แล้วใบในซองท้ายเล่มที่เลื่อนขึ้นมา
  await openAlbum(p);
  assert.deepEqual(ui.shown[0].buttons[2].text.rawtext[0].with, ["3"]); // ปุ่มหยิบออกบอกจำนวนในอัลบั้ม (ช่อง 2 + ซอง 1)
  const list = ui.shown[1];
  assert.deepEqual(keysOf(list.body), ["bpc.ui.withdraw.body"]);
  assert.deepEqual(list.buttons.slice(0, 3).map((b) => keysOf(b.text)), [["bpc.card.plains"], ["bpc.card.forest"], ["bpc.card.cherry_grove", "bpc.ui.take.pocket"]]);
  assert.deepEqual(postcardsHeld(), ["bpc:postcard_forest", "bpc:postcard_cherry_grove"]);
  assert.deepEqual(album.slotsIn(p), ["plains"]);
  assert.equal(stored(p).length, 0);
  assert.deepEqual(toRecord(p.container.items().find((i) => i.typeId === "bpc:postcard_cherry_grove")), REC);

  // คอลเลกชันบอกว่าช่องไหนหยิบออกแล้ว และหน้ารายละเอียดของช่องนั้นไม่มีปุ่มหยิบออก
  ui.reset();
  ui.queue.push(press("bpc.ui.album.view"), pressIndex(1), press("bpc.ui.back"), pressIndex(0), press("bpc.ui.detail.take"));
  await openAlbum(p);
  assert.deepEqual(keysOf(ui.shown[1].buttons[1].text), ["bpc.card.forest", "bpc.ui.collection.out"]);
  assert.deepEqual(keysOf(ui.shown[1].buttons[0].text), ["bpc.card.plains"]);
  assert.ok(keysOf(ui.shown[2].body).includes("bpc.ui.detail.out"));
  assert.deepEqual(ui.shown[2].buttons.map((b) => keysOf(b.text)[0]), ["bpc.ui.back"]);
  assert.deepEqual(postcardsHeld(), ["bpc:postcard_forest", "bpc:postcard_cherry_grove", "bpc:postcard_plains"]); // หยิบ plains จากหน้ารายละเอียด
  assert.deepEqual(keysOf(ui.shown[5].buttons[0].text), ["bpc.card.plains", "bpc.ui.collection.out"]); // กลับมาที่รายการ
  assert.deepEqual(store.counts(p), { main: 2, mystery: 0, bonus: 0, foil: 0 });

  // เก็บคืนทั้งหมด: ใบของเรากลับเข้าช่อง ใบของคนอื่นกลับเข้าซองท้ายเล่ม
  ui.reset();
  ui.queue.push(press("bpc.ui.album.deposit"));
  await openAlbum(p);
  assert.deepEqual(ui.shown[0].buttons[1].text.rawtext[0].with, ["3"]); // ปุ่มเก็บบอกจำนวนในกระเป๋า
  assert.deepEqual(postcardsHeld(), []);
  assert.deepEqual(album.slotsIn(p), ["plains", "forest"]);
  assert.deepEqual(stored(p), [REC]);
  assert.ok(keysOf(p.actionBars).includes("bpc.msg.deposited"));

  ui.reset();
  const snapshot = [p.getDynamicProperty("bpc:col"), p.getDynamicProperty("bpc:album"), types(p).join()];
  await openAlbum(p); // ปิดทันที
  ui.queue.push(press("bpc.ui.album.withdraw"));
  await openAlbum(p); // ปิดที่หน้าหยิบออก
  ui.queue.push(press("bpc.ui.album.view"), pressIndex(0));
  await openAlbum(p); // ปิดที่หน้ารายละเอียด
  assert.deepEqual([p.getDynamicProperty("bpc:col"), p.getDynamicProperty("bpc:album"), types(p).join()], snapshot);
});

test("หน้าจอ: การ์ดเทศกาลที่หยิบออกบอกว่าได้ใบใหม่ในช่วงเทศกาล และกระเป๋าเต็มหยิบจากหน้ารายละเอียดไม่ได้", async () => {
  const p = mock.player();
  discovery.setClock(() => new Date(Date.UTC(2026, 9, 31, 12)));
  discover(p, "minecraft:plains"); // ช่วงฮาโลวีน: ได้การ์ดเทศกาลก่อน
  assert.ok(store.has(p, "fest_halloween"));
  p.container.fill();
  ui.queue.push(press("bpc.ui.album.view"), press("bpc.ui.prev"), pressIndex(7), press("bpc.ui.detail.take"));
  await openAlbum(p);
  assert.deepEqual(keysOf(p.actionBars).filter((k) => k === "bpc.msg.withdraw_full"), ["bpc.msg.withdraw_full"]);
  assert.deepEqual(album.slotsIn(p), ["fest_halloween"]);
  p.container.setItem(0, undefined);
  assert.equal(album.takeOut(p, "fest_halloween"), "ok");
  ui.reset();
  ui.queue.push(press("bpc.ui.album.view"), press("bpc.ui.prev"), pressIndex(7));
  await openAlbum(p);
  assert.ok(keysOf(ui.shown[3].body).includes("bpc.ui.detail.out_festival"));
});

test("หน้าจอ: ถอนตอนกระเป๋าเต็มแจ้งเหตุผล และฟอร์มที่ผู้เล่นยังไม่ว่างจะลองใหม่", async () => {
  const p = mock.player();
  store.saveAlbum(p, [REC]);
  p.container.fill();
  ui.queue.push({ canceled: true, cancelationReason: "UserBusy" }, press("bpc.ui.album.withdraw"), pressIndex(0));
  await openAlbum(p);
  assert.equal(ui.shown.length, 4);
  assert.deepEqual(keysOf(p.actionBars), ["bpc.msg.withdraw_full"]);
  assert.equal(stored(p).length, 1);
});

test("หน้าจอ: ทำสำเนาต้องยืนยัน ยกเลิกแล้วไม่เสียการ์ดเปล่า", async () => {
  const p = mock.player();
  discover(p, "minecraft:plains");
  p.container.addItem(new ItemStack("bpc:blank_postcard", 1));
  ui.queue.push(press("bpc.ui.album.copy"), pressIndex(0), press("bpc.ui.cancel"), pressIndex(0), press("bpc.ui.copy.yes"));
  await openAlbum(p);
  const confirm = ui.shown[2];
  assert.equal(confirm.kind, "message");
  assert.deepEqual(keysOf(confirm.body), ["bpc.ui.copy.confirm"]);
  assert.ok(!types(p).includes("bpc:blank_postcard"));
  assert.equal(p.container.items().map(toRecord).filter((r) => r && r.kind === "copy").length, 1);
  assert.ok(keysOf(p.actionBars).includes("bpc.msg.copy_made"));
});

test("หน้าจอ: ชุดสะสมแสดงความคืบหน้าครบ 7 ชุด", async () => {
  const p = mock.player();
  discover(p, "minecraft:desert", "minecraft:savanna", "minecraft:mesa", "minecraft:plains");
  ui.queue.push(press("bpc.ui.album.sets"));
  await openAlbum(p);
  const sets = ui.shown[1];
  const rows = sets.body.rawtext.filter((part) => part.translate);
  assert.equal(rows.length, 7);
  assert.equal(rows.filter((r) => r.translate === "bpc.ui.sets.done").length, 1);
  const fields = rows.find((r) => keysOf(r).includes("bpc.set.fields"));
  assert.deepEqual(fields.with.rawtext.slice(1), [{ text: "1" }, { text: "7" }]);
});

// ---------- แผงขายของที่ระลึก ----------
test("ของที่ระลึก: ปลดล็อกตามจำนวนการ์ด จ่ายด้วยมรกต", async () => {
  const p = mock.player();
  const first = SOUVENIRS[0];
  assert.equal(buy(p, first), "locked");
  discover(p, "minecraft:plains", "minecraft:forest", "minecraft:desert", "minecraft:savanna", "minecraft:mesa");
  assert.equal(buy(p, first), "need_emeralds");
  p.container.addItem(new ItemStack("minecraft:emerald", 10));
  const reg = mock.registry();
  registerSouvenirComponent(reg);
  ui.queue.push(pressIndex(0), pressIndex(1), press("bpc.ui.back"));
  reg.components.get("bpc:souvenir_stand").onPlayerInteract({ player: p });
  await flush();
  const shop = ui.shown[0];
  assert.equal(shop.buttons.length, SOUVENIRS.length + 1);
  assert.deepEqual(keysOf(shop.buttons[0].text), [`tile.${first.id}.name`, "bpc.ui.shop.price"]);
  assert.deepEqual(keysOf(shop.buttons[1].text), ["bpc.ui.locked", "bpc.ui.shop.locked"]);
  assert.equal(shop.buttons[1].icon, "textures/ui/bpc_lock");
  const amountOf = (typeId) => p.container.items().filter((i) => i.typeId === typeId).reduce((n, i) => n + i.amount, 0);
  assert.equal(amountOf(first.id), 1); // ซื้อชิ้นแรกได้ ชิ้นที่ล็อกซื้อไม่ได้
  assert.equal(amountOf("minecraft:emerald"), 10 - first.price);
  assert.ok(keysOf(p.actionBars).includes("bpc.msg.bought"));
  p.container.addItem(new ItemStack("minecraft:emerald", 1));
  ui.reset();
  ui.queue.push(pressIndex(0), pressIndex(0));
  await openShop(p); // เหลือ 7 เม็ด: ซื้อได้อีก 1 ชิ้น (4 เม็ด) แล้วไม่พอ
  assert.equal(amountOf(first.id), 2);
  assert.equal(amountOf("minecraft:emerald"), 11 - 2 * first.price);
  assert.ok(keysOf(p.actionBars).includes("bpc.msg.need_emeralds"));
});

// ---------- ตั้งค่าและคำสั่ง ----------
test("ตั้งค่า: ฟอร์มแสดงค่าปัจจุบัน บันทึกลง world DP และปิดฟอร์มแล้วไม่เปลี่ยน", async () => {
  const p = mock.player();
  await openSettings(p); // ปิดทันที
  assert.equal(world.getDynamicProperty("bpc:cfg"), undefined);
  ui.queue.push({ canceled: false, formValues: [false, true, false, true, true, false] });
  await openSettings(p);
  assert.deepEqual(ui.shown[1].toggles.map((t) => t.options.defaultValue), [true, true, true, true, false, true]);
  assert.deepEqual(settings(), { creative: false, mystery: true, seasonal: false, foil: true, ownerLock: true, toast: false });
  loadSettings(world); // โหลดโลกใหม่: ค่าต้องอยู่
  assert.equal(settings().ownerLock, true);
  assert.deepEqual(keysOf(p.actionBars), ["bpc.msg.settings_saved"]);
});

test("คำสั่ง: ลงทะเบียนครบ และรันได้โดยไม่ throw", () => {
  BiomeTypes.ids = JSON.parse(readFileSync(new URL("./fixtures/game-biomes.json", import.meta.url), "utf8")).stable;
  const reg = mock.registry();
  registerCommands(reg);
  assert.deepEqual([...reg.commands.keys()].sort(), ["bpc:biomes", "bpc:config", "bpc:debug", "bpc:demo", "bpc:giveall", "bpc:here", "bpc:open", "bpc:pins", "bpc:pinsclean", "bpc:reset", "bpc:selftest", "bpc:settings", "bpc:takeall", "bpc:toast"]);
  assert.equal(reg.commands.get("bpc:settings").def.cheatsRequired, false);
  assert.equal(reg.commands.get("bpc:config").def.cheatsRequired, false);
  assert.deepEqual(reg.enums.get("bpc:setting"), ["creative", "mystery", "seasonal", "foil", "ownerLock", "toast"]);
  const p = mock.player();
  const run = (name, origin = { sourceEntity: p }, ...args) => reg.commands.get(`bpc:${name}`).callback(origin, ...args);
  // ตั้งค่าจากคอนโซลของเซิร์ฟเวอร์ (ไม่มีผู้เล่น)
  assert.equal(run("config", {}).message, "settings: creative=true, mystery=true, seasonal=true, foil=true, ownerLock=false, toast=true");
  assert.equal(run("config", {}, "ownerLock").message, "ownerLock=false");
  assert.equal(run("config", {}, "ownerLock", true).message, "ownerLock=true");
  assert.equal(settings().ownerLock, true);
  assert.equal(JSON.parse(world.getDynamicProperty("bpc:cfg")).ownerLock, true);
  assert.equal(run("config", {}, "nope", true).status, CustomCommandStatus.Failure);
  run("config", {}, "ownerLock", false);
  const biomes = run("biomes", {});
  assert.equal(biomes.status, CustomCommandStatus.Success);
  assert.equal(biomes.message, "biomes: game 89, with card 87, ignored 2\nexperimental, not in this world (1): minecraft:ice_caves");
  assert.equal(run("here").message, "minecraft:plains -> plains");
  assert.equal(run("here", {}).status, CustomCommandStatus.Failure);
  assert.equal(run("giveall").status, CustomCommandStatus.Success);
  assert.equal(p.container.items().length + p.dimension.drops.length, CARDS.length + 1);
  assert.equal(run("selftest").status, CustomCommandStatus.Success);
  assert.match(p.messages.at(-1), /selftest v[\d.]+: 9 passed, 0 failed/);
  discover(p, "minecraft:plains");
  // หยิบทุกใบออกจากอัลบั้ม: ช่องของการ์ดและซองท้ายเล่ม
  const q = mock.player({ name: "Q" });
  discover(q, "minecraft:plains", "minecraft:forest");
  store.saveAlbum(q, [REC]);
  assert.equal(run("takeall", { sourceEntity: q }).status, CustomCommandStatus.Success);
  assert.deepEqual(types(q).filter((t) => t.startsWith("bpc:postcard_")), ["bpc:postcard_plains", "bpc:postcard_forest", "bpc:postcard_cherry_grove"]);
  assert.deepEqual([album.slotsIn(q).length, store.album(q).length], [0, 0]);
  assert.equal(run("takeall", {}).status, CustomCommandStatus.Failure);
  assert.equal(run("reset").status, CustomCommandStatus.Success);
  assert.equal(p.getDynamicProperty("bpc:col"), undefined);
  assert.equal(store.has(p, "plains"), false);
  assert.match(run("debug").message, /debug on/);
  assert.equal(run("pins").message, "pins: 0");
  assert.equal(run("pinsclean").status, CustomCommandStatus.Success);
  assert.equal(run("settings").status, CustomCommandStatus.Success);
  // การ์ดแจ้งเตือนตัวอย่าง
  assert.equal(run("toast", { sourceEntity: p }, "forests").status, CustomCommandStatus.Success);
  assert.equal(run("toast", { sourceEntity: p }, "cherry_grove", true).status, CustomCommandStatus.Success);
  assert.equal(run("toast", {}, "forests").status, CustomCommandStatus.Failure);
  assert.equal(run("toast", { sourceEntity: p }, "nope").status, CustomCommandStatus.Failure);
  mock.advance(1000);
  const before = p.titles.length;
  assert.equal(run("demo").status, CustomCommandStatus.Success);
  mock.advance(2000);
  const demo = p.titles.slice(before);
  assert.equal(demo.length, 12); // 9 ธีมของการ์ด + อัลบั้ม + ครบชุด + ครบทุกชุด ไม่มีใบไหนถูกรวมหรือเร่ง
  assert.deepEqual(new Set(demo.map((t) => t.title.rawtext.at(-1).text.match(/§t§(\d)/)[1])).size, THEMES.length);
  assert.ok(demo.every((t) => t.options.stayDuration === PACE.normal.stayDuration));
});

test("ใช้ไอเท็ม: โปสการ์ดบอกวิธีใช้ทาง actionbar อัลบั้มเปิดหน้าจอ ไอเท็มอื่นและ event ที่ไม่มีผู้ใช้ไม่มีผล", async () => {
  const p = mock.player();
  onItemUse({ source: p, itemStack: new ItemStack("bpc:postcard_plains", 1) });
  onItemUse({ source: p, itemStack: new ItemStack("bpc:postcard_cherry_grove_foil", 1) });
  assert.deepEqual(keysOf(p.actionBars), ["bpc.msg.postcard_hint", "bpc.msg.postcard_hint"]);
  onItemUse({ source: p, itemStack: new ItemStack("bpc:blank_postcard", 1) });
  onItemUse({ source: p, itemStack: new ItemStack("minecraft:stick", 1) });
  onItemUse({ source: undefined, itemStack: new ItemStack("bpc:album", 1) });
  onItemUse({ source: p, itemStack: undefined });
  await flush();
  assert.equal(p.actionBars.length, 2);
  assert.equal(ui.shown.length, 0);
  onItemUse({ source: p, itemStack: new ItemStack("bpc:album", 1) });
  await flush();
  assert.equal(ui.shown.length, 1);
  assert.deepEqual(keysOf(ui.shown[0].title), ["bpc.ui.album.title"]);
});

test("ฟอร์ม: ใช้อัลบั้มซ้ำใน tick เดียวกันได้ฟอร์มเดียว และถ้าฟอร์มค้าง ใช้อีกครั้งจะปิดของเดิมแล้วเปิดใหม่", async () => {
  const p = mock.player();
  const use = () => onItemUse({ source: p, itemStack: new ItemStack("bpc:album", 1) });
  ui.queue.push(() => new Promise(() => {})); // ฟอร์มแรกค้าง: client ไม่ตอบกลับ
  use();
  use(); // event ยิงซ้ำ หรือกดค้าง
  await flush();
  assert.equal(ui.shown.length, 1);
  assert.equal(ui.closed.length, 0);
  mock.advance(10);
  use(); // ผู้เล่นกด Esc แล้วใช้อีกครั้ง
  await flush();
  assert.deepEqual(ui.closed, [p]);
  assert.equal(ui.shown.length, 2);
  mock.advance(10);
  use(); // ชุดก่อนจบแล้ว (ฟอร์มถูกปิด) เปิดได้ตามปกติ ไม่ต้องปิดอะไร
  await flush();
  assert.equal(ui.shown.length, 3);
  assert.equal(ui.closed.length, 1);
});
