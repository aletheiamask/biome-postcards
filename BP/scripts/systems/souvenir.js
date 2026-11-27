// แผงขายของที่ระลึก (v1.x): แตะแล้วซื้อของตกแต่งด้วยมรกต ปลดล็อกตามจำนวนการ์ดหลักที่สะสม
// แผงไม่เก็บข้อมูล จึงไม่มี DP ให้ล้างเมื่อถูกทำลาย
import { ItemStack, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { SOUVENIRS } from "../registry/cards.generated.js";
import { session, show } from "../ui/forms.js";
import { containerOf, takeItems } from "../util/inventory.js";
import { warnOnce } from "../util/log.js";
import { msg, raw, tr } from "../util/text.js";
import * as store from "./collectionStore.js";
import * as feedback from "./feedback.js";
import * as factory from "./postcardFactory.js";

export const STAND_ID = "bpc:souvenir_stand";
const EMERALD = "minecraft:emerald";
const ICON_LOCK = "textures/ui/bpc_lock";
const nameOf = (souvenir) => tr(`tile.${souvenir.id}.name`);

/**
 * ซื้อของที่ระลึก หักมรกตก่อนแล้วจึงให้ของ (ของที่ให้ไม่เข้ากระเป๋าจะตกที่เท้า จึงไม่หาย)
 * @returns {"ok"|"locked"|"need_emeralds"}
 */
export function buy(player, souvenir) {
  if (store.counts(player).main < souvenir.need) return "locked";
  const container = containerOf(player);
  if (!container || !takeItems(container, EMERALD, souvenir.price)) return "need_emeralds";
  factory.give(player, new ItemStack(souvenir.id, 1));
  return "ok";
}

export async function openShop(player) {
  for (;;) {
    const have = store.counts(player).main;
    const form = new ActionFormData()
      .title(msg("bpc.ui.shop.title"))
      .body(raw(tr("bpc.ui.shop.body"), "\n", tr("bpc.ui.shop.have", have)));
    for (const s of SOUVENIRS) {
      if (have >= s.need) form.button(raw(nameOf(s), "\n", tr("bpc.ui.shop.price", s.price)), s.icon);
      else form.button(raw(tr("bpc.ui.locked"), "\n", tr("bpc.ui.shop.locked", s.need)), ICON_LOCK);
    }
    form.button(msg("bpc.ui.back"));
    const res = await show(player, form);
    if (!res || res.selection >= SOUVENIRS.length) return;
    const souvenir = SOUVENIRS[res.selection];
    const result = buy(player, souvenir); // ตรวจใหม่หลังฟอร์มปิด กระเป๋าอาจเปลี่ยนระหว่างฟอร์มเปิด
    if (result === "ok") feedback.actionBar(player, "bpc.msg.bought", nameOf(souvenir));
    else if (result === "need_emeralds") feedback.actionBar(player, "bpc.msg.need_emeralds", souvenir.price);
  }
}

export function registerSouvenirComponent(registry) {
  registry.registerCustomComponent(STAND_ID, {
    onPlayerInteract({ player }) {
      if (!player) return;
      system.run(() => session(player, openShop).catch((e) => warnOnce("shop-ui", e)));
    },
  });
}
