import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const CHECK_STATES = ["", "レ", "☓", "▲"];
const HOLIDAY_MARK = "休";

const firebaseConfig = {
  apiKey: "AIzaSyDwthcbGvnkb2Q-K7NjX8SMvVdGZCUUDeA",
  authDomain: "getujinitijyoutenkenhyou.firebaseapp.com",
  projectId: "getujinitijyoutenkenhyou",
  storageBucket: "getujinitijyoutenkenhyou.firebasestorage.app",
  messagingSenderId: "683991833697",
  appId: "1:683991833697:web:a7e0e3b3a85993e7729e20",
  measurementId: "G-TDM7LJ221S"
};

const referenceFirebaseConfig = {
  apiKey: "AIzaSyAlpiGkwyoEW8U8X7HpK4XiqfwW8e_YOdQ",
  authDomain: "getujityretenkenhyou.firebaseapp.com",
  projectId: "getujityretenkenhyou",
  storageBucket: "getujityretenkenhyou.firebasestorage.app",
  messagingSenderId: "818371379903",
  appId: "1:818371379903:web:421a1b390e41a48d2cfc0a",
  measurementId: "G-CPV1MW7ETR"
};

const FIRESTORE_COLLECTION = "monthlyInspectionEntries";
const VEHICLE_SETTINGS_DOC = {
  collection: "monthly_tire_autosave",
  id: "monthly_tire_company_settings_backup_vehicles_slot1"
};
const DRIVER_SETTINGS_DOC = {
  collection: "monthly_tire_autosave",
  id: "monthly_tire_company_settings_backup_drivers_slot1"
};
const CHECK_FIELD_ORDER = [
  "brake_pedal",
  "brake_fluid",
  "air_pressure",
  "exhaust_sound",
  "parking_brake",
  "tire_pressure",
  "tire_damage",
  "tire_tread",
  "wheel_nut",
  "battery_fluid",
  "coolant",
  "fan_belt",
  "engine_oil",
  "engine_start",
  "engine_response",
  "lights_status",
  "washer_fluid",
  "wiper_status",
  "air_tank_water",
  "documents",
  "emergency_tools",
  "report_changes"
];

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
  maintenanceBottomByDay: {},
  holidayDays: [],
  loadedDocId: null,
  vehicleOptions: [],
  driverOptions: []
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const referenceApp = initializeApp(referenceFirebaseConfig, "reference-app");
const referenceDb = getFirestore(referenceApp);
const referenceAuth = getAuth(referenceApp);

function normalizeOptionValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWhitespace(value) {
  return normalizeOptionValue(value).replace(/\s+/g, " ");
}

function normalizeDriverLookupKey(value) {
  return normalizeWhitespace(value)
    .normalize("NFKC")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function sortOptions(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "ja"));
}

function getDriverSortKey(value) {
  const normalizedValue = normalizeOptionValue(value);
  const readingMatch = normalizedValue.match(/（([^）]+)）/);
  if (readingMatch) {
    return readingMatch[1];
  }
  return normalizedValue;
}

function sortDriverOptions(values) {
  return [...values].sort((left, right) => {
    const leftKey = getDriverSortKey(left);
    const rightKey = getDriverSortKey(right);
    return leftKey.localeCompare(rightKey, "ja");
  });
}

function getStringArray(source, fieldName = "values") {
  if (!source || typeof source !== "object" || !Array.isArray(source[fieldName])) {
    return [];
  }
  return source[fieldName].map((value) => normalizeOptionValue(value)).filter(Boolean);
}

function buildReferenceDocPath(referenceDoc) {
  return `${referenceDoc.collection}/${referenceDoc.id}`;
}

async function ensureReferenceAuth() {
  if (referenceAuth.currentUser) {
    return referenceAuth.currentUser;
  }
  const credential = await signInAnonymously(referenceAuth);
  return credential.user;
}

function setSelectOptions(selectEl, options, placeholder, selectedValue = "") {
  const normalizedSelectedValue = normalizeOptionValue(selectedValue);
  const uniqueOptions = [...new Set(options.map((option) => normalizeOptionValue(option)).filter(Boolean))];

  if (normalizedSelectedValue && !uniqueOptions.includes(normalizedSelectedValue)) {
    uniqueOptions.unshift(normalizedSelectedValue);
  }

  selectEl.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  selectEl.append(placeholderOption);

  uniqueOptions.forEach((optionValue) => {
    const optionEl = document.createElement("option");
    optionEl.value = optionValue;
    optionEl.textContent = optionValue;
    selectEl.append(optionEl);
  });

  selectEl.value = normalizedSelectedValue;
}

async function loadReferenceOptions() {
  const selectedVehicle = normalizeOptionValue(vehicleEl.value);
  const selectedDriver = normalizeOptionValue(driverEl.value);

  vehicleEl.disabled = true;
  driverEl.disabled = true;

  try {
    await ensureReferenceAuth();

    const [vehicleSnapshot, driverSnapshot] = await Promise.all([
      getDoc(doc(referenceDb, VEHICLE_SETTINGS_DOC.collection, VEHICLE_SETTINGS_DOC.id)),
      getDoc(doc(referenceDb, DRIVER_SETTINGS_DOC.collection, DRIVER_SETTINGS_DOC.id))
    ]);

    const vehicleDocExists = vehicleSnapshot.exists();
    const driverDocExists = driverSnapshot.exists();
    const vehicles = vehicleDocExists ? getStringArray(vehicleSnapshot.data()) : [];
    const drivers = driverDocExists ? getStringArray(driverSnapshot.data()) : [];

    state.vehicleOptions = sortOptions(vehicles);
    state.driverOptions = sortDriverOptions(drivers);

    setSelectOptions(vehicleEl, state.vehicleOptions, "車番を選択", selectedVehicle);
    setSelectOptions(driverEl, state.driverOptions, "運転者を選択", selectedDriver);

    vehicleEl.disabled = false;
    driverEl.disabled = false;
    syncHeaderInfo();

    if (!vehicleDocExists || !driverDocExists) {
      setStatus(
        `候補設定ドキュメント未検出: project=${referenceFirebaseConfig.projectId} vehicle=${buildReferenceDocPath(VEHICLE_SETTINGS_DOC)} exists=${vehicleDocExists} driver=${buildReferenceDocPath(DRIVER_SETTINGS_DOC)} exists=${driverDocExists}`,
        true
      );
      return;
    }

    if (!state.vehicleOptions.length && !state.driverOptions.length) {
      setStatus(
        `候補設定は取得できましたが values が空です: vehicleCount=${vehicles.length} driverCount=${drivers.length}`,
        true
      );
      return;
    }

    setStatus(
      `候補一覧を読み込みました: 車番 ${state.vehicleOptions.length}件 / 運転者 ${state.driverOptions.length}件`
    );
  } catch (error) {
    setSelectOptions(vehicleEl, [], "車番を選択");
    setSelectOptions(driverEl, [], "運転者を選択");
    vehicleEl.disabled = false;
    driverEl.disabled = false;
    setStatus(`候補一覧の取得に失敗しました: ${error.message}`, true);
  }
}

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

function getInspectionItemCount() {
  return GROUPS.reduce((total, group) => total + group.contents.length, 0);
}

function isHolidayDay(day) {
  return state.holidayDays.includes(day);
}

function setHolidayHeaderState(day, isHoliday) {
  document.querySelectorAll(`[data-day="${day}"]`).forEach((cell) => {
    cell.classList.toggle("is-holiday", isHoliday);
  });
}

function applyHolidayChecks(day) {
  for (let itemIndex = 0; itemIndex < getInspectionItemCount(); itemIndex += 1) {
    const key = checkKey(itemIndex, day);
    state.checks[key] = HOLIDAY_MARK;
    const cell = bodyEl.querySelector(`[data-check-key="${key}"]`);
    if (cell) {
      cell.textContent = HOLIDAY_MARK;
    }
  }
}

function clearHolidayChecks(day) {
  for (let itemIndex = 0; itemIndex < getInspectionItemCount(); itemIndex += 1) {
    const key = checkKey(itemIndex, day);
    delete state.checks[key];
    const cell = bodyEl.querySelector(`[data-check-key="${key}"]`);
    if (cell) {
      cell.textContent = "";
    }
  }
}

function syncHolidayChecks() {
  const daysInMonth = getDaysInSelectedMonth();
  state.holidayDays = [...new Set(state.holidayDays.map((day) => Number(day)))]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= daysInMonth)
    .sort((left, right) => left - right);

  state.holidayDays.forEach((day) => applyHolidayChecks(day));
}

function markHolidayForDay(day) {
  if (isHolidayDay(day)) {
    if (!window.confirm(`${day}日の休日設定を解除しますか？`)) {
      return;
    }

    state.holidayDays = state.holidayDays.filter((holidayDay) => holidayDay !== day);
    clearHolidayChecks(day);
    setHolidayHeaderState(day, false);
    setStatus(`${day}日の休日設定を解除しました。保存すると反映されます。`);
    return;
  }

  if (!window.confirm(`${day}日を休日にしますか？`)) {
    return;
  }

  state.holidayDays = [...state.holidayDays, day].sort((left, right) => left - right);
  applyHolidayChecks(day);
  setHolidayHeaderState(day, true);
  setStatus(`${day}日を休日に設定しました。保存すると反映されます。`);
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
  const dayKey = String(day);
  if (value) {
    state.maintenanceBottomByDay[dayKey] = value;
  } else {
    delete state.maintenanceBottomByDay[dayKey];
  }
  const cell = maintenanceFooterRowEl.querySelector(`[data-bottom-day="${day}"]`);
  if (cell) {
    cell.innerHTML = createHanko(value, "small");
  }
}

function toggleStamp(target, value) {
  const nextValue = state[target] === value ? "" : value;
  setStamp(target, nextValue);
}

function toggleBottomStampByDay(day, value) {
  const dayKey = String(day);
  const nextValue = state.maintenanceBottomByDay[dayKey] === value ? "" : value;
  setBottomStampByDay(day, nextValue);
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
      toggleBottomStampByDay(day, "若本");
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
    dateTh.className = "day holiday-trigger";
    dateTh.dataset.day = String(day);
    dateTh.textContent = String(day);
    dateTh.title = `${day}日を休日に設定`;
    dateTh.addEventListener("click", () => {
      markHolidayForDay(day);
    });
    datesRowEl.append(dateTh);

    const dowTh = document.createElement("th");
    dowTh.className = "day holiday-trigger";
    dowTh.dataset.day = String(day);
    dowTh.textContent = toWeekdayLabel(year, month, day);
    dowTh.title = `${day}日を休日に設定`;
    dowTh.addEventListener("click", () => {
      markHolidayForDay(day);
    });
    if (isHolidayDay(day)) {
      dateTh.classList.add("is-holiday");
      dowTh.classList.add("is-holiday");
    }
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
        td.dataset.checkKey = key;
        td.textContent = state.checks[key] || (isHolidayDay(day) ? HOLIDAY_MARK : "");
        td.addEventListener("click", () => {
          if (isHolidayDay(day)) {
            return;
          }
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
  const [, month] = monthEl.value.split("-");
  monthTextEl.textContent = month ? String(Number(month)) : "-";
  vehicleTextEl.textContent = vehicleEl.value.trim() || "-";
  driverTextEl.textContent = driverEl.value.trim() || "-";
}

function clearLoadedDocId() {
  state.loadedDocId = null;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#1e2a35";
}

function buildRecordKey(month, vehicle, driver) {
  return `${month}__${vehicle}__${driver}`;
}

function resetRecordState() {
  state.checks = {};
  state.operationManager = "";
  state.maintenanceManager = "";
  state.maintenanceBottomByDay = {};
  state.holidayDays = [];
  state.loadedDocId = null;
}

function getSaveLocationMessage(month, vehicle, driver) {
  return `保存先: Firestore / ${FIRESTORE_COLLECTION}\n一致キー: ${buildRecordKey(month, vehicle, driver)}`;
}

function toFirestoreChecksByDay(checks) {
  const checksByDay = {};
  Object.entries(checks).forEach(([cellKey, value]) => {
    if (!value) return;
    const [rowIndexText, dayText] = cellKey.split("_");
    const rowIndex = Number(rowIndexText);
    const day = String(Number(dayText));
    const fieldKey = CHECK_FIELD_ORDER[rowIndex];
    if (!fieldKey || !day) return;
    if (!checksByDay[day]) {
      checksByDay[day] = {};
    }
    checksByDay[day][fieldKey] = value;
  });
  return checksByDay;
}

function fromFirestoreChecksByDay(checksByDay = {}) {
  const checks = {};
  Object.entries(checksByDay).forEach(([dayText, valuesByField]) => {
    const day = Number(dayText);
    if (!day || typeof valuesByField !== "object" || valuesByField === null) return;
    CHECK_FIELD_ORDER.forEach((fieldKey, rowIndex) => {
      const value = valuesByField[fieldKey];
      if (typeof value === "string" && value) {
        checks[checkKey(rowIndex, day)] = value;
      }
    });
  });
  return checks;
}

async function findRecord(month, vehicle, driver) {
  const recordsRef = collection(db, FIRESTORE_COLLECTION);
  const recordQuery = query(
    recordsRef,
    where("month", "==", month),
    where("vehicle", "==", vehicle),
    where("driver", "==", driver),
    limit(1)
  );
  const snapshot = await getDocs(recordQuery);
  if (snapshot.empty) {
    const fallbackQuery = query(
      recordsRef,
      where("month", "==", month),
      where("vehicle", "==", vehicle),
      limit(50)
    );
    const fallbackSnapshot = await getDocs(fallbackQuery);
    if (fallbackSnapshot.empty) {
      return null;
    }

    const targetDriverKey = normalizeDriverLookupKey(driver);
    const matchedDoc = fallbackSnapshot.docs.find((recordDoc) => {
      const recordDriver = recordDoc.data().driver || "";
      return normalizeDriverLookupKey(recordDriver) === targetDriverKey;
    });

    if (!matchedDoc) {
      return null;
    }

    return {
      id: matchedDoc.id,
      data: matchedDoc.data()
    };
  }
  const recordDoc = snapshot.docs[0];
  return {
    id: recordDoc.id,
    data: recordDoc.data()
  };
}

async function loadRecord() {
  const month = monthEl.value;
  const vehicle = vehicleEl.value.trim();
  const driver = driverEl.value.trim();
  if (!vehicle || !driver) {
    setStatus("読込前に車番・運転者を入力してください", true);
    return;
  }

  const record = await findRecord(month, vehicle, driver);
  if (!record) {
    resetRecordState();
    setStamp("operationManager", "");
    setStamp("maintenanceManager", "");
    renderDays();
    renderBody();
    renderBottomStampRow();
    setStatus("Firestore に一致データがないため新規入力モードです。");
    return;
  }

  state.loadedDocId = record.id;
  state.checks = fromFirestoreChecksByDay(record.data.checksByDay);
  setStamp("operationManager", record.data.operationManager || "");
  setStamp("maintenanceManager", record.data.maintenanceManager || "");
  state.maintenanceBottomByDay = record.data.maintenanceBottomByDay || {};
  state.holidayDays = Array.isArray(record.data.holidayDays) ? record.data.holidayDays : [];
  syncHolidayChecks();
  renderDays();
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

  const existingRecord = await findRecord(month, vehicle, driver);
  const docId = existingRecord?.id || state.loadedDocId || buildRecordKey(month, vehicle, driver);
  syncHolidayChecks();
  const payload = {
    month,
    vehicle,
    driver,
    checksByDay: toFirestoreChecksByDay(state.checks),
    operationManager: state.operationManager,
    maintenanceManager: state.maintenanceManager,
    maintenanceBottomByDay: state.maintenanceBottomByDay,
    holidayDays: state.holidayDays,
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, FIRESTORE_COLLECTION, docId), payload, { merge: true });
  state.loadedDocId = docId;
  setStatus("保存完了");
}

monthEl.addEventListener("change", () => {
  clearLoadedDocId();
  syncHeaderInfo();
  renderDays();
  renderBody();
  renderBottomStampRow();
  syncToolbarWidth();
});
vehicleEl.addEventListener("change", () => {
  clearLoadedDocId();
  syncHeaderInfo();
});
driverEl.addEventListener("change", () => {
  clearLoadedDocId();
  syncHeaderInfo();
});
window.addEventListener("resize", syncToolbarWidth);

document.getElementById("loadBtn").addEventListener("click", () => {
  loadRecord().catch((err) => setStatus(`読込失敗: ${err.message}`, true));
});

document.getElementById("saveBtn").addEventListener("click", () => {
  saveRecord().catch((err) => setStatus(`保存失敗: ${err.message}`, true));
});

document.getElementById("operationManagerSlot").addEventListener("click", () => toggleStamp("operationManager", "岸田"));
document.getElementById("maintenanceManagerSlot").addEventListener("click", () => toggleStamp("maintenanceManager", "若本"));

syncHeaderInfo();
renderDays();
renderBody();
renderBottomStampRow();
syncToolbarWidth();
loadReferenceOptions().catch((err) => setStatus(`候補一覧の取得に失敗しました: ${err.message}`, true));
