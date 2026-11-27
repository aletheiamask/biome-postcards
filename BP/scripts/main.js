// จุดเริ่มของแอดออน: ที่เดียวที่ผูก event ของเกม
import { BiomeTypes, system, world } from "@minecraft/server";
import { CHECK_INTERVAL_TICKS, loadSettings } from "./config.js";
import { registerCommands } from "./dev/commands.js";
import { auditBiomes } from "./registry/biomeRegistry.js";
import { VERSION } from "./registry/cards.generated.js";
import * as store from "./systems/collectionStore.js";
import * as discovery from "./systems/discovery.js";
import { onItemUse } from "./systems/itemUse.js";
import * as notify from "./systems/notify.js";
import * as pinBoard from "./systems/pinBoard.js";
import { registerSouvenirComponent } from "./systems/souvenir.js";
import { onWeatherChange } from "./systems/stamps.js";
import { endSession } from "./ui/forms.js";
import { info, warnOnce } from "./util/log.js";

// ลงทะเบียน custom component ของบล็อกและคำสั่ง (ทำได้ตอน startup เท่านั้น) ไอเท็มไม่ใช้ custom component (ดู systems/itemUse.js)
system.beforeEvents.startup.subscribe((e) => {
  pinBoard.registerPinBoardComponent(e.blockComponentRegistry);
  registerSouvenirComponent(e.blockComponentRegistry);
  registerCommands(e.customCommandRegistry);
});

// โลกพร้อมแล้ว: โหลดค่าตั้งค่า อัปเกรด schema ตรวจตารางการ์ด และเริ่มลูปค้นพบ
world.afterEvents.worldLoad.subscribe(() => {
  try {
    loadSettings(world);
    store.migrateWorld();
    const audit = auditBiomes(BiomeTypes.getAll().map((b) => b.id));
    if (audit.missing.length) warnOnce("registry-missing", `biome ids not in this game: ${audit.missing.join(", ")}`);
    info(`v${VERSION} loaded: ${audit.mapped} biomes with cards, ${audit.unknown.length} without`);
  } catch (e) {
    warnOnce("world-load", e);
  }
  system.runInterval(discovery.tick, CHECK_INTERVAL_TICKS);
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  try {
    store.welcome(player);
    pinBoard.deliverReturns(player);
  } catch (e) {
    warnOnce("player-spawn", e);
  }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  store.unload(playerId);
  discovery.forget(playerId);
  notify.forget(playerId);
  endSession(playerId);
});

world.afterEvents.itemUse.subscribe(onItemUse);
world.afterEvents.weatherChange.subscribe(onWeatherChange);
world.beforeEvents.playerBreakBlock.subscribe(pinBoard.guardBreak);
