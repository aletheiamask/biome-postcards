// อัลบั้ม: หยิบออก เก็บคืน และทำสำเนา (ส่วนข้อมูล หน้าจออยู่ที่ ui/albumForms.js)
// ข้อมูลอยู่บนผู้เล่น ไม่ได้อยู่ในเล่ม อัลบั้มทุกเล่มจึงเปิดข้อมูลชุดเดียวกัน
// อัลบั้มมี 2 ส่วน:
//   ช่องของการ์ด  = record การค้นพบใน bpc:col ใบละช่อง โปสการ์ดเข้าช่องเองตอนค้นพบ (out = หยิบออกไปแล้ว)
//   ซองท้ายเล่ม   = รายการใน bpc:album สำหรับใบอื่น เช่นสำเนา ของเพื่อน ใบซ้ำ (สูงสุด ALBUM_LIMIT)
// ฟอร์มทำงานแบบ async ทุกฟังก์ชันที่นี่จึงอ่านกระเป๋าและอัลบั้มใหม่ก่อนเขียนเสมอ
import { ItemStack } from "@minecraft/server";
import { ALBUM_LIMIT } from "../config.js";
import { MAIN, MYSTERY, MYSTERY_PREFIX, cardForKey } from "../registry/biomeRegistry.js";
import { containerOf, slotsWhere, takeItems } from "../util/inventory.js";
import { normalize, sameOrigin } from "../util/record.js";
import * as store from "./collectionStore.js";
import * as feedback from "./feedback.js";
import * as factory from "./postcardFactory.js";

export const ALBUM_ID = "bpc:album";
export const BLANK_ID = "bpc:blank_postcard";

/** โปสการ์ดใบแรก: ให้อัลบั้ม 1 เล่มที่ตายแล้วไม่หาย และสอนสั้น ๆ ครั้งเดียว */
export function giveFirst(player) {
  if (store.flags(player).album) return;
  if (!store.setFlags(player, { album: true })) return;
  const item = new ItemStack(ALBUM_ID, 1);
  item.keepOnDeath = true;
  factory.give(player, item);
  feedback.albumGiven(player);
}

export function inventoryPostcards(player) {
  const container = containerOf(player);
  return container ? slotsWhere(container, factory.isPostcard) : [];
}

/** คีย์ในคอลเลกชันของโปสการ์ดใบหนึ่ง (การ์ดลึกลับต้องรู้ biome id จึงจะมีคีย์) */
export function keyOf(rec) {
  if (MYSTERY && rec.card === MYSTERY.id) return rec.bio ? `${MYSTERY_PREFIX}${rec.bio}` : null;
  return rec.card;
}

/** record ของใบต้นฉบับในช่องของการ์ด key สร้างจากข้อมูลการค้นพบของผู้เล่น คืน null ถ้ายังไม่ได้ค้นพบ */
export function slotRecord(player, key) {
  const found = store.get(player, key);
  const card = cardForKey(key);
  if (!found || !card) return null;
  const where = found.yr !== undefined ? { yr: found.yr } : { d: found.d, x: found.x, z: found.z, dim: found.dim };
  const bio = key.startsWith(MYSTERY_PREFIX) ? key.slice(MYSTERY_PREFIX.length) : undefined;
  return normalize(Object.assign({ card: card.id, foil: found.foil, st: found.st, by: player.name, nm: found.nm, bio }, where));
}

const inSlot = (player, key) => {
  const found = store.get(player, key);
  return Boolean(found) && !found.out && Boolean(cardForKey(key));
};

/** คีย์ของช่องที่ยังมีโปสการ์ดอยู่ เรียงแบบหน้าคอลเลกชัน: การ์ดหลักตามลำดับ แล้วการ์ดพิเศษตามลำดับที่ได้ */
export function slotsIn(player) {
  const main = MAIN.map((card) => card.id).filter((key) => inSlot(player, key));
  const bonus = store.keys(player).filter((key) => cardForKey(key)?.bonus && inSlot(player, key));
  return main.concat(bonus);
}

/**
 * หยิบใบต้นฉบับออกจากช่องของการ์ด key ทำเครื่องหมายช่องว่างก่อนแล้วจึงให้ไอเท็ม ถ้าให้ไม่สำเร็จคืนช่อง
 * ความคืบหน้าไม่เปลี่ยน (นับจากการค้นพบ ไม่ได้นับจากใบที่อยู่ในช่อง)
 * @returns {"ok"|"full"|"changed"|"error"}
 */
export function takeOut(player, key) {
  const found = store.get(player, key);
  const rec = found && !found.out ? slotRecord(player, key) : null;
  if (!rec) return "changed";
  const container = containerOf(player);
  if (!container || container.emptySlotsCount < 1) return "full"; // กระเป๋าเต็ม: ปฏิเสธโดยไม่แตะข้อมูล
  if (!store.update(player, key, { out: true, nm: undefined })) return "error"; // ชื่อจากทั่งไปกับไอเท็ม
  if (container.addItem(factory.create(rec))) {
    store.update(player, key, { out: undefined, nm: found.nm });
    return "full";
  }
  return "ok";
}

/**
 * เก็บโปสการ์ดทั้งหมดในกระเป๋าเข้าอัลบั้ม ลบไอเท็มก่อนแล้วจึงบันทึก บันทึกไม่ได้คืนไอเท็ม
 * ใบต้นฉบับของผู้เล่นเอง (ข้อมูลตรงกับการค้นพบ) กลับเข้าช่องของการ์ดถ้าช่องว่างอยู่ ใบอื่นเข้าซองท้ายเล่มโดยข้อมูลไม่เปลี่ยน
 * @returns {{code: "none"|"full"|"ok"|"partial"|"error", count: number}}
 */
export function depositAll(player) {
  const container = containerOf(player);
  const found = inventoryPostcards(player);
  if (!container || !found.length) return { code: "none", count: 0 };
  const stored = store.album(player);
  let room = ALBUM_LIMIT - stored.length;
  const toSlot = new Map(); // key -> { slot, rec }
  const toPocket = []; // { slot, rec }
  let left = 0;
  for (const { slot, item } of found) {
    const rec = factory.toRecord(item);
    if (!rec) continue;
    const key = keyOf(rec);
    const mine = key && !toSlot.has(key) ? store.get(player, key) : undefined;
    if (mine && mine.out && sameOrigin(rec, slotRecord(player, key))) toSlot.set(key, { slot, rec });
    else if (room > 0) {
      toPocket.push({ slot, rec });
      room--;
    } else left++;
  }

  let count = 0;
  let failed = false;
  const giveBack = (entries) => {
    failed = true;
    for (const { rec } of entries) factory.give(player, factory.create(rec));
  };
  if (toSlot.size) {
    const entries = [...toSlot.values()];
    for (const { slot } of entries) container.setItem(slot, undefined);
    const patches = [...toSlot].map(([key, { rec }]) => [key, { out: undefined, nm: rec.nm }]);
    if (store.updateMany(player, patches)) count += entries.length;
    else giveBack(entries);
  }
  if (toPocket.length) {
    for (const { slot } of toPocket) container.setItem(slot, undefined);
    if (store.saveAlbum(player, stored.concat(toPocket.map((e) => e.rec)))) count += toPocket.length;
    else giveBack(toPocket);
  }
  if (!count) return { code: failed ? "error" : "full", count: 0 };
  return { code: failed || left ? "partial" : "ok", count };
}

/**
 * ถอนโปสการ์ดใบที่ index ออกจากซองท้ายเล่ม ลบ record ก่อนแล้วจึงให้ไอเท็ม ถ้าให้ไม่สำเร็จคืน record
 * expected = JSON ของ record ตอนที่ผู้เล่นเห็นในฟอร์ม ใช้กันรายการเลื่อนระหว่างฟอร์มเปิด
 * @returns {"ok"|"full"|"changed"|"error"}
 */
export function withdraw(player, index, expected) {
  const stored = store.album(player);
  const rec = stored[index];
  if (!rec || JSON.stringify(rec) !== expected) return "changed";
  const container = containerOf(player);
  if (!container || container.emptySlotsCount < 1) return "full"; // กระเป๋าเต็ม: ปฏิเสธโดยไม่แตะข้อมูล
  const rest = stored.slice(0, index).concat(stored.slice(index + 1));
  if (!store.saveAlbum(player, rest)) return "error";
  if (container.addItem(factory.create(rec))) {
    store.saveAlbum(player, stored);
    return "full";
  }
  return "ok";
}

/**
 * ทำสำเนาของการ์ดที่ผู้เล่นค้นพบแล้ว ใช้การ์ดเปล่า 1 ใบ สำเนาไม่นับเป็นการค้นพบของผู้รับ
 * ทำได้แม้ใบต้นฉบับถูกหยิบออกจากช่องไปแล้ว
 * @returns {"ok"|"need_blank"|"full"|"changed"}
 */
export function makeCopy(player, key) {
  const found = store.get(player, key);
  const card = cardForKey(key);
  const container = containerOf(player);
  if (!found || !card || !container) return "changed";
  const blanks = slotsWhere(container, (i) => i.typeId === BLANK_ID);
  if (!blanks.length) return "need_blank";
  // ถ้าการ์ดเปล่าไม่หมดกอง ต้องมีช่องว่างให้สำเนา
  if (blanks[0].item.amount > 1 && container.emptySlotsCount < 1) return "full";
  if (!takeItems(container, BLANK_ID, 1)) return "need_blank";
  const copy = factory.create({
    card: card.id,
    d: found.d,
    x: found.x,
    z: found.z,
    dim: found.dim,
    yr: found.yr,
    by: player.name,
    kind: "copy",
    from: player.name,
    bio: key.startsWith(MYSTERY_PREFIX) ? key.slice(MYSTERY_PREFIX.length) : undefined,
  });
  factory.give(player, copy);
  return "ok";
}
