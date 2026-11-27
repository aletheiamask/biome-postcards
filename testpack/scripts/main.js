// แพ็กทดสอบ (ไม่แจกจ่าย) รันบน BDS ผ่าน tools/bds.mjs
// สั่งจากคอนโซล: scriptevent bpctest:run <ชื่อชุดทดสอบ>
import { BiomeTypes, BlockPermutation, ItemStack, system, world } from "@minecraft/server";
import { GAMETEST, LOOK } from "./flags.js";
import { BASE, check, fail, note, overworld, pass, setBoard, takeDrops, wait } from "./lib.js";

const attempt = (fn) => {
  try {
    return `ok ${JSON.stringify(fn() ?? null).slice(0, 110)}`;
  } catch (e) {
    return `throw ${String(e).slice(0, 110)}`;
  }
};

// ---------- probe: ข้อสมมติของ API ที่สถาปัตยกรรมพึ่ง ----------
async function probe() {
  const lore = (lines) => attempt(() => {
    const it = new ItemStack("bpc:postcard_plains", 1);
    it.setLore(lines);
    return it.getLore();
  });
  note("lore ascii 50", lore(["x".repeat(50)]));
  note("lore ascii 51", lore(["x".repeat(51)]));
  note("lore thai 17", lore(["ก".repeat(17)]));
  note("lore thai 50", lore(["ก".repeat(50)]));
  note("lore thai 51", lore(["ก".repeat(51)]));
  note("lore 20 lines", lore(Array(20).fill("a")).slice(0, 12));
  note("lore 21 lines", lore(Array(21).fill("a")).slice(0, 40));
  note("lore raw translate", lore([{ rawtext: [{ translate: "bpc.lore.found", with: ["99999", "-30000000", "-30000000"] }] }]));
  note("lore raw long arg", lore([{ rawtext: [{ translate: "bpc.lore.by", with: ["x".repeat(60)] }] }]));
  note("getRawLore", attempt(() => {
    const it = new ItemStack("bpc:postcard_plains", 1);
    it.setLore([{ rawtext: [{ translate: "bpc.lore.unknown" }] }]);
    return typeof it.getRawLore === "function" ? it.getRawLore() : "no getRawLore";
  }));

  note("item dp unstackable", attempt(() => {
    const it = new ItemStack("bpc:postcard_plains", 1);
    it.setDynamicProperty("t:rec", '{"card":"plains"}');
    return it.getDynamicProperty("t:rec");
  }));
  note("item dp stackable", attempt(() => {
    const it = new ItemStack("bpc:blank_postcard", 1);
    it.setDynamicProperty("t:rec", "x");
    return it.getDynamicProperty("t:rec");
  }));
  note("item flags", attempt(() => {
    const it = new ItemStack("bpc:album", 1);
    it.keepOnDeath = true;
    return { keep: it.keepOnDeath, max: it.maxAmount, tags: new ItemStack("bpc:postcard_plains_foil", 1).getTags() };
  }));
  note("world dp", attempt(() => {
    world.setDynamicProperty("t:probe", "1");
    const v = world.getDynamicProperty("t:probe");
    world.setDynamicProperty("t:probe", undefined);
    return [v, world.getDynamicProperty("t:probe") ?? "removed"];
  }));
  note("big dp 32767", attempt(() => {
    world.setDynamicProperty("t:big", "a".repeat(32767));
    world.setDynamicProperty("t:big", undefined);
    return "ok";
  }));
  note("big dp 32768", attempt(() => {
    world.setDynamicProperty("t:big", "a".repeat(32768));
    world.setDynamicProperty("t:big", undefined);
    return "ok";
  }));
  note("time", attempt(() => ({ day: world.getDay(), tod: world.getTimeOfDay(), moon: world.getMoonPhase() })));
  note("biome types", attempt(() => ({
    dappled: BiomeTypes.get("minecraft:dappled_forest")?.id,
    sulfur: BiomeTypes.get("minecraft:sulfur_caves")?.id,
    plainsTags: BiomeTypes.get("minecraft:plains")?.getTags?.(),
  })));
  note("perm ok", attempt(() => BlockPermutation.resolve("bpc:pin_board", { "bpc:page": 3, "bpc:slot": 15, "bpc:foil": true }).getAllStates()));
  note("perm bad slot", attempt(() => BlockPermutation.resolve("bpc:pin_board", { "bpc:slot": 16 }).getAllStates()));

  // บอร์ดแตกด้วยสาเหตุต่าง ๆ ต้องคืนโปสการ์ด (การ์ดเลข 6 = cherry_grove)
  const dim = overworld();
  note("biome at base", attempt(() => dim.getBiome(BASE).id));
  const breakBy = async (name, action, expectDrop = true) => {
    try {
      takeDrops(dim);
      setBoard(dim, BASE, 6);
      await wait(2);
      await action();
      await wait(10);
      const drops = takeDrops(dim).map((d) => d.typeId);
      const got = drops.includes("bpc:postcard_cherry_grove");
      check(got === expectDrop, `board break: ${name}`, `drops=${JSON.stringify(drops)} block=${dim.getBlock(BASE)?.typeId}`);
    } catch (e) {
      fail(`board break: ${name}`, String(e));
    }
  };
  await breakBy("setblock destroy", () => dim.runCommand("setblock 0 200 0 air destroy"));
  await breakBy("explosion", () => dim.createExplosion({ x: 0.5, y: 200.5, z: -1.5 }, 3, { breaksBlocks: true }));
  await breakBy("fill destroy", () => dim.runCommand("fill 0 200 0 0 200 0 air destroy"));
  await breakBy("setblock replace", () => dim.runCommand("setblock 0 200 0 air"));
  await breakBy("script setBlockType", () => dim.setBlockType(BASE, "minecraft:air"));
  // ลูกสูบต้องดันบอร์ดไม่ได้ (immovable)
  try {
    setBoard(dim, BASE, 6);
    dim.runCommand('setblock 0 200 2 piston ["facing_direction"=2]');
    await wait(2);
    dim.runCommand("setblock 0 200 3 redstone_block");
    await wait(20);
    check(dim.getBlock(BASE)?.typeId === "bpc:pin_board", "piston cannot move board", `block=${dim.getBlock(BASE)?.typeId} z-1=${dim.getBlock({ x: 0, y: 200, z: -1 })?.typeId}`);
    dim.runCommand("fill 0 200 -1 0 200 3 air");
  } catch (e) {
    fail("piston cannot move board", String(e));
  }
  takeDrops(dim);
  pass("probe done");
}

const suites = { probe };
if (GAMETEST) {
  import("./sim.js")
    .then((sim) => Object.assign(suites, sim.suites))
    .catch((e) => fail("load sim.js", String(e?.stack ?? e)));
}
if (LOOK) {
  import("./look.js")
    .then((look) => Object.assign(suites, look.suites))
    .catch((e) => fail("load look.js", String(e?.stack ?? e)));
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "bpctest:run") return;
  // "ชื่อชุด อาร์กิวเมนต์ ..." อาร์กิวเมนต์ส่งให้ชุดทดสอบเป็นอาร์เรย์
  const [name, ...args] = e.message.trim().split(/\s+/);
  const run = suites[name];
  if (!run) {
    fail("unknown suite", `${name} (have: ${Object.keys(suites).join(", ")})`);
    console.log(`[bpctest] END ${name}`);
    return;
  }
  // END ออกเสมอ ไม่ว่าชุดทดสอบจะผ่านหรือพัง ให้ tools/bds.mjs รู้ว่าไปต่อได้
  run(args)
    .catch((err) => fail(name, String(err?.stack ?? err)))
    .then(() => console.log(`[bpctest] END ${name}`));
});

world.afterEvents.worldLoad.subscribe(() => note("testpack", `ready, gametest=${GAMETEST}, suites=${Object.keys(suites).join(",")}`));
