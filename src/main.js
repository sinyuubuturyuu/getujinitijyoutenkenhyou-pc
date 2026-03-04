const CHECK_STATES = ["", "レ", "☓", "▲"];

const GROUPS = [
  {
    category: "1. ブレーキ",
    contents: ["踏みしろ、きき", "液量", "空気圧力の上り具合", "バルブからの排気音", "レバーの引きしろ"]
  },
  {
    category: "2. タイヤ",
    contents: ["空気圧", "亀裂・損傷・異常磨耗", "※溝の深さ", "ホイールナット・ボルト・スペア"]
  },
  { category: "3. バッテリー", contents: ["※液量"] },
  {
    category: "4. エンジン",
    contents: ["※冷却水の量", "※ファンベルトの張り具合・損傷", "※エンジンオイルの量", "※かかり具合、異音", "※低速、加速の状態"]
  },
  { category: "5. 燈火装置", contents: ["点灯・点滅具合、汚れ及び損傷"] },
  { category: "6. ワイパー", contents: ["※液量、噴射状態", "※ワイパー払拭状態"] },
  { category: "7. エアタンク", contents: ["エアタンクに凝水がない"] },
  {
    category: "8. その他",
    contents: ["検査証・保険証・記録簿の備付", "非常用信号具・工具類・停止表示板", "報告事項・変更事項"]
  }
];

const monthEl = document.getElementById("month");
const vehicleEl = document.getElementById("vehicle");
const driverEl = document.getElementById("driver");
const monthTextEl = document.getElementById("monthText");
const vehicleTextEl = document.getElementById("vehicleText");
const driverTextEl = document.getElementById("driverText");
const statusEl = document.getElementById("status");
const toolbarEl = document.getElementById("toolbar");
const inspectionTableEl = document.getElementById("inspectionTable");
const datesRowEl = document.getElementById("datesRow");
const daysRowEl = document.getElementById("daysRow");
const bodyEl = document.getElementById("inspectionBody");
const maintenanceFooterRowEl = document.getElementById("maintenanceFooterRow");
const titleHeadEl = document.getElementById("titleHead");
const operationHeadEl = document.getElementById("operationHead");
const maintenanceHeadEl = document.getElementById("maintenanceHead");
const driverHeadEl = document.getElementById("driverHead");

const state = {
  checks: {},
  operationManager: "",
  maintenanceManager: "",
  maintenanceBottomByDay: {}
};
const STORAGE_NAMESPACE = "getujitenkenhyou_records_v1";
const isStaticMode = window.location.protocol.startsWith("http") && !window.location.hostname.includes("localhost");

function getSelectedYearMonth() {
  const [yearText, monthText] = monthEl.value.split("-");
  const year = Number(yearText) || 2026;
  const month = Number(monthText) || 1;
  return { year, month };
}

function getDaysInSelectedMonth() {
  const { year, month } = getSelectedYearMonth();
  return new Date(year, month, 0).getDate();
}

function checkKey(itemIndex, day) {
  return `${itemIndex}_${day}`;
}

function rotateCheck(value) {
  const index = CHECK_STATES.indexOf(value);
  return CHECK_STATES[(index + 1) % CHECK_STATES.length];
}

function createHanko(name, size = "small") {
  if (!name) return "";
  return `<div class="hanko hanko-${size}"><span>${name}</span></div>`;
}

function setStamp(target, value) {
  state[target] = value;
  const idMap = {
    operationManager: "operationManagerSlot",
    maintenanceManager: "maintenanceManagerSlot"
  };
  const slot = document.getElementById(idMap[target]);
  slot.innerHTML = createHanko(value, "large");
}

function setBottomStampByDay(day, value) {
  state.maintenanceBottomByDay[String(day)] = value;
  const cell = maintenanceFooterRowEl.querySelector(`[data-bottom-day="${day}"]`);
  if (cell) {
    cell.innerHTML = createHanko(value, "small");
  }
}

function renderBottomStampRow() {
  maintenanceFooterRowEl.querySelectorAll(".bottom-day-cell").forEach((el) => el.remove());
  const daysInMonth = getDaysInSelectedMonth();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement("td");
    cell.className = "bottom-day-cell";
    cell.dataset.bottomDay = String(day);
    cell.innerHTML = createHanko(state.maintenanceBottomByDay[String(day)] || "", "small");
    cell.addEventListener("click", () => {
      setBottomStampByDay(day, "若本");
    });
    maintenanceFooterRowEl.append(cell);
  }
}

function toWeekdayLabel(year, month, day) {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels[dayOfWeek];
}

function renderDays() {
  datesRowEl.innerHTML = '<th colspan="4" rowspan="2">点検個所</th><th colspan="4" rowspan="2" class="content-head"><div class="content-head-inner"><span class="content-title">点検内容</span><span class="day-mark-stack"><span class="day-mark-cell">日</span><span class="day-mark-cell">曜</span></span></div></th>';
  daysRowEl.innerHTML = "";

  const { year, month } = getSelectedYearMonth();
  const daysInMonth = getDaysInSelectedMonth();
  const managerSpan = 4;
  const titleSpan = Math.max(1, daysInMonth - managerSpan * 2);
  titleHeadEl.colSpan = titleSpan;
  driverHeadEl.colSpan = titleSpan;
  operationHeadEl.colSpan = managerSpan;
  maintenanceHeadEl.colSpan = managerSpan;
  document.getElementById("operationManagerSlot").colSpan = managerSpan;
  document.getElementById("maintenanceManagerSlot").colSpan = managerSpan;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateTh = document.createElement("th");
    dateTh.className = "day";
    dateTh.textContent = String(day);
    datesRowEl.append(dateTh);

    const dowTh = document.createElement("th");
    dowTh.className = "day";
    dowTh.textContent = toWeekdayLabel(year, month, day);
    daysRowEl.append(dowTh);
  }
}

function syncToolbarWidth() {
  const tableWidth = inspectionTableEl.offsetWidth;
  if (tableWidth > 0) {
    toolbarEl.style.width = `${tableWidth}px`;
  }
}

function renderBody() {
  bodyEl.innerHTML = "";
  const daysInMonth = getDaysInSelectedMonth();
  let rowIndex = 0;
  GROUPS.forEach((group) => {
    group.contents.forEach((line, groupLineIndex) => {
      const tr = document.createElement("tr");

      if (groupLineIndex === 0) {
        const category = document.createElement("td");
        category.className = "category";
        category.colSpan = 4;
        category.rowSpan = group.contents.length;
        category.textContent = group.category;
        tr.append(category);
      }

      const content = document.createElement("td");
      content.className = "content";
      content.colSpan = 4;
      content.textContent = line;
      tr.append(content);

      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = checkKey(rowIndex, day);
        const td = document.createElement("td");
        td.className = "check-cell";
        td.textContent = state.checks[key] || "";
        td.addEventListener("click", () => {
          const next = rotateCheck(state.checks[key] || "");
          state.checks[key] = next;
          td.textContent = next;
        });
        tr.append(td);
      }

      bodyEl.append(tr);
      rowIndex += 1;
    });
  });
}

function syncHeaderInfo() {
  const [year, month] = monthEl.value.split("-");
  monthTextEl.textContent = month ? String(Number(month)) : "-";
  vehicleTextEl.textContent = vehicleEl.value.trim() || "-";
  driverTextEl.textContent = driverEl.value.trim() || "-";
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#1e2a35";
}

function buildRecordKey(month, vehicle, driver) {
  return `${month}__${vehicle}__${driver}`;
}

function getSaveLocationMessage(month, vehicle, driver) {
  const key = buildRecordKey(month, vehicle, driver);
  if (isStaticMode) {
    return `保存先: このブラウザ内（localStorage）\nキー: ${key}`;
  }
  return `保存先: サーバー側 data/records.json\nキー: ${key}`;
}

function loadLocalStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_NAMESPACE) || "{\"records\":{}}");
  } catch {
    return { records: {} };
  }
}

function saveLocalStore(store) {
  localStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(store));
}

async function loadRecord() {
  const month = monthEl.value;
  const vehicle = vehicleEl.value.trim();
  const driver = driverEl.value.trim();
  if (!vehicle || !driver) {
    setStatus("読込前に車番・運転者を入力してください", true);
    return;
  }

  let data;
  if (isStaticMode) {
    const store = loadLocalStore();
    const key = buildRecordKey(month, vehicle, driver);
    data = { key, record: store.records[key] || null };
  } else {
    const res = await fetch(`/api/record?month=${encodeURIComponent(month)}&vehicle=${encodeURIComponent(vehicle)}&driver=${encodeURIComponent(driver)}`);
    data = await res.json();
  }

  if (!data.record) {
    state.checks = {};
    setStamp("operationManager", "");
    setStamp("maintenanceManager", "");
    state.maintenanceBottomByDay = {};
    renderBody();
    renderBottomStampRow();
    setStatus("データがないため新規入力モードです。");
    return;
  }

  state.checks = data.record.checks || {};
  setStamp("operationManager", data.record.operationManager || "");
  setStamp("maintenanceManager", data.record.maintenanceManager || "");
  state.maintenanceBottomByDay = data.record.maintenanceBottomByDay || {};
  renderBody();
  renderBottomStampRow();
  setStatus("読込完了");
}

async function saveRecord() {
  const month = monthEl.value;
  const vehicle = vehicleEl.value.trim();
  const driver = driverEl.value.trim();
  if (!vehicle || !driver) {
    setStatus("保存前に車番・運転者を入力してください", true);
    return;
  }
  const saveLocationMessage = getSaveLocationMessage(month, vehicle, driver);
  const accepted = window.confirm(`保存先を確認してください。\n\n${saveLocationMessage}\n\nこの場所に保存しますか？`);
  if (!accepted) {
    setStatus("保存をキャンセルしました");
    return;
  }

  const payload = {
    month,
    vehicle,
    driver,
    record: {
      checks: state.checks,
      operationManager: state.operationManager,
      maintenanceManager: state.maintenanceManager,
      maintenanceBottomByDay: state.maintenanceBottomByDay
    }
  };

  if (isStaticMode) {
    const store = loadLocalStore();
    const key = buildRecordKey(month, vehicle, driver);
    store.records[key] = payload.record;
    saveLocalStore(store);
    setStatus("保存完了（Pages: ブラウザ保存）");
    return;
  }

  const res = await fetch("/api/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    setStatus(`保存失敗: ${data.error || "unknown"}`, true);
    return;
  }
  setStatus("保存完了");
}

monthEl.addEventListener("change", () => {
  syncHeaderInfo();
  renderDays();
  renderBody();
  renderBottomStampRow();
  syncToolbarWidth();
});
vehicleEl.addEventListener("input", syncHeaderInfo);
driverEl.addEventListener("input", syncHeaderInfo);
window.addEventListener("resize", syncToolbarWidth);

document.getElementById("loadBtn").addEventListener("click", () => {
  loadRecord().catch((err) => setStatus(`読込失敗: ${err.message}`, true));
});

document.getElementById("saveBtn").addEventListener("click", () => {
  saveRecord().catch((err) => setStatus(`保存失敗: ${err.message}`, true));
});

document.getElementById("operationManagerSlot").addEventListener("click", () => setStamp("operationManager", "岸田"));
document.getElementById("maintenanceManagerSlot").addEventListener("click", () => setStamp("maintenanceManager", "若本"));

syncHeaderInfo();
renderDays();
renderBody();
renderBottomStampRow();
syncToolbarWidth();
statusEl.textContent = "";
