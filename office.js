// ── 辦公室：俯視的小辦公室，員工會依這個月的紀錄、餘額與庫存走動、工作 ──
// 員工：小帳（記帳）、阿庫（出納）、阿貨（倉管）、小析（分析）、小豬（存錢筒），以及兩位成員精靈與小狐狸
// 這個檔案只讀取 app.js 的資料與函式，不會寫入任何東西。
// 記帳後（app.js 的 addRecord 會呼叫 officeNoteRecord），記帳的成員會走去記帳區登記，再到金庫領錢或存錢。

const OFFICE_SEEN_PREFIX = 'shareExpense.office.seen:';   // 每個月份上次來訪時的紀錄筆數
const officeNewCount = {};          // sheet -> 這次來訪時比上次多了幾筆
let officeSelected = null;          // 目前點開的員工 id
let officeInvRequested = false;     // 這次開啟是否已經更新過庫存
let officePaused = false;
let officeRaf = null;
let officeLastTs = 0;
let officeSayAt = 0;                // 下一次冒出對話框的時間
let officeData_ = null;             // 最近一次整理好的資料
const officeJobs = { book: [], chart: [], stock: [], cash: [], elf: [], fox: [], dog: [] };
let officeDogPets = 0;              // 這次開啟期間黑柴被摸了幾次
let officeSkitAt = 0;               // 下一次安排角色互動的時間
let officeSkitLast = '';            // 上一次的互動，避免連續重複
let officeSkitSeq = 0;
let officeQuietUntil = 0;           // 互動或跑腿結束後 1.5 秒內，其他人不冒出平常的對話框
let officePhase = 'day';            // 依實際時間：morning / day / evening / night
let officePhaseCheckAt = 0;
let officePrev = null;              // 上個月的摘要（月會、花太快警報用），只在看本月時載入
let officePrevLoading = false;
let officeMeeting = null;           // 月會：{ pending } → { ids, started, launchedAt }
const OFFICE_MEET_PREFIX = 'shareExpense.office.meeting:';   // 每個月的月會開過了沒
const OFFICE_EVENT_PREFIX = 'shareExpense.office.event:';    // 每天只演一次的事件（入帳、過期）
// 紀念日（MM-DD），填上後當天辦公室會掛滿愛心
const OFFICE_ANNIVERSARY = '';
// 農曆新年（初一）：前 10 天到元宵節掛燈籠
const OFFICE_CNY = { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' };

// 白天和晚上：依實際時間
function officePhaseNow() {
  const h = new Date().getHours();
  return h >= 23 || h < 6 ? 'night' : (h < 9 ? 'morning' : (h < 18 ? 'day' : 'evening'));
}
const OFFICE_PHASE_LABEL = { morning: '🌅 早上', day: '☀️ 白天', evening: '🌆 傍晚', night: '🌙 晚上' };

// 節日：12 月聖誕、農曆年前後、紀念日
function officeHoliday() {
  const now = new Date(), y = now.getFullYear(), mmdd = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  if (OFFICE_ANNIVERSARY && mmdd === OFFICE_ANNIVERSARY) return 'anniv';
  const cny = OFFICE_CNY[y];
  if (cny) {
    const day = new Date(y, parseInt(cny.slice(0, 2), 10) - 1, parseInt(cny.slice(3), 10));
    const diff = Math.round((new Date(y, now.getMonth(), now.getDate()) - day) / 86400000);
    if (diff >= -10 && diff <= 15) return 'cny';
  }
  if (now.getMonth() === 11) return 'xmas';
  return '';
}

// 目前選的月份是不是這個月（月會、入帳日、過期提醒只在看本月時出現）
function officeIsCurrentMonth() {
  const m = String(currentSheet() || '').match(/(\d{4})\/(\d{1,2})月/);
  const now = new Date();
  return !!m && +m[1] === now.getFullYear() && +m[2] === now.getMonth() + 1;
}

// 每天只演一次：記在瀏覽器裡（順便清掉以前的紀錄）
function officeOnce(key) {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(OFFICE_EVENT_PREFIX) && !k.startsWith(OFFICE_EVENT_PREFIX + day + ':')) localStorage.removeItem(k);
    }
    const k = OFFICE_EVENT_PREFIX + day + ':' + key;
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, '1');
    return true;
  } catch (e) { return false; }
}

// 上個月（和上上個月）的摘要：月會報告、這個月花得快不快
async function officeLoadPrev() {
  if (officePrevLoading || !officeIsCurrentMonth()) return;
  const sheet = currentSheet();
  if (officePrev && officePrev.sheet === sheet) return;
  officePrevLoading = true;
  try {
    const m = sheet.match(/(\d{4})\/(\d{1,2})月/);
    const y = +m[1], mo = +m[2];
    const p1 = mo === 1 ? [y - 1, 12] : [y, mo - 1];
    const p2 = p1[1] === 1 ? [p1[0] - 1, 12] : [p1[0], p1[1] - 1];
    const list = await apiCall({ action: 'getSheets' });
    const find = ([yy, mm]) => (list.sheets || []).find(n => { const t = n.match(/(\d{4})\/(\d{1,2})月/); return t && +t[1] === yy && +t[2] === mm; });
    const s1 = find(p1), s2 = find(p2);
    if (!s1) { officePrev = { sheet, none: true }; return; }
    const vers = await getVersions();
    const [r1, r2] = await Promise.all([fetchMonth(s1, vers, false), s2 ? fetchMonth(s2, vers, false) : Promise.resolve(null)]);
    const exp = recs => (recs || []).filter(r => !isSummaryRow(r) && r.owner !== '' && r.expense > 0 && !(r.note && r.note.includes('先付')));
    const sum = arr => arr.reduce((t, r) => t + r.expense, 0);
    const e1 = exp(r1);
    const catMap = {};
    e1.forEach(r => { const c = categorize(r.item); catMap[c] = (catMap[c] || 0) + r.expense; });
    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    const today = new Date().getDate();
    const dayOf = r => { const k = toMMDD(r.date); return k ? parseInt(k.slice(3), 10) : 0; };
    officePrev = {
      sheet, month: p1[1], prevMonth: p2[1],
      total: sum(e1),
      prevTotal: r2 ? sum(exp(r2)) : null,
      sameDay: sum(e1.filter(r => dayOf(r) <= today)),
      top: top ? { name: top[0], value: top[1] } : null,
      count: (r1 || []).filter(r => !isSummaryRow(r) && r.item !== '帳戶餘額' && r.owner !== '').length,
      owners: { 精靈: sum(e1.filter(r => r.owner === '精靈')), 小狐狸: sum(e1.filter(r => r.owner === '小狐狸')) },
    };
  } catch (e) {
    officePrev = null;
  } finally {
    officePrevLoading = false;
  }
  if (officePrev && !officePrev.none && officeVisible()) { drawOffice(); officeMaybeMeeting(false); }
}

// 這個月花得快不快：跟上個月同一天以前的支出比
function officePace(d) {
  const p = officePrev;
  if (!p || p.none || p.sheet !== currentSheet() || !(p.sameDay > 0)) return null;
  const diff = d.expense - p.sameDay;
  const pct = Math.round(diff / p.sameDay * 100);
  return { pct, diff, same: p.sameDay, fast: pct >= 20 && diff >= 1000 };
}

// 每月第一次打開本月時開月會；force 為重播
function officeMaybeMeeting(force) {
  const p = officePrev;
  if (!p || p.none || p.sheet !== currentSheet() || officeMeeting) return false;
  if (!force) {
    try { if (localStorage.getItem(OFFICE_MEET_PREFIX + p.sheet)) return false; } catch (e) { return false; }
  }
  officeMeeting = { pending: true, force: !!force };
  return true;
}

// 月會的台詞（依上個月的資料）
function officeMeetingLines(d) {
  const p = officePrev;
  const lines = [{ who: 'chart', text: `${p.month}月的月會開始囉！📋` }];
  let total = `上個月總支出 ${fmt(p.total)}`;
  if (p.prevTotal) {
    const pct = Math.round((p.total - p.prevTotal) / p.prevTotal * 100);
    total += pct === 0 ? `，跟${p.prevMonth}月差不多` : `，比${p.prevMonth}月${pct > 0 ? '多' : '少'} ${Math.abs(pct)}%`;
  }
  lines.push({ who: 'chart', text: total });
  lines.push({ who: 'chart', text: p.top ? `花最多的是${p.top.name}，${fmt(p.top.value)}` : '上個月沒有支出紀錄' });
  lines.push({ who: 'book', text: `上個月一共記了 ${p.count} 筆 ✍️` });
  lines.push({ who: 'cash', text: `精靈花了 ${fmt(p.owners['精靈'])}，小狐狸花了 ${fmt(p.owners['小狐狸'])}` });
  lines.push({ who: 'stock', text: d.alerts.length ? `倉庫有 ${d.alerts.length} 項要注意，散會後去看看` : '倉庫一切正常 📦' });
  const up = p.prevTotal && p.total > p.prevTotal;
  lines.push({ who: 'elf', text: up ? '這個月一起省一點 💪' : '上個月表現很好 ✨' });
  lines.push({ who: 'fox', text: '散會～大家辛苦了 👏', burst: true });
  lines.push({ who: 'dog', text: '汪！' });
  return lines;
}

function officeVisible() {
  const tab = document.getElementById('tab-office');
  return !!tab && tab.style.display !== 'none';
}

// 整理這個月的資料，供場景與下方說明共用
function officeData() {
  const realRecs = records.filter(r => !isSummaryRow(r));
  const isPrepaid = r => r.note && r.note.includes('先付');
  const startingRec = records.find(r => r.item === '帳戶餘額' && r.owner === '');
  const starting = startingRec ? startingRec.income : 0;
  const entries = realRecs.filter(r => r.item !== '帳戶餘額');
  const income = entries.filter(r => r.owner !== '').reduce((s, r) => s + r.income, 0);
  const expense = realRecs.filter(r => !isPrepaid(r)).reduce((s, r) => s + r.expense, 0);
  const balance = getAccountBalance();

  // 記帳桌：今天幾筆、最新幾筆
  const now = new Date();
  const todayKey = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0');
  const time = r => { const d = new Date(r.date); return isNaN(d.getTime()) ? 0 : d.getTime(); };
  // 最新紀錄不含未來日期（例如預先登記、還沒入帳的匯款）
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const sorted = entries.filter(r => time(r) <= endOfToday.getTime())
    .map((r, i) => ({ r, i })).sort((a, b) => time(b.r) - time(a.r) || b.i - a.i).map(x => x.r);
  const todayCount = entries.filter(r => toMMDD(r.date) === todayKey).length;

  // 金庫：每月的愛、月底結算
  const love = ['精靈', '小狐狸'].map(name => {
    const recs = entries.filter(r => r.item && r.item.includes('每月的愛') && r.owner === name);
    const amount = recs.reduce((s, r) => s + r.income, 0);
    const arrived = recs.length > 0 && recs.every(r => { const d = new Date(r.date); return isNaN(d.getTime()) || d <= endOfToday; });
    const arrivedToday = recs.some(r => toMMDD(r.date) === todayKey);
    return { name, has: recs.length > 0, amount, arrived, arrivedToday, date: recs[0] ? toMMDD(recs[0].date) : '' };
  });
  const transferRecs = records.filter(r => r.item.includes('支出部分轉回'));
  const settled = transferRecs.some(r => r.expense > 0);
  // 月底轉回給兩人的金額（「支出部分轉回」列的支出欄）
  const back = ['精靈', '小狐狸'].map(name => {
    const r = transferRecs.find(t => t.item.includes(name));
    return { name, amount: r ? (r.expense || 0) : 0, row: r ? r.row : null };
  });

  // 白板：支出分類
  const catMap = {};
  realRecs.filter(r => r.expense > 0 && !isPrepaid(r)).forEach(r => {
    const c = categorize(r.item);
    catMap[c] = (catMap[c] || 0) + r.expense;
  });
  const cats = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // 貨架：要補貨或快到期的庫存
  const items = Array.isArray(inventory) ? inventory : [];
  const alerts = [];
  items.forEach(i => {
    const st = invStatus(i);
    const ex = expiryLevel(i);
    if (ex === 'expired') alerts.push({ name: i.name, level: 'red', text: '已過期' });
    else if (ex === 'red') alerts.push({ name: i.name, level: 'red', text: expiryText(i) });
    else if (st === 'empty') alerts.push({ name: i.name, level: 'red', text: '用完了' });
    else if (st === 'low') alerts.push({ name: i.name, level: 'warn', text: '快用完' });
    else if (ex === 'warn') alerts.push({ name: i.name, level: 'warn', text: expiryText(i) });
  });
  alerts.sort((a, b) => (a.level === b.level ? 0 : (a.level === 'red' ? -1 : 1)));

  // 存錢筒水位：餘額占「期初＋已入帳收入」的比例（和餘額的算法一致，未到日期的匯款不算）
  const arrived = arrivedIncomeOf(realRecs);
  const pool = starting + arrived;
  const ratio = pool > 0 ? Math.max(0, Math.min(1, balance / pool)) : (balance > 0 ? 1 : 0);
  const mood = balance < 0 ? 'cry' : (ratio < 0.2 ? 'worry' : 'happy');

  return { starting, income, arrived, expense, balance, pool, ratio, mood, entries, sorted, todayCount, love, settled, back, cats, items, alerts };
}

// ── 角色與物件的 SVG ──────────────────────────────────────────
function officeCharSvg(kind) {
  if (kind === 'dog') {
    // 黑柴：黑色的毛、奶油色的臉頰和胸口、麻呂眉、捲尾巴
    return `
      <g class="of-char of-dog">
        <g class="of-tail"><path d="M55 64 Q76 64 75 46 Q74 34 62 37 Q54 40 58 49 Q62 54 66 49 Q66 57 55 56 Z" fill="#34343b"/><path d="M62 37 Q55 40 58 49 Q60 43 66 41 Z" fill="#f3e3cc"/></g>
        <ellipse cx="40" cy="70" rx="19" ry="16" fill="#34343b"/>
        <ellipse cx="40" cy="75" rx="10.5" ry="11" fill="#f3e3cc"/>
        <ellipse cx="30" cy="84.5" rx="6" ry="3.6" fill="#f3e3cc"/><ellipse cx="50" cy="84.5" rx="6" ry="3.6" fill="#f3e3cc"/>
        <path d="M27 60 Q40 67 53 60 L52 64 Q40 70 28 64 Z" fill="#e8574f"/><circle cx="40" cy="68.5" r="2.6" fill="#ffd66b"/>
        <g class="of-head">
          <path d="M19 27 L15 6 L34 17 Z" fill="#34343b"/>
          <path d="M61 27 L65 6 L46 17 Z" fill="#34343b"/>
          <path d="M20.5 21 L18.5 11 L27.5 16 Z" fill="#e2b98c"/>
          <path d="M59.5 21 L61.5 11 L52.5 16 Z" fill="#e2b98c"/>
          <ellipse cx="40" cy="36" rx="24" ry="19" fill="#3b3b43"/>
          <path d="M16 37 Q26 51 40 44 Q54 51 64 37 Q63 56 40 56 Q17 56 16 37 Z" fill="#f3e3cc"/>
          <ellipse cx="30" cy="26.5" rx="3.6" ry="2.3" fill="#e2b98c"/><ellipse cx="50" cy="26.5" rx="3.6" ry="2.3" fill="#e2b98c"/>
          <circle cx="30.5" cy="34" r="3.4" fill="#141418"/><circle cx="31.7" cy="32.8" r="1.2" fill="#fff"/>
          <circle cx="49.5" cy="34" r="3.4" fill="#141418"/><circle cx="50.7" cy="32.8" r="1.2" fill="#fff"/>
          <ellipse cx="40" cy="43" rx="3.2" ry="2.4" fill="#2a2326"/>
          <path d="M35.5 47 Q40 51.5 44.5 47" fill="none" stroke="#2a2326" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M38 49.6 Q40 54 42 49.6 Z" fill="#f58aa0"/>
          <ellipse cx="23.5" cy="43" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
          <ellipse cx="56.5" cy="43" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
        </g>
      </g>`;
  }
  if (kind === 'fox') {
    return `
      <g class="of-char of-fox">
        <path class="of-tail" d="M58 66 Q82 60 76 38 Q72 50 62 54 Z" fill="#f4a261"/>
        <path class="of-tail" d="M76 38 Q80 46 74 52 Q72 46 76 38 Z" fill="#fff6ec"/>
        <ellipse cx="40" cy="70" rx="19" ry="16" fill="#f4a261"/>
        <ellipse cx="40" cy="74" rx="10" ry="11" fill="#fff6ec"/>
        <g class="of-head">
          <path d="M19 26 L14 4 L34 16 Z" fill="#f4a261"/>
          <path d="M61 26 L66 4 L46 16 Z" fill="#f4a261"/>
          <path d="M19.5 20 L17 9 L27 15 Z" fill="#5b3a29"/>
          <path d="M60.5 20 L63 9 L53 15 Z" fill="#5b3a29"/>
          <ellipse cx="40" cy="36" rx="24" ry="19" fill="#f6ad6d"/>
          <path d="M16 36 Q26 52 40 45 Q54 52 64 36 Q63 56 40 56 Q17 56 16 36 Z" fill="#fff6ec"/>
          <circle cx="30.5" cy="34.5" r="3.2" fill="#3b2f2f"/><circle cx="31.6" cy="33.4" r="1.1" fill="#fff"/>
          <circle cx="49.5" cy="34.5" r="3.2" fill="#3b2f2f"/><circle cx="50.6" cy="33.4" r="1.1" fill="#fff"/>
          <ellipse cx="40" cy="43.5" rx="3" ry="2.2" fill="#3b2f2f"/>
          <path d="M36 47.5 Q40 51 44 47.5" fill="none" stroke="#3b2f2f" stroke-width="1.4" stroke-linecap="round"/>
          <ellipse cx="23.5" cy="42" rx="4" ry="2.4" fill="#ff9fb0" opacity="0.6"/>
          <ellipse cx="56.5" cy="42" rx="4" ry="2.4" fill="#ff9fb0" opacity="0.6"/>
        </g>
      </g>`;
  }
  // 精靈：可愛的小馬（奶油色身體、黑色鬃毛、額頭白斑、大鼻子）
  return `
    <g class="of-char of-elf">
      <path class="of-tail" d="M57 66 Q80 62 77 84 Q70 76 66 80 Q66 72 57 72 Z" fill="#2e2a30"/>
      <ellipse cx="40" cy="70" rx="19" ry="15.5" fill="#f6dcb9"/>
      <ellipse cx="40" cy="74" rx="10" ry="10.5" fill="#fff3e0"/>
      <rect x="27" y="79" width="10" height="8" rx="3.5" fill="#f6dcb9"/><rect x="43" y="79" width="10" height="8" rx="3.5" fill="#f6dcb9"/>
      <rect x="27" y="83.5" width="10" height="4" rx="2" fill="#8d6a55"/><rect x="43" y="83.5" width="10" height="4" rx="2" fill="#8d6a55"/>
      <g class="of-head">
        <path d="M60 14 Q74 24 68 50 Q65 58 58 60 Q62 46 56 30 Z" fill="#2e2a30"/>
        <path d="M22 20 L19 1 L34 12 Z" fill="#f6dcb9"/>
        <path d="M58 20 L61 1 L46 12 Z" fill="#f6dcb9"/>
        <path d="M23.5 15 L22 6.5 L29 11.5 Z" fill="#ffc9d6"/>
        <path d="M56.5 15 L58 6.5 L51 11.5 Z" fill="#ffc9d6"/>
        <ellipse cx="40" cy="31" rx="20" ry="18" fill="#f6dcb9"/>
        <path d="M36.5 15 Q40 13 43.5 15 L45 36 Q40 38 35 36 Z" fill="#fffaf2"/>
        <ellipse cx="40" cy="47" rx="16.5" ry="11.5" fill="#fff1e2"/>
        <path d="M27 14 Q38 2 51 9 Q44 10 41 17 Q36 12 33 22 Q29 18 27 14 Z" fill="#2e2a30"/>
        <path d="M33 10 Q40 5 47 9 Q41 9 38 13 Z" fill="#5a5360"/>
        <circle cx="28" cy="32" r="3.5" fill="#2f3b45"/><circle cx="29.2" cy="30.8" r="1.2" fill="#fff"/>
        <circle cx="52" cy="32" r="3.5" fill="#2f3b45"/><circle cx="53.2" cy="30.8" r="1.2" fill="#fff"/>
        <ellipse cx="34" cy="46" rx="1.8" ry="2.6" fill="#d19a86"/><ellipse cx="46" cy="46" rx="1.8" ry="2.6" fill="#d19a86"/>
        <path d="M35.5 52 Q40 55.4 44.5 52" fill="none" stroke="#b9728a" stroke-width="1.4" stroke-linecap="round"/>
        <ellipse cx="22.5" cy="40" rx="3.6" ry="2.2" fill="#ff9fb0" opacity="0.6"/>
        <ellipse cx="57.5" cy="40" rx="3.6" ry="2.2" fill="#ff9fb0" opacity="0.6"/>
      </g>
    </g>`;
}

// 員工（人形）：髮色、制服顏色與小配件依職務不同
const OFFICE_LOOK = {
  book:  { hair: '#7a523c', suit: '#9fd8cb', extra: 'pencil' },
  cash:  { hair: '#34404d', suit: '#f7c4d8', extra: 'bun' },
  stock: { hair: '#c98b5e', suit: '#f6c58a', extra: 'cap' },
  chart: { hair: '#4d4a6e', suit: '#bcd4f6', extra: 'glasses' },
};
function officeStaffSvg(id) {
  const k = OFFICE_LOOK[id];
  const extra = k.extra === 'pencil'
    ? '<path d="M60 30 L70 14" stroke="#ffb74d" stroke-width="3.4" stroke-linecap="round"/><path d="M60 30 L58.6 32.4" stroke="#5b3a29" stroke-width="2.4" stroke-linecap="round"/>'
    : k.extra === 'bun'
      ? `<circle cx="40" cy="11" r="8" fill="${k.hair}"/><circle cx="40" cy="11" r="2.4" fill="#ffd66b"/>`
      : k.extra === 'cap'
        ? '<path d="M17 27 Q18 9 40 9 Q62 9 63 27 Z" fill="#f2a03d"/><path d="M40 24 Q62 22 72 30 Q58 31 40 30 Z" fill="#e58a1f"/>'
        : '<circle cx="31" cy="38" r="6.2" fill="rgba(255,255,255,0.45)" stroke="#4d4a6e" stroke-width="1.6"/><circle cx="49" cy="38" r="6.2" fill="rgba(255,255,255,0.45)" stroke="#4d4a6e" stroke-width="1.6"/><path d="M37.2 38 h5.6" stroke="#4d4a6e" stroke-width="1.6"/>';
  return `
    <g class="of-char">
      <ellipse cx="40" cy="72" rx="17" ry="15" fill="${k.suit}"/>
      <path d="M33 60 L40 68 L47 60 Z" fill="#ffffff"/>
      <g class="of-head">
        <ellipse cx="40" cy="38" rx="22" ry="21" fill="#ffe4d0"/>
        <path d="M17.5 38 Q15 13 40 13 Q65 13 62.5 38 Q57 24 40 24 Q23 24 17.5 38 Z" fill="${k.hair}"/>
        <circle cx="31" cy="39" r="3" fill="#3b2f2f"/><circle cx="32" cy="38" r="1" fill="#fff"/>
        <circle cx="49" cy="39" r="3" fill="#3b2f2f"/><circle cx="50" cy="38" r="1" fill="#fff"/>
        <path d="M36 48 Q40 51.5 44 48" fill="none" stroke="#b9728a" stroke-width="1.5" stroke-linecap="round"/>
        <ellipse cx="24.5" cy="45" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
        <ellipse cx="55.5" cy="45" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
        ${extra}
      </g>
    </g>`;
}
function officeActorSvg(id) {
  const inner = (id === 'elf' || id === 'fox' || id === 'dog') ? officeCharSvg(id) : officeStaffSvg(id);
  return `<svg viewBox="0 0 80 90" aria-hidden="true"><ellipse cx="40" cy="86" rx="20" ry="4" fill="rgba(90,70,50,0.18)"/>${inner}</svg>`;
}

// 小豬存錢筒：肚子裡的金幣堆到哪，就是餘額比例；餘額偏低會冒汗，變負數會哭、肚子空空
function officePiggySvg(d) {
  // 肚子上的透明窗（不蓋到臉）：窗內從底部往上堆金幣
  const top = 44, bottom = 101;
  const level = d.balance <= 0 ? bottom + 2 : bottom - (bottom - top) * Math.max(0.06, d.ratio);
  // 金幣：一層一層往上疊，每層錯開半顆；最上面一層會閃光
  let coins = '';
  const rowsN = Math.max(0, Math.ceil((bottom - level) / 7));
  for (let r = 0; r < rowsN; r++) {
    const y = bottom - 3 - r * 7, off = r % 2 ? 8 : 0;
    const topRow = r === rowsN - 1;
    for (let x = 40 + off; x < 134; x += 16) {
      coins += `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.4" fill="${(x + r) % 3 ? '#ffd66b' : '#ffe08a'}" stroke="#e0a82e" stroke-width="1.2"/>`;
      if (topRow && (x / 16 + r) % 3 < 1) coins += `<path d="M${x - 3.5} ${y - 0.8} h7" stroke="#fff6c9" stroke-width="1.4" stroke-linecap="round"/>`;
    }
  }
  const sparks = d.mood === 'happy' && rowsN ? `
        <path class="of-spark" d="M66 ${(level - 6).toFixed(1)} l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 Z" fill="#fff6c9"/>
        <path class="of-spark s2" d="M122 ${(level - 2).toFixed(1)} l1.6 -5 1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 Z" fill="#fff6c9"/>` : '';
  const mouth = d.mood === 'happy'
    ? '<path d="M150 74 Q155 79 160 74" fill="none" stroke="#b9728a" stroke-width="1.8" stroke-linecap="round"/>'
    : (d.mood === 'worry'
      ? '<path d="M150 77 L160 77" fill="none" stroke="#b9728a" stroke-width="1.8" stroke-linecap="round"/>'
      : '<path d="M150 79 Q155 74 160 79" fill="none" stroke="#b9728a" stroke-width="1.8" stroke-linecap="round"/>');
  const extra = d.mood === 'worry'
    ? '<path class="of-sweat" d="M118 36 q-4 7 0 9 q4 -2 0 -9 Z" fill="#8fd3f4"/>'
    : (d.mood === 'cry' ? '<path class="of-tear" d="M146 60 q-3 6 0 8 q3 -2 0 -8 Z" fill="#8fd3f4"/>' : '');
  return `
  <svg viewBox="0 0 200 130" aria-hidden="true">
    <defs><clipPath id="ofPigClip"><ellipse cx="86" cy="72" rx="45" ry="30"/></clipPath></defs>
    <ellipse cx="98" cy="122" rx="70" ry="6" fill="rgba(90,70,50,0.13)"/>
    <path class="of-pigtail" d="M34 62 q-12 -2 -10 -10 q2 -7 8 -3 q4 3 -1 6" fill="none" stroke="#f08fb0" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="58" y="100" width="16" height="20" rx="6" fill="#f7a8c0"/><rect x="118" y="100" width="16" height="20" rx="6" fill="#f7a8c0"/>
    <g class="of-pig">
      <ellipse cx="96" cy="68" rx="62" ry="44" fill="#ffe3ea"/>
      <ellipse cx="86" cy="72" rx="45" ry="30" fill="#fff7f9"/>
      <g clip-path="url(#ofPigClip)">${coins}${sparks}</g>
      <ellipse cx="86" cy="72" rx="45" ry="30" fill="none" stroke="#f6bccb" stroke-width="2"/>
      <path d="M58 54 q10 -9 24 -10" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
      <ellipse cx="96" cy="68" rx="62" ry="44" fill="none" stroke="#f3a0b8" stroke-width="2.5"/>
      <rect x="82" y="25.5" width="28" height="5" rx="2.5" fill="#d9788f"/>
      <path d="M128 30 L140 14 L146 34 Z" fill="#f7a8c0"/>
      <ellipse cx="160" cy="66" rx="13" ry="10.5" fill="#f7a8c0"/>
      <ellipse cx="156" cy="66" rx="2" ry="3" fill="#d9788f"/><ellipse cx="164" cy="66" rx="2" ry="3" fill="#d9788f"/>
      <circle cx="140" cy="52" r="3.4" fill="#3b2f2f"/><circle cx="141.2" cy="50.8" r="1.2" fill="#fff"/>
      <ellipse cx="132" cy="62" rx="5" ry="3" fill="#ff9fb0" opacity="0.6"/>
      ${mouth}${extra}
    </g>
    <g class="of-coin-drop"><ellipse cx="96" cy="6" rx="7" ry="7" fill="#ffd66b" stroke="#f2b632" stroke-width="1.4"/><text x="96" y="9.6" font-size="8" font-weight="700" text-anchor="middle" fill="#b9831c">$</text></g>
  </svg>`;
}


// 節日裝飾：聖誕樹、燈籠和福字、紀念日愛心
function officeDecorSvg() {
  const h = officeHoliday();
  if (h === 'xmas') return `
    <g class="of-decor">
      <path d="M860 690 L905 760 L882 760 L918 820 L802 820 L838 760 L815 760 Z" fill="#5fbf8f"/>
      <path d="M860 690 L885 730 L835 730 Z" fill="#7fd6a8"/>
      <rect x="850" y="820" width="20" height="18" rx="3" fill="#a9754f"/>
      <path class="of-star" d="M860 670 l6 13 14 1 -11 9 4 14 -13 -8 -13 8 4 -14 -11 -9 14 -1 Z" fill="#ffd66b"/>
      <circle cx="846" cy="752" r="6" fill="#ef5f7a"/><circle cx="874" cy="782" r="6" fill="#ffd66b"/><circle cx="838" cy="800" r="6" fill="#7fb6f0"/><circle cx="890" cy="806" r="6" fill="#ef5f7a"/>
      <rect x="808" y="824" width="34" height="28" rx="4" fill="#ef5f7a"/><path d="M825 824 v28 M808 838 h34" stroke="#ffd66b" stroke-width="4"/>
      <rect x="880" y="828" width="30" height="24" rx="4" fill="#7fb6f0"/><path d="M895 828 v24 M880 840 h30" stroke="#fff" stroke-width="4"/>
    </g>`;
  if (h === 'cny') {
    const lantern = x => `<g class="of-lantern" style="transform-origin:${x}px 560px">
      <path d="M${x} 560 v14" stroke="#c9a27c" stroke-width="3"/>
      <rect x="${x - 26}" y="574" width="52" height="8" rx="3" fill="#ffd66b"/>
      <ellipse cx="${x}" cy="604" rx="34" ry="26" fill="#e8463e"/>
      <path d="M${x} 580 v48 M${x - 18} 584 q-8 20 0 40 M${x + 18} 584 q8 20 0 40" stroke="#c7322b" stroke-width="2.4" fill="none"/>
      <rect x="${x - 26}" y="626" width="52" height="8" rx="3" fill="#ffd66b"/>
      <path d="M${x - 8} 634 v18 M${x} 634 v22 M${x + 8} 634 v18" stroke="#ffd66b" stroke-width="2.4"/>
    </g>`;
    return `<g class="of-decor">${lantern(160)}${lantern(840)}
      <g transform="translate(720 708) rotate(45)"><rect x="-26" y="-26" width="52" height="52" rx="4" fill="#e8463e"/></g>
      <text x="720" y="720" font-size="34" font-weight="700" text-anchor="middle" fill="#ffd66b">福</text></g>`;
  }
  if (h === 'anniv') {
    const hearts = [80, 200, 330, 560, 690, 820, 940].map((x, i) => `<path d="M${x} ${590 + (i % 2) * 18} c-8 -12 -24 -2 -14 10 l14 13 14 -13 c10 -12 -6 -22 -14 -10 Z" fill="${i % 2 ? '#f7a8c0' : '#ef5f7a'}"/>`).join('');
    return `<g class="of-decor"><path d="M40 584 Q270 640 500 590 Q730 640 960 584" fill="none" stroke="#f3a0b8" stroke-width="3"/>${hearts}</g>`;
  }
  return '';
}

// ── 平面圖（座標系 1000 × 1300）：記帳區、倉庫、走道、金庫、休息區 ──
function officeBgSvg(d) {
  const t = (s, n) => { const a = [...String(s)]; return esc(a.length > n ? a.slice(0, n).join('') : a.join('')); };
  // 白板：前三大支出
  const max = d.cats.length ? d.cats[0].value : 1;
  const barColor = ['#f79aae', '#7fd6e6', '#ffd66b'];
  const board = d.cats.slice(0, 3).map((c, i) => `
    <text x="318" y="${76 + i * 34}" font-size="27" fill="#6b5a4c">${t(c.name, 4)}</text>
    <rect x="436" y="${56 + i * 34}" width="136" height="20" rx="10" fill="#f3ece3"/>
    <rect x="436" y="${56 + i * 34}" width="${Math.max(14, 136 * c.value / max).toFixed(0)}" height="20" rx="10" fill="${barColor[i]}"/>`).join('')
    || '<text x="445" y="104" font-size="27" text-anchor="middle" fill="#a8978a">還沒有支出</text>';
  // 貨架：上排放需要注意的品項，下排是一般貨
  const box = (x, y, a) => {
    const fill = !a ? '#ecd3ae' : (a.level === 'red' ? '#ffd3d9' : (a.level === 'warn' ? '#ffe8bd' : '#cdeee3'));
    const stroke = !a ? '#d9bb8f' : (a.level === 'red' ? '#f08f9f' : (a.level === 'warn' ? '#f2b85c' : '#8fd3b0'));
    return `<g${a && a.level === 'red' ? ' class="of-alert"' : ''}><rect x="${x}" y="${y}" width="86" height="58" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
      ${a ? `<text x="${x + 43}" y="${y + 39}" font-size="26" text-anchor="middle" fill="#5b4636">${a.name ? t(a.name, 3) : '✓'}</text>` : ''}</g>`;
  };
  const top3 = d.alerts.slice(0, 3);
  const topBoxes = [0, 1, 2].map(i => {
    if (top3[i]) return box(672 + i * 96, 62, top3[i]);
    return d.items.length && !d.alerts.length ? box(672 + i * 96, 62, { level: 'ok', name: i === 0 ? '' : ' ' }) : box(672 + i * 96, 62, null);
  }).join('');
  // 下排：第 4～6 項；超過 6 項時，最後一格改成「+N項」
  const lowBoxes = [0, 1, 2].map(i => {
    const al = d.alerts[3 + i];
    if (!al) return box(672 + i * 96, 172, null);
    if (i === 2 && d.alerts.length > 6) return box(672 + i * 96, 172, { level: al.level, name: `+${d.alerts.length - 5}項` });
    return box(672 + i * 96, 172, al);
  }).join('');
  const env = (x, y, p, color) => `
    <g transform="translate(${x} ${y})"><g class="of-env ${p.arrived ? 'arrived' : ''}">
      <rect width="66" height="46" rx="8" fill="${p.arrived ? color : '#f1ece6'}" stroke="rgba(90,70,50,0.22)" stroke-width="2"/>
      <path d="M3 6 L33 27 L63 6" fill="none" stroke="rgba(90,70,50,0.25)" stroke-width="2.4"/>
      <path d="M33 22 c-6 -9 -16 -1 -9 6 l9 8 9 -8 c7 -7 -3 -15 -9 -6 Z" fill="${p.arrived ? '#ffffff' : '#d8cfc5'}"/>
    </g></g>`;
  const desk = (x, y, w, tone) => `
    <rect x="${x}" y="${y + 12}" width="${w}" height="66" rx="14" fill="${tone[1]}"/>
    <rect x="${x}" y="${y}" width="${w}" height="62" rx="14" fill="${tone[0]}"/>`;
  const wood = ['#f4d9b6', '#e3b98a'], lilac = ['#f8e1f0', '#e9c9e0'];
  const mv = (dy, body) => `<g transform="translate(0 ${dy})">${body}</g>`;
  return `
  <svg class="of-bg" viewBox="0 0 1000 1300" aria-hidden="true">
    <rect width="1000" height="1300" fill="#f6ead8"/>
    <!-- 四個區域（上排 540、下排 620，中間是走廊） -->
    <rect x="20" y="20" width="590" height="540" rx="26" fill="#fff4e2" stroke="#f0dcc0" stroke-width="4"/>
    <rect x="630" y="20" width="350" height="540" rx="26" fill="#e9f6f0" stroke="#cfe9de" stroke-width="4"/>
    <rect x="20" y="660" width="450" height="620" rx="26" fill="#fdebf1" stroke="#f6d3de" stroke-width="4"/>
    <rect x="490" y="660" width="490" height="620" rx="26" fill="#e9f2fc" stroke="#d2e2f6" stroke-width="4"/>
    <!-- 門口 -->
    <rect x="285" y="553" width="80" height="14" fill="#fff4e2"/><rect x="660" y="553" width="80" height="14" fill="#e9f6f0"/>
    <rect x="380" y="653" width="80" height="14" fill="#fdebf1"/><rect x="580" y="653" width="80" height="14" fill="#e9f2fc"/>
    <g font-size="34" font-weight="700" fill="rgba(110,90,70,0.5)">
      <text x="64" y="537">記帳區</text><text x="652" y="537">倉庫</text>
      <text x="386" y="1258">金庫</text><text x="512" y="1258">休息區</text>
    </g>
    <!-- 記帳區：白板、兩張桌子、盆栽 -->
    ${mv(30, `<rect x="296" y="34" width="296" height="124" rx="16" fill="#ffffff" stroke="${d.pace && d.pace.fast ? '#ef5f7a' : '#9fd8cb'}" stroke-width="8"/>${board}${d.pace && d.pace.fast ? `<g class="of-alarm"><rect x="372" y="-14" width="144" height="34" rx="17" fill="#ef5f7a"/><text x="444" y="10" font-size="22" font-weight="700" text-anchor="middle" fill="#fff">⚠ 花比較快</text></g>` : ''}`)}
    ${mv(51, `${desk(60, 108, 215, wood)}
    <path d="M118 150 Q140 138 162 148 Q184 138 206 150 L206 126 Q184 115 162 124 Q140 115 118 126 Z" fill="#ffffff" stroke="#d9c7b0" stroke-width="2"/>
    <path d="M162 124 L162 148 M128 132 Q140 127 154 132 M170 132 Q184 127 198 132" fill="none" stroke="#9fd8cb" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="74" y="120" width="34" height="26" rx="5" fill="#bfe3f0"/><rect x="79" y="125" width="24" height="7" rx="2" fill="#f7fdfb"/>
    <rect x="232" y="116" width="26" height="30" rx="6" fill="#9fd8cb"/><path d="M239 116 L236 100 M246 116 L246 97 M252 116 L256 101" stroke="#f08fb0" stroke-width="4" stroke-linecap="round"/>`)}
    ${mv(79, `${desk(380, 178, 195, wood)}
    <rect x="436" y="186" width="84" height="42" rx="8" fill="#5b6475"/><rect x="442" y="191" width="72" height="31" rx="5" fill="#cfe7ff"/>
    <path d="M450 216 l10 -9 9 5 12 -13 12 8 10 -10" fill="none" stroke="#f79aae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`)}
    ${mv(80, `<g class="of-leaf"><path d="M550 330 Q524 312 528 276 Q548 290 550 330 Z" fill="#8fd3b0"/><path d="M550 330 Q576 310 576 272 Q554 288 550 330 Z" fill="#a8e0c0"/></g>
    <path d="M530 330 h40 l-5 34 q-15 5 -30 0 Z" fill="#f4b99a"/>`)}
    <!-- 倉庫：兩排貨架、小推車桌 -->
    ${mv(29, `<rect x="656" y="46" width="300" height="92" rx="14" fill="#f8e3c6" stroke="#e3b98a" stroke-width="5"/>${topBoxes}
    ${d.alerts.length ? `<circle cx="952" cy="50" r="26" fill="#ef5f7a"/><text x="952" y="61" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${d.alerts.length}</text>` : ''}`)}
    ${mv(73, `<rect x="656" y="156" width="300" height="92" rx="14" fill="#f8e3c6" stroke="#e3b98a" stroke-width="5"/>${lowBoxes}`)}
    ${mv(115, `${desk(846, 268, 108, ['#d9efe6', '#b5dccd'])}
    <rect x="866" y="276" width="44" height="32" rx="6" fill="#ecd3ae" stroke="#d9bb8f" stroke-width="3"/><path d="M866 292 h44" stroke="#d9bb8f" stroke-width="3"/>`)}
    <!-- 金庫：小豬存錢筒（另外畫成按鈕）、兩個信封（每月的愛）、櫃台 -->
    ${env(64, 968, d.love[0], '#7fd6e6')}${env(146, 968, d.love[1], '#f7a8c0')}
    ${mv(308, `${desk(58, 752, 196, lilac)}
    <g><ellipse cx="96" cy="776" rx="15" ry="6" fill="#f2b632"/><ellipse cx="96" cy="770" rx="15" ry="6" fill="#ffd66b"/><ellipse cx="96" cy="764" rx="15" ry="6" fill="#f2b632"/><ellipse cx="96" cy="758" rx="15" ry="6" fill="#ffd66b"/></g>
    <g class="${d.love.some(p => p.arrivedToday) ? 'of-hop' : ''}">
      <path d="M200 790 q-22 -2 -20 -24 q2 -16 14 -22 l-5 -9 h22 l-5 9 q12 6 14 22 q2 22 -20 24 Z" fill="#e3b98a"/>
      <text x="200" y="778" font-size="22" font-weight="700" text-anchor="middle" fill="#8a5a2b">$</text>
    </g>`)}
    <!-- 倉庫的垃圾桶、金庫門口的信箱 -->
    <g><rect x="776" y="478" width="44" height="54" rx="8" fill="#b9cbd6"/><rect x="770" y="470" width="56" height="12" rx="6" fill="#9fb4c4"/><path d="M788 492 v30 M798 492 v30 M808 492 v30" stroke="#9fb4c4" stroke-width="3" stroke-linecap="round"/></g>
    <g><rect x="470" y="600" width="12" height="52" fill="#c9a27c"/><rect x="452" y="574" width="48" height="34" rx="10" fill="#f08fb0"/><rect x="458" y="584" width="36" height="6" rx="3" fill="#c2557f"/><path d="M496 578 v-14 h10 v8 h-10" fill="#ffd66b"/></g>
    ${officeDecorSvg()}
    <!-- 休息區：茶水機、茶几、沙發、盆栽、黑柴的窩 -->
    ${mv(310, `<ellipse cx="575" cy="800" rx="64" ry="34" fill="#b9a48d"/><ellipse cx="575" cy="793" rx="64" ry="34" fill="#d7c4ae"/><ellipse cx="575" cy="790" rx="48" ry="23" fill="#f3e9db"/>
    <g transform="translate(628 824) rotate(-20)"><rect x="-11" y="-2.5" width="22" height="5" rx="2.5" fill="#fff"/><circle cx="-11" cy="-3" r="4" fill="#fff"/><circle cx="-11" cy="3" r="4" fill="#fff"/><circle cx="11" cy="-3" r="4" fill="#fff"/><circle cx="11" cy="3" r="4" fill="#fff"/></g>`)}
    ${mv(220, `<rect x="510" y="518" width="74" height="104" rx="14" fill="#cfe0f2"/><rect x="520" y="528" width="54" height="40" rx="8" fill="#f7fbff"/>
    <rect x="534" y="582" width="26" height="24" rx="5" fill="#ffffff" stroke="#b9cde4" stroke-width="3"/>
    <path class="of-steam" d="M541 574 q-5 -8 0 -15 M553 574 q5 -8 0 -15" fill="none" stroke="#a9bfd8" stroke-width="3" stroke-linecap="round"/>`)}
    ${mv(276, `<ellipse cx="812" cy="704" rx="72" ry="38" fill="#e3b98a"/><ellipse cx="812" cy="694" rx="72" ry="38" fill="#f4d9b6"/>
    <rect x="792" y="676" width="24" height="20" rx="5" fill="#ffffff" stroke="#d9c7b0" stroke-width="2.5"/><circle cx="838" cy="694" r="10" fill="#f79aae"/>`)}
    ${mv(328, `<rect x="672" y="792" width="276" height="96" rx="34" fill="#f3a9bf"/>
    <rect x="690" y="806" width="240" height="70" rx="24" fill="#f9c6d5"/>
    <rect x="700" y="812" width="106" height="48" rx="18" fill="#fde0e9"/><rect x="814" y="812" width="106" height="48" rx="18" fill="#fde0e9"/>`)}
    ${mv(219, `<g class="of-leaf"><path d="M934 580 Q908 562 912 526 Q932 540 934 580 Z" fill="#8fd3b0"/><path d="M934 580 Q960 560 960 522 Q938 538 934 580 Z" fill="#a8e0c0"/></g>
    <path d="M914 580 h40 l-5 34 q-15 5 -30 0 Z" fill="#f4b99a"/>`)}
  </svg>`;
}

function officeDetailHtml(key, d) {
  const row = (label, value, cls = '') => `<div class="of-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
  const go = (tab, text) => `<button type="button" class="of-go" data-office-go="${tab}">${text}</button>`;
  if (key === 'desk') {
    const list = d.sorted.slice(0, 4).map(r =>
      row(`${toMMDD(r.date)} ${esc(r.item)}`, (r.expense ? '−' : '+') + fmt(r.expense || r.income), r.expense ? 'of-exp' : 'of-inc')).join('');
    return `<h4>📒 記帳桌 <small>小帳負責</small></h4>
      ${row('今天', d.todayCount + ' 筆')}${row('這個月', d.entries.length + ' 筆')}
      ${list ? `<div class="of-sub">最新紀錄</div>${list}` : '<p class="of-note">這個月還沒有紀錄。</p>'}
      <div class="of-actions"><button type="button" class="of-go" data-office-add>記一筆</button>${go('records', '看明細')}</div>`;
  }
  if (key === 'vault') {
    const love = d.love.map(p => row(`${p.name === '精靈' ? '🐎' : '🦊'} ${p.name} 每月的愛`,
      p.has ? `${fmt(p.amount)}（${p.arrived ? '已入帳' : p.date + ' 入帳'}）` : '尚未登記', p.has && p.arrived ? 'of-inc' : '')).join('');
    return `<h4>🏦 金庫 <small>阿庫負責</small></h4>
      ${love}${row('月底結算', d.settled ? '已完成' : '尚未結算')}
      ${d.settled ? d.back.map(b => row(`${b.name === '精靈' ? '🐎' : '🦊'} 轉回${b.name}`, fmt(b.amount), 'of-exp')).join('') : ''}
      <div class="of-actions">${d.back.some(b => b.row) ? `<button type="button" class="of-go" data-office-settle>${d.settled ? '修改結算' : '去結算'}</button>` : ''}${go('members', '看成員')}</div>`;
  }
  if (key === 'piggy') {
    const tip = d.mood === 'cry' ? '餘額是負的，小豬肚子空空，哭了。' : (d.mood === 'worry' ? '餘額剩不到兩成，金幣不多，小豬有點緊張。' : '金幣堆得滿滿的，小豬心情不錯。');
    return `<h4>🐷 存錢筒 <small>小豬</small></h4>
      ${row('期初餘額', fmt(d.starting))}${row('已入帳收入', '+' + fmt(d.arrived), 'of-inc')}${row('本月支出', '−' + fmt(d.expense), 'of-exp')}
      ${row('目前餘額', fmt(d.balance), d.balance < 0 ? 'of-exp' : 'of-inc')}${row('金幣', Math.round(d.ratio * 100) + '%')}
      <p class="of-note">${tip}（金幣堆的高度＝目前餘額 ÷（期初＋已入帳收入））</p>`;
  }
  if (key === 'shelf') {
    const list = d.alerts.slice(0, 8).map(a => row(esc(a.name), a.text, a.level === 'red' ? 'of-exp' : 'of-warn')).join('');
    return `<h4>📦 貨架 <small>阿貨負責</small></h4>
      ${row('庫存品項', d.items.length + ' 項')}${row('需要注意', d.alerts.length + ' 項', d.alerts.length ? 'of-exp' : 'of-inc')}
      ${list || '<p class="of-note">沒有要補貨或快到期的東西。</p>'}
      <div class="of-actions">${go('inventory', '看庫存')}</div>`;
  }
  const max = d.cats.length ? d.cats[0].value : 1;
  const bars = d.cats.slice(0, 6).map(c => `<div class="of-bar-row"><span>${esc(c.name)}</span><i><em style="width:${Math.max(4, c.value / max * 100).toFixed(0)}%"></em></i><b>${fmt(c.value)}</b></div>`).join('');
  const pace = d.pace ? `<div class="of-row"><span>跟上月同期比</span><b class="${d.pace.pct > 0 ? 'of-exp' : 'of-inc'}">${d.pace.pct > 0 ? '+' : ''}${d.pace.pct}%（上月同期 ${fmt(d.pace.same)}）</b></div>` : '';
  const replay = officePrev && !officePrev.none && officePrev.sheet === currentSheet() ? '<button type="button" class="of-go" data-office-meeting>重播月會</button>' : '';
  return `<h4>📊 白板 <small>小析負責</small></h4>
    ${pace}${bars || '<p class="of-note">這個月還沒有支出。</p>'}
    ${d.pace && d.pace.fast ? '<p class="of-note">這個月的支出速度比上個月快，白板會亮紅框提醒。</p>' : ''}
    <div class="of-actions">${replay}${go('analysis', '看分析')}</div>`;
}


// ── 員工、座位與走動路線 ──────────────────────────────────────
// 每一區有一條淨空的直走道（col），員工先橫向走到走道，再經中間走廊到另一區，不會穿過家具
const OFFICE_COL = { A: 325, B: 700, C: 420, D: 620 };
const OFFICE_HALL_Y = 610;
const OFFICE_SPOTS = {
  byDog:   { x: 658, y: 1070, zone: 'D' },  // 黑柴的窩旁邊
  byChart: { x: 400, y: 415, zone: 'A' },   // 小析座位旁
  byStock: { x: 815, y: 485, zone: 'B' },   // 阿貨座位旁
  byCash:  { x: 252, y: 1224, zone: 'C' },  // 阿庫座位旁
  tea2:    { x: 738, y: 832, zone: 'D' },   // 茶水間的第二個位置（一起喝茶）
  mail:    { x: 412, y: 735, zone: 'C' },   // 金庫門口（收信）
  trash:   { x: 745, y: 545, zone: 'B' },   // 倉庫的垃圾桶旁
  meet_chart: { x: 252, y: 262, zone: 'A' },   // 月會：小析站在白板左邊報告
  meet_stock: { x: 115, y: 440, zone: 'A' },    // 後排
  meet_cash:  { x: 228, y: 440, zone: 'A' },
  meet_elf:   { x: 341, y: 440, zone: 'A' },
  meet_book:  { x: 170, y: 540, zone: 'A' },    // 前排
  meet_fox:   { x: 285, y: 540, zone: 'A' },
  meet_dog:   { x: 395, y: 545, zone: 'A' },
  hugFox:  { x: 780, y: 1219, zone: 'D' },  // 小狐狸身邊（精靈走過去抱抱）
  hugElf:  { x: 840, y: 1219, zone: 'D' },  // 精靈身邊（小狐狸走過去抱抱）
  giveElf: { x: 690, y: 1112, zone: 'D' },  // 沙發前：把錢交給精靈
  giveFox: { x: 810, y: 1073, zone: 'D' },  // 沙發前：把錢交給小狐狸
  tea:   { x: 620, y: 808, zone: 'D', go: '走去茶水間', at: '倒杯茶休息一下', rest: true },
  board: { x: 325, y: 315, zone: 'A', go: '走去看白板', at: '看白板上的分類' },
  desk:  { x: 262, y: 350, zone: 'A', go: '走去記帳桌', at: '跟小帳對帳' },
  shelf: { x: 700, y: 380, zone: 'B', go: '走去貨架', at: '看看貨架' },
  piggy: { x: 372, y: 905, zone: 'C', go: '走去存錢筒', at: '看看存錢筒' },
};
const OFFICE_STAFF = [
  { id: 'book',  name: '小帳',   role: '記帳', tag: 'book',  seat: { x: 170, y: 335, zone: 'A' }, visits: ['tea', 'board'] },
  { id: 'chart', name: '小析',   role: '分析', tag: 'chart', seat: { x: 478, y: 410, zone: 'A' }, visits: ['board', 'desk', 'tea'] },
  { id: 'stock', name: '阿貨',   role: '倉管', tag: 'stock', seat: { x: 900, y: 480, zone: 'B' }, visits: ['shelf', 'shelf', 'tea'] },
  { id: 'cash',  name: '阿庫',   role: '出納', tag: 'cash',  seat: { x: 156, y: 1221, zone: 'C' }, visits: ['piggy', 'desk', 'tea'] },
  { id: 'elf',   name: '精靈',   role: '成員', tag: 'elf',   seat: { x: 752, y: 1219, zone: 'D' }, visits: ['piggy', 'shelf', 'tea', 'board'] },
  { id: 'fox',   name: '小狐狸', role: '成員', tag: 'fox',   seat: { x: 868, y: 1219, zone: 'D' }, visits: ['piggy', 'tea', 'shelf', 'desk'] },
  { id: 'dog',   name: '黑柴',   role: '吉祥物', tag: 'dog', seat: { x: 575, y: 1120, zone: 'D' }, visits: ['piggy', 'shelf', 'board', 'tea'], speed: 210 },
];
const officeActors = {};   // id -> { x, y, zone, state: 'seat'|'walk'|'visit', path, until, spot, back, face }

function officeInitActors() {
  OFFICE_STAFF.forEach((s, i) => {
    if (officeActors[s.id]) return;
    officeActors[s.id] = { x: s.seat.x, y: s.seat.y, zone: s.seat.zone, state: 'seat', path: [], until: 2500 + i * 1700 + Math.random() * 3000, spot: null, back: false, face: 1 };
  });
}

function officePath(from, fz, to, tz) {
  const pts = [];
  const cf = OFFICE_COL[fz], ct = OFFICE_COL[tz];
  if (fz === tz) {
    if (Math.abs(from.y - to.y) > 1) pts.push({ x: cf, y: from.y }, { x: cf, y: to.y });
  } else {
    pts.push({ x: cf, y: from.y }, { x: cf, y: OFFICE_HALL_Y }, { x: ct, y: OFFICE_HALL_Y }, { x: ct, y: to.y });
  }
  pts.push({ x: to.x, y: to.y });
  return pts;
}

// 每位員工、每種狀態正在做的事（文字來自真實資料）
function officeActivity(id, d) {
  const a = officeActors[id];
  if (a && a.job && a.state !== 'seat') {
    const st = a.job.steps[a.job.i];
    return a.state === 'walk' ? st.go : st.at;
  }
  const asleep = officePhase === 'night' && (!a || (a.state === 'seat' && !a.awake));
  if (officePhase === 'night' && a && a.awake && a.state === 'seat') return '被叫醒了，處理完再睡 😪';
  if (asleep) return id === 'dog' ? '睡在窩裡 💤' : (id === 'elf' || id === 'fox' ? '在沙發上依偎著睡著了 💤' : '趴在桌上打瞌睡 💤');
  if (id === 'dog') {
    if (a && a.state === 'walk') return a.back ? '跑回窩裡' : '在辦公室巡邏';
    if (a && a.state === 'visit') return a.spot === 'piggy' ? '聞聞小豬' : (a.spot === 'shelf' ? '聞聞貨架上的箱子' : (a.spot === 'board' ? '歪頭看白板' : '在茶水間討零食'));
    return '趴在窩裡休息';
  }
  if (a && a.state === 'walk') return a.back ? '走回座位' : OFFICE_SPOTS[a.spot].go;
  if (a && a.state === 'visit') {
    if (a.spot === 'tea' && officePhase === 'morning') return '早安～泡杯咖啡 ☕';
    if (a.spot === 'tea' && officePhase === 'evening') return '下班前喝杯茶 🍵';
    if (a.spot === 'shelf') return d.alerts.length ? `例行盤點：${d.alerts[0].name}${d.alerts[0].text}` : '例行檢查貨架';
    if (a.spot === 'piggy') return id === 'cash' ? '把零錢投進存錢筒' : `例行檢查存錢筒：${fmt(d.balance)}`;
    if (a.spot === 'board') return d.cats.length ? `例行檢查白板：${d.cats[0].name}最多` : '例行檢查白板';
    return OFFICE_SPOTS[a.spot].at;
  }
  const latest = d.sorted[0];
  const pending = d.love.filter(p => p.has && !p.arrived);
  const arrived = d.love.filter(p => p.has && p.arrived);
  if (id === 'book') {
    const n = officeNewCount[currentSheet()] || 0;
    if (n > 0) return `專心：新增了 ${n} 筆`;
    return d.todayCount > 0 && latest ? `專心：登記 ${latest.item}` : (latest ? `整理帳本：${latest.item}` : '等第一筆紀錄');
  }
  if (id === 'chart') {
    if (d.pace && d.pace.fast) return `專心：這個月花比較快（比上月同期 +${d.pace.pct}%）`;
    return d.cats.length ? `專心：${d.cats[0].name}占最多` : '等資料畫圖';
  }
  if (id === 'stock') return d.alerts.length ? `專心：${d.alerts[0].name}${d.alerts[0].text}` : (d.items.length ? '貨架都整理好了' : '貨架還是空的');
  if (id === 'cash') {
    if (d.settled) return '月底結算完成';
    if (pending.length) return `等 ${pending[0].date} 每月的愛入帳`;
    return arrived.length ? `專心：清點每月的愛 ${arrived.length}/2` : '顧金庫';
  }
  const o = d.owners[id === 'elf' ? '精靈' : '小狐狸'];
  return o.count ? `在沙發休息・本月花了 ${fmt(o.expense)}` : '在沙發休息・這個月還沒有支出';
}

// 每天一次的事件：每月的愛入帳當天、庫存有東西過期
function officeDailyEvents(d) {
  if (!officeIsCurrentMonth()) return;
  d.love.filter(p => p.arrivedToday && p.amount > 0).forEach(p => {
    if (officeOnce('love:' + p.name)) officeJobs.cash.push({ type: 'love', name: p.name, amount: p.amount });
  });
  const expired = d.alerts.filter(a => a.text === '已過期');
  if (expired.length && officeOnce('expired:' + expired.map(a => a.name).join(','))) {
    officeJobs.stock.push({ type: 'expired', names: expired.slice(0, 3).map(a => a.name), total: expired.length });
  }
}

// ── 記帳後的跑腿：記帳區登記 → 金庫領錢（收入則是存錢）──────────
function officeJobSteps(j) {
  if (j.type === 'skit' || j.type === 'meeting') return j.steps;
  if (j.type === 'love') {
    // 每月的愛入帳：阿庫到門口收信，再拿去投進小豬
    return [
      { spot: 'mail', fx: 'mail', stay: 2800, go: '去門口收信 💌', at: `收到${j.name}的每月的愛 💌` },
      { spot: 'piggy', fx: 'loveIn', amount: j.amount, stay: 3200, go: `把 ${fmt(j.amount)} 拿去存`, at: `存入 ${fmt(j.amount)} 🐷` },
    ];
  }
  if (j.type === 'expired') {
    // 過期：阿貨到貨架拿出來，丟進垃圾桶
    const names = j.names.join('、') + (j.total > j.names.length ? ` 等 ${j.total} 項` : '');
    return [
      { spot: 'shelf', fx: 'pick', stay: 2800, go: '去貨架拿過期的東西', at: `拿出過期的${names}` },
      { spot: 'trash', fx: 'trash', stay: 3000, go: '拿去垃圾桶', at: '丟掉 🗑️ 記得到庫存更新' },
    ];
  }
  if (j.type === 'settle') {
    // 月底結算：阿庫到存錢筒領錢，再送到沙發交給兩人（金額以目前資料為準）
    const back = officeData_ ? officeData_.back.filter(b => b.amount > 0) : [];
    if (!back.length) return [];
    const total = back.reduce((sum, b) => sum + b.amount, 0);
    return [
      { spot: 'piggy', fx: 'settleOut', amount: total, stay: 3200, go: '月底結算：去金庫領錢', at: `月底結算：領出 ${fmt(total)}` },
      ...back.map(b => ({ spot: b.name === '精靈' ? 'giveElf' : 'giveFox', fx: 'give', to: b.name === '精靈' ? 'elf' : 'fox', amount: b.amount, stay: 3200,
        go: `把 ${fmt(b.amount)} 送去給${b.name}`, at: `轉回${b.name} ${fmt(b.amount)}` })),
    ];
  }
  const name = j.item;
  const amt = fmt(j.amount);
  return [
    { spot: 'desk', fx: 'book', stay: 3400, go: `去記帳區登記「${name}」`, at: `登記：${name} ${j.income ? '+' : '−'}${amt}` },
    { spot: 'piggy', fx: 'money', stay: 3200, go: j.income ? `帶 ${amt} 去金庫存` : `去金庫領 ${amt}`, at: j.income ? `存入 ${amt}` : `領出 ${amt}` },
  ];
}

// ── 平常的角色互動：找人對帳、送補貨提醒、一起喝茶、沙發聊天（台詞來自真實資料）──
function officeSkits(d) {
  const free = id => officeActors[id].state === 'seat' && !officeActors[id].job;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const talk = (spot, go, at, lines, extra = {}) => ({ spot, go, at, fx: 'talk', lines, stay: lines.length * 2100 + 1600, ...extra });
  const top = d.cats[0], alert = d.alerts[0], latest = d.sorted[0];
  const pct = Math.round(d.ratio * 100);
  const moodLine = d.mood === 'cry' ? '糟糕，要趕快補錢' : (d.mood === 'worry' ? '要省一點了…' : '不錯耶，繼續保持');
  const list = [];
  const add = (key, ids, build) => { if (ids.every(free)) list.push({ key, ids, build }); };

  add('book-chart', ['book', 'chart'], () => ({ book: [talk('byChart', '拿帳本去找小析', '跟小析更新圖表', [
    { who: 'book', text: d.todayCount ? `今天記了 ${d.todayCount} 筆，圖表麻煩更新` : `這個月共 ${d.entries.length} 筆，幫我看一下` },
    { who: 'chart', text: top ? `收到！目前${top.name}最多，${fmt(top.value)}` : '收到！等有支出我就畫圖' },
    { who: 'book', text: '了解，謝啦' }])] }));

  add('chart-book', ['chart', 'book'], () => ({ chart: [talk('desk', '去找小帳核對數字', '跟小帳核對數字', [
    { who: 'chart', text: top ? `${top.name}這個月 ${fmt(top.value)}，幫我核對一下` : '最近沒有支出，帳本借我看看' },
    { who: 'book', text: latest ? `最新一筆是「${latest.item}」，數字沒錯 ✓` : '帳本還是空的喔' }])] }));

  add('cash-book', ['cash', 'book'], () => ({ cash: [talk('desk', '去找小帳對帳', '跟小帳對帳', [
    { who: 'cash', text: `目前餘額 ${fmt(d.balance)}，跟你對一下` },
    { who: 'book', text: `本月支出 ${fmt(d.expense)}，數字一樣 ✓` }])] }));

  ['elf', 'fox'].forEach(m => {
    const name = m === 'elf' ? '精靈' : '小狐狸', spot = m === 'elf' ? 'giveElf' : 'giveFox';
    const o = d.owners[name], love = d.love.find(p => p.name === name);

    add('stock-' + m, ['stock', m], () => ({ stock: [talk(spot, `去找${name}講補貨的事`, `跟${name}講補貨的事`, alert ? [
      { who: 'stock', text: `${alert.name}${alert.text}，記得補貨喔` },
      { who: m, text: d.alerts.length > 1 ? `好，還有 ${d.alerts.length - 1} 項也一起買` : '好，下次順便買' }] : [
      { who: 'stock', text: d.items.length ? '庫存都夠，這週不用補貨' : '倉庫還空空的，要不要登記庫存？' },
      { who: m, text: d.items.length ? '太好了 ✨' : '好，我找時間登記' }])] }));

    add('cash-' + m, ['cash', m], () => ({ cash: [talk(spot, `去找${name}報告金庫狀況`, `跟${name}報告金庫狀況`, love && love.has && !love.arrived ? [
      { who: 'cash', text: `${name}的每月的愛 ${love.date} 入帳喔` },
      { who: m, text: '記得了！' }] : [
      { who: 'cash', text: `小豬的金幣 ${pct}%，餘額 ${fmt(d.balance)}` },
      { who: m, text: moodLine }])] }));

    add(m + '-book', [m, 'book'], () => ({ [m]: [talk('desk', '去問小帳這個月花多少', '問小帳這個月花多少', [
      { who: m, text: '我這個月花了多少？' },
      { who: 'book', text: o.count ? `${fmt(o.expense)}，共 ${o.count} 筆` : '這個月還沒有支出喔' },
      { who: m, text: o.count ? '好，心裡有數了' : '真的嗎，太棒了' }])] }));

    add(m + '-stock', [m, 'stock'], () => ({ [m]: [talk('byStock', '去問阿貨家裡缺什麼', '問阿貨家裡缺什麼', [
      { who: m, text: '家裡還缺什麼嗎？' },
      { who: 'stock', text: d.alerts.length ? `${d.alerts.slice(0, 2).map(a => a.name).join('、')}要補${d.alerts.length > 2 ? `，共 ${d.alerts.length} 項` : ''}` : '目前都不缺' },
      { who: m, text: d.alerts.length ? '好，我記下來' : '那就好' }])] }));
  });

  // 黑柴：牠去找人玩，或大家到窩邊摸牠
  const dogSpot = { book: 'desk', chart: 'byChart', stock: 'byStock', cash: 'byCash', elf: 'giveElf', fox: 'giveFox' };
  const dogName = { book: '小帳', chart: '小析', stock: '阿貨', cash: '阿庫', elf: '精靈', fox: '小狐狸' };
  const dogLine = id => id === 'book' ? (d.todayCount ? `乖～今天記了 ${d.todayCount} 筆，等等陪你玩` : '乖～今天還沒人記帳，陪你玩一下')
    : id === 'chart' ? (top ? `你看，${top.name}花最多…你聽不懂吧` : '乖，來，摸摸頭')
    : id === 'stock' ? (alert ? `${alert.name}${alert.text}，還好你的零食還有 🦴` : '來，給你零食 🦴')
    : id === 'cash' ? '不可以咬鈔票喔，摸摸頭'
    : id === 'elf' ? '黑柴過來，抱抱 💕' : '好乖好乖，握手！';
  Object.keys(dogSpot).forEach(id => {
    add('dog-' + id, ['dog', id], () => ({ dog: [talk(dogSpot[id], `跑去找${dogName[id]}玩`, `找${dogName[id]}玩`, [
      { who: 'dog', text: '汪！' },
      { who: id, text: dogLine(id), pet: true, emoji: id === 'stock' ? '🦴' : '' },
      { who: 'dog', text: '汪汪 ♪', emoji: '💕' }])] }));
    add(id + '-dog', [id, 'dog'], () => ({ [id]: [talk('byDog', '去窩邊找黑柴', '在窩邊摸黑柴', [
      { who: id, text: pick(['黑柴～來摸摸', '黑柴，今天乖不乖？', '休息一下，找黑柴玩']), pet: true },
      { who: 'dog', text: pick(['汪 ♪（搖尾巴）', '汪！（翻肚子）', '嗷嗚～']), emoji: '💕' },
      { who: id, text: pick(['好療癒，回去工作了', '真乖，晚點再來', '摸一下精神都來了']) }])] }));
  });

  // 這個月花比較快：阿庫去找小析確認
  if (d.pace && d.pace.fast) add('pace', ['cash', 'chart'], () => ({ cash: [talk('byChart', '去找小析確認支出', '跟小析確認支出', [
    { who: 'cash', text: '小析，這個月是不是花比較快？' },
    { who: 'chart', text: `對，比上個月同期多 ${d.pace.pct}%，多了 ${fmt(d.pace.diff)}` },
    { who: 'cash', text: '收到，我提醒精靈和小狐狸 🙏' }])] }));

  // 一起喝茶：兩位員工各自走到茶水間，都到了才開始聊
  const staffLine = id => id === 'book' ? (d.todayCount ? `今天記了 ${d.todayCount} 筆` : '今天還沒有新的帳')
    : id === 'chart' ? (top ? `${top.name}還是占最多` : '還沒有資料可以畫圖')
    : id === 'stock' ? (d.alerts.length ? `還有 ${d.alerts.length} 項要補貨` : '貨架都整理好了')
    : `小豬的金幣 ${pct}%`;
  [pick([['book', 'cash'], ['chart', 'stock'], ['book', 'stock'], ['chart', 'cash']])].forEach(([a, b]) => {
    add('tea-' + a + '-' + b, [a, b], () => ({
      [a]: [talk('tea', '約同事去茶水間', '在茶水間聊天', [
        { who: a, text: '休息一下，喝杯茶 ☕' },
        { who: b, text: staffLine(b) },
        { who: a, text: staffLine(a) },
        { who: b, text: '辛苦了，回去繼續' }], { waitFor: b })],
      [b]: [{ spot: 'tea2', go: '一起去茶水間', at: '在茶水間聊天', stay: 4 * 2100 + 1600, waitFor: a }],
    }));
  });

  // 沙發聊天：兩人都坐著時直接聊，不用走動
  if (free('elf') && free('fox')) {
    const oe = d.owners['精靈'], of = d.owners['小狐狸'];
    const chats = [[
      { who: 'elf', text: `我這個月花了 ${fmt(oe.expense)}` },
      { who: 'fox', text: oe.expense >= of.expense ? `我 ${fmt(of.expense)}，你比較多耶` : `我 ${fmt(of.expense)}，這次我比較多` },
      { who: 'elf', text: '一起省一點 💪', heart: true }], [
      { who: 'fox', text: `小豬的金幣有 ${pct}% 了` },
      { who: 'elf', text: moodLine, heart: d.mood === 'happy' }]];
    if (latest) chats.push([
      { who: 'fox', text: `「${latest.item}」記了嗎？` },
      { who: 'elf', text: '記了，小帳說記好了 ✓', heart: true }]);
    if (alert) chats.push([
      { who: 'elf', text: `${alert.name}${alert.text}，週末去買？` },
      { who: 'fox', text: '好啊，順便逛逛', heart: true }]);
    // 晚上：沙發上的悄悄話
    const nightChats = [[
      { who: 'elf', text: '好睏喔… 😪' },
      { who: 'fox', text: '晚安，明天見 💕', heart: true }], [
      { who: 'fox', text: '今天也辛苦了' },
      { who: 'elf', text: '你也是，晚安 🌙', heart: true }]];
    list.push({ key: 'sofa', ids: ['elf', 'fox'], sofa: () => pick(officePhase === 'night' ? nightChats : chats) });

    // 愛的互動：沙發上親親，或走過去抱抱（burst＝冒出愛心和粉紅泡泡，lean＝兩人靠在一起）
    const kisser = pick(['elf', 'fox']), kissed = kisser === 'elf' ? 'fox' : 'elf';
    const nm = id => id === 'elf' ? '精靈' : '小狐狸';
    list.push({ key: 'love-kiss', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: kisser, text: `${nm(kissed)}～` },
      { who: kissed, text: '嗯？' },
      { who: kisser, text: '啾 😘', lean: true, burst: true },
      { who: kissed, text: pick(['（臉紅）我也愛你 💕', '再一個！', '討厭啦～ 💗']), burst: true }], [
      { who: kisser, text: '今天也辛苦了' },
      { who: kissed, text: '你也是，親一個 😘', lean: true, burst: true },
      { who: kisser, text: '最喜歡你了 💖', burst: true }]]) });
  }
  if (free('elf') && free('fox')) {
    const nm = id => id === 'elf' ? '精靈' : '小狐狸';
    const mover = pick(['elf', 'fox']), other = mover === 'elf' ? 'fox' : 'elf';
    add('love-hug', ['elf', 'fox'], () => ({ [mover]: [talk(mover === 'elf' ? 'hugFox' : 'hugElf', `走去抱${nm(other)}`, `抱抱${nm(other)}`, [
      { who: mover, text: pick(['抱抱～', '想抱你一下', '充電時間到 🔋']) },
      { who: other, text: pick(['來，抱緊緊 🤗', '好呀～', '抱抱補充能量']), lean: true, burst: true },
      { who: mover, text: pick(['好溫暖 💕', '愛你 💗', '充飽電了 ⚡']), burst: true }])] }));
  }
  return list;
}

function officeStartSkit(d, ts) {
  let list = officeSkits(d);
  if (list.length > 1) list = list.filter(k => k.key !== officeSkitLast);
  if (!list.length) return false;
  // 晚上：大家在睡覺，只剩沙發上的悄悄話
  if (officePhase === 'night') {
    list = list.filter(k => k.key === 'love-kiss' || k.key === 'sofa');
    if (!list.length || Math.random() < 0.5) return false;
  }
  // 花太快時，優先演提醒的那一段
  const paceSkit = list.find(k => k.key === 'pace');
  if (paceSkit && Math.random() < 0.4) list = [paceSkit];
  // 精靈和小狐狸都有空時，三成機會是愛的互動
  const love = list.filter(k => k.key.startsWith('love'));
  if (love.length && Math.random() < 0.3) list = love;
  const k = list[Math.floor(Math.random() * list.length)];
  officeSkitLast = k.key;
  // 參與的人這段時間先不要自己走開
  k.ids.forEach(id => { officeActors[id].until = Math.max(officeActors[id].until, ts + 30000); });
  if (k.sofa) {
    const lines = k.sofa();
    officeJobFx({ i: 0, steps: [{ fx: 'talk', lines }], rec: { type: 'skit' } });
    k.ids.forEach(id => { officeActors[id].until = ts + lines.length * 2100 + 4000 + Math.random() * 6000; });
    return false;
  }
  const sid = ++officeSkitSeq;
  const jobs = k.build();
  Object.keys(jobs).forEach(id => officeJobs[id].push({ type: 'skit', sid, steps: jobs[id] }));
  // 留在座位的人，聊完後再恢復自己的節奏
  k.ids.filter(id => !jobs[id]).forEach(id => { officeActors[id].until = ts + 26000 + Math.random() * 6000; });
  return true;
}

// app.js 新增紀錄成功後呼叫
function officeNoteRecord(data) {
  if (!data) return;
  const id = data.owner === '精靈' ? 'elf' : (data.owner === '小狐狸' ? 'fox' : null);
  const income = Number(data.income) > 0;
  const amount = income ? Number(data.income) : Number(data.expense);
  if (!id || !(amount > 0)) return;
  // 確認這筆真的寫進去了
  if (!records.some(r => r.item === data.item && (income ? r.income : r.expense) === amount)) return;
  officeJobs[id].push({ item: String(data.item || ''), amount, income });
  if (officeJobs[id].length > 3) officeJobs[id].shift();
  const sheet = currentSheet();
  if (officeNewCount[sheet] !== undefined) {
    officeNewCount[sheet]++;
    try { localStorage.setItem(OFFICE_SEEN_PREFIX + sheet, String(records.filter(r => !isSummaryRow(r) && r.item !== '帳戶餘額').length)); } catch (e) { /* ignore */ }
  }
  if (officeVisible()) {
    // 暫停中也讓這一趟跑完，才看得到結果
    if (officePaused) {
      officePaused = false;
      const pause = document.getElementById('office-pause');
      if (pause) pause.textContent = '暫停';
      const scene = document.getElementById('office-scene');
      if (scene) scene.classList.remove('paused');
    }
    officeRefreshTexts();
    officeStart();
  }
}

// app.js 修改「支出部分轉回」的轉回金額後呼叫：排一趟月底結算（重複修改只排一趟）
function officeNoteSettle() {
  if (!officeJobs.cash.some(j => j.type === 'settle')) officeJobs.cash.push({ type: 'settle' });
}

// 晚上被叫到的人：先醒來回話，過幾秒再睡回去
function officeWakeSay(id, text) {
  const el = document.querySelector(`.of-actor[data-office-id="${id}"]`);
  const asleep = officePhase === 'night' && el && el.classList.contains('sleeping');
  if (!asleep) { officeSay(id, text); return; }
  el.classList.remove('sleeping');
  officeActors[id].awake = true;
  officeSay(id, '（揉眼睛）' + text);
  clearTimeout(el._sleep);
  el._sleep = setTimeout(() => {
    officeActors[id].awake = false;
    const cur = document.querySelector(`.of-actor[data-office-id="${id}"]`);
    if (cur && officePhase === 'night' && officeActors[id].state === 'seat' && !officeActors[id].job) cur.classList.add('sleeping');
    if (officeVisible()) officeRefreshTexts();
  }, 5000);
  officeRefreshTexts();
}

// 點場景裡的角色：跳一下、打招呼；黑柴會叫，小豬吐金幣
function officeReact(id) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  if (id === 'piggy') {
    const pig = document.querySelector('.of-pigbtn');
    if (pig) { pig.classList.remove('poke'); void pig.offsetWidth; pig.classList.add('poke'); setTimeout(() => pig.classList.remove('poke'), 700); }
    officeFloat(pick(['🪙 叮！', '🪙 叮叮！', '🪙 噗嚕～']), false);
    return;
  }
  const el = document.querySelector(`.of-actor[data-office-id="${id}"]`);
  const a = officeActors[id];
  if (!el || !a) return;
  el.classList.remove('react'); void el.offsetWidth; el.classList.add('react');
  setTimeout(() => el.classList.remove('react'), 700);
  if (a.job && a.job.rec.type !== 'skit') return;   // 正在跑腿或開會：跳一下就好，不打斷
  const sleepy = officePhase === 'night' && a.state === 'seat';
  const lines = {
    book: ['嗨～我在記帳 ✍️', '今天也要記得記帳喔', '有什麼要記的嗎？'],
    chart: ['嗨！要看圖表嗎？📊', '數字我都盯著喔', '嘿嘿，被你發現了'],
    stock: ['嗨～倉庫交給我 📦', '要補貨記得跟我說', '嘿！'],
    cash: ['嗨～金庫很安全 🔐', '錢都數好了', '嘿嘿 💰'],
    elf: ['嗨～ 💕', '幹嘛啦～', '嘿嘿 😊'],
    fox: ['嗨～ 🦊', '幹嘛戳我啦', '嘿嘿 😊'],
    dog: ['汪！', '汪汪！（搖尾巴）', '嗷嗚～'],
  };
  officeSay(id, sleepy ? (id === 'dog' ? '（打哈欠）嗚…' : '（揉眼睛）嗯…？ 😪') : pick(lines[id] || ['嗨～']));
  if (id === 'dog') {
    officeDogPets++;
    const n = document.querySelector('[data-office-num="dog"]'); if (n) n.textContent = officeDogPets + ' 次';
    officeFloat('🐾', false, { x: a.x, y: a.y - 30 });
  }
  if (id === 'elf' || id === 'fox') officeFloat('💗', false, { x: a.x, y: a.y - 30 });
}

// 精靈和小狐狸靠在一起（各自往對方那邊傾）
function officeLean(ms) {
  const e = officeActors.elf, f = officeActors.fox;
  const pairs = [['elf', e.x <= f.x ? 1 : -1], ['fox', e.x <= f.x ? -1 : 1]];
  pairs.forEach(([id, dir]) => {
    const el = document.querySelector(`.of-actor[data-office-id="${id}"]`);
    if (!el) return;
    // 角色若左右翻轉，旋轉方向也跟著反過來
    const lean = dir * (officeActors[id].face || 1) > 0 ? 'lean-r' : 'lean-l';
    el.classList.remove('lean-r', 'lean-l');
    el.classList.add(lean);
    clearTimeout(el._lean);
    el._lean = setTimeout(() => el.classList.remove('lean-r', 'lean-l'), ms);
  });
}

// 從兩人中間冒出愛心和粉紅泡泡
function officeLoveBurst() {
  const scene = document.getElementById('office-scene');
  if (!scene || officePaused) return;
  const e = officeActors.elf, f = officeActors.fox;
  const cx = (e.x + f.x) / 2, cy = Math.min(e.y, f.y) - 80;
  const hearts = ['💗', '💕', '💖', '💞', '❤️'];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('span');
    const bubble = i % 3 === 2;
    el.className = 'of-love' + (bubble ? ' bub' : '');
    if (!bubble) el.textContent = hearts[i % hearts.length];
    el.style.left = ((cx + (Math.random() - 0.5) * 70) / 10).toFixed(2) + '%';
    // 疊在兩人身後冒出來，不會蓋住名牌和對話框
    el.style.zIndex = String(Math.round(Math.min(e.y, f.y)) - 1);
    el.style.top = (cy / 13).toFixed(2) + '%';
    el.style.setProperty('--dx', ((Math.random() - 0.5) * 18).toFixed(1) + 'cqw');
    el.style.setProperty('--dy', (-(8 + Math.random() * 14)).toFixed(1) + 'cqw');
    el.style.setProperty('--s', (0.8 + Math.random() * 0.7).toFixed(2));
    el.style.animationDelay = (i * 0.07).toFixed(2) + 's';
    scene.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

// 金額從存錢筒飄出來（支出）或飄進去（收入）；at 有給座標時改飄在那個位置
function officeFloat(text, income, at) {
  const scene = document.getElementById('office-scene');
  if (!scene) return;
  const el = document.createElement('span');
  el.className = 'of-float ' + (income ? 'inc' : 'exp');
  el.textContent = text;
  if (at) { el.style.left = (at.x / 10).toFixed(2) + '%'; el.style.top = ((at.y - 130) / 13).toFixed(2) + '%'; }
  scene.appendChild(el);
  const pig = at ? null : scene.querySelector('.of-pigbtn');
  if (pig) { pig.classList.add('poke'); setTimeout(() => pig.classList.remove('poke'), 700); }
  setTimeout(() => el.remove(), 2000);
}

function officeJobFx(job) {
  const st = job.steps[job.i], j = job.rec;
  if (!st.fx || st.fx === 'meet') return;
  if (st.fx === 'talk') {
    // 對話期間（含最後一句停留的時間）加 1.5 秒，平常的對話框先不出現
    officeQuietUntil = Math.max(officeQuietUntil, performance.now() + ((st.lines || []).length - 1) * 2100 + 3200 + 1500);
    // 一來一往的對話：每句隔 2.1 秒；對方已經走開就不講了
    (st.lines || []).forEach((l, i) => setTimeout(() => {
      if (!officeVisible() || officePaused) return;
      const o = officeActors[l.who];
      if (!o || o.state === 'walk') return;
      // 換人講話時，先收起對方的對話框，才不會疊在一起
      [...new Set(st.lines.map(x => x.who))].filter(w => w !== l.who).forEach(officeHush);
      officeSay(l.who, l.text);
      if (l.emoji) officeFloat(l.emoji, false, { x: o.x, y: o.y - 30 });
      if (l.pet) { officeDogPets++; const n = document.querySelector('[data-office-num="dog"]'); if (n) n.textContent = officeDogPets + ' 次'; }
      if (l.lean) officeLean(2600 + 2100);
      if (l.burst) officeLoveBurst();
      if (l.heart) officeFloat('💕', false, { x: (officeActors.elf.x + officeActors.fox.x) / 2, y: officeActors.elf.y - 40 });
    }, i * 2100));
    return;
  }
  if (st.fx === 'mail') { officeFloat('💌', false, OFFICE_SPOTS.mail); return; }
  if (st.fx === 'loveIn') {
    officeFloat('+' + fmt(st.amount), true);
    setTimeout(() => officeSay('cash', '小豬吃飽飽 🐷💕'), 1500);
    return;
  }
  if (st.fx === 'pick') { officeFloat('📦', false, OFFICE_SPOTS.shelf); return; }
  if (st.fx === 'trash') { officeFloat('🗑️', false, OFFICE_SPOTS.trash); return; }
  if (st.fx === 'settleOut') { officeFloat('−' + fmt(st.amount), false); return; }
  if (st.fx === 'give') {
    const to = officeActors[st.to];
    setTimeout(() => {
      officeFloat('+' + fmt(st.amount), true, to);
      setTimeout(() => { if (to.state !== 'walk') officeWakeSay(st.to, `收到 ${fmt(st.amount)}，謝謝阿庫`); }, 1300);
    }, 600);
    return;
  }
  if (st.fx === 'book') {
    setTimeout(() => { if (officeActors.book.state === 'seat') officeWakeSay('book', '收到，記好了 ✓'); }, 1400);
  } else {
    officeFloat((j.income ? '+' : '−') + fmt(j.amount), j.income);
    setTimeout(() => { if (officeActors.cash.state === 'seat') officeWakeSay('cash', j.income ? '入帳確認 ✓' : '出帳確認 ✓'); }, 1400);
  }
}

function officeMetric(id, d) {
  if (id === 'book') return ['今日記帳', d.todayCount];
  if (id === 'chart') return ['支出分類', d.cats.length];
  if (id === 'stock') return ['待補貨', d.alerts.length];
  if (id === 'cash') return ['已入帳', d.love.filter(p => p.has && p.arrived).length + '/2'];
  if (id === 'piggy') return ['金幣', Math.round(d.ratio * 100) + '%'];
  if (id === 'dog') return ['被摸', officeDogPets + ' 次'];
  return ['今日筆數', d.owners[id === 'elf' ? '精靈' : '小狐狸'].today];
}

// 成員的本月統計
function officeOwners(d) {
  const now = new Date();
  const todayKey = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0');
  const out = {};
  ['精靈', '小狐狸'].forEach(name => {
    const mine = d.entries.filter(r => r.owner === name);
    const spend = mine.filter(r => r.expense > 0 && !(r.note && r.note.includes('先付')));
    out[name] = {
      expense: spend.reduce((s, r) => s + r.expense, 0),
      count: spend.length,
      today: mine.filter(r => toMMDD(r.date) === todayKey).length,
    };
  });
  return out;
}

function officeMemberDetail(id, d) {
  const name = id === 'elf' ? '精靈' : '小狐狸';
  const o = d.owners[name];
  const love = d.love.find(p => p.name === name);
  const row = (label, value, cls = '') => `<div class="of-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
  return `<h4>${id === 'elf' ? '🐎' : '🦊'} ${name} <small>成員</small></h4>
    ${row('本月支出', fmt(o.expense), 'of-exp')}${row('支出筆數', o.count + ' 筆')}${row('今天', o.today + ' 筆')}
    ${row('每月的愛', love.has ? `${fmt(love.amount)}（${love.arrived ? '已入帳' : love.date + ' 入帳'}）` : '尚未登記', love.has && love.arrived ? 'of-inc' : '')}
    <div class="of-actions"><button type="button" class="of-go" data-office-add="${name}">幫${name}記一筆</button><button type="button" class="of-go" data-office-go="members">看成員</button></div>`;
}

const OFFICE_DETAIL_KEY = { book: 'desk', cash: 'vault', stock: 'shelf', chart: 'board', piggy: 'piggy' };

// ── 畫面 ──────────────────────────────────────────────────────
function officePos(a) { return `left:${(a.x / 10).toFixed(2)}%;top:${(a.y / 13).toFixed(2)}%;z-index:${Math.round(a.y)}`; }

function officeStatusText(d) {
  const all = Object.keys(officeActors).filter(k => k !== 'dog').map(k => officeActors[k]);
  const seat = all.filter(a => a.state === 'seat').length;
  const walk = all.filter(a => a.state === 'walk').length;
  const rest = all.filter(a => a.state === 'visit').length;
  const meeting = Object.values(officeActors).some(a => a.job && a.job.rec.type === 'meeting');
  const job = all.filter(a => a.job && a.job.rec.type !== 'skit' && a.job.rec.type !== 'meeting').length;
  const chip = (icon, text, title, cls = '') => `<span class="of-chip${cls ? ' ' + cls : ''}" title="${title}">${icon}<b>${text}</b></span>`;
  return [
    chip('', OFFICE_PHASE_LABEL[officePhase], '現在的時段'),
    meeting ? chip('📋', '月會中', '大家在白板前開月會', 'hot') : '',
    job ? chip('🏃', job, '正在跑腿（記帳、結算、收信、丟垃圾）', 'hot') : '',
    chip('🪑', seat, '在座位上'),
    chip('🚶', walk, '走動中'),
    chip('☕', rest, '巡視或休息'),
    chip('📦', d.alerts.length, '待補貨', d.alerts.length ? 'warn' : ''),
    chip('🐷', Math.round(d.ratio * 100) + '%', '存錢筒的金幣', d.mood !== 'happy' ? 'warn' : ''),
    d.pace && d.pace.fast ? chip('⚠️', `花比較快 +${d.pace.pct}%`, '本月支出比上個月同期多', 'warn') : '',
  ].join('');
}

function drawOffice() {
  const scene = document.getElementById('office-scene');
  if (!scene) return;
  let d;
  try { d = officeData(); d.owners = officeOwners(d); }
  catch (e) { scene.innerHTML = '<div class="empty-state">⚠️ 辦公室載入失敗</div>'; return; }
  d.pace = officePace(d);
  officeData_ = d;
  officePhase = officePhaseNow();
  officeInitActors();
  officeDailyEvents(d);

  const actorsHtml = OFFICE_STAFF.map(s => {
    const a = officeActors[s.id];
    const sleep = officePhase === 'night' && a.state === 'seat' && !a.job;
    return `<button type="button" class="of-actor tag-${s.tag}${a.state === 'walk' ? ' walking' : ''}${sleep ? ' sleeping' : ''}${officeSelected === s.id ? ' selected' : ''}" data-office-id="${s.id}" style="${officePos(a)}" aria-label="${s.name}（${s.role}）">
      <span class="of-say"></span><span class="of-name">${s.name}</span>
      <span class="of-fig" style="transform:scaleX(${a.face})">${officeActorSvg(s.id)}</span>
    </button>`;
  }).join('');

  scene.dataset.phase = officePhase;
  // 晚上和傍晚：燈亮起來的位置（桌燈、螢幕、貨架、小豬、沙發、茶水機）
  const glows = [[165, 200], [478, 290], [800, 210], [190, 820], [810, 1150], [547, 790]]
    .map(([x, y]) => `<span class="of-glow" style="left:${x / 10}%;top:${(y / 13).toFixed(2)}%"></span>`).join('');
  scene.innerHTML = `${officeBgSvg(d)}<div class="of-shade"></div>${glows}
    <button type="button" class="of-pigbtn mood-${d.mood}${officeSelected === 'piggy' ? ' selected' : ''}" data-office-id="piggy" aria-label="小豬（存錢筒）">
      <span class="of-name">小豬</span>${officePiggySvg(d)}
    </button>
    ${actorsHtml}`;

  const status = document.getElementById('office-status');
  if (status) status.innerHTML = officeStatusText(d);
  const pause = document.getElementById('office-pause');
  if (pause) pause.textContent = officePaused ? '繼續' : '暫停';

  const detail = document.getElementById('office-detail');
  if (detail) {
    detail.hidden = !officeSelected;
    detail.innerHTML = !officeSelected ? ''
      : officeSelected === 'dog' ? `<h4>🐕 黑柴 <small>吉祥物</small></h4>
          <div class="of-row"><span>現在</span><b>${esc(officeActivity('dog', d))}</b></div>
          <div class="of-row"><span>這次被摸</span><b>${officeDogPets} 次</b></div>
          <p class="of-note">黑柴會在辦公室巡邏、找大家玩，大家有空也會去窩邊摸牠。</p>`
      : (officeSelected === 'elf' || officeSelected === 'fox' ? officeMemberDetail(officeSelected, d) : officeDetailHtml(OFFICE_DETAIL_KEY[officeSelected], d));
  }

  const list = document.getElementById('office-list');
  if (list) {
    const cards = [...OFFICE_STAFF.slice(0, 4), { id: 'piggy', name: '小豬', role: '存錢', tag: 'piggy' }, ...OFFICE_STAFF.slice(4)];
    list.innerHTML = cards.map(s => {
      const [label, num] = officeMetric(s.id, d);
      const act = s.id === 'piggy'
        ? (d.mood === 'cry' ? `透支 ${fmt(-d.balance)}，肚子空空哭哭` : (d.mood === 'worry' ? `餘額 ${fmt(d.balance)}，金幣不多有點緊張` : `餘額 ${fmt(d.balance)}，金幣滿滿心情好`))
        : officeActivity(s.id, d);
      const ava = s.id === 'piggy' ? '<span class="of-ava of-ava-pig">🐷</span>' : `<span class="of-ava">${officeActorSvg(s.id)}</span>`;
      return `<button type="button" class="of-card${officeSelected === s.id ? ' selected' : ''}" data-office-id="${s.id}">
        ${ava}
        <span class="of-card-main"><span class="of-card-top"><b>${s.name}</b><em class="of-tag tag-${s.tag}">${s.role}</em></span>
          <span class="of-card-num"><small>${label}</small><b data-office-num="${s.id}">${num}</b></span></span>
        <small class="of-card-act" data-office-act="${s.id}">${esc(act)}</small>
      </button>`;
    }).join('');
  }
}

// 只更新會變的文字（員工正在做的事、上方狀態列），不重畫整個場景
function officeRefreshTexts() {
  const d = officeData_;
  if (!d) return;
  OFFICE_STAFF.forEach(s => {
    const el = document.querySelector(`[data-office-act="${s.id}"]`);
    if (el) el.textContent = officeActivity(s.id, d);
  });
  const status = document.getElementById('office-status');
  if (status) status.innerHTML = officeStatusText(d);
}

function officeHush(id) {
  const el = document.querySelector(`.of-actor[data-office-id="${id}"] .of-say`);
  if (!el) return;
  clearTimeout(el._hide);
  el.classList.remove('show');
  el.parentElement.classList.remove('saying');
}

// 對話框以說話的人為中心；超出場景左右邊界時才往內推，小尾巴仍指著本人
function officeSayFit(id) {
  const el = document.querySelector(`.of-actor[data-office-id="${id}"] .of-say`);
  const scene = document.getElementById('office-scene');
  if (!el || !scene) return;
  const W = scene.clientWidth, pad = W * 0.015;
  const cx = officeActors[id].x / 1000 * W;
  // 靠近左右邊界的人，對話框窄一點（多換行），才不會整個蓋到旁邊的人頭上
  const room = 2 * (Math.min(cx, W - cx) - pad);
  el.style.maxWidth = Math.max(W * 0.32, Math.min(W * 0.48, room)).toFixed(0) + 'px';
  const half = el.offsetWidth / 2;
  let dx = 0;
  if (cx - half < pad) dx = pad - (cx - half);
  else if (cx + half > W - pad) dx = (W - pad) - (cx + half);
  // 尾巴不能跑出對話框
  const lim = Math.max(0, half - W * 0.03);
  dx = Math.max(-lim, Math.min(lim, dx));
  el.style.setProperty('--dx', dx.toFixed(1) + 'px');
}

function officeSay(id, text) {
  const el = document.querySelector(`.of-actor[data-office-id="${id}"] .of-say`);
  if (!el) return;
  const actor = el.parentElement;
  actor.classList.add('saying');
  el.textContent = text;
  const nameEl = actor.querySelector('.of-name');
  if (nameEl) el.style.setProperty('--sayc', getComputedStyle(nameEl).color);
  officeSayFit(id);
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => { el.classList.remove('show'); actor.classList.remove('saying'); }, 3200);
}

// ── 動畫迴圈：依時間移動員工 ──────────────────────────────────
const OFFICE_SPEED = 150;   // 每秒走多少單位（場景寬 1000）
function officeTick(ts) {
  officeRaf = null;
  if (!officeVisible() || officePaused) return;
  const dt = Math.min(0.1, (ts - (officeLastTs || ts)) / 1000);
  officeLastTs = ts;
  const d = officeData_;
  let changed = false;
  // 每 30 秒確認一次時段，換時段就重畫（燈光、睡覺）
  if (ts >= officePhaseCheckAt) {
    officePhaseCheckAt = ts + 30000;
    if (officePhaseNow() !== officePhase) { drawOffice(); officeRaf = requestAnimationFrame(officeTick); return; }
  }
  const night = officePhase === 'night';
  officeMeetingTick(ts, d);
  const walking = Object.values(officeActors).filter(a => a.state === 'walk').length;
  let canStart = walking < 3;

  // 月底結算進行中（或排隊中）：精靈和小狐狸回沙發坐好等阿庫送錢來
  const settleOn = officeJobs.cash.some(j => j.type === 'settle') || !!(officeActors.cash.job && officeActors.cash.job.rec.type === 'settle');
  const membersSeated = officeActors.elf.state === 'seat' && officeActors.fox.state === 'seat';

  OFFICE_STAFF.forEach(s => {
    const a = officeActors[s.id];
    const el = document.querySelector(`.of-actor[data-office-id="${s.id}"]`);
    const member = s.id === 'elf' || s.id === 'fox';
    if (settleOn && member && !a.job && a.state === 'visit') a.until = Math.min(a.until, ts);
    const q = officeJobs[s.id];
    const ready = !!(q && q.length) && (q[0].type !== 'settle' || membersSeated);
    if (a.waiting && a.job && a.state === 'visit') {
      const st = a.job.steps[a.job.i], o = officeActors[st.waitFor];
      if (o && o.state === 'visit' && o.job && o.job.rec.sid === a.job.rec.sid) {
        a.waiting = false; a.until = ts + st.stay;
        officeJobFx(a.job);
      }
    }
    if (a.state === 'walk') {
      let step = (s.speed || OFFICE_SPEED) * dt;
      while (step > 0 && a.path.length) {
        const p = a.path[0];
        const dx = p.x - a.x, dy = p.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(dx) > 1) a.face = dx < 0 ? -1 : 1;
        if (dist <= step) { a.x = p.x; a.y = p.y; a.path.shift(); step -= dist; }
        else { a.x += dx / dist * step; a.y += dy / dist * step; step = 0; }
      }
      if (!a.path.length) {
        if (a.back) {
          a.state = 'seat'; a.zone = s.seat.zone; a.spot = null; a.back = false; a.face = 1; a.until = ts + 9000 + Math.random() * 12000;
          if (el && night) el.classList.add('sleeping');
        }
        else { a.state = 'visit'; a.zone = OFFICE_SPOTS[a.spot].zone; a.until = ts + (a.job ? a.job.steps[a.job.i].stay : 3500 + Math.random() * 3000); }
        changed = true;
        if (el) el.classList.remove('walking');
        const stNow = a.job && a.state === 'visit' ? a.job.steps[a.job.i] : null;
        if (stNow && stNow.waitFor) { a.waiting = true; a.until = ts + 14000; }   // 等同伴到了再開始聊
        else {
          if (d && a.state === 'visit' && !(stNow && (stNow.fx === 'talk' || stNow.fx === 'meet')) && (stNow || ts >= officeQuietUntil)) officeSay(s.id, officeActivity(s.id, d));
          if (stNow) officeJobFx(a.job);
        }
      }
      if (el) {
        el.classList.remove('sleeping');
        el.style.left = (a.x / 10).toFixed(2) + '%';
        el.style.top = (a.y / 13).toFixed(2) + '%';
        el.style.zIndex = Math.round(a.y);
        const fig = el.querySelector('.of-fig');
        if (fig) fig.style.transform = `scaleX(${a.face})`;
        if (el.classList.contains('saying')) officeSayFit(s.id);
      }
    } else if (ts >= a.until || (!a.job && ready)) {
      const queue = ready ? q : null;
      // 這一站辦完：還有下一站就繼續，否則結束這趟
      if (a.job && a.state === 'visit') {
        a.waiting = false;
        if (a.job.i + 1 < a.job.steps.length) a.job.i++;
        else {
          if (a.job.rec.type === 'settle') setTimeout(() => officeSay(s.id, '月底結算完成 ✓'), 0);
          if (a.job.rec.type === 'love') setTimeout(() => officeSay(s.id, '每月的愛已存進小豬 ✓'), 0);
          a.job = null;
        }
      }
      if (!a.job && queue && queue.length) {
        const rec = queue.shift(), steps = officeJobSteps(rec);
        if (steps.length) a.job = { rec, i: 0, steps };
        else if (ts < a.until) return;
      }
      if (a.job) {
        // 記帳跑腿優先，不受同時走動人數限制
        const st = a.job.steps[a.job.i];
        a.spot = st.spot;
        a.path = officePath(a, a.zone, OFFICE_SPOTS[st.spot], OFFICE_SPOTS[st.spot].zone);
        a.back = false;
        if (d) setTimeout(() => officeSay(s.id, st.go), 0);
      } else if (a.state === 'seat') {
        if (night) { a.until = ts + 8000; return; }   // 晚上在座位上睡覺，不走動
        if (!canStart) { a.until = ts + 1500; return; }
        if (settleOn && member) { a.until = ts + 2000; return; }
        // 有事要忙的員工比較常待在座位上
        const busy = d && ((s.id === 'book' && d.todayCount > 0) || (s.id === 'stock' && !d.alerts.length));
        if (busy && Math.random() < 0.45) { a.until = ts + 6000 + Math.random() * 6000; return; }
        // 有人在跑腿或互動時，其他人先不去記帳桌、存錢筒和茶水間，免得擠在一起
        const jobBusy = Object.values(officeActors).some(o => o.job) || Object.values(officeJobs).some(q => q.length);
        const picks = jobBusy ? s.visits.filter(v => v !== 'desk' && v !== 'piggy' && v !== 'tea') : s.visits;
        if (!picks.length) { a.until = ts + 4000; return; }
        a.spot = picks[Math.floor(Math.random() * picks.length)];
        // 早上大家愛去茶水間泡咖啡
        if (officePhase === 'morning' && picks.includes('tea') && Math.random() < 0.5) a.spot = 'tea';
        const spot = OFFICE_SPOTS[a.spot];
        a.path = officePath(a, a.zone, spot, spot.zone);
        a.back = false;
      } else {
        a.path = officePath(a, a.zone, s.seat, s.seat.zone);
        a.back = true;
      }
      a.state = 'walk';
      canStart = false;
      changed = true;
      if (el) el.classList.add('walking');
    }
  });

  // 坐在位子上的員工偶爾冒出對話框，說自己正在做什麼
  // 有人在跑腿或互動時先安靜，結束後再等 1.5 秒
  if (Object.values(officeActors).some(a => a.job)) officeQuietUntil = Math.max(officeQuietUntil, ts + 1500);
  if (d && ts >= officeSayAt && ts >= officeQuietUntil) {
    officeSayAt = ts + 4200;
    const seated = OFFICE_STAFF.filter(s => officeActors[s.id].state === 'seat');
    if (seated.length) { const s = seated[Math.floor(Math.random() * seated.length)]; officeSay(s.id, officeActivity(s.id, d)); }
  }
  // 沒有人在跑腿時，每隔一陣子安排一段角色互動
  if (d && ts >= officeSkitAt) {
    const busy = settleOn || officeMeeting || Object.values(officeActors).some(a => a.job) || Object.values(officeJobs).some(q => q.length);
    if (busy) officeSkitAt = ts + 3000;
    else { officeSkitAt = ts + 13000 + Math.random() * 9000; if (officeStartSkit(d, ts)) changed = true; }
  }
  if (changed) officeRefreshTexts();
  officeRaf = requestAnimationFrame(officeTick);
}

// 月會：等大家手上的事做完，所有人走到白板前；到齊（或等太久）就開始報告，報告完各自回座
function officeMeetingTick(ts, d) {
  const m = officeMeeting;
  if (!m || !d || !officePrev || officePrev.none) return;
  const ids = ['chart', 'book', 'stock', 'cash', 'elf', 'fox', 'dog'];
  if (m.pending) {
    const busy = Object.values(officeActors).some(a => a.job) || Object.values(officeJobs).some(q => q.length);
    if (busy || officePhase === 'night') return;
    m.pending = false; m.launchedAt = ts; m.ids = ids;
    ids.forEach(id => officeJobs[id].push({ type: 'meeting', steps: [{ spot: 'meet_' + id, fx: 'meet', stay: 600000, go: '去白板前開月會', at: '開月會中 📋' }] }));
    if (!m.force) { try { localStorage.setItem(OFFICE_MEET_PREFIX + officePrev.sheet, '1'); } catch (e) { /* ignore */ } }
    return;
  }
  if (m.started) {
    if (ts >= m.endAt) officeMeeting = null;
    return;
  }
  const inPlace = id => { const a = officeActors[id]; return a.state === 'visit' && a.job && a.job.rec.type === 'meeting'; };
  const here = m.ids.filter(inPlace);
  if (here.length === m.ids.length || (here.length >= 3 && ts - m.launchedAt > 35000)) {
    m.started = true;
    const lines = officeMeetingLines(d).filter(l => here.includes(l.who));
    officeJobFx({ i: 0, steps: [{ fx: 'talk', lines }], rec: { type: 'skit' } });
    const end = ts + lines.length * 2100 + 2600;
    m.endAt = end;
    // 沒到的人取消，到了的人聽完再走
    m.ids.forEach(id => {
      const a = officeActors[id];
      if (inPlace(id)) a.until = end;
      else if (a.job && a.job.rec.type === 'meeting') a.until = ts;
    });
  }
}

function officeStart() {
  officeLastTs = 0;
  if (!officeRaf && !officePaused && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    officeRaf = requestAnimationFrame(ts => {
      // 第一次啟動時，把每個人的計時起點對齊到現在
      Object.values(officeActors).forEach(a => { if (a.until < 1e6) a.until += ts; });
      officeSayAt = ts + 1500;
      officeSkitAt = ts + 5000;
      officeTick(ts);
    });
  }
}
function officeStop() {
  if (officeRaf) { cancelAnimationFrame(officeRaf); officeRaf = null; }
}
// 給 app.js 切換分頁時呼叫（沿用舊名稱）
function officeStopBubbles() { officeStop(); }

// 進入分頁時呼叫：記下這次比上次多幾筆、更新庫存、開始走動
function renderOffice() {
  const sheet = currentSheet();
  // 辦公室是進站的第一頁：資料載入後才記下筆數
  if (officeNewCount[sheet] === undefined && records.length) {
    const count = records.filter(r => !isSummaryRow(r) && r.item !== '帳戶餘額').length;
    let prev = null;
    try { const v = localStorage.getItem(OFFICE_SEEN_PREFIX + sheet); prev = v === null ? null : parseInt(v, 10); } catch (e) { /* ignore */ }
    officeNewCount[sheet] = prev !== null && Number.isFinite(prev) ? Math.max(0, count - prev) : 0;
    try { localStorage.setItem(OFFICE_SEEN_PREFIX + sheet, String(count)); } catch (e) { /* ignore */ }
  }
  drawOffice();
  officeStart();
  officeLoadPrev();
  officeMaybeMeeting(false);
  if (!officeInvRequested) {
    officeInvRequested = true;
    Promise.resolve(loadInventory()).then(() => { if (officeVisible()) drawOffice(); }).catch(() => {});
  }
}

document.addEventListener('click', e => {
  if (!officeVisible()) return;
  if (e.target.closest('#office-pause')) {
    officePaused = !officePaused;
    e.target.closest('#office-pause').textContent = officePaused ? '繼續' : '暫停';
    document.getElementById('office-scene').classList.toggle('paused', officePaused);
    if (officePaused) officeStop(); else officeStart();
    return;
  }
  const add = e.target.closest('[data-office-add]');
  if (add) {
    openModal();
    const owner = add.dataset.officeAdd, sel = document.getElementById('f-owner');
    if (owner && sel) sel.value = owner;
    return;
  }
  if (e.target.closest('[data-office-settle]')) {
    // 跳到明細最下面的「支出部分轉回」列
    const tabBtn = [...document.querySelectorAll('.tab')].find(t => (t.getAttribute('onclick') || '').includes("'records'"));
    if (tabBtn) switchTab('records', tabBtn);
    const rows = officeData_ ? officeData_.back.map(b => b.row).filter(Boolean) : [];
    setTimeout(() => {
      const el = rows.flatMap(r => ['transfer-result-' + r, 'transfer-result-m-' + r]).map(id => document.getElementById(id)).find(x => x && x.offsetParent !== null);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return;
  }
  if (e.target.closest('[data-office-meeting]')) {
    officeSelected = null;
    if (officeMaybeMeeting(true)) { drawOffice(); document.getElementById('office-scene').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    return;
  }
  const go = e.target.closest('[data-office-go]');
  if (go) {
    const name = go.dataset.officeGo;
    const tabBtn = [...document.querySelectorAll('.tab')].find(t => (t.getAttribute('onclick') || '').includes(`'${name}'`));
    if (tabBtn) switchTab(name, tabBtn);
    return;
  }
  const hit = e.target.closest('[data-office-id]');
  if (hit) {
    const id = hit.dataset.officeId;
    const inScene = !!hit.closest('#office-scene');   // 重畫前先記下來：重畫後原本的按鈕就不在畫面上了
    officeSelected = officeSelected === id ? null : id;
    drawOffice();
    if (inScene) officeReact(id);
    if (officeSelected && hit.classList.contains('of-card')) {
      const detail = document.getElementById('office-detail');
      if (detail) detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
});
