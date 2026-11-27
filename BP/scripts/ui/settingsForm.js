// ฟอร์มตั้งค่าของแอดมิน (/bpc:settings) ค่าเก็บใน world DP bpc:cfg
import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { saveSettings, settings } from "../config.js";
import * as feedback from "../systems/feedback.js";
import { msg } from "../util/text.js";
import { show } from "./forms.js";

// ลำดับปุ่มในฟอร์ม = ลำดับของ formValues
const FIELDS = [
  ["creative", "bpc.ui.settings.creative"],
  ["mystery", "bpc.ui.settings.mystery"],
  ["seasonal", "bpc.ui.settings.seasonal"],
  ["foil", "bpc.ui.settings.foil"],
  ["ownerLock", "bpc.ui.settings.owner_lock"],
  ["toast", "bpc.ui.settings.toast"],
];

export async function openSettings(player) {
  const now = settings();
  const form = new ModalFormData().title(msg("bpc.ui.settings.title"));
  for (const [name, key] of FIELDS) form.toggle(msg(key), { defaultValue: now[name] });
  const res = await show(player, form);
  if (!res || !res.formValues) return;
  const patch = {};
  FIELDS.forEach(([name], i) => {
    if (typeof res.formValues[i] === "boolean") patch[name] = res.formValues[i];
  });
  if (saveSettings(world, patch)) feedback.actionBar(player, "bpc.msg.settings_saved");
}
