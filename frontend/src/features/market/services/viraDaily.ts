/**
 * Bản tin Kinh tế - Tài chính NGÀY của VIRA (Hội Nghiên cứu thị trường liên ngân hàng VN) — đọc tự động.
 *  - Lãi suất bình quân liên ngân hàng VND theo kỳ hạn: ON (qua đêm), 1W, 2W, 1M của phiên hôm trước.
 *  - Nghiệp vụ thị trường mở (OMO) của NHNN: trúng thầu, đáo hạn, bơm/hút ròng, dư lưu hành, lãi suất.
 * Trang: https://vira.org.vn/tin/Ban-tin-Kinh-te-Tai-chinh-ngay.html (không bị chặn như sbv.gov.vn).
 * Đối chiếu 19/11/2026: ON 4,70% (NHNN công bố 4,68%), NHNN bơm ròng 890 tỷ, lãi OMO 4,5%.
 * Số của VIRA là bình quân phiên hôm trước, trễ 1 ngày làm việc so với NHNN.
 */

export interface ViraDaily {
  /** Ngày phiên của số liệu, dạng dd/mm/yyyy */
  sessionDate: string | null;
  /** Ngày đăng bản tin, dạng dd/mm/yyyy */
  bulletinDate: string;
  rates: { on: number; w1: number | null; w2: number | null; m1: number | null } | null;
  omo: {
    /** >0: NHNN bơm ròng; <0: hút ròng (tỷ đồng) */
    netVnd: number;
    /** Dư lưu hành trên kênh cầm cố (tỷ đồng) */
    outstanding: number | null;
    /** Lãi suất trúng thầu (%/năm) */
    rate: number | null;
  } | null;
  source: string;
}

const UA = { 'User-Agent': 'Mozilla/5.0' };
const BASE = 'https://vira.org.vn';
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

// Trang mã hóa chữ có dấu thành &agrave; &atilde;... (tên thực thể Latin-1, mã từ 160) hoặc &#NNN;
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ');
const ENTITY: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };
LATIN1.forEach((n, i) => (ENTITY[n] = String.fromCharCode(160 + i)));

export const toText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENTITY[n] ?? m)
    .replace(/\s+/g, ' ');

/** Rút lãi suất & OMO từ chữ của một bản tin ngày. Thiếu mục nào thì mục đó là null. */
export function parseViraDaily(text: string, bulletinDate: string): Omit<ViraDaily, 'source'> {
  const year = bulletinDate.slice(6);
  let rates: ViraDaily['rates'] = null;
  let sessionDate: string | null = null;

  const at = text.search(/lãi suất bình quân LNH VND/i);
  if (at >= 0) {
    const seg = text.slice(Math.max(0, at - 60), at + 420);
    const d = /Ngày (\d{1,2})\/(\d{1,2})/.exec(seg);
    if (d) sessionDate = `${d[1].padStart(2, '0')}/${d[2].padStart(2, '0')}/${year}`;
    const get = (k: string) => {
      const m = new RegExp(`${k} ([0-9]+(?:,[0-9]+)?)%`).exec(seg);
      return m ? num(m[1]) : null;
    };
    const on = get('ON');
    if (on !== null && on > 0 && on < 20) rates = { on, w1: get('1W'), w2: get('2W'), m1: get('1M') };
  }

  let omo: ViraDaily['omo'] = null;
  const o = text.search(/Nghiệp vụ thị trường mở:/);
  if (o >= 0) {
    const seg = text.slice(o, o + 900);
    const net = /NHNN (bơm|hút) ròng ([0-9.,]+) tỷ/.exec(seg);
    if (net) {
      const v = num(net[2]);
      const out = /Có ([0-9.,]+) tỷ đồng lưu hành/.exec(seg);
      const rate = /lãi suất đều ở mức ([0-9,]+)%/.exec(seg);
      omo = { netVnd: net[1] === 'bơm' ? v : -v, outstanding: out ? num(out[1]) : null, rate: rate ? num(rate[1]) : null };
    }
  }
  return { sessionDate, bulletinDate, rates, omo };
}

/** Bản tin mới nhất (theo ngày trong đường dẫn) → lãi liên NH theo kỳ hạn + OMO */
export async function fetchViraDaily(): Promise<ViraDaily | null> {
  try {
    const list = await fetch(`${BASE}/tin/Ban-tin-Kinh-te-Tai-chinh-ngay.html`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!list.ok) return null;
    const html = await list.text();
    const links = [...new Set([...html.matchAll(/href="(\/tin\/Ban-tin-Kinh-te-Tai-chinh-ngay\/Ban-tin-Kinh-te-Tai-chinh-ngay-(\d{2})-(\d{2})-(\d{4})-?\.html)"/g)].map((m) => ({ url: m[1], key: `${m[4]}${m[3]}${m[2]}`, date: `${m[2]}/${m[3]}/${m[4]}` })))];
    links.sort((a, b) => b.key.localeCompare(a.key));
    // Bản mới nhất có thể chưa đủ mục: thử tối đa 3 bản gần nhất, lấy bản đầu tiên có lãi suất
    for (const l of links.slice(0, 3)) {
      const res = await fetch(`${BASE}${l.url}`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const parsed = parseViraDaily(toText(await res.text()), l.date);
      if (parsed.rates) return { ...parsed, source: `VIRA, bản tin ngày ${l.date}` };
    }
    return null;
  } catch {
    return null;
  }
}
