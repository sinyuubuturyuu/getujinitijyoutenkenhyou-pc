const CHECK_STATES = ["", "レ", "☓", "▲"];

const ITEMS = [
  { category: "1. ブレーキ", content: "踏みしろ、きき" },
  { category: "1. ブレーキ", content: "液量" },
  { category: "1. ブレーキ", content: "空気圧力の上り具合" },
  { category: "1. ブレーキ", content: "バルブからの排気音" },
  { category: "1. ブレーキ", content: "レバーの引きしろ" },
  { category: "2. タイヤ", content: "空気圧" },
  { category: "2. タイヤ", content: "亀裂・損傷・異常磨耗" },
  { category: "2. タイヤ", content: "※溝の深さ" },
  { category: "2. タイヤ", content: "ホイールナット・ボルト・スペア" },
  { category: "3. バッテリー", content: "※液量" },
  { category: "4. エンジン", content: "※冷却水の量" },
  { category: "4. エンジン", content: "※ファンベルトの張り具合・損傷" },
  { category: "4. エンジン", content: "※エンジンオイルの量" },
  { category: "4. エンジン", content: "※かかり具合、異音" },
  { category: "4. エンジン", content: "※低速、加速の状態" },
  { category: "5. 燈火装置", content: "点灯・点滅具合、汚れ及び損傷" },
  { category: "6. ワイパー", content: "※液量、噴射状態" },
  { category: "6. ワイパー", content: "※ワイパー払拭状態" },
  { category: "7. エアタンク", content: "エアタンクに凝水がない" },
  { category: "8. その他", content: "検査証・保険証・記録簿の備付" },
  { category: "8. その他", content: "非常用信号具・工具類・停止表示板" },
  { category: "8. その他", content: "報告事項・変更事項" }
];

const monthEl = document.getElementById("month");
const vehicleEl = document.getElementById("vehicle");
const driverEl = document.getElementById("driver");
const monthTextEl = document.getElementById("monthText");
const vehicleTextEl = document.getElementById("vehicleText");
const driverTextEl = document.getElementById("driverText");
const statusEl = document.getElementById("status");
const daysRowEl = document.getElementById("daysRow");
const bodyEl = document.getElementById("inspectionBody");
const maintenanceFooterRowEl = document.getElementById("maintenanceFooterRow");

const state = {
  checks: {},
  operationManager: "",
  maintenanceManager: "",
  maintenanceBottomByDay: {}
};

function checkKey(itemIndex, day) {
  return `${itemIndex}_${day}`;
}

function rotateCheck(value) {
  const index = CHECK_STATES.indexOf(value);
  return CHECK_STATES[(index + 1) % CHECK_STATES.length];
}

function createHanko(name) {
  if (!name) return "";
  return `<div class="hanko"><span>${name}</span></div>`;
}

function setStamp(target, value) {
  state[target] = value;
  const idMap = {
    operationManager: "operationManagerSlot",
    maintenanceManager: "maintenanceManagerSlot"
  };
  const slot = document.getElementById(idMap[target]);
  slot.innerHTML = createHanko(value);
}

function setBottomStampByDay(day, value) {
  state.maintenanceBottomByDay[String(day)] = value;
  const cell = maintenanceFooterRowEl.querySelector(`[data-bottom-day="${day}"]`);
  if (cell) {
    cell.innerHTML = createHanko(value);
  }
}

function renderBottomStampRow() {
  maintenanceFooterRowEl.querySelectorAll(".bottom-day-cell").forEach((el) => el.remove());
  for (let day = 1; day <= 31; day += 1) {
    const cell = document.createElement("td");
    cell.className = "bottom-day-cell";
    cell.dataset.bottomDay = String(day);
    cell.innerHTML = createHanko(state.maintenanceBottomByDay[String(day)] || "");
    cell.addEventListener("click", () => {
      setBottomStampByDay(day, "若本");
    });
    maintenanceFooterRowEl.append(cell);
  }
}

function renderDays() {
  daysRowEl.innerHTML = '<th class="dow-label">曜</th>';
  for (let day = 1; day <= 31; day += 1) {
    const th = document.createElement("th");
    th.className = "day";
    th.textContent = String(day);
    daysRowEl.append(th);
  }
}

function renderBody() {
  bodyEl.innerHTML = "";
  for (let i = 0; i < ITEMS.length; i += 1) {
    const tr = document.createElement("tr");

    const category = document.createElement("td");
    category.className = "category";
    category.colSpan = 4;
    category.textContent = ITEMS[i].category;
    tr.append(category);

    const content = document.createElement("td");
    content.className = "content";
    content.colSpan = 4;
    content.textContent = ITEMS[i].content;
    tr.append(content);

    const dow = document.createElement("td");
    dow.className = "day";
    dow.textContent = "";
    tr.append(dow);

    for (let day = 1; day <= 31; day += 1) {
      const key = checkKey(i, day);
      const td = document.createElement("td");
      td.className = "check-cell";
      td.textContent = state.checks[key] || "";
      td.addEventListener("click", () => {
        const next = rotateCheck(state.checks[key] || "");
        state.checks[key] = next;
        td.textContent = next;
        setBottomStampByDay(day, "若本");
      });
      tr.append(td);
    }

    bodyEl.append(tr);
  }
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

async function loadRecord() {
  const month = monthEl.value;
  const vehicle = vehicleEl.value.trim();
  const driver = driverEl.value.trim();
  if (!vehicle || !driver) {
    setStatus("読込前に車番・運転者を入力してください", true);
    return;
  }

  const res = await fetch(`/api/record?month=${encodeURIComponent(month)}&vehicle=${encodeURIComponent(vehicle)}&driver=${encodeURIComponent(driver)}`);
  const data = await res.json();

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

monthEl.addEventListener("change", syncHeaderInfo);
vehicleEl.addEventListener("input", syncHeaderInfo);
driverEl.addEventListener("input", syncHeaderInfo);

document.getElementById("loadBtn").addEventListener("click", () => {
  loadRecord().catch((err) => setStatus(`読込失敗: ${err.message}`, true));
});

document.getElementById("saveBtn").addEventListener("click", () => {
  saveRecord().catch((err) => setStatus(`保存失敗: ${err.message}`, true));
});

document.querySelectorAll("[data-stamp-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.stampTarget;
    const value = button.dataset.stampValue;
    setStamp(target, value);
  });
});

document.getElementById("operationManagerSlot").addEventListener("click", () => setStamp("operationManager", "岸田"));
document.getElementById("maintenanceManagerSlot").addEventListener("click", () => setStamp("maintenanceManager", "若本"));

renderDays();
renderBody();
renderBottomStampRow();
syncHeaderInfo();
setStatus("初期化完了");
