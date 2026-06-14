const API = 'https://script.google.com/macros/s/AKfycbzdnp_gvKGGELnzDA4ZNq25RQ3mPPOXqbuwINKUBXuobbBw_cLubt8Cn-oDrazLfgkk/exec';
let records = [];
let catChartInst = null;
let amountType = 'expense';
let manualSeason = null;

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
  ['records','analysis','members','annual'].forEach(t => {
    document.getElementById('tab-'+t).style.display = t===name ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (name === 'analysis') setTimeout(renderCharts, 50);
  if (name === 'members') renderMembers();
  if (name === 'annual') renderAnnualChart();
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
