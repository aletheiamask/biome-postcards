// ตัวช่วยของฟอร์ม @minecraft/server-ui
import { system } from "@minecraft/server";
import { ActionFormData, uiManager } from "@minecraft/server-ui";
import { msg } from "../util/text.js";

export const PAGE_SIZE = 8; // ปุ่มรายการต่อหน้า กดได้ด้วยนิ้วโป้งเดียว
const REOPEN_TICKS = 10; // เปิดซ้ำเร็วกว่านี้ถือว่าเป็นการกดครั้งเดียวกัน (กดค้าง หรือ event ยิงซ้ำ)

const sessions = new Map(); // player.id -> { tick } หน้าจอของแอดออนที่ผู้เล่นเปิดค้างอยู่

/**
 * เปิดชุดหน้าจอของแอดออนให้ผู้เล่น โดยผู้เล่นหนึ่งคนมีได้ทีละชุด
 * - เปิดซ้ำภายใน REOPEN_TICKS: ทิ้งคำขอใหม่ (ไม่ให้มีสองฟอร์มซ้อนกัน)
 * - เปิดซ้ำหลังจากนั้นขณะที่ชุดเดิมยังไม่จบ: ปิดฟอร์มที่ค้างแล้วเปิดชุดใหม่ ผู้เล่นจึงไม่ติดอยู่กับหน้าจอที่ค้าง
 * @returns {Promise<boolean>} false = คำขอถูกทิ้ง
 */
export async function session(player, run) {
  const now = system.currentTick;
  const open = sessions.get(player.id);
  if (open) {
    if (now - open.tick < REOPEN_TICKS) return false;
    try {
      uiManager.closeAllForms(player);
    } catch {
      // ผู้เล่นออกจากโลกแล้ว
    }
  }
  const mine = { tick: now };
  sessions.set(player.id, mine);
  try {
    await run(player);
  } finally {
    if (sessions.get(player.id) === mine) sessions.delete(player.id);
  }
  return true;
}

/** เรียกตอนผู้เล่นออก */
export const endSession = (playerId) => void sessions.delete(playerId);

/** สำหรับเทสต์ */
export const resetSessions = () => sessions.clear();

/**
 * แสดงฟอร์ม ถ้าผู้เล่นยังมีหน้าจออื่นเปิดอยู่ (UserBusy) ลองใหม่ไม่เกินราว 1 วินาที
 * คืน response หรือ null เมื่อผู้เล่นปิดฟอร์มหรือแสดงไม่ได้ (ปิดกลางทางต้องไม่มีอะไรเปลี่ยน)
 */
export async function show(player, form) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await form.show(player);
    } catch {
      return null; // ผู้เล่นออกจากโลกแล้ว
    }
    if (!res.canceled) return res;
    if (res.cancelationReason !== "UserBusy") return null;
    await system.waitTicks(4);
  }
  return null;
}

/**
 * หน้ารายการแบบแบ่งหน้า: ปุ่มรายการก่อน แล้วตามด้วย ก่อนหน้า / ถัดไป / กลับ ที่เดิมทุกหน้า
 * title = lang key ที่รับ (หน้า, จำนวนหน้า), button(i) คืน [ข้อความ, ไอคอน]
 * @returns {Promise<{index: number, page: number} | "back" | null>} null = ผู้เล่นปิดฟอร์ม
 */
export async function pickFromList(player, { title, body, count, button, page = 0 }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  let current = Math.min(Math.max(page, 0), pages - 1);
  for (;;) {
    const form = new ActionFormData().title(msg(title, current + 1, pages));
    if (body) form.body(body);
    const start = current * PAGE_SIZE;
    const shown = Math.min(PAGE_SIZE, count - start);
    for (let i = 0; i < shown; i++) {
      const [text, icon] = button(start + i);
      form.button(text, icon);
    }
    form.button(msg("bpc.ui.prev")).button(msg("bpc.ui.next")).button(msg("bpc.ui.back"));
    const res = await show(player, form);
    if (!res) return null;
    const pick = res.selection;
    if (pick < shown) return { index: start + pick, page: current };
    if (pick === shown) current = (current + pages - 1) % pages;
    else if (pick === shown + 1) current = (current + 1) % pages;
    else return "back";
  }
}
