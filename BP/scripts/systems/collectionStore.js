// ความคืบหน้าต่อผู้เล่น: โหลดครั้งแรกที่ใช้ (lazy) แคชในหน่วยความจำ และเขียน DP เฉพาะเมื่อข้อมูลเปลี่ยน
// ความจริงของการสะสมอยู่ที่ player DP bpc:col ที่เดียว ข้อมูลบนไอเท็มเป็นแค่สำเนา
import { world } from "@minecraft/server";
import { cardForKey } from "../registry/biomeRegistry.js";
import { warnOnce } from "../util/log.js";
import { normalize } from "../util/record.js";
import { readJson, removeKey, writeJson } from "../util/storage.js";
import { msg } from "../util/text.js";
import { CURRENT, migrateAlbum, migrateCollection, migrateFlags } from "./migrations.js";

const COL = "bpc:col";
const ALBUM = "bpc:album";
const FLAGS = "bpc:flags";
const WORLD_SCHEMA = "bpc:schema";
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** @type {Map<string, {col: {v: number, cards: object}, flags: object, album: object[] | null, readOnly: boolean, told: boolean}>} */
const cache = new Map();
let worldReadOnly = false;

/** รันตอน worldLoad: ตั้งหรืออัปเกรดเลข schema ของโลก ถ้าโลกใหม่กว่าแอดออนให้หยุดเขียน */
export function migrateWorld() {
  const v = world.getDynamicProperty(WORLD_SCHEMA);
  worldReadOnly = typeof v === "number" && v > CURRENT;
  if (worldReadOnly) {
    warnOnce("schema-newer", `world schema ${v} is newer than this add-on (${CURRENT}); progress is not saved`);
    return;
  }
  if (v !== CURRENT) world.setDynamicProperty(WORLD_SCHEMA, CURRENT); // ยังไม่มีขั้นอัปเกรดระดับโลก
}

function backup(player, key, raw) {
  try {
    player.setDynamicProperty(`${key}_bak`, JSON.stringify(raw));
  } catch {
    /* สำรองไม่ได้ก็ยังต้องทำงานต่อ */
  }
}

function load(player) {
  const raw = readJson(player, COL, null);
  const m = migrateCollection(raw);
  if (m.status === "reset") {
    backup(player, COL, raw);
    warnOnce(`col-reset:${player.id}`, "collection data was invalid and was reset (backup kept)");
  }
  const st = {
    col: m.data,
    flags: migrateFlags(readJson(player, FLAGS, null)),
    album: null,
    readOnly: worldReadOnly || m.status === "newer",
    told: false,
  };
  cache.set(player.id, st);
  if (m.status === "upgraded" && !st.readOnly) writeJson(player, COL, st.col);
  return st;
}
const state = (player) => cache.get(player.id) ?? load(player);

export const isReadOnly = (player) => state(player).readOnly;
export const has = (player, key) => own(state(player).col.cards, key);
export const get = (player, key) => (has(player, key) ? state(player).col.cards[key] : undefined);
/** คีย์ทั้งหมดที่ผู้เล่นมี ตามลำดับที่ได้ */
export const keys = (player) => Object.keys(state(player).col.cards);

export function counts(player) {
  const { cards } = state(player).col;
  const c = { main: 0, mystery: 0, bonus: 0, foil: 0 };
  for (const key of Object.keys(cards)) {
    const card = cardForKey(key);
    if (!card) continue; // การ์ดจากเวอร์ชันอื่นที่ไม่รู้จัก เก็บไว้เฉย ๆ
    if (card.kind === "mystery") c.mystery++;
    else if (card.bonus) c.bonus++;
    else c.main++;
    if (cards[key] && cards[key].foil) c.foil++;
  }
  return c;
}

/** บันทึกการค้นพบ คืน false ถ้าเขียนไม่ได้ (ข้อมูลไม่เปลี่ยน) */
export function add(player, key, rec) {
  const st = state(player);
  if (st.readOnly || own(st.col.cards, key)) return false;
  st.col.cards[key] = rec;
  if (writeJson(player, COL, st.col)) return true;
  delete st.col.cards[key];
  return false;
}

/**
 * แก้หลาย record ในการเขียนครั้งเดียว: [[key, patch], ...] ฟิลด์ที่ค่าใน patch เป็น undefined ถูกลบออก
 * คืน false ถ้าเขียนไม่ได้ (ข้อมูลไม่เปลี่ยน)
 */
export function updateMany(player, patches) {
  const st = state(player);
  if (st.readOnly || !patches.every(([key]) => own(st.col.cards, key))) return false;
  const before = patches.map(([key]) => [key, st.col.cards[key]]);
  for (const [key, patch] of patches) {
    const next = Object.assign({}, st.col.cards[key], patch);
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    st.col.cards[key] = next;
  }
  if (writeJson(player, COL, st.col)) return true;
  for (const [key, rec] of before.reverse()) st.col.cards[key] = rec;
  return false;
}

/** แก้ record ที่มีอยู่ (เช่นตั้ง foil หรือสถานะช่องในอัลบั้ม: out = หยิบออกไปแล้ว) */
export const update = (player, key, patch) => updateMany(player, [[key, patch]]);

export const flags = (player) => state(player).flags;

export function setFlags(player, patch) {
  const st = state(player);
  if (st.readOnly) return false;
  const before = st.flags;
  st.flags = Object.assign({}, before, patch);
  if (writeJson(player, FLAGS, st.flags)) return true;
  st.flags = before;
  return false;
}

/** โปสการ์ดที่ฝากในอัลบั้ม (สำเนาของรายการ แก้แล้วต้องเรียก saveAlbum) */
export function album(player) {
  const st = state(player);
  if (!st.album) {
    const raw = readJson(player, ALBUM, null);
    const m = migrateAlbum(raw);
    if (m.status === "reset") backup(player, ALBUM, raw);
    if (m.status === "newer") st.readOnly = true;
    st.album = m.data.items.map(normalize).filter(Boolean);
  }
  return st.album.slice();
}

export function saveAlbum(player, items) {
  const st = state(player);
  if (st.readOnly) return false;
  if (!writeJson(player, ALBUM, { v: CURRENT, items })) return false;
  st.album = items.slice();
  return true;
}

/** ผู้เล่นเข้าโลกครั้งแรกของรอบ: แจ้งเรื่องโลกเก่าหรือ schema ใหม่กว่า ครั้งเดียว */
export function welcome(player) {
  const st = state(player);
  if (st.readOnly) {
    if (!st.told) player.sendMessage(msg("bpc.msg.schema_newer"));
    st.told = true;
    return;
  }
  if (st.flags.welcome) return;
  // โลกเก่า: ไม่แจกย้อนหลัง จึงบอกให้ไปเยือนไบโอมอีกครั้ง
  if (world.getDay() > 10 && Object.keys(st.col.cards).length === 0) player.sendMessage(msg("bpc.msg.welcome_old_world"));
  setFlags(player, { welcome: true });
}

/** ล้างความคืบหน้าของผู้เล่น (คำสั่งดีบัก) */
export function reset(player) {
  for (const key of [COL, ALBUM, FLAGS]) removeKey(player, key);
  cache.delete(player.id);
}

export const unload = (playerId) => cache.delete(playerId);
export const unloadAll = () => cache.clear();
