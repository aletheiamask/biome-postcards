// ตัวช่วยเรื่องกระเป๋าผู้เล่น

export const containerOf = (player) => player.getComponent("minecraft:inventory")?.container;

/** ช่องที่ไอเท็มผ่านเงื่อนไข: [{slot, item}] */
export function slotsWhere(container, test) {
  const out = [];
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item && test(item)) out.push({ slot, item });
  }
  return out;
}

export function countItems(container, typeId) {
  let total = 0;
  for (const { item } of slotsWhere(container, (i) => i.typeId === typeId)) total += item.amount;
  return total;
}

/** หักไอเท็มออกตามจำนวน คืน false โดยไม่แตะกระเป๋าถ้ามีไม่พอ */
export function takeItems(container, typeId, amount) {
  if (countItems(container, typeId) < amount) return false;
  let left = amount;
  for (const { slot, item } of slotsWhere(container, (i) => i.typeId === typeId)) {
    if (left <= 0) break;
    if (item.amount > left) {
      item.amount -= left;
      container.setItem(slot, item);
      left = 0;
    } else {
      left -= item.amount;
      container.setItem(slot, undefined);
    }
  }
  return true;
}
