// ── 辦公室：把共同帳戶的幾種「工作」畫成一個小場景（資料全部來自目前月份的紀錄與庫存）──
// 角色：記帳員（記帳桌）、出納（金庫）、存錢筒、倉管貨架、分析白板
// 這個檔案只讀取 app.js 的資料與函式，不會寫入任何東西。

const OFFICE_ROLE_KEY = 'shareExpense.office.roles';      // 'elf'：精靈當記帳員；'fox'：小狐狸當記帳員
const OFFICE_SEEN_PREFIX = 'shareExpense.office.seen:';   // 每個月份上次來訪時的紀錄筆數
let officeBubbleTimer = null;
let officeBubbleIndex = 0;
let officeSelected = null;          // 目前點開的站別
let officeInvRequested = false;     // 這次開啟是否已經更新過庫存
const officeNewCount = {};          // sheet -> 這次來訪時比上次多了幾筆

function officeVisible() {
  const tab = document.getElementById('tab-office');
  return !!tab && tab.style.display !== 'none';
}

function officeBookkeeper() {
  try { return localStorage.getItem(OFFICE_ROLE_KEY) === 'fox' ? 'fox' : 'elf'; } catch (e) { return 'elf'; }
}

function officeSwapRoles() {
  try { localStorage.setItem(OFFICE_ROLE_KEY, officeBookkeeper() === 'elf' ? 'fox' : 'elf'); } catch (e) { /* 存不了就只換這一次 */ }
  drawOffice();
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

  return { starting, income, arrived, expense, balance, pool, ratio, mood, entries, sorted, todayCount, love, settled, cats, items, alerts };
}

// ── 角色與物件的 SVG ──────────────────────────────────────────
function officeCharSvg(kind) {
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
  return `
    <g class="of-char of-elf">
      <ellipse cx="40" cy="70" rx="19" ry="16" fill="#eef9f6"/>
      <ellipse cx="40" cy="74" rx="10" ry="11" fill="#ffffff"/>
      <g class="of-head">
        <path d="M21 24 L17 5 L33 15 Z" fill="#eef9f6"/>
        <path d="M59 24 L63 5 L47 15 Z" fill="#eef9f6"/>
        <path d="M22.5 19 L20.5 10 L28 15 Z" fill="#ffc9d6"/>
        <path d="M57.5 19 L59.5 10 L52 15 Z" fill="#ffc9d6"/>
        <ellipse cx="40" cy="36" rx="22" ry="20" fill="#f7fdfb"/>
        <path d="M28 17 Q40 3 53 14 Q65 22 63 42 Q58 30 51 25 Q41 19 28 17 Z" fill="#6fd3e3"/>
        <path d="M33 15 Q41 8 49 13 Q43 13 38 18 Z" fill="#a6e8f2"/>
        <ellipse cx="40" cy="46" rx="12.5" ry="8.5" fill="#ffe6ee"/>
        <circle cx="30.5" cy="34.5" r="3.2" fill="#2f3b45"/><circle cx="31.6" cy="33.4" r="1.1" fill="#fff"/>
        <circle cx="49.5" cy="34.5" r="3.2" fill="#2f3b45"/><circle cx="50.6" cy="33.4" r="1.1" fill="#fff"/>
        <circle cx="36" cy="45" r="1.1" fill="#d98ca3"/><circle cx="44" cy="45" r="1.1" fill="#d98ca3"/>
        <path d="M36.5 49 Q40 51.6 43.5 49" fill="none" stroke="#b9728a" stroke-width="1.3" stroke-linecap="round"/>
        <ellipse cx="23" cy="41" rx="3.6" ry="2.2" fill="#ff9fb0" opacity="0.55"/>
        <ellipse cx="57" cy="41" rx="3.6" ry="2.2" fill="#ff9fb0" opacity="0.55"/>
        <path d="M40 21 l1.5 3.2 3.5 0.4 -2.6 2.4 0.7 3.4 -3.1 -1.8 -3.1 1.8 0.7 -3.4 -2.6 -2.4 3.5 -0.4 Z" fill="#ffd66b"/>
      </g>
    </g>`;
}

const OFFICE_FUR = { elf: '#eef9f6', fox: '#f4a261' };

// 記帳桌：角色坐在桌子後面；今天有記帳就寫字，沒有就喝茶
function officeDeskSvg(kind, writing) {
  const fur = OFFICE_FUR[kind];
  return `
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <ellipse cx="100" cy="146" rx="88" ry="5" fill="rgba(90,70,50,0.12)"/>
    <g transform="translate(50 -14) scale(1.25)">${officeCharSvg(kind)}</g>
    <rect x="24" y="100" width="152" height="44" rx="9" fill="#e3b98a"/>
    <rect x="34" y="110" width="56" height="26" rx="5" fill="#d6a875"/>
    <circle cx="62" cy="123" r="2.6" fill="#f6dcbb"/>
    <rect x="10" y="88" width="180" height="17" rx="8.5" fill="#f4d9b6"/>
    <rect x="10" y="98" width="180" height="7" rx="3.5" fill="#e8c69c"/>
    <!-- 帳本 -->
    <path d="M70 87 Q85 80 100 86 Q115 80 130 87 L130 73 Q115 67 100 73 Q85 67 70 73 Z" fill="#ffffff" stroke="#d9c7b0" stroke-width="1"/>
    <path d="M100 73 L100 86" stroke="#d9c7b0" stroke-width="1"/>
    <path d="M76 75.5 Q85 72.5 95 75.5 M76 79 Q85 76 95 79 M105 75.5 Q114 72.5 124 75.5" stroke="#9fd8cb" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path class="${writing ? 'of-ink' : ''}" d="M105 79 Q111 76.6 117 78.4" stroke="#f08fb0" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <!-- 筆筒與計算機 -->
    <rect x="150" y="72" width="16" height="17" rx="3" fill="#9fd8cb"/>
    <path d="M154 72 L152 61 M158 72 L158 59 M162 72 L165 62" stroke="#f08fb0" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="26" y="74" width="24" height="15" rx="3" fill="#bfe3f0"/>
    <rect x="29" y="77" width="18" height="4" rx="1.5" fill="#f7fdfb"/>
    <circle cx="31.5" cy="85" r="1.4" fill="#f7fdfb"/><circle cx="37.5" cy="85" r="1.4" fill="#f7fdfb"/><circle cx="43.5" cy="85" r="1.4" fill="#f7fdfb"/>
    ${writing ? `
    <g class="of-arm-write">
      <ellipse cx="118" cy="80" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>
      <path d="M121 78 L132 62" stroke="#ffb74d" stroke-width="3" stroke-linecap="round"/>
      <path d="M121 78 L119.6 80.2" stroke="#5b3a29" stroke-width="2" stroke-linecap="round"/>
    </g>
    <ellipse cx="82" cy="82" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>` : `
    <g class="of-sip">
      <rect x="111" y="70" width="15" height="13" rx="3.5" fill="#ffffff" stroke="#d9c7b0" stroke-width="1"/>
      <path d="M126 73 q6 0.5 5 5 q-1 3 -5 2.6" fill="none" stroke="#d9c7b0" stroke-width="1.6"/>
      <rect x="113" y="72" width="11" height="3.4" rx="1.7" fill="#c98b5e"/>
      <path class="of-steam" d="M116 66 q-3 -4 0 -8 M121 66 q3 -4 0 -8" fill="none" stroke="#c9b8a6" stroke-width="1.3" stroke-linecap="round"/>
    </g>
    <ellipse cx="82" cy="82" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>
    <ellipse cx="118" cy="84" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>`}
  </svg>`;
}

// 金庫：出納站在櫃台後面；信封代表兩人的「每月的愛」（已入帳會亮起來）
function officeVaultSvg(kind, d) {
  const fur = OFFICE_FUR[kind];
  const env = (x, person, color) => `
    <g transform="translate(${x} 28)"><g class="of-env ${person.arrived ? 'arrived' : ''}">
      <rect x="0" y="0" width="24" height="17" rx="3" fill="${person.arrived ? color : '#f1ece6'}" stroke="rgba(90,70,50,0.2)" stroke-width="0.8"/>
      <path d="M1 2 L12 10 L23 2" fill="none" stroke="rgba(90,70,50,0.25)" stroke-width="1"/>
      <path d="M12 8.2 c-2.4 -3.4 -6 -0.4 -3.4 2.2 l3.4 3 3.4 -3 c2.6 -2.6 -1 -5.6 -3.4 -2.2 Z" fill="${person.arrived ? '#ffffff' : '#d8cfc5'}"/>
    </g></g>`;
  return `
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <ellipse cx="100" cy="146" rx="88" ry="5" fill="rgba(90,70,50,0.12)"/>
    <!-- 金庫 -->
    <rect x="8" y="46" width="84" height="96" rx="12" fill="#a8d8cc"/>
    <rect x="16" y="54" width="68" height="80" rx="8" fill="#c4e8de"/>
    <circle cx="50" cy="94" r="19" fill="#f7fdfb" stroke="#8cc7b9" stroke-width="2"/>
    <g class="of-dial"><path d="M50 79 L50 109 M35 94 L65 94" stroke="#8cc7b9" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="94" r="4.5" fill="#ffd66b"/></g>
    <rect x="72" y="66" width="6" height="14" rx="3" fill="#8cc7b9"/>
    <rect x="16" y="140" width="14" height="6" rx="2" fill="#8cc7b9"/><rect x="70" y="140" width="14" height="6" rx="2" fill="#8cc7b9"/>
    ${env(14, d.love[0], '#7fd6e6')}${env(54, d.love[1], '#f7a8c0')}
    <!-- 出納 -->
    <g transform="translate(94 -14) scale(1.25)">${officeCharSvg(kind)}</g>
    <rect x="98" y="100" width="98" height="44" rx="9" fill="#e9c9e0"/>
    <rect x="92" y="89" width="110" height="16" rx="8" fill="#f8e1f0"/>
    <rect x="92" y="98" width="110" height="7" rx="3.5" fill="#efcfe4"/>
    <!-- 錢袋與零錢 -->
    <g class="${d.settled ? 'of-bag-done' : 'of-bag'}">
      <path d="M170 88 q-12 -1 -11 -13 q1 -9 8 -12 l-3 -5 h12 l-3 5 q7 3 8 12 q1 12 -11 13 Z" fill="#e3b98a"/>
      <path d="M163 58 h12" stroke="#b98a57" stroke-width="2" stroke-linecap="round"/>
      <text x="169.5" y="80" font-size="11" font-weight="700" text-anchor="middle" fill="#8a5a2b">$</text>
    </g>
    <g>
      <ellipse cx="112" cy="87" rx="7" ry="2.6" fill="#f2b632"/><ellipse cx="112" cy="84" rx="7" ry="2.6" fill="#ffd66b"/>
      <ellipse cx="112" cy="81" rx="7" ry="2.6" fill="#f2b632"/><ellipse cx="112" cy="78" rx="7" ry="2.6" fill="#ffd66b"/>
    </g>
    <g class="of-toss"><ellipse cx="144" cy="70" rx="5.5" ry="5.5" fill="#ffd66b" stroke="#f2b632" stroke-width="1.2"/></g>
    <ellipse cx="128" cy="84" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>
    <ellipse cx="146" cy="84" rx="7" ry="5.5" fill="${fur}" stroke="rgba(90,70,50,0.18)" stroke-width="0.8"/>
  </svg>`;
}

// 存錢筒：肚子裡的水位就是餘額比例；餘額偏低會冒汗，變負數會哭
function officePiggySvg(d) {
  const top = 22, bottom = 110;
  const level = bottom - (bottom - top) * d.ratio;
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
    <defs><clipPath id="ofPigClip"><ellipse cx="96" cy="68" rx="62" ry="44"/></clipPath></defs>
    <ellipse cx="98" cy="122" rx="70" ry="6" fill="rgba(90,70,50,0.13)"/>
    <path class="of-pigtail" d="M34 62 q-12 -2 -10 -10 q2 -7 8 -3 q4 3 -1 6" fill="none" stroke="#f08fb0" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="58" y="100" width="16" height="20" rx="6" fill="#f7a8c0"/><rect x="118" y="100" width="16" height="20" rx="6" fill="#f7a8c0"/>
    <g class="of-pig">
      <ellipse cx="96" cy="68" rx="62" ry="44" fill="#ffe3ea"/>
      <g clip-path="url(#ofPigClip)">
        <rect class="of-level" x="30" y="${level.toFixed(1)}" width="134" height="${(bottom - level + 6).toFixed(1)}" fill="#f9b4c8"/>
        <path class="of-wave" d="M30 ${level.toFixed(1)} q11 -5 22 0 t22 0 t22 0 t22 0 t22 0 t22 0 v6 h-134 Z" fill="#fbc6d5"/>
      </g>
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

function officePlantSvg() {
  return `
  <svg viewBox="0 0 60 90" aria-hidden="true">
    <g class="of-leaf">
      <path d="M30 56 Q12 44 14 18 Q28 28 30 56 Z" fill="#8fd3b0"/>
      <path d="M30 56 Q48 42 48 14 Q32 26 30 56 Z" fill="#a8e0c0"/>
      <path d="M30 58 Q30 30 30 8 Q20 30 30 58 Z" fill="#7cc9a2"/>
    </g>
    <path d="M14 56 h32 l-4 28 q-12 4 -24 0 Z" fill="#f4b99a"/>
    <rect x="11" y="52" width="38" height="9" rx="4.5" fill="#f8cdb4"/>
  </svg>`;
}

// ── 畫面 ──────────────────────────────────────────────────────
function officeBubbles(d, sheet) {
  const newN = officeNewCount[sheet] || 0;
  const latest = d.sorted[0];
  const lovePending = d.love.filter(p => p.has && !p.arrived);
  const loveArrived = d.love.filter(p => p.has && p.arrived);
  return {
    desk: newN > 0 ? `新增了 ${newN} 筆！`
      : (latest ? `${latest.item} ${fmt(latest.expense || latest.income)}` : '這個月還沒有紀錄'),
    vault: d.settled ? '月底結算完成 ✓'
      : (lovePending.length ? `等 ${lovePending[0].date} 入帳…`
        : (loveArrived.length ? `每月的愛 ${loveArrived.length}/2 已入帳 💛` : '還沒有每月的愛')),
    piggy: `餘額 ${fmt(d.balance)}`,
    shelf: d.alerts.length ? `${d.alerts[0].name} ${d.alerts[0].text}` : (d.items.length ? '庫存都夠 ✓' : '還沒有庫存'),
    board: d.cats.length ? `最大支出：${d.cats[0].name}` : '還沒有支出',
  };
}

function officeDetailHtml(key, d) {
  const row = (label, value, cls = '') => `<div class="of-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
  const go = (tab, text) => `<button type="button" class="of-go" data-office-go="${tab}">${text}</button>`;
  const bk = officeBookkeeper() === 'elf' ? '精靈' : '小狐狸';
  const cashier = officeBookkeeper() === 'elf' ? '小狐狸' : '精靈';
  if (key === 'desk') {
    const list = d.sorted.slice(0, 4).map(r =>
      row(`${toMMDD(r.date)} ${esc(r.item)}`, (r.expense ? '−' : '+') + fmt(r.expense || r.income), r.expense ? 'of-exp' : 'of-inc')).join('');
    return `<h4>📒 記帳桌 <small>${bk}值班</small></h4>
      ${row('今天', d.todayCount + ' 筆')}${row('這個月', d.entries.length + ' 筆')}
      ${list ? `<div class="of-sub">最新紀錄</div>${list}` : '<p class="of-note">這個月還沒有紀錄。</p>'}
      <div class="of-actions"><button type="button" class="of-go" data-office-add>記一筆</button>${go('records', '看明細')}</div>`;
  }
  if (key === 'vault') {
    const love = d.love.map(p => row(`${p.name === '精靈' ? '🐎' : '🦊'} ${p.name} 每月的愛`,
      p.has ? `${fmt(p.amount)}（${p.arrived ? '已入帳' : p.date + ' 入帳'}）` : '尚未登記', p.has && p.arrived ? 'of-inc' : '')).join('');
    return `<h4>🏦 金庫 <small>${cashier}值班</small></h4>
      ${love}${row('月底結算', d.settled ? '已完成' : '尚未結算')}
      <div class="of-actions">${go('members', '看成員')}</div>`;
  }
  if (key === 'piggy') {
    const tip = d.mood === 'cry' ? '餘額是負的，存錢筒哭了。' : (d.mood === 'worry' ? '餘額剩不到兩成，存錢筒有點緊張。' : '存錢筒心情不錯。');
    return `<h4>🐷 存錢筒</h4>
      ${row('期初餘額', fmt(d.starting))}${row('已入帳收入', '+' + fmt(d.arrived), 'of-inc')}${row('本月支出', '−' + fmt(d.expense), 'of-exp')}
      ${row('目前餘額', fmt(d.balance), d.balance < 0 ? 'of-exp' : 'of-inc')}${row('水位', Math.round(d.ratio * 100) + '%')}
      <p class="of-note">${tip}（水位＝目前餘額 ÷（期初＋已入帳收入））</p>`;
  }
  if (key === 'shelf') {
    const list = d.alerts.slice(0, 8).map(a => row(esc(a.name), a.text, a.level === 'red' ? 'of-exp' : 'of-warn')).join('');
    return `<h4>📦 貨架</h4>
      ${row('庫存品項', d.items.length + ' 項')}${row('需要注意', d.alerts.length + ' 項', d.alerts.length ? 'of-exp' : 'of-inc')}
      ${list || '<p class="of-note">沒有要補貨或快到期的東西。</p>'}
      <div class="of-actions">${go('inventory', '看庫存')}</div>`;
  }
  const max = d.cats.length ? d.cats[0].value : 1;
  const bars = d.cats.slice(0, 6).map(c => `<div class="of-bar-row"><span>${esc(c.name)}</span><i><em style="width:${Math.max(4, c.value / max * 100).toFixed(0)}%"></em></i><b>${fmt(c.value)}</b></div>`).join('');
  return `<h4>📊 白板</h4>
    ${bars || '<p class="of-note">這個月還沒有支出。</p>'}
    <div class="of-actions">${go('analysis', '看分析')}</div>`;
}

function drawOffice() {
  const scene = document.getElementById('office-scene');
  if (!scene) return;
  let d;
  try { d = officeData(); }
  catch (e) { scene.innerHTML = '<div class="empty-state">⚠️ 辦公室載入失敗</div>'; return; }
  const sheet = currentSheet();
  const bkKind = officeBookkeeper();
  const cashierKind = bkKind === 'elf' ? 'fox' : 'elf';
  const b = officeBubbles(d, sheet);
  const now = new Date();
  const boardMax = d.cats.length ? d.cats[0].value : 1;
  const boardRows = d.cats.slice(0, 3).map((c, i) =>
    `<div class="of-board-row"><span>${esc(c.name)}</span><i><em class="c${i}" style="width:${Math.max(8, c.value / boardMax * 100).toFixed(0)}%"></em></i></div>`).join('');
  const boxes = d.items.length
    ? (d.alerts.length ? d.alerts.slice(0, 4).map(a => `<span class="of-box ${a.level}">${esc(a.name)}</span>`).join('')
      : '<span class="of-box ok">✓</span><span class="of-box ok"></span><span class="of-box ok"></span>')
    : '<span class="of-box none"></span><span class="of-box none"></span>';
  const loveToday = d.love.some(p => p.arrivedToday);
  const station = (key, cls, inner, label) => `
    <button type="button" class="of-station ${cls}${officeSelected === key ? ' selected' : ''}" data-office-station="${key}" aria-label="${label}">
      <span class="of-bubble" data-office-bubble="${key}">${esc(b[key])}</span>${inner}
    </button>`;

  scene.innerHTML = `
    <div class="of-wall"></div><div class="of-floor"></div><div class="of-rug"></div>
    <div class="of-calendar" aria-hidden="true"><b>${now.getMonth() + 1}月</b><span>${now.getDate()}</span><small>星期${DAY_NAMES[now.getDay()]}</small></div>
    ${station('board', 'of-board', `<div class="of-board-in"><div class="of-board-title">本月支出</div>${boardRows || '<div class="of-board-empty">還沒有支出</div>'}</div>`, '白板：本月支出分類')}
    ${station('shelf', 'of-shelf', `<div class="of-shelf-in"><div class="of-shelf-row">${boxes}</div><div class="of-shelf-row"><span class="of-box plain"></span><span class="of-box plain"></span><span class="of-box plain"></span></div>${d.alerts.length ? `<em class="of-badge">${d.alerts.length}</em>` : ''}</div>`, '貨架：庫存狀況')}
    ${station('desk', 'of-desk', officeDeskSvg(bkKind, d.todayCount > 0), '記帳桌')}
    ${station('vault', 'of-vault' + (loveToday ? ' busy' : ''), officeVaultSvg(cashierKind, d), '金庫')}
    ${station('piggy', 'of-piggy mood-' + d.mood, officePiggySvg(d), '存錢筒')}
    <div class="of-plant" aria-hidden="true">${officePlantSvg()}</div>
    <button type="button" class="of-swap" data-office-swap title="交換記帳員與出納">⇄ 換班</button>`;

  const detail = document.getElementById('office-detail');
  if (detail) {
    detail.innerHTML = officeSelected
      ? officeDetailHtml(officeSelected, d)
      : `<p class="of-note of-hint">點一下角色或物品看細節。目前由 <b>${bkKind === 'elf' ? '🐎 精靈' : '🦊 小狐狸'}</b> 記帳、<b>${bkKind === 'elf' ? '🦊 小狐狸' : '🐎 精靈'}</b> 管金庫。</p>`;
  }
  officeShowBubble();
}

// 對話框輪流出現（點開某一站時，固定顯示那一站）
const OFFICE_BUBBLE_ORDER = ['desk', 'vault', 'piggy', 'shelf', 'board'];
function officeShowBubble() {
  const key = officeSelected || OFFICE_BUBBLE_ORDER[officeBubbleIndex % OFFICE_BUBBLE_ORDER.length];
  document.querySelectorAll('#office-scene .of-bubble').forEach(el => {
    el.classList.toggle('show', el.dataset.officeBubble === key);
  });
}
function officeStartBubbles() {
  officeStopBubbles();
  officeBubbleTimer = setInterval(() => {
    if (!officeVisible()) { officeStopBubbles(); return; }
    officeBubbleIndex++;
    officeShowBubble();
  }, 3500);
}
function officeStopBubbles() {
  if (officeBubbleTimer) { clearInterval(officeBubbleTimer); officeBubbleTimer = null; }
}

// 進入分頁時呼叫：記下這次比上次多幾筆、更新庫存、開始輪播
function renderOffice() {
  const sheet = currentSheet();
  if (officeNewCount[sheet] === undefined) {
    const count = records.filter(r => !isSummaryRow(r) && r.item !== '帳戶餘額').length;
    let prev = null;
    try { const v = localStorage.getItem(OFFICE_SEEN_PREFIX + sheet); prev = v === null ? null : parseInt(v, 10); } catch (e) { /* ignore */ }
    officeNewCount[sheet] = prev !== null && Number.isFinite(prev) ? Math.max(0, count - prev) : 0;
    try { localStorage.setItem(OFFICE_SEEN_PREFIX + sheet, String(count)); } catch (e) { /* ignore */ }
  }
  drawOffice();
  officeStartBubbles();
  if (!officeInvRequested) {
    officeInvRequested = true;
    Promise.resolve(loadInventory()).then(() => { if (officeVisible()) drawOffice(); }).catch(() => {});
  }
}

document.addEventListener('click', e => {
  if (!officeVisible()) return;
  if (e.target.closest('[data-office-swap]')) { officeSwapRoles(); return; }
  if (e.target.closest('[data-office-add]')) { openModal(); return; }
  const go = e.target.closest('[data-office-go]');
  if (go) {
    const name = go.dataset.officeGo;
    const tabBtn = [...document.querySelectorAll('.tab')].find(t => (t.getAttribute('onclick') || '').includes(`'${name}'`));
    if (tabBtn) switchTab(name, tabBtn);
    return;
  }
  const st = e.target.closest('[data-office-station]');
  if (st) {
    const key = st.dataset.officeStation;
    officeSelected = officeSelected === key ? null : key;
    drawOffice();
  }
});
