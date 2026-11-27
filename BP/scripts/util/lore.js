// จัด lore ของโปสการ์ดให้อยู่ในขีดจำกัดของเกม โมดูลบริสุทธิ์ ห้าม import @minecraft/server
import { LORE_EN } from "../registry/cards.generated.js";

export const MAX_LINE = 50; // ตัวอักษรต่อบรรทัด
export const MAX_LINES = 20;

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * บรรทัด lore ในรูป [lang key, ...ค่าที่แทน]
 * @param {import("./record.js").PostcardRecord} rec
 * @param {{rarity: string}} card
 * @returns {Array<[string, ...string[]]>}
 */
export function loreParts(rec, card) {
  const lines = [];
  if (rec.yr !== undefined) lines.push(["bpc.lore.festival", String(rec.yr)]);
  else if (rec.d !== undefined && rec.x !== undefined && rec.z !== undefined) lines.push(["bpc.lore.found", String(rec.d), String(rec.x), String(rec.z)]);
  else lines.push(["bpc.lore.unknown"]);
  if (rec.by) lines.push(["bpc.lore.by", clip(rec.by, 30)]);
  if (rec.bio) lines.push(["bpc.lore.biome", clip(rec.bio, 46)]);
  lines.push([`bpc.lore.rarity.${card.rarity}`]);
  if (rec.st) lines.push([`bpc.lore.stamp.${rec.st}`]);
  if (rec.kind === "copy") lines.push(["bpc.lore.copy", clip(rec.from ?? "?", 28)]);
  return lines.slice(0, MAX_LINES);
}

/** lore แบบแปลภาษาได้ ผู้เล่นเห็นตามภาษาที่ตั้งในเกม */
export function loreFor(rec, card) {
  return loreParts(rec, card).map(([key, ...args]) => ({ rawtext: [args.length ? { translate: key, with: args } : { translate: key }] }));
}

/** แทน %s ตามลำดับ */
export function format(template, args) {
  let i = 0;
  return template.replace(/%s/g, () => String(args[i++] ?? ""));
}

/** ทางสำรองเมื่อเกมไม่รับ lore แบบ RawMessage: ข้อความอังกฤษธรรมดา */
export function loreEnglish(rec, card) {
  return loreParts(rec, card).map(([key, ...args]) => clip(format(LORE_EN[key] ?? key, args), MAX_LINE));
}
