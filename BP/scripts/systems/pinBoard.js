// Pin Board: แขวน ถอด และดรอปโปสการ์ด
// ภาพบนบอร์ดมาจาก block state (เลขการ์ด = page × 16 + slot, 0 = ว่าง)
// รายละเอียดของใบที่แขวนเก็บใน world DP ตามตำแหน่งบอร์ด: { r: record, by: ชื่อคนแขวน, id: player id }
import { EquipmentSlot, system, world } from "@minecraft/server";
import { settings } from "../config.js";
import { cardByBoard, cardById } from "../registry/biomeRegistry.js";
import { warnOnce } from "../util/log.js";
import { dimCode, dimensionIdOf, normalize } from "../util/record.js";
import { readJson, removeKey, writeJson } from "../util/storage.js";
import { msg } from "../util/text.js";
import * as factory from "./postcardFactory.js";

const PAGE = "bpc:page";
const SLOT = "bpc:slot";
const FOIL = "bpc:foil";
export const PIN_PREFIX = "bpc:pin:";
const RETURN_PREFIX = "bpc:ret:"; // โปสการ์ดที่รอคืนเจ้าของ (เมื่อเปิด ownerLock)
const RETURN_LIMIT = 64;
export const BOARD_ID = "bpc:pin_board";

export const pinKey = (dimensionId, { x, y, z }) => `${PIN_PREFIX}${dimCode(dimensionId)}:${x},${y},${z}`;
export const boardIndex = (perm) => (perm.getState(PAGE) ?? 0) * 16 + (perm.getState(SLOT) ?? 0);
const withCard = (perm, index, foil) => perm.withState(PAGE, index >> 4).withState(SLOT, index & 15).withState(FOIL, Boolean(foil));

/**
 * การ์ดที่แขวนอยู่ (อ่านอย่างเดียว) ยึด state ของบล็อกเป็นหลัก แล้วเติมรายละเอียดจาก world DP ถ้าตรงกัน
 * stale = มี DP ค้างที่ไม่ตรงกับบอร์ด (เช่นบอร์ดว่างหลัง /setblock) ผู้เรียกควรลบ
 */
function readPinned(perm, key) {
  const index = boardIndex(perm);
  const saved = readJson(world, key, null);
  const card = index ? cardByBoard(index) : undefined;
  if (!card) return { pinned: null, stale: Boolean(saved) };
  const same = Boolean(saved && saved.r && saved.r.card === card.id);
  const rec = normalize(Object.assign({}, same ? saved.r : {}, { card: card.id, foil: Boolean(perm.getState(FOIL)) }));
  return { pinned: { rec, by: same ? saved.by : undefined, id: same ? saved.id : undefined }, stale: Boolean(saved) && !same };
}

const lockedFor = (pinned, playerId) => settings().ownerLock && Boolean(pinned.id) && pinned.id !== playerId;

function interact({ block, player }) {
  if (!player) return;
  const hand = player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  if (!hand) return;
  const key = pinKey(block.dimension.id, block.location);
  const item = hand.getItem();
  const { pinned, stale } = readPinned(block.permutation, key);
  if (stale) removeKey(world, key);

  if (!pinned) {
    const rec = item ? factory.toRecord(item) : null;
    if (!rec) return;
    if (!writeJson(world, key, { r: rec, by: player.name, id: player.id })) return;
    block.setPermutation(withCard(block.permutation, cardById(rec.card).board, rec.foil));
    hand.setItem(undefined); // โปสการ์ดซ้อนไม่ได้ จึงหมดพอดี
    return;
  }
  if (item) return; // ต้องมือเปล่าจึงถอดได้
  if (lockedFor(pinned, player.id)) {
    player.onScreenDisplay.setActionBar(msg("bpc.msg.board_locked", pinned.by ?? "?"));
    return;
  }
  removeKey(world, key);
  block.setPermutation(withCard(block.permutation, 0, false));
  factory.give(player, factory.create(pinned.rec));
}

/** คืนโปสการ์ดให้เจ้าของ: ออนไลน์อยู่ก็ให้เลย ไม่อยู่ก็เก็บไว้ให้ตอนเข้าโลกครั้งหน้า */
function returnToOwner(pinned) {
  const owner = world.getAllPlayers().find((p) => p.id === pinned.id);
  if (owner) {
    factory.give(owner, factory.create(pinned.rec));
    return true;
  }
  const key = `${RETURN_PREFIX}${pinned.id}`;
  const waiting = readJson(world, key, []);
  if (!Array.isArray(waiting) || waiting.length >= RETURN_LIMIT) return false;
  waiting.push(pinned.rec);
  return writeJson(world, key, waiting);
}

// ทุกสาเหตุที่บอร์ดแตก รวมระเบิดและคำสั่ง: คืนโปสการ์ดและไม่ทิ้ง DP ค้าง
function broken({ block, brokenBlockPermutation, dimension, entitySource }) {
  const key = pinKey(dimension.id, block.location);
  const { pinned } = readPinned(brokenBlockPermutation, key);
  removeKey(world, key);
  if (!pinned) return;
  // เปิด ownerLock: คนอื่นทุบหรือระเบิดบอร์ดแล้วต้องไม่ได้โปสการ์ดไป (กฎเดียวกับการแตะถอด)
  if (lockedFor(pinned, entitySource ? entitySource.id : undefined) && returnToOwner(pinned)) return;
  dimension.spawnItem(factory.create(pinned.rec), { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 });
}

/** world.beforeEvents.playerBreakBlock: เปิด ownerLock แล้วคนอื่นทุบบอร์ดที่มีการ์ดไม่ได้ */
export function guardBreak(e) {
  try {
    if (!settings().ownerLock || e.block.typeId !== BOARD_ID) return;
    const { pinned } = readPinned(e.block.permutation, pinKey(e.dimension.id, e.block.location));
    if (!pinned || !lockedFor(pinned, e.player.id)) return;
    e.cancel = true;
    const player = e.player;
    const by = pinned.by ?? "?";
    system.run(() => {
      try {
        player.onScreenDisplay.setActionBar(msg("bpc.msg.board_locked", by));
      } catch {
        /* ผู้เล่นออกไปแล้ว */
      }
    });
  } catch (err) {
    warnOnce("pin-guard", err);
  }
}

/** ผู้เล่นเข้าโลก: ให้โปสการ์ดที่รอคืน */
export function deliverReturns(player) {
  const key = `${RETURN_PREFIX}${player.id}`;
  const waiting = readJson(world, key, null);
  if (!Array.isArray(waiting)) return 0;
  removeKey(world, key);
  let given = 0;
  for (const raw of waiting) {
    const rec = normalize(raw);
    if (!rec) continue;
    factory.give(player, factory.create(rec));
    given++;
  }
  return given;
}

export function registerPinBoardComponent(registry) {
  registry.registerCustomComponent(BOARD_ID, {
    onPlayerInteract(e) {
      try {
        interact(e);
      } catch (err) {
        warnOnce("pin-interact", err);
      }
    },
    onBreak(e) {
      try {
        broken(e);
      } catch (err) {
        warnOnce("pin-break", err);
      }
    },
  });
}

/** รายการ DP ของบอร์ดทั้งโลก ใช้ใน /bpc:pins */
export function listPins() {
  return world.getDynamicPropertyIds().filter((id) => id.startsWith(PIN_PREFIX) && !id.endsWith("_bak"));
}

/** ล้าง DP ของบอร์ดที่บล็อกหายไปแล้ว ตรวจได้เฉพาะ chunk ที่โหลดอยู่ */
export function cleanPins() {
  let removed = 0;
  let skipped = 0;
  for (const key of listPins()) {
    const rest = key.slice(PIN_PREFIX.length);
    const cut = rest.lastIndexOf(":");
    const [x, y, z] = rest.slice(cut + 1).split(",").map(Number);
    let block;
    try {
      block = world.getDimension(dimensionIdOf(rest.slice(0, cut))).getBlock({ x, y, z });
    } catch {
      block = undefined;
    }
    if (!block) {
      skipped++;
      continue;
    }
    if (block.typeId !== BOARD_ID || boardIndex(block.permutation) === 0) {
      removeKey(world, key);
      removed++;
    }
  }
  return { removed, skipped };
}
