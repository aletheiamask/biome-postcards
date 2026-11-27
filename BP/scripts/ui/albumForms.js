// หน้าจออัลบั้ม ใช้ฟอร์มมาตรฐานของเกมทั้งหมด ข้อความทุกปุ่มเป็น RawMessage
// ทุกหน้า: ปิดกลางทางแล้วไม่มีอะไรเปลี่ยน และกลับหน้าแรกได้
import { system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { ALBUM_LIMIT } from "../config.js";
import { MAIN, MAIN_TOTAL, MYSTERY_PREFIX, cardById, cardForKey } from "../registry/biomeRegistry.js";
import * as album from "../systems/album.js";
import * as store from "../systems/collectionStore.js";
import * as feedback from "../systems/feedback.js";
import * as rewards from "../systems/rewards.js";
import { warnOnce } from "../util/log.js";
import { msg, raw, tr } from "../util/text.js";
import { pickFromList, session, show } from "./forms.js";

const ICON_LOCK = "textures/ui/bpc_lock";
const ICON_ALBUM = "textures/items/album";
const ICON_BLANK = "textures/items/blank_postcard";
const ICON_SETS = "textures/blocks/decor/traveler_globe";
const cardIcon = (card, foil) => `textures/items/postcards/${card.id}${foil && card.foil ? "_foil" : ""}`;
const cardName = (card) => tr(`bpc.card.${card.id}`);
const backButton = (form) => form.button(msg("bpc.ui.back"));

/** หน้าแรก วนจนกว่าผู้เล่นจะปิด */
export async function openAlbum(player) {
  for (;;) {
    const c = store.counts(player);
    // บรรทัดแรกบอกเจ้าของ: อัลบั้มทุกเล่มเปิดข้อมูลของคนที่เปิด ไม่ใช่ของในเล่ม
    const form = new ActionFormData()
      .title(msg("bpc.ui.album.title"))
      .body(raw(tr("bpc.ui.album.owner", player.name), "\n", tr("bpc.ui.album.body", c.main, MAIN_TOTAL), "\n", tr("bpc.ui.album.body2", c.mystery, c.bonus, c.foil)))
      .button(msg("bpc.ui.album.view"), cardIcon(MAIN[0], false))
      .button(msg("bpc.ui.album.deposit", album.inventoryPostcards(player).length), ICON_ALBUM)
      .button(msg("bpc.ui.album.withdraw", album.slotsIn(player).length + store.album(player).length), ICON_ALBUM)
      .button(msg("bpc.ui.album.sets"), ICON_SETS)
      .button(msg("bpc.ui.album.copy"), ICON_BLANK);
    const res = await show(player, form);
    if (!res) return;
    let keepOpen = true;
    if (res.selection === 0) keepOpen = await collectionPage(player);
    else if (res.selection === 1) depositAll(player);
    else if (res.selection === 2) keepOpen = await withdrawPage(player);
    else if (res.selection === 3) keepOpen = await setsPage(player);
    else keepOpen = await copyPage(player);
    if (!keepOpen) return;
  }
}

// เก็บโปสการ์ดทั้งหมดในกระเป๋า: ใบต้นฉบับกลับเข้าช่อง ใบอื่นเข้าซองท้ายเล่ม (เต็ม = ซองท้ายเล่มไม่มีที่แล้ว)
function depositAll(player) {
  const r = album.depositAll(player);
  if (r.code === "none") feedback.actionBar(player, "bpc.msg.nothing_to_deposit");
  else if (r.code === "full") feedback.actionBar(player, "bpc.msg.album_full", ALBUM_LIMIT);
  else if (r.code === "ok" || r.code === "partial") feedback.actionBar(player, "bpc.msg.deposited", r.count);
}

// รายการในคอลเลกชัน: การ์ดหลักทุกใบตามลำดับ (ยังไม่ได้ = ???) ตามด้วยการ์ดพิเศษที่ได้แล้ว
function collectionEntries(player) {
  const entries = MAIN.map((card) => ({ card, key: card.id, rec: store.get(player, card.id) }));
  for (const key of store.keys(player)) {
    const card = cardForKey(key);
    if (card && card.bonus) entries.push({ card, key, rec: store.get(player, key) });
  }
  return entries;
}

async function collectionPage(player) {
  let page = 0;
  for (;;) {
    const entries = collectionEntries(player);
    const pick = await pickFromList(player, {
      title: "bpc.ui.collection.title",
      count: entries.length,
      page,
      button: (i) => {
        const e = entries[i];
        if (!e.rec) return [msg("bpc.ui.locked"), ICON_LOCK];
        // ช่องที่หยิบออกไปแล้วยังนับว่าค้นพบ แต่บอกไว้ใต้ชื่อ
        return [e.rec.out ? raw(cardName(e.card), "\n", tr("bpc.ui.collection.out")) : raw(cardName(e.card)), cardIcon(e.card, e.rec.foil)];
      },
    });
    if (pick === null) return false;
    if (pick === "back") return true;
    page = pick.page;
    const entry = entries[pick.index];
    if (entry.rec && !(await detailPage(player, entry))) return false;
  }
}

const notifyTake = (player, result) => {
  if (result === "full") feedback.actionBar(player, "bpc.msg.withdraw_full");
};

// รายละเอียดของการ์ด + สถานะของช่องในอัลบั้ม ถ้าใบยังอยู่ในช่องมีปุ่มหยิบออก
async function detailPage(player, { card, key }) {
  const rec = store.get(player, key); // อ่านใหม่ทุกครั้ง สถานะช่องเปลี่ยนได้ระหว่างที่รายการเปิดอยู่
  if (!rec) return true;
  const lines = [];
  if (rec.yr !== undefined) lines.push(tr("bpc.ui.detail.festival", rec.yr));
  else lines.push(tr("bpc.ui.detail.found", rec.d ?? "?"), "\n", tr("bpc.ui.detail.pos", rec.x ?? "?", rec.z ?? "?"));
  if (key.startsWith(MYSTERY_PREFIX)) lines.push("\n", key.slice(MYSTERY_PREFIX.length));
  lines.push("\n", tr(`bpc.rarity.${card.rarity}`));
  if (rec.foil && rec.st) lines.push("\n", tr("bpc.ui.detail.foil", tr(`bpc.stamp.${rec.st}`)));
  const outKey = rec.yr !== undefined ? "bpc.ui.detail.out_festival" : "bpc.ui.detail.out";
  lines.push("\n", tr(rec.out ? outKey : "bpc.ui.detail.in_album"));
  const form = new ActionFormData().title(raw(cardName(card))).body(raw(...lines));
  if (!rec.out) form.button(msg("bpc.ui.detail.take"), cardIcon(card, rec.foil));
  const res = await show(player, backButton(form));
  if (!res) return false;
  if (!rec.out && res.selection === 0) notifyTake(player, album.takeOut(player, key));
  return true;
}

// หยิบออก: ช่องของการ์ดที่ยังมีใบอยู่ ตามด้วยโปสการ์ดในซองท้ายเล่ม กดทีละใบได้ต่อเนื่อง
async function withdrawPage(player) {
  let page = 0;
  for (;;) {
    const slots = album.slotsIn(player).map((key) => ({ key, card: cardForKey(key), foil: store.get(player, key).foil }));
    const pocket = store.album(player).map((rec, index) => ({ rec, index, card: cardById(rec.card), foil: rec.foil }));
    const entries = slots.concat(pocket);
    const pick = await pickFromList(player, {
      title: "bpc.ui.withdraw.title",
      body: msg("bpc.ui.withdraw.body"),
      count: entries.length,
      page,
      button: (i) => {
        const e = entries[i];
        return [e.rec ? raw(cardName(e.card), "\n", tr("bpc.ui.take.pocket")) : raw(cardName(e.card)), cardIcon(e.card, e.foil)];
      },
    });
    if (pick === null) return false;
    if (pick === "back") return true;
    page = pick.page;
    const e = entries[pick.index];
    notifyTake(player, e.rec ? album.withdraw(player, e.index, JSON.stringify(e.rec)) : album.takeOut(player, e.key));
  }
}

async function copyPage(player) {
  let page = 0;
  for (;;) {
    const entries = collectionEntries(player).filter((e) => e.rec);
    const pick = await pickFromList(player, {
      title: "bpc.ui.copy.title",
      body: msg("bpc.ui.copy.body"),
      count: entries.length,
      page,
      button: (i) => [raw(cardName(entries[i].card)), cardIcon(entries[i].card, false)],
    });
    if (pick === null) return false;
    if (pick === "back") return true;
    page = pick.page;
    const entry = entries[pick.index];
    const confirm = new MessageFormData()
      .title(raw(cardName(entry.card)))
      .body(msg("bpc.ui.copy.confirm"))
      .button1(msg("bpc.ui.copy.yes"))
      .button2(msg("bpc.ui.cancel"));
    const res = await show(player, confirm);
    if (!res) return false;
    if (res.selection !== 0) continue;
    const result = album.makeCopy(player, entry.key);
    if (result === "ok") feedback.actionBar(player, "bpc.msg.copy_made");
    else if (result === "need_blank") feedback.actionBar(player, "bpc.msg.need_blank");
    else if (result === "full") feedback.actionBar(player, "bpc.msg.withdraw_full");
  }
}

async function setsPage(player) {
  const lines = [];
  for (const { set, have, total, done } of rewards.progress(player)) {
    if (lines.length) lines.push("\n");
    lines.push(done ? tr("bpc.ui.sets.done", tr(`bpc.set.${set.id}`)) : tr("bpc.ui.sets.row", tr(`bpc.set.${set.id}`), have, total));
  }
  const form = backButton(new ActionFormData().title(msg("bpc.ui.sets.title")).body(raw(...lines)));
  return Boolean(await show(player, form));
}

/** หน้าที่เปิดตรงได้จากคำสั่งดีบัก /bpc:open */
export const PAGES = { album: openAlbum, collection: collectionPage, withdraw: withdrawPage, sets: setsPage, copy: copyPage };

/** ใช้อัลบั้ม: เปิดหน้าแรกใน tick ถัดไป ให้การใช้ไอเท็มจบก่อน */
export function useAlbum(player) {
  system.run(() => session(player, openAlbum).catch((e) => warnOnce("album-ui", e)));
}
