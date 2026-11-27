// คิวการ์ดแจ้งเตือนต่อผู้เล่น: แสดงทีละใบตามลำดับ ไม่ซ้อนกัน ตัวจับเวลาทำงานเฉพาะตอนมีคิว
// การ์ดส่งผ่านช่อง title ของเกม: ข้อความ = ชื่อ + รหัส § ที่มองไม่เห็น (util/toastCode.js), subtitle = ข้อความบนป้ายมุม
// จังหวะเข้า ค้าง ออก ของการ์ดใช้เวลาของ title ที่ส่งไปด้วย JSON UI จึงเลื่อนตามค่าที่สคริปต์กำหนด
import { MolangVariableMap, system, world } from "@minecraft/server";
import { settings } from "../config.js";
import { warnOnce } from "../util/log.js";
import { raw, tr } from "../util/text.js";
import { PIC, toastCode } from "../util/toastCode.js";

/** ลำดับการแสดงเมื่อรอพร้อมกัน: การ์ดใหม่ → ได้อัลบั้ม → ครบชุด → ครบทุกชุด */
export const RANK = Object.freeze({ card: 0, album: 1, set: 2, grand: 3 });
/** การ์ดใหม่ที่รอได้สูงสุด ใบที่เกินจะรวมเป็นใบสรุปใบเดียว */
export const MAX_WAITING = 8;
const FAST_AT = 2; // เหลือรอตั้งแต่จำนวนนี้ ใบที่กำลังจะแสดงค้างสั้นลง
export const PACE = Object.freeze({
  normal: Object.freeze({ fadeInDuration: 16, stayDuration: 80, fadeOutDuration: 16 }),
  fast: Object.freeze({ fadeInDuration: 10, stayDuration: 36, fadeOutDuration: 10 }),
  plain: Object.freeze({ fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 }), // ปิดการ์ด: จังหวะ title เดิม
});
const GAP_TICKS = 6; // เว้นระหว่างใบ

const queues = new Map(); // player.id -> { items: Toast[] }

/**
 * @typedef {object} Toast
 * @property {number} rank ลำดับ (RANK)
 * @property {object} [title] ส่วน RawMessage ของชื่อ
 * @property {object} banner ส่วน RawMessage ของป้ายมุม
 * @property {string} theme ธีม (util/toastCode.js THEMES)
 * @property {number} pic เลขภาพ
 * @property {{particle: string, count: number, sound: string, pitch: number, directed?: boolean}} [fx] directed = อนุภาคที่ต้องการ variable.direction (พุ่งออกจากตัวผู้เล่น)
 * @property {boolean} [demo] การ์ดตัวอย่างของคำสั่งดีบัก: ไม่รวมเป็นใบสรุป และค้างเต็มเวลาเสมอ
 * @property {number} [more] ใบสรุป: จำนวนการ์ดที่รวมไว้
 */

/** ใส่การ์ดลงคิวตามลำดับ (คงลำดับเดิมในกลุ่มเดียวกัน) การ์ดใหม่ที่เกิน MAX_WAITING รวมเป็นใบสรุป */
export function insert(items, toast) {
  if (toast.rank === RANK.card && !toast.demo) {
    const summary = items.find((t) => t.more);
    if (summary) return void summary.more++;
    if (items.filter((t) => t.rank === RANK.card && !t.demo).length >= MAX_WAITING) {
      toast = { rank: RANK.card, more: 1, banner: tr("bpc.toast.more_banner"), theme: "reward", pic: PIC.more };
    }
  }
  let at = items.length;
  while (at > 0 && items[at - 1].rank > toast.rank) at--;
  items.splice(at, 0, toast);
}

/** จังหวะของใบที่กำลังจะแสดง เมื่อยังมีรออยู่ waiting ใบ */
export function paceFor(toast, waiting, cards = true) {
  if (!cards) return PACE.plain;
  return !toast.demo && waiting >= FAST_AT ? PACE.fast : PACE.normal;
}

function effects(player, fx) {
  const { x, y, z } = player.location;
  for (let i = 0; i < fx.count; i++) {
    const a = (i / fx.count) * Math.PI * 2;
    let vars;
    if (fx.directed) {
      vars = new MolangVariableMap();
      vars.setVector3("variable.direction", { x: Math.cos(a), y: 0.8, z: Math.sin(a) });
    }
    player.dimension.spawnParticle(fx.particle, { x: x + Math.cos(a) * 0.8, y: y + 1 + (i % 3) * 0.3, z: z + Math.sin(a) * 0.8 }, vars);
  }
  player.playSound(fx.sound, { volume: 0.6, pitch: fx.pitch });
}

function show(player, toast, pace) {
  try {
    const title = toast.more ? tr("bpc.toast.more", toast.more) : toast.title;
    const parts = settings().toast ? [title, toastCode(toast.theme, toast.pic)] : [title];
    player.onScreenDisplay.setTitle(raw(...parts), Object.assign({ subtitle: raw(toast.banner) }, pace));
    if (toast.fx) effects(player, toast.fx);
  } catch (e) {
    warnOnce("toast", e);
  }
}

function next(id, queue) {
  if (queues.get(id) !== queue) return; // ผู้เล่นออกแล้ว หรือคิวถูกล้าง
  const toast = queue.items.shift();
  const player = toast ? world.getEntity(id) : undefined;
  if (!player || !player.isValid) return void queues.delete(id);
  const pace = paceFor(toast, queue.items.length, settings().toast);
  show(player, toast, pace);
  system.runTimeout(() => next(id, queue), pace.fadeInDuration + pace.stayDuration + pace.fadeOutDuration + GAP_TICKS);
}

/** แสดงการ์ดแจ้งเตือน ถ้ามีใบอื่นกำลังแสดงอยู่จะรอคิว */
export function push(player, toast) {
  const queue = queues.get(player.id);
  if (queue) return insert(queue.items, toast);
  const fresh = { items: [toast] };
  queues.set(player.id, fresh);
  next(player.id, fresh);
}

/** จำนวนการ์ดที่ยังรอแสดงของผู้เล่น */
export const waiting = (playerId) => queues.get(playerId)?.items.length ?? 0;

/** เรียกตอนผู้เล่นออก */
export const forget = (playerId) => void queues.delete(playerId);

/** สำหรับเทสต์ */
export const resetState = () => queues.clear();
