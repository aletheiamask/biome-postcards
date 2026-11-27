// record ของโปสการ์ดหนึ่งใบ ↔ JSON โมดูลบริสุทธิ์ ห้าม import @minecraft/server
// ชนิดไอเท็ม (bpc:postcard_<card>[_foil]) คือความจริงของ card/foil ส่วน record เก็บความทรงจำของใบนั้น
import { CARDS, NS } from "../registry/cards.generated.js";

/**
 * @typedef {object} PostcardRecord
 * @property {string} card   id ของการ์ด
 * @property {boolean} [foil]
 * @property {number} [d]    วันในเกมที่ค้นพบ
 * @property {number} [x]
 * @property {number} [z]
 * @property {string} [dim]  "o" | "n" | "e" หรือ id เต็มของมิติจากแอดออนอื่น
 * @property {string} [by]   ชื่อผู้ค้นพบ
 * @property {"copy"} [kind] มีเฉพาะใบสำเนา
 * @property {string} [from] ชื่อผู้ทำสำเนา
 * @property {"storm"|"moon"|"rain"|"night"} [st] แสตมป์พิเศษ
 * @property {string} [bio]  biome id ของการ์ดลึกลับ
 * @property {number} [yr]   ปีของการ์ดเทศกาล
 * @property {string} [nm]   ชื่อที่ผู้เล่นตั้งเองบนทั่ง
 */

const ids = new Set(CARDS.map((c) => c.id));
const foilable = new Set(CARDS.filter((c) => c.foil).map((c) => c.id));
const PREFIX = `${NS}:postcard_`;
const DIMS = { "minecraft:overworld": "o", "minecraft:nether": "n", "minecraft:the_end": "e" };
const DIM_IDS = { o: "minecraft:overworld", n: "minecraft:nether", e: "minecraft:the_end" };

export const REC_KEY = `${NS}:rec`;
export const STAMPS = ["storm", "moon", "rain", "night"];
/** รหัสย่อของมิติ มิติจากแอดออนอื่นใช้ id เต็ม จะได้ไม่ชนกับโลกปกติ */
export const dimCode = (dimensionId) => DIMS[dimensionId] ?? String(dimensionId);
export const dimensionIdOf = (code) => DIM_IDS[code] ?? code;

export function itemTypeFor(cardId, foil) {
  return `${PREFIX}${cardId}${foil && foilable.has(cardId) ? "_foil" : ""}`;
}

/** @returns {{card: string, foil: boolean} | null} */
export function parseItemType(typeId) {
  if (typeof typeId !== "string" || !typeId.startsWith(PREFIX)) return null;
  const rest = typeId.slice(PREFIX.length);
  if (ids.has(rest)) return { card: rest, foil: false };
  if (rest.endsWith("_foil")) {
    const card = rest.slice(0, -5);
    if (foilable.has(card)) return { card, foil: true };
  }
  return null;
}

const int = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : undefined);
const str = (v, max) => (typeof v === "string" && v.length ? v.slice(0, max) : undefined);

/** คัดเฉพาะฟิลด์ที่รู้จักและชนิดถูกต้อง คืน null ถ้าไม่ใช่การ์ดที่รู้จัก @returns {PostcardRecord | null} */
export function normalize(o) {
  if (!o || typeof o !== "object" || !ids.has(o.card)) return null;
  const r = { card: o.card };
  if (o.foil && foilable.has(o.card)) r.foil = true;
  for (const k of ["d", "x", "z", "yr"]) {
    const v = int(o[k]);
    if (v !== undefined) r[k] = v;
  }
  const dim = str(o.dim, 64);
  if (dim) r.dim = dim;
  const by = str(o.by, 32);
  if (by) r.by = by;
  if (o.kind === "copy") {
    r.kind = "copy";
    const from = str(o.from, 32);
    if (from) r.from = from;
  }
  if (STAMPS.includes(o.st)) r.st = o.st;
  const bio = str(o.bio, 96);
  if (bio) r.bio = bio;
  const nm = str(o.nm, 40);
  if (nm) r.nm = nm;
  return r;
}

const ORIGIN = ["card", "foil", "st", "d", "x", "z", "dim", "yr", "bio"];

/** สองใบมาจากการค้นพบเดียวกันหรือไม่ ไม่เทียบชื่อผู้พบและชื่อที่ตั้งบนทั่ง ใบสำเนาไม่นับว่าเป็นใบต้นฉบับ */
export function sameOrigin(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y || x.kind === "copy" || y.kind === "copy") return false;
  return ORIGIN.every((k) => x[k] === y[k]);
}

export const encode = (rec) => JSON.stringify(normalize(rec));

/** @returns {PostcardRecord | null} */
export function decode(text) {
  if (typeof text !== "string") return null;
  try {
    return normalize(JSON.parse(text));
  } catch {
    return null;
  }
}
