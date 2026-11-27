// การ์ดเทศกาลตามวันจริงของเครื่องโฮสต์ (UTC) โมดูลบริสุทธิ์ ห้าม import @minecraft/server
import { FESTIVALS } from "../registry/biomeRegistry.js";

const monthDay = (date) => (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
const parse = (mmdd) => Number(mmdd.slice(0, 2)) * 100 + Number(mmdd.slice(3));

/** วันนี้อยู่ในช่วง [from, to] (รูปแบบ "MM-DD" รวมวันปลาย) หรือไม่ รองรับช่วงที่ข้ามปี */
export function inWindow(date, [from, to]) {
  const d = monthDay(date);
  const a = parse(from);
  const b = parse(to);
  return a <= b ? d >= a && d <= b : d >= a || d <= b;
}

/** การ์ดเทศกาลที่กำลังอยู่ในช่วง */
export const activeFestivals = (date) => FESTIVALS.filter((c) => inWindow(date, c.window));

/** ปีที่เขียนบนการ์ด ช่วงที่ข้ามปี (เช่นปีใหม่) นับเป็นปีที่กำลังจะถึง */
export function festivalYear(date, [from, to]) {
  const year = date.getUTCFullYear();
  return parse(from) > parse(to) && monthDay(date) >= parse(from) ? year + 1 : year;
}
