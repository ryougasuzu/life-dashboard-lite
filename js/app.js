const cfg = window.LIFE_DASHBOARD_CONFIG || {};
const configured =
  typeof cfg.supabaseUrl === "string" &&
  typeof cfg.supabasePublishableKey === "string" &&
  !cfg.supabaseUrl.includes("YOUR_PROJECT_REF") &&
  !cfg.supabasePublishableKey.includes("REPLACE_ME");

const setupWarning = document.getElementById("setupWarning");
const authPanel = document.getElementById("authPanel");
const appPanel = document.getElementById("appPanel");
const signOutBtn = document.getElementById("signOutBtn");
const accountLabel = document.getElementById("accountLabel");
const authMessage = document.getElementById("authMessage");
const toast = document.getElementById("toast");

let db = null;
let session = null;
let profile = { timezone: cfg.defaultTimezone || "Asia/Tokyo" };
let nutrientDefs = [];
let nutrientTargets = {};
let targets = {};
let selectedDay = null;
let monthCursor = new Date();
let toastTimer = null;

function el(id) {
  return document.getElementById(id);
}

function showMessage(id, text, isError) {
  const node = el(id);
  node.textContent = text || "";
  node.style.color = isError ? "#a13c3c" : "";
}

function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.hidden = false;
  toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const p = Math.pow(10, digits == null ? 1 : digits);
  return Math.round(Number(value) * p) / p;
}

function dateInTimezone(date, timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch (_) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }
}

function toDatetimeLocal(date) {
  const d = date || new Date();
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function dayLabel(day) {
  if (!day) return "—";
  const parts = day.split("-");
  return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
}

function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function metricCard(label, value, unit, target, knownCount, itemCount) {
  const known = value != null;
  const display = known ? escapeHtml(round(value, 1)) : "—";
  let sub = "";
  if (knownCount != null && itemCount != null && Number(knownCount) < Number(itemCount)) {
    sub = "一部未算出 " + knownCount + "/" + itemCount + "件";
  } else if (knownCount != null && itemCount != null && Number(itemCount) > 0) {
    sub = "算出済み " + knownCount + "/" + itemCount + "件";
  }
  let bar = "";
  if (known && target != null && Number(target) > 0) {
    const pct = Math.max(0, Math.min(100, Number(value) / Number(target) * 100));
    bar = '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    sub = (sub ? sub + " · " : "") + "目標 " + round(target, 1) + " " + unit;
  }
  return '<div class="metric">' +
    '<div class="metricLabel">' + escapeHtml(label) + '</div>' +
    '<div class="metricValue">' + display + ' <small>' + escapeHtml(unit) + '</small></div>' +
    '<div class="metricSub">' + escapeHtml(sub) + '</div>' +
    bar +
    '</div>';
}

function setAppVisible(isSignedIn) {
  authPanel.hidden = isSignedIn;
  appPanel.hidden = !isSignedIn;
  signOutBtn.hidden = !isSignedIn;
  accountLabel.textContent = isSignedIn && session && session.user ? session.user.email : "";
}

function setDefaultFormTimes() {
  const now = toDatetimeLocal(new Date());
  ["mealEatenAt", "strengthStartedAt", "cardioStartedAt"].forEach(function (id) {
    if (!el(id).value) el(id).value = now;
  });
}

async function ensureProfile() {
  const result = await db.from("life_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    const created = await db.from("life_profiles").insert({
      user_id: session.user.id,
      timezone: cfg.defaultTimezone || "Asia/Tokyo"
    }).select("*").single();
    if (created.error) throw created.error;
    profile = created.data;
  } else {
    profile = result.data;
  }
}

async function loadNutrientDefinitions() {
  const result = await db.from("life_nutrient_definitions").select("*").order("sort_order");
  if (result.error) throw result.error;
  nutrientDefs = result.data || [];
  renderMealMicroFields();
  renderNutrientTargetFields();
}

function renderMealMicroFields() {
  const host = el("mealMicronutrientFields");
  host.innerHTML = "";
  nutrientDefs.forEach(function (n) {
    const wrap = document.createElement("div");
    wrap.className = "microField";
    wrap.innerHTML =
      '<label>' + escapeHtml(n.name_ja) +
      '<input type="number" min="0" step="any" data-meal-nutrient="' + escapeHtml(n.code) + '"></label>' +
      '<small>' + escapeHtml(n.unit) + '</small>';
    host.appendChild(wrap);
  });
}

function renderNutrientTargetFields() {
  const host = el("nutrientTargetFields");
  host.innerHTML = "";
  nutrientDefs.forEach(function (n) {
    const current = nutrientTargets[n.code] && nutrientTargets[n.code].target_ideal != null
      ? nutrientTargets[n.code].target_ideal
      : "";
    const wrap = document.createElement("div");
    wrap.className = "microField";
    wrap.innerHTML =
      '<label>' + escapeHtml(n.name_ja) +
      '<input type="number" min="0" step="any" data-target-nutrient="' + escapeHtml(n.code) + '" value="' + escapeHtml(current) + '"></label>' +
      '<small>' + escapeHtml(n.unit) + '</small>';
    host.appendChild(wrap);
  });
}

async function loadSettings() {
  const a = await db.from("life_targets").select("*").eq("user_id", session.user.id).maybeSingle();
  if (a.error) throw a.error;
  targets = a.data || {};

  const b = await db.from("life_nutrient_targets").select("*").eq("user_id", session.user.id);
  if (b.error) throw b.error;
  nutrientTargets = {};
  (b.data || []).forEach(function (row) { nutrientTargets[row.nutrient_code] = row; });

  el("timezone").value = profile.timezone || cfg.defaultTimezone || "Asia/Tokyo";
  el("targetCalories").value = targets.calories_kcal == null ? "" : targets.calories_kcal;
  el("targetProtein").value = targets.protein_g == null ? "" : targets.protein_g;
  el("targetFat").value = targets.fat_g == null ? "" : targets.fat_g;
  el("targetCarbs").value = targets.carbs_g == null ? "" : targets.carbs_g;
  renderNutrientTargetFields();
}

async function handleSession(nextSession) {
  session = nextSession;
  setAppVisible(!!session);
  if (!session) return;

  try {
    await ensureProfile();
    selectedDay = selectedDay || dateInTimezone(new Date(), profile.timezone);
    monthCursor = new Date(selectedDay + "T00:00:00");
    el("nutritionDay").value = selectedDay;
    setDefaultFormTimes();
    await loadNutrientDefinitions();
    await loadSettings();
    await Promise.all([loadMonth(), loadSelectedDay(), loadNutrition()]);
  } catch (error) {
    console.error(error);
    showToast("初期化に失敗しました: " + error.message);
  }
}

async function loadMonth() {
  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();
  const first = y + "-" + String(m + 1).padStart(2, "0") + "-01";
  const lastDate = new Date(y, m + 1, 0);
  const last = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(lastDate.getDate()).padStart(2, "0");

  const result = await db.from("life_daily_summary")
    .select("*")
    .gte("day", first)
    .lte("day", last)
    .order("day");
  if (result.error) throw result.error;

  const byDay = {};
  (result.data || []).forEach(function (row) { byDay[row.day] = row; });
  renderCalendar(y, m, byDay);
}

function renderCalendar(year, month, byDay) {
  el("monthTitle").textContent = year + "年" + (month + 1) + "月";
  const host = el("calendarGrid");
  host.innerHTML = "";

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) {
    const blank = document.createElement("div");
    blank.className = "dayBlank";
    host.appendChild(blank);
  }

  const today = dateInTimezone(new Date(), profile.timezone);
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const day = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const row = byDay[day] || {};
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "dayCell" + (day === today ? " today" : "") + (day === selectedDay ? " selected" : "");
    const kcal = row.calories_kcal == null ? "" : round(row.calories_kcal, 0) + " kcal";
    let markers = "";
    if (Number(row.strength_sessions || 0) > 0) markers += '<i class="marker strength"></i>';
    if (Number(row.cardio_sessions || 0) > 0) markers += '<i class="marker cardio"></i>';
    cell.innerHTML =
      '<span class="dayNum">' + d + '</span>' +
      '<span class="dayKcal">' + escapeHtml(kcal) + '</span>' +
      '<span class="dayMarkers">' + markers + '</span>';
    cell.addEventListener("click", function () {
      selectedDay = day;
      el("nutritionDay").value = day;
      loadMonth().catch(console.error);
      loadSelectedDay().catch(console.error);
      loadNutrition().catch(console.error);
    });
    host.appendChild(cell);
  }
}

async function loadSelectedDay() {
  if (!selectedDay) return;
  el("selectedDateTitle").textContent = dayLabel(selectedDay);

  const results = await Promise.all([
    db.from("life_nutrition_daily").select("*").eq("day", selectedDay).maybeSingle(),
    db.from("life_meals_local").select("*").eq("day", selectedDay).order("eaten_at"),
    db.from("life_workout_sessions_local").select("*").eq("day", selectedDay).order("started_at"),
    db.from("life_cardio_sessions_local").select("*").eq("day", selectedDay).order("started_at")
  ]);

  results.forEach(function (r) { if (r.error) throw r.error; });
  const nutrition = results[0].data || {};
  const meals = results[1].data || [];
  const workouts = results[2].data || [];
  const cardio = results[3].data || [];

  let sets = [];
  if (workouts.length) {
    const setResult = await db.from("life_strength_sets")
      .select("*")
      .in("session_id", workouts.map(function (w) { return w.id; }))
      .order("set_number");
    if (setResult.error) throw setResult.error;
    sets = setResult.data || [];
  }

  renderSelectedMetrics(nutrition);
  renderMeals(meals);
  renderStrength(workouts, sets);
  renderCardio(cardio);
}

function renderSelectedMetrics(n) {
  const itemCount = n.item_count == null ? 0 : n.item_count;
  el("metricGrid").innerHTML =
    metricCard("Calories", n.calories_kcal, "kcal", targets.calories_kcal, n.calories_known_count, itemCount) +
    metricCard("Protein", n.protein_g, "g", targets.protein_g, n.protein_known_count, itemCount) +
    metricCard("Fat", n.fat_g, "g", targets.fat_g, n.fat_known_count, itemCount) +
    metricCard("Carbs", n.carbs_g, "g", targets.carbs_g, n.carbs_known_count, itemCount);
}

function formatClock(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: profile.timezone,
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch (_) {
    return "";
  }
}

function renderMeals(rows) {
  el("mealCount").textContent = rows.length;
  if (!rows.length) {
    el("mealHistory").innerHTML = '<div class="empty">記録なし</div>';
    return;
  }
  el("mealHistory").innerHTML = rows.map(function (m) {
    const macros = [
      m.kcal == null ? null : round(m.kcal, 0) + " kcal",
      m.protein_g == null ? null : "P " + round(m.protein_g, 1) + "g",
      m.fat_g == null ? null : "F " + round(m.fat_g, 1) + "g",
      m.carbs_g == null ? null : "C " + round(m.carbs_g, 1) + "g"
    ].filter(Boolean).join(" · ");
    return '<div class="historyItem">' +
      '<strong>' + escapeHtml(m.name) + '</strong>' +
      '<div class="historyMeta">' + escapeHtml(formatClock(m.eaten_at)) +
      (m.quantity_text ? " · " + escapeHtml(m.quantity_text) : "") +
      (m.is_estimated ? " · 推定含む" : "") + '</div>' +
      (macros ? '<div class="historyNotes">' + escapeHtml(macros) + '</div>' : "") +
      (m.notes ? '<div class="historyNotes">' + escapeHtml(m.notes) + '</div>' : "") +
      '</div>';
  }).join("");
}

function renderStrength(sessions, sets) {
  el("strengthCount").textContent = sessions.length;
  if (!sessions.length) {
    el("strengthHistory").innerHTML = '<div class="empty">記録なし</div>';
    return;
  }
  const bySession = {};
  sets.forEach(function (s) {
    if (!bySession[s.session_id]) bySession[s.session_id] = [];
    bySession[s.session_id].push(s);
  });
  el("strengthHistory").innerHTML = sessions.map(function (s) {
    const groups = {};
    (bySession[s.id] || []).forEach(function (set) {
      if (!groups[set.exercise]) groups[set.exercise] = [];
      groups[set.exercise].push(set);
    });
    const exercises = Object.keys(groups).map(function (exercise) {
      const lines = groups[exercise].map(function (set) {
        const weight = set.weight_kg == null ? "自重" : round(set.weight_kg, 2) + "kg";
        const reps = set.reps == null ? "—" : set.reps + "回";
        const rir = set.rir == null ? "" : " · RIR " + round(set.rir, 1);
        return '<div class="setLine">' + escapeHtml(weight + " × " + reps + rir) + '</div>';
      }).join("");
      return '<div class="exerciseBlock"><div class="exerciseName">' + escapeHtml(exercise) + '</div>' + lines + '</div>';
    }).join("");
    return '<div class="historyItem"><strong>' + escapeHtml(formatClock(s.started_at) || "筋トレ") + '</strong>' +
      (s.notes ? '<div class="historyNotes">' + escapeHtml(s.notes) + '</div>' : "") +
      exercises + '</div>';
  }).join("");
}

function renderCardio(rows) {
  el("cardioCount").textContent = rows.length;
  if (!rows.length) {
    el("cardioHistory").innerHTML = '<div class="empty">記録なし</div>';
    return;
  }
  el("cardioHistory").innerHTML = rows.map(function (c) {
    const meta = [
      c.distance_km == null ? null : round(c.distance_km, 2) + " km",
      c.duration_sec == null ? null : round(c.duration_sec / 60, 1) + " min",
      c.avg_hr == null ? null : "Avg HR " + c.avg_hr,
      c.rpe == null ? null : "RPE " + round(c.rpe, 1)
    ].filter(Boolean).join(" · ");
    return '<div class="historyItem">' +
      '<strong>' + escapeHtml(c.activity_type) + '</strong>' +
      '<div class="historyMeta">' + escapeHtml(formatClock(c.started_at)) + '</div>' +
      (meta ? '<div class="historyNotes">' + escapeHtml(meta) + '</div>' : "") +
      (c.notes ? '<div class="historyNotes">' + escapeHtml(c.notes) + '</div>' : "") +
      '</div>';
  }).join("");
}

async function loadNutrition() {
  const day = el("nutritionDay").value || selectedDay;
  if (!day) return;

  const results = await Promise.all([
    db.from("life_nutrition_daily").select("*").eq("day", day).maybeSingle(),
    db.from("life_micronutrition_daily").select("*").eq("day", day)
  ]);
  results.forEach(function (r) { if (r.error) throw r.error; });

  const n = results[0].data || {};
  const itemCount = n.item_count == null ? 0 : n.item_count;
  el("nutritionMacroGrid").innerHTML =
    metricCard("Calories", n.calories_kcal, "kcal", targets.calories_kcal, n.calories_known_count, itemCount) +
    metricCard("Protein", n.protein_g, "g", targets.protein_g, n.protein_known_count, itemCount) +
    metricCard("Fat", n.fat_g, "g", targets.fat_g, n.fat_known_count, itemCount) +
    metricCard("Carbs", n.carbs_g, "g", targets.carbs_g, n.carbs_known_count, itemCount);

  const microMap = {};
  (results[1].data || []).forEach(function (row) { microMap[row.nutrient_code] = row; });
  renderMicronutrients(microMap);
}

function renderMicronutrients(microMap) {
  const host = el("micronutrientList");
  if (!nutrientDefs.length) {
    host.innerHTML = '<div class="empty">栄養素定義がありません。</div>';
    return;
  }

  host.innerHTML = nutrientDefs.map(function (def) {
    const row = microMap[def.code];
    const amount = row ? round(row.amount, 2) : null;
    const target = nutrientTargets[def.code] ? nutrientTargets[def.code].target_ideal : null;
    let progress = "";
    if (amount != null && target != null && Number(target) > 0) {
      const pct = Math.max(0, Math.min(100, Number(amount) / Number(target) * 100));
      progress = '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    }
    let meta = "未算出";
    if (row) {
      meta = "算出 " + row.known_meal_count + "/" + row.item_count + "件";
      if (Number(row.estimated_value_count || 0) > 0) {
        meta += " · 推定 " + row.estimated_value_count + "値";
      }
    }
    return '<div class="nutrientRow">' +
      '<div class="nutrientName"><strong>' + escapeHtml(def.name_ja) + '</strong><small>' + escapeHtml(meta) + '</small></div>' +
      '<div class="nutrientValue">' + (amount == null ? "—" : escapeHtml(amount + " " + def.unit)) + '</div>' +
      '<div class="nutrientProgress">' + progress +
      (target != null ? '<div class="nutrientMeta">目標 ' + escapeHtml(round(target, 2) + " " + def.unit) + '</div>' : "") +
      '</div></div>';
  }).join("");
}

function addSetRow(values) {
  const row = document.createElement("div");
  row.className = "setRow";
  row.innerHTML =
    '<input type="number" min="0" step="0.01" placeholder="kg" data-set-weight value="' + escapeHtml(values && values.weight || "") + '">' +
    '<input type="number" min="0" step="1" placeholder="回数" data-set-reps value="' + escapeHtml(values && values.reps || "") + '">' +
    '<input type="number" min="0" max="10" step="0.5" placeholder="RIR" data-set-rir value="' + escapeHtml(values && values.rir || "") + '">' +
    '<select data-set-type><option value="normal">通常</option><option value="warmup">Warmup</option><option value="drop">Drop</option><option value="backoff">Backoff</option><option value="failure">Failure</option><option value="other">Other</option></select>' +
    '<button class="removeSet" type="button" aria-label="セット削除">×</button>';
  row.querySelector(".removeSet").addEventListener("click", function () { row.remove(); });
  el("setRows").appendChild(row);
}

async function saveMeal(event) {
  event.preventDefault();
  showMessage("mealMessage", "保存中…", false);

  const payload = {
    user_id: session.user.id,
    eaten_at: new Date(el("mealEatenAt").value).toISOString(),
    meal_type: el("mealType").value,
    name: el("mealName").value.trim(),
    quantity_text: el("mealQuantity").value.trim() || null,
    kcal: numOrNull(el("mealKcal").value),
    protein_g: numOrNull(el("mealProtein").value),
    fat_g: numOrNull(el("mealFat").value),
    carbs_g: numOrNull(el("mealCarbs").value),
    is_estimated: el("mealEstimated").checked,
    source: el("mealSource").value.trim() || null,
    notes: el("mealNotes").value.trim() || null
  };

  const created = await db.from("life_meals").insert(payload).select("id,eaten_at").single();
  if (created.error) {
    showMessage("mealMessage", created.error.message, true);
    return;
  }

  const nutrients = [];
  document.querySelectorAll("[data-meal-nutrient]").forEach(function (input) {
    const amount = numOrNull(input.value);
    if (amount == null) return;
    nutrients.push({
      meal_id: created.data.id,
      user_id: session.user.id,
      nutrient_code: input.getAttribute("data-meal-nutrient"),
      amount: amount,
      is_estimated: payload.is_estimated,
      source: payload.source
    });
  });

  if (nutrients.length) {
    const nr = await db.from("life_meal_nutrients").insert(nutrients);
    if (nr.error) {
      showMessage("mealMessage", "食事は保存済みですが、詳細栄養素の保存に失敗: " + nr.error.message, true);
      return;
    }
  }

  selectedDay = dateInTimezone(new Date(created.data.eaten_at), profile.timezone);
  el("nutritionDay").value = selectedDay;
  el("mealName").value = "";
  el("mealQuantity").value = "";
  ["mealKcal", "mealProtein", "mealFat", "mealCarbs", "mealSource", "mealNotes"].forEach(function (id) { el(id).value = ""; });
  document.querySelectorAll("[data-meal-nutrient]").forEach(function (input) { input.value = ""; });
  el("mealEatenAt").value = toDatetimeLocal(new Date());
  showMessage("mealMessage", "保存しました。", false);
  showToast("食事を登録しました");
  await Promise.all([loadMonth(), loadSelectedDay(), loadNutrition()]);
}

async function saveStrength(event) {
  event.preventDefault();
  showMessage("strengthMessage", "保存中…", false);

  const rows = Array.from(document.querySelectorAll("#setRows .setRow"));
  const sets = rows.map(function (row, index) {
    return {
      exercise: el("strengthExercise").value.trim(),
      set_number: index + 1,
      weight_kg: numOrNull(row.querySelector("[data-set-weight]").value),
      reps: numOrNull(row.querySelector("[data-set-reps]").value),
      rir: numOrNull(row.querySelector("[data-set-rir]").value),
      set_type: row.querySelector("[data-set-type]").value
    };
  }).filter(function (s) { return s.weight_kg != null || s.reps != null; });

  if (!sets.length) {
    showMessage("strengthMessage", "少なくとも1セット入力してください。", true);
    return;
  }

  const created = await db.from("life_workout_sessions").insert({
    user_id: session.user.id,
    started_at: new Date(el("strengthStartedAt").value).toISOString(),
    session_type: "strength",
    notes: el("strengthNotes").value.trim() || null
  }).select("id,started_at").single();

  if (created.error) {
    showMessage("strengthMessage", created.error.message, true);
    return;
  }

  sets.forEach(function (s) { s.session_id = created.data.id; });
  const inserted = await db.from("life_strength_sets").insert(sets);
  if (inserted.error) {
    await db.from("life_workout_sessions").delete().eq("id", created.data.id);
    showMessage("strengthMessage", inserted.error.message, true);
    return;
  }

  selectedDay = dateInTimezone(new Date(created.data.started_at), profile.timezone);
  el("nutritionDay").value = selectedDay;
  el("strengthExercise").value = "";
  el("strengthNotes").value = "";
  el("strengthStartedAt").value = toDatetimeLocal(new Date());
  el("setRows").innerHTML = "";
  addSetRow();
  addSetRow();
  addSetRow();
  showMessage("strengthMessage", "保存しました。", false);
  showToast("筋トレを登録しました");
  await Promise.all([loadMonth(), loadSelectedDay()]);
}

async function saveCardio(event) {
  event.preventDefault();
  showMessage("cardioMessage", "保存中…", false);
  const created = await db.from("life_cardio_sessions").insert({
    user_id: session.user.id,
    started_at: new Date(el("cardioStartedAt").value).toISOString(),
    activity_type: el("cardioType").value.trim(),
    distance_km: numOrNull(el("cardioDistance").value),
    duration_sec: el("cardioDurationMin").value === "" ? null : Math.round(Number(el("cardioDurationMin").value) * 60),
    avg_hr: numOrNull(el("cardioAvgHr").value),
    max_hr: numOrNull(el("cardioMaxHr").value),
    rpe: numOrNull(el("cardioRpe").value),
    source: el("cardioSource").value.trim() || null,
    notes: el("cardioNotes").value.trim() || null
  }).select("started_at").single();

  if (created.error) {
    showMessage("cardioMessage", created.error.message, true);
    return;
  }

  selectedDay = dateInTimezone(new Date(created.data.started_at), profile.timezone);
  el("nutritionDay").value = selectedDay;
  ["cardioDistance", "cardioDurationMin", "cardioAvgHr", "cardioMaxHr", "cardioRpe", "cardioSource", "cardioNotes"].forEach(function (id) { el(id).value = ""; });
  el("cardioStartedAt").value = toDatetimeLocal(new Date());
  showMessage("cardioMessage", "保存しました。", false);
  showToast("有酸素を登録しました");
  await Promise.all([loadMonth(), loadSelectedDay()]);
}

async function saveSettings(event) {
  event.preventDefault();
  showMessage("settingsMessage", "保存中…", false);
  const timezone = el("timezone").value.trim() || "Asia/Tokyo";

  try {
    new Intl.DateTimeFormat("ja-JP", { timeZone: timezone }).format(new Date());
  } catch (_) {
    showMessage("settingsMessage", "タイムゾーン名が正しくありません。例: Asia/Tokyo", true);
    return;
  }

  const profileResult = await db.from("life_profiles").upsert({
    user_id: session.user.id,
    timezone: timezone,
    updated_at: new Date().toISOString()
  });
  if (profileResult.error) {
    showMessage("settingsMessage", profileResult.error.message, true);
    return;
  }

  const targetResult = await db.from("life_targets").upsert({
    user_id: session.user.id,
    calories_kcal: numOrNull(el("targetCalories").value),
    protein_g: numOrNull(el("targetProtein").value),
    fat_g: numOrNull(el("targetFat").value),
    carbs_g: numOrNull(el("targetCarbs").value),
    updated_at: new Date().toISOString()
  });
  if (targetResult.error) {
    showMessage("settingsMessage", targetResult.error.message, true);
    return;
  }

  const desired = [];
  document.querySelectorAll("[data-target-nutrient]").forEach(function (input) {
    const value = numOrNull(input.value);
    if (value != null) {
      desired.push({
        user_id: session.user.id,
        nutrient_code: input.getAttribute("data-target-nutrient"),
        target_ideal: value,
        updated_at: new Date().toISOString()
      });
    }
  });

  const desiredCodes = desired.map(function (x) { return x.nutrient_code; });
  const existingCodes = Object.keys(nutrientTargets);
  const removed = existingCodes.filter(function (code) { return !desiredCodes.includes(code); });

  if (removed.length) {
    const del = await db.from("life_nutrient_targets").delete().in("nutrient_code", removed).eq("user_id", session.user.id);
    if (del.error) {
      showMessage("settingsMessage", del.error.message, true);
      return;
    }
  }
  if (desired.length) {
    const up = await db.from("life_nutrient_targets").upsert(desired, { onConflict: "user_id,nutrient_code" });
    if (up.error) {
      showMessage("settingsMessage", up.error.message, true);
      return;
    }
  }

  profile.timezone = timezone;
  selectedDay = dateInTimezone(new Date(), timezone);
  monthCursor = new Date(selectedDay + "T00:00:00");
  el("nutritionDay").value = selectedDay;
  await loadSettings();
  await Promise.all([loadMonth(), loadSelectedDay(), loadNutrition()]);
  showMessage("settingsMessage", "保存しました。", false);
  showToast("設定を保存しました");
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach(function (button) {
    button.addEventListener("click", function () {
      const view = button.getAttribute("data-view");
      document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("active", b === button); });
      document.querySelectorAll("[data-view-panel]").forEach(function (panel) {
        panel.classList.toggle("active", panel.getAttribute("data-view-panel") === view);
      });
      if (view === "nutrition") loadNutrition().catch(console.error);
      if (view === "settings") loadSettings().catch(console.error);
    });
  });
}

function bindEvents() {
  bindTabs();
  el("authForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("authMessage", "ログイン中…", false);
    const result = await db.auth.signInWithPassword({
      email: el("email").value.trim(),
      password: el("password").value
    });
    if (result.error) showMessage("authMessage", result.error.message, true);
  });

  el("signUpBtn").addEventListener("click", async function () {
    showMessage("authMessage", "登録中…", false);
    const result = await db.auth.signUp({
      email: el("email").value.trim(),
      password: el("password").value,
      options: { emailRedirectTo: window.location.href.split("#")[0] }
    });
    if (result.error) {
      showMessage("authMessage", result.error.message, true);
    } else if (result.data.session) {
      showMessage("authMessage", "登録しました。", false);
    } else {
      showMessage("authMessage", "確認メールを送信しました。メール内のリンクを開いてください。", false);
    }
  });

  signOutBtn.addEventListener("click", function () { db.auth.signOut(); });
  el("refreshBtn").addEventListener("click", function () {
    Promise.all([loadMonth(), loadSelectedDay(), loadNutrition()]).then(function () { showToast("更新しました"); }).catch(function (e) { showToast(e.message); });
  });

  el("prevMonthBtn").addEventListener("click", function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    loadMonth().catch(console.error);
  });
  el("nextMonthBtn").addEventListener("click", function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    loadMonth().catch(console.error);
  });
  el("todayBtn").addEventListener("click", function () {
    selectedDay = dateInTimezone(new Date(), profile.timezone);
    monthCursor = new Date(selectedDay + "T00:00:00");
    el("nutritionDay").value = selectedDay;
    Promise.all([loadMonth(), loadSelectedDay(), loadNutrition()]).catch(console.error);
  });

  el("nutritionDay").addEventListener("change", function () { loadNutrition().catch(console.error); });
  el("mealForm").addEventListener("submit", function (e) { saveMeal(e).catch(function (err) { showMessage("mealMessage", err.message, true); }); });
  el("strengthForm").addEventListener("submit", function (e) { saveStrength(e).catch(function (err) { showMessage("strengthMessage", err.message, true); }); });
  el("cardioForm").addEventListener("submit", function (e) { saveCardio(e).catch(function (err) { showMessage("cardioMessage", err.message, true); }); });
  el("settingsForm").addEventListener("submit", function (e) { saveSettings(e).catch(function (err) { showMessage("settingsMessage", err.message, true); }); });
  el("addSetBtn").addEventListener("click", function () { addSetRow(); });
}

async function init() {
  bindEvents();
  addSetRow();
  addSetRow();
  addSetRow();
  setDefaultFormTimes();

  if (!configured) {
    setupWarning.hidden = false;
    authPanel.querySelectorAll("input,button").forEach(function (node) { node.disabled = true; });
    authMessage.textContent = "まず js/config.js を設定してください。";
    return;
  }

  db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const current = await db.auth.getSession();
  await handleSession(current.data.session);

  db.auth.onAuthStateChange(function (_event, nextSession) {
    if ((session && nextSession && session.access_token === nextSession.access_token) || (!session && !nextSession)) return;
    handleSession(nextSession).catch(console.error);
  });
}

init().catch(function (error) {
  console.error(error);
  showToast(error.message);
});
