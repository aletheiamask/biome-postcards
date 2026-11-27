// การใช้ไอเท็มของแอดออน (คลิกขวา / แตะค้าง): อัลบั้มเปิดหน้าจอ โปสการ์ดบอกวิธีใช้
// รับจาก world.afterEvents.itemUse ไม่ใช้ item custom component: client ของเกมอ่าน component ของแพ็กในไอเท็มไม่ได้
// จึงขึ้น error ทุกไอเท็มทุกครั้งที่เข้าโลก และผู้เล่นเห็นข้อความแดงว่าแพ็กโหลดไม่สำเร็จ (05 ข้อ U17)
import { useAlbum } from "../ui/albumForms.js";
import { warnOnce } from "../util/log.js";
import { ALBUM_ID } from "./album.js";
import { isPostcard, usePostcard } from "./postcardFactory.js";

/** @param {{source?: import("@minecraft/server").Player, itemStack?: import("@minecraft/server").ItemStack}} event */
export function onItemUse({ source, itemStack }) {
  if (!source || !itemStack) return;
  try {
    if (itemStack.typeId === ALBUM_ID) useAlbum(source);
    else if (isPostcard(itemStack)) usePostcard(source);
  } catch (e) {
    warnOnce("item-use", e);
  }
}
