// คำสั่งของแอดออน ลงทะเบียนตอน startup
// คำสั่งดีบักใช้ได้เฉพาะผู้ดูแลโลกและต้องเปิด cheats ส่วน /bpc:settings ใช้ได้โดยไม่ต้องเปิด cheats
// callback ของคำสั่งแก้ข้อมูลโลกไม่ได้ งานที่เขียนข้อมูลจึงส่งต่อด้วย system.run
import { BiomeTypes, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, ItemStack, system, world } from "@minecraft/server";
import { DEFAULTS, saveSettings, settings } from "../config.js";
import { MAIN_TOTAL, auditBiomes, lookup } from "../registry/biomeRegistry.js";
import { CARDS, SETS, VERSION } from "../registry/cards.generated.js";
import * as album from "../systems/album.js";
import * as store from "../systems/collectionStore.js";
import * as discovery from "../systems/discovery.js";
import * as feedback from "../systems/feedback.js";
import { cleanPins, listPins } from "../systems/pinBoard.js";
import * as factory from "../systems/postcardFactory.js";
import { openShop } from "../systems/souvenir.js";
import { PAGES } from "../ui/albumForms.js";
import { session } from "../ui/forms.js";
import { openSettings } from "../ui/settingsForm.js";
import { loreFor } from "../util/lore.js";
import { THEMES } from "../util/toastCode.js";

const ok = (message) => ({ status: CustomCommandStatus.Success, message });
const fail = (message) => ({ status: CustomCommandStatus.Failure, message });
const list = (label, items) => (items.length ? `\n${label} (${items.length}): ${items.join(", ")}` : "");
const audit = () => auditBiomes(BiomeTypes.getAll().map((b) => b.id));

/** ห่อ callback ให้ข้อผิดพลาดกลายเป็นข้อความ ไม่ทำให้สคริปต์หยุด */
const safe = (fn) => (origin, ...args) => {
  try {
    return fn(origin, ...args);
  } catch (e) {
    return fail(`bpc error: ${e}`);
  }
};
/** คำสั่งที่ต้องมีผู้เล่นเป็นคนสั่ง งานจริงรันใน tick ถัดไป */
const forPlayer = (startText, work) => (origin) => {
  const player = origin.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return fail("players only");
  system.run(() => {
    try {
      work(player);
    } catch (e) {
      console.warn(`[bpc] command failed: ${e}`);
    }
  });
  return ok(startText);
};

/** ตรวจเส้นทางหลักในเอนจินจริง คืนรายการ [ชื่อ, ผ่านหรือไม่, รายละเอียด] */
function selfTest(player) {
  const results = [];
  const test = (name, fn) => {
    try {
      const detail = fn();
      results.push([name, detail !== false, typeof detail === "string" ? detail : ""]);
    } catch (e) {
      results.push([name, false, String(e)]);
    }
  };
  test("card table matches game biomes", () => {
    const a = audit();
    return a.missing.length ? false : `${a.mapped} biomes`;
  });
  test("world dynamic property", () => {
    world.setDynamicProperty("bpc:selftest", "1");
    const v = world.getDynamicProperty("bpc:selftest");
    world.setDynamicProperty("bpc:selftest", undefined);
    return v === "1";
  });
  test("postcard record round trip", () => {
    const rec = { card: CARDS[0].id, d: 12, x: -880, z: 1302, dim: "o", by: "Tester" };
    const back = factory.toRecord(factory.create(rec));
    return JSON.stringify(back) === JSON.stringify(rec);
  });
  test("every card creates an item", () => {
    for (const c of CARDS) {
      factory.create({ card: c.id });
      if (c.foil) factory.create({ card: c.id, foil: true, st: "night" });
    }
    return `${CARDS.length} cards`;
  });
  test("lore lines", () => `${loreFor({ card: CARDS[0].id, d: 1, x: 2, z: 3, by: "T", st: "storm", kind: "copy", from: "T" }, CARDS[0]).length} lines`);
  test("discovery loop", () => `${world.getAllPlayers().length} players, last tick ${discovery.lastTick()} ms`);
  if (player) {
    test("player dynamic property", () => {
      player.setDynamicProperty("bpc:selftest", "1");
      const v = player.getDynamicProperty("bpc:selftest");
      player.setDynamicProperty("bpc:selftest", undefined);
      return v === "1";
    });
    test("biome lookup here", () => {
      const id = player.dimension.getBiome(player.location).id;
      const hit = lookup(id, settings().mystery);
      return `${id} -> ${hit ? hit.key : "ignored"}`;
    });
    test("collection store", () => {
      const c = store.counts(player);
      return `${c.main}/${MAIN_TOTAL} main, ${c.mystery} mystery, ${c.bonus} special, ${c.foil} foil, in album ${album.slotsIn(player).length}, back pocket ${store.album(player).length}`;
    });
  }
  return results;
}

export function registerCommands(registry) {
  const add = (name, description, fn, cheatsRequired = true) =>
    registry.registerCommand(
      { name: `bpc:${name}`, description, permissionLevel: CommandPermissionLevel.GameDirectors, cheatsRequired },
      safe(fn),
    );

  add("settings", "Biome Postcards: open the settings form", forPlayer("opening settings", (player) => {
    session(player, openSettings).catch((e) => console.warn(`[bpc] settings form failed: ${e}`));
  }), false);

  // ตั้งค่าจากคอนโซลของเซิร์ฟเวอร์ได้ (คอนโซลเปิดฟอร์มไม่ได้): /bpc:config [ชื่อ] [true|false]
  registry.registerEnum("bpc:setting", Object.keys(DEFAULTS));
  registry.registerCommand(
    {
      name: "bpc:config",
      description: "Biome Postcards: show or change a setting",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
      optionalParameters: [
        { name: "bpc:setting", type: CustomCommandParamType.Enum },
        { name: "value", type: CustomCommandParamType.Boolean },
      ],
    },
    safe((origin, key, value) => {
      const now = settings();
      if (key === undefined) return ok(`settings: ${Object.keys(DEFAULTS).map((k) => `${k}=${now[k]}`).join(", ")}`);
      if (!(key in DEFAULTS)) return fail(`unknown setting: ${key}`);
      if (typeof value !== "boolean") return ok(`${key}=${now[key]}`);
      system.run(() => saveSettings(world, { [key]: value }));
      return ok(`${key}=${value}`);
    }),
  );

  // เปิดหน้าฟอร์มตรง ๆ (ใช้ตรวจหน้าจอทีละหน้า): /bpc:open <album|collection|withdraw|sets|copy|shop|settings>
  const pages = { ...PAGES, shop: openShop, settings: openSettings };
  registry.registerEnum("bpc:page", Object.keys(pages));
  registry.registerCommand(
    {
      name: "bpc:open",
      description: "Biome Postcards: open one of the add-on's screens (testing)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
      mandatoryParameters: [{ name: "bpc:page", type: CustomCommandParamType.Enum }],
    },
    safe((origin, page) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return fail("players only");
      if (!(page in pages)) return fail(`unknown page: ${page}`);
      system.run(() => session(player, pages[page]).catch((e) => console.warn(`[bpc] open ${page} failed: ${e}`)));
      return ok(`opening ${page}`);
    }),
  );

  // แสดงการ์ดแจ้งเตือนตัวอย่าง (ใช้ตรวจหน้าตา): /bpc:toast <ธีม | id การ์ด | album | set | all | more> [foil]
  const SAMPLE = { main: 12 };
  const cardFor = (what) => CARDS.find((c) => c.id === what) ?? CARDS.find((c) => c.theme === what);
  const toasts = {
    album: (player, extra) => feedback.albumGiven(player, extra),
    set: (player, extra) => feedback.setComplete(player, SETS[0], extra),
    reward: (player, extra) => feedback.setComplete(player, SETS[0], extra),
    all: (player, extra) => feedback.allSets(player, extra),
    more: (player) => {
      for (let i = 0; i < 12; i++) feedback.discovered(player, CARDS[i % CARDS.length], SAMPLE);
    },
  };
  const toastNames = [...new Set([...THEMES, ...Object.keys(toasts), ...CARDS.map((c) => c.id)])];
  const showToast = (player, what, foil, extra) => {
    if (toasts[what]) return toasts[what](player, extra);
    const card = cardFor(what);
    if (card) feedback.discovered(player, card, SAMPLE, foil, extra);
  };
  registry.registerEnum("bpc:toast_kind", toastNames);
  registry.registerCommand(
    {
      name: "bpc:toast",
      description: "Biome Postcards: show a sample notification card (testing)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
      mandatoryParameters: [{ name: "bpc:toast_kind", type: CustomCommandParamType.Enum }],
      optionalParameters: [{ name: "foil", type: CustomCommandParamType.Boolean }],
    },
    safe((origin, what, foil) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return fail("players only");
      if (!toastNames.includes(what)) return fail(`unknown card: ${what}`);
      system.run(() => showToast(player, what, foil === true));
      return ok(`toast ${what}`);
    }),
  );

  add("demo", "Biome Postcards: show one notification card of every theme (testing)", forPlayer("showing every theme", (player) => {
    for (const what of [...THEMES.filter((t) => t !== "reward"), "album", "set", "all"]) showToast(player, what, false, { demo: true });
  }));

  add("biomes", "Biome Postcards: compare the card table with the game's biome list", () => {
    const a = audit();
    return ok(
      `biomes: game ${a.total}, with card ${a.mapped}, ignored ${a.ignored}` +
        list("mystery (no card in table)", a.unknown) +
        list("MISSING from game", a.missing) +
        list("experimental, not in this world", a.experimentalOff),
    );
  });

  add("here", "Biome Postcards: show the biome you are standing in", (origin) => {
    const player = origin.sourceEntity;
    if (!player) return fail("players only");
    const id = player.dimension.getBiome(player.location).id;
    const hit = lookup(id, settings().mystery);
    return ok(`${id} -> ${hit ? hit.key : "ignored"}`);
  });

  add("giveall", "Biome Postcards: give every postcard (testing)", forPlayer("giving every postcard", (player) => {
    for (const c of CARDS) factory.give(player, factory.create({ card: c.id }));
    factory.give(player, new ItemStack("bpc:album", 1));
  }));

  // หยิบทุกใบออกจากอัลบั้มเข้ากระเป๋า หยุดเมื่อกระเป๋าเต็ม (ชุดทดสอบบนเซิร์ฟเวอร์ใช้ดูว่าอัลบั้มมีอะไร เพราะอ่านข้อมูลของแพ็กนี้ไม่ได้)
  add("takeall", "Biome Postcards: take every postcard out of your album (testing)", forPlayer("taking every postcard out", (player) => {
    for (const key of album.slotsIn(player)) if (album.takeOut(player, key) !== "ok") return;
    for (let pocket = store.album(player); pocket.length; pocket = store.album(player)) {
      if (album.withdraw(player, 0, JSON.stringify(pocket[0])) !== "ok") return;
    }
  }));

  add("reset", "Biome Postcards: clear your own progress", forPlayer("progress cleared", (player) => {
    store.reset(player);
    discovery.forget(player.id);
  }));

  add("debug", "Biome Postcards: toggle the debug action bar", (origin) => {
    const player = origin.sourceEntity;
    if (!player) return fail("players only");
    return ok(`debug ${discovery.toggleDebug(player.id) ? "on" : "off"}`);
  });

  add("selftest", "Biome Postcards: run in-game checks", (origin) => {
    const player = origin.sourceEntity && origin.sourceEntity.typeId === "minecraft:player" ? origin.sourceEntity : undefined;
    system.run(() => {
      const results = selfTest(player);
      const failed = results.filter((r) => !r[1]);
      const lines = results.map(([name, passed, detail]) => `${passed ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
      const text = `[bpc] selftest v${VERSION}: ${results.length - failed.length} passed, ${failed.length} failed\n${lines.join("\n")}`;
      if (player) player.sendMessage(text);
      (failed.length ? console.warn : console.log)(text);
    });
    return ok("selftest started");
  });

  add("pins", "Biome Postcards: list Pin Board records stored in the world", () => {
    const pins = listPins();
    return ok(`pins: ${pins.length}${pins.length ? `\n${pins.join("\n")}` : ""}`);
  });

  add("pinsclean", "Biome Postcards: remove Pin Board records whose board is gone", () => {
    system.run(() => {
      const r = cleanPins();
      console.log(`[bpc] pinsclean: removed ${r.removed}, skipped ${r.skipped} (unloaded)`);
    });
    return ok("pinsclean started");
  });
}
