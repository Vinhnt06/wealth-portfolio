/**
 * Lịch sử động thái NHNN từ bản tin Kinh tế - Tài chính NGÀY của VIRA (bản JS của
 * frontend/src/features/market/services/viraDaily.ts, dùng cho cron).
 * Mỗi phiên một dòng trong macroDatabase.json → nhnnHistory:
 *   { date: 'yyyy-mm-dd' (phiên), on, w1, w2, m1 (lãi liên NH VND %/năm),
 *     omoNet (tỷ đồng, >0 bơm ròng, <0 hút ròng), omoOutstanding, omoRate }
 * Nguồn thật, không nhập tay. Phiên nào bản tin thiếu mục thì để null, không bịa.
 */

const BASE = 'https://vira.org.vn';
const UA = { 'User-Agent': 'Mozilla/5.0' };
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ');
const ENTITY = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };
LATIN1.forEach((n, i) => (ENTITY[n] = String.fromCharCode(160 + i)));

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z0-9]+);/g, (m, n) => (ENTITY[n] !== undefined ? ENTITY[n] : m))
    .replace(/\s+/g, ' ');
}

/** bulletin: {d, m, y} của ngày đăng. Trả về dòng lịch sử hoặc null nếu không có lãi suất. */
function parseBulletin(text, bulletin) {
  const at = text.search(/lãi suất bình quân LNH VND/i);
  if (at < 0) return null;
  const seg = text.slice(Math.max(0, at - 60), at + 420);
  const d = /Ngày (\d{1,2})\/(\d{1,2})/.exec(seg);
  if (!d) return null;
  const day = Number(d[1]);
  const month = Number(d[2]);
  const year = month > bulletin.m ? bulletin.y - 1 : bulletin.y; // bản tin tháng 1 nói về phiên cuối tháng 12
  const get = (k) => {
    const m = new RegExp(`${k} ([0-9]+(?:,[0-9]+)?)%`).exec(seg);
    return m ? num(m[1]) : null;
  };
  const on = get('ON');
  if (on === null || !(on > 0 && on < 20)) return null;
  const row = {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    on,
    w1: get('1W'),
    w2: get('2W'),
    m1: get('1M'),
    omoNet: null,
    omoOutstanding: null,
    omoRate: null,
  };
  const o = text.search(/Nghiệp vụ thị trường mở:/);
  if (o >= 0) {
    const s2 = text.slice(o, o + 900);
    const net = /NHNN (bơm|hút) ròng ([0-9.,]+) tỷ/.exec(s2);
    if (net) {
      const v = num(net[2]);
      row.omoNet = net[1] === 'bơm' ? v : -v;
      const out = /Có ([0-9.,]+) tỷ đồng lưu hành/.exec(s2);
      const rate = /lãi suất đều ở mức ([0-9,]+)%/.exec(s2);
      row.omoOutstanding = out ? num(out[1]) : null;
      row.omoRate = rate ? num(rate[1]) : null;
    }
  }
  return row;
}

async function getText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Danh sách bản tin ngày (mới → cũ) trên `pages` trang đầu */
async function listBulletins(pages) {
  const seen = new Map();
  for (let p = 1; p <= pages; p++) {
    try {
      const html = await getText(`${BASE}/tin/Ban-tin-Kinh-te-Tai-chinh-ngay.html${p > 1 ? `?page=${p}` : ''}`);
      for (const m of html.matchAll(/href="(\/tin\/Ban-tin-Kinh-te-Tai-chinh-ngay\/Ban-tin-Kinh-te-Tai-chinh-ngay-(\d{2})-(\d{2})-(\d{4})-?\.html)"/g)) {
        seen.set(m[1], { url: m[1], d: Number(m[2]), m: Number(m[3]), y: Number(m[4]) });
      }
    } catch (e) {
      console.log(`  [VIRA] Không đọc được trang danh sách ${p}: ${e.message}`);
    }
  }
  return [...seen.values()].sort((a, b) => b.y * 10000 + b.m * 100 + b.d - (a.y * 10000 + a.m * 100 + a.d));
}

/**
 * Cập nhật macroData.nhnnHistory (gộp theo ngày phiên). `limit` = số bản tin mới nhất cần đọc,
 * `pages` = số trang danh sách. Lỗi từng bản tin không làm hỏng cả lô. Trả về số dòng mới/cập nhật.
 */
async function syncNhnnHistory(macroData, { limit = 6, pages = 1 } = {}) {
  const items = (await listBulletins(pages)).slice(0, limit);
  const byDate = new Map((Array.isArray(macroData.nhnnHistory) ? macroData.nhnnHistory : []).map((r) => [r.date, r]));
  let changed = 0;
  for (const it of items) {
    try {
      const row = parseBulletin(toText(await getText(BASE + it.url)), it);
      if (!row) continue;
      const old = byDate.get(row.date);
      if (!old || JSON.stringify(old) !== JSON.stringify(row)) changed++;
      byDate.set(row.date, row);
    } catch (e) {
      console.log(`  [VIRA] Bỏ qua ${it.url}: ${e.message}`);
    }
  }
  macroData.nhnnHistory = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  return changed;
}

module.exports = { syncNhnnHistory, parseBulletin, toText };
