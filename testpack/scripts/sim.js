// ชุดทดสอบที่ใช้ผู้เล่นจำลอง (ต้องเปิด experiment Beta APIs ในโลกทดสอบ)
// ชุด board / use / lock ต้องปิดการแจกโปสการ์ดให้โหมดสร้างสรรค์ก่อน (bpc:config creative false) กระเป๋าจะได้ว่าง
import { Direction, EquipmentSlot, GameMode, ItemStack, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { BASE, check, fail, note, overworld, pass, setBoard, takeDrops, wait } from "./lib.js";

const inventory = (p) => {
  const c = p.getComponent("minecraft:inventory").container;
  const out = [];
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it) out.push({ slot: i, typeId: it.typeId, lore: it.getLore() });
  }
  return out;
};
const typesOf = (p) => inventory(p).map((i) => i.typeId);
const postcards = (p) => typesOf(p).filter((t) => t.startsWith("bpc:postcard_"));
const hasCard = (p, card) => postcards(p).some((t) => t === `bpc:postcard_${card}` || t === `bpc:postcard_${card}_foil`);
const hand = (p) => p.getComponent("minecraft:equippable").getEquipmentSlot(EquipmentSlot.Mainhand);
const boardCard = (dim) => {
  const perm = dim.getBlock(BASE)?.permutation;
  return perm && perm.getState("bpc:page") !== undefined ? perm.getState("bpc:page") * 16 + perm.getState("bpc:slot") : -1;
};

/** ผู้เล่นจำลองยืนทางเหนือของบอร์ด หันหน้าเข้าหาบอร์ด */
async function spawn(name, mode = GameMode.Creative, x = 0.5) {
  const dim = overworld();
  const floor = () => {
    try {
      dim.runCommand("fill -3 199 -5 3 199 3 stone");
    } catch {
      /* chunk ยังไม่โหลด */
    }
    return dim.getBlock({ x: 0, y: 199, z: -3 })?.typeId === "minecraft:stone";
  };
  floor();
  const p = spawnSimulatedPlayer({ dimension: dim, x, y: 200, z: -2.5 }, name, mode);
  await wait(20);
  // ชุดแรกหลังเปิดเซิร์ฟเวอร์: chunk ยังไม่โหลดตอนสั่ง fill ครั้งแรก พื้นจึงไม่มีและผู้เล่นร่วงลงไป
  // (การค้นพบเห็นว่าผู้เล่นขยับ จึงเติมช่องที่ว่าง และผู้เล่นอยู่ไกลเกินจะทุบบอร์ด) วางพื้นใหม่แล้วพากลับขึ้นมา
  for (let i = 0; i < 10 && !(floor() && Math.abs(p.location.y - 200) < 0.6); i++) {
    if (floor()) p.teleport({ x, y: 200, z: -2.5 }, { dimension: dim });
    await wait(10);
  }
  p.lookAtBlock(BASE);
  return p;
}

// แขวน ถอด และทุบบอร์ดด้วยผู้เล่น
async function board() {
  const dim = overworld();
  const p = await spawn("BoardTester");
  try {
    takeDrops(dim);
    setBoard(dim, BASE, 0);
    await wait(2);
    p.interactWithBlock(BASE, Direction.North);
    await wait(5);
    // อัลบั้มเล่มแรกอาจเข้ากระเป๋ามาแล้วจากการค้นพบไบโอมแรก จึงดูเฉพาะโปสการ์ด
    check(boardCard(dim) === 0 && postcards(p).length === 0, "empty hand on empty board does nothing", JSON.stringify(typesOf(p)));

    p.setItem(new ItemStack("bpc:postcard_cherry_grove", 1), 0, true);
    await wait(2);
    const used = p.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 6 && !hand(p).getItem(), "pin a postcard", `interact=${used} card=${boardCard(dim)} hand=${hand(p).getItem()?.typeId}`);

    p.setItem(new ItemStack("minecraft:stick", 1), 0, true);
    await wait(2);
    p.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 6, "holding another item does not unpin");

    hand(p).setItem(undefined);
    await wait(2);
    p.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 0 && typesOf(p).includes("bpc:postcard_cherry_grove"), "unpin returns the postcard", JSON.stringify(inventory(p)));

    p.getComponent("minecraft:inventory").container.clearAll();
    p.setItem(new ItemStack("bpc:postcard_deep_dark_foil", 1), 0, true);
    await wait(2);
    p.interactWithBlock(BASE, Direction.North);
    await wait(5);
    const perm = dim.getBlock(BASE).permutation;
    check(boardCard(dim) === 27 && perm.getState("bpc:foil") === true, "pin a foil postcard", `card=${boardCard(dim)} foil=${perm.getState("bpc:foil")}`);

    p.breakBlock(BASE);
    await wait(40);
    const drops = takeDrops(dim).map((d) => d.typeId);
    check([...drops, ...typesOf(p)].includes("bpc:postcard_deep_dark_foil") && dim.getBlock(BASE)?.typeId === "minecraft:air", "player breaks board, postcard returns", `drops=${JSON.stringify(drops)} block=${dim.getBlock(BASE)?.typeId}`);
    pass("board done");
  } catch (e) {
    fail("board", String(e?.stack ?? e));
  } finally {
    takeDrops(dim);
    p.disconnect();
  }
}

// ใช้ไอเท็มที่มี custom component และแตะบล็อกที่เปิดฟอร์ม ต้องไม่มี error (ฟอร์มแสดงกับผู้เล่นจำลองไม่ได้)
async function use() {
  const dim = overworld();
  const p = await spawn("UseTester");
  try {
    for (const id of ["bpc:album", "bpc:postcard_plains"]) {
      p.setItem(new ItemStack(id, 1), 0, true);
      await wait(2);
      note(`use ${id}`, String(p.useItemInSlot(0)));
      await wait(30);
    }
    dim.setBlockType(BASE, "bpc:souvenir_stand");
    hand(p).setItem(undefined);
    await wait(2);
    note("interact stand", String(p.interactWithBlock(BASE, Direction.North)));
    await wait(30);
    dim.setBlockType(BASE, "minecraft:air");
    pass("use done");
  } catch (e) {
    fail("use", String(e?.stack ?? e));
  } finally {
    p.disconnect();
  }
}

// ownerLock: คนอื่นถอดหรือทุบไม่ได้ ระเบิดแล้วโปสการ์ดกลับไปหาเจ้าของ (ต้องตั้ง bpc:config ownerLock true ก่อน)
async function lock() {
  const dim = overworld();
  const owner = await spawn("LockOwner", GameMode.Creative, -1.5);
  const other = await spawn("LockOther", GameMode.Creative, 1.5);
  try {
    takeDrops(dim);
    setBoard(dim, BASE, 0);
    await wait(2);
    owner.setItem(new ItemStack("bpc:postcard_cherry_grove", 1), 0, true);
    await wait(2);
    owner.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 6, "owner pins");

    other.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 6 && postcards(other).length === 0, "other player cannot unpin a locked board", JSON.stringify(typesOf(other)));

    other.breakBlock(BASE);
    await wait(30);
    other.stopBreakingBlock();
    check(boardCard(dim) === 6, "other player cannot break a locked board", `block=${dim.getBlock(BASE)?.typeId} card=${boardCard(dim)}`);

    dim.createExplosion({ x: 0.5, y: 200.5, z: 1.5 }, 3, { breaksBlocks: true });
    await wait(20);
    const drops = takeDrops(dim).map((d) => d.typeId);
    check(dim.getBlock(BASE)?.typeId === "minecraft:air" && !drops.includes("bpc:postcard_cherry_grove") && postcards(owner).includes("bpc:postcard_cherry_grove"),
      "explosion returns the postcard to its owner, not to the ground", `drops=${JSON.stringify(drops)} owner=${JSON.stringify(typesOf(owner))} block=${dim.getBlock(BASE)?.typeId}`);

    setBoard(dim, BASE, 0);
    await wait(2);
    owner.interactWithBlock(BASE, Direction.North); // เจ้าของแขวนใหม่ (ไอเท็มกลับมาที่ช่องแรก)
    await wait(5);
    hand(owner).setItem(undefined);
    owner.interactWithBlock(BASE, Direction.North);
    await wait(5);
    check(boardCard(dim) === 0 && postcards(owner).length === 1, "owner can unpin", `card=${boardCard(dim)} owner=${JSON.stringify(typesOf(owner))}`);
    dim.setBlockType(BASE, "minecraft:air");
    pass("lock done");
  } catch (e) {
    fail("lock", String(e?.stack ?? e));
  } finally {
    takeDrops(dim);
    owner.disconnect();
    other.disconnect();
  }
}

// ---------- ค้นพบไบโอมจริง ----------
/**
 * หยิบทุกใบออกจากอัลบั้มเข้ากระเป๋าด้วยคำสั่งดีบักของแอดออน
 * โปสการ์ดจากการค้นพบอยู่ในอัลบั้ม ไม่เข้ากระเป๋า และแพ็กทดสอบอ่านข้อมูลของแพ็กหลักไม่ได้ จึงดูผลจากไอเท็มที่หยิบออกมา
 */
async function takeAll(p) {
  p.runCommand("bpc:takeall");
  await wait(5);
}

const found = new Map(); // biome id -> ตำแหน่งที่หาเจอ
function locate(dim, biome) {
  if (found.has(biome)) return found.get(biome);
  let pos;
  try {
    pos = dim.calculateClosestBiomeFromSeed({ x: 0, y: 64, z: 0 }, biome, { boundingSize: { x: 1536, y: 256, z: 1536 } });
  } catch (e) {
    note(`locate ${biome}`, `error ${String(e).slice(0, 80)}`);
  }
  if (pos) found.set(biome, pos);
  return pos;
}
/** ผู้เล่นจำลองไม่โหลด chunk เอง จึงต้องเปิด ticking area ที่ปลายทางก่อนย้าย */
async function loadArea(dim, pos, id = "bpcvisit") {
  const areas = world.tickingAreaManager;
  if (areas.hasTickingArea(id)) areas.removeTickingArea(id);
  await areas.createTickingArea(id, { dimension: dim, from: { x: pos.x - 8, y: pos.y, z: pos.z - 8 }, to: { x: pos.x + 8, y: pos.y, z: pos.z + 8 } });
}
async function go(p, dim, pos, id) {
  await loadArea(dim, pos, id);
  p.teleport(pos, { dimension: dim });
  await wait(140); // ลูปค้นพบเช็คผู้เล่นทุก 60 tick
}
/** ย้ายผู้เล่นไปไบโอม แล้วรอให้ลูปค้นพบเช็ค */
async function visit(p, dim, biome, underground = false) {
  const pos = locate(dim, biome);
  if (!pos) {
    note(`visit ${biome}`, "not found near spawn, skipped");
    return false;
  }
  await go(p, dim, underground ? pos : { x: pos.x, y: 150, z: pos.z });
  return true;
}

async function discovery() {
  const dim = overworld();
  const p = await spawn("Explorer");
  try {
    dim.runCommand("time set 6000");
    dim.runCommand("weather clear");
    await wait(100);
    const here = dim.getBiome(BASE).id.replace("minecraft:", "");
    check(postcards(p).length === 0 && typesOf(p).includes("bpc:album"), "first discovery puts only the album in the inventory", `biome=${here} inv=${JSON.stringify(typesOf(p))}`);
    await takeAll(p);
    check(postcards(p).length === 1, "the first postcard is in the album and can be taken out", JSON.stringify(typesOf(p)));
    const first = inventory(p).find((i) => i.typeId.startsWith("bpc:postcard_"));
    note("postcard lore", JSON.stringify(first?.lore).slice(0, 260));

    // ยืนอยู่ที่เดิม: ไม่ได้การ์ดซ้ำ (ช่องที่ว่างจะได้ใบใหม่ก็ต่อเมื่อลูปเช็คไบโอมอีกครั้ง ซึ่งต้องขยับก่อน)
    await wait(140);
    await takeAll(p);
    check(postcards(p).length === 1, "standing still gives no duplicate");

    const surface = [["minecraft:plains", "plains"], ["minecraft:forest", "forest"], ["minecraft:desert", "desert"], ["minecraft:ocean", "ocean"],
      ["minecraft:cherry_grove", "cherry_grove"], ["minecraft:dappled_forest", "dappled_forest"], ["minecraft:pale_garden", "pale_garden"], ["minecraft:beach", "beach"]];
    for (const [biome, card] of surface) {
      if (!(await visit(p, dim, biome))) continue;
      await takeAll(p);
      check(hasCard(p, card), `discover ${biome}`, `at=${JSON.stringify(found.get(biome))} here=${attemptBiome(p)}`);
    }
    for (const [biome, card] of [["minecraft:lush_caves", "lush_caves"], ["minecraft:dripstone_caves", "dripstone_caves"], ["minecraft:sulfur_caves", "sulfur_caves"], ["minecraft:deep_dark", "deep_dark"]]) {
      if (!(await visit(p, dim, biome, true))) continue;
      await takeAll(p);
      check(hasCard(p, card), `discover ${biome} (3D biome)`, `at=${JSON.stringify(found.get(biome))} here=${attemptBiome(p)}`);
    }
    let before = postcards(p).length;
    if (await visit(p, dim, "minecraft:river")) {
      await takeAll(p);
      check(postcards(p).length === before, "river gives no postcard", `here=${attemptBiome(p)}`);
    }

    // กลับไปไบโอมแรก ซึ่งหยิบใบออกไปแล้ว: ช่องที่ว่างได้ใบใหม่เข้าอัลบั้ม ไม่เข้ากระเป๋า
    before = postcards(p).length;
    p.teleport({ x: 0.5, y: 200, z: -2.5 }, { dimension: dim });
    await wait(140);
    check(postcards(p).length === before, "a new print goes to the album, not the inventory", `${postcards(p).length} vs ${before}`);
    // ขยับในไบโอมเดิมให้ลูปเช็คอีกครั้ง: ช่องเต็มแล้ว จึงได้ใบใหม่แค่ครั้งเดียว
    p.teleport({ x: -2.5, y: 200, z: 2.5 }, { dimension: dim });
    await wait(140);
    await takeAll(p);
    check(postcards(p).length === before + 1, "an empty slot is refilled once, a full slot is not", `${postcards(p).length} vs ${before} + 1 here=${attemptBiome(p)}`);

    // ฟอยล์: กลางคืนกลับไปไบโอมที่มีการ์ดแล้ว ใบในช่องกลายเป็นฟอยล์ครั้งเดียว
    dim.runCommand("time set 15000");
    const target = [...found.keys()].find((b) => b !== "minecraft:river");
    if (target && (await visit(p, dim, target, target.includes("cave") || target.includes("dark")))) {
      await takeAll(p);
      const foil = inventory(p).find((i) => i.typeId.endsWith("_foil"));
      check(Boolean(foil), "night visit turns the postcard in the album into a foil one", `target=${target} inv=${JSON.stringify(postcards(p))}`);
      note("foil lore", JSON.stringify(foil?.lore).slice(0, 300));
    }
    dim.runCommand("time set 6000");

    // มิติอื่น
    for (const [dimId, cards] of [["minecraft:nether", ["nether", "nether_forests"]], ["minecraft:the_end", ["the_end"]]]) {
      try {
        await go(p, world.getDimension(dimId), { x: 0.5, y: 100, z: 0.5 });
        await takeAll(p);
        check(cards.some((c) => hasCard(p, c)), `discover ${dimId}`, `here=${attemptBiome(p)} inv=${JSON.stringify(postcards(p).slice(-3))}`);
      } catch (e) {
        fail(`discover ${dimId}`, String(e));
      }
    }
    world.tickingAreaManager.removeAllTickingAreas();
    p.teleport({ x: 0.5, y: 200, z: -2.5 }, { dimension: dim });
    await wait(40);
    note("explorer total", `${postcards(p).length} postcards: ${postcards(p).map((t) => t.slice(13)).join(" ")}`);
    try {
      p.runCommand("bpc:selftest");
    } catch (e) {
      note("selftest as player", `could not run: ${String(e).slice(0, 100)}`);
    }
    await wait(10);
    pass("discovery done");
  } catch (e) {
    fail("discovery", String(e?.stack ?? e));
  } finally {
    p.disconnect();
  }
}
const attemptBiome = (p) => {
  try {
    return p.dimension.getBiome(p.location).id;
  } catch (e) {
    return `error ${String(e).slice(0, 60)}`;
  }
};

// ผู้เล่นหลายคนพร้อมกัน: ความคืบหน้าแยกกัน
async function multi() {
  const dim = overworld();
  const names = ["Ann", "Ben", "Cat", "Dan"];
  const players = [];
  try {
    for (const [i, name] of names.entries()) players.push(await spawn(name, GameMode.Creative, -1.5 + i));
    if (!found.size) for (const biome of ["minecraft:plains", "minecraft:forest", "minecraft:desert", "minecraft:ocean", "minecraft:beach"]) locate(dim, biome);
    const spots = [...found.entries()].filter(([b]) => !b.includes("cave") && !b.includes("dark") && b !== "minecraft:river").slice(0, 3);
    for (const [i, [, pos]] of spots.entries()) {
      const at = { x: pos.x, y: 150, z: pos.z };
      await loadArea(dim, at, `bpcmulti${i}`);
      players[i + 1].teleport(at, { dimension: dim });
    }
    await wait(200);
    check(players.every((p) => postcards(p).length === 0), "discoveries do not land in the inventory", JSON.stringify(players.map(typesOf)));
    for (const p of players) await takeAll(p);
    const sets = players.map((p) => postcards(p).sort().join(","));
    check(players.every((p) => postcards(p).length >= 1), "every player has their own postcards in their own album", JSON.stringify(sets));
    check(spots.length === 0 || new Set(sets).size > 1, "progress is separate per player", JSON.stringify(sets));
    check(players.every((p) => typesOf(p).filter((t) => t === "bpc:album").length === 1), "one album each");
    pass("multi done");
  } catch (e) {
    fail("multi", String(e?.stack ?? e));
  } finally {
    world.tickingAreaManager.removeAllTickingAreas();
    for (const p of players) p.disconnect();
  }
}

// ตายขณะมีอัลบั้ม: อัลบั้มยังอยู่ โปสการ์ดในอัลบั้มไม่ดรอปและไม่หาย ความคืบหน้าไม่หาย
async function death() {
  const dim = overworld();
  const p = await spawn("Mortal", GameMode.Survival);
  try {
    await wait(100);
    check(postcards(p).length === 0 && typesOf(p).includes("bpc:album"), "survival player gets the album, the postcard stays in it", JSON.stringify(typesOf(p)));
    takeDrops(dim);
    p.kill();
    await wait(40);
    const drops = takeDrops(dim, BASE, 8).map((d) => d.typeId);
    p.respawn();
    await wait(60);
    check(typesOf(p).includes("bpc:album"), "album is kept on death", `inv=${JSON.stringify(typesOf(p))}`);
    check(!drops.some((t) => t.startsWith("bpc:")), "nothing from the add-on drops on death", JSON.stringify(drops));
    p.teleport({ x: 0.5, y: 200, z: -2.5 }, { dimension: dim });
    await wait(140);
    await takeAll(p);
    check(postcards(p).length === 1, "the postcard in the album survives death, and the same biome is not discovered twice", JSON.stringify(typesOf(p)));
    pass("death done");
  } catch (e) {
    fail("death", String(e?.stack ?? e));
  } finally {
    p.disconnect();
  }
}

// ไบโอมใต้ดิน (ไบโอม 3 มิติ): calculateClosestBiomeFromSeed คืนแค่ตำแหน่ง x,z จึงต้องไล่หาความลึกที่เป็นไบโอมนั้นจริง
async function caves() {
  const dim = overworld();
  const p = await spawn("Caver");
  try {
    await wait(100);
    for (const [biome, card] of [["minecraft:lush_caves", "lush_caves"], ["minecraft:dripstone_caves", "dripstone_caves"], ["minecraft:sulfur_caves", "sulfur_caves"], ["minecraft:deep_dark", "deep_dark"]]) {
      const pos = locate(dim, biome);
      if (!pos) {
        note(`visit ${biome}`, "not found near spawn, skipped");
        continue;
      }
      await loadArea(dim, pos);
      let at;
      for (const [dx, dz] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
        for (let y = 60; y >= -60 && !at; y -= 4) {
          try {
            if (dim.getBiome({ x: pos.x + dx, y, z: pos.z + dz }).id === biome) at = { x: pos.x + dx, y, z: pos.z + dz };
          } catch {
            break;
          }
        }
        if (at) break;
      }
      if (!at) {
        note(`visit ${biome}`, `no such biome in the columns around ${JSON.stringify(pos)}`);
        continue;
      }
      p.teleport(at, { dimension: dim });
      await wait(140);
      await takeAll(p);
      check(hasCard(p, card), `discover ${biome} underground`, `at=${JSON.stringify(at)} here=${attemptBiome(p)}`);
    }
    note("caver total", postcards(p).map((t) => t.slice(13)).join(" "));
    pass("caves done");
  } catch (e) {
    fail("caves", String(e?.stack ?? e));
  } finally {
    world.tickingAreaManager.removeAllTickingAreas();
    p.disconnect();
  }
}

export const suites = { board, use, lock, discovery, caves, multi, death };
