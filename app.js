const API = 'https://script.google.com/macros/s/AKfycbzdnp_gvKGGELnzDA4ZNq25RQ3mPPOXqbuwINKUBXuobbBw_cLubt8Cn-oDrazLfgkk/exec';
let records = [];
let lastSummaryBalance = null; // { sheet, balance }：摘要卡片算出的目前帳戶餘額
let catChartInst = null;
let amountType = 'expense';
let manualSeason = null;

let islandAnimationId = null;
let windmillAngle = 0;
let cloudOffset = 0;
let islandZoom = null;
let islandOffsetX = 0;
let islandOffsetY = 0;
let mouseX = -1000;
let mouseY = -1000;
const hoverProgress = {
  castle: 0, dining: 0, grocery: 0, travel: 0, transport: 0,
  rent: 0, utilities: 0, shopping: 0, transfer: 0
};

// 立體地標圖檔載入器與去背引擎
const ASSET_FILES = {
  island_base: 'assets/island_base.webp?v=3',
  campfire: 'assets/campfire.webp?v=2',
  tent: 'assets/tent.webp?v=2',
  simple_hotel: 'assets/simple_hotel.webp?v=2',
  luxury_hotel: 'assets/luxury_hotel.webp?v=2',
  cafe: 'assets/cafe.webp?v=3',
  farm: 'assets/farm.webp?v=2',
  hydrangea_garden: 'assets/hydrangea_garden.webp?v=2',
  ferris_wheel: 'assets/ferris_wheel.webp?v=3',
  amusement_park: 'assets/amusement_park.webp?v=2',
  luxury_hotel_universal: 'assets/luxury_hotel_universal.webp?v=2',
  station: 'assets/station.webp?v=2',
  apartment: 'assets/apartment.webp?v=2',
  utilities_windmill: 'assets/utilities_windmill.webp?v=1',
  utilities_solar_water: 'assets/utilities_solar_water.webp?v=1',
  utilities_substation: 'assets/utilities_substation.webp?v=1',
  utilities_reactor: 'assets/utilities_reactor.webp?v=1',
  balloon: 'assets/balloon.webp?v=7',
  bicycle: 'assets/bicycle.webp?v=2',
  car: 'assets/car.webp?v=2',
  train: 'assets/train.webp?v=2',
  airplane: 'assets/airplane.webp?v=2',
  beverage: 'assets/beverage.webp?v=2',
  bento: 'assets/bento.webp?v=2',
  restaurant: 'assets/restaurant.webp?v=3',
  rent_apartment: 'assets/rent_apartment.webp?v=3',
  rent_villa: 'assets/rent_villa.webp?v=3',
  rent_luxury_building: 'assets/rent_luxury_building.webp?v=3',
  rent_palace: 'assets/rent_palace.webp?v=3',
  grocery_garden: 'assets/grocery_garden.webp?v=1',
  grocery_greenhouse: 'assets/grocery_greenhouse.webp?v=1',
  grocery_supermarket: 'assets/grocery_supermarket.webp?v=1',
  grocery_large_supermarket: 'assets/grocery_large_supermarket.webp?v=1',
  shopping_boxes: 'assets/shopping_boxes.webp?v=1',
  shopping_general_store: 'assets/shopping_general_store.webp?v=1',
  shopping_department_store: 'assets/shopping_department_store.webp?v=1',
  shopping_logistics: 'assets/shopping_logistics.webp?v=1'
};

const ASSETS = {};
let assetsLoaded = false;


// ── 12個月粉嫩質感主題 ──────────────────────────────────────────
const MONTH_THEMES = {
  1: { name: '1月・元月新春', emoji: '🏮', particles: ['🏮','🧧','🍊','✨'], bg: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)', elf: '#b91c1c', elfBg: '#fde8e8', fox: '#c27803', foxBg: '#fef9c3', themeAttr: 'm1' },
  2: { name: '2月・初雪元宵', emoji: '❄️', particles: ['❄️','⛄','🏮','🍡'], bg: 'linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%)', elf: '#4f46e5', elfBg: '#e0e7ff', fox: '#7c3aed', foxBg: '#f3e8ff', themeAttr: 'm2' },
  3: { name: '3月・春櫻綻放', emoji: '🌸', particles: ['🌸','💮','🦋','🍵'], bg: 'linear-gradient(135deg, #fff5f7 0%, #fbcfe8 100%)', elf: '#be185d', elfBg: '#fce4ec', fox: '#db2777', foxBg: '#fdf2f8', themeAttr: 'm3' },
  4: { name: '4月・鬱金綠芽', emoji: '🌷', particles: ['🌷','🌱','🐝','🍀'], bg: 'linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)', elf: '#047857', elfBg: '#d1fae5', fox: '#059669', foxBg: '#ecfdf5', themeAttr: 'm4' },
  5: { name: '5月・紫陽雨季', emoji: '☔', particles: ['☔','🐌','💮','☁️'], bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', elf: '#1d4ed8', elfBg: '#dbeafe', fox: '#2563eb', foxBg: '#eff6ff', themeAttr: 'm5' },
  6: { name: '6月・夏至晴空', emoji: '☀️', particles: ['🌊','🌻','🍦','⛱️'], bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)', elf: '#0369a1', elfBg: '#e0f2fe', fox: '#0891b2', foxBg: '#ecfeff', themeAttr: 'm6' },
  7: { name: '7月・向日葵夏', emoji: '🌻', particles: ['🌻','🍉','🍧','🎇'], bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', elf: '#b45309', elfBg: '#fef3c7', fox: '#d97706', foxBg: '#fffbeb', themeAttr: 'm7' },
  8: { name: '8月・盛夏祭典', emoji: '🎐', particles: ['🎐','🎇','👘','🐠'], bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', elf: '#6d28d9', elfBg: '#f3e8ff', fox: '#701a75', foxBg: '#fae8ff', themeAttr: 'm8' },
  9: { name: '9月・秋意微風', emoji: '🌾', particles: ['🌾','🌕','🐇','🍵'], bg: 'linear-gradient(135deg, #fffbeb 0%, #ccfbf1 100%)', elf: '#854d0e', elfBg: '#fef3c7', fox: '#0f766e', foxBg: '#ccfbf1', themeAttr: 'm9' },
  10: { name: '10月・楓紅秋葉', emoji: '🍁', particles: ['🍁','🍂','🎃','🌰'], bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', elf: '#c2410c', elfBg: '#ffedd5', fox: '#b91c1c', foxBg: '#fee2e2', themeAttr: 'm10' },
  11: { name: '11月・銀杏微寒', emoji: '🍂', particles: ['🍂','🧣','🌰','☕'], bg: 'linear-gradient(135deg, #fffbeb 0%, #ffedd5 100%)', elf: '#a16207', elfBg: '#fef9c3', fox: '#78350f', foxBg: '#ffedd5', themeAttr: 'm11' },
  12: { name: '12月・冬雪聖誕', emoji: '🎄', particles: ['🎄','❄️','🎁','🔔'], bg: 'linear-gradient(135deg, #f0fdf4 0%, #fee2e2 100%)', elf: '#15803d', elfBg: '#dcfce7', fox: '#b91c1c', foxBg: '#fee2e2', themeAttr: 'm12' }
};

function getAutoMonth() {
  const sel = document.getElementById('monthSel');
  if (sel && sel.value) {
    const mMatch = sel.value.match(/\/(\d{1,2})月/);
    if (mMatch) return parseInt(mMatch[1]);
  }
  return new Date().getMonth() + 1;
}

// 每月的霓虹強調色：[精靈色, 小狐狸色]，搭配深色底使用
const NEON_ACCENTS = {
  1: ['#ff3b5c', '#ffc53d'], 2: ['#818cf8', '#c084fc'], 3: ['#f472b6', '#fb7185'],
  4: ['#34d399', '#a3e635'], 5: ['#60a5fa', '#38bdf8'], 6: ['#22d3ee', '#2dd4bf'],
  7: ['#fbbf24', '#fb923c'], 8: ['#a78bfa', '#e879f9'], 9: ['#facc15', '#2dd4bf'],
  10: ['#fb923c', '#f43f5e'], 11: ['#eab308', '#d97706'], 12: ['#4ade80', '#f87171'],
};

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

function applyMonthTheme(m) {
  const t = MONTH_THEMES[m];
  if (!t) return;
  
  // 移除老舊季節屬性，防止其 CSS 優先權覆蓋新樣式
  document.body.removeAttribute('data-season');
  document.body.setAttribute('data-theme', t.themeAttr);
  document.getElementById('seasonBadge').textContent = t.emoji + ' ' + t.name;
  
  // 直接將 CSS 變數設定在 document.body.style 上 (最高權限的 Inline Style)
  const target = document.body;
  const [glowA, glowB] = NEON_ACCENTS[m]; // 霓虹色：光暈與漸層
  target.style.setProperty('--bg', '#f4f7fb');
  target.style.setProperty('--season-bg',
    `radial-gradient(1000px 600px at 0% -10%, ${hexToRgba(glowA, 0.18)}, transparent 60%), ` +
    `radial-gradient(900px 700px at 110% 110%, ${hexToRgba(glowB, 0.14)}, transparent 60%), #f4f7fb`);
  // 文字與數字使用較深的月份色，確保在淺色底上清楚
  target.style.setProperty('--elf', t.elf);
  target.style.setProperty('--elf-bg', hexToRgba(glowA, 0.12));
  target.style.setProperty('--fox', t.fox);
  target.style.setProperty('--fox-bg', hexToRgba(glowB, 0.12));
  target.style.setProperty('--income', t.elf);
  target.style.setProperty('--expense', t.fox);
  target.style.setProperty('--glow-elf', glowA);
  target.style.setProperty('--glow-fox', glowB);
  target.style.setProperty('--btn', `linear-gradient(135deg, ${glowA}, ${glowB})`);
  target.style.setProperty('--btn-text', '#0b1220');
  
  spawnParticles(t.particles);
}

function spawnParticles(emojis) {
  const container = document.getElementById('particles');
  container.innerHTML = '';
  const count = 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = emojis[i % emojis.length];
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (6 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.fontSize = (12 + Math.random() * 10) + 'px';
    container.appendChild(p);
  }
}

function openSeasonModal() {
  const cur = manualSeason || getAutoMonth();
  const isAuto = !manualSeason;
  document.getElementById('seasonModalContainer').innerHTML = `
    <div class="season-modal" onclick="if(event.target===this)closeSeasonModal()">
      <div class="season-panel">
        <h3>🎨 選擇月份主題</h3>
        <button class="season-auto ${isAuto ? 'active' : ''}" onclick="setAutoSeason()">✨ 自動（依資料月份）</button>
        <div class="season-options">
          ${Object.entries(MONTH_THEMES).map(([k,t]) => `
            <div class="season-opt ${!isAuto && cur==k ? 'selected' : ''}" onclick="setManualSeason(${k})">
              <span class="s-emoji">${t.emoji}</span>${t.name}
            </div>`).join('')}
        </div>
        <button class="season-close" onclick="closeSeasonModal()">完成</button>
      </div>
    </div>`;
}

function closeSeasonModal() { document.getElementById('seasonModalContainer').innerHTML = ''; }

function setAutoSeason() {
  manualSeason = null;
  applyMonthTheme(getAutoMonth());
  document.querySelectorAll('.season-opt').forEach(e => e.classList.remove('selected'));
  document.querySelector('.season-auto').classList.add('active');
}

function setManualSeason(m) {
  manualSeason = m;
  applyMonthTheme(m);
  document.querySelectorAll('.season-opt').forEach(e => e.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.querySelector('.season-auto').classList.remove('active');
}

// ── API ───────────────────────────────────────────────────────
async function apiCall(params) {
  const qs = Object.entries(params)
    .map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const res = await fetch(API + '?' + qs);
  return res.json();
}

function setSyncStatus(state, text) {
  document.getElementById('syncDot').className = 'sync-dot ' + state;
  document.getElementById('syncText').textContent = text;
}

function currentSheet() { return document.getElementById('monthSel').value; }

// 各月份的明細快取（記憶體內）：切換月份時先顯示，再背景更新
const monthRecordsCache = new Map(); // sheet -> records
// 本機快取（每個月一份，附後端版本號）：版本沒變就不重抓，重新整理後也能立刻顯示
const MONTH_STORE_PREFIX = 'shareExpense.month.v1:';
const MONTH_TTL_MS = 24 * 3600 * 1000;   // 超過一天就重抓，防止直接在試算表改的資料沒被發現
function readMonthStore(sheet) {
  try {
    const c = JSON.parse(localStorage.getItem(MONTH_STORE_PREFIX + sheet) || 'null');
    return c && Array.isArray(c.records) ? c : null;
  } catch (e) { return null; }
}
function writeMonthStore(sheet, records, ver) {
  try { localStorage.setItem(MONTH_STORE_PREFIX + sheet, JSON.stringify({ ts: Date.now(), ver, records })); }
  catch (e) { /* 空間不足或無痕模式時略過 */ }
}
// 取得各月份版本號；後端尚未更新時回傳 null（退回每次都重抓）
async function getVersions() {
  try {
    const d = await apiCall({ action: 'getVersions' });
    return d && !d.error ? (d.versions || {}) : null;
  } catch (e) { return null; }
}
// 取得某月明細：force 為 true 時一定重抓；否則版本相同且快取未過期就直接用快取
async function fetchMonth(sheet, vers, force) {
  const sv = vers ? String(vers[sheet] || '0') : null;
  const c = readMonthStore(sheet);
  if (!force && c && sv !== null && String(c.ver) === sv && Date.now() - c.ts < MONTH_TTL_MS) {
    monthRecordsCache.set(sheet, c.records);
    return c.records;
  }
  const data = await apiCall({ action: 'getAll', sheet });
  if (data.error) throw new Error(data.error);
  const recs = data.records || [];
  monthRecordsCache.set(sheet, recs);
  writeMonthStore(sheet, recs, sv);
  return recs;
}
// 目前畫面上的 records 是否已是最新（快取顯示中為 false；此時不允許修改，避免列號對到錯的資料）
let recordsFresh = true;

function guardRecordsFresh() {
  if (recordsFresh) return true;
  showToast('資料更新中，請稍候再試');
  return false;
}

async function loadData() {
  loadIconRules(); // 讀取圖示對照（不等待）
  const sheet = currentSheet();
  // 主題跟著所選月份立即切換（不必等同步完成）
  if (!manualSeason) applyMonthTheme(getAutoMonth());
  const loadHTML = '<div class="loading-state"><div class="spinner"></div>載入中…</div>';
  const stored = readMonthStore(sheet);
  if (stored && !monthRecordsCache.has(sheet)) monthRecordsCache.set(sheet, stored.records);
  const cached = monthRecordsCache.get(sheet);
  if (cached) {
    records = cached;
    recordsFresh = false;
    renderAll();
  } else {
    document.getElementById('recordBody').innerHTML = '<tr><td colspan="6">' + loadHTML + '</td></tr>';
    document.getElementById('recordCards').innerHTML = loadHTML;
    records = [];
    recordsFresh = false;
  }
  setSyncStatus('loading', '同步中…');
  try {
    loadIncomeSettings(); // 同步試算表的進帳設定（不等待）
    const vers = await getVersions();
    const fresh = await fetchMonth(sheet, vers, true);   // 目前月份一律重抓
    if (sheet !== currentSheet()) return; // 使用者已切到其他月份，這筆只存快取
    records = fresh;
    recordsFresh = true;
    setSyncStatus('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
    
    // 自動更新為目前月份主題
    const m = getAutoMonth();
    if (!manualSeason) {
      applyMonthTheme(m);
    }
    
    renderAll();
  } catch(e) {
    if (sheet !== currentSheet()) return;
    setSyncStatus('err', '連線失敗');
    if (!cached) {
      const errHTML = '<div class="empty-state">⚠️ 無法連線到 Google 試算表</div>';
      document.getElementById('recordBody').innerHTML = '<tr><td colspan="6">' + errHTML + '</td></tr>';
      document.getElementById('recordCards').innerHTML = errHTML;
    }
  }
}

// 背景預先讀取其他月份（一次一個，避免同時打太多請求）
async function prefetchOtherMonths() {
  const sel = document.getElementById('monthSel');
  const others = Array.from(sel.options).map(o => o.value).filter(v => v && v !== currentSheet());
  const vers = await getVersions();
  for (const sheet of others) {
    try { await fetchMonth(sheet, vers, false); }   // 版本沒變就只用快取
    catch (e) { /* 失敗就略過，切換時會再讀 */ }
  }
}

async function addRecord(data) {
  if (!guardRecordsFresh()) return;
  setSyncStatus('loading', '儲存中…');
  try {
    const summaryRow = records.find(r => r.item && r.item.includes('總收入/支出'));
    const beforeRow = summaryRow ? summaryRow.row : null;
    await apiCall({ action: 'add', sheet: currentSheet(), data: JSON.stringify(data), beforeRow: beforeRow || '' });
    showToast('已新增 ✓');
    await loadData();
    if (typeof officeNoteRecord === 'function') officeNoteRecord(data);
  } catch(e) {
    setSyncStatus('err', '儲存失敗');
    showToast('儲存失敗，請重試');
  }
}

// 編輯既有記錄：以列號寫入，並帶入原本的項目名稱讓後端確認是同一筆
async function updateRecordApi(rec, data) {
  if (!guardRecordsFresh()) return;
  setSyncStatus('loading', '儲存中…');
  try {
    const res = await apiCall({
      action: 'updateRecord', sheet: currentSheet(), row: rec.row,
      data: JSON.stringify({ ...data, expectedItem: rec.item })
    });
    if (res.error) throw new Error(res.message || res.error);
    showToast('已更新 ✓');
    await loadData();
  } catch(e) {
    setSyncStatus('err', '儲存失敗');
    showToast(e.message || '儲存失敗，請重試');
    loadData(); // 以試算表的實際資料還原畫面
  }
}

async function updateTransfer(row, field, value) {
  if (!guardRecordsFresh()) return;
  setSyncStatus('loading', '更新中…');
  const rec = records.find(r => r.row === row);
  let foxSync = null; // 需要同步到小狐狸「支出部分轉回」列的金額
  if (rec) {
    if (field === 'income') rec.income = parseFloat(value) || 0;
    else rec.expense = parseFloat(value) || 0;
    const result = rec.income - rec.expense;
    ['transfer-result-' + row, 'transfer-result-m-' + row].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = (result >= 0 ? '+' : '') + result.toLocaleString(); el.style.color = result >= 0 ? 'var(--income)' : 'var(--expense)'; }
    });
    if (rec.item && rec.item.includes('精靈')) {
      const foxRec = records.find(r => r.item && r.item.includes('支出部分轉回') && r.item.includes('小狐狸'));
      if (foxRec) {
        foxRec.income = result;
        ['[data-row="'+foxRec.row+'"][data-field="income"]'].forEach(sel => {
          document.querySelectorAll(sel).forEach(inp => { inp.value = result; });
        });
        const foxResult = foxRec.income - foxRec.expense;
        ['transfer-result-' + foxRec.row, 'transfer-result-m-' + foxRec.row].forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.textContent = (foxResult >= 0 ? '+' : '') + foxResult.toLocaleString(); el.style.color = foxResult >= 0 ? 'var(--income)' : 'var(--expense)'; }
        });
        foxSync = { row: foxRec.row, value: result };
      }
    }
  }
  try {
    if (foxSync) await apiCall({ action: 'updateTransfer', sheet: currentSheet(), row: foxSync.row, field: 'income', value: foxSync.value });
    await apiCall({ action: 'updateTransfer', sheet: currentSheet(), row, field, value: parseFloat(value) || 0 });
    setSyncStatus('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
    showToast('已更新 ✓');
    // 填了轉回金額：辦公室排一趟月底結算（阿庫領錢交給兩人）
    if (field === 'expense' && (parseFloat(value) || 0) > 0 && typeof officeNoteSettle === 'function') officeNoteSettle();
    
    // ⚡ 實時更新：當手動調整轉回金額時，即時更新首頁四大卡片的金額
    renderAll();
    
    // ⚡ 實時更新：若使用者目前在年度頁籤，即時重繪年度水位折線圖
    if (document.getElementById('tab-annual').style.display !== 'none') {
      renderAnnualChart();
    }
  } catch(e) {
    setSyncStatus('err', '更新失敗');
    showToast('更新失敗，請重試');
    loadData(); // 以試算表的實際資料還原畫面，避免顯示與後端不一致
  }
}

async function deleteRecord(row) {
  if (!guardRecordsFresh()) return;
  if (!confirm('確定刪除這筆記錄？')) return;
  const rec = records.find(r => r.row === row);
  setSyncStatus('loading', '刪除中…');
  try {
    await apiCall({ action: 'delete', sheet: currentSheet(), row });
    await loadData();
    if (rec) {
      // 保留刪除前的內容，讓使用者可以短時間內復原（以新增方式寫回）
      const snapshot = { date: rec.date, owner: rec.owner, item: rec.item, income: rec.income || 0, expense: rec.expense || 0, note: rec.note || '' };
      showToast('已刪除', { label: '復原', onClick: () => addRecord(snapshot) });
    } else {
      showToast('已刪除');
    }
  } catch(e) { setSyncStatus('err', '刪除失敗'); showToast('刪除失敗，請重試'); }
}

// ── RENDER ────────────────────────────────────────────────────
// 所有來自試算表的文字在放進 innerHTML 前都要跳脫，避免 XSS
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
const DAY_NAMES = ['日','一','二','三','四','五','六'];
function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return esc(raw);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' (' + DAY_NAMES[d.getDay()] + ')';
}
function formatDateShort(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return esc(raw);
  return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' (' + DAY_NAMES[d.getDay()] + ')';
}

const SUMMARY_ITEMS = ['總收入/支出','支出部分轉回'];
const isSummaryRow = r => SUMMARY_ITEMS.some(k => r.item.includes(k)) || r.owner === '帳戶餘額';

// 目前餘額只計入「已到帳」的收入（日期已到今天或之前），未到日期的匯款先不算
function arrivedIncomeOf(realRecs) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return realRecs
    .filter(r => r.owner !== '' && r.item !== '帳戶餘額')
    .filter(r => { const d = new Date(r.date); return isNaN(d.getTime()) || d <= endOfToday; })
    .reduce((s, r) => s + r.income, 0);
}

function renderAll() {
  const realRecs = records.filter(r => !isSummaryRow(r));
  const isPrepaid = r => r.note && r.note.includes('先付');
  
  // 1. 期初餘額
  const startingRec = records.find(r => r.item === '帳戶餘額' && r.owner === '');
  const startingBalance = startingRec ? startingRec.income : 0;
  
  // 2. 本月新增實質收入 (排除期初餘額，不重疊計算)
  const totalIncome = realRecs.filter(r => r.owner !== '' && r.item !== '帳戶餘額').reduce((s,r) => s + r.income, 0);
  
  // 3. 本月實質支出 (排除先付/代墊)
  const totalExpense = realRecs.filter(r => !isPrepaid(r)).reduce((s,r) => s + r.expense, 0);
  
  // 4. 目前帳戶期末總水位 (若已結算則以最後轉回餘額為準，避免因超支手動調整導致不一致)
  const transferRecs = records.filter(r => r.item.includes('支出部分轉回'));
  const isSettled = transferRecs.some(r => r.expense > 0);
  
  let balance = startingBalance + arrivedIncomeOf(realRecs) - totalExpense;
  if (isSettled && transferRecs.length > 0) {
    const lastTransfer = transferRecs[transferRecs.length - 1];
    balance = (lastTransfer.income || 0) - (lastTransfer.expense || 0);
  }

  const sel = document.getElementById('monthSel');
  const monthLabel = sel.options[sel.selectedIndex]?.text || '';
  
  document.getElementById('s-starting-balance').textContent = fmt(startingBalance);
  document.getElementById('s-income-label').textContent = monthLabel + ' 新增';
  document.getElementById('s-income').textContent = fmt(totalIncome);
  document.getElementById('s-expense-label').textContent = monthLabel + ' 支出';
  document.getElementById('s-expense').textContent = fmt(totalExpense);
  
  const balEl = document.getElementById('s-balance');
  balEl.textContent = fmt(balance);
  balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
  lastSummaryBalance = { sheet: currentSheet(), balance };
  
  // 計算總交易筆數 (不含帳戶餘額)
  const realCount = realRecs.filter(r => r.item !== '帳戶餘額').length;
  // 更新明細表格與手機版
  renderRecords();
  if (document.getElementById('tab-analysis').style.display !== 'none') renderCharts();
  if (document.getElementById('tab-members').style.display !== 'none') renderMembers();
  if (document.getElementById('tab-annual').style.display !== 'none') renderAnnualChart();
  const islandTab = document.getElementById('tab-island');
  if (islandTab && islandTab.style.display !== 'none') renderIsland();
  if (typeof officeVisible === 'function' && officeVisible()) renderOffice();
}

function getFiltered() {
  const q = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const o = document.getElementById('ownerFilter')?.value || '';
  const t = document.getElementById('typeFilter')?.value || '';
  return records.filter(r => {
    if (q && !r.item.toLowerCase().includes(q) && !(r.note||'').toLowerCase().includes(q)) return false;
    if (o && r.owner !== o) return false;
    if (t === 'income' && r.income === 0) return false;
    if (t === 'expense' && r.expense === 0) return false;
    return true;
  });
}

function buildTransferCells(r, isMobile) {
  const incVal = r.income || 0, expVal = r.expense || 0;
  const result = incVal - expVal;
  const resColor = result >= 0 ? 'var(--income)' : 'var(--expense)';
  const prefix = isMobile ? 'm-' : '';
  const inputStyle = `width:85px;padding:${isMobile?'6px 8px':'4px 6px'};font-size:14px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-family:'DM Mono',monospace;`;
  return `<div class="${isMobile ? 'transfer-row-mobile' : ''}" style="${isMobile?'':'display:flex;gap:4px;align-items:center;flex-wrap:wrap'}">
    <span style="font-size:13px;color:var(--text3)">餘</span>
    <input type="number" value="${incVal||''}" min="0" placeholder="0"
      data-row="${r.row}" data-field="income"
      style="${inputStyle}color:var(--income);"
      onchange="updateTransfer(${r.row},'income',this.value)">
    <span style="font-size:13px;color:var(--text3)">轉</span>
    <input type="number" value="${expVal||''}" min="0" placeholder="0"
      data-row="${r.row}" data-field="expense"
      style="${inputStyle}color:var(--expense);"
      onchange="updateTransfer(${r.row},'expense',this.value)">
    <span style="font-size:13px;color:var(--text3)">=</span>
    <span id="transfer-result-${prefix}${r.row}" style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600;color:${resColor}">${result>=0?'+':''}${result.toLocaleString()}</span>
  </div>`;
}

function renderRecords() {
  const rows = getFiltered();
  // Desktop
  const body = document.getElementById('recordBody');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state">沒有符合的記錄</div></td></tr>';
    document.getElementById('recordCards').innerHTML = '<div class="empty-state">沒有符合的記錄</div>';
    return;
  }

  // ── Desktop table rows ──
  body.innerHTML = rows.map(r => {
    const isSummary = isSummaryRow(r);
    const isTransfer = r.item.includes('支出部分轉回');
    const isJoint = r.item === '帳戶餘額' || isTransfer;
    const badge = isJoint
      ? `<span class="owner-badge" style="background:linear-gradient(135deg, var(--elf-bg) 0%, var(--fox-bg) 100%); color:var(--text); border:1px solid var(--border); font-weight:600">🐎 &amp; 🦊 共同</span>`
      : (r.owner && !isSummary
        ? `<span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${esc(r.owner)}</span>`
        : '<span style="color:var(--text3);font-size:14px">—</span>');

    if (isTransfer) {
      return `<tr style="background:var(--surface2)">
        <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
        <td>${badge}</td>
        <td style="font-size:15px;font-weight:500">${esc(r.item)}</td>
        <td>${buildTransferCells(r, false)}</td>
        <td><span class="note-text">${esc(r.note||'')}</span></td>
        <td></td></tr>`;
    }
    if (isSummary) {
      const incAmt = r.income > 0 ? `<span class="amount-income">+${fmt(r.income)}</span>` : '';
      const expAmt = r.expense > 0 ? `<span class="amount-expense"> -${fmt(r.expense)}</span>` : '';
      const netAmt = r.income > 0 && r.expense > 0 ? `<span style="color:var(--text2);font-size:13px;margin-left:4px">= ${fmt(r.income-r.expense)}</span>` : '';
      return `<tr style="background:var(--surface2)">
        <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
        <td><span style="font-size:13px;color:var(--text3);font-weight:500">彙總</span></td>
        <td style="font-size:15px;font-weight:500">${esc(r.item)}</td>
        <td>${incAmt}${expAmt}${netAmt}</td>
        <td><span class="note-text">${esc(r.note||'')}</span></td>
        <td></td></tr>`;
    }
    const isPrepaid = r.note && r.note.includes('先付');
    const amt = r.income > 0
      ? `<span class="amount-income">+${fmt(r.income)}</span>`
      : r.expense > 0
      ? `<span class="amount-expense">-${fmt(r.expense)}</span>${isPrepaid?'<span style="font-size:12px;color:var(--text3);margin-left:4px">先付</span>':''}`
      : '';
    const delBtn = r.item === '帳戶餘額' ? '' : `<button class="edit-btn" aria-label="編輯此筆記錄" onclick="editRecordByRow(${r.row})">✎</button> <button class="delete-btn" aria-label="刪除此筆記錄" onclick="deleteRecord(${r.row})">✕</button>`;
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
      <td>${badge}</td>
      <td style="font-size:15px">${esc(r.item)}</td>
      <td>${amt}</td>
      <td><span class="note-text">${esc(r.note||'')}</span></td>
      <td>${delBtn}</td></tr>`;
  }).join('');

  // ── Mobile cards ──
  document.getElementById('recordCards').innerHTML = rows.map(r => {
    const isSummary = isSummaryRow(r);
    const isTransfer = r.item.includes('支出部分轉回');
    const isPrepaid = r.note && r.note.includes('先付');
    const isJoint = r.item === '帳戶餘額' || isTransfer;

    const badgeHtml = isJoint
      ? `<span class="owner-badge" style="background:linear-gradient(135deg, var(--elf-bg) 0%, var(--fox-bg) 100%); color:var(--text); border:1px solid var(--border); font-weight:600">🐎 &amp; 🦊 共同</span>`
      : (r.owner
        ? `<span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${esc(r.owner)}</span>`
        : '');

    if (isTransfer) {
      return `<div class="record-card summary-card">
        <div class="record-card-top">
          <span class="record-card-date">${formatDateShort(r.date)}</span>
          <span style="font-size:13px;color:var(--text3)">轉帳結算</span>
        </div>
        <div class="record-card-mid">
          ${badgeHtml}
          <span class="record-card-item" style="font-weight:600">${esc(r.item)}</span>
        </div>
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border)">
          ${buildTransferCells(r, true)}
        </div>
      </div>`;
    }

    if (isSummary) {
      const incAmt = r.income > 0 ? `<span class="amount-income">+${fmt(r.income)}</span> ` : '';
      const expAmt = r.expense > 0 ? `<span class="amount-expense">-${fmt(r.expense)}</span> ` : '';
      const net = r.income > 0 && r.expense > 0 ? `<span style="color:var(--text2);font-size:14px">= ${fmt(r.income-r.expense)}</span>` : '';
      return `<div class="record-card summary-card">
        <div class="record-card-top">
          <span class="record-card-date">${formatDateShort(r.date)}</span>
          <span style="font-size:13px;color:var(--text3)">彙總</span>
        </div>
        <div class="record-card-item">${esc(r.item)}</div>
        <div style="margin-top:6px">${incAmt}${expAmt}${net}</div>
      </div>`;
    }

    const amtColor = r.income > 0 ? 'var(--income)' : 'var(--expense)';
    const amtSign = r.income > 0 ? '+' : '-';
    const amtVal = r.income > 0 ? r.income : r.expense;
    const amtHtml = amtVal > 0 ? `<span style="color:${amtColor};font-weight:700;font-family:'DM Mono',monospace;font-size:18px">${amtSign}${fmt(amtVal)}</span>` : '';

    const delBtn = r.item === '帳戶餘額' ? '' : `<button class="edit-btn" aria-label="編輯此筆記錄" onclick="editRecordByRow(${r.row})">✎</button> <button class="delete-btn" aria-label="刪除此筆記錄" onclick="deleteRecord(${r.row})">✕</button>`;
    return `<div class="record-card">
      <div class="record-card-top">
        <span class="record-card-date">${formatDateShort(r.date)}</span>
        ${amtHtml}
      </div>
      <div class="record-card-mid">
        ${badgeHtml}
        <span class="record-card-item">${esc(r.item)}</span>
      </div>
      <div class="record-card-bottom">
        <span class="record-card-note">${esc(r.note||'')}${isPrepaid?' · <span style="color:var(--text3)">先付</span>':''}</span>
        ${delBtn}
      </div>
    </div>`;
  }).join('');
}

function categorize(item) {
  if (/住宿|旅遊|民宿|飯店|酒店|旅館|商旅/.test(item)) return '住宿旅遊';
  if (/全聯|超市|買菜|市場|樂家康|萬家福|大全聯/.test(item)) return '超市採購';
  if (/7-11|便利|全家/.test(item)) return '便利商店';
  if (/自強號|火車|高鐵|交通|客運|Uber|停車|台鐵|計程車/.test(item)) return '交通';
  if (/珍煮丹|飲料|手搖|茶/.test(item)) return '飲料';
  if (/房租/.test(item)) return '房租';
  if (/電費|電力|台電/.test(item)) return '電費';
  if (/水費|自來水/.test(item)) return '水費';
  if (/瓦斯|天然氣/.test(item)) return '瓦斯費';
  if (/網路費|寬頻|第四台|有線電視|MOD|Google AI|AI Pro|訂閱/i.test(item)) return '網路與第四台';
  if (/管理費|社區管理/.test(item)) return '社區管理費';
  if (/修繕|水電工/.test(item)) return '水電雜支';
  if (/每月的愛/.test(item)) return '固定轉帳';
  if (/momo|蝦皮|酷澎|淘寶|網購|眼鏡|佳瑪|金玉堂|外套/.test(item)) return '網購';
  if (/演唱會|展覽|音樂會|舞台劇|音樂劇/.test(item)) return '表演展覽';
  if (/隧道|打彈珠|門票|影城/.test(item)) return '景點';
  if (/原攝/.test(item)) return '相片';
  return '餐飲';
}

const CAT_EMOJI = {
  '住宿旅遊':'🏨', '超市採購':'🛒', '便利商店':'🏪', '交通':'🚆',
  '飲料':'🧋', '房租':'🏠', '電費':'⚡', '水費':'💧', '瓦斯費':'🔥',
  '網路與第四台':'🌐', '社區管理費':'🏢', '水電雜支':'🔧',
  '固定轉帳':'💸', '網購':'📦', '餐飲':'🍽️', '景點':'🎢', '相片':'📸', '表演展覽':'🎭'
};
  
function renderCharts() {
  const expRecs = records.filter(r => r.expense > 0 && r.owner !== '' && !isSummaryRow(r));
  const catMap = {};
  expRecs.forEach(r => { const c = categorize(r.item); catMap[c] = (catMap[c]||0) + r.expense; });
  const cats = Object.keys(catMap).sort((a,b) => catMap[b]-catMap[a]);
  const palette = [
    '#2d7a5f','#c45a2a','#378ADD','#BA7517','#534AB7','#D4537E','#639922','#888780','#E8A838',
    '#8b5cf6','#06b6d4','#ec4899','#f97316','#10b981','#ef4444'
  ];

  if (catChartInst) catChartInst.destroy();
  catChartInst = new Chart(document.getElementById('catChart'), {
    type: 'bar',
    data: { labels: cats, datasets: [{ data: cats.map(c=>catMap[c]), backgroundColor: palette.slice(0,cats.length), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: false, font: { family: 'Noto Sans TC', size: 12 } } },
        y: { ticks: { callback: v => '$'+v.toLocaleString(), font: { family: 'DM Mono', size: 12 } } }
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) renderCategoryDetail(cats[elements[0].index]);
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  });

  // 重設明細區
  document.getElementById('detail-title').textContent = '分類明細';
  document.getElementById('category-detail').innerHTML =
    '<div class="empty-state" style="padding:30px 20px">👆 點選上方分類長條，查看每筆消費明細</div>';
}

function renderCategoryDetail(category) {
  const recs = records
    .filter(r => r.expense > 0 && r.owner !== '' && !isSummaryRow(r) && categorize(r.item) === category)
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  const total = recs.reduce((s,r) => s + r.expense, 0);
  const emoji = CAT_EMOJI[category] || '📋';
  document.getElementById('detail-title').textContent =
    `${emoji} ${category} · 共 ${fmt(total)}（${recs.length} 筆）`;

  if (!recs.length) {
    document.getElementById('category-detail').innerHTML = '<div class="empty-state">此分類沒有記錄</div>';
    return;
  }

  document.getElementById('category-detail').innerHTML =
    `<div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">` +
    recs.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);
                  border:1px solid var(--border)">
        <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${esc(r.owner)}</span>
            <span style="font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.item)}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:13px;color:var(--text3);font-family:'DM Mono',monospace">${formatDateShort(r.date)}</span>
            ${r.note ? `<span style="font-size:13px;color:var(--text3)">· ${esc(r.note)}</span>` : ''}
          </div>
        </div>
        <span class="amount-expense" style="margin-left:10px;flex-shrink:0">-${fmt(r.expense)}</span>
      </div>`
    ).join('') + `</div>`;
}

// 進帳設定：年收入、比例、分攤月數儲存在試算表的「設定」工作表，網頁讀寫同一份資料
const INCOME_PEOPLE = ['精靈','小狐狸'];
// 只在還沒讀到試算表資料、或無法連線時使用的備用值
const DEFAULT_INCOME = {
  '精靈':   { annual: 1250000, rate: 37.5, months: 14 },
  '小狐狸': { annual: 700000,  rate: 37.5, months: 14 },
};
let incomeSettings = {}; // 從試算表讀到的設定

// 取得某人目前生效的設定（試算表的值，沒有則用備用值）
function getIncomeSettings(person) {
  const saved = incomeSettings[person];
  const def = DEFAULT_INCOME[person];
  return {
    annual: saved && Number.isFinite(saved.annual) ? saved.annual : def.annual,
    rate:   saved && Number.isFinite(saved.rate)   ? saved.rate   : def.rate,
    months: saved && Number.isFinite(saved.months) ? saved.months : def.months,
  };
}

// 每月預期進帳 = 年收入 × 比例 ÷ 分攤月數
function monthlyContribOf(person) {
  const s = getIncomeSettings(person);
  return Math.round(s.annual * (s.rate / 100) / s.months);
}

function refreshContribCells() {
  INCOME_PEOPLE.forEach(p => {
    const s = getIncomeSettings(p);
    const result = document.querySelector(`[data-contrib="${p}"]`);
    if (result) result.textContent = '+' + fmt(monthlyContribOf(p));
    const formula = document.querySelector(`[data-formula="${p}"]`);
    if (formula) {
      formula.textContent = `${fmt(s.annual)} × ${s.rate}% ÷ ${s.months} 月`;
    }
  });
}

// 把目前設定填入輸入框（使用者正在輸入的欄位不覆蓋）
function fillIncomeInputs() {
  INCOME_PEOPLE.forEach(p => {
    const s = getIncomeSettings(p);
    const a = document.querySelector(`.income-input[data-person="${p}"]`);
    const r = document.querySelector(`.rate-input[data-person="${p}"]`);
    const m = document.querySelector(`.months-input[data-person="${p}"]`);
    if (a && document.activeElement !== a) a.value = s.annual;
    if (r && document.activeElement !== r) r.value = s.rate;
    if (m && document.activeElement !== m) m.value = s.months;
  });
}

// 從試算表讀取進帳設定，成功後更新畫面
async function loadIncomeSettings() {
  try {
    const data = await apiCall({ action: 'getSettings' });
    if (data.error) throw new Error(data.error);
    incomeSettings = data.settings || {};
    fillIncomeInputs();
    refreshContribCells();
    renderMembers();
  } catch(e) {
    console.warn('無法讀取進帳設定，使用備用值', e);
  }
}

// 寫回試算表的「設定」工作表
async function saveIncomeSettings(person, next) {
  const data = await apiCall({ action: 'setSettings', data: JSON.stringify({ owner: person, ...next }) });
  if (data.error) throw new Error(data.error);
}

function initIncomeTable() {
  INCOME_PEOPLE.forEach(p => {
    const inputs = {
      annual: document.querySelector(`.income-input[data-person="${p}"]`),
      rate:   document.querySelector(`.rate-input[data-person="${p}"]`),
      months: document.querySelector(`.months-input[data-person="${p}"]`),
    };
    if (!inputs.annual || !inputs.rate || !inputs.months) return;

    const onChange = async () => {
      const def = DEFAULT_INCOME[p];
      const a = parseFloat(inputs.annual.value);
      const r = parseFloat(inputs.rate.value);
      const m = parseInt(inputs.months.value, 10);
      const next = {
        annual: Number.isFinite(a) && a >= 0 ? a : def.annual,
        rate:   Number.isFinite(r) && r >= 0 && r <= 100 ? r : def.rate,
        months: Number.isFinite(m) && m >= 1 && m <= 24 ? m : def.months,
      };
      // 先更新畫面，再寫入試算表
      incomeSettings[p] = next;
      fillIncomeInputs();
      refreshContribCells();
      renderMembers();
      setSyncStatus('loading', '儲存設定中…');
      try {
        await saveIncomeSettings(p, next);
        setSyncStatus('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
        showToast('進帳設定已儲存 ✓');
      } catch(e) {
        setSyncStatus('err', '儲存失敗');
        showToast('進帳設定儲存失敗，請重試');
        loadIncomeSettings(); // 還原成試算表的值
      }
    };
    Object.values(inputs).forEach(inp => inp.addEventListener('change', onChange));
  });
  fillIncomeInputs();
  refreshContribCells();
}

function renderMembers() {
  const people = ['精靈','小狐狸'];
  const prepaid = {'小狐狸':-6300};
  document.getElementById('memberGrid').innerHTML = people.map(p => {
    const expTotal = records.filter(r=>r.owner===p&&r.expense>0).reduce((s,r)=>s+r.expense,0);
    const count = records.filter(r=>r.owner===p&&r.expense>0).length;
    const prep = prepaid[p]||0;
    const emoji = p==='精靈'?'🐎':'🦊';
    // 預計月底轉回 = 本月支出合計 − 先付款項
    const back = expTotal - Math.abs(prep);
    const backSign = back < 0 ? '-' : '';

    // 進帳：預期（依進帳設定）vs 實際（已到帳的匯款，日期未到的另列）
    const expected = monthlyContribOf(p);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const incRecs = records.filter(r => r.owner === p && r.income > 0 && r.item !== '帳戶餘額' && !isSummaryRow(r));
    const isArrived = r => { const d = new Date(r.date); return isNaN(d.getTime()) || d <= endOfToday; };
    const arrivedRecs = incRecs.filter(isArrived);
    const pendingRecs = incRecs.filter(r => !isArrived(r));
    const arrived = arrivedRecs.reduce((s, r) => s + r.income, 0);
    const pending = pendingRecs.reduce((s, r) => s + r.income, 0);
    const gap = arrived - expected;
    const gapHtml = expected > 0
      ? `<span style="color:${gap >= 0 ? 'var(--income)' : 'var(--expense)'}">${gap >= 0 ? '超過 ' : '差 '}${fmt(Math.abs(gap))}</span>`
      : '';

    return `<div class="member-card">
      <div class="member-name">${emoji} ${p}</div>
      <div class="member-stat"><span class="member-stat-label">預期進帳</span><span class="member-stat-value" style="color:var(--text3)">${fmt(expected)}</span></div>
      <div class="member-stat"><span class="member-stat-label">實際進帳（${arrivedRecs.length} 筆）</span><span class="member-stat-value" style="color:var(--income)">+${fmt(arrived)}</span></div>
      <div class="member-stat"><span class="member-stat-label">與預期相比</span><span class="member-stat-value">${gapHtml}</span></div>
      ${pending > 0 ? `<div class="member-stat"><span class="member-stat-label">尚未到帳（${pendingRecs.length} 筆）</span><span class="member-stat-value" style="color:var(--warn)">+${fmt(pending)}</span></div>` : ''}
      ${prep<0?`<div class="member-stat"><span class="member-stat-label">先付款項</span><span class="member-stat-value" style="color:var(--expense)">-${fmt(Math.abs(prep))}</span></div>`:''}
      <div class="member-stat"><span class="member-stat-label">支出筆數</span><span class="member-stat-value">${count} 筆</span></div>
      <div class="member-stat"><span class="member-stat-label">支出合計</span><span class="member-stat-value" style="color:var(--expense)">-${fmt(expTotal)}</span></div>
      <div class="member-stat"><span class="member-stat-label">預計月底轉回</span><span class="member-stat-value" style="color:var(--text)">${backSign}${fmt(Math.abs(back))}</span></div>
    </div>`;
  }).join('');
}

let annualChartInst = null;

async function renderAnnualChart() {
  const yearMatch = currentSheet().match(/(\d{4})\//);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  document.getElementById('annual-title').textContent = `${year} 年度月份收支`;
  const last = annualLastData.get(year);
  if (last && last.summary) {
    drawAnnualChart(year, last.summary); // 先用上次的資料畫
  } else {
    document.getElementById('annual-chart-wrap').innerHTML =
      '<div class="loading-state"><div class="spinner"></div>載入年度數據中…</div>';
    document.getElementById('annual-summary').innerHTML = '';
  }

  renderAnnualAnalysis(year); // 分析與圖表並行

  try {
    const res = await apiCall({ action: 'getAnnualSummary', year });
    const json = JSON.stringify(res);
    const entry = annualLastData.get(year) || {};
    if (entry.summaryJson === json) return; // 資料沒變，不重畫
    annualLastData.set(year, { ...entry, summaryJson: json, summary: res });
    persistAnnualStore();
    drawAnnualChart(year, res);
  } catch (e) {
    if (!last || !last.summary) {
      document.getElementById('annual-chart-wrap').innerHTML =
        '<div class="empty-state">⚠️ 載入失敗，請重試</div>';
    }
  }
}

function drawAnnualChart(year, res) {
  try {
    const monthData = res.summary || [];

    const expVals = monthData.map(d => d.expense);
    const incVals = monthData.map(d => d.income);
    // 未來月份沒有期末餘額：設為 null，水位線就不會畫到未來
    const nowD = new Date();
    const isFutureMonth = d => year > nowD.getFullYear() ||
      (year === nowD.getFullYear() && d.month > nowD.getMonth() + 1);
    // 本月尚未結算，期末餘額多半為 0：若目前選的是本月工作表，改用摘要卡片的「目前帳戶餘額」
    const curMonthNo = nowD.getMonth() + 1;
    const selMatch = currentSheet().match(/(\d{4})\/(\d{1,2})月/);
    const liveCurBalance = (lastSummaryBalance && selMatch &&
      lastSummaryBalance.sheet === currentSheet() &&
      year === nowD.getFullYear() && parseInt(selMatch[2]) === curMonthNo)
      ? lastSummaryBalance.balance : null;
    const balVals = monthData.map(d => {
      if (isFutureMonth(d)) return null;
      if (liveCurBalance !== null && d.month === curMonthNo) return liveCurBalance;
      return d.endingBalance;
    });
    const labels = monthData.map(d => `${d.month}月`);

    document.getElementById('annual-chart-wrap').innerHTML = '<canvas id="annualChart"></canvas>';

    if (annualChartInst) annualChartInst.destroy();
    // 「水位」的漸層底色
    const waterFill = c => {
      const { ctx, chartArea } = c.chart;
      if (!chartArea) return 'rgba(139,92,246,0.15)';
      const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      g.addColorStop(0, 'rgba(139,92,246,0.28)');
      g.addColorStop(1, 'rgba(139,92,246,0)');
      return g;
    };
    // 手機上 Y 軸用「萬」縮短，避免擠在一起
    const shortMoney = v => {
      const n = Number(v) || 0;
      if (Math.abs(n) >= 10000) return (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + '萬';
      return n.toLocaleString();
    };
    const tickFont = { family: 'DM Mono', size: 11 };
    const labelFont = { family: 'Noto Sans TC', size: 11 };

    annualChartInst = new Chart(document.getElementById('annualChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '支出',
            data: expVals,
            backgroundColor: 'rgba(196,90,42,0.85)',
            hoverBackgroundColor: '#c45a2a',
            borderRadius: 6,
            maxBarThickness: 18,
            order: 3
          },
          {
            type: 'bar',
            label: '收入',
            data: incVals,
            backgroundColor: 'rgba(45,122,95,0.75)',
            hoverBackgroundColor: '#2d7a5f',
            borderRadius: 6,
            maxBarThickness: 18,
            order: 3
          },
          {
            type: 'line',
            label: '帳戶水位',
            data: balVals,
            borderColor: '#8b5cf6',
            backgroundColor: waterFill,
            fill: true,
            tension: 0.4,
            cubicInterpolationMode: 'monotone',
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#8b5cf6',
            pointBorderWidth: 2,
            borderWidth: 2.5,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: { usePointStyle: true, boxWidth: 8, font: labelFont, color: '#64748b' }
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            padding: 10,
            titleFont: { family: 'Noto Sans TC', size: 12, weight: '600' },
            bodyFont: { family: 'DM Mono', size: 12 },
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}：$${Math.round(ctx.parsed.y).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: labelFont, color: '#64748b', maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.18)', drawBorder: false },
            border: { display: false },
            ticks: { callback: shortMoney, font: tickFont, color: '#64748b', maxTicksLimit: 5 }
          }
        }
      }
    });

    // 年度彙總卡片
    const totalExp = expVals.reduce((s, v) => s + v, 0);
    const totalInc = incVals.reduce((s, v) => s + v, 0);
    const balance = totalInc - totalExp;
    document.getElementById('annual-summary').innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:12px">
        <div class="card" style="min-width:0"><div class="card-label">年度收入</div><div class="card-value income" style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmt(totalInc)}</div></div>
        <div class="card" style="min-width:0"><div class="card-label">年度支出</div><div class="card-value expense" style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmt(totalExp)}</div></div>
        <div class="card" style="min-width:0;grid-column:1 / -1"><div class="card-label">年度結餘</div>
          <div class="card-value" style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${balance>=0?'var(--income)':'var(--expense)'}">${fmt(balance)}</div>
        </div>
      </div>`;

  } catch(e) {
    document.getElementById('annual-chart-wrap').innerHTML =
      '<div class="empty-state">⚠️ 圖表繪製失敗</div>';
  }
}

// ── 年度消費分析：逐月讀取工作表，彙整支出（規則與 renderAll 一致：排除先付/代墊與彙總列）──
// 逐月讀取某年的支出（不做時間快取；每次都向試算表取最新資料）
async function loadYearExpenses(year, listRes) {
  const sheets = (listRes.sheets || []).filter(s => {
    const m = s.match(/(\d{4})\/(\d{1,2})月/);
    return m && parseInt(m[1]) === year;
  });
  const vers = await getVersions();
  const results = await Promise.all(sheets.map(async s => {
    const month = parseInt(s.match(/\/(\d{1,2})月/)[1]);
    const recs = await fetchMonth(s, vers, false);
    const exp = recs.filter(r =>
      !isSummaryRow(r) && r.owner !== '' && r.expense > 0 && !(r.note && r.note.includes('先付')));
    return { month, exp };
  }));
  return results;
}

// 上次成功載入的資料（記憶體內）：先顯示它，再背景更新
const ANNUAL_STORE_KEY = 'shareExpense.annualCache.v1';
function loadAnnualStore() {
  try {
    const obj = JSON.parse(localStorage.getItem(ANNUAL_STORE_KEY) || '{}');
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
  } catch (e) { return new Map(); }
}
const annualLastData = loadAnnualStore(); // year -> { summaryJson, summary, analysisJson, analysis }
function persistAnnualStore() {
  try {
    localStorage.setItem(ANNUAL_STORE_KEY, JSON.stringify(Object.fromEntries(annualLastData)));
  } catch (e) { /* 無痕模式或空間不足時略過，不影響正常使用 */ }
}

async function renderAnnualAnalysis(year) {
  const box = document.getElementById('annual-analysis');
  const last = annualLastData.get(year);
  if (last && last.analysis) {
    showAnnualAnalysis(year, last.analysis.cur, last.analysis.prev);
  } else {
    box.innerHTML = '<div class="loading-state"><div class="spinner"></div>分析年度消費中…</div>';
  }

  try {
    const listRes = await apiCall({ action: 'getSheets' });
    const [cur, prev] = await Promise.all([loadYearExpenses(year, listRes), loadYearExpenses(year - 1, listRes)]);
    const json = JSON.stringify([cur, prev]);
    const entry = annualLastData.get(year) || {};
    if (entry.analysisJson === json) return; // 資料沒變，不重畫
    annualLastData.set(year, { ...entry, analysisJson: json, analysis: { cur, prev } });
    persistAnnualStore();
    showAnnualAnalysis(year, cur, prev);
  } catch (e) {
    if (!last || !last.analysis) box.innerHTML = '<div class="empty-state">⚠️ 年度分析載入失敗</div>';
  }
}

function showAnnualAnalysis(year, cur, prev) {
  const box = document.getElementById('annual-analysis');
  try {
    if (!cur.length) { box.innerHTML = ''; return; }

    // 去年同期比較（只比較今年已有資料的月份）
    const monthsWithData = cur.map(c => c.month);
    const lastMonth = Math.max(...monthsWithData);

    const monthTotals = Array(12).fill(0);
    const byCat = {}, byItem = {}, byOwner = {};
    const byCatMonth = {}; // 每個分類各月的支出，點開分類時顯示
    let total = 0, biggest = null;
    cur.forEach(({ month, exp }) => {
      exp.forEach(r => {
        monthTotals[month - 1] += r.expense;
        total += r.expense;
        const cat = categorize(r.item);
        byCat[cat] = (byCat[cat] || 0) + r.expense;
        if (!byCatMonth[cat]) byCatMonth[cat] = Array(12).fill(0);
        byCatMonth[cat][month - 1] += r.expense;
        byItem[r.item] = (byItem[r.item] || 0) + r.expense;
        byOwner[r.owner] = (byOwner[r.owner] || 0) + r.expense;
        if (!biggest || r.expense > biggest.expense) biggest = { ...r, month };
      });
    });
    if (total === 0) { box.innerHTML = '<div class="empty-state">這一年還沒有支出紀錄</div>'; return; }

    const activeMonths = cur.filter(c => c.exp.length > 0).length;
    const avg = total / activeMonths;
    const peakIdx = monthTotals.indexOf(Math.max(...monthTotals));

    const curSamePeriod = cur.reduce((s, c) => s + (c.month <= lastMonth ? c.exp.reduce((a, r) => a + r.expense, 0) : 0), 0);
    const prevSamePeriod = prev.reduce((s, c) => s + (c.month <= lastMonth ? c.exp.reduce((a, r) => a + r.expense, 0) : 0), 0);
    const yoy = prevSamePeriod > 0 ? Math.round((curSamePeriod - prevSamePeriod) / prevSamePeriod * 100) : null;

    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const items = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const owners = Object.entries(byOwner).sort((a, b) => b[1] - a[1]);
    const maxMonth = Math.max(...monthTotals, 1);
    const maxCat = cats.length ? cats[0][1] : 1;
    const maxItem = items.length ? items[0][1] : 1;

    const yoyHtml = yoy === null ? '—'
      : `<span style="color:${yoy > 0 ? 'var(--expense)' : 'var(--income)'}">${yoy > 0 ? '▲' : '▼'} ${Math.abs(yoy)}%</span>`;

    box.innerHTML = `
      <p class="section-title" style="margin-top:22px">${year} 年消費分析</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="card"><div class="card-label">年度總支出</div><div class="card-value expense">${fmt(total)}</div></div>
        <div class="card"><div class="card-label">月平均（${activeMonths} 個月）</div><div class="card-value">${fmt(avg)}</div></div>
        <div class="card"><div class="card-label">最高月份</div><div class="card-value" style="font-size:18px">${peakIdx + 1} 月 · ${fmt(monthTotals[peakIdx])}</div></div>
        <div class="card"><div class="card-label">去年同期比較</div><div class="card-value" style="font-size:18px">${yoyHtml}</div></div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="card-label">單筆最大支出</div>
        <div style="font-size:15px;margin-top:4px">${esc(biggest.item)}　<strong style="font-family:'DM Mono',monospace">${fmt(biggest.expense)}</strong>　<span style="color:var(--text3);font-size:12px">${biggest.month} 月</span></div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="card-label">每月支出</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin-top:10px">
          ${monthTotals.map((v, i) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
              <div style="width:100%;height:${Math.round(v / maxMonth * 100)}%;min-height:${v > 0 ? 2 : 0}px;background:${i === peakIdx ? 'var(--expense)' : 'var(--accent, #6366f1)'};border-radius:4px 4px 0 0;opacity:${v > 0 ? 1 : 0.2}"></div>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">${i + 1}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="card-label">分類佔比</div>
        ${cats.map(([name, v]) => {
          const mm = byCatMonth[name] || Array(12).fill(0);
          const mMax = Math.max(...mm, 1);
          return `
          <details style="margin-top:8px">
            <summary style="list-style:none;cursor:pointer">
              <div style="display:flex;justify-content:space-between;font-size:14px">
                <span>${CAT_EMOJI[name] || '📋'} ${esc(name)} <span style="color:var(--text3);font-size:11px">▾ 每月</span></span>
                <span style="font-family:'DM Mono',monospace">${fmt(v)} · ${Math.round(v / total * 100)}%</span>
              </div>
              <div style="height:6px;background:var(--border);border-radius:99px;margin-top:4px;overflow:hidden">
                <div style="height:100%;width:${Math.round(v / maxCat * 100)}%;background:var(--accent, #6366f1)"></div>
              </div>
            </summary>
            <div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--border)">
              ${mm.map((x, i) => x > 0 ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
                  <span>${i + 1} 月</span>
                  <span style="font-family:'DM Mono',monospace">${fmt(x)}</span>
                </div>
                <div style="height:4px;background:transparent;margin-bottom:4px">
                  <div style="height:100%;width:${Math.round(x / mMax * 100)}%;background:var(--expense);border-radius:99px"></div>
                </div>` : '').join('') || '<div style="font-size:13px;color:var(--text3)">沒有紀錄</div>'}
            </div>
          </details>`;
        }).join('')}
      </div>

      <div class="card" style="margin-top:10px">
        <div class="card-label">花最多的項目 Top ${items.length}</div>
        ${items.map(([name, v], i) => `
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;font-size:14px">
              <span>${i + 1}. ${esc(name)}</span>
              <span style="font-family:'DM Mono',monospace">${fmt(v)}</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:99px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${Math.round(v / maxItem * 100)}%;background:var(--expense)"></div>
            </div>
          </div>`).join('')}
      </div>

      <div class="card" style="margin-top:10px">
        <div class="card-label">兩人支出比例</div>
        ${owners.map(([name, v]) => `
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;font-size:14px">
              <span>${esc(name)}</span>
              <span style="font-family:'DM Mono',monospace">${fmt(v)} · ${Math.round(v / total * 100)}%</span>
            </div>
          </div>`).join('')}
      </div>
    `;
  } catch (e) {
    box.innerHTML = '<div class="empty-state">⚠️ 年度分析載入失敗</div>';
  }
}

function switchTab(name, el) {
  ['records','analysis','members','annual','island','office','inventory'].forEach(t => {
    const tabEl = document.getElementById('tab-'+t);
    if (tabEl) tabEl.style.display = t===name ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  
  // 切換出小島時，停止動畫循環以節省效能與電力
  if (name !== 'island' && islandAnimationId) {
    cancelAnimationFrame(islandAnimationId);
    islandAnimationId = null;
  }
  
  if (name === 'analysis') setTimeout(renderCharts, 50);
  if (name === 'members') renderMembers();
  if (name === 'annual') renderAnnualChart();
  if (name === 'island') setTimeout(renderIsland, 50);
  if (name === 'office' && typeof renderOffice === 'function') renderOffice();
  if (name !== 'office' && typeof officeStopBubbles === 'function') officeStopBubbles();
  if (name === 'inventory') loadInventory();
}

let editingRecord = null; // 正在編輯的記錄；null 代表新增

// 把試算表的日期轉成 MM/DD 供輸入框使用
function toMMDD(raw) {
  const s = String(raw || '').trim();
  const short = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (short) return short[1].padStart(2,'0') + '/' + short[2].padStart(2,'0');
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
}

// rec 有值時為編輯模式，預先填入該筆資料
// 項目建議：從已有的紀錄取出項目名稱，依出現次數排序（排除系統列）
function buildItemSuggestions() {
  const counts = new Map();
  records.forEach(r => {
    const item = String(r.item || '').trim();
    if (!item) return;
    if (item.includes('總收入/支出') || item.includes('支出部分轉回') || item === '帳戶餘額' || r.owner === '帳戶餘額') return;
    counts.set(item, (counts.get(item) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([name]) => name);
}

function openModal(rec) {
  editingRecord = rec || null;
  const isEdit = !!editingRecord;
  const today = new Date();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const dateVal = isEdit ? toMMDD(rec.date) : `${mm}/${dd}`;
  const ownerVal = isEdit ? rec.owner : '精靈';
  const itemVal = isEdit ? esc(rec.item) : '';
  const amountVal = isEdit ? (rec.income > 0 ? rec.income : rec.expense) : '';
  const noteVal = isEdit ? esc(rec.note || '') : '';
  const title = isEdit ? '編輯記錄' : '新增記錄';
  amountType = isEdit && rec.income > 0 ? 'income' : 'expense';

  document.getElementById('overlayContainer').innerHTML = `
    <div class="overlay" id="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-header"><span class="modal-title">${title}</span><button class="modal-close" aria-label="關閉" onclick="closeModal()">×</button></div>
        <div class="amount-toggle">
          <button class="toggle-btn" id="toggleExpense" onclick="setType('expense')">支出 −</button>
          <button class="toggle-btn" id="toggleIncome" onclick="setType('income')">收入 ＋</button>
        </div>
        <div class="row2">
          <div class="field"><label>日期</label><input id="f-date" type="text" value="${dateVal}" placeholder="MM/DD"></div>
          <div class="field"><label>擁有者</label><select id="f-owner">
            <option value="精靈" ${ownerVal==='精靈'?'selected':''}>🐎 精靈</option>
            <option value="小狐狸" ${ownerVal==='小狐狸'?'selected':''}>🦊 小狐狸</option>
          </select></div>
        </div>
        <div class="field"><label>項目</label><input id="f-item" type="text" placeholder="例：竹南 全聯" value="${itemVal}" list="item-suggest" autocomplete="off"><datalist id="item-suggest">${buildItemSuggestions().map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist></div>
        <div class="field"><label>金額</label><input id="f-amount" type="number" placeholder="0" min="0" inputmode="numeric" value="${amountVal}"></div>
        <div class="field"><label>備註</label><textarea id="f-note" placeholder="選填">${noteVal}</textarea></div>
        ${isEdit ? '' : `<label class="inv-link"><input type="checkbox" id="f-inv" ${shouldLinkInventory(itemVal, noteVal) ? 'checked' : ''}> 同時加入家用品庫存（從備註抓取，例：衛生紙×2、洗衣精）</label>`}
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">取消</button>
          <button class="btn-save" id="saveBtn" onclick="submitRecord()">${isEdit ? '儲存變更' : '儲存'}</button>
        </div>
      </div>
    </div>`;
  setType(amountType);
  // 項目或備註變動時，自動判斷是否要加入庫存（可手動再改）
  const syncInvCheck = () => {
    const c = document.getElementById('f-inv');
    if (c) c.checked = shouldLinkInventory(document.getElementById('f-item').value, document.getElementById('f-note').value);
  };
  document.getElementById('f-item').addEventListener('input', syncInvCheck);
  document.getElementById('f-note').addEventListener('input', syncInvCheck);
  document.getElementById('f-item').focus();
}

// 依列號找到記錄並開啟編輯
function editRecordByRow(row) {
  const rec = records.find(r => r.row === row);
  if (rec) openModal(rec);
}

function setType(type) {
  amountType = type;
  document.getElementById('toggleExpense').style.cssText = type==='expense'?'background:var(--fox-bg);color:var(--expense)':'';
  document.getElementById('toggleIncome').style.cssText = type==='income'?'background:var(--elf-bg);color:var(--income)':'';
}

function closeModal() { editingRecord = null; document.getElementById('overlayContainer').innerHTML=''; }

// 接受 MM/DD 或 YYYY/MM/DD，並檢查月份與日期範圍
function isValidDateInput(s) {
  const m = s.match(/^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})$/);
  if (!m) return false;
  const month = parseInt(m[2], 10), day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1) return false;
  const year = m[1] ? parseInt(m[1], 10) : 2024; // 只檢查日數上限，閏年以 2024 計
  return day <= new Date(year, month, 0).getDate();
}

async function submitRecord() {
  const date = document.getElementById('f-date').value.trim();
  const owner = document.getElementById('f-owner').value;
  const item = document.getElementById('f-item').value.trim();
  const amount = parseFloat(document.getElementById('f-amount').value)||0;
  const note = document.getElementById('f-note').value.trim();
  if (!date||!item||amount<=0) { showToast('請填寫日期、項目和金額'); return; }
  if (!isValidDateInput(date)) { showToast('日期格式請用 MM/DD（例如 10/24）'); return; }
  const btn = document.getElementById('saveBtn');
  btn.disabled=true; btn.textContent='儲存中…';
  const payload = { date, owner, item, income: amountType==='income'?amount:0, expense: amountType==='expense'?amount:0, note };
  const invChk = document.getElementById('f-inv');
  const linkInv = !editingRecord && amountType === 'expense' && !!(invChk && invChk.checked);
  if (editingRecord) await updateRecordApi(editingRecord, payload);
  else await addRecord(payload);
  if (linkInv) addItemsFromNote(note, item).catch(() => showToast('已記帳，但加入庫存失敗'));
  closeModal();
}

function showToast(msg, action) {
  const t = document.createElement('div');
  t.className = 'toast';
  const text = document.createElement('span');
  text.textContent = msg;
  t.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = () => { t.remove(); action.onClick(); };
    t.appendChild(btn);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), action ? 5000 : 2200);
}

function sheetNameToLabel(name) {
  const m = name.match(/(\d{4})\/(\d{1,2})月/);
  if (!m) return name;
  return m[1] + ' 年 ' + m[2] + ' 月';
}

async function initSheets() {
  try {
    const data = await apiCall({ action: 'getSheets' });
    const sheets = data.sheets || [];
    const sel = document.getElementById('monthSel');
    sheets.sort((a,b) => {
      const ma=a.match(/(\d{4})\/(\d{1,2})月/), mb=b.match(/(\d{4})\/(\d{1,2})月/);
      if(!ma||!mb) return 0;
      return (parseInt(mb[1])*100+parseInt(mb[2])) - (parseInt(ma[1])*100+parseInt(ma[2]));
    });
    sel.innerHTML = sheets.map(s=>`<option value="${s}">${sheetNameToLabel(s)}</option>`).join('');
    const now = new Date();
    const curSheet = sheets.find(s => { const m=s.match(/(\d{4})\/(\d{1,2})月/); return m&&parseInt(m[1])===now.getFullYear()&&parseInt(m[2])===now.getMonth()+1; });
    if (curSheet) sel.value=curSheet;
    else if (sheets.length>0) sel.value=sheets[0];
  } catch(e) { console.error('無法載入工作表清單',e); }
  await loadData();
  // 當月載入完成後，背景再抓其他月份
  setTimeout(() => { prefetchOtherMonths(); }, 500);
}

// ── INIT ─────────────────────────────────────────────────────
applyMonthTheme(getAutoMonth());
// 圖表文字與格線配合深色底
if (window.Chart) {
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = 'rgba(100,116,139,0.18)';
}
initIncomeTable();
initSheets();

// 按 Esc 關閉彈出視窗
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeSeasonModal(); }
});
preloadAssets(() => {
  const islandTab = document.getElementById('tab-island');
  if (islandTab && islandTab.style.display !== 'none') {
    renderIsland();
  }
});

// ── 視覺小島 (Visual Island) 繪圖引擎 ──────────────────────────

function preloadAssets(callback) {
  let loadedCount = 0;
  const keys = Object.keys(ASSET_FILES);
  const total = keys.length;
  
  keys.forEach(key => {
    const img = new Image();
    img.src = ASSET_FILES[key];
    img.onload = () => {
      ASSETS[key] = img;
      loadedCount++;
      if (loadedCount === total) {
        assetsLoaded = true;
        if (callback) callback();
      }
    };
    img.onerror = () => {
      if (!img._retried) {
        // 失敗先重試一次（避免偶發的網路問題讓整棟建築永遠畫成線條）
        img._retried = true;
        setTimeout(() => { img.src = ASSET_FILES[key] + '&r=1'; }, 1500);
        return;
      }
      console.warn("Failed to load asset: " + key);
      loadedCount++;
      if (loadedCount === total) {
        assetsLoaded = true;
        if (callback) callback();
      }
    };
  });
}

// 獲取當前分類支出
function getCategoryExpenses() {
  const catExpenses = {
    dining: 0,
    grocery: 0,
    travel: 0,
    transport: 0,
    rent: 0,
    utilities: 0,
    shopping: 0,
    transfer: 0
  };
  
  const realRecs = records.filter(r => !isSummaryRow(r));
  realRecs.forEach(r => {
    // 專門處理「每月的愛」（屬於收入項，故加總其 income 金額）
    if (r.item && r.item.includes('每月的愛')) {
      catExpenses.transfer += (r.income || 0);
      return;
    }
    
    if (r.expense <= 0) return;
    const cat = categorize(r.item);
    if (cat === '餐飲' || cat === '飲料') {
      catExpenses.dining += r.expense;
    } else if (cat === '超市採購' || cat === '便利商店') {
      catExpenses.grocery += r.expense;
    } else if (cat === '住宿旅遊' || cat === '景點' || cat === '表演展覽') {
      catExpenses.travel += r.expense;
    } else if (cat === '交通') {
      catExpenses.transport += r.expense;
    } else if (cat === '房租') {
      catExpenses.rent += r.expense;
    } else if (['電費', '水費', '瓦斯費', '網路與第四台', '社區管理費', '水電雜支'].includes(cat)) {
      catExpenses.utilities += r.expense;
    } else if (cat === '網購') {
      catExpenses.shopping += r.expense;
    }
  });
  
  return catExpenses;
}

// 獲取當前帳戶餘額
function getAccountBalance() {
  const realRecs = records.filter(r => !isSummaryRow(r));
  const startingRec = records.find(r => r.item === '帳戶餘額' && r.owner === '');
  const startingBalance = startingRec ? startingRec.income : 0;
  const totalIncome = realRecs.filter(r => r.owner !== '' && r.item !== '帳戶餘額').reduce((s,r) => s + r.income, 0);
  const isPrepaid = r => r.note && r.note.includes('先付');
  const totalExpense = realRecs.filter(r => !isPrepaid(r)).reduce((s,r) => s + r.expense, 0);
  
  const transferRecs = records.filter(r => r.item.includes('支出部分轉回'));
  const isSettled = transferRecs.some(r => r.expense > 0);
  
  let balance = startingBalance + arrivedIncomeOf(realRecs) - totalExpense;
  if (isSettled && transferRecs.length > 0) {
    const lastTransfer = transferRecs[transferRecs.length - 1];
    balance = (lastTransfer.income || 0) - (lastTransfer.expense || 0);
  }
  return balance;
}

// 主小島繪製邏輯
function renderIsland() {
  const canvas = document.getElementById('islandCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // 註冊滑鼠與觸控手勢 (拖曳平移、雙指/滾輪縮放、雙擊重設)
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1.0;
  
  function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  
  canvas.onmousedown = (e) => {
    isDragging = true;
    const coords = getPointerCoords(e);
    lastPointerX = coords.x;
    lastPointerY = coords.y;
    
    const rect = canvas.getBoundingClientRect();
    mouseX = coords.x - rect.left;
    mouseY = coords.y - rect.top;
    e.preventDefault();
  };
  
  canvas.onmousemove = (e) => {
    const coords = getPointerCoords(e);
    const rect = canvas.getBoundingClientRect();
    mouseX = coords.x - rect.left;
    mouseY = coords.y - rect.top;
    
    if (!isDragging) return;
    const dx = coords.x - lastPointerX;
    const dy = coords.y - lastPointerY;
    
    islandOffsetX += dx;
    islandOffsetY += dy;
    
    const maxPan = 500;
    islandOffsetX = Math.min(Math.max(islandOffsetX, -maxPan), maxPan);
    islandOffsetY = Math.min(Math.max(islandOffsetY, -maxPan), maxPan);
    
    lastPointerX = coords.x;
    lastPointerY = coords.y;
    e.preventDefault();
  };
  
  canvas.onmouseup = canvas.onmouseleave = () => {
    isDragging = false;
    mouseX = -1000;
    mouseY = -1000;
  };
  
  canvas.ontouchstart = (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      const coords = getPointerCoords(e);
      lastPointerX = coords.x;
      lastPointerY = coords.y;
      
      const rect = canvas.getBoundingClientRect();
      mouseX = coords.x - rect.left;
      mouseY = coords.y - rect.top;
    } else if (e.touches.length === 2) {
      isDragging = false;
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartScale = islandZoom;
    }
  };
  
  canvas.ontouchmove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      const coords = getPointerCoords(e);
      const dx = coords.x - lastPointerX;
      const dy = coords.y - lastPointerY;
      islandOffsetX += dx;
      islandOffsetY += dy;
      
      const maxPan = 500;
      islandOffsetX = Math.min(Math.max(islandOffsetX, -maxPan), maxPan);
      islandOffsetY = Math.min(Math.max(islandOffsetY, -maxPan), maxPan);
      
      const rect = canvas.getBoundingClientRect();
      mouseX = coords.x - rect.left;
      mouseY = coords.y - rect.top;
      
      lastPointerX = coords.x;
      lastPointerY = coords.y;
      e.preventDefault();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchStartDist > 0) {
        const factor = dist / pinchStartDist;
        islandZoom = Math.min(Math.max(pinchStartScale * factor, 0.4), 4.0);
      }
      e.preventDefault();
    }
  };
  
  canvas.ontouchend = () => {
    isDragging = false;
    pinchStartDist = 0;
    mouseX = -1000;
    mouseY = -1000;
  };
  
  canvas.onwheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    islandZoom = Math.min(Math.max(islandZoom * zoomFactor, 0.4), 4.0);
  };
  
  const width = canvas.parentElement.clientWidth || 500;
  const height = 500;
  const defaultZoom = (width / 900) * 0.96; // 讓小島寬度佔滿畫布寬度
  if (islandZoom === null) {
    islandZoom = defaultZoom;
  }
  
  canvas.ondblclick = (e) => {
    islandZoom = defaultZoom;
    islandOffsetX = 0;
    islandOffsetY = 0;
    e.preventDefault();
  };
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  const catExpenses = getCategoryExpenses();
  const balance = getAccountBalance();
  
  updateIslandLegend(catExpenses, balance);
  
  if (islandAnimationId) {
    cancelAnimationFrame(islandAnimationId);
  }
  
  const baseCx = width / 2;
  const baseCy = 300; // 往下拉並對齊草地中心 (調降至 390 配合較大間距，讓地標完美均勻分佈在整片草地上)
  
  const tileW = 76;
  const tileH = 38;
  
  function animLoop() {
    const islandTab = document.getElementById('tab-island');
    if (!islandTab || islandTab.style.display === 'none') {
      return;
    }
    
    ctx.clearRect(0, 0, width, height);
    
    // 1. 繪製緩慢移動的雲朵
    cloudOffset += 0.15;
    if (cloudOffset > width + 60) cloudOffset = -60;
    drawCloud(ctx, cloudOffset, 35, 18);
    drawCloud(ctx, (cloudOffset + width / 2) % (width + 120) - 60, 65, 22);
    
    ctx.save();
    // 應用手勢縮放與平移 (繞著畫布中心縮放)
    ctx.translate(width / 2 + islandOffsetX, height / 2 + islandOffsetY);
    ctx.scale(islandZoom, islandZoom);
    ctx.translate(-width / 2, -height / 2);
    
    // 2. 繪製浮空島嶼基座
    drawBaseIsland(ctx, baseCx, baseCy, tileW, tileH);
    
    // 3. 按照深度排序繪製地標 (row + col 越小在越後方，先繪製；越大在越前方，後繪製)
    windmillAngle += 0.03;
    const floatY = Math.sin(Date.now() / 450) * 8.5;
    
    const drawOrder = [
      { r: 0, c: 0, type: 'castle', val: balance },
      { r: 0, c: 0, type: 'transfer', val: catExpenses.transfer }, // 熱氣球移至莊園上方
      { r: 0, c: 1, type: 'dining', val: catExpenses.dining },
      { r: 0, c: 2, type: 'grocery', val: catExpenses.grocery },
      { r: 1, c: 1, type: 'utilities', val: catExpenses.utilities },
      { r: 2, c: 0, type: 'transport', val: catExpenses.transport },
      { r: 1, c: 2, type: 'travel', val: catExpenses.travel },
      { r: 2, c: 1, type: 'shopping', val: catExpenses.shopping },
      { r: 2, c: 2, type: 'rent', val: catExpenses.rent }
    ];
    
    const localMouseX = (mouseX - width / 2 - islandOffsetX) / islandZoom + width / 2;
    const localMouseY = (mouseY - height / 2 - islandOffsetY) / islandZoom + height / 2;
    
    const spacing = 165; // 配合地標放大，將格點間距擴大至 165，讓地標往草地四周均勻擴散分佈
    
    // 每個地標的微調偏移量，特別將靠近樹木的 transport 往左下偏移較多，其餘微調以保持美觀
    const offsets = {
      'castle': { x: -15, y: 120 },
      'transfer': { x: -10, y: 80 },
      'dining': { x: 0, y: 150 },
      'grocery': { x: 350, y: 180 },
      'utilities': { x: 300, y: 170 },
      'travel': { x: 0, y: 175 },
      'transport': { x: -115, y: 130 }, // 往左下移，在較大間距下徹底避開右側樹木
      'shopping': { x: 0, y: 180 },
      'rent': { x: 0, y: 220 }
    };

    drawOrder.forEach(item => {
      const dx = (item.r - 1) * spacing;
      const dy = (item.c - 1) * spacing;
      let cx = baseCx + (dx - dy);
      let cy = baseCy + (dx + dy) * 0.46;
      
      // 套用自訂微調偏移量
      const offset = offsets[item.type] || { x: 0, y: 0 };
      cx += offset.x;
      cy += offset.y;
      
      let finalCy = cy;
      let finalFloatY = floatY;
      
      if (item.type === 'transfer') {
        // 根據帳戶餘額地標的尺寸動態調整熱氣球的高度 (配合 1.25 倍放大)
        let castleSize = 140;
        if (balance < 5000) castleSize = 75;
        else if (balance < 20000) castleSize = 90;
        else if (balance < 50000) castleSize = 110;
        finalFloatY = floatY + (castleSize * 1.25) + 25;
      }
      
      drawIsoBuilding(ctx, cx, finalCy, item.type, item.val, windmillAngle, finalFloatY, localMouseX, localMouseY);
    });
    
    ctx.restore();
    
    islandAnimationId = requestAnimationFrame(animLoop);
  }
  
  animLoop();
}

// 繪製雲朵
function drawCloud(ctx, x, y, r) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x - r * 0.6, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.6, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// 繪製島嶼基座 (草地及岩土層)
function drawBaseIsland(ctx, cx, cy, tileW, tileH) {
  if (ASSETS.island_base) {
    try {
      const img = ASSETS.island_base;
      const w = 900;
      const imgW = img.naturalWidth || img.width || 1;
      const imgH = img.naturalHeight || img.height || 1;
      const h = w * (imgH / imgW);
      ctx.drawImage(img, Math.round(cx - w/2), Math.round(cy - h/2 + 135), Math.round(w), Math.round(h));
      return;
    } catch (err) {
      console.warn('Failed to draw island_base, falling back to lines:', err);
    }
  }

  const w = tileW * 3.5;
  const h = tileH * 3.5;
  const w2 = w / 2;
  const h2 = h / 2;
  const baseHeight = 65; // 下方浮空岩層厚度
  
  // 1. 繪製底部黃褐色泥土與灰色岩石基底 (錐形浮空島)
  ctx.fillStyle = "#8a7560"; // 主泥土色
  ctx.beginPath();
  ctx.moveTo(cx - w2, cy);
  ctx.lineTo(cx, cy + h2);
  ctx.lineTo(cx + w2, cy);
  ctx.lineTo(cx + 8, cy + h2 + baseHeight - 10);
  ctx.lineTo(cx - 12, cy + h2 + baseHeight);
  ctx.closePath();
  ctx.fill();
  
  // 陰影側岩石
  ctx.fillStyle = "#6d5947";
  ctx.beginPath();
  ctx.moveTo(cx, cy + h2);
  ctx.lineTo(cx + w2, cy);
  ctx.lineTo(cx + 8, cy + h2 + baseHeight - 10);
  ctx.closePath();
  ctx.fill();
  
  // 岩石裂紋點綴
  ctx.fillStyle = "#4a3c30";
  ctx.beginPath();
  ctx.moveTo(cx - w2 / 2, cy + h2 / 2);
  ctx.lineTo(cx - w2 / 2 + 15, cy + h2 / 2 + 10);
  ctx.lineTo(cx - w2 / 2 + 8, cy + h2 / 2 + 20);
  ctx.closePath();
  ctx.fill();
  
  // 2. 繪製頂層綠色草地
  const grassColor = getComputedStyle(document.body).getPropertyValue('--income').trim() || "#2d7a5f";
  ctx.fillStyle = grassColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h2);
  ctx.lineTo(cx + w2, cy);
  ctx.lineTo(cx, cy + h2);
  ctx.lineTo(cx - w2, cy);
  ctx.closePath();
  ctx.fill();
  
  // 草地邊緣厚度
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.moveTo(cx - w2, cy);
  ctx.lineTo(cx, cy + h2);
  ctx.lineTo(cx, cy + h2 + 4);
  ctx.lineTo(cx - w2, cy + 4);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(cx, cy + h2);
  ctx.lineTo(cx + w2, cy);
  ctx.lineTo(cx + w2, cy + 4);
  ctx.lineTo(cx, cy + h2 + 4);
  ctx.closePath();
  ctx.fill();
}
// 繪製立體方塊 (Cube)
function drawIsoBlock(ctx, cx, cy, w, h, colTop, colLeft, colRight) {
  const w2 = w / 2;
  const h2 = w / 4;
  const ty = cy - h; // 頂端的高度位移
  
  // 1. 左側面 (Left Face)
  ctx.fillStyle = colLeft;
  ctx.beginPath();
  ctx.moveTo(cx - w2, cy);
  ctx.lineTo(cx, cy + h2);
  ctx.lineTo(cx, cy + h2 - h);
  ctx.lineTo(cx - w2, cy - h);
  ctx.closePath();
  ctx.fill();
  
  // 2. 右側面 (Right Face)
  ctx.fillStyle = colRight;
  ctx.beginPath();
  ctx.moveTo(cx, cy + h2);
  ctx.lineTo(cx + w2, cy);
  ctx.lineTo(cx + w2, cy - h);
  ctx.lineTo(cx, cy + h2 - h);
  ctx.closePath();
  ctx.fill();
  
  // 3. 頂面 (Top Face)
  ctx.fillStyle = colTop;
  ctx.beginPath();
  ctx.moveTo(cx, ty - h2);
  ctx.lineTo(cx + w2, ty);
  ctx.lineTo(cx, ty + h2);
  ctx.lineTo(cx - w2, ty);
  ctx.closePath();
  ctx.fill();
}

// 繪製立體角錐 (Pyramid - 用於屋頂)
function drawIsoPyramid(ctx, cx, cy, w, h, roofH, colLeft, colRight) {
  const w2 = w / 2;
  const h2 = w / 4;
  const ty = cy - h;
  const py = ty - roofH; // 角錐頂尖的高點
  
  // 1. 左側面
  ctx.fillStyle = colLeft;
  ctx.beginPath();
  ctx.moveTo(cx - w2, ty);
  ctx.lineTo(cx, ty + h2);
  ctx.lineTo(cx, py);
  ctx.closePath();
  ctx.fill();
  
  // 2. 右側面
  ctx.fillStyle = colRight;
  ctx.beginPath();
  ctx.moveTo(cx, ty + h2);
  ctx.lineTo(cx + w2, ty);
  ctx.lineTo(cx, py);
  ctx.closePath();
  ctx.fill();
}

// 繪製立體圓柱 (Cylinder)
function drawIsoCylinder(ctx, cx, cy, w, h, colTop, colSideStart, colSideEnd) {
  const w2 = w / 2;
  const h2 = w / 4;
  
  // 1. 柱體側面 (漸層著色)
  const grad = ctx.createLinearGradient(cx - w2, 0, cx + w2, 0);
  grad.addColorStop(0, colSideStart);
  grad.addColorStop(1, colSideEnd);
  ctx.fillStyle = grad;
  
  ctx.beginPath();
  ctx.moveTo(cx - w2, cy - h);
  ctx.lineTo(cx - w2, cy);
  ctx.ellipse(cx, cy, w2, h2, 0, Math.PI, 0, true);
  ctx.lineTo(cx + w2, cy - h);
  ctx.ellipse(cx, cy - h, w2, h2, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  
  // 2. 圓形頂蓋
  ctx.fillStyle = colTop;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h, w2, h2, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// 繪製小樹
function drawIsoTree(ctx, cx, cy, trunkH, leafR, colTrunk, colLeaves) {
  // 樹幹
  ctx.fillStyle = colTrunk;
  ctx.fillRect(cx - 2, cy - trunkH, 4, trunkH);
  
  // 樹葉 (三圓重疊蓬鬆質感)
  ctx.fillStyle = colLeaves;
  ctx.beginPath();
  ctx.arc(cx, cy - trunkH - 2, leafR, 0, Math.PI * 2);
  ctx.arc(cx - leafR * 0.5, cy - trunkH - leafR * 0.5, leafR * 0.8, 0, Math.PI * 2);
  ctx.arc(cx + leafR * 0.5, cy - trunkH - leafR * 0.5, leafR * 0.8, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// 繪製旋轉風車
function drawIsoWindmill(ctx, cx, cy, h, angle, colTower, colBlades) {
  // 塔身 (梯形)
  ctx.fillStyle = colTower;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx - 4, cy - h);
  ctx.lineTo(cx + 4, cy - h);
  ctx.lineTo(cx + 8, cy);
  ctx.closePath();
  ctx.fill();
  
  // 扇葉轉軸
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy - h, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // 四片旋轉扇葉
  ctx.strokeStyle = colBlades;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a = angle + (i * Math.PI / 2);
    const bx = cx + Math.cos(a) * 20;
    const by = cy - h + Math.sin(a) * 20;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

// 繪製熱氣球
function drawIsoBalloon(ctx, cx, cy, floatY, colBalloon, colBasket) {
  const by = cy - floatY;
  
  // 吊繩
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 4, by - 10);
  ctx.lineTo(cx - 3, by);
  ctx.moveTo(cx + 4, by - 10);
  ctx.lineTo(cx + 3, by);
  ctx.stroke();
  
  // 籃子
  ctx.fillStyle = colBasket;
  ctx.fillRect(cx - 4, by, 8, 7);
  
  // 氣球球體 (主圓及下緣梯形)
  ctx.fillStyle = colBalloon;
  ctx.beginPath();
  ctx.arc(cx, by - 22, 12, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(cx - 8, by - 17);
  ctx.lineTo(cx + 8, by - 17);
  ctx.lineTo(cx + 4, by - 10);
  ctx.lineTo(cx - 4, by - 10);
  ctx.closePath();
  ctx.fill();
  
  // 條紋裝飾
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, by - 22, 4, 12, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// 繪製花草 (0元消費展示)
function drawIsoFlower(ctx, cx, cy, col) {
  // 莖
  ctx.strokeStyle = "#4d7c0f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 1);
  ctx.lineTo(cx, cy - 5);
  ctx.stroke();
  
  // 花瓣
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 5, 2, 0, Math.PI * 2);
  ctx.arc(cx + 2, cy - 5, 2, 0, Math.PI * 2);
  ctx.arc(cx, cy - 7, 2, 0, Math.PI * 2);
  ctx.arc(cx, cy - 3, 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  
  // 花蕊
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 1.2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawIsoBuilding(ctx, cx, cy, type, value, angle, floatY) {
  {
    const assetMap = {
      dining: { img: ASSETS.cafe, zeroColor: "#fef08a", th1: 1500, th2: 6000 },
      grocery: { img: ASSETS.grocery_garden, zeroColor: "#bbf7d0", th1: 1500, th2: 3500 },
      travel: { zeroColor: "#bfdbfe" },
      transport: { img: ASSETS.station, zeroColor: "#fbcfe8", th1: 800, th2: 3000 },
      rent: { img: ASSETS.rent_apartment, zeroColor: "#ffedd5", th1: 10000, th2: 30000 },
      utilities: { img: ASSETS.utilities_windmill, zeroColor: "#ddd6fe", th1: 1000, th2: 2000 },
      shopping: { img: ASSETS.shopping_boxes, zeroColor: "#e2e8f0", th1: 1500, th2: 3500 },
      transfer: { img: ASSETS.balloon, zeroColor: "#fef08a", th1: 5000, th2: 15000 }
    };
    let info = assetMap[type];
    if (type === 'castle') {
      info = { zeroColor: "#ef4444" };
    }
    if (info) {
      try {
        if (value <= 0) {
          drawIsoFlower(ctx, cx, cy, info.zeroColor);
          return;
        }
        let size = 56;
        let img = info.img;
        let yOffset = 0;
        
        if (type === 'castle') {
          if (value < 5000) {
            img = ASSETS.campfire;
            size = 75;
          } else if (value < 20000) {
            img = ASSETS.tent;
            size = 90;
          } else if (value < 50000) {
            img = ASSETS.simple_hotel;
            size = 110;
          } else {
            img = ASSETS.luxury_hotel;
            size = 140;
          }
        } else if (type === 'transport') {
          if (value < 100) {
            img = ASSETS.bicycle;
            size = 76;
          } else if (value < 500) {
            img = ASSETS.car;
            size = 90;
          } else if (value < 3000) {
            img = ASSETS.train;
            size = 105;
          } else {
            img = ASSETS.airplane;
            size = 120;
            yOffset = floatY + 22; // Let the airplane float high in the air
          }
        } else if (type === 'dining') {
          if (value < 500) {
            img = ASSETS.beverage;
            size = 76;
          } else if (value < 2000) {
            img = ASSETS.bento;
            size = 90;
          } else if (value < 5000) {
            img = ASSETS.cafe;
            size = 105;
          } else {
            img = ASSETS.restaurant;
            size = 120;
          }
        } else if (type === 'travel') {
          if (value < 3000) {
            img = ASSETS.hydrangea_garden;
            size = 75;
          } else if (value < 6000) {
            img = ASSETS.ferris_wheel;
            size = 80;
          } else if (value < 10000) {
            img = ASSETS.amusement_park;
            size = 110;
          } else {
            img = ASSETS.luxury_hotel_universal;
            size = 140;
          }
        } else if (type === 'rent') {
          if (value < 10000) {
            img = ASSETS.rent_apartment;
            size = 120;
          } else if (value < 30000) {
            img = ASSETS.rent_villa;
            size = 120;
          } else if (value < 50000) {
            img = ASSETS.rent_luxury_building;
            size = 130;
          } else {
            img = ASSETS.rent_palace;
            size = 140;
          }
        } else if (type === 'grocery') {
          if (value < 1500) {
            img = ASSETS.grocery_garden;
            size = 100;
          } else if (value < 3500) {
            img = ASSETS.grocery_greenhouse;
            size = 100;
          } else if (value < 6000) {
            img = ASSETS.grocery_supermarket;
            size = 120;
          } else {
            img = ASSETS.grocery_large_supermarket;
            size = 140;
          }
        } else if (type === 'shopping') {
          if (value < 1500) {
            img = ASSETS.shopping_boxes;
            size = 100;
          } else if (value < 3500) {
            img = ASSETS.shopping_general_store;
            size = 100;
          } else if (value < 6000) {
            img = ASSETS.shopping_department_store;
            size = 120;
          } else {
            img = ASSETS.shopping_logistics;
            size = 140;
          }
        } else if (type === 'utilities') {
          if (value < 1000) {
            img = ASSETS.utilities_windmill;
            size = 110;
          } else if (value < 2000) {
            img = ASSETS.utilities_solar_water;
            size = 110;
          } else if (value < 5000) {
            img = ASSETS.utilities_substation;
            size = 125;
          } else {
            img = ASSETS.utilities_reactor;
            size = 140;
          }
        } else {
          if (value < info.th1) {
            size = 80;
          } else if (value < info.th2) {
            size = 110;
          } else {
            size = 140;
          }
          yOffset = (type === 'transfer') ? floatY : 0;
        }
        
        if (img) {
          const w = size * 1.75 ; // 等比例放大 1.25 倍
          const imgW = img.naturalWidth || img.width || 1;
          const imgH = img.naturalHeight || img.height || 1;
          const h = w * (imgH / imgW);
          ctx.drawImage(img, Math.round(cx - w/2), Math.round(cy - h + 30 - yOffset), Math.round(w), Math.round(h));
          if (type === 'dining' && value >= 5000) {
            const sy = (Date.now() / 25) % 15;
            ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
            ctx.beginPath();
            ctx.arc(cx - 20 + Math.sin(sy/2)*2, cy - h + 15 - sy, (2.5 + sy/8) * 1.25, 0, Math.PI*2);
            ctx.fill();
          }
          return;
        }
      } catch (err) {
        console.warn('Failed to draw building image, falling back to lines:', err);
      }
    }}
  const colors = {
    castle: { top: "#c7d2fe", left: "#6366f1", right: "#4f46e5" },
    dining: { top: "#fef08a", left: "#eab308", right: "#ca8a04" },
    grocery: { top: "#bbf7d0", left: "#22c55e", right: "#16a34a" },
    travel: { top: "#bfdbfe", left: "#3b82f6", right: "#2563eb" },
    transport: { top: "#fbcfe8", left: "#ec4899", right: "#db2777" },
    rent: { top: "#ffedd5", left: "#f97316", right: "#ea580c" },
    utilities: { tower: "#e2e8f0", blades: "#475569" },
    shopping: { top: "#e2e8f0", left: "#64748b", right: "#475569" },
    transfer: { balloon: "#d8b4fe", basket: "#b45309" }
  };

  
  if (type === 'castle') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#ef4444"); // 赤字荒地：紅花
    } else if (value < 5000) {
      // 營火
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy - 3);
      ctx.moveTo(cx + 5, cy); ctx.lineTo(cx - 5, cy - 3);
      ctx.stroke();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(cx, cy - 4 - Math.sin(Date.now() / 150) * 1.5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 20000) {
      // 露營帳篷 (5000-20000)
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 2);
      ctx.lineTo(cx, cy - 8);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (value < 50000) {
      // 簡單飯店 (20000-50000)
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.castle.top, colors.castle.left, colors.castle.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#f43f5e", "#e11d48"); // 紅頂小屋
    } else {
      // 城堡
      drawIsoBlock(ctx, cx, cy, 28, 14, colors.castle.top, colors.castle.left, colors.castle.right);
      drawIsoBlock(ctx, cx - 10, cy - 4, 10, 20, colors.castle.top, colors.castle.left, colors.castle.right);
      drawIsoBlock(ctx, cx + 10, cy - 4, 10, 20, colors.castle.top, colors.castle.left, colors.castle.right);
      // 拱門
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 1, 3.5, 5, 0, Math.PI, 0);
      ctx.fill();
      // 飄揚紅旗
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx, cy - 32);
      ctx.stroke();
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 32);
      ctx.lineTo(cx + 6, cy - 29);
      ctx.lineTo(cx, cy - 26);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 'dining') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#fef08a"); // 黃色花朵
    } else if (value < 500) {
      // 1. 街角飲料店 (0 - 500 元)
      drawIsoBlock(ctx, cx, cy, 14, 8, colors.dining.top, colors.dining.left, colors.dining.right);
      // 雨棚
      ctx.fillStyle = "#f43f5e"; // 粉紅雨棚
      ctx.fillRect(cx - 7, cy - 10, 14, 2);
      // 招牌珍奶杯 (微型幾何)
      ctx.fillStyle = "#cbd5e1"; // 杯身
      ctx.fillRect(cx - 2, cy - 15, 4, 5);
      ctx.strokeStyle = "#ea580c"; // 橘色吸管
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 15);
      ctx.lineTo(cx + 2, cy - 18);
      ctx.stroke();
    } else if (value < 2000) {
      // 2. 台式便當店 (500 - 2000 元)
      drawIsoBlock(ctx, cx, cy, 20, 12, colors.dining.top, colors.dining.left, colors.dining.right);
      drawIsoPyramid(ctx, cx, cy, 20, 12, 6, "#ea580c", "#c2410c"); // 亮橘屋頂
      // 便當招牌 (小小白色方塊)
      drawIsoBlock(ctx, cx - 4, cy - 2, 6, 6, "#ffffff", "#e2e8f0", "#cbd5e1");
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(cx - 3, cy - 6, 2, 2); // 招牌上的紅字點綴
    } else if (value < 5000) {
      // 3. 溫馨咖啡廳 (2000 - 5000 元)
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.dining.top, colors.dining.left, colors.dining.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#b45309", "#78350f"); // 褐頂
    } else {
      // 4. 豪華西餐廳 (5000 元以上)
      drawIsoBlock(ctx, cx, cy, 26, 16, colors.dining.top, colors.dining.left, colors.dining.right);
      drawIsoBlock(ctx, cx, cy - 16, 18, 10, "#fef3c7", colors.dining.left, colors.dining.right);
      drawIsoPyramid(ctx, cx, cy - 26, 18, 8, "#b91c1c", "#991b1b");
      // 煙囪與動畫煙霧
      ctx.fillStyle = "#475569";
      ctx.fillRect(cx - 9, cy - 26, 3, 9);
      const sy = (Date.now() / 25) % 15;
      ctx.fillStyle = "rgba(100, 116, 139, 0.4)";
      ctx.beginPath();
      ctx.arc(cx - 8 + Math.sin(sy/2)*2, cy - 26 - sy, 2.5 + sy/6, 0, Math.PI*2);
      ctx.fill();
    }
  } else if (type === 'grocery') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#bbf7d0"); // 綠色花朵
    } else if (value < 1500) {
      // 小菜園
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(cx - 3, cy + 1, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy + 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 3500) {
      // 溫室農場
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.grocery.top, colors.grocery.left, colors.grocery.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 6, "#64748b", "#475569");
    } else if (value < 6000) {
      // 超市賣場
      drawIsoBlock(ctx, cx, cy, 24, 16, colors.grocery.top, colors.grocery.left, colors.grocery.right);
      drawIsoPyramid(ctx, cx, cy, 24, 16, 8, "#b45309", "#78350f");
    } else {
      // 大型超市賣場
      drawIsoBlock(ctx, cx, cy, 26, 18, colors.grocery.top, colors.grocery.left, colors.grocery.right);
      drawIsoBlock(ctx, cx, cy - 18, 20, 10, "#86efac", colors.grocery.left, colors.grocery.right);
      drawIsoPyramid(ctx, cx, cy - 28, 20, 8, "#b45309", "#78350f");
    }
  } else if (type === 'travel') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#bfdbfe"); // 藍色花朵
    } else if (value < 3000) {
      // 繡球花園 (藍、粉、紫小花朵)
      drawIsoFlower(ctx, cx - 6, cy + 2, "#93c5fd");
      drawIsoFlower(ctx, cx + 6, cy + 4, "#f472b6");
      drawIsoFlower(ctx, cx, cy - 2, "#c084fc");
    } else if (value < 6000) {
      // 摩天輪 (支架與大圓環)
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.lineTo(cx, cy - 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 14, 2, 0, Math.PI * 2);
      ctx.arc(cx + 10, cy - 14, 2, 0, Math.PI * 2);
      ctx.arc(cx, cy - 24, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 10000) {
      // 遊樂園 (城堡與大帳篷)
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.travel.top, colors.travel.left, colors.travel.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#fb7185", "#f43f5e");
    } else {
      // 高級飯店與環球影城 (別墅 + 大地球)
      ctx.fillStyle = "#38bdf8"; // 藍色地球
      ctx.beginPath();
      ctx.arc(cx - 12, cy - 2, 6, 0, Math.PI * 2);
      ctx.fill();
      drawIsoBlock(ctx, cx + 4, cy - 2, 22, 16, colors.travel.top, colors.travel.left, colors.travel.right);
      drawIsoBlock(ctx, cx + 4, cy - 18, 16, 12, "#cbd5e1", "#94a3b8", "#64748b");
    }
  } else if (type === 'transport') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#fbcfe8"); // 粉色花朵
    } else if (value < 100) {
      // 1. 綠能腳踏車 (0 - 100 元)
      // 軌道/道路底線
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 5); ctx.lineTo(cx + 10, cy - 5);
      ctx.stroke();
      
      // 前後輪
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 2, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // 車架與把手
      ctx.strokeStyle = "#10b981"; // 綠色車架
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 2);
      ctx.lineTo(cx, cy - 1);
      ctx.lineTo(cx + 5, cy - 3);
      ctx.moveTo(cx - 5, cy + 2);
      ctx.lineTo(cx - 2, cy - 4);
      ctx.lineTo(cx + 5, cy - 3);
      // 把手
      ctx.moveTo(cx - 2, cy - 4);
      ctx.lineTo(cx - 3, cy - 7);
      ctx.lineTo(cx - 5, cy - 7);
      ctx.stroke();
      
      // 座墊
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx + 1, cy - 3, 3, 1);
    } else if (value < 500) {
      // 2. 街頭小汽車 (100 - 500 元)
      // 底層陰影
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 車身
      drawIsoBlock(ctx, cx, cy + 2, 16, 6, "#3b82f6", "#2563eb", "#1d4ed8"); // 藍色底座
      drawIsoBlock(ctx, cx - 1, cy - 4, 10, 5, "#60a5fa", "#3b82f6", "#2563eb"); // 淺藍車頂
      
      // 輪胎
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 4, 2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // 前大燈
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(cx - 7, cy + 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 3000) {
      // 3. 蒸汽小火車 (500 - 3000 元)
      // 鐵軌
      ctx.strokeStyle = "#57534e";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 7); ctx.lineTo(cx + 15, cy - 7);
      ctx.stroke();
      
      // 枕木
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        const tx = cx + i * 4;
        const ty = cy - i * 2;
        ctx.beginPath();
        ctx.moveTo(tx - 3, ty - 1.5);
        ctx.lineTo(tx + 3, ty + 1.5);
        ctx.stroke();
      }
      
      // 火車主體 (紅色車廂與黑色鍋爐)
      drawIsoBlock(ctx, cx + 5, cy + 2, 10, 12, "#ef4444", "#dc2626", "#b91c1c"); // 車主體
      drawIsoBlock(ctx, cx - 3, cy + 2, 8, 8, "#334155", "#1e293b", "#0f172a");  // 黑色鍋爐
      
      // 煙囪
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - 5, cy - 9, 2, 4);
      
      // 蒸汽動畫
      const sy = (Date.now() / 25) % 15;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(cx - 4 + Math.sin(sy/2)*1.5, cy - 9 - sy, 2 + sy/6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 4. 夢想雙翼機 (3000 元以上)
      const ay = cy - 20 - floatY; // 飛在空中
      
      // 地面投影陰影 (隨高度縮放)
      const shadowScale = 1.0 - (floatY / 30);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 12 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 機身 (主圓體)
      drawIsoBlock(ctx, cx, ay, 18, 5, "#cbd5e1", "#94a3b8", "#64748b");
      
      // 機翼
      ctx.fillStyle = "#ef4444"; // 紅色機翼
      // 左翼
      ctx.beginPath();
      ctx.moveTo(cx - 9, ay);
      ctx.lineTo(cx - 18, ay - 4);
      ctx.lineTo(cx - 9, ay - 4);
      ctx.closePath();
      ctx.fill();
      // 右翼
      ctx.beginPath();
      ctx.moveTo(cx + 9, ay - 4);
      ctx.lineTo(cx + 18, ay - 8);
      ctx.lineTo(cx + 9, ay - 8);
      ctx.closePath();
      ctx.fill();
      
      // 螺旋槳轉軸與葉片
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx - 9, ay + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const a = (angle * 3) + (i * Math.PI); // 轉動
        const px = cx - 9 + Math.cos(a) * 7;
        const py = ay + 2 + Math.sin(a) * 3;
        ctx.beginPath();
        ctx.moveTo(cx - 9, ay + 2);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }
  } else if (type === 'rent') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#ffedd5"); // 橘色花朵
    } else if (value < 10000) {
      // 小公寓
      drawIsoBlock(ctx, cx, cy, 20, 15, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 20, 15, 6, "#64748b", "#475569");
    } else if (value < 30000) {
      // 磚瓦洋房
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#78350f", "#451a03");
    } else if (value < 50000) {
      // 豪華大樓
      drawIsoBlock(ctx, cx, cy, 24, 25, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 24, 25, 6, "#475569", "#334155");
      // 亮燈窗戶
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(cx - 4, cy - 20, 2, 3);
      ctx.fillRect(cx + 2, cy - 20, 2, 3);
      ctx.fillRect(cx - 4, cy - 12, 2, 3);
      ctx.fillRect(cx + 2, cy - 12, 2, 3);
    } else {
      // 類似帝寶的大樓
      drawIsoBlock(ctx, cx - 6, cy, 16, 32, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoBlock(ctx, cx + 6, cy, 16, 32, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 26, 32, 10, "#fb7185", "#f43f5e");
    }
  } else if (type === 'utilities') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#ddd6fe"); // 紫色花朵
    } else if (value < 1000) {
      // 風車
      drawIsoWindmill(ctx, cx, cy, 24, angle, colors.utilities.tower, colors.utilities.blades);
    } else if (value < 2000) {
      // 太陽能與水塔
      drawIsoCylinder(ctx, cx - 6, cy + 2, 6, 12, "#94a3b8", "#64748b", "#475569");
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy);
      ctx.lineTo(cx + 8, cy - 3);
      ctx.lineTo(cx + 6, cy - 6);
      ctx.lineTo(cx, cy - 3);
      ctx.closePath();
      ctx.fill();
    } else if (value < 5000) {
      // 變電所
      drawIsoBlock(ctx, cx, cy, 22, 14, "#cbd5e1", "#94a3b8", "#64748b");
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 8);
      ctx.lineTo(cx + 1, cy - 5);
      ctx.lineTo(cx - 1, cy - 5);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.stroke();
    } else {
      // 未來反應爐
      drawIsoCylinder(ctx, cx, cy, 14, 20, "#e2e8f0", "#94a3b8", "#64748b");
      ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'shopping') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#e2e8f0"); // 灰色花朵
    } else if (value < 1500) {
      // 幾個紙箱
      ctx.fillStyle = "#d97706";
      drawIsoBlock(ctx, cx - 4, cy + 2, 6, 6, "#f59e0b", "#d97706", "#b45309");
      drawIsoBlock(ctx, cx + 4, cy - 2, 8, 8, "#f59e0b", "#d97706", "#b45309");
    } else if (value < 3500) {
      // 五金雜貨行
      drawIsoBlock(ctx, cx, cy, 20, 12, colors.shopping.top, colors.shopping.left, colors.shopping.right);
      drawIsoPyramid(ctx, cx, cy, 20, 12, 6, "#b45309", "#78350f");
    } else if (value < 6000) {
      // 百貨公司
      drawIsoBlock(ctx, cx, cy, 24, 18, colors.shopping.top, colors.shopping.left, colors.shopping.right);
      drawIsoBlock(ctx, cx, cy - 18, 16, 12, "#cbd5e1", colors.shopping.left, colors.shopping.right);
      drawIsoPyramid(ctx, cx, cy - 30, 16, 6, "#3b82f6", "#2563eb");
    } else {
      // 自動化物流廠房
      drawIsoBlock(ctx, cx - 4, cy + 2, 18, 14, "#94a3b8", colors.shopping.left, colors.shopping.right);
      drawIsoPyramid(ctx, cx - 4, cy + 2, 18, 14, 8, "#f59e0b", "#d97706");
      drawIsoCylinder(ctx, cx + 10, cy - 2, 8, 18, "#cbd5e1", "#64748b", "#475569");
    }
  } else if (type === 'transfer') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#fef08a"); // 黃色花朵
    } else if (value < 5000) {
      // 飄浮小圓球
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(cx, cy - 10 - floatY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 15000) {
      // 熱氣球
      drawIsoBalloon(ctx, cx, cy, floatY, colors.transfer.balloon, colors.transfer.basket);
    } else {
      // 雙氣球
      drawIsoBalloon(ctx, cx - 8, cy, floatY, colors.transfer.balloon, colors.transfer.basket);
      drawIsoBalloon(ctx, cx + 10, cy - 10, Math.sin(Date.now() / 380) * 4.5, "#3b82f6", "#ca8a04");
    }
  }
}

// 獲取地標狀態描述
function getBuildingStatusText(type, val) {
  if (type === 'castle') {
    if (val <= 0) return '🔴 赤字荒地';
    if (val < 5000) return '🔥 溫馨營火';
    if (val < 20000) return '⛺ 露營帳篷';
    if (val < 50000) return '🏢 簡單飯店';
    return '🏨 高級泳池飯店';
  } else if (type === 'dining') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 500) return '🧋 街角飲料店';
    if (val < 2000) return '🍱 台式便當店';
    if (val < 5000) return '🍰 溫馨咖啡廳';
    return '🍽️ 豪華西餐廳 (超預算警告)';
  } else if (type === 'grocery') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1500) return '🥬 小菜園樣式';
    if (val < 3500) return '🥦 溫室農場';
    if (val < 6000) return '🛒 超市賣場';
    return '🛒 大型超市賣場';
  } else if (type === 'travel') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 3000) return '🌺 繡球花園';
    if (val < 6000) return '🎡 摩天輪';
    if (val < 10000) return '🎢 遊樂園';
    return '🏰 高級飯店與環球影城';
  } else if (type === 'transport') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 100) return '🚲 綠能腳踏車';
    if (val < 500) return '🚗 街頭小汽車';
    if (val < 3000) return '🚆 蒸汽小火車';
    return '✈️ 夢想雙翼機';
  } else if (type === 'rent') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 10000) return '🏢 小公寓樣式';
    if (val < 30000) return '🏠 磚瓦洋房';
    if (val < 50000) return '🏙️ 豪華大樓';
    return '🏰 頂級豪宅大樓';
  } else if (type === 'utilities') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1000) return '💨 綠能風力發電';
    if (val < 2000) return '☀️ 太陽能儲能與水塔';
    if (val < 5000) return '🎛️ 現代水務與變電站';
    return '⚡ 未來聚變反應爐';
  } else if (type === 'shopping') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1500) return '📦 幾個紙箱';
    if (val < 3500) return '🏪 五金雜貨行';
    if (val < 6000) return '🏬 百貨公司';
    return '🏭 自動化物流廠';
  } else if (type === 'transfer') {
    if (val <= 0) return '🌸 尚未存入';
    if (val < 5000) return '🎈 飄浮氣球';
    if (val < 15000) return '🎈 夢想熱氣球';
    return '🎈 雙重夢想氣球';
  }
  return '';
}

// 更新小島地標導航欄
function updateIslandLegend(cats, balance) {
  const legendEl = document.getElementById('islandLegend');
  if (!legendEl) return;
  
  let castleIcon = '🏨';
  if (balance <= 0) castleIcon = '🔴';
  else if (balance < 5000) castleIcon = '🔥';
  else if (balance < 20000) castleIcon = '⛺';
  else if (balance < 50000) castleIcon = '🏢';
  
  let travelIcon = '🏰';
  if (cats.travel <= 0) travelIcon = '🏨';
  else if (cats.travel < 3000) travelIcon = '🌺';
  else if (cats.travel < 6000) travelIcon = '🎡';
  else if (cats.travel < 10000) travelIcon = '🎢';

  let rentIcon = '🏠';
  if (cats.rent <= 0) rentIcon = '🌸';
  else if (cats.rent < 10000) rentIcon = '🏢';
  else if (cats.rent < 30000) rentIcon = '🏠';
  else if (cats.rent < 50000) rentIcon = '🏙️';
  else rentIcon = '🏰';

  let groceryIcon = '🛒';
  if (cats.grocery <= 0) groceryIcon = '🌸';
  else if (cats.grocery < 1500) groceryIcon = '🥬';
  else if (cats.grocery < 3500) groceryIcon = '🥦';
  else if (cats.grocery < 6000) groceryIcon = '🛒';
  else groceryIcon = '🛒';

  let shoppingIcon = '📦';
  if (cats.shopping <= 0) shoppingIcon = '🌸';
  else if (cats.shopping < 1500) shoppingIcon = '📦';
  else if (cats.shopping < 3500) shoppingIcon = '🏪';
  else if (cats.shopping < 6000) shoppingIcon = '🏬';
  else shoppingIcon = '🏭';

  let utilitiesIcon = '⚡';
  if (cats.utilities <= 0) utilitiesIcon = '🌸';
  else if (cats.utilities < 1000) utilitiesIcon = '💨';
  else if (cats.utilities < 2000) utilitiesIcon = '☀️';
  else if (cats.utilities < 5000) utilitiesIcon = '🎛️';
  else utilitiesIcon = '⚡';
  
  const items = [
    { icon: castleIcon, name: '帳戶餘額', type: 'castle', val: balance, prefix: '目前水位: ' },
    { icon: '🍽️', name: '餐飲與飲料', type: 'dining', val: cats.dining, prefix: '本月支出: ' },
    { icon: groceryIcon, name: '超市與超商', type: 'grocery', val: cats.grocery, prefix: '本月支出: ' },
    { icon: travelIcon, name: '住宿與景點', type: 'travel', val: cats.travel, prefix: '本月支出: ' },
    { icon: '🚆', name: '交通出行', type: 'transport', val: cats.transport, prefix: '本月支出: ' },
    { icon: rentIcon, name: '房租支出', type: 'rent', val: cats.rent, prefix: '本月支出: ' },
    { icon: utilitiesIcon, name: '水電瓦斯網路', type: 'utilities', val: cats.utilities, prefix: '本月支出: ' },
    { icon: shoppingIcon, name: '網購消費', type: 'shopping', val: cats.shopping, prefix: '本月支出: ' },
    { icon: '🎈', name: '每月的愛', type: 'transfer', val: cats.transfer, prefix: '共同存入: ' }
  ];
  
  legendEl.innerHTML = items.map(item => {
    const status = getBuildingStatusText(item.type, item.val);
    return `
      <div class="island-legend-item">
        <span class="island-legend-icon">${item.icon}</span>
        <div class="island-legend-text">
          <span class="island-legend-name">${item.name}</span>
          <span class="island-legend-desc">${item.prefix}${fmt(item.val)}</span>
          <span class="island-legend-desc" style="color:var(--text); font-weight:500; font-size:10px; opacity:0.8;">建置狀態: ${status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── 家用品庫存 ─────────────────────────────────────────────────
const INV_STORE_KEY = 'shareExpense.inventoryCache.v1';
function loadInventoryStore() {
  try {
    const arr = JSON.parse(localStorage.getItem(INV_STORE_KEY) || 'null');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function persistInventoryStore() {
  try {
    if (Array.isArray(inventory)) localStorage.setItem(INV_STORE_KEY, JSON.stringify(inventory));
  } catch (e) { /* 無痕模式或空間不足時略過 */ }
}
// 上次的庫存（localStorage 保存，先顯示再背景更新）；null 代表載入失敗
let inventory = loadInventoryStore();
// 寫入中的請求數與「寫入世代」：背景更新若與寫入重疊，就放棄那次結果，寫入完成後再重新讀取
let invPending = 0;
let invWriteEpoch = 0;
let invRefreshQueued = false;
const INV_WRITE_ACTIONS = ['addInventory', 'updateInventory', 'deleteInventory'];
// 庫存品：品項名稱必須與下列詞完全相同（忽略空白與大小寫）才算，圖示也由此決定
const INV_ICON_MAP = {
  '衛生紙': '🧻', '捲筒衛生紙': '🧻', '面紙': '🧻', '廁紙': '🧻', '濕紙巾': '🧻', '紙巾': '🧻', '擦臉巾': '🧻',
  '洗衣精': '🧴', '洗衣粉': '🧴', '柔軟精': '🧴', '卸妝乳': '🧴', '防曬乳': '🧴',
  '洗碗精': '🫧', '菜瓜布': '🫧', '清潔劑': '🫧', '廚房紙巾': '🫧', '廚餘濾網': '🧽',
  '牙膏': '🪥', '牙刷': '🪥', '牙線': '🪥',
  '沐浴乳': '🧼', '洗髮精': '🧼', '潤髮乳': '🧼', '肥皂': '🧼', '香皂': '🧼',
  '醬油': '🧂', '鹽': '🧂', '糖': '🧂', '醋': '🧂', '味精': '🧂', '胡椒': '🧂',
  '垃圾袋': '🗑️', '電池': '🔋', '酒精': '🧴', '口罩': '😷',
  '雞蛋': '🥚', '蛋': '🥚', '牛奶': '🥛', '豆漿': '🥛',
  '咖啡': '☕', '茶葉': '🍵', '茶包': '🍵',
  '白米': '🍚', '米': '🍚', '麵條': '🍜', '泡麵': '🍜', '義大利麵': '🍝',
  '餅乾': '🍪', '卡拉姆久': '🥔', '洋芋片': '🥔', '喜餅': '🥮', '巧克力': '🍫',
  '冰棒': '🍭', '冰淇淋': '🍦', '酒': '🍷', '泡菜': '🥬',
};
// 名稱後面的「老公」「老婆」只用來分開品項（例：防曬乳（老公）），圖示仍用基本名稱判斷
const PERSON_SUFFIX_RE = /[（(]?\s*(老公|老婆)\s*[）)]?$/;
const invKey = name => String(name || '').replace(PERSON_SUFFIX_RE, '').replace(/\s+/g, '').toLowerCase();
const INV_DEFAULT_ICON = '🧺';
// 字尾比對：名稱結尾是這些詞就用對應圖示（例：巧克力冰淇淋 → 🍦），其他品項仍需完整比對
const INV_SUFFIX_ICON = { '冰棒': '🍭', '冰淇淋': '🍦', '咖啡': '☕', '茶': '🍵', '餅乾': '🍪', '酒': '🍷', '泡菜': '🥬' };
// 包含比對：名稱裡有這些詞就用對應圖示（例：巧克力棒、黑巧克力 → 🍫）
const INV_CONTAIN_ICON = { '巧克力': '🍫' };
// 圖示規則：優先使用試算表「圖示對照」的內容（讀取失敗才用下面內建的）
let iconRules = null;
async function loadIconRules() {
  try {
    const d = await invApi({ action: 'getIconMap' });
    iconRules = Array.isArray(d.rows) ? d.rows : null;
  } catch (e) {
    iconRules = null;
  }
}

function guessInventoryIcon(name) {
  const key = invKey(name);
  if (iconRules) {
    const exact = iconRules.find(r => r.mode === '完整' && invKey(r.key) === key);
    if (exact) return exact.icon;
    const suffix = iconRules.find(r => r.mode === '字尾' && key.length > invKey(r.key).length && key.endsWith(invKey(r.key)));
    if (suffix) return suffix.icon;
    const contain = iconRules.find(r => r.mode === '包含' && key.includes(invKey(r.key)));
    if (contain) return contain.icon;
    return INV_DEFAULT_ICON;
  }
  if (Object.prototype.hasOwnProperty.call(INV_ICON_MAP, key)) return INV_ICON_MAP[key];
  for (const suffix of Object.keys(INV_SUFFIX_ICON)) {
    if (key.length > suffix.length && key.endsWith(suffix)) return INV_SUFFIX_ICON[suffix];
  }
  for (const word of Object.keys(INV_CONTAIN_ICON)) {
    if (key.includes(word)) return INV_CONTAIN_ICON[word];
  }
  return INV_DEFAULT_ICON;
}
function isConsumableName(name) {
  return guessInventoryIcon(name) !== INV_DEFAULT_ICON;
}
// 勾選框預設：項目名稱是消耗品，或備註裡有消耗品
function shouldLinkInventory(item, note) {
  return isConsumableName(item) || parseInventoryNote(note).some(i => i.cat || isConsumableName(i.name));
}

async function invApi(params) {
  const isWrite = INV_WRITE_ACTIONS.includes(params.action);
  if (isWrite) { invPending++; invWriteEpoch++; }
  try {
    const d = await apiCall(params);
    if (d.error) throw new Error(d.error);
    return d;
  } finally {
    if (isWrite) {
      invPending--;
      if (invPending === 0 && invRefreshQueued) {
        invRefreshQueued = false;
        loadInventory();
      }
    }
  }
}

// 先顯示上次的庫存，再背景讀取最新資料
async function loadInventory() {
  const grid = document.getElementById('inv-grid');
  if (grid && !inventory.length) grid.innerHTML = '<div class="loading-state"><div class="spinner"></div>載入中…</div>';
  if (inventory && inventory.length) renderInventory(); // 有上次的資料就先畫

  // 寫入中就先排隊，等寫入完成再讀，避免把舊值蓋回去
  if (invPending > 0) { invRefreshQueued = true; return; }
  const epoch = invWriteEpoch;
  try {
    const d = await invApi({ action: 'getInventory' });
    if (invPending > 0 || epoch !== invWriteEpoch) { invRefreshQueued = true; return; }
    inventory = d.items || [];
    persistInventoryStore();
  } catch (e) {
    // 讀取失敗：有上次的資料就保留；沒有才顯示錯誤
    if (!inventory || inventory.length === 0) inventory = null;
  }
  renderInventory();
}

// 狀態：用完了（數量 0）、快用完了（手動標記，數量不變）、其餘為夠用
function invStatus(i) {
  if (i.qty <= 0) return 'empty';
  if (i.low) return 'low';
  return 'ok';
}

// 期限：已過期 / 7 天內（red）/ 30 天內（warn）/ 夠久（ok）
function daysUntil(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}
function expiryLevel(i) {
  if (!i.expiry) return null;
  const n = daysUntil(i.expiry);
  if (n < 0) return 'expired';
  if (n <= 7) return 'red';
  if (n <= 30) return 'warn';
  return 'ok';
}
function expiryText(i) {
  const n = daysUntil(i.expiry);
  return n < 0 ? `已過期 ${-n} 天` : n === 0 ? '今天到期' : `還有 ${n} 天`;
}

function renderInventory() {
  const grid = document.getElementById('inv-grid');
  const shop = document.getElementById('inv-shop');
  if (!grid || !shop) return;
  persistInventoryStore();
  if (inventory === null) {
    shop.innerHTML = '';
    grid.innerHTML = '<div class="empty-state">⚠️ 無法載入庫存，請稍後再試</div>';
    return;
  }
  const empty = inventory.filter(i => invStatus(i) === 'empty');
  const low = inventory.filter(i => invStatus(i) === 'low');
  const expOf = lvl => inventory.filter(i => expiryLevel(i) === lvl);

  const group = (title, list, cls, sub) => {
    if (!list.length) return '';
    const chips = list.map(i => `<span class="inv-chip">${esc(i.icon)} ${esc(i.name)}${sub ? ` <small>${sub(i)}</small>` : ''}</span>`).join('');
    return `<div class="inv-shop-group ${cls}"><div class="inv-shop-title">${title}（${list.length}）</div><div class="inv-shop-list">${chips}</div></div>`;
  };
  const shopHtml =
    group('⚠️ 用完了', empty, 'empty') +
    group('快用完了', low, 'low', i => `剩 ${i.qty}`) +
    group('🚨 已過期', expOf('expired'), 'expired', i => expiryText(i)) +
    group('7 天內到期', expOf('red'), 'exp-red', i => expiryText(i)) +
    group('30 天內到期', expOf('warn'), 'exp-warn', i => expiryText(i));
  shop.innerHTML = shopHtml
    ? `<div class="inv-shop-box">${shopHtml}</div>`
    : '<div class="inv-empty-ok">目前都夠用 ✨</div>';

  const invCardHtml = i => {
        const st = invStatus(i);
        const lvl = expiryLevel(i);
        const isStock = i.cat !== '消耗品';
        const id = esc(i.id);
        const badge = st === 'empty' ? '<div class="inv-badge empty">用完了</div>'
                    : st === 'low' ? '<div class="inv-badge low">快用完了</div>' : '';
        let mainBtns;
        if (st === 'empty') mainBtns = `<button class="inv-restock" onclick="setInventoryQty('${id}', 1)">補貨</button>`;
        else if (isStock) mainBtns = '';
        else mainBtns = `<button class="inv-lowbtn${i.low ? ' on' : ''}" onclick="toggleInventoryLow('${id}')">${i.low ? '取消快用完' : '快用完了'}</button>
             <button class="inv-used" onclick="setInventoryQty('${id}', 0)">用完了</button>`;
        const expLine = lvl ? `<div class="inv-expiry ${lvl}">期限 ${esc(i.expiry)}｜${esc(expiryText(i))}</div>` : '';
        return `
      <div class="inv-card ${st}${lvl ? ' exp-' + lvl : ''}">
        ${badge}
        <div class="inv-icon">${esc(i.icon)}</div>
        <div class="inv-name">${esc(i.name)}</div>
        <div class="inv-qty"><span>${i.qty}</span><small>剩餘</small></div>
        ${expLine}
        <div class="inv-btns">
          <button onclick="changeInventoryQty('${id}', -1)" aria-label="減少 ${esc(i.name)}">−</button>
          <button onclick="changeInventoryQty('${id}', 1)" aria-label="增加 ${esc(i.name)}">＋</button>
          ${mainBtns}
          <button class="inv-del" onclick="deleteInventoryItemUi('${id}')" aria-label="刪除 ${esc(i.name)}">🗑</button>
        </div>
      </div>`;
  };

  // 依分類分組顯示：消耗品 → 食品 → 藥品（其他分類接在後面）
  const CAT_ORDER = ['消耗品', '食品', '藥品'];
  const catOf = i => i.cat || '消耗品';
  const otherCats = [...new Set(inventory.map(catOf))].filter(c => !CAT_ORDER.includes(c));
  grid.innerHTML = inventory.length
    ? [...CAT_ORDER, ...otherCats].map(cat => {
        const list = inventory.filter(i => catOf(i) === cat);
        if (!list.length) return '';
        return `<section class="inv-cat-section">
      <h3 class="inv-cat-title">${esc(cat)}（${list.length}）</h3>
      <div class="inv-cards">${list.map(invCardHtml).join('')}</div>
    </section>`;
      }).join('')
    : '<div class="empty-state">還沒有品項，請在上方新增</div>';
}

// 數量變動：先更新畫面，再送到試算表；失敗時重新載入
async function setInventoryQty(id, qty) {
  const it = inventory && inventory.find(i => i.id === id);
  if (!it) return;
  const prev = it.qty;
  const prevLow = it.low;
  it.qty = Math.max(0, qty);
  if (it.qty <= 0) it.low = false;
  renderInventory();
  try {
    await invApi({ action: 'updateInventory', id, data: JSON.stringify({ qty: it.qty, low: it.low }) });
  } catch (e) {
    it.qty = prev;
    it.low = prevLow;
    renderInventory();
    showToast('更新失敗，請重試');
  }
}

async function toggleInventoryLow(id) {
  const it = inventory && inventory.find(i => i.id === id);
  if (!it || it.qty <= 0) return;
  const prev = it.low;
  it.low = !prev;
  renderInventory();
  try {
    await invApi({ action: 'updateInventory', id, data: JSON.stringify({ low: it.low }) });
  } catch (e) {
    it.low = prev;
    renderInventory();
    showToast('更新失敗，請重試');
  }
}

function changeInventoryQty(id, delta) {
  const it = inventory && inventory.find(i => i.id === id);
  if (it) setInventoryQty(id, it.qty + delta);
}

async function deleteInventoryItemUi(id) {
  const it = inventory && inventory.find(i => i.id === id);
  if (!it || !confirm(`確定要刪除「${it.name}」嗎？`)) return;
  try {
    await invApi({ action: 'deleteInventory', id });
    inventory = inventory.filter(i => i.id !== id);
    renderInventory();
  } catch (e) {
    showToast('刪除失敗，請重試');
  }
}

// 新增品項（同名就直接加數量）
async function addInventoryFromForm() {
  const nameEl = document.getElementById('inv-name');
  const qtyEl = document.getElementById('inv-qty');
  const catEl = document.getElementById('inv-cat');
  const expEl = document.getElementById('inv-exp');
  const name = nameEl.value.trim();
  const qty = Math.max(0, parseInt(qtyEl.value, 10) || 0);
  const cat = catEl ? catEl.value : '消耗品';
  const expiry = cat === '消耗品' ? '' : (expEl ? expEl.value : '');
  if (!name) { showToast('請輸入品項名稱'); return; }
  if (cat !== '消耗品' && !expiry) { showToast('食品和藥品請填寫期限'); return; }
  await addToInventory(name, qty, false, cat, expiry);
  nameEl.value = '';
  qtyEl.value = '1';
  if (expEl) expEl.value = '';
}

// 把各種日期寫法轉成 yyyy-MM-dd：20261231、2026-12-31、2026.12.31、2026年12月31日、12/31（今年）
function parseExpiryInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const now = new Date();
  const parts = s.replace(/[年月日.\-\/]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let y, m, d;
  if (parts.length === 1 && parts[0].length === 8) {
    y = +parts[0].slice(0, 4); m = +parts[0].slice(4, 6); d = +parts[0].slice(6, 8);
  } else if (parts.length === 1 && parts[0].length === 4) {
    y = now.getFullYear(); m = +parts[0].slice(0, 2); d = +parts[0].slice(2, 4);
  } else if (parts.length === 3) {
    y = +parts[0]; m = +parts[1]; d = +parts[2];
  } else if (parts.length === 2) {
    y = now.getFullYear(); m = +parts[0]; d = +parts[1];
  } else {
    return '';
  }
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 從備註解析品項。規則：
//   名稱後面接數字是數量，空格或「、」分隔；沒寫數量就是 1
//   「食:」「藥:」前綴指定分類（食品 / 藥品）
//   「期限 日期」接在品項後面，設定有效期限
// 例：「衛生紙 2 食:泡麵 3 期限 2027/03/15、藥:感冒藥 期限 20261231」
function parseInventoryNote(note) {
  const out = [];
  String(note || '').split(/[、,，;；\n]+/).forEach(seg => {
    let openName = false;   // 上一個 token 是名稱（還沒接到數量）
    let expectExp = false;  // 下一個 token 是期限日期
    let pendingCat = null;  // 「藥:」「食:」後面空一格才接品項名稱
    let last = null;        // 目前這個品項
    seg.trim().split(/\s+/).filter(Boolean).forEach(tok => {
      const lone = tok.match(/^(食|藥)[:：]$/);
      if (lone) { pendingCat = lone[1] === '食' ? '食品' : '藥品'; openName = false; return; }
      if (expectExp) {
        expectExp = false;
        const ex = parseExpiryInput(tok);
        if (last && ex) last.expiry = ex;
        openName = false;
        return;
      }
      if (tok === '期限') { expectExp = true; openName = false; return; }
      if (tok.startsWith('期限') && tok.length > 2) {
        const ex = parseExpiryInput(tok.slice(2));
        if (last && ex) last.expiry = ex;
        openName = false;
        return;
      }
      const pre = tok.match(/^(食|藥)[:：](.+)$/);
      if (pre) {
        const att = pre[2].match(/^(.+?)[×xX*＊](\d+)$/);
        last = { name: att ? att[1] : pre[2], cat: pre[1] === '食' ? '食品' : '藥品', qty: att ? parseInt(att[2], 10) : null, expiry: '' };
        out.push(last);
        openName = !att;
        return;
      }
      const attached = tok.match(/^(.+?)[×xX*＊](\d+)$/);
      if (attached) {
        last = { name: attached[1], cat: null, qty: parseInt(attached[2], 10), expiry: '' };
        out.push(last);
        openName = false;
        return;
      }
      if (/^\d+$/.test(tok)) {
        if (last && openName) last.qty = parseInt(tok, 10);
        openName = false;
        return;
      }
      if (openName && last) {
        last.name += tok; // 名稱中間有空格（例：捲筒 衛生紙）
        return;
      }
      last = { name: tok, cat: pendingCat, qty: null, expiry: '' };
      pendingCat = null;
      out.push(last);
      openName = true;
    });
  });
  return out
    .map(i => ({ name: i.name.trim(), qty: i.qty && i.qty > 0 ? i.qty : 1, cat: i.cat, expiry: i.expiry }))
    .filter(i => i.name);
}

// 記帳時加入庫存：用備註的品項；備註沒有時，項目名稱是消耗品才用項目名稱
async function addItemsFromNote(note, fallbackItem) {
  let items = parseInventoryNote(note);
  if (items.length === 0 && isConsumableName(fallbackItem)) {
    items = [{ name: fallbackItem, qty: 1, cat: null, expiry: '' }];
  }
  for (const it of items) await addToInventory(it.name, it.qty, true, it.cat, it.expiry);
  showToast(`已加入庫存：${items.map(i => i.name + (i.qty > 1 ? '×' + i.qty : '')).join('、')}`);
}

// 記帳連動或手動新增共用：同品項＋同分類＋同期限就加數量，否則新增一列
// 分類：沒指定時，有期限視為食品，否則為消耗品
async function addToInventory(name, qty, silent, cat, expiry) {
  const clean = String(name || '').trim();
  if (!clean) return;
  const category = cat || (expiry ? '食品' : '消耗品');
  let icon = guessInventoryIcon(clean);
  if (icon === INV_DEFAULT_ICON) {
    if (category === '藥品') icon = '💊';
    else if (category === '食品') icon = '🥫';
  }
  const d = await invApi({
    action: 'addInventory',
    data: JSON.stringify({ name: clean, qty, icon, cat: category, expiry: expiry || '', mode: 'merge' })
  });
  if (d.merged) {
    const it = inventory && inventory.find(i => i.id === d.id);
    if (it) it.qty += qty;
    renderInventory();
  } else {
    await loadInventory();
  }
  if (!silent) showToast(`已加入庫存：${clean}`);
}

// ── 庫存 AI 辨識：複製 Prompt 給 Gemini / Claude，把回覆貼回來解析（不需要 API 金鑰）──
// 多次貼上的結果會累積：品名和期限可以來自不同照片
let ocrNames = [];
let ocrDates = [];

const INV_AI_PROMPT = `請看附圖（食品或藥品的包裝）。判讀以下兩項，只回傳一行 JSON，不要其他文字，也不要 Markdown 標記：
{"name": "商品名稱", "expiry": "yyyy-MM-dd"}

規則：
- name：商品名稱，簡短，去掉容量、重量、規格與促銷字樣。
  - 若圖上看得到品名，直接使用。
  - 若看不到品名，請依照圖上的品牌、口味、字樣等線索，用網路搜尋找出最可能的商品名稱。搜尋到的結果要與圖上線索相符才採用。
  - 若真的找不到，填 null，不要猜。
- expiry：只取「有效期限」「保存期限」「賞味期限」「到期」「EXP」旁邊的日期，格式 yyyy-MM-dd。不要取「製造日期」。只有年月時，填該月的最後一天。看不到就填 null。`;

async function copyInvPrompt() {
  try {
    await navigator.clipboard.writeText(INV_AI_PROMPT);
    showToast('Prompt 已複製，貼到 Gemini 或 Claude 時記得附上照片');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = INV_AI_PROMPT;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Prompt 已複製'); }
    catch (err) { showToast('複製失敗，請手動複製'); }
    document.body.removeChild(ta);
  }
}

function setOcrPanel(html) {
  const panel = document.getElementById('inv-ocr');
  panel.hidden = false;
  panel.innerHTML = html + '<button type="button" class="inv-ocr-close" data-ocr-close>清空</button>';
}

function renderOcrPanel(statusHtml = '') {
  const hasAny = ocrNames.length || ocrDates.length;
  let html = statusHtml;
  html += `<div class="inv-ocr-head">品名（點選帶入）</div><div class="inv-ocr-chips">`;
  html += ocrNames.length
    ? ocrNames.map(n => `<button type="button" data-ocr-name="${esc(n)}">${esc(n)}</button>`).join('')
    : '<span class="inv-ocr-msg">還沒有品名</span>';
  html += '</div>';
  html += `<div class="inv-ocr-head">期限（點選帶入）</div><div class="inv-ocr-chips">`;
  html += ocrDates.length
    ? ocrDates.map(d => `<button type="button" class="exp" data-ocr-exp="${d.iso}">${d.iso}</button>`).join('')
    : '<span class="inv-ocr-msg">還沒有期限</span>';
  html += '</div>';
  if (hasAny) html += '<div class="inv-ocr-msg" style="margin-top:8px">點選後會帶入上方表單，確認後再按「新增」。</div>';
  setOcrPanel(html);
}

// 解析 AI 回覆：可以是單一 JSON，也可以多筆 JSON；忽略前後的文字與 ``` 標記
function parseInvAiReply() {
  const raw = document.getElementById('inv-ai-reply').value || '';
  const objs = [];
  (raw.match(/\{[^{}]*\}/g) || []).forEach(chunk => {
    try { objs.push(JSON.parse(chunk)); } catch (e) { /* 忽略無法解析的片段 */ }
  });
  if (!objs.length) { showToast('找不到 JSON，請確認貼上的是 AI 的回覆'); return; }
  let added = 0;
  objs.forEach(o => {
    const name = o.name && o.name !== 'null' ? String(o.name).trim() : '';
    const expiry = typeof o.expiry === 'string' ? o.expiry.trim() : '';
    if (name && !ocrNames.includes(name)) { ocrNames.push(name); added++; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(expiry) && !ocrDates.some(x => x.iso === expiry)) { ocrDates.push({ iso: expiry }); added++; }
  });
  document.getElementById('inv-ai-reply').value = '';
  renderOcrPanel(added ? '' : '<div class="inv-ocr-msg">這次沒有新的品名或期限</div>');
}

// 點選候選：品名、期限帶入表單（不會自動新增，仍需按「新增」）
document.addEventListener('click', e => {
  const panel = document.getElementById('inv-ocr');
  if (!panel) return;
  if (e.target.closest('[data-ocr-close]')) { ocrNames = []; ocrDates = []; panel.hidden = true; panel.innerHTML = ''; return; }
  const nameBtn = e.target.closest('[data-ocr-name]');
  if (nameBtn) {
    document.getElementById('inv-name').value = nameBtn.dataset.ocrName;
    return;
  }
  const expBtn = e.target.closest('[data-ocr-exp]');
  if (expBtn) {
    const cat = document.getElementById('inv-cat');
    const exp = document.getElementById('inv-exp');
    if (cat.value === '消耗品') cat.value = '食品';
    exp.style.display = '';
    exp.value = expBtn.dataset.ocrExp;
  }
});
