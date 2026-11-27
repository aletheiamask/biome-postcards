// ลูปค้นพบไบโอม: ระบบเดียวที่ทำงานต่อเนื่อง
// ทุก 20 tick เช็คผู้เล่นกลุ่มเดียวจาก 3 กลุ่ม ผู้เล่นแต่ละคนจึงถูกเช็คทุก 60 tick ไม่ว่าจะมีกี่คน
import { GameMode, world } from "@minecraft/server";
import { CHECK_COHORTS, MIN_MOVE_BLOCKS, MYSTERY_LIMIT, settings } from "../config.js";
import { lookup } from "../registry/biomeRegistry.js";
import { warnOnce } from "../util/log.js";
import { dimCode } from "../util/record.js";
import { giveFirst } from "./album.js";
import * as store from "./collectionStore.js";
import * as feedback from "./feedback.js";
import * as rewards from "./rewards.js";
import { activeFestivals, festivalYear } from "./seasons.js";
import { stampFor } from "./stamps.js";

const lastPos = new Map(); // playerId -> { x, y, z, dim }
const debugPlayers = new Set();
let phase = 0;
let lastTickMs = 0;
let clock = () => new Date(); // วันจริงของเครื่องโฮสต์ ใช้กับการ์ดเทศกาล

/** เปลี่ยนนาฬิกา (ใช้ในเทสต์) ไม่ส่งค่า = กลับไปใช้เวลาจริง */
export const setClock = (fn) => {
  clock = fn ?? (() => new Date());
};

/** เวลาที่ลูปรอบล่าสุดใช้ (มิลลิวินาที) */
export const lastTick = () => lastTickMs;

/** ล้างสถานะในหน่วยความจำทั้งหมด */
export function resetState() {
  lastPos.clear();
  debugPlayers.clear();
  phase = 0;
}

export function tick() {
  const started = Date.now();
  const players = world.getAllPlayers();
  for (let i = phase; i < players.length; i += CHECK_COHORTS) checkSafe(players[i]);
  phase = (phase + 1) % CHECK_COHORTS;
  lastTickMs = Date.now() - started;
  if (debugPlayers.size) showDebug(players);
}

function checkSafe(player) {
  try {
    checkPlayer(player);
  } catch (e) {
    warnOnce(`check:${player.id}`, e); // คนหนึ่งพัง คนอื่นยังทำงานต่อ
  }
}

const isDead = (player) => {
  const health = player.getComponent("minecraft:health");
  return Boolean(health) && health.currentValue <= 0;
};

export function checkPlayer(player) {
  if (!player.isValid) return;
  const mode = player.getGameMode();
  if (mode === GameMode.Spectator) return;
  if (mode === GameMode.Creative && !settings().creative) return;
  if (isDead(player)) return; // ตายหรืออยู่หน้าจอเกิดใหม่: ข้ามจนกว่าจะเกิดใหม่

  const { x, y, z } = player.location;
  const dim = player.dimension.id;
  const prev = lastPos.get(player.id);
  if (prev && prev.dim === dim && Math.abs(prev.x - x) + Math.abs(prev.y - y) + Math.abs(prev.z - z) < MIN_MOVE_BLOCKS) return;

  let biomeId;
  try {
    biomeId = player.dimension.getBiome(player.location).id;
  } catch {
    return; // chunk ยังไม่โหลด: ข้ามรอบนี้ แล้วลองใหม่รอบหน้า
  }
  lastPos.set(player.id, { x, y, z, dim });
  if (store.isReadOnly(player)) return;

  // การ์ดเทศกาลได้ก่อน แล้วรอบถัดไปค่อยเช็คไบโอม
  if (settings().seasonal && grantFestival(player, dim)) {
    lastPos.delete(player.id);
    return;
  }

  const hit = lookup(biomeId, settings().mystery);
  if (!hit) return;
  const owned = store.get(player, hit.key);
  const stamp = settings().foil && hit.card.foil ? stampFor(player) : null;
  const pos = { d: world.getDay(), x: Math.floor(x), z: Math.floor(z), dim: dimCode(dim) };

  if (!owned) {
    if (hit.card.kind === "mystery" && store.counts(player).mystery >= MYSTERY_LIMIT) return;
    const rec = Object.assign({ t: Math.floor(clock().getTime() / 1000) }, pos, stamp ? { foil: true, st: stamp } : {});
    // record นี้คือช่องของการ์ดในอัลบั้ม: โปสการ์ดอยู่ในอัลบั้มทันที ไม่มีไอเท็มเข้ากระเป๋า
    if (!store.add(player, hit.key, rec)) return;
    feedback.discovered(player, hit.card, store.counts(player), Boolean(stamp));
    giveFirst(player);
    if (!hit.card.bonus) rewards.check(player);
    return;
  }
  // มีการ์ดปกติแล้ว: ฟอยล์ได้อีกครั้งเดียวต่อการ์ด ใบในช่องกลายเป็นฟอยล์ และช่องที่ว่างกลับมาเต็ม
  if (stamp && !owned.foil) {
    if (store.update(player, hit.key, { foil: true, st: stamp, out: undefined })) feedback.discovered(player, hit.card, store.counts(player), true);
    return;
  }
  // หยิบออกไปแล้ว (หาย ถูกทำลาย หรือแขวนอยู่ที่ไหนสักแห่ง): กลับมาที่ไบโอมนี้ได้ใบใหม่เข้าช่อง
  if (owned.out && store.update(player, hit.key, { out: undefined })) feedback.restocked(player, hit.card);
}

function grantFestival(player, dim) {
  const now = clock();
  for (const card of activeFestivals(now)) {
    const owned = store.get(player, card.id);
    if (owned) {
      // หยิบออกไปแล้ว: ช่วงเทศกาลได้ใบใหม่เข้าช่อง ไม่ขึ้นการ์ดแจ้งเตือน จึงไม่ต้องหยุดรอบ
      if (owned.out && store.update(player, card.id, { out: undefined })) feedback.restocked(player, card);
      continue;
    }
    const yr = festivalYear(now, card.window);
    if (!store.add(player, card.id, { d: world.getDay(), dim: dimCode(dim), t: Math.floor(now.getTime() / 1000), yr })) return false;
    feedback.discovered(player, card, store.counts(player));
    giveFirst(player);
    return true;
  }
  return false;
}

/** เรียกตอนผู้เล่นออก หรือเมื่อต้องการให้เช็คใหม่ทันที */
export const forget = (playerId) => {
  lastPos.delete(playerId);
  debugPlayers.delete(playerId);
};

/** เปิด/ปิด actionbar ดีบักของผู้เล่น คืนสถานะใหม่ */
export function toggleDebug(playerId) {
  if (debugPlayers.delete(playerId)) return false;
  debugPlayers.add(playerId);
  return true;
}

function showDebug(players) {
  for (const player of players) {
    if (!debugPlayers.has(player.id)) continue;
    try {
      const id = player.dimension.getBiome(player.location).id;
      const hit = lookup(id, settings().mystery);
      player.onScreenDisplay.setActionBar(`${id} -> ${hit ? hit.key : "ignored"} | loop ${lastTickMs} ms`);
    } catch {
      /* chunk ยังไม่โหลด */
    }
  }
}
