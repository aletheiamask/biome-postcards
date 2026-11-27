// ฟีดแบ็กที่ผู้เล่นเห็น: การ์ดแจ้งเตือน (ผ่านคิวใน notify.js), actionbar, แชต ทุกอย่างต้องเห็นได้แม้ปิดเสียง
import { MAIN_TOTAL } from "../registry/biomeRegistry.js";
import { SETS } from "../registry/cards.generated.js";
import { warnOnce } from "../util/log.js";
import { msg, tr } from "../util/text.js";
import { PIC, PIC_SET_BASE } from "../util/toastCode.js";
import * as notify from "./notify.js";

// อนุภาครอบตัวผู้เล่นตามธีม ไม่เกิน 15 ชิ้น ใช้อนุภาคของเกมที่ปล่อยครั้งเดียวแล้วจบ
const PARTICLES = {
  forests: "minecraft:villager_happy",
  cold: "minecraft:falling_dust_top_snow_particle",
  dry: "minecraft:falling_dust_sand_particle",
  wet: "minecraft:water_splash_particle",
  fields: "minecraft:villager_happy",
  underground: "minecraft:obsidian_glow_dust_particle",
  otherworld: "minecraft:basic_portal_particle",
  mystery: "minecraft:enchanting_table_particle",
  festival: "minecraft:note_particle",
  reward: "minecraft:totem_particle",
};
// อนุภาคที่ไฟล์ของเกมอ่าน variable.direction: ถ้าไม่ส่งค่าไปด้วย content log ของ client ขึ้น Molang error ทุกชิ้น
const DIRECTED = new Set(["minecraft:water_splash_particle"]);
const fx = (theme, special) => {
  const particle = special ? PARTICLES.reward : (PARTICLES[theme] ?? PARTICLES.forests);
  return { particle, directed: DIRECTED.has(particle), ...(special ? { count: 15, sound: "random.levelup", pitch: 1 } : { count: 12, sound: "random.orb", pitch: 1.2 }) };
};

function toast(player, data) {
  try {
    notify.push(player, data);
  } catch (e) {
    warnOnce("feedback", e);
  }
}

/** ได้โปสการ์ดใหม่: การ์ดแจ้งเตือนชื่อไบโอม + ป้ายความคืบหน้า + อนุภาค + เสียงสั้น (extra = ค่าเพิ่มของการ์ด ใช้กับคำสั่งดีบัก) */
export function discovered(player, card, counts, foil = false, extra = undefined) {
  const banner = foil ? tr("bpc.toast.foil") : card.bonus ? tr("bpc.toast.bonus") : tr("bpc.toast.new", counts.main, MAIN_TOTAL);
  toast(player, { rank: notify.RANK.card, title: tr(`bpc.card.${card.id}`), banner, theme: card.theme, pic: card.board, fx: fx(card.theme, foil || card.rarity === "rare"), ...extra });
}

/** ได้อัลบั้มเล่มแรก */
export function albumGiven(player, extra = undefined) {
  toast(player, { rank: notify.RANK.album, title: tr("item.bpc:album"), banner: tr("bpc.toast.album"), theme: "reward", pic: PIC.album, fx: fx("reward", false), ...extra });
}

/** สะสมครบหนึ่งชุด */
export function setComplete(player, set, extra = undefined) {
  const pic = PIC_SET_BASE + Math.max(0, SETS.findIndex((s) => s.id === set.id));
  toast(player, { rank: notify.RANK.set, title: tr(`bpc.set.${set.id}`), banner: tr("bpc.toast.set"), theme: "reward", pic, fx: fx("reward", true), ...extra });
}

/** สะสมครบทุกชุด */
export function allSets(player, extra = undefined) {
  toast(player, { rank: notify.RANK.grand, title: tr("bpc.toast.all_sets"), banner: tr("bpc.toast.grand"), theme: "reward", pic: PIC.globe, fx: fx("reward", true), ...extra });
}

/** ช่องในอัลบั้มที่ว่างได้ใบใหม่ เพราะผู้เล่นกลับมาที่ไบโอมนั้น: แจ้งเบา ๆ ทาง actionbar ไม่ใช้การ์ดแจ้งเตือน */
export function restocked(player, card) {
  actionBar(player, "bpc.msg.restocked", tr(`bpc.card.${card.id}`));
}

export function actionBar(player, key, ...args) {
  try {
    player.onScreenDisplay.setActionBar(msg(key, ...args));
  } catch (e) {
    warnOnce("actionbar", e);
  }
}

export function tell(player, key, ...args) {
  try {
    player.sendMessage(msg(key, ...args));
  } catch (e) {
    warnOnce("tell", e);
  }
}
