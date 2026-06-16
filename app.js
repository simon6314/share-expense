const API = 'https://script.google.com/macros/s/AKfycbzdnp_gvKGGELnzDA4ZNq25RQ3mPPOXqbuwINKUBXuobbBw_cLubt8Cn-oDrazLfgkk/exec';
let records = [];
let catChartInst = null;
let amountType = 'expense';
let manualSeason = null;

let islandAnimationId = null;
let windmillAngle = 0;
let cloudOffset = 0;
let islandZoom = 1.0;
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
  island_base: 'assets/island_base.png?v=2',
  castle: 'assets/castle.png?v=2',
  cafe: 'assets/cafe.png?v=2',
  farm: 'assets/farm.png?v=2',
  resort: 'assets/resort.png?v=2',
  station: 'assets/station.png?v=2',
  apartment: 'assets/apartment.png?v=2',
  windmill: 'assets/windmill.png?v=2',
  warehouse: 'assets/warehouse.png?v=2',
  balloon: 'assets/balloon.png?v=2',
  bicycle: 'assets/bicycle.png?v=2',
  car: 'assets/car.png?v=2',
  train: 'assets/train.png?v=2',
  airplane: 'assets/airplane.png?v=2',
  beverage: 'assets/beverage.png?v=2',
  bento: 'assets/bento.png?v=2',
  restaurant: 'assets/restaurant.png?v=2'
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

function applyMonthTheme(m) {
  const t = MONTH_THEMES[m];
  if (!t) return;
  
  // 移除老舊季節屬性，防止其 CSS 優先權覆蓋新樣式
  document.body.removeAttribute('data-season');
  document.body.setAttribute('data-theme', t.themeAttr);
  document.getElementById('seasonBadge').textContent = t.emoji + ' ' + t.name;
  
  // 直接將 CSS 變數設定在 document.body.style 上 (最高權限的 Inline Style)
  const target = document.body;
  target.style.setProperty('--bg', '#fbfaf8');
  target.style.setProperty('--season-bg', t.bg);
  target.style.setProperty('--elf', t.elf);
  target.style.setProperty('--elf-bg', t.elfBg);
  target.style.setProperty('--fox', t.fox);
  target.style.setProperty('--fox-bg', t.foxBg);
  target.style.setProperty('--income', t.elf);
  target.style.setProperty('--expense', t.fox);
  
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

async function loadData() {
  const loadHTML = '<div class="loading-state"><div class="spinner"></div>載入中…</div>';
  document.getElementById('recordBody').innerHTML = '<tr><td colspan="6">' + loadHTML + '</td></tr>';
  document.getElementById('recordCards').innerHTML = loadHTML;
  setSyncStatus('loading', '同步中…');
  try {
    const data = await apiCall({ action: 'getAll', sheet: currentSheet() });
    if (data.error) throw new Error(data.error);
    records = data.records || [];
    setSyncStatus('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
    
    // 自動更新為目前月份主題
    const m = getAutoMonth();
    if (!manualSeason) {
      applyMonthTheme(m);
    }
    
    renderAll();
  } catch(e) {
    setSyncStatus('err', '連線失敗');
    const errHTML = '<div class="empty-state">⚠️ 無法連線到 Google 試算表</div>';
    document.getElementById('recordBody').innerHTML = '<tr><td colspan="6">' + errHTML + '</td></tr>';
    document.getElementById('recordCards').innerHTML = errHTML;
  }
}

async function addRecord(data) {
  setSyncStatus('loading', '儲存中…');
  try {
    const summaryRow = records.find(r => r.item && r.item.includes('總收入/支出'));
    const beforeRow = summaryRow ? summaryRow.row : null;
    await apiCall({ action: 'add', sheet: currentSheet(), data: JSON.stringify(data), beforeRow: beforeRow || '' });
    showToast('已新增 ✓');
    await loadData();
  } catch(e) {
    setSyncStatus('err', '儲存失敗');
    showToast('儲存失敗，請重試');
  }
}

async function updateTransfer(row, field, value) {
  setSyncStatus('loading', '更新中…');
  const rec = records.find(r => r.row === row);
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
        await apiCall({ action: 'updateTransfer', sheet: currentSheet(), row: foxRec.row, field: 'income', value: result });
      }
    }
  }
  try {
    await apiCall({ action: 'updateTransfer', sheet: currentSheet(), row, field, value: parseFloat(value) || 0 });
    setSyncStatus('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
    showToast('已更新 ✓');
    
    // ⚡ 實時更新：當手動調整轉回金額時，即時更新首頁四大卡片的金額
    renderAll();
    
    // ⚡ 實時更新：若使用者目前在年度頁籤，即時重繪年度水位折線圖
    if (document.getElementById('tab-annual').style.display !== 'none') {
      renderAnnualChart();
    }
  } catch(e) {
    setSyncStatus('err', '更新失敗');
    showToast('更新失敗，請重試');
  }
}

async function deleteRecord(row) {
  if (!confirm('確定刪除這筆記錄？')) return;
  setSyncStatus('loading', '刪除中…');
  try {
    await apiCall({ action: 'delete', sheet: currentSheet(), row });
    showToast('已刪除');
    await loadData();
  } catch(e) { setSyncStatus('err', '刪除失敗'); }
}

// ── RENDER ────────────────────────────────────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
const DAY_NAMES = ['日','一','二','三','四','五','六'];
function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' (' + DAY_NAMES[d.getDay()] + ')';
}
function formatDateShort(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' (' + DAY_NAMES[d.getDay()] + ')';
}

const SUMMARY_ITEMS = ['總收入/支出','支出部分轉回'];
const isSummaryRow = r => SUMMARY_ITEMS.some(k => r.item.includes(k)) || r.owner === '帳戶餘額';

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
  
  let balance = startingBalance + totalIncome - totalExpense;
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
  
  // 計算總交易筆數 (不含帳戶餘額)
  const realCount = realRecs.filter(r => r.item !== '帳戶餘額').length;
  // 更新明細表格與手機版
  renderRecords();
  if (document.getElementById('tab-analysis').style.display !== 'none') renderCharts();
  if (document.getElementById('tab-members').style.display !== 'none') renderMembers();
  if (document.getElementById('tab-annual').style.display !== 'none') renderAnnualChart();
  const islandTab = document.getElementById('tab-island');
  if (islandTab && islandTab.style.display !== 'none') renderIsland();
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
        ? `<span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${r.owner}</span>`
        : '<span style="color:var(--text3);font-size:14px">—</span>');

    if (isTransfer) {
      return `<tr style="background:var(--surface2)">
        <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
        <td>${badge}</td>
        <td style="font-size:15px;font-weight:500">${r.item}</td>
        <td>${buildTransferCells(r, false)}</td>
        <td><span class="note-text">${r.note||''}</span></td>
        <td></td></tr>`;
    }
    if (isSummary) {
      const incAmt = r.income > 0 ? `<span class="amount-income">+${fmt(r.income)}</span>` : '';
      const expAmt = r.expense > 0 ? `<span class="amount-expense"> -${fmt(r.expense)}</span>` : '';
      const netAmt = r.income > 0 && r.expense > 0 ? `<span style="color:var(--text2);font-size:13px;margin-left:4px">= ${fmt(r.income-r.expense)}</span>` : '';
      return `<tr style="background:var(--surface2)">
        <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
        <td><span style="font-size:13px;color:var(--text3);font-weight:500">彙總</span></td>
        <td style="font-size:15px;font-weight:500">${r.item}</td>
        <td>${incAmt}${expAmt}${netAmt}</td>
        <td><span class="note-text">${r.note||''}</span></td>
        <td></td></tr>`;
    }
    const isPrepaid = r.note && r.note.includes('先付');
    const amt = r.income > 0
      ? `<span class="amount-income">+${fmt(r.income)}</span>`
      : r.expense > 0
      ? `<span class="amount-expense">-${fmt(r.expense)}</span>${isPrepaid?'<span style="font-size:12px;color:var(--text3);margin-left:4px">先付</span>':''}`
      : '';
    const delBtn = r.item === '帳戶餘額' ? '' : `<button class="delete-btn" onclick="deleteRecord(${r.row})">✕</button>`;
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:13px;color:var(--text2);white-space:nowrap">${formatDate(r.date)}</td>
      <td>${badge}</td>
      <td style="font-size:15px">${r.item}</td>
      <td>${amt}</td>
      <td><span class="note-text">${r.note||''}</span></td>
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
        ? `<span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${r.owner}</span>`
        : '');

    if (isTransfer) {
      return `<div class="record-card summary-card">
        <div class="record-card-top">
          <span class="record-card-date">${formatDateShort(r.date)}</span>
          <span style="font-size:13px;color:var(--text3)">轉帳結算</span>
        </div>
        <div class="record-card-mid">
          ${badgeHtml}
          <span class="record-card-item" style="font-weight:600">${r.item}</span>
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
        <div class="record-card-item">${r.item}</div>
        <div style="margin-top:6px">${incAmt}${expAmt}${net}</div>
      </div>`;
    }

    const amtColor = r.income > 0 ? 'var(--income)' : 'var(--expense)';
    const amtSign = r.income > 0 ? '+' : '-';
    const amtVal = r.income > 0 ? r.income : r.expense;
    const amtHtml = amtVal > 0 ? `<span style="color:${amtColor};font-weight:700;font-family:'DM Mono',monospace;font-size:18px">${amtSign}${fmt(amtVal)}</span>` : '';

    const delBtn = r.item === '帳戶餘額' ? '' : `<button class="delete-btn" onclick="deleteRecord(${r.row})">✕</button>`;
    return `<div class="record-card">
      <div class="record-card-top">
        <span class="record-card-date">${formatDateShort(r.date)}</span>
        ${amtHtml}
      </div>
      <div class="record-card-mid">
        ${badgeHtml}
        <span class="record-card-item">${r.item}</span>
      </div>
      <div class="record-card-bottom">
        <span class="record-card-note">${r.note||''}${isPrepaid?' · <span style="color:var(--text3)">先付</span>':''}</span>
        ${delBtn}
      </div>
    </div>`;
  }).join('');
}

function categorize(item) {
  if (/住宿|旅遊|民宿|飯店|酒店|旅館|商旅/.test(item)) return '住宿旅遊';
  if (/全聯|超市|買菜|市場/.test(item)) return '超市採購';
  if (/7-11|便利|全家/.test(item)) return '便利商店';
  if (/自強號|火車|高鐵|交通|客運|Uber|停車|台鐵|計程車/.test(item)) return '交通';
  if (/珍煮丹|飲料|手搖|茶/.test(item)) return '飲料';
  if (/房租/.test(item)) return '房租';
  if (/電費|電力|台電/.test(item)) return '電費';
  if (/水費|自來水/.test(item)) return '水費';
  if (/瓦斯|天然氣/.test(item)) return '瓦斯費';
  if (/網路費|寬頻|第四台|有線電視|MOD/.test(item)) return '網路與第四台';
  if (/管理費|社區管理/.test(item)) return '社區管理費';
  if (/修繕|水電工/.test(item)) return '水電雜支';
  if (/每月的愛/.test(item)) return '固定轉帳';
  if (/momo|蝦皮|網購/.test(item)) return '網購';
  if (/隧道|打彈珠|門票/.test(item)) return '景點';
  if (/原攝/.test(item)) return '相片';
  return '餐飲';
}

const CAT_EMOJI = {
  '住宿旅遊':'🏨', '超市採購':'🛒', '便利商店':'🏪', '交通':'🚆',
  '飲料':'🧋', '房租':'🏠', '電費':'⚡', '水費':'💧', '瓦斯費':'🔥',
  '網路與第四台':'🌐', '社區管理費':'🏢', '水電雜支':'🔧',
  '固定轉帳':'💸', '網購':'📦', '餐飲':'🍽️', '景點':'🎢', '相片':'📸'
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
            <span class="owner-badge ${r.owner==='精靈'?'badge-elf':'badge-fox'}">${r.owner==='精靈'?'🐎':'🦊'} ${r.owner}</span>
            <span style="font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.item}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:13px;color:var(--text3);font-family:'DM Mono',monospace">${formatDateShort(r.date)}</span>
            ${r.note ? `<span style="font-size:13px;color:var(--text3)">· ${r.note}</span>` : ''}
          </div>
        </div>
        <span class="amount-expense" style="margin-left:10px;flex-shrink:0">-${fmt(r.expense)}</span>
      </div>`
    ).join('') + `</div>`;
}

function renderMembers() {
  const people = ['精靈','小狐狸'];
  const prepaid = {'小狐狸':-6300};
  const monthlyContrib = {'精靈':13000,'小狐狸':7500};
  document.getElementById('memberGrid').innerHTML = people.map(p => {
    const expTotal = records.filter(r=>r.owner===p&&r.expense>0).reduce((s,r)=>s+r.expense,0);
    const count = records.filter(r=>r.owner===p&&r.expense>0).length;
    const prep = prepaid[p]||0;
    const emoji = p==='精靈'?'🐎':'🦊';
    return `<div class="member-card">
      <div class="member-name">${emoji} ${p}</div>
      <div class="member-stat"><span class="member-stat-label">每月進帳</span><span class="member-stat-value" style="color:var(--income)">+${fmt(monthlyContrib[p])}</span></div>
      ${prep<0?`<div class="member-stat"><span class="member-stat-label">先付款項</span><span class="member-stat-value" style="color:var(--expense)">-${fmt(Math.abs(prep))}</span></div>`:''}
      <div class="member-stat"><span class="member-stat-label">支出筆數</span><span class="member-stat-value">${count} 筆</span></div>
      <div class="member-stat"><span class="member-stat-label">支出合計</span><span class="member-stat-value" style="color:var(--expense)">-${fmt(expTotal)}</span></div>
    </div>`;
  }).join('');
}

let annualChartInst = null;

async function renderAnnualChart() {
  const yearMatch = currentSheet().match(/(\d{4})\//);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  document.getElementById('annual-title').textContent = `${year} 年度月份收支`;
  document.getElementById('annual-chart-wrap').innerHTML =
    '<div class="loading-state"><div class="spinner"></div>載入年度數據中…</div>';
  document.getElementById('annual-summary').innerHTML = '';

  try {
    const res = await apiCall({ action: 'getAnnualSummary', year });
    const monthData = res.summary || [];

    const expVals = monthData.map(d => d.expense);
    const incVals = monthData.map(d => d.income);
    const balVals = monthData.map(d => d.endingBalance);
    const labels = monthData.map(d => `${d.month}月`);

    document.getElementById('annual-chart-wrap').innerHTML = '<canvas id="annualChart"></canvas>';

    if (annualChartInst) annualChartInst.destroy();
    annualChartInst = new Chart(document.getElementById('annualChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '實質支出',
            data: expVals,
            borderColor: '#c45a2a',
            backgroundColor: 'rgba(196,90,42,0.06)',
            fill: false, tension: 0,
            pointRadius: 4, pointBackgroundColor: '#c45a2a',
            borderWidth: 2
          },
          {
            label: '新增收入',
            data: incVals,
            borderColor: '#2d7a5f',
            backgroundColor: 'rgba(45,122,95,0.06)',
            fill: false, tension: 0,
            pointRadius: 4, pointBackgroundColor: '#2d7a5f',
            borderWidth: 2
          },
          {
            label: '帳戶總水位 (期末餘額)',
            data: balVals,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.04)',
            fill: true, tension: 0,
            pointRadius: 5, pointBackgroundColor: '#8b5cf6',
            borderDash: [5, 5],
            borderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { family: 'Noto Sans TC', size: 13 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}：$${ctx.parsed.y.toLocaleString()}` } }
        },
        scales: {
          x: { ticks: { font: { family: 'Noto Sans TC', size: 12 } } },
          y: {
            beginAtZero: true,
            ticks: { callback: v => '$' + v.toLocaleString(), font: { family: 'DM Mono', size: 12 } }
          }
        }
      }
    });

    // 年度彙總卡片
    const totalExp = expVals.reduce((s, v) => s + v, 0);
    const totalInc = incVals.reduce((s, v) => s + v, 0);
    const balance = totalInc - totalExp;
    document.getElementById('annual-summary').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
        <div class="card"><div class="card-label">年度收入</div><div class="card-value income">${fmt(totalInc)}</div></div>
        <div class="card"><div class="card-label">年度支出</div><div class="card-value expense">${fmt(totalExp)}</div></div>
        <div class="card"><div class="card-label">年度結餘</div>
          <div class="card-value" style="color:${balance>=0?'var(--income)':'var(--expense)'}">${fmt(balance)}</div>
        </div>
      </div>`;

  } catch(e) {
    document.getElementById('annual-chart-wrap').innerHTML =
      '<div class="empty-state">⚠️ 載入失敗，請重試</div>';
  }
}

function switchTab(name, el) {
  ['records','analysis','members','annual','island'].forEach(t => {
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
}

function openModal() {
  amountType = 'expense';
  const today = new Date();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  document.getElementById('overlayContainer').innerHTML = `
    <div class="overlay" id="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">新增記錄</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="amount-toggle">
          <button class="toggle-btn" id="toggleExpense" onclick="setType('expense')" style="background:var(--fox-bg);color:var(--expense)">支出 −</button>
          <button class="toggle-btn" id="toggleIncome" onclick="setType('income')">收入 ＋</button>
        </div>
        <div class="row2">
          <div class="field"><label>日期</label><input id="f-date" type="text" value="${mm}/${dd}" placeholder="MM/DD"></div>
          <div class="field"><label>擁有者</label><select id="f-owner">
            <option value="精靈">🐎 精靈</option>
            <option value="小狐狸">🦊 小狐狸</option>
          </select></div>
        </div>
        <div class="field"><label>項目</label><input id="f-item" type="text" placeholder="例：竹南 全聯"></div>
        <div class="field"><label>金額</label><input id="f-amount" type="number" placeholder="0" min="0" inputmode="numeric"></div>
        <div class="field"><label>備註</label><textarea id="f-note" placeholder="選填"></textarea></div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">取消</button>
          <button class="btn-save" id="saveBtn" onclick="submitRecord()">儲存</button>
        </div>
      </div>
    </div>`;
}

function setType(type) {
  amountType = type;
  document.getElementById('toggleExpense').style.cssText = type==='expense'?'background:var(--fox-bg);color:var(--expense)':'';
  document.getElementById('toggleIncome').style.cssText = type==='income'?'background:var(--elf-bg);color:var(--income)':'';
}

function closeModal() { document.getElementById('overlayContainer').innerHTML=''; }

async function submitRecord() {
  const date = document.getElementById('f-date').value.trim();
  const owner = document.getElementById('f-owner').value;
  const item = document.getElementById('f-item').value.trim();
  const amount = parseFloat(document.getElementById('f-amount').value)||0;
  const note = document.getElementById('f-note').value.trim();
  if (!date||!item||amount<=0) { showToast('請填寫日期、項目和金額'); return; }
  const btn = document.getElementById('saveBtn');
  btn.disabled=true; btn.textContent='儲存中…';
  await addRecord({ date, owner, item, income: amountType==='income'?amount:0, expense: amountType==='expense'?amount:0, note });
  closeModal();
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2200);
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
}

// ── INIT ─────────────────────────────────────────────────────
applyMonthTheme(getAutoMonth());
initSheets();
preloadAssets(() => {
  const islandTab = document.getElementById('tab-island');
  if (islandTab && islandTab.style.display !== 'none') {
    renderIsland();
  }
});

// ── 視覺小島 (Visual Island) 繪圖引擎 ──────────────────────────

// 自動對白底圖檔進行 flood-fill 去背 (Chroma keying)
function makeBackgroundTransparent(imgEl, callback) {
  callback(imgEl);
}

function preloadAssets(callback) {
  let loadedCount = 0;
  const keys = Object.keys(ASSET_FILES);
  const total = keys.length;
  
  keys.forEach(key => {
    const img = new Image();
    img.src = ASSET_FILES[key];
    img.onload = () => {
      makeBackgroundTransparent(img, (processedImg) => {
        ASSETS[key] = processedImg;
        loadedCount++;
        if (loadedCount === total) {
          assetsLoaded = true;
          if (callback) callback();
        }
      });
    };
    img.onerror = () => {
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
    if (r.expense <= 0) return;
    const cat = categorize(r.item);
    if (cat === '餐飲' || cat === '飲料') {
      catExpenses.dining += r.expense;
    } else if (cat === '超市採購' || cat === '便利商店') {
      catExpenses.grocery += r.expense;
    } else if (cat === '住宿旅遊' || cat === '景點') {
      catExpenses.travel += r.expense;
    } else if (cat === '交通') {
      catExpenses.transport += r.expense;
    } else if (cat === '房租') {
      catExpenses.rent += r.expense;
    } else if (['電費', '水費', '瓦斯費', '網路與第四台', '社區管理費', '水電雜支'].includes(cat)) {
      catExpenses.utilities += r.expense;
    } else if (cat === '網購') {
      catExpenses.shopping += r.expense;
    } else if (cat === '固定轉帳') {
      catExpenses.transfer += r.expense;
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
  
  let balance = startingBalance + totalIncome - totalExpense;
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
  
  canvas.ondblclick = (e) => {
    islandZoom = 1.0;
    islandOffsetX = 0;
    islandOffsetY = 0;
    e.preventDefault();
  };
  
  const width = canvas.parentElement.clientWidth || 500;
  const height = 500;
  
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
  const baseCy = 330; // 往下拉並對齊草地中心
  
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
    const floatY = Math.sin(Date.now() / 450) * 4.5;
    
    const drawOrder = [
      { r: 0, c: 0, type: 'castle', val: balance },
      { r: 0, c: 1, type: 'dining', val: catExpenses.dining },
      { r: 1, c: 0, type: 'travel', val: catExpenses.travel },
      { r: 0, c: 2, type: 'grocery', val: catExpenses.grocery },
      { r: 1, c: 1, type: 'utilities', val: catExpenses.utilities },
      { r: 2, c: 0, type: 'transport', val: catExpenses.transport },
      { r: 1, c: 2, type: 'rent', val: catExpenses.rent },
      { r: 2, c: 1, type: 'shopping', val: catExpenses.shopping },
      { r: 2, c: 2, type: 'transfer', val: catExpenses.transfer }
    ];
    
    const localMouseX = (mouseX - width / 2 - islandOffsetX) / islandZoom + width / 2;
    const localMouseY = (mouseY - height / 2 - islandOffsetY) / islandZoom + height / 2;
    
    const spacing = 90;
    drawOrder.forEach(item => {
      const dx = (item.r - 1) * spacing;
      const dy = (item.c - 1) * spacing;
      const cx = baseCx + (dx - dy);
      const cy = baseCy + (dx + dy) * 0.46;
      
      let finalCy = cy;
      if (item.type === 'transfer') finalCy += 4; // micro-adjust front balloon
      
      drawIsoBuilding(ctx, cx, finalCy, item.type, item.val, windmillAngle, floatY, localMouseX, localMouseY);
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
  if (assetsLoaded && ASSETS.island_base) {
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
  if (assetsLoaded) {
    const assetMap = {
      castle: { img: ASSETS.castle, zeroColor: "#ef4444", th1: 5000, th2: 50000 },
      dining: { img: ASSETS.cafe, zeroColor: "#fef08a", th1: 1500, th2: 6000 },
      grocery: { img: ASSETS.farm, zeroColor: "#bbf7d0", th1: 1000, th2: 4000 },
      travel: { img: ASSETS.resort, zeroColor: "#bfdbfe", th1: 2000, th2: 8000 },
      transport: { img: ASSETS.station, zeroColor: "#fbcfe8", th1: 800, th2: 3000 },
      rent: { img: ASSETS.apartment, zeroColor: "#ffedd5", th1: 5000, th2: 15000 },
      utilities: { img: ASSETS.windmill, zeroColor: "#ddd6fe", th1: 1000, th2: 3000 },
      shopping: { img: ASSETS.warehouse, zeroColor: "#e2e8f0", th1: 1500, th2: 5000 },
      transfer: { img: ASSETS.balloon, zeroColor: "#fef08a", th1: 5000, th2: 15000 }
    };
    const info = assetMap[type];
    if (info) {
      try {
        if (value <= 0) {
          drawIsoFlower(ctx, cx, cy, info.zeroColor);
          return;
        }
        let size = 56;
        let img = info.img;
        let yOffset = 0;
        
        if (type === 'transport') {
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
          const w = size;
          const imgW = img.naturalWidth || img.width || 1;
          const imgH = img.naturalHeight || img.height || 1;
          const h = w * (imgH / imgW);
          ctx.drawImage(img, Math.round(cx - w/2), Math.round(cy - h + 30 - yOffset), Math.round(w), Math.round(h));
          if (type === 'dining' && value >= 5000) {
            const sy = (Date.now() / 25) % 15;
            ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
            ctx.beginPath();
            ctx.arc(cx - 16 + Math.sin(sy/2)*2, cy - h + 12 - sy, 2.5 + sy/8, 0, Math.PI*2);
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
    } else if (value < 50000) {
      // 莊園別墅
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
    } else if (value < 1000) {
      // 迷你菜園
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(cx - 3, cy + 1, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy + 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 4000) {
      // 溫室
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.grocery.top, colors.grocery.left, colors.grocery.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 6, "#64748b", "#475569");
    } else {
      // 穀倉及筒倉
      drawIsoBlock(ctx, cx - 4, cy + 2, 18, 14, "#4ade80", colors.grocery.left, colors.grocery.right);
      drawIsoPyramid(ctx, cx - 4, cy + 2, 18, 14, 8, "#f59e0b", "#d97706");
      drawIsoCylinder(ctx, cx + 10, cy - 2, 8, 18, "#cbd5e1", "#64748b", "#475569");
    }
  } else if (type === 'travel') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#bfdbfe"); // 藍色花朵
    } else if (value < 2000) {
      // 帳篷
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 2);
      ctx.lineTo(cx, cy - 8);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (value < 8000) {
      // 渡假小屋
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.travel.top, colors.travel.left, colors.travel.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#e2e8f0", "#94a3b8");
    } else {
      // 泳池別墅
      ctx.fillStyle = "#38bdf8"; // 泳池水面
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 4);
      ctx.lineTo(cx, cy + 11);
      ctx.lineTo(cx + 15, cy + 4);
      ctx.lineTo(cx, cy - 3);
      ctx.closePath();
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
    } else if (value < 5000) {
      // 迷你郵箱
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(cx - 2, cy - 7, 4, 7);
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 7); ctx.lineTo(cx, cy - 11); ctx.lineTo(cx + 4, cy - 7);
      ctx.closePath();
      ctx.fill();
    } else if (value < 15000) {
      // 洋房
      drawIsoBlock(ctx, cx, cy, 22, 14, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 22, 14, 8, "#78350f", "#451a03");
    } else {
      // 高階大樓
      drawIsoBlock(ctx, cx, cy, 24, 14, 28, colors.rent.top, colors.rent.left, colors.rent.right);
      drawIsoPyramid(ctx, cx, cy, 24, 14, 6, "#78350f", "#451a03");
      // 亮燈窗戶
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(cx - 5, cy - 22, 3, 4);
      ctx.fillRect(cx + 2, cy - 22, 3, 4);
      ctx.fillRect(cx - 5, cy - 13, 3, 4);
      ctx.fillRect(cx + 2, cy - 13, 3, 4);
    }
  } else if (type === 'utilities') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#ddd6fe"); // 紫色花朵
    } else if (value < 1000) {
      // 消防栓
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(cx - 2.5, cy - 8, 5, 8);
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (value < 3000) {
      // 風車
      drawIsoWindmill(ctx, cx, cy, 24, angle, colors.utilities.tower, colors.utilities.blades);
    } else {
      // 雙風車發電廠
      drawIsoBlock(ctx, cx - 6, cy + 3, 14, 10, "#cbd5e1", "#94a3b8", "#64748b");
      drawIsoWindmill(ctx, cx + 4, cy - 3, 32, angle, colors.utilities.tower, colors.utilities.blades);
    }
  } else if (type === 'shopping') {
    if (value <= 0) {
      drawIsoFlower(ctx, cx, cy, "#e2e8f0"); // 灰色花朵
    } else if (value < 1500) {
      // 快遞紙箱
      drawIsoBlock(ctx, cx, cy, 12, 10, 6, "#d97706", "#b45309", "#78350f");
    } else if (value < 5000) {
      // 貨櫃
      drawIsoBlock(ctx, cx, cy, 22, 12, 12, colors.shopping.top, colors.shopping.left, colors.shopping.right);
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 2); ctx.lineTo(cx - 5, cy - 10);
      ctx.moveTo(cx + 5, cy - 3); ctx.lineTo(cx + 5, cy - 15);
      ctx.stroke();
    } else {
      // 配送中心與貨車
      drawIsoBlock(ctx, cx - 4, cy + 2, 22, 14, 14, colors.shopping.top, colors.shopping.left, colors.shopping.right);
      drawIsoPyramid(ctx, cx - 4, cy + 2, 22, 14, 6, "#475569", "#334155");
      drawIsoBlock(ctx, cx + 10, cy - 1, 8, 5, "#f43f5e", "#e11d48", "#991b1b"); // 紅色小貨車
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
    if (val < 5000) return '🔥 營火小木屋';
    if (val < 50000) return '🏠 舒適莊園';
    return '🏰 繁榮城堡';
  } else if (type === 'dining') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 500) return '🧋 街角飲料店';
    if (val < 2000) return '🍱 台式便當店';
    if (val < 5000) return '🍰 溫馨咖啡廳';
    return '🍽️ 豪華西餐廳 (超預算警告)';
  } else if (type === 'grocery') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1000) return '🥬 迷你菜園';
    if (val < 4000) return '🥦 自動溫室';
    return '🌾 豐收穀倉';
  } else if (type === 'travel') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 2000) return '⛺ 旅行帳篷';
    if (val < 8000) return '🏡 渡假小屋';
    return '🏨 泳池別墅';
  } else if (type === 'transport') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 100) return '🚲 綠能腳踏車';
    if (val < 500) return '🚗 街頭小汽車';
    if (val < 3000) return '🚆 蒸汽小火車';
    return '✈️ 夢想雙翼機';
  } else if (type === 'rent') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 5000) return '📮 迷你郵筒';
    if (val < 15000) return '🏠 磚瓦洋房';
    return '🏢 高階住宅大樓';
  } else if (type === 'utilities') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1000) return '💧 簡易水源';
    if (val < 3000) return '💨 風力發電';
    return '⚡ 大型變電所';
  } else if (type === 'shopping') {
    if (val <= 0) return '🌸 尚未消費';
    if (val < 1500) return '📦 快遞紙箱';
    if (val < 5000) return '🚢 貨櫃箱';
    return '🏬 物流配送中心';
  } else if (type === 'transfer') {
    if (val <= 0) return '🌸 尚未消費';
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
  
  const items = [
    { icon: '🏰', name: '帳戶餘額', type: 'castle', val: balance, prefix: '目前水位: ' },
    { icon: '🍽️', name: '餐飲與飲料', type: 'dining', val: cats.dining, prefix: '本月支出: ' },
    { icon: '🛒', name: '超市與超商', type: 'grocery', val: cats.grocery, prefix: '本月支出: ' },
    { icon: '🏨', name: '住宿與景點', type: 'travel', val: cats.travel, prefix: '本月支出: ' },
    { icon: '🚆', name: '交通出行', type: 'transport', val: cats.transport, prefix: '本月支出: ' },
    { icon: '🏠', name: '房租支出', type: 'rent', val: cats.rent, prefix: '本月支出: ' },
    { icon: '⚡', name: '水電瓦斯網路', type: 'utilities', val: cats.utilities, prefix: '本月支出: ' },
    { icon: '📦', name: '網購消費', type: 'shopping', val: cats.shopping, prefix: '本月支出: ' },
    { icon: '🎈', name: '固定轉帳', type: 'transfer', val: cats.transfer, prefix: '本月支出: ' }
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
