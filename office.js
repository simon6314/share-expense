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
const OFFICE_PETS_KEY = 'shareExpense.office.pets';       // 黑柴累積被摸的次數
const OFFICE_RANK_KEY = 'shareExpense.office.rank';       // 每個人上次看到的職位等級（升職時慶祝）
// 職位層級：by＝看哪個數字，ranks＝[職稱, 門檻]
const OFFICE_RANKS = {
  book:  { by: 'total',  unit: '筆', label: '累積記帳', ranks: [['實習記帳員', 0], ['記帳員', 300], ['資深記帳師', 1000], ['記帳主任', 2000], ['傳說帳神', 5000]] },
  chart: { by: 'months', unit: '個月', label: '有紀錄的月份', ranks: [['實習分析師', 0], ['分析師', 6], ['首席分析師', 12], ['數據長', 24], ['預言家', 36]] },
  stock: { by: 'items',  unit: '項', label: '庫存登記', ranks: [['倉管助理', 0], ['倉管', 10], ['倉庫主管', 20], ['物流總監', 40]] },
  cash:  { by: 'medals', unit: '枚', label: '省錢獎章', ranks: [['出納', 0], ['金庫主管', 3], ['財務長', 6], ['金庫守護神', 12]] },
  dog:   { by: 'pets',   unit: '次', label: '被摸', ranks: [['吉祥物', 0], ['人氣吉祥物', 50], ['皇冠吉祥物', 100], ['辦公室之王', 300], ['傳說柴神', 1000]] },
  elf:   { by: 'settled', unit: '個月', label: '完成月底結算', ranks: [['理財新手', 0], ['預算規劃師', 3], ['財務總監', 12], ['家庭 CFO', 24]] },
  fox:   { by: 'fun',    unit: '筆', label: '吃喝玩樂的紀錄', ranks: [['生活玩家', 0], ['美食探險家', 30], ['享樂大師', 100], ['人生體驗長', 300]] },
};
// 小狐狸的「吃喝玩樂」分類
const OFFICE_FUN_CATS = ['餐飲', '飲料', '住宿旅遊', '景點', '表演展覽', '相片'];

// 某人目前的職位：{ lv（0 起算）, max, title, value, next: [職稱, 門檻] | null }
function officeRankOf(id, info) {
  const r = OFFICE_RANKS[id];
  if (!r || !info) return null;
  const value = info.rankValues[r.by] || 0;
  let lv = 0;
  r.ranks.forEach(([, at], i) => { if (value >= at) lv = i; });
  return { lv, max: r.ranks.length - 1, title: r.ranks[lv][0], value, next: r.ranks[lv + 1] || null, unit: r.unit, label: r.label };
}
let officeDogPets = 0;
try { officeDogPets = parseInt(localStorage.getItem(OFFICE_PETS_KEY) || '0', 10) || 0; } catch (e) { officeDogPets = 0; }
let officeInfo_ = null;             // 最近一次算好的等級、獎盃、升職
// 摸黑柴：累積次數記在瀏覽器裡
function officePet() {
  officeDogPets++;
  try { localStorage.setItem(OFFICE_PETS_KEY, String(officeDogPets)); } catch (e) { /* ignore */ }
  const n = document.querySelector('[data-office-num="dog"]'); if (n) n.textContent = officeDogPets + ' 次';
  if ([50, 100, 300, 1000].includes(officeDogPets) && officeVisible()) setTimeout(() => drawOffice(), 300);   // 升職：換裝
}
let officeSkitAt = 0;               // 下一次安排角色互動的時間
let officeSkitLast = '';            // 上一次的互動，避免連續重複
let officeSkitSeq = 0;
let officeAmbientAt = 0;            // 精靈和小狐狸坐在一起時，偶爾冒出小愛心
let officeQuietUntil = 0;           // 互動或跑腿結束後 1.5 秒內，其他人不冒出平常的對話框
let officePhase = 'day';            // 依實際時間：morning / day / evening / night
let officePhaseCheckAt = 0;
let officePrev = null;              // 上個月的摘要（月會、花太快警報用），只在看本月時載入
let officePrevLoading = false;
let officeMeeting = null;           // 月會：{ pending } → { ids, started, launchedAt }
const OFFICE_MEET_PREFIX = 'shareExpense.office.meeting:';   // 每個月的月會開過了沒
const OFFICE_EVENT_PREFIX = 'shareExpense.office.event:';    // 每天只演一次的事件（入帳、過期）
const OFFICE_BIG = 5000;            // 單筆支出超過這個金額，大家會圍過來看
// 辦公室升級：累積記帳筆數解鎖家具
const OFFICE_LEVELS = [
  { at: 50, name: '書櫃' }, { at: 150, name: '地毯' }, { at: 300, name: '魚缸' }, { at: 500, name: '招財貓' },
  { at: 800, name: '大電視' }, { at: 1200, name: '走廊花園' }, { at: 2000, name: '星星燈' },
]
const OFFICE_STATS_KEY = 'shareExpense.office.stats';     // 各月份的筆數與記帳日期（下次打開先用）
const OFFICE_LEVEL_KEY = 'shareExpense.office.level';     // 上次看到的等級（升級時慶祝）
let officeStats = null;             // { sheets: { 'YYYY/M月': { count, days: ['YYYY-MM-DD'] } } }
let officeStatsLoading = false;
try { officeStats = JSON.parse(localStorage.getItem(OFFICE_STATS_KEY) || 'null'); } catch (e) { officeStats = null; }
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

// 一個月份的筆數與記帳日期
function officeSheetStats(sheet, recs) {
  const m = String(sheet).match(/(\d{4})\/(\d{1,2})月/);
  const year = m ? m[1] : String(new Date().getFullYear());
  const real = (recs || []).filter(r => !isSummaryRow(r) && r.item !== '帳戶餘額' && r.owner !== '');
  const days = [...new Set(real.map(r => toMMDD(r.date)).filter(Boolean).map(k => `${year}-${k.replace('/', '-')}`))];
  const expense = real.filter(r => r.expense > 0 && !(r.note && r.note.includes('先付'))).reduce((t, r) => t + r.expense, 0);
  const settled = (recs || []).some(r => /支出部分轉回/.test(r.item) && r.expense > 0);
  const fun = real.filter(r => r.owner === '小狐狸' && r.expense > 0 && OFFICE_FUN_CATS.includes(categorize(r.item))).length;
  return { count: real.length, days, expense, settled, fun, y: m ? +m[1] : 0, m: m ? +(String(sheet).match(/\/(\d{1,2})月/) || [0, 0])[1] : 0 };
}

// 讀所有月份（有快取就用快取），算累積筆數；只在背景做，不擋畫面
async function officeLoadStats() {
  if (officeStatsLoading) return;
  officeStatsLoading = true;
  try {
    const list = await apiCall({ action: 'getSheets' });
    const vers = await getVersions();
    const names = (list.sheets || []).filter(n => /\d{4}\/\d{1,2}月/.test(n));
    const out = {};
    for (const n of names) {
      try { out[n] = officeSheetStats(n, await fetchMonth(n, vers, false)); } catch (e) { if (officeStats && officeStats.sheets[n]) out[n] = officeStats.sheets[n]; }
    }
    officeStats = { sheets: out };
    try { localStorage.setItem(OFFICE_STATS_KEY, JSON.stringify(officeStats)); } catch (e) { /* ignore */ }
    if (officeVisible()) drawOffice();
  } catch (e) { /* 離線時沿用上次的統計 */ }
  officeStatsLoading = false;
}

// 等級、累積筆數、連續記帳天數（目前月份用畫面上最新的資料）
function officeLevelInfo() {
  if (!officeStats) return null;
  const cur = currentSheet();
  const sheets = { ...officeStats.sheets, [cur]: officeSheetStats(cur, records) };
  const total = Object.values(sheets).reduce((t, v) => t + v.count, 0);
  const days = new Set(Object.values(sheets).flatMap(v => v.days));
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = new Date(); day.setHours(12, 0, 0, 0);
  if (!days.has(key(day))) day.setDate(day.getDate() - 1);   // 今天還沒記，從昨天算起
  let streak = 0;
  while (days.has(key(day)) && streak < 2000) { streak++; day.setDate(day.getDate() - 1); }
  const level = OFFICE_LEVELS.filter(l => total >= l.at).length;

  // 使用了幾個月（有紀錄的月份數）：盆栽跟著長大
  const months = Object.values(sheets).filter(v => v.count > 0).length;
  const plant = months >= 24 ? 5 : (months >= 12 ? 4 : (months >= 6 ? 3 : (months >= 3 ? 2 : 1)));

  // 省錢獎章：已經過完的月份，支出比前一個月少一成以上
  const now = new Date(), curIdx = now.getFullYear() * 12 + now.getMonth() + 1;
  const byIdx = {};
  Object.values(sheets).forEach(v => { if (v.y && v.m && v.expense !== undefined) byIdx[v.y * 12 + v.m] = v.expense; });
  const medals = Object.keys(byIdx).map(Number).filter(i => i < curIdx && byIdx[i - 1] > 0 && byIdx[i] <= byIdx[i - 1] * 0.9).sort((a, b) => a - b)
    .map(i => `${Math.floor((i - 1) / 12)}/${((i - 1) % 12) + 1}`);

  // 辦公室週年：第一筆紀錄的那一天，之後每年同一天
  const sortedDays = [...days].sort();
  const first = sortedDays[0] || null;
  const todayKey = key(new Date());
  let party = 0;
  if (first) {
    const years = now.getFullYear() - parseInt(first.slice(0, 4), 10);
    if (years >= 1 && first.slice(5) === todayKey.slice(5)) party = years;
  }
  const yearAgo = curIdx - 12;
  const yearCount = Object.values(sheets).filter(v => v.y && v.y * 12 + v.m > yearAgo).reduce((t, v) => t + v.count, 0);

  // 職位用的數字
  const items = Array.isArray(inventory) ? inventory.length : 0;
  const rankValues = {
    total, months, items, medals: medals.length, pets: officeDogPets,
    settled: Object.values(sheets).filter(v => v.settled).length,
    fun: Object.values(sheets).reduce((t, v) => t + (v.fun || 0), 0),
  };

  return { total, streak, level, next: OFFICE_LEVELS[level] || null, unlocked: OFFICE_LEVELS.slice(0, level).map(l => l.name),
    months, plant, medals, first, party, yearCount, rankValues };
}

// 成就一覽（點等級列打開）
function officeAchievementsHtml(info) {
  if (!info) return '';
  const row = (label, value, cls = '') => `<div class="of-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
  const levels = OFFICE_LEVELS.map(l => row(`${info.total >= l.at ? '✅' : '🔒'} ${l.name}`, `${l.at} 筆`, info.total >= l.at ? 'of-inc' : '')).join('');
  const cups = [[7, '🥈 銀獎盃'], [30, '🥇 金獎盃'], [100, '🏆 白金獎盃'], [365, '💎 鑽石獎盃']]
    .map(([n, name]) => row(`${info.streak >= n ? '✅' : '🔒'} ${name}`, `連續 ${n} 天`, info.streak >= n ? 'of-inc' : '')).join('');
  const plantName = ['', '小芽', '長葉子', '茂盛', '開花', '結果'][info.plant];
  const plantNext = info.plant >= 5 ? '已經結果了 🍊' : `第 ${[0, 3, 6, 12, 24][info.plant]} 個月長成「${['', '長葉子', '茂盛', '開花', '結果'][info.plant]}」`;
  const nameOf = { book: '小帳', chart: '小析', stock: '阿貨', cash: '阿庫', elf: '精靈', fox: '小狐狸', dog: '黑柴' };
  const promos = Object.keys(OFFICE_RANKS).map(id => {
    const k = officeRankOf(id, info);
    const stars = '★'.repeat(k.lv) + '☆'.repeat(k.max - k.lv);
    const next = k.next ? `下一級「${k.next[0]}」還差 ${k.next[1] - k.value} ${k.unit}` : '已經到頂了 👑';
    return `<div class="of-row"><span>${nameOf[id]}・<b>${k.title}</b> <small class="of-stars">${stars}</small></span><b class="${k.next ? '' : 'of-inc'}">${next}</b></div>`;
  }).join('');
  return `<h4>🏆 辦公室成就 <small>Lv.${info.level + 1}</small></h4>
    <div class="of-sub">家具（累積 ${info.total} 筆）</div>${levels}
    <div class="of-sub">連續記帳獎盃（目前 ${info.streak} 天）</div>${cups}
    <div class="of-sub">省錢獎章</div>${row('已獲得', info.medals.length ? `${info.medals.length} 枚（最近：${info.medals.slice(-3).reverse().join('、')}）` : '還沒有')}
    <p class="of-note">支出比前一個月少一成以上，就得一枚。</p>
    <div class="of-sub">盆栽</div>${row(`🌱 第 ${info.months} 個月`, plantName)}<p class="of-note">${plantNext}</p>
    <div class="of-sub">員工升職</div>${promos}
    ${info.first ? `<p class="of-note">辦公室成立於 ${info.first.replace(/-/g, '/')}，每年這天會辦週年派對。</p>` : ''}`;
}

// 週年派對：大家戴派對帽，小析報告這一年（每台裝置每年一次）
function officeCheckParty(info) {
  if (!info || !info.party || !officeOnce('party')) return;
  // 派對進行中先不安排別的互動
  officeSkitAt = Math.max(officeSkitAt, performance.now() + 18000);
  setTimeout(() => {
    officeBurst(500, 640, ['🎉', '🎂', '🎊', '✨'], 18);
    officeJobFx({ i: 0, steps: [{ fx: 'talk', lines: [
      { who: 'chart', text: `辦公室 ${info.party} 週年快樂！🎂` },
      { who: 'chart', text: `這一年大家一共記了 ${info.yearCount} 筆` },
      { who: 'elf', text: '謝謝大家 💕', burst: true },
      { who: 'fox', text: '明年也要一起加油！' },
      { who: 'dog', text: '汪汪！🎉' }] }], rec: { type: 'skit' } });
  }, 1800);
}

// 獎盃：連續記帳 7 / 30 / 100 / 365 天
function officeCup(streak) {
  if (streak >= 365) return { icon: '💎', name: '鑽石獎盃', fill: '#cfeefe', stroke: '#6fb7d9', n: 365 };
  if (streak >= 100) return { icon: '🏆', name: '白金獎盃', fill: '#eef2f7', stroke: '#8a9bb0', n: 100 };
  if (streak >= 30) return { icon: '🥇', name: '金獎盃', fill: '#ffd66b', stroke: '#d99a1e', n: 30 };
  if (streak >= 7) return { icon: '🥈', name: '銀獎盃', fill: '#d6dde4', stroke: '#9fb0bf', n: 7 };
  return null;
}

// 升職時慶祝（每升一級一次；每台裝置各自記）
function officeCheckPromo(info) {
  if (!info) return;
  let seen = null;
  try { seen = JSON.parse(localStorage.getItem(OFFICE_RANK_KEY) || 'null'); } catch (e) { return; }
  const now = {};
  Object.keys(OFFICE_RANKS).forEach(id => { now[id] = officeRankOf(id, info).lv; });
  try { localStorage.setItem(OFFICE_RANK_KEY, JSON.stringify(now)); } catch (e) { return; }
  if (!seen) return;   // 第一次打開：直接顯示，不慶祝
  const up = Object.keys(now).filter(id => now[id] > (seen[id] || 0));
  if (!up.length) return;
  // 同時升職的人輪流慶祝（最多三位，每位隔 3.5 秒）
  up.slice(0, 3).forEach((id, i) => {
    const title = officeRankOf(id, info).title;
    const line = {
      book: `升職了！我是${title}了…手在發抖 ✍️😭`,
      chart: `${title}！數據證明我很優秀 📈🥹`,
      stock: `我…我當上${title}了？不會出錯吧 😱✨`,
      cash: `${title}…我終於可以管更多錢了 😭💰`,
      elf: `${title}，照計畫達成 📋✨`,
      fox: `耶～我是${title}！去吃好料慶祝 🎉🍜`,
      dog: `汪汪汪！（升上${title}，瘋狂轉圈）🌀👑`,
    }[id];
    setTimeout(() => {
      const a = officeActors[id];
      if (a) officeBurst(a.x, a.y - 120, ['🎉', '⭐', '✨'], 12);
      officeSay(id, line);
    }, 2600 + i * 3500);
  });
}

// 升級時：撒彩帶、大家喊一聲（每台裝置各一次）
function officeCheckLevelUp(info) {
  if (!info) return;
  let prev = null;
  try { const v = localStorage.getItem(OFFICE_LEVEL_KEY); prev = v === null ? null : parseInt(v, 10); localStorage.setItem(OFFICE_LEVEL_KEY, String(info.level)); } catch (e) { return; }
  if (prev === null || info.level <= prev) return;
  const name = OFFICE_LEVELS[info.level - 1].name;
  setTimeout(() => {
    officeBurst(500, 640, ['🎉', '🎊', '✨', '⭐'], 18);
    officeSay('book', `辦公室升級了！多了${name} 🎉`);
    setTimeout(() => officeSay('fox', '哇～好棒！'), 1600);
  }, 1200);
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
  const lines = [{ who: 'chart', text: `${p.month}月的月會開始囉！我等這天等好久了 📋✨` }];
  let total = `上個月總支出 ${fmt(p.total)}`;
  let up = false;
  if (p.prevTotal) {
    const pct = Math.round((p.total - p.prevTotal) / p.prevTotal * 100);
    up = pct > 0;
    total += pct === 0 ? `，跟${p.prevMonth}月差不多，好穩 😌` : (pct > 0 ? `，比${p.prevMonth}月多 ${pct}%…往上衝了 😱` : `，比${p.prevMonth}月少 ${-pct}%！我好感動 🥹`);
  }
  lines.push({ who: 'chart', text: total });
  lines.push({ who: 'chart', text: p.top ? `花最多的是${p.top.name}，${fmt(p.top.value)}！` : '上個月沒有支出…我的圖表好寂寞 😢' });
  lines.push({ who: 'book', text: `上個月 ${p.count} 筆，每一筆都對齊了 ✍️😤` });
  lines.push({ who: 'cash', text: `精靈 ${fmt(p.owners['精靈'])}，小狐狸 ${fmt(p.owners['小狐狸'])}……錢錢們辛苦了 🥲` });
  lines.push({ who: 'stock', text: d.alerts.length ? `倉庫有 ${d.alerts.length} 項要注意！散會後我馬上去 🏃💨` : '倉庫一切正常！安心感 MAX ✨' });
  lines.push({ who: 'elf', text: up ? '我準備了三個省錢方案，會後發給大家 📋' : '照計畫走，表現很好 👍 下個月的預算我也排好了 📋' });
  lines.push({ who: 'fox', text: up ? '沒關係啦～一起加油！散會去吃好料 🍜' : '好棒好棒！散會～去慶祝吧 🎉', burst: true });
  lines.push({ who: 'dog', text: '汪！（以為要吃飯）' });
  return lines;
}

// 角色個性（點角色時顯示）
const OFFICE_PERSONA = {
  book: '認真到有點神經質，帳一定要一筆一筆對齊才舒服',
  chart: '數據狂，看到漂亮的曲線就會感動到想哭',
  stock: '愛操心，庫存一少就開始慌',
  cash: '守財奴，花錢比自己被打還痛，最愛每月的愛',
  piggy: '戲精，金幣多就得意，少了就裝可憐',
  elf: '很會規劃、管理財務，有點小固執；凡事理性分析，最好多準備幾個方案',
  fox: '鬼靈精怪、愛到處跑、懂得享受生活；情緒都寫在臉上，最會安慰精靈',
  dog: '貪吃又黏人，最愛跟著精靈和小狐狸跑來跑去',
};

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

  const biggest = realRecs.filter(r => r.expense >= OFFICE_BIG && !isPrepaid(r) && r.owner !== '').sort((a, b) => b.expense - a.expense)[0] || null;

  return { starting, income, arrived, expense, balance, pool, ratio, mood, entries, sorted, todayCount, love, settled, back, cats, items, alerts, biggest };
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
          <g class="of-eye"><circle cx="30.5" cy="34" r="3.4" fill="#141418"/><circle cx="31.7" cy="32.8" r="1.2" fill="#fff"/><circle cx="49.5" cy="34" r="3.4" fill="#141418"/><circle cx="50.7" cy="32.8" r="1.2" fill="#fff"/></g>
          <g class="of-eye-closed"><path d="M26.7 34 Q30.5 37.2 34.3 34" fill="none" stroke="#141418" stroke-width="2.2" stroke-linecap="round"/><path d="M45.7 34 Q49.5 37.2 53.3 34" fill="none" stroke="#141418" stroke-width="2.2" stroke-linecap="round"/></g>
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
          <g class="of-eye"><circle cx="30.5" cy="34.5" r="3.2" fill="#3b2f2f"/><circle cx="31.6" cy="33.4" r="1.1" fill="#fff"/><circle cx="49.5" cy="34.5" r="3.2" fill="#3b2f2f"/><circle cx="50.6" cy="33.4" r="1.1" fill="#fff"/></g>
          <g class="of-eye-closed"><path d="M26.9 34.5 Q30.5 37.7 34.1 34.5" fill="none" stroke="#3b2f2f" stroke-width="1.8" stroke-linecap="round"/><path d="M45.9 34.5 Q49.5 37.7 53.1 34.5" fill="none" stroke="#3b2f2f" stroke-width="1.8" stroke-linecap="round"/></g>
          <ellipse cx="40" cy="43.5" rx="3" ry="2.2" fill="#3b2f2f"/>
          <path d="M36 47.5 Q40 51 44 47.5" fill="none" stroke="#3b2f2f" stroke-width="1.4" stroke-linecap="round"/>
          <ellipse cx="23.5" cy="42" rx="4" ry="2.4" fill="#ff9fb0" opacity="0.6"/>
          <ellipse cx="56.5" cy="42" rx="4" ry="2.4" fill="#ff9fb0" opacity="0.6"/>
        </g>
      </g>`;
  }
  // 精靈：可愛的小馬（奶油色身體、頭頂黑色瀏海、咖啡色尾巴、額頭白斑、大鼻子）
  return `
    <g class="of-char of-elf">
      <path class="of-tail" d="M57 66 Q80 62 77 84 Q70 76 66 80 Q66 72 57 72 Z" fill="#9a6440"/>
      <ellipse cx="40" cy="70" rx="19" ry="15.5" fill="#f6dcb9"/>
      <ellipse cx="40" cy="74" rx="10" ry="10.5" fill="#fff3e0"/>
      <rect x="27" y="79" width="10" height="8" rx="3.5" fill="#f6dcb9"/><rect x="43" y="79" width="10" height="8" rx="3.5" fill="#f6dcb9"/>
      <rect x="27" y="83.5" width="10" height="4" rx="2" fill="#8d6a55"/><rect x="43" y="83.5" width="10" height="4" rx="2" fill="#8d6a55"/>
      <g class="of-head">
        <path d="M22 20 L19 1 L34 12 Z" fill="#f6dcb9"/>
        <path d="M58 20 L61 1 L46 12 Z" fill="#f6dcb9"/>
        <path d="M23.5 15 L22 6.5 L29 11.5 Z" fill="#ffc9d6"/>
        <path d="M56.5 15 L58 6.5 L51 11.5 Z" fill="#ffc9d6"/>
        <ellipse cx="40" cy="31" rx="20" ry="18" fill="#f6dcb9"/>
        <path d="M36.5 15 Q40 13 43.5 15 L45 36 Q40 38 35 36 Z" fill="#fffaf2"/>
        <ellipse cx="40" cy="47" rx="16.5" ry="11.5" fill="#fff1e2"/>
        <path d="M27 14 Q38 2 51 9 Q44 10 41 17 Q36 12 33 22 Q29 18 27 14 Z" fill="#2e2a30"/>
        <path d="M33 10 Q40 5 47 9 Q41 9 38 13 Z" fill="#5a5360"/>
        <g class="of-eye"><circle cx="28" cy="32" r="3.5" fill="#2f3b45"/><circle cx="29.2" cy="30.8" r="1.2" fill="#fff"/><circle cx="52" cy="32" r="3.5" fill="#2f3b45"/><circle cx="53.2" cy="30.8" r="1.2" fill="#fff"/></g>
        <g class="of-eye-closed"><path d="M24.2 32 Q28 35.2 31.8 32" fill="none" stroke="#2f3b45" stroke-width="1.9" stroke-linecap="round"/><path d="M48.2 32 Q52 35.2 55.8 32" fill="none" stroke="#2f3b45" stroke-width="1.9" stroke-linecap="round"/></g>
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
        <g class="of-eye"><circle cx="31" cy="39" r="3" fill="#3b2f2f"/><circle cx="32" cy="38" r="1" fill="#fff"/><circle cx="49" cy="39" r="3" fill="#3b2f2f"/><circle cx="50" cy="38" r="1" fill="#fff"/></g>
        <g class="of-eye-closed"><path d="M27.6 39 Q31 42.2 34.4 39" fill="none" stroke="#3b2f2f" stroke-width="1.7" stroke-linecap="round"/><path d="M45.6 39 Q49 42.2 52.4 39" fill="none" stroke="#3b2f2f" stroke-width="1.7" stroke-linecap="round"/></g>
        <path d="M36 48 Q40 51.5 44 48" fill="none" stroke="#b9728a" stroke-width="1.5" stroke-linecap="round"/>
        <ellipse cx="24.5" cy="45" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
        <ellipse cx="55.5" cy="45" rx="3.8" ry="2.3" fill="#ff9fb0" opacity="0.6"/>
        ${extra}
      </g>
    </g>`;
}
// 職位的外觀：徽章 銅 → 銀 → 金星 → 發光金星；黑柴是皇冠和披風；最高級有特別造型
function officeRankOutfit(id, k) {
  let g = '';
  if (id === 'dog') {
    if (k.lv >= 3) g += '<path d="M23 60 Q16 76 25 86 L31 64 Z M57 60 Q64 76 55 86 L49 64 Z" fill="#c2405b"/>';   // 披風
    if (k.lv >= 4) g += '<path d="M27 13 L30 1 L35 8 L40 0 L45 8 L50 1 L53 13 Z" fill="#ffd66b" stroke="#d99a1e" stroke-width="1.4"/><circle cx="40" cy="6" r="2" fill="#ef5f7a"/><circle cx="32" cy="9" r="1.4" fill="#7fb6f0"/><circle cx="48" cy="9" r="1.4" fill="#8fd3b0"/>';
    else if (k.lv >= 2) g += '<path d="M32 12 L34 4 L37 9 L40 3 L43 9 L46 4 L48 12 Z" fill="#ffd66b" stroke="#d99a1e" stroke-width="1.2"/>';
    else g += '<circle cx="40" cy="72" r="3.6" fill="#d9925b" stroke="#b46b38" stroke-width="1"/>';   // 人氣吉祥物：銅鈴
    return g;
  }
  // 胸前徽章
  const tier = [null, ['#e0a271', '#b46b38'], ['#e3e9ef', '#9fb0bf'], ['#ffd66b', '#d99a1e'], ['#ffd66b', '#d99a1e']][Math.min(k.lv, 4)];
  g += `<path class="${k.lv >= 4 || (k.lv === k.max && k.max === 3) ? 'of-badge-glow' : ''}" d="M49 64 l2.2 4.4 4.8 0.7 -3.5 3.4 0.8 4.8 -4.3 -2.3 -4.3 2.3 0.8 -4.8 -3.5 -3.4 4.8 -0.7 Z" fill="${tier[0]}" stroke="${tier[1]}" stroke-width="1"/>`;
  if (k.lv !== k.max) return g;
  // 最高級的特別造型
  if (id === 'book') g += '<circle cx="31" cy="39" r="6.4" fill="none" stroke="#e0a82e" stroke-width="1.8"/><circle cx="49" cy="39" r="6.4" fill="none" stroke="#e0a82e" stroke-width="1.8"/><path d="M37.4 39 h5.2" stroke="#e0a82e" stroke-width="1.8"/>';
  // 預言家：手捧會發光的水晶球
  if (id === 'chart') g += '<g transform="translate(64 70)"><ellipse cx="0" cy="9" rx="8" ry="3" fill="#8a6ab8"/><circle class="of-orb" cx="0" cy="0" r="8.5" fill="#c9b6f2" stroke="#8a6ab8" stroke-width="1.4"/><circle cx="-2.8" cy="-3" r="2.4" fill="#fff" opacity="0.8"/><path d="M2 2 l1 -2.4 1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 Z" fill="#fff6c9"/></g>';
  if (id === 'stock') g += '<path d="M17 27 Q18 9 40 9 Q62 9 63 27 Z" fill="#ffd66b"/><path d="M40 24 Q62 22 72 30 Q58 31 40 30 Z" fill="#e0a82e"/><path d="M36 14 l4 -3 4 3" stroke="#fff" stroke-width="1.6" fill="none"/>';
  if (id === 'cash') g += '<g transform="translate(64 74)"><path d="M-9 0 Q-11 -7 -4 -6 Q0 -10 4 -6 Q11 -7 9 0 Q0 4 -9 0 Z" fill="#ffd66b" stroke="#d99a1e" stroke-width="1.2"/><ellipse cx="0" cy="-6" rx="3.4" ry="2.4" fill="#ffe08a"/></g>';
  if (id === 'elf') g += '<path d="M33 56 L40 59 L33 62 Z M47 56 L40 59 L47 62 Z" fill="#ffd66b" stroke="#d99a1e" stroke-width="1"/><circle cx="40" cy="59" r="1.8" fill="#d99a1e"/>';   // 金色領結
  if (id === 'fox') g += '<ellipse cx="31" cy="22" rx="6" ry="4" fill="#2f2f38"/><ellipse cx="49" cy="22" rx="6" ry="4" fill="#2f2f38"/><path d="M37 21 h6" stroke="#2f2f38" stroke-width="1.6"/><path d="M28 21 l3 -1.6" stroke="#fff" stroke-width="1" opacity="0.6"/>';   // 推到頭上的墨鏡
  return g;
}

// 換季服裝：冬天（12–2 月）圍巾、黑柴穿背心；夏天（6–8 月）手拿小扇子
function officeOutfit(id) {
  let add = '';
  const info = officeInfo_;
  const k = officeRankOf(id, info);
  if (k && k.lv > 0) add += officeRankOutfit(id, k);
  if (info && info.party) {
    const c = { book: '#f7a8c0', chart: '#9fd0f0', stock: '#ffd66b', cash: '#8fd3b0', elf: '#c9a0e6', fox: '#ef7d7d', dog: '#9fd0f0' }[id] || '#f7a8c0';
    add += `<path d="M33 17 L40 1 L47 17 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/><circle cx="40" cy="2" r="2.6" fill="#ffd66b"/>`;
  }
  return officeSeasonOutfit(id) + add;
}
function officeSeasonOutfit(id) {
  const m = new Date().getMonth() + 1;
  const winter = m === 12 || m <= 2, summer = m >= 6 && m <= 8;
  if (winter) {
    if (id === 'dog') return '<path d="M23 66 Q40 59 57 66 L58 79 Q40 86 22 79 Z" fill="#7fb6f0"/><path d="M26 72 Q40 67 54 72" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="3 3"/>';
    const c = { book: '#ef7d7d', chart: '#f2b85c', stock: '#7fb6f0', cash: '#8fd3b0', elf: '#ef5f7a', fox: '#7fb6f0' }[id] || '#ef7d7d';
    const y = id === 'elf' ? 55 : (id === 'fox' ? 54 : 56);
    return `<path d="M23 ${y} Q40 ${y + 8} 57 ${y} L57 ${y + 7} Q40 ${y + 15} 23 ${y + 7} Z" fill="${c}"/>
      <rect x="44" y="${y + 8}" width="8" height="15" rx="3" fill="${c}"/><path d="M45 ${y + 21} h6" stroke="#fff" stroke-width="1.6"/>`;
  }
  if (summer && id !== 'dog') return `<g class="of-fan"><path d="M60 70 L70 54 Q78 58 74 68 Z" fill="#9fd8cb" stroke="#fff" stroke-width="1.4"/><path d="M60 70 L66 79" stroke="#c9a27c" stroke-width="2.4" stroke-linecap="round"/></g>`;
  return '';
}
function officeActorSvg(id) {
  const inner = (id === 'elf' || id === 'fox' || id === 'dog') ? officeCharSvg(id) : officeStaffSvg(id);
  return `<svg viewBox="0 0 80 90" aria-hidden="true"><ellipse cx="40" cy="86" rx="20" ry="4" fill="rgba(90,70,50,0.18)"/>${inner}${officeOutfit(id)}</svg>`;
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


// 辦公室升級：書櫃、地毯、魚缸、招財貓；連續記帳 7 天銀獎盃、30 天金獎盃
function officeUpgradeSvg() {
  const info = officeLevelInfo();
  if (!info) return '';
  const has = n => info.unlocked.includes(n);
  let g = '';
  if (has('書櫃')) {
    const cols = ['#ef7d7d', '#7fb6f0', '#ffd66b', '#8fd3b0', '#c9a0e6', '#f4a261', '#9aa8b6'];
    const shelfY = [262, 318, 374, 430];   // 每一層的頂端（每層高 52）
    // 一排書：寬度、高度輪流變化；k 決定起始顏色
    const books = (y, k, n, x0 = 32) => {
      let x = x0, out = '';
      for (let i = 0; i < n; i++) {
        const w = [7, 9, 6, 8, 10][(i + k) % 5], h = [40, 46, 36, 44, 42][(i + k * 2) % 5];
        out += `<rect x="${x}" y="${y + 50 - h}" width="${w}" height="${h}" rx="1.5" fill="${cols[(i + k) % cols.length]}"/><path d="M${x + 1.5} ${y + 54 - h} h${w - 3}" stroke="#ffffff" stroke-width="1.4" opacity="0.6"/>`;
        x += w + 1;
      }
      return out;
    };
    g += `<g>
      <rect x="22" y="252" width="64" height="236" rx="5" fill="#a9754f"/>
      <rect x="27" y="257" width="54" height="226" rx="3" fill="#6f4a30"/>
      ${shelfY.map(y => `<rect x="24" y="${y + 50}" width="60" height="6" rx="2" fill="#c99a6a"/>`).join('')}
      ${books(shelfY[0], 0, 6)}
      ${books(shelfY[1], 2, 3)}<path d="M64 ${shelfY[1] + 50} l12 -40 l7 2 l-12 40 Z" fill="#7fb6f0"/>
      ${[0, 1, 2].map(i => `<rect x="${32 + i * 15}" y="${shelfY[2] + 8}" width="13" height="42" rx="2" fill="${['#5f9ee6', '#ef7d7d', '#49b07f'][i]}"/><rect x="${34 + i * 15}" y="${shelfY[2] + 16}" width="9" height="12" rx="1.5" fill="#ffffff"/><text x="${38.5 + i * 15}" y="${shelfY[2] + 25}" font-size="7" font-weight="700" text-anchor="middle" fill="#4a3b30">${['帳', '本', '冊'][i]}</text>`).join('')}
      <path d="M72 ${shelfY[2] + 50} q-6 -14 0 -24 q6 10 0 24 Z" fill="#8fd3b0"/><rect x="66" y="${shelfY[2] + 40}" width="12" height="10" rx="2" fill="#f4b99a"/>
      ${books(shelfY[3], 4, 3)}
      <rect x="58" y="${shelfY[3] + 18}" width="20" height="32" rx="2" fill="#ffffff" stroke="#d9b48a" stroke-width="2"/><path d="M62 ${shelfY[3] + 40} l4 -6 4 4 3 -3 3 5 Z" fill="#8fd3b0"/><circle cx="72" cy="${shelfY[3] + 27}" r="2.4" fill="#ffd66b"/>
    </g>`;
  }
  if (has('魚缸')) g += `<g><rect x="372" y="1000" width="84" height="58" rx="10" fill="#bfe3f0" stroke="#8ec5dc" stroke-width="4"/>
      <path d="M376 1046 h76 v8 h-76 Z" fill="#e8d7b5"/><path d="M390 1046 q-4 -14 2 -24 M400 1046 q4 -12 -2 -20" stroke="#8fd3b0" stroke-width="3" fill="none"/>
      <g class="of-fish"><path d="M420 1020 q10 -8 18 0 q-8 8 -18 0 Z M438 1020 l7 -5 v10 Z" fill="#f4a261"/></g>
      <circle cx="412" cy="1010" r="2.5" fill="#fff" opacity="0.8"/><circle cx="416" cy="1003" r="1.8" fill="#fff" opacity="0.8"/></g>`;
  if (has('招財貓')) g += `<g transform="translate(300 1086)" class="of-lucky">
      <ellipse cx="0" cy="22" rx="20" ry="16" fill="#fffaf2" stroke="#e8d7c0" stroke-width="2"/>
      <circle cx="0" cy="0" r="17" fill="#fffaf2" stroke="#e8d7c0" stroke-width="2"/>
      <path d="M-14 -8 L-12 -22 L-3 -14 Z M14 -8 L12 -22 L3 -14 Z" fill="#fffaf2" stroke="#e8d7c0" stroke-width="2"/>
      <path d="M-7 -1 q2 -2 4 0 M3 -1 q2 -2 4 0" stroke="#3b2f2f" stroke-width="1.6" fill="none"/>
      <path d="M-14 12 Q0 18 14 12" stroke="#ef5f7a" stroke-width="3" fill="none"/><circle cx="0" cy="16" r="3" fill="#ffd66b"/>
      <g class="of-paw"><ellipse cx="18" cy="-6" rx="5" ry="8" fill="#fffaf2" stroke="#e8d7c0" stroke-width="2"/></g>
      <rect x="-9" y="26" width="18" height="11" rx="2" fill="#ffd66b"/><text x="0" y="35" font-size="8" font-weight="700" text-anchor="middle" fill="#b9831c">千萬</text></g>`;
  const cup = officeCup(info.streak);
  if (cup) {
    g += `<g transform="translate(76 40)"><path d="M-14 0 h28 v6 q0 16 -14 18 q-14 -2 -14 -18 Z" fill="${cup.fill}" stroke="${cup.stroke}" stroke-width="2"/>
      <path d="M-14 4 q-9 0 -8 8 q1 6 9 6 M14 4 q9 0 8 8 q-1 6 -9 6" fill="none" stroke="${cup.stroke}" stroke-width="2"/>
      <rect x="-3" y="24" width="6" height="7" fill="${cup.stroke}"/><rect x="-10" y="31" width="20" height="6" rx="2" fill="#a9754f"/>
      <text x="0" y="14" font-size="${cup.n >= 100 ? 8 : 10}" font-weight="700" text-anchor="middle" fill="#4a3b30">${cup.n}</text></g>`;
  }
  // 省錢獎章：牆上一排，最多畫 8 枚
  if (info.medals.length) {
    g += info.medals.slice(-8).map((m, i) => `<g transform="translate(${116 + i * 22} 46)"><path d="M-5 -14 L0 -4 L5 -14" stroke="#ef7d7d" stroke-width="4" fill="none"/>
      <circle cx="0" cy="2" r="8" fill="#ffd66b" stroke="#d99a1e" stroke-width="1.6"/><path d="M-3 2 h6" stroke="#b9831c" stroke-width="1.6"/></g>`).join('');
    if (info.medals.length > 8) g += `<text x="${116 + 8 * 22}" y="52" font-size="16" font-weight="700" fill="#9a6614">+${info.medals.length - 8}</text>`;
  }
  if (has('大電視')) g += `<g><rect x="676" y="672" width="118" height="66" rx="8" fill="#3e4a5a"/><rect x="683" y="679" width="104" height="52" rx="5" fill="#9fd0f0"/>
      <path d="M683 716 q26 -16 52 0 t52 0 v15 h-104 Z" fill="#8fd3b0"/><circle cx="760" cy="694" r="7" fill="#ffd66b"/><rect x="726" y="738" width="18" height="6" fill="#3e4a5a"/></g>`;
  if (has('走廊花園')) {
    const bed = (x, w) => `<rect x="${x}" y="588" width="${w}" height="44" rx="12" fill="#c9a27c"/><rect x="${x + 6}" y="592" width="${w - 12}" height="22" rx="8" fill="#8fd3b0"/>` +
      Array.from({ length: Math.floor(w / 34) }, (_, i) => { const fx = x + 20 + i * 34, c = ['#f7a8c0', '#ffd66b', '#c9a0e6', '#ef7d7d'][i % 4];
        return `<circle cx="${fx}" cy="598" r="7" fill="${c}"/><circle cx="${fx}" cy="598" r="2.6" fill="#fff6c9"/>`; }).join('');
    g += bed(40, 236) + bed(736, 230);
  }
  if (has('星星燈')) {
    const line = (x1, x2, y) => {
      let d = `M${x1} ${y}`, bulbs = '';
      for (let x = x1, i = 0; x < x2; x += 40, i++) {
        d += ` Q${x + 20} ${y + 14} ${x + 40} ${y}`;
        bulbs += `<circle class="of-bulb b${i % 3}" cx="${x + 20}" cy="${y + 8}" r="4.5" fill="${['#ffd66b', '#f7a8c0', '#9fd0f0'][i % 3]}"/>`;
      }
      return `<path d="${d}" fill="none" stroke="#a98f74" stroke-width="1.6"/>${bulbs}`;
    };
    g += `<g class="of-lights">${line(40, 580, 24)}${line(650, 960, 24)}${line(40, 440, 664)}${line(510, 960, 664)}</g>`;
  }
  return g;
}

// 會長大的盆栽：1 小芽、2 一般、3 茂盛、4 開花、5 結果
function officePlantSvg(cx, potTop, stage) {
  const sc = [0, 0.5, 1, 1.25, 1.3, 1.35][stage];
  const leaves = `<path d="M0 0 Q-26 -18 -22 -54 Q-2 -40 0 0 Z" fill="#8fd3b0"/><path d="M0 0 Q26 -20 26 -58 Q4 -42 0 0 Z" fill="#a8e0c0"/>` +
    (stage >= 3 ? `<path d="M0 0 Q-8 -40 4 -72 Q12 -38 0 0 Z" fill="#7cc7a0"/><path d="M0 -6 Q-30 -10 -38 -34 Q-14 -30 0 -6 Z" fill="#9fdcb8"/>` : '');
  const flowers = stage >= 4 ? [[-22, -54], [26, -58], [4, -72]].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="7" fill="${stage >= 5 ? '#ffffff' : '#f7a8c0'}"/><circle cx="${x}" cy="${y}" r="2.8" fill="#ffd66b"/>`).join('') : '';
  const fruits = stage >= 5 ? [[-14, -30], [14, -36], [-30, -40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#f4a261"/><path d="M${x} ${y - 6} l2 -3" stroke="#5f9e7a" stroke-width="2"/>`).join('') : '';
  return `<g class="of-leaf"><g transform="translate(${cx} ${potTop}) scale(${sc})">${leaves}${flowers}${fruits}</g></g>
    <path d="M${cx - 20} ${potTop} h40 l-5 34 q-15 5 -30 0 Z" fill="#f4b99a"/>`;
}

// 辦公室週年：派對布條、茶几上的蛋糕
function officePartySvg() {
  const info = officeInfo_;
  if (!info || !info.party) return '';
  return `<g class="of-decor"><path d="M300 580 Q500 620 700 580" fill="none" stroke="#c9a0e6" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${312 + i * 50} ${586 + (i < 4 ? i : 7 - i) * 5} l12 26 l12 -26 Z" fill="${['#f7a8c0', '#ffd66b', '#9fd0f0', '#8fd3b0'][i % 4]}"/>`).join('')}
    <rect x="404" y="618" width="192" height="34" rx="17" fill="#fff" stroke="#c9a0e6" stroke-width="3"/>
    <text x="500" y="642" font-size="21" font-weight="700" text-anchor="middle" fill="#8a5fb5">辦公室 ${info.party} 週年 🎉</text>
    <g transform="translate(812 954)"><rect x="-26" y="-10" width="52" height="26" rx="6" fill="#fff6ec" stroke="#f3a0b8" stroke-width="2.4"/><rect x="-26" y="-10" width="52" height="8" rx="4" fill="#f7a8c0"/>
      <rect x="-2" y="-28" width="4" height="18" fill="#9fd0f0"/><path d="M0 -36 q-4 4 0 8 q4 -4 0 -8 Z" fill="#ffb74d"/></g></g>`;
}

// 地毯畫在家具下面（茶几下）
function officeRugSvg() {
  const info = officeLevelInfo();
  if (!info || !info.unlocked.includes('地毯')) return '';
  return `<ellipse cx="812" cy="985" rx="128" ry="74" fill="#f7c9a8"/><ellipse cx="812" cy="985" rx="110" ry="60" fill="none" stroke="#fff4e8" stroke-width="5" stroke-dasharray="10 8"/>`;
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
  const short = v => v >= 10000 ? `$${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}萬` : `$${Math.round(v).toLocaleString()}`;
  const board = d.cats.slice(0, 3).map((c, i) => `
    <text x="306" y="${70 + i * 32}" font-size="23" font-weight="600" fill="#5b6475">${t(c.name, 4)}</text>
    <rect x="402" y="${54 + i * 32}" width="106" height="17" rx="8.5" fill="#eef1f4"/>
    <rect x="402" y="${54 + i * 32}" width="${Math.max(12, 106 * c.value / max).toFixed(0)}" height="17" rx="8.5" fill="${barColor[i]}"/>
    <path d="M406 ${58 + i * 32} h${Math.max(4, 106 * c.value / max - 12).toFixed(0)}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
    <text x="586" y="${69 + i * 32}" font-size="18" font-weight="600" text-anchor="end" fill="#8a94a3">${short(c.value)}</text>`).join('')
    || '<text x="444" y="100" font-size="25" text-anchor="middle" fill="#a8978a">還沒有支出 ✏️</text>';
  // 白板外框、標題、磁鐵、筆槽（畫在 mv(30) 的座標裡）
  const boardFrame = alarm => `
    <rect x="288" y="26" width="312" height="140" rx="10" fill="#c3ccd6"/>
    <rect x="291" y="29" width="306" height="134" rx="8" fill="#dfe5eb"/>
    <rect x="297" y="35" width="294" height="118" rx="5" fill="#ffffff" stroke="${alarm ? '#ef5f7a' : '#e6ebf0'}" stroke-width="${alarm ? 6 : 2}"/>
    <path d="M304 42 L330 42" stroke="#f3f5f8" stroke-width="5" stroke-linecap="round"/>
    <rect x="404" y="18" width="80" height="20" rx="6" fill="#9aa8b6"/><text x="444" y="33" font-size="14" font-weight="700" text-anchor="middle" fill="#ffffff">本月支出</text>
    <circle cx="303" cy="41" r="5" fill="#ef7d7d"/><circle cx="585" cy="41" r="5" fill="#7fb6f0"/>
    <rect x="318" y="164" width="252" height="9" rx="4" fill="#aeb9c4"/>
    <rect x="334" y="158" width="26" height="7" rx="3.5" fill="#ef5f7a"/><rect x="334" y="158" width="7" height="7" rx="2" fill="#c2405b"/>
    <rect x="366" y="158" width="26" height="7" rx="3.5" fill="#5f9ee6"/><rect x="366" y="158" width="7" height="7" rx="2" fill="#3f78bd"/>
    <rect x="398" y="158" width="26" height="7" rx="3.5" fill="#49b07f"/><rect x="398" y="158" width="7" height="7" rx="2" fill="#2f8a5e"/>
    <rect x="520" y="156" width="34" height="10" rx="3" fill="#3e4a5a"/><rect x="520" y="156" width="34" height="4" rx="2" fill="#7d8a99"/>`;
  // 貨架：上排放需要注意的品項，下排是一般貨
  // 空位：放一些日用品（依位置輪流），看起來像真的貨架
  const filler = (x, y, k) => [
    `<rect x="${x + 10}" y="${y + 18}" width="26" height="38" rx="4" fill="#ffffff" stroke="#d8cfc5" stroke-width="2"/><ellipse cx="${x + 23}" cy="${y + 18}" rx="13" ry="4" fill="#f1ece6" stroke="#d8cfc5" stroke-width="2"/>
     <rect x="${x + 42}" y="${y + 18}" width="26" height="38" rx="4" fill="#ffffff" stroke="#d8cfc5" stroke-width="2"/><ellipse cx="${x + 55}" cy="${y + 18}" rx="13" ry="4" fill="#f1ece6" stroke="#d8cfc5" stroke-width="2"/>`,
    `<rect x="${x + 14}" y="${y + 14}" width="22" height="42" rx="6" fill="#9fd8cb"/><rect x="${x + 19}" y="${y + 6}" width="12" height="10" rx="3" fill="#5fb89f"/>
     <rect x="${x + 44}" y="${y + 24}" width="28" height="32" rx="5" fill="#f7c9a8"/><rect x="${x + 48}" y="${y + 30}" width="20" height="10" rx="2" fill="#ffffff" opacity="0.8"/>`,
    `<rect x="${x + 8}" y="${y + 30}" width="70" height="26" rx="5" fill="#cfe0f2"/><rect x="${x + 14}" y="${y + 12}" width="58" height="20" rx="5" fill="#e3ecf6"/>
     <path d="M${x + 43} ${y + 12} v44" stroke="#b9cde4" stroke-width="2"/>`,
  ][k % 3];
  const box = (x, y, a, k = 0) => {
    if (!a) return filler(x, y, k);
    const tag = a.level === 'red' ? '#ef5f7a' : (a.level === 'warn' ? '#f2b85c' : '#49b07f');
    return `<g${a.level === 'red' ? ' class="of-alert"' : ''}>
      <rect x="${x}" y="${y + 2}" width="86" height="56" rx="4" fill="#e3b98a" stroke="#c99a6a" stroke-width="2"/>
      <path d="M${x} ${y + 12} h86" stroke="#c99a6a" stroke-width="2"/>
      <rect x="${x + 37}" y="${y + 2}" width="12" height="56" fill="#f3dfc0" opacity="0.85"/>
      <rect x="${x + 7}" y="${y + 17}" width="72" height="34" rx="5" fill="#ffffff" stroke="${tag}" stroke-width="2.4"/>
      <rect x="${x + 7}" y="${y + 17}" width="72" height="7" rx="3" fill="${tag}"/>
      <text x="${x + 43}" y="${y + 46}" font-size="21" font-weight="600" text-anchor="middle" fill="#4a3b30">${a.name && a.name.trim() ? t(a.name, 3) : '✓'}</text></g>`;
  };
  // 木頭層架：背板、左右立柱、上下層板
  const rack = y => `
    <rect x="656" y="${y + 2}" width="300" height="90" rx="4" fill="#ecd6b8"/>
    <path d="M660 ${y + 30} h292 M660 ${y + 60} h292" stroke="#e3c9a5" stroke-width="2"/>
    <rect x="650" y="${y - 4}" width="12" height="104" rx="3" fill="#b98a5c"/><rect x="950" y="${y - 4}" width="12" height="104" rx="3" fill="#b98a5c"/>
    <rect x="650" y="${y - 6}" width="312" height="9" rx="3" fill="#c99a6a"/>
    <rect x="650" y="${y + 90}" width="312" height="10" rx="3" fill="#a9754f"/><rect x="650" y="${y + 90}" width="312" height="3" fill="#d9b48a"/>`;
  const top3 = d.alerts.slice(0, 3);
  const topBoxes = [0, 1, 2].map(i => {
    if (top3[i]) return box(672 + i * 96, 62, top3[i]);
    return d.items.length && !d.alerts.length ? box(672 + i * 96, 62, { level: 'ok', name: '' }) : box(672 + i * 96, 62, null, i);
  }).join('');
  // 下排：第 4～6 項；超過 6 項時，最後一格改成「+N項」
  const lowBoxes = [0, 1, 2].map(i => {
    const al = d.alerts[3 + i];
    if (!al) return box(672 + i * 96, 172, null, i + 1);
    if (i === 2 && d.alerts.length > 6) return box(672 + i * 96, 172, { level: al.level, name: `+${d.alerts.length - 5}項` });
    return box(672 + i * 96, 172, al);
  }).join('');
  const env = (x, y, p, color) => `
    <g transform="translate(${x} ${y})"><g class="of-env ${p.arrived ? 'arrived' : ''}">
      <rect width="66" height="46" rx="8" fill="${p.arrived ? color : '#f1ece6'}" stroke="rgba(90,70,50,0.22)" stroke-width="2"/>
      <path d="M3 6 L33 27 L63 6" fill="none" stroke="rgba(90,70,50,0.25)" stroke-width="2.4"/>
      <path d="M33 22 c-6 -9 -16 -1 -9 6 l9 8 9 -8 c7 -7 -3 -15 -9 -6 Z" fill="${p.arrived ? '#ffffff' : '#d8cfc5'}"/>
      <circle cx="62" cy="4" r="13" fill="#ffffff" stroke="rgba(90,70,50,0.2)" stroke-width="2"/>
      <text x="62" y="10.5" font-size="17" text-anchor="middle">${p.name === '精靈' ? '🐎' : '🦊'}</text>
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
    <!-- 記帳區：白板、兩張桌子、盆栽；本月最大一筆貼在白板下 -->
    ${d.biggest ? `<g transform="translate(0 8) rotate(-3 505 225)"><rect x="420" y="196" width="170" height="56" rx="5" fill="#fff3a8" stroke="#e8d36a" stroke-width="2"/><circle cx="505" cy="200" r="6" fill="#ef5f7a"/>
      <text x="505" y="222" font-size="18" font-weight="700" text-anchor="middle" fill="#8a6d1c">最大筆 ${fmt(d.biggest.expense)}</text>
      <text x="505" y="244" font-size="17" text-anchor="middle" fill="#8a6d1c">${t(d.biggest.item, 8)}</text></g>` : ''}
    ${mv(30, `${boardFrame(d.pace && d.pace.fast)}${board}${d.pace && d.pace.fast ? `<g class="of-alarm"><rect x="372" y="-14" width="144" height="34" rx="17" fill="#ef5f7a"/><text x="444" y="10" font-size="22" font-weight="700" text-anchor="middle" fill="#fff">⚠ 花比較快</text></g>` : ''}`)}
    ${mv(51, `${desk(60, 108, 215, wood)}
    <path d="M118 150 Q140 138 162 148 Q184 138 206 150 L206 126 Q184 115 162 124 Q140 115 118 126 Z" fill="#ffffff" stroke="#d9c7b0" stroke-width="2"/>
    <path d="M162 124 L162 148 M128 132 Q140 127 154 132 M170 132 Q184 127 198 132" fill="none" stroke="#9fd8cb" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="74" y="120" width="34" height="26" rx="5" fill="#bfe3f0"/><rect x="79" y="125" width="24" height="7" rx="2" fill="#f7fdfb"/>
    <rect x="232" y="116" width="26" height="30" rx="6" fill="#9fd8cb"/><path d="M239 116 L236 100 M246 116 L246 97 M252 116 L256 101" stroke="#f08fb0" stroke-width="4" stroke-linecap="round"/>`)}
    ${mv(79, `${desk(380, 178, 195, wood)}
    <rect x="436" y="186" width="84" height="42" rx="8" fill="#5b6475"/><rect x="442" y="191" width="72" height="31" rx="5" fill="#cfe7ff"/>
    <path d="M450 216 l10 -9 9 5 12 -13 12 8 10 -10" fill="none" stroke="#f79aae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`)}
    ${officePlantSvg(550, 410, officeInfo_ ? officeInfo_.plant : 2)}
    <!-- 倉庫：兩排貨架、小推車桌 -->
    ${mv(29, `${rack(46)}${topBoxes}
    ${d.alerts.length ? `<circle cx="952" cy="50" r="26" fill="#ef5f7a"/><text x="952" y="61" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${d.alerts.length}</text>` : ''}`)}
    ${mv(73, `${rack(156)}${lowBoxes}`)}
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
    ${officeUpgradeSvg()}
    ${officeDecorSvg()}
    <!-- 休息區：地毯（升級）、茶水機、茶几、沙發、盆栽、黑柴的窩 -->
    ${officeRugSvg()}
    ${mv(310, `<ellipse cx="575" cy="800" rx="64" ry="34" fill="#b9a48d"/><ellipse cx="575" cy="793" rx="64" ry="34" fill="#d7c4ae"/><ellipse cx="575" cy="790" rx="48" ry="23" fill="#f3e9db"/>
    <g transform="translate(628 824) rotate(-20)"><rect x="-11" y="-2.5" width="22" height="5" rx="2.5" fill="#fff"/><circle cx="-11" cy="-3" r="4" fill="#fff"/><circle cx="-11" cy="3" r="4" fill="#fff"/><circle cx="11" cy="-3" r="4" fill="#fff"/><circle cx="11" cy="3" r="4" fill="#fff"/></g>`)}
    ${mv(220, `<g class="of-coffee">
      <ellipse cx="548" cy="626" rx="46" ry="6" fill="rgba(90,70,50,0.12)"/>
      <!-- 側邊水箱 -->
      <rect x="494" y="536" width="16" height="66" rx="5" fill="#d7ecf8" stroke="#a9cbe2" stroke-width="2"/>
      <rect x="496" y="560" width="12" height="40" rx="3" fill="#9fd0f0" opacity="0.8"/><path d="M499 566 v28" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>
      <!-- 機身 -->
      <rect x="506" y="520" width="80" height="104" rx="12" fill="#e9eff5"/>
      <rect x="506" y="520" width="80" height="104" rx="12" fill="none" stroke="#c5d2de" stroke-width="2"/>
      <rect x="506" y="520" width="80" height="26" rx="12" fill="#5b6475"/><rect x="506" y="534" width="80" height="12" fill="#5b6475"/>
      <rect x="513" y="526" width="28" height="13" rx="3" fill="#2f3845"/>
      <text class="of-coffee-lcd" x="527" y="537" font-size="11" text-anchor="middle">${officePhase === 'morning' ? '☕' : '🍵'}</text>
      <circle class="of-btn" cx="556" cy="533" r="4.4" fill="#ef7d7d"/><circle cx="571" cy="533" r="4.4" fill="#8fd3b0"/>
      <!-- 沖泡頭、出水口、水流 -->
      <rect x="528" y="550" width="36" height="11" rx="4" fill="#3e4a5a"/><rect x="541" y="560" width="10" height="7" rx="2" fill="#2f3845"/>
      <rect class="of-drip" x="544.5" y="567" width="3" height="18" rx="1.5" fill="#8a5a3b"/>
      <!-- 杯子（液面會跟著沖泡升高）-->
      <clipPath id="ofCupClip"><path d="M533 584 h26 l-3 22 h-20 Z"/></clipPath>
      <path d="M533 584 h26 l-3 22 h-20 Z" fill="#ffffff" stroke="#d9c7b0" stroke-width="2"/>
      <g clip-path="url(#ofCupClip)"><rect class="of-fill" x="530" y="584" width="32" height="22" fill="${officePhase === 'morning' ? '#a9754f' : '#c9a27c'}"/></g>
      <path d="M559 589 q8 0 7 7 q-1 5 -9 5" fill="none" stroke="#d9c7b0" stroke-width="2.4"/>
      <!-- 滴水盤 -->
      <rect x="518" y="606" width="56" height="9" rx="3" fill="#9aa8b6"/><path d="M526 610.5 h40" stroke="#c5d0db" stroke-width="2" stroke-dasharray="4 3"/>
      <path class="of-steam" d="M540 578 q-5 -8 0 -15 M552 578 q5 -8 0 -15" fill="none" stroke="#a9bfd8" stroke-width="3" stroke-linecap="round"/>
    </g>`)}
    ${mv(276, `<ellipse cx="812" cy="704" rx="72" ry="38" fill="#e3b98a"/><ellipse cx="812" cy="694" rx="72" ry="38" fill="#f4d9b6"/>
    <rect x="792" y="676" width="24" height="20" rx="5" fill="#ffffff" stroke="#d9c7b0" stroke-width="2.5"/><circle cx="838" cy="694" r="10" fill="#f79aae"/>`)}
    ${mv(328, `<rect x="672" y="792" width="276" height="96" rx="34" fill="#f3a9bf"/>
    <rect x="690" y="806" width="240" height="70" rx="24" fill="#f9c6d5"/>
    <rect x="700" y="812" width="106" height="48" rx="18" fill="#fde0e9"/><rect x="814" y="812" width="106" height="48" rx="18" fill="#fde0e9"/>`)}
    ${officePlantSvg(934, 799, officeInfo_ ? officeInfo_.plant : 2)}
    ${officePartySvg()}
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
  const big = d.biggest ? `<div class="of-row"><span>本月最大一筆</span><b class="of-exp">${esc(d.biggest.item)} ${fmt(d.biggest.expense)}</b></div>` : '';
  return `<h4>📊 白板 <small>小析負責</small></h4>
    ${pace}${big}${bars || '<p class="of-note">這個月還沒有支出。</p>'}
    ${d.pace && d.pace.fast ? '<p class="of-note">這個月的支出速度比上個月快，白板會亮紅框提醒。</p>' : ''}
    <div class="of-actions">${replay}${go('analysis', '看分析')}</div>`;
}


// ── 員工、座位與走動路線 ──────────────────────────────────────
// 每一區有一條淨空的直走道（col），員工先橫向走到走道，再經中間走廊到另一區，不會穿過家具
const OFFICE_COL = { A: 325, B: 700, C: 420, D: 620 };
const OFFICE_HALL_Y = 610;
const OFFICE_SPOTS = {
  byDog:   { x: 658, y: 1070, zone: 'D', go: '蹦蹦跳跳去找黑柴', at: '跑去逗黑柴玩 🐶' },  // 黑柴的窩旁邊
  byChart: { x: 400, y: 415, zone: 'A' },   // 小析座位旁
  byStock: { x: 815, y: 485, zone: 'B' },   // 阿貨座位旁
  byCash:  { x: 252, y: 1224, zone: 'C' },  // 阿庫座位旁
  tea2:    { x: 738, y: 832, zone: 'D' },   // 茶水間的第二個位置（一起喝茶）
  mail:    { x: 412, y: 735, zone: 'C' },   // 金庫門口（收信）
  trash:   { x: 745, y: 545, zone: 'B' },   // 倉庫的垃圾桶旁
  wow_stock: { x: 120, y: 445, zone: 'A' },   // 大筆支出：大家圍到記帳區
  wow_cash:  { x: 235, y: 450, zone: 'A' },
  wow_chart: { x: 350, y: 445, zone: 'A' },
  wow_dog:   { x: 300, y: 545, zone: 'A' },
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
  { id: 'book',  name: '小帳',   role: '記帳', tag: 'book',  seat: { x: 170, y: 335, zone: 'A' }, visits: ['tea', 'board'], rest: 1.6 },
  { id: 'chart', name: '小析',   role: '分析', tag: 'chart', seat: { x: 478, y: 410, zone: 'A' }, visits: ['board', 'board', 'desk', 'tea'], rest: 1 },
  { id: 'stock', name: '阿貨',   role: '倉管', tag: 'stock', seat: { x: 900, y: 480, zone: 'B' }, visits: ['shelf', 'shelf', 'shelf', 'tea'], rest: 0.8 },
  { id: 'cash',  name: '阿庫',   role: '出納', tag: 'cash',  seat: { x: 156, y: 1221, zone: 'C' }, visits: ['piggy', 'piggy', 'desk', 'tea'], rest: 1.1 },
  { id: 'elf',   name: '精靈',   role: '成員', tag: 'elf',   seat: { x: 752, y: 1219, zone: 'D' }, visits: ['board', 'board', 'desk', 'piggy', 'shelf'], rest: 1.5 },
  { id: 'fox',   name: '小狐狸', role: '成員', tag: 'fox',   seat: { x: 868, y: 1219, zone: 'D' }, visits: ['tea', 'tea', 'shelf', 'piggy', 'board', 'byDog', 'desk'], rest: 0.45 },
  { id: 'dog',   name: '黑柴',   role: '吉祥物', tag: 'dog', seat: { x: 575, y: 1120, zone: 'D' }, visits: ['giveElf', 'giveFox', 'giveFox', 'tea', 'piggy', 'board'], speed: 210, rest: 0.7 },
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
  // 在走廊上（H）：直接沿走廊走到目標房間的入口
  if (fz === 'H' || tz === 'H') {
    if (fz !== 'H') pts.push({ x: cf, y: from.y }, { x: cf, y: OFFICE_HALL_Y });
    else pts.push({ x: from.x, y: OFFICE_HALL_Y });
    if (tz !== 'H') pts.push({ x: ct, y: OFFICE_HALL_Y }, { x: ct, y: to.y });
    else pts.push({ x: to.x, y: OFFICE_HALL_Y });
    pts.push({ x: to.x, y: to.y });
    return pts;
  }
  if (fz === tz) {
    if (Math.abs(from.y - to.y) > 1) pts.push({ x: cf, y: from.y }, { x: cf, y: to.y });
  } else {
    pts.push({ x: cf, y: from.y }, { x: cf, y: OFFICE_HALL_Y }, { x: ct, y: OFFICE_HALL_Y }, { x: ct, y: to.y });
  }
  pts.push({ x: to.x, y: to.y });
  return pts;
}

// 依座標判斷在哪一區（走廊是 H）
function officeZoneAt(x, y) {
  if (y < 560) return x < 620 ? 'A' : 'B';
  if (y > 660) return x < 480 ? 'C' : 'D';
  return 'H';
}
const OFFICE_ZONE_X = { A: [45, 595], B: [655, 955], C: [45, 455], D: [515, 955], H: [45, 955] };

// 跑腿這一站要走去哪裡：固定地點，或「某個人現在的位置旁邊」
function officeStepTarget(a, st) {
  if (!st.follow) return OFFICE_SPOTS[st.spot];
  const t = officeActors[st.follow];
  const zone = officeZoneAt(t.x, t.y);
  const side = a.x <= t.x ? -1 : 1;
  const [lo, hi] = OFFICE_ZONE_X[zone];
  let x = t.x + side * 72;
  if (x < lo || x > hi) x = t.x - side * 72;
  return { x: Math.max(lo, Math.min(hi, x)), y: t.y + 2, zone };
}

// 叫對方先別走開，等跑腿的人過來
function officeHoldFor(st, ts, ms) {
  if (!st.follow) return;
  const t = officeActors[st.follow];
  if (t && !t.job && t.state !== 'walk') t.until = Math.max(t.until, ts + ms);
}

// 出發去跑腿的這一站（從現在的位置直接出發）
function officeGoStep(a, s, ts, d) {
  const st = a.job.steps[a.job.i];
  a.zone = officeZoneAt(a.x, a.y);
  a.target = officeStepTarget(a, st);
  a.spot = st.spot;
  a.chase = 0;
  a.path = officePath(a, a.zone, a.target, a.target.zone);
  a.state = 'walk';
  a.back = false;
  officeHoldFor(st, ts, 25000);
  if (d && !st.quiet) setTimeout(() => officeSay(s.id, st.go), 0);
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
  if (asleep) return { book: '（夢話）這筆…對齊了…💤', chart: '（夢話）曲線…好美…💤', stock: '（夢話）衛生紙…還有嗎…💤', cash: '（夢話）錢錢…不要走…💤', elf: '（夢話）第三個預算版本…💤', fox: '（夢話）好吃…再一口…💤', dog: '睡在窩裡打呼 💤' }[id] || '睡著了 💤';
  if (id === 'dog') {
    if (a && a.state === 'walk') return a.back ? '跑回窩裡' : '在辦公室巡邏';
    if (a && a.state === 'visit') return a.spot === 'piggy' ? '聞聞小豬（有零食味嗎？）' : (a.spot === 'shelf' ? '聞聞貨架上的箱子 👃' : (a.spot === 'board' ? '歪頭看白板 ❓' : (a.spot === 'giveElf' ? '黏在精靈腳邊 🐾' : (a.spot === 'giveFox' ? '跟著小狐狸跑來跑去 🐾' : '在茶水間討零食 🥺'))));
    return '趴在窩裡（偷看零食櫃）👀';
  }
  if (a && a.state === 'walk') return a.back ? '走回座位' : OFFICE_SPOTS[a.spot].go;
  if (a && a.state === 'visit') {
    const al = d.alerts[0], cat = d.cats[0];
    if (a.spot === 'tea') {
      if (id === 'fox') return officePhase === 'morning' ? '早安～我要拿鐵加兩份糖 ☕😋' : '在茶水間找點心 🍰';
      if (id === 'elf') return officePhase === 'morning' ? '早安，邊喝咖啡邊看今天的行程 ☕📋' : '泡杯茶，順便想想預算 🍵';
      if (officePhase === 'morning') return '早安～咖啡…咖啡救我 ☕😪';
      if (officePhase === 'evening') return '下班前喝杯茶，今天辛苦了 🍵';
    }
    if (a.spot === 'shelf') {
      if (id === 'elf') return al ? `檢查庫存：${al.name}${al.text}，加進採買清單 📋` : '檢查庫存，一切照計畫 📋';
      if (id === 'fox') return '在貨架翻零食 🍪😋';
      return al ? `例行盤點：${al.name}${al.text}…好慌 😣` : '例行盤點…數一次…再數一次 ✨';
    }
    if (a.spot === 'piggy') {
      if (id === 'cash') return '摸摸金幣…好幸福 💰🥹';
      if (id === 'elf') return `確認存錢筒：${fmt(d.balance)}，跟預算對一下 📊`;
      if (id === 'fox') return '偷偷戳小豬 🐷😆';
      return `看看存錢筒：${fmt(d.balance)}`;
    }
    if (a.spot === 'board') {
      if (id === 'chart') return cat ? `盯著白板：${cat.name}…好美 📈🥹` : '盯著空白的白板…好寂寞 😢';
      if (id === 'elf') return cat ? `分析白板：${cat.name}最多，下個月要調整 📊` : '分析白板 📊';
      if (id === 'fox') return '在白板角落畫愛心 💕';
      return cat ? `看白板：${cat.name}最多` : '看白板';
    }
    return OFFICE_SPOTS[a.spot].at;
  }
  const latest = d.sorted[0];
  const pending = d.love.filter(p => p.has && !p.arrived);
  const arrived = d.love.filter(p => p.has && p.arrived);
  if (id === 'book') {
    const n = officeNewCount[currentSheet()] || 0;
    if (n > 0) return `新增了 ${n} 筆！一筆一筆對齊中 ✍️`;
    return d.todayCount > 0 && latest ? `登記「${latest.item}」…分毫不差 ✍️` : (latest ? `整理帳本：「${latest.item}」，再核對一次 🔍` : '帳本空空的…好不安 😰');
  }
  if (id === 'chart') {
    if (d.pace && d.pace.fast) return `曲線往上衝了（比上月同期 +${d.pace.pct}%）…我不敢看 😱`;
    return d.cats.length ? `${d.cats[0].name}占最多…曲線好美 📈` : '沒有資料可以畫…好空虛 😢';
  }
  if (id === 'stock') return d.alerts.length ? `${d.alerts[0].name}${d.alerts[0].text}！怎麼辦 😣` : (d.items.length ? '貨架滿滿～安心感 MAX ✨' : '倉庫空空的…好沒安全感 😰');
  if (id === 'cash') {
    if (d.settled) return '月底結算完成，錢錢都歸位了 💰';
    if (pending.length) return `等 ${pending[0].date} 的每月的愛…好想它 🥺`;
    return arrived.length ? `清點每月的愛 ${arrived.length}/2，摸摸 💕` : '顧金庫，誰都不准動 😤';
  }
  const o = d.owners[id === 'elf' ? '精靈' : '小狐狸'];
  if (id === 'elf') return o.count ? `排下個月的預算・本月花了 ${fmt(o.expense)} 📋` : '排下個月的預算・這個月還沒支出 📋';
  return o.count ? `滑手機找好吃的・本月花了 ${fmt(o.expense)} 🍰` : '滑手機找好玩的・這個月還沒花錢 😆';
}

// 大筆支出：阿貨、阿庫、小析、黑柴圍到記帳區來看，小析記在白板上
function officeQueueWow(item, amount) {
  const name = String(item || '');
  const plan = [
    ['stock', 'wow_stock', '買了什麼？可以放倉庫嗎？可以嗎？👀'],
    ['cash', 'wow_cash', `${fmt(amount)}……我的心在滴血 🩸`],
    ['dog', 'wow_dog', '汪？（歪頭）'],
    ['chart', 'wow_chart', `「${name}」${fmt(amount)}…支出要暴增了！我記在白板上了 📌😱`],
  ];
  // 只有阿貨喊一聲，其他人安靜跑過去（免得對話框疊在一起）
  plan.forEach(([id, spot, line]) => officeJobs[id].push({ type: 'wow', steps: [{ spot, fx: 'wow', stay: 5200, go: id === 'stock' ? '有大筆支出，快來看！' : '跑去看大筆支出', quiet: id !== 'stock', at: line }] }));
  setTimeout(() => { if (officeActors.book && officeActors.book.state === 'seat') officeWakeSay('book', '好的我記了…手在發抖 ✍️💦'); }, 2500);
  // 精靈冷靜分析，小狐狸在旁邊打圓場
  setTimeout(() => { if (officeActors.elf && officeActors.elf.state === 'seat' && !officeActors.elf.job) officeWakeSay('elf', '別慌，我看一下預算還剩多少 📊'); }, 9000);
  setTimeout(() => { if (officeActors.fox && officeActors.fox.state === 'seat' && !officeActors.fox.job) officeWakeSay('fox', '花都花了～開心最重要啦 😆 精靈不要皺眉嘛'); }, 11500);
}

// 每天一次的事件：每月的愛入帳當天、庫存有東西過期
function officeDailyEvents(d) {
  if (!officeIsCurrentMonth()) return;
  d.love.filter(p => p.arrivedToday && p.amount > 0).forEach(p => {
    if (officeOnce('love:' + p.name)) officeJobs.cash.push({ type: 'love', name: p.name, amount: p.amount });
  });
  const now = new Date();
  const todayKey = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0');
  const big = d.entries.filter(r => r.expense >= OFFICE_BIG && toMMDD(r.date) === todayKey && !(r.note && r.note.includes('先付')))
    .sort((a, b) => b.expense - a.expense)[0];
  if (big && officeOnce('big:' + big.item + ':' + big.expense)) officeQueueWow(big.item, big.expense);
  const expired = d.alerts.filter(a => a.text === '已過期');
  if (expired.length && officeOnce('expired:' + expired.map(a => a.name).join(','))) {
    officeJobs.stock.push({ type: 'expired', names: expired.slice(0, 3).map(a => a.name), total: expired.length });
  }
}

// ── 記帳後的跑腿：記帳區登記 → 金庫領錢（收入則是存錢）──────────
function officeJobSteps(j) {
  if (j.type === 'skit' || j.type === 'meeting' || j.type === 'wow') return j.steps;
  if (j.type === 'love') {
    // 每月的愛入帳：阿庫到門口收信，再拿去投進小豬
    return [
      { spot: 'mail', fx: 'mail', stay: 2800, go: '聽到郵差！衝去門口 💌🏃', at: `${j.name}的每月的愛來了！！😭💕` },
      { spot: 'piggy', fx: 'loveIn', amount: j.amount, stay: 3200, go: `把 ${fmt(j.amount)} 拿去存`, at: `存入 ${fmt(j.amount)}，小豬吃飽飽 🐷✨` },
    ];
  }
  if (j.type === 'expired') {
    // 過期：阿貨到貨架拿出來，丟進垃圾桶
    const names = j.names.join('、') + (j.total > j.names.length ? ` 等 ${j.total} 項` : '');
    return [
      { spot: 'shelf', fx: 'pick', stay: 2800, go: '慌張地衝去貨架', at: `完蛋了，${names}過期了啦！😭` },
      { spot: 'trash', fx: 'trash', stay: 3000, go: '捧去垃圾桶', at: '丟掉丟掉…記得到庫存更新喔 🗑️😣' },
    ];
  }
  if (j.type === 'settle') {
    // 月底結算：阿庫到存錢筒領錢，再送到沙發交給兩人（金額以目前資料為準）
    const back = officeData_ ? officeData_.back.filter(b => b.amount > 0) : [];
    if (!back.length) return [];
    const total = back.reduce((sum, b) => sum + b.amount, 0);
    return [
      { spot: 'piggy', fx: 'settleOut', amount: total, stay: 3200, go: '月底結算：去金庫領錢 😣', at: `領出 ${fmt(total)}…手在抖 😭` },
      ...back.map(b => ({ spot: b.name === '精靈' ? 'giveElf' : 'giveFox', follow: b.name === '精靈' ? 'elf' : 'fox', fx: 'give', to: b.name === '精靈' ? 'elf' : 'fox', amount: b.amount, stay: 3200,
        go: `把 ${fmt(b.amount)} 送去給${b.name}`, at: `轉回${b.name} ${fmt(b.amount)}` })),
    ];
  }
  const name = j.item;
  const amt = fmt(j.amount);
  return [
    { spot: 'desk', follow: 'book', fx: 'book', stay: 3400, go: `去找小帳登記「${name}」`, at: `登記：${name} ${j.income ? '+' : '−'}${amt}` },
    { spot: 'piggy', follow: 'cash', fx: 'money', stay: 3200, go: j.income ? `帶 ${amt} 去找阿庫存錢` : `去找阿庫領 ${amt}`, at: j.income ? `存入 ${amt}` : `領出 ${amt}` },
  ];
}

// ── 平常的角色互動：找人對帳、送補貨提醒、一起喝茶、沙發聊天（台詞來自真實資料）──
function officeSkits(d) {
  const free = id => officeActors[id].state === 'seat' && !officeActors[id].job;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const talk = (spot, go, at, lines, extra = {}) => ({ spot, go, at, fx: 'talk', lines, stay: lines.length * 2100 + 1600, ...extra });
  const top = d.cats[0], alert = d.alerts[0], latest = d.sorted[0];
  const pct = Math.round(d.ratio * 100);
  const list = [];
  const add = (key, ids, build) => { if (ids.every(free)) list.push({ key, ids, build }); };

  add('book-chart', ['book', 'chart'], () => ({ book: [talk('byChart', '抱著帳本衝去找小析', '跟小析更新圖表', [
    { who: 'book', text: d.todayCount ? `今天 ${d.todayCount} 筆，全部對齊了！快更新圖表 ✍️✨` : `這個月 ${d.entries.length} 筆，我核對三次了，拜託看一下 🙏` },
    { who: 'chart', text: top ? `來了來了！${top.name} ${fmt(top.value)}…這曲線好美 📈🥹` : '沒有支出…我的圖表好寂寞 😢' },
    { who: 'book', text: pick(['你冷靜一點啦 😅', '…你是不是又熬夜看數字了', '好啦好啦，你開心就好']) }])] }));

  add('chart-book', ['chart', 'book'], () => ({ chart: [talk('desk', '興奮地跑去找小帳', '跟小帳核對數字', [
    { who: 'chart', text: top ? `小帳小帳！${top.name}這個月 ${fmt(top.value)}，對吧對吧？👀` : '帳本借我看一下，我數字禁斷症發作了 😵' },
    { who: 'book', text: latest ? `最新一筆「${latest.item}」，我對過三遍了，分毫不差 😤` : '帳本還是空的…好不安 😰' },
    { who: 'chart', text: '你最可靠了！！🥹' }])] }));

  add('cash-book', ['cash', 'book'], () => ({ cash: [talk('desk', '去找小帳對帳', '跟小帳對帳', [
    { who: 'cash', text: `餘額 ${fmt(d.balance)}…我數了五次，你那邊呢？💰` },
    { who: 'book', text: `本月支出 ${fmt(d.expense)}，對得上！呼…放心了 😮‍💨` },
    { who: 'cash', text: d.expense > d.balance ? '花掉的比剩下的多…我的心好痛 🩸' : '錢錢都還在，好乖好乖 💰💕' }])] }));

  ['elf', 'fox'].forEach(m => {
    const name = m === 'elf' ? '精靈' : '小狐狸', spot = m === 'elf' ? 'giveElf' : 'giveFox';
    const o = d.owners[name], love = d.love.find(p => p.name === name);

    add('stock-' + m, ['stock', m], () => ({ stock: [talk(spot, `慌張地跑去找${name}`, `跟${name}講補貨的事`, alert ? [
      { who: 'stock', text: `${name}！${alert.name}${alert.text}！怎麼辦怎麼辦 😱` },
      { who: m, text: m === 'elf'
        ? (d.alerts.length > 1 ? `別慌，我列清單：還有 ${d.alerts.length - 1} 項，週末一次買齊 📋` : '別慌，我加進購物清單了，還準備了備案 📋')
        : pick(['好啦好啦～我順路去買，順便買點心 😋', '交給我！我最愛逛賣場了 🛒✨']) },
      { who: 'stock', text: '嗚嗚謝謝你 🥹' }] : [
      { who: 'stock', text: d.items.length ? '貨架滿滿的～安心感 MAX ✨' : '倉庫空空的…好沒安全感 😰' },
      { who: m, text: m === 'elf' ? (d.items.length ? '很好，我再建一份備品清單以防萬一 📋' : '我來規劃要登記哪些，先列個表 📋') : '哈哈你也太容易緊張了啦 😆' }])] }));

    add('cash-' + m, ['cash', m], () => ({ cash: [talk(spot, `去找${name}報告金庫`, `跟${name}報告金庫狀況`, love && love.has && !love.arrived ? [
      { who: 'cash', text: `${name}～每月的愛 ${love.date} 才會來…我好想它 🥺` },
      { who: m, text: m === 'elf' ? '時間我都排好了，放心 📅' : '哈哈快了快了，乖喔～' }] : [
      { who: 'cash', text: d.mood === 'happy' ? `小豬 ${pct}% 滿！錢錢都乖乖的 💰✨` : (d.mood === 'worry' ? `小豬只剩 ${pct}%…我快哭了 😭` : '小豬…空了……我不行了 😵') },
      { who: m, text: m === 'elf'
        ? (d.mood === 'happy' ? '照計畫走，很好 👍' : '我來重排預算，下個月一定拉回來 📊')
        : (d.mood === 'happy' ? '耶～那週末去吃好料！🍜' : '沒事啦，我們一起省，不要哭 🤗') }])] }));

    add(m + '-book', [m, 'book'], () => ({ [m]: [talk('desk', '去問小帳這個月花多少', '問小帳這個月花多少', [
      { who: m, text: m === 'elf' ? '小帳，我要這個月的明細，分類也要 📋' : '小帳～我這個月是不是花很多？嘿嘿 🙈' },
      { who: 'book', text: o.count ? `${fmt(o.expense)}，共 ${o.count} 筆，每一筆都對齊了 ✍️` : '這個月還沒有支出喔！帳本乾乾淨淨 ✨' },
      { who: m, text: m === 'elf' ? (o.count ? '跟預算比還在範圍內，很好 👌' : '很好，照計畫 👍') : (o.count ? '哎唷～還好還好，花得很開心！😆' : '哇我好乖！獎勵一下自己 🍰') }])] }));

    add(m + '-stock', [m, 'stock'], () => ({ [m]: [talk('byStock', '去問阿貨家裡缺什麼', '問阿貨家裡缺什麼', [
      { who: m, text: m === 'elf' ? '阿貨，給我完整的庫存清單 📋' : '阿貨～家裡缺什麼？我要出門逛逛 🛍️' },
      { who: 'stock', text: d.alerts.length ? `${d.alerts.slice(0, 2).map(a => a.name).join('、')}要補！${d.alerts.length > 2 ? `總共 ${d.alerts.length} 項 😱` : '拜託快點 😣'}` : '目前都不缺！安心 ✨' },
      { who: m, text: d.alerts.length ? (m === 'elf' ? '收到，排進這週的採買計畫 📅' : '好～順便帶杯飲料給你 🧋') : (m === 'elf' ? '很好，維持這樣 👍' : '那我去逛逛就好～😆') }])] }));
  });

  // 黑柴：牠去找人玩，或大家到窩邊摸牠
  const dogSpot = { book: 'desk', chart: 'byChart', stock: 'byStock', cash: 'byCash', elf: 'giveElf', fox: 'giveFox' };
  const dogName = { book: '小帳', chart: '小析', stock: '阿貨', cash: '阿庫', elf: '精靈', fox: '小狐狸' };
  const dogLine = id => id === 'book' ? '等一下！我在對帳…好啦摸一下就好 😣'
    : id === 'chart' ? (top ? `你看你看，${top.name}最多！…你聽不懂對吧 😂` : '乖～來，摸摸頭')
    : id === 'stock' ? (alert ? `${alert.name}${alert.text}…還好你的零食還有 🦴😮‍💨` : '來，給你零食！不要跟別人說 🦴')
    : id === 'cash' ? '不可以咬鈔票！那是我的命 😱'
    : id === 'elf' ? '黑柴過來～抱抱，今天的散步行程排好了 💕' : '黑柴！我們去冒險吧！🐾✨';
  Object.keys(dogSpot).forEach(id => {
    add('dog-' + id, ['dog', id], () => ({ dog: [talk(dogSpot[id], `跑去找${dogName[id]}玩`, `找${dogName[id]}玩`, [
      { who: 'dog', text: pick(['汪！（尾巴狂搖）', '（盯——）汪？', '汪汪！陪我玩！']) },
      { who: id, text: dogLine(id), pet: true, emoji: id === 'stock' ? '🦴' : '' },
      { who: 'dog', text: pick(['汪汪汪！（瘋狂轉圈）🌀', '汪 ♪（蹭蹭）', '嗷嗚～ 💕']), emoji: '💕' }])] }));
    add(id + '-dog', [id, 'dog'], () => ({ [id]: [talk('byDog', '去窩邊找黑柴', '在窩邊摸黑柴', [
      { who: id, text: pick(['黑柴～來摸摸！', '黑柴，今天乖不乖？', '我需要黑柴充電 🔋']), pet: true },
      { who: 'dog', text: pick(['汪 ♪（搖尾巴）', '汪！（翻肚子）', '嗷嗚～（瞇眼）']), emoji: '💕' },
      { who: id, text: pick(['好療癒…不想回去工作了 🥹', '毛茸茸的…滿血復活！', '真乖，晚點再來找你 💕']) }])] }));
  });

  // 這個月花比較快：阿庫去找小析確認
  if (d.pace && d.pace.fast) add('pace', ['cash', 'chart'], () => ({ cash: [talk('byChart', '衝去找小析', '跟小析確認支出', [
    { who: 'cash', text: '小析！這個月是不是花太快了？我的心臟受不了 😱' },
    { who: 'chart', text: `比上個月同期多 ${d.pace.pct}%…曲線往上衝了，我不敢看 📈💦` },
    { who: 'cash', text: '我要去跟精靈報告，精靈一定有對策！🏃💨' }])] }));

  // 一起喝茶：兩位員工各自走到茶水間，都到了才開始聊
  const staffLine = id => id === 'book' ? (d.todayCount ? `今天記了 ${d.todayCount} 筆，手好痠…但很爽 ✍️` : '今天都沒新帳…好不習慣 😶')
    : id === 'chart' ? (top ? `${top.name}還是最多…我晚上都夢到它 📈` : '沒資料可以畫…我好空虛 😢')
    : id === 'stock' ? (d.alerts.length ? `還有 ${d.alerts.length} 項要補…我茶都喝不下 😣` : '貨架滿滿～這杯茶好好喝 ✨')
    : (d.mood === 'happy' ? `小豬 ${pct}%，錢錢都在，好幸福 💰` : `小豬只剩 ${pct}%…茶好苦 🥲`);
  [pick([['book', 'cash'], ['chart', 'stock'], ['book', 'stock'], ['chart', 'cash']])].forEach(([a, b]) => {
    add('tea-' + a + '-' + b, [a, b], () => ({
      [a]: [talk('tea', '約同事去茶水間', '在茶水間聊天', [
        { who: a, text: pick(['累死了…喝杯茶吧 ☕', '休息一下！我要糖分 🍪']) },
        { who: b, text: staffLine(b) },
        { who: a, text: staffLine(a) },
        { who: b, text: pick(['好，回去繼續拚 💪', '再五分鐘…就五分鐘 😪']) }], { waitFor: b })],
      [b]: [{ spot: 'tea2', go: '一起去茶水間', at: '在茶水間聊天', stay: 4 * 2100 + 1600, waitFor: a }],
    }));
  });

  // 沙發聊天：精靈愛規劃、小狐狸愛玩又會安慰人
  if (free('elf') && free('fox')) {
    const oe = d.owners['精靈'], of = d.owners['小狐狸'];
    const chats = [[
      { who: 'elf', text: `這個月我花 ${fmt(oe.expense)}，你 ${fmt(of.expense)}，我做了比較表 📊` },
      { who: 'fox', text: of.expense > oe.expense ? '嘿嘿…我比較多，因為我比較會享受生活嘛 😜' : '哇我比較少！快誇我快誇我 🥳' },
      { who: 'elf', text: of.expense > oe.expense ? '……下個月我幫你排預算 😑' : '很好，繼續保持 👍', heart: true }], [
      { who: 'elf', text: '下個月的預算我排好了，有三個版本 📋' },
      { who: 'fox', text: '哇你好可靠！那我負責找好吃的餐廳 😋' },
      { who: 'elf', text: '……好，但要在預算內喔（堅持）', heart: true }], [
      { who: 'fox', text: '週末去哪裡玩？我想去海邊！🏖️' },
      { who: 'elf', text: '等我查一下天氣、交通、預算，還有備案 🗂️' },
      { who: 'fox', text: '你好認真喔哈哈，最喜歡你了 💕', heart: true }]];
    if (d.mood !== 'happy' || (d.pace && d.pace.fast)) chats.push([
      { who: 'elf', text: '這個月超出預算了…是不是我哪裡沒算好 😣' },
      { who: 'fox', text: '才不是！你已經很努力了，抱抱 🤗', lean: true, burst: true },
      { who: 'elf', text: '……嗯，下個月我會準備得更好 💪' },
      { who: 'fox', text: '我們一起！我少喝兩杯手搖 🧋💦' }]);
    if (latest) chats.push([
      { who: 'fox', text: `「${latest.item}」記了嗎？我好像忘了 🙈` },
      { who: 'elf', text: '記了。順便幫你把上週漏的也補了 📋' },
      { who: 'fox', text: '你是天使嗎 😭💕', heart: true }]);
    if (alert) chats.push([
      { who: 'elf', text: `${alert.name}${alert.text}，週六上午十點去買，路線我查好了 🗺️` },
      { who: 'fox', text: '好耶～順便去吃早午餐！🥞', heart: true }]);
    // 晚上：沙發上的悄悄話
    const nightChats = [[
      { who: 'elf', text: '（夢話）預算…還有第三個版本…💤' },
      { who: 'fox', text: '（小聲）辛苦了，晚安 💕', heart: true }], [
      { who: 'fox', text: '（夢話）好吃…再一口…💤' },
      { who: 'elf', text: '（小聲）明天帶你去吃，晚安 🌙', heart: true }]];
    list.push({ key: 'sofa', ids: ['elf', 'fox'], sofa: () => pick(officePhase === 'night' ? nightChats : chats) });

    // 愛的互動：小狐狸比較主動、情緒外放；精靈比較害羞
    const nm = id => id === 'elf' ? '精靈' : '小狐狸';
    list.push({ key: 'love-kiss', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: 'fox', text: '精靈～～～ 🥰' },
      { who: 'elf', text: '……幹嘛，我在算帳' },
      { who: 'fox', text: '啾 😘', lean: true, burst: true },
      { who: 'elf', text: pick(['（臉紅）……我也愛你 💕', '……再一個', '討厭啦，帳都算錯了 😳']), burst: true }], [
      { who: 'elf', text: '今天也辛苦了' },
      { who: 'fox', text: '你才辛苦！親一個 😘😘', lean: true, burst: true },
      { who: 'elf', text: '……最喜歡你了 💖', burst: true }]]) });
  }
  if (free('elf') && free('fox')) {
    const nm = id => id === 'elf' ? '精靈' : '小狐狸';
    const mover = Math.random() < 0.7 ? 'fox' : 'elf', other = mover === 'elf' ? 'fox' : 'elf';
    add('love-hug', ['elf', 'fox'], () => ({ [mover]: [talk(mover === 'elf' ? 'hugFox' : 'hugElf', mover === 'fox' ? '蹦蹦跳跳跑去抱精靈' : '走去抱小狐狸', `抱抱${nm(other)}`, mover === 'fox' ? [
      { who: 'fox', text: pick(['抱抱抱抱！！🤗', '充電時間到～ 🔋', '突襲！！😆']) },
      { who: 'elf', text: pick(['……好啦，抱一下 😳', '（嘴上說不要，手卻抱緊）', '我計畫裡沒有這個…但可以 💕']), lean: true, burst: true },
      { who: 'fox', text: pick(['好溫暖～不想放開 🥹💕', '愛你愛你愛你 💗', '充飽電了！⚡']), burst: true }] : [
      { who: 'elf', text: '……我需要抱抱 🥺' },
      { who: 'fox', text: '來！抱緊緊～什麼事都會好起來的 🤗', lean: true, burst: true },
      { who: 'elf', text: '嗯……謝謝你 💕', burst: true }])] }));
  }
  // 隨機閒聊：隨機挑兩個有空的人（黑柴只當聽眾），開場的人走去對方身邊
  const talkers = ['book', 'chart', 'stock', 'cash', 'elf', 'fox'].filter(free);
  if (talkers.length >= 2) {
    const a = pick(talkers);
    const b = pick([...talkers.filter(x => x !== a), ...(free('dog') && Math.random() < 0.2 ? ['dog'] : [])]);
    const near = { book: 'desk', chart: 'byChart', stock: 'byStock', cash: 'byCash', elf: 'giveElf', fox: 'giveFox', dog: 'byDog' };
    const nm = { book: '小帳', chart: '小析', stock: '阿貨', cash: '阿庫', elf: '精靈', fox: '小狐狸', dog: '黑柴' };
    const lines = officeChatLines(a, b);
    add('chat-' + a + '-' + b, [a, b], () => ({ [a]: [talk(near[b], `去找${nm[b]}聊天`, `跟${nm[b]}閒聊`, lines, { follow: b })] }));
  }

  // ── 更多放閃 ──
  if (free('elf') && free('fox')) {
    // 晚上：睡夢中的放閃（眼睛閉著、說夢話，一樣會冒愛心和粉紅泡泡）
    if (officePhase === 'night') list.push({ key: 'love-night', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: 'fox', text: '（夢話）精靈…最喜歡你了… 💤💕', burst: true },
      { who: 'elf', text: '（睡夢中把小狐狸抱緊一點）', lean: true, burst: true }], [
      { who: 'elf', text: '（夢話）……預算…還有…你 💤' },
      { who: 'fox', text: '（睡夢中蹭了蹭）嘿嘿… 💕', lean: true, burst: true }], [
      { who: 'fox', text: '（翻身靠到精靈身上）💤', lean: true },
      { who: 'elf', text: '（迷迷糊糊）……晚安，小狐狸 💕', burst: true }], [
      { who: 'elf', text: '（夢話）明天…帶你去吃好料… 💤' },
      { who: 'fox', text: '（夢話）耶…最愛精靈了… 💤💗', lean: true, burst: true }]]) });
    // 沙發上：靠肩膀、互相誇、紀念日行事曆、比心
    list.push({ key: 'love-lean', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: 'fox', text: '（把頭靠在精靈肩膀上）好累喔～ 🥱', lean: true },
      { who: 'elf', text: '……靠著吧，我的行程表空出來了', burst: true },
      { who: 'fox', text: '嘿嘿，最喜歡這裡了 💕', burst: true }], [
      { who: 'elf', text: '（偷偷靠過去）……' , lean: true },
      { who: 'fox', text: '咦？精靈在撒嬌！！😳💕', burst: true },
      { who: 'elf', text: '……只是有點冷而已', burst: true }]]) });
    list.push({ key: 'love-praise', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: 'elf', text: '……你今天，很可愛' },
      { who: 'fox', text: '哇！！精靈誇我！！要截圖起來 😭📸', burst: true },
      { who: 'elf', text: '……我只是陳述事實 😳', heart: true }], [
      { who: 'fox', text: '精靈好聰明，什麼都規劃得好好的 🥰' },
      { who: 'elf', text: '……因為想跟你過好日子', burst: true },
      { who: 'fox', text: '嗚嗚我要哭了 😭💕', lean: true, burst: true }]]) });
    list.push({ key: 'love-plan', ids: ['elf', 'fox'], sofa: () => pick([[
      { who: 'elf', text: '我把我們的紀念日都排進行事曆了 📅' },
      { who: 'fox', text: '連這個都有排？你也太浪漫了吧 🥹💕', burst: true },
      { who: 'elf', text: '還有提醒，提前三天、一天、當天各一次 ⏰', heart: true }], [
      { who: 'fox', text: '我們以後要去好多地方玩！🌏✈️' },
      { who: 'elf', text: '旅遊基金的試算表我已經開好了 📊' },
      { who: 'fox', text: '這就是我愛你的原因 💕', lean: true, burst: true }]]) });
    list.push({ key: 'love-heart', ids: ['elf', 'fox'], sofa: () => [
      { who: 'fox', text: '精靈～看這裡！🫶' },
      { who: 'elf', text: '……（默默比了一半的心）🫶', lean: true, burst: true },
      { who: 'fox', text: '合起來就是一顆完整的愛心了！💖', burst: true }] });
  }
  // 走去拿點心餵對方、幫對方買飲料
  add('love-feed', ['fox', 'elf'], () => ({ fox: [
    { spot: 'tea', go: '偷偷溜去茶水間 🍰', at: '挑精靈喜歡的口味…', stay: 2600 },
    talk('hugElf', '拿著點心跑去找精靈', '餵精靈吃點心', [
      { who: 'fox', text: '精靈～啊～張嘴 🍰' },
      { who: 'elf', text: '……（被餵）……好吃 😳', lean: true, burst: true },
      { who: 'fox', text: '嘿嘿，我挑的最好吃吧 😆💕', burst: true }], { follow: 'elf' })] }));
  add('love-gift', ['elf', 'fox'], () => ({ elf: [
    { spot: 'tea', go: '走去茶水間', at: '照著備忘錄調飲料…', stay: 2600 },
    talk('hugFox', '端著飲料走去找小狐狸', '送飲料給小狐狸', [
      { who: 'elf', text: '你的半糖去冰，照你的習慣 🧋' },
      { who: 'fox', text: '你記得我的甜度！！😭💕', lean: true, burst: true },
      { who: 'elf', text: '……你的資料我都記著 📋', burst: true }], { follow: 'fox' })] }));
  // 一起去茶水間約會（兩人都到了才開始）
  add('love-date', ['fox', 'elf'], () => ({
    fox: [talk('tea', '牽著精靈去茶水間 💕', '茶水間約會中', [
      { who: 'fox', text: '約會時間～ ☕💕' },
      { who: 'elf', text: '……十分鐘，我排好了 ⏰' },
      { who: 'fox', text: '十分鐘也好，只要跟你一起 🥰', burst: true },
      { who: 'elf', text: '（臉紅）……那十五分鐘好了', burst: true }], { waitFor: 'elf' })],
    elf: [{ spot: 'tea2', go: '被小狐狸牽去茶水間', at: '茶水間約會中', stay: 4 * 2100 + 1600, waitFor: 'fox' }],
  }));
  return list;
}

// ── 隨機閒聊：隨機兩個人、隨機話題，每個人照自己的個性回答 ──
// open：開場白（可以是函式，拿到當下的情境）；reply：每個人的回答；end：開場的人最後回一句
function officeChatTopics() {
  const now = new Date(), m = now.getMonth() + 1, wd = now.getDay();
  const weather = m === 12 || m <= 2 ? '最近好冷喔 🥶' : (m >= 6 && m <= 9 ? '最近好熱喔 🥵' : '最近天氣好舒服 🌤️');
  const topics = [
    { open: ['中午要吃什麼？🍱', '肚子好餓…等等吃什麼？🤤'], reply: {
        book: ['我帶了便當，每天同一款，很安心 🍱', '吃什麼都好，記得留收據給我 ✍️'],
        chart: ['我統計過，我們最常吃的是麵 📊', '根據數據，週間吃便當的機率是 68% 📈'],
        stock: ['冰箱的鮮奶快過期了，要不要先喝掉 😣', '倉庫還有泡麵…但我捨不得拿 😢'],
        cash: ['…自己帶便當最省 💰', '超過一百塊的我都不考慮 😤'],
        elf: ['我列了三間候選，評分和預算都比過了 📋', '照這週的菜單，今天是吃雞肉 📅'],
        fox: ['我知道一間新開的拉麵！走走走 🍜😆', '我想吃炸雞！還有珍奶！還有… 🤤'],
        dog: ['汪！（聽到吃就衝過來）', '（口水）汪汪！'] },
      end: ['聽起來不錯 😋', '好，那就這樣決定！', '…我更餓了 🤤'] },
    { open: ['週末要做什麼？', '這個週末有什麼計畫嗎？'], reply: {
        book: ['把這個月的帳再核對一次 ✍️', '在家整理收據，好療癒 🧾'],
        chart: ['在家畫圖表…是休閒活動喔 📊', '整理一下全年度的趨勢線 📈🥹'],
        stock: ['去賣場補貨！順便看看有沒有特價 🛒', '盤點倉庫…不然睡不著 😣'],
        cash: ['待在家，出門就要花錢 💰', '數錢，不用錢的娛樂 🥲'],
        elf: ['行程我排好了：上午採買、下午休息、晚上看電影 📋', '我做了一張週末計畫表，有 A、B 兩個版本 🗂️'],
        fox: ['去海邊！去吃好料！去探險！🏖️', '還沒想好，想到哪就去哪～ 😆'],
        dog: ['汪！（想去散步）🐾', '汪汪！（叼來牽繩）'] },
      end: ['好充實喔！', '聽起來很你 😂', '好羨慕～'] },
    { open: ['昨晚睡得好嗎？😪', '好睏…你昨天幾點睡？'], reply: {
        book: ['夢到帳沒對齊，嚇醒了 😱', '十點準時睡，作息很重要 ✍️'],
        chart: ['熬夜看數據到兩點…但很值得 📈🥹', '睡眠時數比上週少 12% 😵'],
        stock: ['夢到衛生紙用完了… 😰', '半夜起來確認倉庫有沒有鎖 😣'],
        cash: ['抱著存錢筒睡，很安心 🐷', '夢到錢錢都跑走了 😭'],
        elf: ['照睡眠計畫，睡滿七小時 😌', '睡前把明天的待辦都列好了，睡得很好 📋'],
        fox: ['追劇追到三點 🙈', '睡超好！還夢到吃大餐 🤤'],
        dog: ['汪…（打哈欠）😪', '（翻肚子繼續睡）💤'] },
      end: ['好好休息喔', '哈哈太好笑了', '我也是…😪'] },
    { open: [weather, `${m}月了欸，時間過好快`], reply: {
        book: ['天氣再怎樣，帳都要記 ✍️', '這個月的帳我已經記了一半了！'],
        chart: ['我把氣溫跟支出做了相關分析 📊', '天氣變化會影響飲料支出喔 📈'],
        stock: ['換季了，要不要先補點日用品…我好擔心 😣', '換季了，倉庫要重新整理 📦'],
        cash: ['冷氣電費…我不敢想 😱', '天氣怎樣都不要亂花錢 💰'],
        elf: ['我已經準備好換季衣物清單了 📋', '季節預算我有先抓好 👍'],
        fox: ['這種天氣最適合出去玩了！😆', '這種天氣最適合吃好料了 😋'],
        dog: ['汪！（想出去玩）', '汪汪～（在地上打滾）'] },
      end: ['真的！', '說得好有道理', '哈哈對啊～'] },
    { open: ['最近有在追什麼劇嗎？📺', '推薦我好看的劇！'], reply: {
        book: ['我在看記帳軟體的教學影片 🎬', '…紀錄片，關於會計的 ✍️'],
        chart: ['我在看數據視覺化的影片，超好看 📊🥹', '劇的評分我都做成圖表了 📈'],
        stock: ['在看整理收納節目，好紓壓 📦✨', '沒時間看…倉庫的事好多 😣'],
        cash: ['免費的才看 💰', '看別人省錢的影片 🥲'],
        elf: ['看之前會先查評分和集數，排好時間 📋', '一次只追一部，不然會亂 😌'],
        fox: ['我同時在追五部！停不下來 📺😆', '那部超好看！我跟你說，結局是… 🙊'],
        dog: ['汪？（看著電視歪頭）', '（跟著電視裡的狗一起叫）汪！'] },
      end: ['我也要去看！', '好喔～記下來 📝', '不要爆雷啦！😂'] },
    { open: ['要不要喝杯咖啡？☕', '我去泡茶，你要不要？🍵'], reply: {
        book: ['好，順便記一下咖啡錢 ✍️', '半杯就好，喝太多手會抖 😣'],
        chart: ['今天第三杯了…但數字還沒看完 ☕📈', '要！咖啡因是我的燃料 ⚡'],
        stock: ['咖啡豆快沒了…我記一下要補 😰', '好，順便清點茶包 📦'],
        cash: ['茶水間的免費喝 💰', '自己泡的才划算 😤'],
        elf: ['好，十分鐘後，我先把這段做完 ⏰', '一杯就好，我有控制咖啡因攝取量 📋'],
        fox: ['要！我要加奶加糖加奶泡！😋', '走走走～順便吃點心 🍰'],
        dog: ['汪！（以為有零食）', '（跟著走過來）汪？'] },
      end: ['走吧～', '好，等你喔！', '我幫你倒 ☕'] },
    { open: ['如果中樂透，你要幹嘛？💸', '如果有一百萬，你想怎麼用？'], reply: {
        book: ['每一筆都要記清楚，大概要記一整年 ✍️😵', '先開一本新帳本 📒'],
        chart: ['做一張超大的資產配置圖 📊✨', '分析一下它對我們資產曲線的影響 📈🥹'],
        stock: ['把倉庫塞滿！再也不怕缺貨 📦✨', '買一年份的衛生紙 🧻'],
        cash: ['全部存進小豬，一毛都不花 🐷💰', '…我會緊張到睡不著 😭'],
        elf: ['先還房貸，剩下分成緊急預備金、投資、旅遊基金 📋', '照我的資產配置表分配，已經做好了 📊'],
        fox: ['環遊世界！吃遍各國美食！✈️🍣', '先買一台超大的電視追劇 📺😆'],
        dog: ['汪！（想要一屋子的零食）🦴', '汪汪！（要一個超大的窩）'] },
      end: ['好有你的風格 😂', '夢想很重要！', '先記得買彩券啦 🤣'] },
    { open: ['最近有在運動嗎？🏃', '我最近想開始運動…'], reply: {
        book: ['每天走去記帳桌算嗎 ✍️😅', '有，伏地挺身做三組 💪'],
        chart: ['我記錄每天的步數，畫成折線圖 📈', '手指運動：一直滑數據 📊'],
        stock: ['搬貨就是重訓 📦💪', '在倉庫跑來跑去，一天一萬步 🏃'],
        cash: ['健身房要錢…我在家做 💰', '數錢也算手部運動 🥲'],
        elf: ['我排了每週三次的訓練計畫 📋💪', '照計畫來，不會偷懶 😤'],
        fox: ['我喜歡出去走走看風景！順便吃東西 😆', '跳舞！一邊聽音樂一邊跳 💃'],
        dog: ['汪！（要出去跑）🐾', '汪汪汪！（瘋狂轉圈）🌀'] },
      end: ['一起加油 💪', '好健康！', '我明天…一定開始 😅'] },
    { open: ['你今天看起來精神很好欸！✨', '你今天好像心情很好？'], reply: {
        book: ['因為今天的帳全部對齊了 😤✨', '剛核對完，好有成就感 ✍️'],
        chart: ['今天的曲線很漂亮，心情很好 📈🥹', '數據說我今天很開心 📊'],
        stock: ['貨架滿滿的，好有安全感 ✨', '真的嗎？我還以為我很慌 😅'],
        cash: ['今天沒有人來領錢 💰😌', '小豬很圓，我就很開心 🐷'],
        elf: ['照計畫完成了今天的待辦 ✅', '……謝謝，我只是睡得比較飽 😳'],
        fox: ['因為等等要去吃好料！😆', '因為今天精靈對我笑了 🥰'],
        dog: ['汪汪！（尾巴狂搖）', '汪！（蹭過來）💕'] },
      end: ['真好～', '繼續保持！', '被你的好心情感染了 😊'] },
    { open: ['最近有想買什麼嗎？🛍️', '有什麼東西想買？'], reply: {
        book: ['一本新的帳本，要有格線的 📒', '…一支好寫的筆 ✍️'],
        chart: ['一台更大的螢幕，可以看更多圖表 🖥️✨', '一本統計學的書 📚'],
        stock: ['更多收納箱！📦', '一台標籤機，倉庫要更整齊 🏷️'],
        cash: ['…什麼都不想買 💰', '一個更大的存錢筒 🐷'],
        elf: ['在願望清單裡，等特價再買 📋', '我先比價三家，再決定 🧐'],
        fox: ['好多！衣服、包包、零食、遊戲… 🛍️😆', '一張機票，說走就走 ✈️'],
        dog: ['汪！（叼來玩具）🧸', '汪汪！（想要新的骨頭）🦴'] },
      end: ['好實用！', '先記在願望清單 📝', '哈哈好你'] },
  ];
  if (wd === 5) topics.push({ open: ['終於星期五了！🎉', '明天放假耶！'], reply: {
      book: ['週末前把帳都記完 ✍️', '太好了，可以整理收據了 🧾'],
      chart: ['這週的支出我做成週報了 📊', '週末可以好好看數據了 🥹'],
      stock: ['週末要記得去補貨！😣', '耶！可以去賣場了 🛒'],
      cash: ['週末不要亂花錢喔…拜託 🙏', '放假…花錢的危險日 😰'],
      elf: ['週末行程表已經更新了 📋', '我排好了，要不要看一下？'],
      fox: ['週末要去哪裡玩～～ 😆🎉', '放假萬歲！！🙌'],
      dog: ['汪汪！（可以出去玩了）', '汪！🐾'] },
    end: ['週末快樂！', '耶～', '辛苦了一週 💪'] });
  if (wd === 1) topics.push({ open: ['星期一…好想放假 😩', '又是星期一了…'], reply: {
      book: ['週末的帳要補記了… ✍️😵', '新的一週，新的帳本頁 📒'],
      chart: ['週一的數據最好看了 📈', '我做了上週的回顧圖 📊'],
      stock: ['週一要盤點… 😣', '週末用掉好多東西 📦'],
      cash: ['週末花了多少…我不敢看 😱', '新的一週要省錢！💰'],
      elf: ['這週的計畫我已經排好了 📋', '一步一步來，沒問題 👍'],
      fox: ['再過五天就放假了！撐住！😆', '週一也要開開心心的～'],
      dog: ['汪…（還想睡）😪', '汪！'] },
    end: ['一起撐過去 💪', '加油！', '咖啡救我 ☕'] });
  return topics;
}

function officeChatLines(a, b) {
  const topics = officeChatTopics();
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const t = pick(topics);
  const lines = [
    { who: a, text: pick(t.open) },
    { who: b, text: pick(t.reply[b]) },
    { who: a, text: pick(t.end) },
  ];
  // 有時候再多聊一句（開場的人也講自己的答案）
  if (Math.random() < 0.5 && b !== 'dog') lines.push({ who: a, text: pick(t.reply[a] || t.end) });
  return lines;
}

function officeStartSkit(d, ts) {
  let list = officeSkits(d);
  if (list.length > 1) list = list.filter(k => k.key !== officeSkitLast);
  if (!list.length) return false;
  // 晚上：大家在睡覺，只剩沙發上的悄悄話
  if (officePhase === 'night') {
    list = list.filter(k => k.key === 'love-night' || k.key === 'sofa');
    if (!list.length || Math.random() < 0.5) return false;
  }
  // 花太快時，優先演提醒的那一段
  const paceSkit = list.find(k => k.key === 'pace');
  if (paceSkit && Math.random() < 0.4) list = [paceSkit];
  // 精靈和小狐狸都有空時，一半以上的機會是放閃
  const chat = list.find(k => k.key.startsWith('chat-'));
  if (chat && Math.random() < 0.3) list = [chat];
  const love = list.filter(k => k.key.startsWith('love'));
  if (love.length && Math.random() < 0.55) list = love;   // 常常放閃
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
  if (!income && amount >= OFFICE_BIG && officeOnce('big:' + String(data.item || '') + ':' + amount)) officeQueueWow(data.item, amount);
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
    book: ['不要戳我！我在對帳啦 😣', '嗨…這筆…等我一下 ✍️', '今天記帳了嗎？沒記我會睡不著 😰'],
    chart: ['要看圖表嗎！要嗎要嗎！📊✨', '數字是世界上最美的東西 🥹', '嘿嘿～被你發現我在偷看曲線 📈'],
    stock: ['哇！嚇我一跳 😱', '衛生紙…還夠嗎？還夠吧？😣', '倉庫交給我！應該…吧 😅'],
    cash: ['錢錢都在！不准碰 😤', '你…不是要來領錢的吧？👀', '每月的愛什麼時候來…🥺'],
    elf: ['嗯？我在排預算 📋', '等一下，這張表還差一欄', '……戳我幹嘛 😳'],
    fox: ['嘿嘿～抓到你了 😜', '要不要一起去吃好料！🍜', '精靈今天是不是超可愛 🥰'],
    dog: ['汪！（尾巴狂搖）', '汪汪！有零食嗎？👀', '嗷嗚～（翻肚子）'],
  };
  const sleepLine = { elf: '（揉眼睛）……預算嗎？明天再說 😪', fox: '嗯……再睡五分鐘嘛 😪', dog: '（打哈欠）嗚…' }[id] || '（揉眼睛）嗯…？ 😪';
  officeSay(id, sleepy ? sleepLine : pick(lines[id] || ['嗨～']));
  if (id === 'dog') {
    officePet();
    officeFloat('🐾', false, { x: a.x, y: a.y - 75 });
  }
  if (id === 'elf' || id === 'fox') officeFloat('💗', false, { x: a.x, y: a.y - 75 });
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

// 從某個位置噴出一把圖示（升級彩帶等）
function officeBurst(cx, cy, icons, n) {
  const scene = document.getElementById('office-scene');
  if (!scene || officePaused) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'of-love';
    el.textContent = icons[i % icons.length];
    el.style.left = ((cx + (Math.random() - 0.5) * 300) / 10).toFixed(2) + '%';
    el.style.top = (cy / 13).toFixed(2) + '%';
    el.style.zIndex = '4100';
    el.style.setProperty('--dx', ((Math.random() - 0.5) * 30).toFixed(1) + 'cqw');
    el.style.setProperty('--dy', (-(10 + Math.random() * 25)).toFixed(1) + 'cqw');
    el.style.setProperty('--s', (0.9 + Math.random() * 0.8).toFixed(2));
    el.style.animationDelay = (i * 0.05).toFixed(2) + 's';
    scene.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

// 從兩人中間冒出愛心和粉紅泡泡
function officeLoveBurst(count = 12) {
  const scene = document.getElementById('office-scene');
  if (!scene || officePaused) return;
  const e = officeActors.elf, f = officeActors.fox;
  const cx = (e.x + f.x) / 2, cy = Math.min(e.y, f.y) - 80;
  const hearts = ['💗', '💕', '💖', '💞', '❤️'];
  for (let i = 0; i < count; i++) {
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
      if (l.emoji) officeFloat(l.emoji, false, { x: o.x, y: o.y - 75 });
      if (l.pet) officePet();
      if (l.lean) officeLean(2600 + 2100);
      if (l.burst) officeLoveBurst();
      if (l.heart) officeFloat('💕', false, { x: (officeActors.elf.x + officeActors.fox.x) / 2, y: officeActors.elf.y - 75 });
    }, i * 2100));
    // 精靈和小狐狸放閃完，旁邊有人被閃到
    const lines = st.lines || [];
    const couple = lines.some(l => l.burst) && lines.every(l => l.who === 'elf' || l.who === 'fox');
    if (couple && officePhase !== 'night' && Math.random() < 0.7) {
      setTimeout(() => {
        const pool = ['book', 'chart', 'stock', 'cash', 'dog'].filter(id => officeActors[id] && officeActors[id].state !== 'walk' && !officeActors[id].job);
        if (!pool.length || !officeVisible()) return;
        const id = pool[Math.floor(Math.random() * pool.length)];
        const say = {
          book: ['又在放閃了…我帳都記歪了 🙈', '請不要在辦公室放閃 😑✍️'],
          chart: ['放閃指數突破新高 📈💕', '這條曲線…是戀愛的形狀 🥹'],
          stock: ['好閃！我要去倉庫拿墨鏡 😎', '閃到我眼睛了啦 😵‍💫'],
          cash: ['放閃不用錢…這是好事 💰', '單身的我在旁邊默默數錢 🥲'],
          dog: ['汪…（被閃到，躲回窩裡）🙈', '汪汪！（也想要抱抱）🥺'],
        }[id];
        officeSay(id, say[Math.floor(Math.random() * say.length)]);
      }, lines.length * 2100 + 600);
    }
    return;
  }
  if (st.fx === 'wow') { const sp = OFFICE_SPOTS[st.spot]; officeFloat('💸', false, { x: sp.x, y: sp.y - 75 }); return; }
  if (st.fx === 'mail') { officeFloat('💌', false, OFFICE_SPOTS.mail); return; }
  if (st.fx === 'loveIn') {
    officeFloat('+' + fmt(st.amount), true);
    setTimeout(() => officeSay('cash', '我愛每月的愛！！😭💕'), 1500);
    return;
  }
  if (st.fx === 'pick') { officeFloat('📦', false, OFFICE_SPOTS.shelf); return; }
  if (st.fx === 'trash') { officeFloat('🗑️', false, OFFICE_SPOTS.trash); return; }
  if (st.fx === 'settleOut') { officeFloat('−' + fmt(st.amount), false); return; }
  if (st.fx === 'give') {
    const to = officeActors[st.to];
    setTimeout(() => {
      officeFloat('+' + fmt(st.amount), true, to);
      setTimeout(() => { if (to.state !== 'walk') officeWakeSay(st.to, st.to === 'elf' ? `收到 ${fmt(st.amount)}，我照計畫分配好 📋` : `耶～${fmt(st.amount)}！可以去吃好料了 🤤`); }, 1300);
    }, 600);
    return;
  }
  if (st.fx === 'book') {
    setTimeout(() => { if (officeActors.book.state !== 'walk') officeWakeSay('book', ['收到！一筆一筆…都對齊了 ✍️✨', '記好了！分毫不差 😤', '登記完成，好舒服 ✍️'][Math.floor(Math.random() * 3)]); }, 1400);
  } else {
    officeFloat((j.income ? '+' : '−') + fmt(j.amount), j.income);
    setTimeout(() => { if (officeActors.cash.state !== 'walk') officeWakeSay('cash', j.income ? ['進帳了！！快進來 😭💕', '錢錢回家了～✨'][Math.floor(Math.random() * 2)] : ['嗚…錢錢慢走 💸', '又要出去了…我的心 🩸', '好啦…出帳確認 😢'][Math.floor(Math.random() * 3)]); }, 1400);
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
  officeInfo_ = officeLevelInfo();
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
  const lvEl = document.getElementById('office-level');
  const info = officeInfo_;
  if (lvEl) {
    lvEl.hidden = !info;
    if (info) {
      const next = info.next ? `再記 ${info.next.at - info.total} 筆解鎖${info.next.name}` : '家具都解鎖了 🎉';
      const cup = officeCup(info.streak);
      lvEl.innerHTML = `<b>🏢 Lv.${info.level + 1}</b><span>累積 ${info.total} 筆</span><span>${cup ? cup.icon : '🔥'} 連續 ${info.streak} 天</span>`
        + (info.medals.length ? `<span>🏅 獎章 ${info.medals.length}</span>` : '')
        + `<span>🌱 第 ${info.months} 個月</span><span class="of-level-next">${next}・點我看成就</span>`;
    }
  }
  officeCheckLevelUp(info);
  officeCheckPromo(info);
  officeCheckParty(info);
  const pause = document.getElementById('office-pause');
  if (pause) pause.textContent = officePaused ? '繼續' : '暫停';

  const detail = document.getElementById('office-detail');
  if (detail) {
    detail.hidden = !officeSelected;
    detail.innerHTML = !officeSelected ? ''
      : officeSelected === 'level' ? officeAchievementsHtml(officeInfo_)
      : officeSelected === 'dog' ? `<h4>🐕 黑柴 <small>吉祥物</small></h4>
          <div class="of-row"><span>現在</span><b>${esc(officeActivity('dog', d))}</b></div>
          <div class="of-row"><span>累積被摸</span><b>${officeDogPets} 次</b></div>
          <p class="of-note">黑柴會在辦公室巡邏、找大家玩，大家有空也會去窩邊摸牠。</p>`
      : (officeSelected === 'elf' || officeSelected === 'fox' ? officeMemberDetail(officeSelected, d) : officeDetailHtml(OFFICE_DETAIL_KEY[officeSelected], d));
    if (OFFICE_PERSONA[officeSelected]) detail.innerHTML = detail.innerHTML.replace('</h4>', `</h4><p class="of-persona">💭 ${OFFICE_PERSONA[officeSelected]}</p>`);
  }

  const list = document.getElementById('office-list');
  if (list) {
    const cards = [...OFFICE_STAFF.slice(0, 4), { id: 'piggy', name: '小豬', role: '存錢', tag: 'piggy' }, ...OFFICE_STAFF.slice(4)];
    list.innerHTML = cards.map(s => {
      const [label, num] = officeMetric(s.id, d);
      const act = s.id === 'piggy'
        ? (d.mood === 'cry' ? `透支 ${fmt(-d.balance)}…肚子空空，你們不愛我了嗎 😭` : (d.mood === 'worry' ? `剩 ${fmt(d.balance)}…金幣變少了，嗚嗚 🥺` : `${fmt(d.balance)}！我好圓！好有錢！哼哼 ✨`))
        : officeActivity(s.id, d);
      const ava = s.id === 'piggy' ? '<span class="of-ava of-ava-pig">🐷</span>' : `<span class="of-ava">${officeActorSvg(s.id)}</span>`;
      const rk = officeRankOf(s.id, officeInfo_);
      const role = rk ? rk.title : s.role;
      return `<button type="button" class="of-card${officeSelected === s.id ? ' selected' : ''}" data-office-id="${s.id}">
        ${ava}
        <span class="of-card-main"><span class="of-card-top"><b>${s.name}</b><em class="of-tag tag-${s.tag}">${role}</em></span>
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
  // 上方空間不夠（例如小帳坐在最上面，對話框又比較長）：改顯示在角色下方
  el.classList.remove('below');
  const actor = el.parentElement;
  const space = actor.getBoundingClientRect().top - scene.getBoundingClientRect().top;
  if (el.offsetHeight + W * 0.032 + 4 > space) el.classList.add('below');
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
  // 有人在茶水間（站著）：咖啡機開始沖泡
  const brewing = Object.values(officeActors).some(a => a.state === 'visit' && (a.spot === 'tea' || a.spot === 'tea2'));
  const sceneEl = document.getElementById('office-scene');
  if (sceneEl && sceneEl.classList.contains('brewing') !== brewing) sceneEl.classList.toggle('brewing', brewing);
  const walking = Object.values(officeActors).filter(a => a.state === 'walk').length;
  let canStart = walking < 3;

  // 月底結算進行中（或排隊中）：精靈和小狐狸回沙發坐好等阿庫送錢來
  const settleOn = officeJobs.cash.some(j => j.type === 'settle') || !!(officeActors.cash.job && officeActors.cash.job.rec.type === 'settle');
  const membersSeated = officeActors.elf.state === 'seat' && officeActors.fox.state === 'seat';

  OFFICE_STAFF.forEach(s => {
    const a = officeActors[s.id];
    const el = document.querySelector(`.of-actor[data-office-id="${s.id}"]`);
    const member = s.id === 'elf' || s.id === 'fox';
    const q = officeJobs[s.id];
    const ready = !!(q && q.length);
    if (a.waiting && a.job && a.state === 'visit') {
      const st = a.job.steps[a.job.i], o = officeActors[st.waitFor];
      if (o && o.state === 'visit' && o.job && o.job.rec.sid === a.job.rec.sid) {
        a.waiting = false; a.until = ts + st.stay;
        officeJobFx(a.job);
      }
    }
    if (a.state === 'walk' && !a.job && ready && q[0].type !== 'skit') {
      // 走到一半收到跑腿：不用先走回座位，直接從這裡出發
      const rec = q.shift(), steps = officeJobSteps(rec);
      if (steps.length) { a.job = { rec, i: 0, steps }; officeGoStep(a, s, ts, d); changed = true; }
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
      // 走到了，但要找的人已經走開：追過去（最多追三次）
      if (!a.path.length && a.job && !a.back) {
        const st = a.job.steps[a.job.i], t = st.follow && officeActors[st.follow];
        if (t && Math.hypot(t.x - a.x, t.y - a.y) > 120 && a.chase < 3) {
          a.chase++;
          a.zone = officeZoneAt(a.x, a.y);
          a.target = officeStepTarget(a, st);
          a.path = officePath(a, a.zone, a.target, a.target.zone);
          officeHoldFor(st, ts, 20000);
        }
      }
      if (!a.path.length) {
        if (a.back) {
          a.state = 'seat'; a.zone = s.seat.zone; a.spot = null; a.back = false; a.face = 1; a.until = ts + (9000 + Math.random() * 12000) * (s.rest || 1);   // 小狐狸坐不住、小帳很少離開座位
          if (el && night) el.classList.add('sleeping');
        }
        else {
          a.state = 'visit';
          a.zone = a.target ? a.target.zone : (OFFICE_SPOTS[a.spot] ? OFFICE_SPOTS[a.spot].zone : officeZoneAt(a.x, a.y));
          a.until = ts + (a.job ? a.job.steps[a.job.i].stay : 3500 + Math.random() * 3000);
          if (a.job) {
            const st = a.job.steps[a.job.i];
            officeHoldFor(st, ts, st.stay + 1500);
            // 面向對方
            const t = st.follow && officeActors[st.follow];
            if (t) a.face = t.x < a.x ? -1 : 1;
          }
        }
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
          if (a.job.rec.type === 'settle') setTimeout(() => officeSay(s.id, '月底結算完成…錢錢們要好好的 🥲'), 0);
          if (a.job.rec.type === 'love') setTimeout(() => officeSay(s.id, '每月的愛存好了，好幸福 💰🥹'), 0);
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
        officeGoStep(a, s, ts, d);
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
        a.target = spot;
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
  // 精靈和小狐狸都坐在沙發上時，偶爾冒出一顆小愛心
  if (ts >= officeAmbientAt) {
    officeAmbientAt = ts + 14000 + Math.random() * 10000;
    const e = officeActors.elf, f = officeActors.fox;
    if (e.state === 'seat' && f.state === 'seat' && !e.job && !f.job && !officePaused && officePhase === 'night' && Math.random() < 0.4) officeLoveBurst(5);   // 睡在一起：飄出一小串粉紅泡泡
    else if (e.state === 'seat' && f.state === 'seat' && !e.job && !f.job && !officePaused) officeFloat(Math.random() < 0.5 ? '💕' : '💗', false, { x: (e.x + f.x) / 2, y: e.y - 75 });
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
    ids.forEach(id => officeJobs[id].push({ type: 'meeting', steps: [{ spot: 'meet_' + id, fx: 'meet', stay: 600000, go: id === 'chart' ? '開會囉！大家到白板集合 📋' : '去白板前開月會', at: '開月會中 📋', quiet: id !== 'chart' }] }));
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
  officeLoadStats();
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
  if (e.target.closest('#office-level')) {
    officeSelected = officeSelected === 'level' ? null : 'level';
    drawOffice();
    const detail = document.getElementById('office-detail');
    if (officeSelected && detail) detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
