// ชุดสะสม: ครบชุดได้บล็อกตกแต่ง 1 ชิ้น ครั้งเดียว ครบทุกชุดได้ Traveler's Globe
import { ItemStack } from "@minecraft/server";
import { GRAND_REWARD, SETS } from "../registry/cards.generated.js";
import { warnOnce } from "../util/log.js";
import * as store from "./collectionStore.js";
import * as feedback from "./feedback.js";
import * as factory from "./postcardFactory.js";

/** ความคืบหน้าของทุกชุด: [{set, have, total, done}] */
export function progress(player) {
  return SETS.map((set) => {
    const have = set.cards.filter((id) => store.has(player, id)).length;
    return { set, have, total: set.cards.length, done: have === set.cards.length };
  });
}

/** เรียกหลังได้การ์ดใหม่ทุกครั้ง ให้รางวัลของชุดที่เพิ่งครบ */
export function check(player) {
  try {
    const flags = store.flags(player);
    const all = progress(player);
    for (const { set, done } of all) {
      if (!done || flags.sets.includes(set.id)) continue;
      // บันทึกก่อนให้ของ ถ้าบันทึกไม่ได้ก็ไม่ให้ จะได้ไม่เกิดรางวัลซ้ำ
      if (!store.setFlags(player, { sets: store.flags(player).sets.concat(set.id) })) return;
      factory.give(player, new ItemStack(set.reward, 1));
      feedback.setComplete(player, set);
    }
    if (all.every((p) => p.done) && !store.flags(player).grand) {
      if (!store.setFlags(player, { grand: true })) return;
      factory.give(player, new ItemStack(GRAND_REWARD, 1));
      feedback.allSets(player);
    }
  } catch (e) {
    warnOnce("rewards", e);
  }
}
