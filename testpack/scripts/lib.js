// ตัวช่วยของแพ็กทดสอบ
// ผล: [bpctest] PASS/FAIL/NOTE ... (FAIL ออกเป็น error ให้ tools/bds.mjs นับ)
import { BlockPermutation, system, world } from "@minecraft/server";

export const pass = (name, detail = "") => console.log(`[bpctest] PASS ${name}${detail ? ` - ${detail}` : ""}`);
export const fail = (name, detail = "") => console.error(`[bpctest] FAIL ${name}${detail ? ` - ${detail}` : ""}`);
export const note = (name, detail) => console.log(`[bpctest] NOTE ${name} - ${detail}`);
export const check = (cond, name, detail = "") => (cond ? pass(name, detail) : fail(name, detail));
export const wait = (ticks) => system.waitTicks(ticks);
export const BASE = { x: 0, y: 200, z: 0 }; // จุดทดสอบ ต้องมี tickingarea ครอบ
export const overworld = () => world.getDimension("minecraft:overworld");

/** ไอเท็มที่ตกอยู่รอบจุดทดสอบ คืนรายการแล้วลบทิ้ง */
export function takeDrops(dim, center = BASE, radius = 4) {
  const found = [];
  for (const e of dim.getEntities({ type: "minecraft:item", location: center, maxDistance: radius })) {
    const stack = e.getComponent("minecraft:item")?.itemStack;
    if (stack) found.push({ typeId: stack.typeId, lore: stack.getLore() });
    e.remove();
  }
  return found;
}

export function setBoard(dim, pos, index, foil = false, facing = "north") {
  dim.setBlockPermutation(pos, BlockPermutation.resolve("bpc:pin_board", {
    "bpc:page": index >> 4,
    "bpc:slot": index & 15,
    "bpc:foil": foil,
    "minecraft:cardinal_direction": facing,
  }));
}
