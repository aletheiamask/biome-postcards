// สร้างไอเท็มโปสการ์ดพร้อม lore และ record แล้วให้ผู้เล่นหรือดรอป
import { ItemStack } from "@minecraft/server";
import { cardById } from "../registry/biomeRegistry.js";
import { warnOnce } from "../util/log.js";
import { loreEnglish, loreFor } from "../util/lore.js";
import { REC_KEY, decode, encode, itemTypeFor, normalize, parseItemType } from "../util/record.js";
import { msg } from "../util/text.js";

export const isPostcard = (item) => Boolean(item && parseItemType(item.typeId));

/** @param {import("../util/record.js").PostcardRecord} recIn */
export function create(recIn) {
  const rec = normalize(recIn);
  if (!rec) throw new Error(`bad postcard record: ${JSON.stringify(recIn)}`);
  const card = cardById(rec.card);
  const item = new ItemStack(itemTypeFor(rec.card, rec.foil), 1);
  try {
    item.setDynamicProperty(REC_KEY, encode(rec));
  } catch (e) {
    warnOnce("item-record", e);
  }
  try {
    item.setLore(loreFor(rec, card));
  } catch (e) {
    warnOnce("lore-raw", e);
    try {
      item.setLore(loreEnglish(rec, card));
    } catch (e2) {
      warnOnce("lore-text", e2);
    }
  }
  if (rec.nm) item.nameTag = rec.nm; // ชื่อที่ผู้เล่นตั้งบนทั่งต้องอยู่รอดการฝาก/แขวน
  return item;
}

/** อ่าน record จากไอเท็ม ไอเท็มจาก /give ไม่มี record จะได้แค่ card กับ foil (ไม่ทราบที่มา) */
export function toRecord(item) {
  const type = item && parseItemType(item.typeId);
  if (!type) return null;
  let saved = null;
  try {
    saved = decode(item.getDynamicProperty(REC_KEY));
  } catch {
    saved = null;
  }
  return normalize(Object.assign({}, saved ?? {}, { card: type.card, foil: type.foil, nm: item.nameTag }));
}

/** ใส่กระเป๋า ถ้าเต็มดรอปที่เท้าพร้อมข้อความ คืน true ถ้าเข้ากระเป๋า */
export function give(player, item) {
  const container = player.getComponent("minecraft:inventory")?.container;
  const left = container ? container.addItem(item) : item;
  if (!left) return true;
  player.dimension.spawnItem(left, player.location);
  player.onScreenDisplay.setActionBar(msg("bpc.msg.inventory_full"));
  return false;
}

/** ใช้โปสการ์ดเฉย ๆ: บอกว่าไอเท็มนี้ใช้ทำอะไร */
export function usePostcard(player) {
  try {
    player.onScreenDisplay.setActionBar(msg("bpc.msg.postcard_hint"));
  } catch (e) {
    warnOnce("postcard-use", e);
  }
}
