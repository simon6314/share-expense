function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

// ════════════════════════════════════════════════════════════════
// 請用以下內容取代原本的 handleRequest 函式，並在檔案最後加入新增的函式。
// 其他既有函式（getSheetNames、getAnnualSummary、getAllRecords、addRecord、
// deleteRecord、updateTransfer）維持不變。
// ════════════════════════════════════════════════════════════════

const SETTINGS_SHEET = '設定';
// 這些 action 不需要月份工作表
const INVENTORY_SHEET = '庫存';
const INVENTORY_ACTIONS = ['getInventory', 'addInventory', 'updateInventory', 'deleteInventory', 'getIconMap'];
const ICON_SHEET = '圖示對照';
const NO_SHEET_ACTIONS = ['getSheets', 'getAnnualSummary', 'getSettings', 'setSettings', 'getVersions'].concat(INVENTORY_ACTIONS);

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const params = e.parameter;
    const action = params.action;
    const sheetName = params.sheet || '2026/5月支出';
    const sheet = NO_SHEET_ACTIONS.indexOf(action) === -1 ? ss.getSheetByName(sheetName) : null;

    let result;
    if (action === 'getVersions') {
      result = getVersions();
    } else if (action === 'getSheets') {
      result = getSheetNames(ss);
    } else if (action === 'getAnnualSummary') {
      result = getAnnualSummary(ss, parseInt(params.year) || new Date().getFullYear());
    } else if (action === 'getSettings') {
      result = getSettings(ss);
    } else if (action === 'setSettings') {
      result = setSettings(ss, JSON.parse(params.data));
    } else if (INVENTORY_ACTIONS.indexOf(action) !== -1) {
      result = handleInventory(ss, action, params);
    } else if (!sheet) {
      result = { error: '找不到工作表：' + sheetName };
    } else if (action === 'getAll') {
      result = getAllRecords(sheet);
    } else if (action === 'add') {
      result = addRecord(sheet, JSON.parse(params.data), parseInt(params.beforeRow) || null);
    } else if (action === 'updateRecord') {
      result = updateRecord(sheet, parseInt(params.row), JSON.parse(params.data));
    } else if (action === 'delete') {
      result = deleteRecord(sheet, parseInt(params.row));
    } else if (action === 'updateTransfer') {
      result = updateTransfer(sheet, parseInt(params.row), params.field, parseFloat(params.value) || 0);
    } else {
      result = { error: '未知的 action' };
    }

    // 寫入成功後更新該月份版本號，前端據此判斷要不要重抓
    if (['add', 'updateRecord', 'delete', 'updateTransfer'].indexOf(action) !== -1 && sheet && result && result.success) {
      bumpVer(sheetName);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ── 編輯既有記錄 ──────────────────────────────────────────────
function updateRecord(sheet, rowNum, d) {
  if (!rowNum || rowNum < 2 || rowNum > sheet.getLastRow()) {
    return { error: 'invalid', message: '找不到這筆記錄' };
  }
  const cur = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];
  const curOwner = String(cur[1] || '');
  const curItem = String(cur[2] || '');

  // 彙總列、轉帳列、帳戶餘額列由系統計算，不允許直接編輯
  if (curOwner === '帳戶餘額' || curItem === '帳戶餘額' ||
      curItem.indexOf('總收入/支出') !== -1 || curItem.indexOf('支出部分轉回') !== -1) {
    return { error: 'protected', message: '此列由系統自動計算，無法編輯' };
  }

  // 列號可能因為別人新增或刪除而改變，比對原本的項目名稱確認是同一筆
  if (d.expectedItem !== undefined && String(d.expectedItem) !== curItem) {
    return { error: 'stale', message: '資料已被更新，請重新整理後再試' };
  }

  sheet.getRange(rowNum, 1, 1, 6).setValues([[
    d.date,
    d.owner,
    d.item,
    d.income || '',
    d.expense || '',
    d.note || ''
  ]]);
  return { success: true };
}

// ── 設定表：年收入、進帳比例、分攤月數（網頁與試算表同步） ──────
// 表格格式：A 擁有者 | B 年收入 | C 比例(%) | D 分攤月數 | E 更新時間
function getSettingsSheet(ss) {
  let sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET);
    sh.getRange(1, 1, 1, 5).setValues([['擁有者', '年收入', '比例(%)', '分攤月數', '更新時間']]);
    sh.getRange(2, 1, 2, 4).setValues([
      ['精靈', 1250000, 37.5, 14],
      ['小狐狸', 700000, 37.5, 14]
    ]);
  }
  return sh;
}

function getSettings(ss) {
  const data = getSettingsSheet(ss).getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    const owner = String(data[i][0] || '').trim();
    if (!owner) continue;
    settings[owner] = {
      annual: Number(data[i][1]) || 0,
      rate: Number(data[i][2]) || 0,
      months: Number(data[i][3]) || 14
    };
  }
  return { settings: settings };
}

function setSettings(ss, d) {
  const owner = String(d.owner || '').trim();
  if (!owner) return { error: '缺少擁有者' };

  const annual = Math.max(0, Number(d.annual) || 0);
  const rate = Math.min(100, Math.max(0, Number(d.rate) || 0));
  const months = Math.min(24, Math.max(1, parseInt(d.months, 10) || 14));

  const sh = getSettingsSheet(ss);
  const data = sh.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === owner) { row = i + 1; break; }
  }
  if (row === -1) {
    row = sh.getLastRow() + 1;
    sh.getRange(row, 1).setValue(owner);
  }
  sh.getRange(row, 2, 1, 4).setValues([[annual, rate, months, new Date()]]);
  return { success: true };
}

function getSheetNames(ss) {
  const sheets = ss.getSheets()
    .map(s => s.getName())
    .filter(name => /\d{4}\/\d{1,2}月/.test(name));
  return { sheets };
}

// ⚡ 跨月自動對齊的年度 API 模組
function getAnnualSummary(ss, year) {
  const sheets = ss.getSheets()
    .filter(s => {
      const name = s.getName();
      const m = name.match(/(\d{4})\/(\d{1,2})月/);
      return m && parseInt(m[1]) === year;
    });

  sheets.sort((a, b) => {
    const ma = a.getName().match(/(\d{4})\/(\d{1,2})月/);
    const mb = b.getName().match(/(\d{4})\/(\d{1,2})月/);
    return parseInt(ma[2]) - parseInt(mb[2]);
  });

  const monthSummary = {};
  for (let m = 1; m <= 12; m++) {
    monthSummary[m] = { startingBalance: 0, income: 0, expense: 0, endingBalance: 0, hasData: false };
  }

  sheets.forEach(sheet => {
    const name = sheet.getName();
    const m = name.match(/(\d{4})\/(\d{1,2})月/);
    const month = parseInt(m[2]);
    const data = sheet.getDataRange().getValues();
    
    let startingBalance = 0;
    let realIncome = 0;
    let realExpense = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[2]) continue;
      
      const item = row[2] ? String(row[2]) : '';
      const owner = row[1] ? String(row[1]) : '';
      
      if (item === '帳戶餘額' && owner === '') {
        startingBalance = parseFloat(row[3]) || 0;
        continue;
      }

      const isSummary = item.indexOf('總收入/支出') !== -1 || 
                        item.indexOf('支出部分轉回') !== -1 || 
                        owner === '帳戶餘額';
      
      if (isSummary) continue;

      const isPrepaid = row[5] && String(row[5]).indexOf('先付') !== -1;
      const income = parseFloat(row[3]) || 0;
      const expense = parseFloat(row[4]) || 0;

      if (owner !== '') {
        realIncome += income;
      }
      if (!isPrepaid) {
        realExpense += expense;
      }
    }

    monthSummary[month] = {
      startingBalance: startingBalance,
      income: realIncome,
      expense: realExpense,
      endingBalance: startingBalance + realIncome - realExpense,
      hasData: true
    };
  });

  // 將第 m 月的「期末餘額」對齊第 m+1 月的「期初餘額」，完美修正超支引起的跳躍
  for (let m = 1; m < 12; m++) {
    if (monthSummary[m].hasData && monthSummary[m + 1].hasData) {
      monthSummary[m].endingBalance = monthSummary[m + 1].startingBalance;
    }
  }

  const summaryList = [];
  for (let m = 1; m <= 12; m++) {
    summaryList.push({
      month: m,
      income: monthSummary[m].income,
      expense: monthSummary[m].expense,
      endingBalance: monthSummary[m].endingBalance,
      hasData: monthSummary[m].hasData
    });
  }

  return { summary: summaryList };
}

function getAllRecords(sheet) {
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[2]) continue;
    records.push({
      row: i + 1,
      date: row[0] ? String(row[0]) : '',
      owner: row[1] ? String(row[1]) : '',
      item: row[2] ? String(row[2]) : '',
      income: parseFloat(row[3]) || 0,
      expense: parseFloat(row[4]) || 0,
      note: row[5] ? String(row[5]) : ''
    });
  }
  return { records };
}

function addRecord(sheet, data, beforeRow) {
  if (beforeRow && beforeRow > 1) {
    sheet.insertRowBefore(beforeRow);
    sheet.getRange(beforeRow, 1, 1, 6).setValues([[
      data.date,
      data.owner,
      data.item,
      data.income || '',
      data.expense || '',
      data.note || ''
    ]]);

    const newSummaryRow = beforeRow + 1;
    const dataEnd = newSummaryRow - 1;

    sheet.getRange(newSummaryRow, 4).setFormula(`=SUM(D2:D${dataEnd})`);
    sheet.getRange(newSummaryRow, 5).setFormula(`=SUM(E4:E${dataEnd})`);

    const lastRow = sheet.getLastRow();
    if (lastRow > newSummaryRow) {
      const range = sheet.getRange(newSummaryRow + 1, 3, lastRow - newSummaryRow, 1).getValues();
      
      let elfTransferRow = null;
      let foxTransferRow = null;
      
      for (let i = 0; i < range.length; i++) {
        const itemText = range[i][0];
        if (itemText && itemText.indexOf('支出部分轉回') !== -1) {
          const transferRow = newSummaryRow + 1 + i;
          if (itemText.indexOf('精靈') !== -1) {
            elfTransferRow = transferRow;
          } else if (itemText.indexOf('小狐狸') !== -1) {
            foxTransferRow = transferRow;
          }
        }
      }
      
      if (elfTransferRow) {
        sheet.getRange(elfTransferRow, 4).setFormula(`=D${newSummaryRow}`);
      }
      if (foxTransferRow && elfTransferRow) {
        sheet.getRange(foxTransferRow, 4).setFormula(`=D${elfTransferRow}-E${elfTransferRow}`);
      }
    }

    return { success: true, row: beforeRow };
  } else {
    sheet.appendRow([
      data.date,
      data.owner,
      data.item,
      data.income || '',
      data.expense || '',
      data.note || ''
    ]);
    return { success: true, row: sheet.getLastRow() };
  }
}

function deleteRecord(sheet, rowNum) {
  sheet.deleteRow(rowNum);
  return { success: true };
}

// ⚡ 核心升級：當手動更新轉帳金額時，自動重新計算物理餘額並「跨表寫入」至下月期初餘額中！
function updateTransfer(sheet, rowNum, field, value) {
  const col = field === 'income' ? 4 : 5;
  sheet.getRange(rowNum, col).setValue(value || '');

  // 跨月份自動同步期初餘額
  const ss = sheet.getParent();
  const currentSheetName = sheet.getName();
  const mMatch = currentSheetName.match(/(\d{4})\/(\d{1,2})月/);
  
  if (mMatch) {
    const year = parseInt(mMatch[1]);
    const month = parseInt(mMatch[2]);
    
    // 計算下個月的字串標記
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    const allSheets = ss.getSheets();
    const nextSheet = allSheets.find(s => s.getName().indexOf(`${nextYear}/${nextMonth}月`) !== -1);
    
    if (nextSheet) {
      // 重新加載並計算當期最新的物理餘額（精靈＋小狐狸）
      const data = sheet.getDataRange().getValues();
      const transferRows = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const item = row[2] ? String(row[2]) : '';
        if (item.indexOf('支出部分轉回') !== -1) {
          transferRows.push({
            row: i + 1,
            income: parseFloat(row[3]) || 0,
            expense: parseFloat(row[4]) || 0
          });
        }
      }
      
      // 更新本列正在寫入的新數值
      transferRows.forEach(tr => {
        if (tr.row === rowNum) {
          if (field === 'income') tr.income = value;
          else tr.expense = value;
        }
      });
      
      let finalBalance = 0;
      if (transferRows.length > 0) {
        // 1. 計算精靈轉回後的餘額（餘 - 轉）
        const elfRow = transferRows.find(tr => {
          const itemText = sheet.getRange(tr.row, 3).getValue();
          return itemText.indexOf('精靈') !== -1;
        });
        if (elfRow) {
          const elfIncome = elfRow.row === rowNum && field === 'income' ? value : elfRow.income;
          const elfExpense = elfRow.row === rowNum && field === 'expense' ? value : elfRow.expense;
          finalBalance = elfIncome - elfExpense;
        }
        
        // 2. 將精靈的結果同步以公式寫入小狐狸的「餘」(D欄/income)，並扣除小狐狸的「轉」得到最終帳戶餘額
        const foxRow = transferRows.find(tr => {
          const itemText = sheet.getRange(tr.row, 3).getValue();
          return itemText.indexOf('小狐狸') !== -1;
        });
        if (foxRow) {
          const foxExpense = foxRow.row === rowNum && field === 'expense' ? value : foxRow.expense;
          if (elfRow) {
            sheet.getRange(foxRow.row, 4).setFormula(`=D${elfRow.row}-E${elfRow.row}`);
          }
          finalBalance = finalBalance - foxExpense;
        }
      }
      
      // 3. 自動寫入下個月の期初「帳戶餘額」的 D 欄中
      const nextData = nextSheet.getDataRange().getValues();
      for (let i = 1; i < nextData.length; i++) {
        const item = nextData[i][2] ? String(nextData[i][2]) : '';
        const owner = nextData[i][1] ? String(nextData[i][1]) : '';
        if (item === '帳戶餘額' && owner === '') {
          nextSheet.getRange(i + 1, 4).setValue(finalBalance);
          bumpVer(nextSheet.getName());
          break;
        }
      }
    }
  }

  return { success: true };
}
// ── 家用品庫存（工作表「庫存」）────────────────────────────────
// 欄位：A 編號 | B 品項 | C 圖示 | D 數量 | E (未使用) | F 更新時間 | G 快用完（TRUE/FALSE）| H 分類 | I 期限
function getInventorySheet(ss) {
  let sh = ss.getSheetByName(INVENTORY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(INVENTORY_SHEET);
    sh.getRange(1, 1, 1, 9).setValues([['編號', '品項', '圖示', '數量', '', '更新時間', '快用完', '分類', '期限']]);
  }
  return sh;
}

function handleInventory(ss, action, params) {
  const sh = getInventorySheet(ss);
  if (action === 'getInventory') return { items: readInventory(sh) };
  if (action === 'getIconMap') return { rows: readIconMap(ss) };
  const d = params.data ? JSON.parse(params.data) : {};
  if (action === 'addInventory') return addInventoryItem(sh, d);
  if (action === 'updateInventory') return updateInventoryItem(sh, String(params.id || ''), d);
  if (action === 'deleteInventory') return deleteInventoryItem(sh, String(params.id || ''));
  return { error: '未知的庫存 action' };
}

// 日期格式化成 yyyy-MM-dd（試算表可能把日期存成 Date，也可能是文字）
function fmtExpiry(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}

function readInventory(sh) {
  const data = sh.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '').trim();
    if (!id) continue;
    items.push({
      id: id,
      name: String(data[i][1] || ''),
      icon: String(data[i][2] || '🧺'),
      qty: Number(data[i][3]) || 0,
      low: data[i][6] === true,
      cat: String(data[i][7] || '消耗品'),
      expiry: fmtExpiry(data[i][8])
    });
  }
  return items;
}

function findInventoryRow(sh, id) {
  const ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return i + 2;
  }
  return -1;
}

// mode = 'merge'：同品項、同分類、同期限就直接增加數量；不同期限會另外建一列（分批管理）
function addInventoryItem(sh, d) {
  const name = String(d.name || '').trim();
  if (!name) return { error: '缺少品項名稱' };
  const qty = Math.max(0, Number(d.qty) || 1);
  const cat = String(d.cat || '消耗品');
  const expiry = String(d.expiry || '').trim();
  const data = sh.getDataRange().getValues();
  if (d.mode === 'merge') {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === name &&
          (String(data[i][7] || '消耗品') === cat) &&
          fmtExpiry(data[i][8]) === expiry) {
        const newQty = (Number(data[i][3]) || 0) + qty;
        sh.getRange(i + 1, 4).setValue(newQty);
        sh.getRange(i + 1, 6).setValue(new Date());
        return { success: true, merged: true, id: String(data[i][0]) };
      }
    }
  }
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  const expVal = expiry ? new Date(expiry + 'T00:00:00') : '';
  sh.appendRow([id, name, d.icon || '🧺', qty, '', new Date(), false, cat, expVal]);
  return { success: true, merged: false, id: id };
}

function updateInventoryItem(sh, id, d) {
  const row = findInventoryRow(sh, id);
  if (row === -1) return { error: '找不到這個品項' };
  if (d.name !== undefined) sh.getRange(row, 2).setValue(String(d.name).trim());
  if (d.icon !== undefined) sh.getRange(row, 3).setValue(String(d.icon));
  if (d.qty !== undefined) sh.getRange(row, 4).setValue(Math.max(0, Number(d.qty) || 0));
  if (d.low !== undefined) sh.getRange(row, 7).setValue(!!d.low);
  sh.getRange(row, 6).setValue(new Date());
  return { success: true };
}

function deleteInventoryItem(sh, id) {
  const row = findInventoryRow(sh, id);
  if (row === -1) return { error: '找不到這個品項' };
  sh.deleteRow(row);
  return { success: true };
}

// ── 圖示對照（工作表「圖示對照」）─────────────────────────────
// 欄位：A 關鍵字 | B 圖示 | C 比對方式（完整 / 字尾 / 包含）
// 第一次呼叫時會自動建立，並填入預設規則；之後直接在表格增刪列即可
const DEFAULT_ICON_ROWS = [
  ["完整", "衛生紙", "🧻"],
  ["完整", "捲筒衛生紙", "🧻"],
  ["完整", "面紙", "🧻"],
  ["完整", "廁紙", "🧻"],
  ["完整", "濕紙巾", "🧻"],
  ["完整", "紙巾", "🧻"],
  ["完整", "擦臉巾", "🧻"],
  ["完整", "洗衣精", "🧴"],
  ["完整", "洗衣粉", "🧴"],
  ["完整", "柔軟精", "🧴"],
  ["完整", "卸妝乳", "🧴"],
  ["完整", "防曬乳", "🧴"],
  ["完整", "洗碗精", "🫧"],
  ["完整", "菜瓜布", "🫧"],
  ["完整", "清潔劑", "🫧"],
  ["完整", "廚房紙巾", "🫧"],
  ["完整", "廚餘濾網", "🧽"],
  ["完整", "牙膏", "🪥"],
  ["完整", "牙刷", "🪥"],
  ["完整", "牙線", "🪥"],
  ["完整", "沐浴乳", "🧼"],
  ["完整", "洗髮精", "🧼"],
  ["完整", "潤髮乳", "🧼"],
  ["完整", "肥皂", "🧼"],
  ["完整", "香皂", "🧼"],
  ["完整", "醬油", "🧂"],
  ["完整", "鹽", "🧂"],
  ["完整", "糖", "🧂"],
  ["完整", "醋", "🧂"],
  ["完整", "味精", "🧂"],
  ["完整", "胡椒", "🧂"],
  ["完整", "垃圾袋", "🗑️"],
  ["完整", "電池", "🔋"],
  ["完整", "酒精", "🧴"],
  ["完整", "口罩", "😷"],
  ["完整", "雞蛋", "🥚"],
  ["完整", "蛋", "🥚"],
  ["完整", "牛奶", "🥛"],
  ["完整", "豆漿", "🥛"],
  ["完整", "咖啡", "☕"],
  ["完整", "茶葉", "🍵"],
  ["完整", "茶包", "🍵"],
  ["完整", "白米", "🍚"],
  ["完整", "米", "🍚"],
  ["完整", "麵條", "🍜"],
  ["完整", "泡麵", "🍜"],
  ["完整", "義大利麵", "🍝"],
  ["完整", "餅乾", "🍪"],
  ["完整", "卡拉姆久", "🥔"],
  ["完整", "洋芋片", "🥔"],
  ["完整", "喜餅", "🥮"],
  ["完整", "巧克力", "🍫"],
  ["完整", "冰棒", "🍭"],
  ["完整", "冰淇淋", "🍦"],
  ["完整", "酒", "🍷"],
  ["完整", "泡菜", "🥬"],
  ["字尾", "冰棒", "🍭"],
  ["字尾", "冰淇淋", "🍦"],
  ["字尾", "咖啡", "☕"],
  ["字尾", "茶", "🍵"],
  ["字尾", "餅乾", "🍪"],
  ["字尾", "酒", "🍷"],
  ["字尾", "泡菜", "🥬"],
  ["包含", "巧克力", "🍫"]
];

function readIconMap(ss) {
  let sh = ss.getSheetByName(ICON_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ICON_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['關鍵字', '圖示', '比對方式']]);
    sh.getRange(2, 1, DEFAULT_ICON_ROWS.length, 3).setValues(
      DEFAULT_ICON_ROWS.map(r => [r[1], r[2], r[0]])
    );
  }
  const data = sh.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').trim();
    const icon = String(data[i][1] || '').trim();
    const mode = String(data[i][2] || '完整').trim();
    if (!key || !icon) continue;
    rows.push({ key: key, icon: icon, mode: mode });
  }
  return rows;
}

// ── 月份版本號（寫入後更新；前端用來判斷哪個月需要重抓）──────────
function bumpVer(sheetName) {
  PropertiesService.getScriptProperties().setProperty('ver:' + sheetName, String(Date.now()));
}
function getVersions() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const versions = {};
  Object.keys(props).forEach(k => { if (k.indexOf('ver:') === 0) versions[k.slice(4)] = props[k]; });
  return { versions: versions };
}
