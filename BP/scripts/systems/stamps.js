// แสตมป์พิเศษ (ฟอยล์) จากอากาศ เวลา และข้างขึ้นข้างแรม
// Dimension.getWeather ยังเป็น beta จึงจำสภาพอากาศล่าสุดจาก event weatherChange ลง world DP
import { world } from "@minecraft/server";
import { warnOnce } from "../util/log.js";
import { dimCode } from "../util/record.js";

const WX = "bpc:wx:";
const FULL_MOON = 0;
const cache = new Map(); // dim code -> "Clear" | "Rain" | "Thunder"

export function onWeatherChange({ dimension, newWeather }) {
  try {
    const code = dimCode(dimension);
    cache.set(code, newWeather);
    world.setDynamicProperty(WX + code, newWeather);
  } catch (e) {
    warnOnce("weather", e);
  }
}

/** สภาพอากาศล่าสุดที่รู้ ก่อนเกิด event แรกถือว่าฟ้าใส มีอากาศเฉพาะโลกปกติ */
export function weatherOf(dimensionId) {
  const code = dimCode(dimensionId);
  if (code !== "o" || dimensionId !== "minecraft:overworld") return "Clear";
  if (!cache.has(code)) {
    const saved = world.getDynamicProperty(WX + code);
    cache.set(code, typeof saved === "string" ? saved : "Clear");
  }
  return cache.get(code);
}

/** ลำดับ: พายุฟ้าคะนอง > คืนพระจันทร์เต็มดวง > ฝน > กลางคืน คืน null ถ้าไม่มีแสตมป์ */
export function pickStamp({ weather, timeOfDay, moonPhase }) {
  const night = timeOfDay >= 13000 && timeOfDay < 23000;
  if (weather === "Thunder") return "storm";
  if (night && moonPhase === FULL_MOON) return "moon";
  if (weather === "Rain") return "rain";
  if (night) return "night";
  return null;
}

export function stampFor(player) {
  return pickStamp({
    weather: weatherOf(player.dimension.id),
    timeOfDay: world.getTimeOfDay(),
    moonPhase: world.getMoonPhase(),
  });
}

export const forgetWeather = () => cache.clear();
