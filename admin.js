// This file talks to Supabase (see supabase-config.js, loaded before this file).
// All menu data lives in the shared database — nothing here is stored in localStorage.

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return toISO(new Date()); }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

// ====== STATE ======
let cafeterias = [];
let currentCats = [];       // [{ name, items: [{id|null, name, weight, price, featured, combo, hidden}] }]
let currentHidden = false;
let editingCafeteriaId = null;
let editingDate = todayStr();

// ====== LOCAL FALLBACK ======
const LOCAL_MENU_KEY = "concordLocalMenuData";
const DEFAULT_CAFETERIA_ID = "default";

function getLocalMenuData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_MENU_KEY) || "null");
    if (raw && Array.isArray(raw)) return raw;
  } catch (e) {}
  const seed = [
    { id: "1", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Первое", name: "Борщ", weight: "300", price: 450, featured: true, combo: true, hidden: false, sort_order: 0 },
    { id: "2", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Второе", name: "Курица с рисом", weight: "300", price: 700, featured: false, combo: true, hidden: false, sort_order: 1 },
    { id: "3", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Салат", name: "Овощной салат", weight: "150", price: 350, featured: false, combo: true, hidden: false, sort_order: 2 }
  ];
  localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(seed));
  return seed;
}

function getLocalMenuForDate(cafeteriaId, dateStr) {
  return getLocalMenuData().filter(item => item.cafeteria_id === cafeteriaId && item.date === dateStr).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function persistLocalMenu(cafeteriaId, dateStr, items, hidden) {
  const all = getLocalMenuData().filter(item => !(item.cafeteria_id === cafeteriaId && item.date === dateStr));
  const rows = items.map((item, index) => ({
    id: item.id || `${cafeteriaId}-${dateStr}-${index}`,
    cafeteria_id: cafeteriaId,
    date: dateStr,
    category: item.category,
    name: item.name,
    weight: item.weight || null,
    price: item.price === null || item.price === undefined || item.price === "" ? null : Number(String(item.price).replace(",", ".")),
    featured: !!item.featured,
    combo: !!item.combo,
    hidden: !!item.hidden,
    sort_order: index
  }));
  all.push(...rows);
  localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(all));
  localStorage.setItem(`concordLocalMenuStatus-${cafeteriaId}-${dateStr}`, JSON.stringify({ cafeteria_id: cafeteriaId, date: dateStr, hidden: !!hidden, updated_at: new Date().toISOString() }));
}

function getLocalMenuStatus(cafeteriaId, dateStr) {
  try {
    const raw = localStorage.getItem(`concordLocalMenuStatus-${cafeteriaId}-${dateStr}`);
    return raw ? JSON.parse(raw) : { hidden: false, updated_at: new Date().toISOString() };
  } catch (e) {
    return { hidden: false, updated_at: new Date().toISOString() };
  }
}

// ====== AUTH ======
async function isCurrentUserAdmin(userId) {
  if (!sb) return true;
  const { data, error } = await sb.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) { console.error("admin check error", error); return false; }
  return !!data;
}

async function checkSessionAndShow() {
  if (!sb) {
    showPanel({ email: "demo@local" });
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); return; }
  const ok = await isCurrentUserAdmin(session.user.id);
  if (!ok) {
    document.getElementById("loginError").textContent = "У вас нет прав администратора.";
    await sb.auth.signOut();
    showLogin();
    return;
  }
  showPanel(session.user);
}

function showLogin() {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("panel").style.display = "none";
}

async function showPanel(user) {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("panel").style.display = "block";
  document.getElementById("whoAmI").textContent = user.email;

  await loadCafeterias();
  const dateInput = document.getElementById("dateInput");
  dateInput.value = todayStr();
  await loadDayIntoAdmin(document.getElementById("cafeteriaSelect").value, dateInput.value);
}

async function loadCafeterias() {
  const select = document.getElementById("cafeteriaSelect");
  if (!sb) {
    cafeterias = [{ id: DEFAULT_CAFETERIA_ID, name: "Concord" }];
    select.innerHTML = cafeterias.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    editingCafeteriaId = DEFAULT_CAFETERIA_ID;
    return;
  }
  const { data, error } = await sb.from("cafeterias").select("*").order("name", { ascending: true });
  if (error || !data || !data.length) {
    console.error("cafeterias load error", error);
    return;
  }
  cafeterias = data;
  select.innerHTML = cafeterias.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  editingCafeteriaId = cafeterias[0].id;
}

// ====== ICON HELPER for dish-name → category autofill list ======
function refreshDishList() {
  const dl = document.getElementById("dishlist");
  if (!dl) return;
  const names = new Set();
  currentCats.forEach(c => c.items.forEach(it => { if (it.name) names.add(it.name); }));
  dl.innerHTML = Array.from(names).sort().map(n => `<option value="${esc(n)}">`).join("");
}

// ====== LOAD / SAVE ======
async function loadDayIntoAdmin(cafeteriaId, dateStr) {
  editingCafeteriaId = cafeteriaId;
  editingDate = dateStr;

  if (!sb) {
    const items = getLocalMenuForDate(cafeteriaId, dateStr);
    const dayStatus = getLocalMenuStatus(cafeteriaId, dateStr);
    const grouped = new Map();
    items.forEach(it => {
      if (!grouped.has(it.category)) grouped.set(it.category, []);
      grouped.get(it.category).push({
        id: it.id,
        name: it.name,
        weight: it.weight || "",
        price: it.price === null || it.price === undefined ? "" : String(it.price),
        featured: !!it.featured,
        combo: !!it.combo,
        hidden: !!it.hidden
      });
    });
    currentCats = Array.from(grouped.entries()).map(([name, catItems]) => ({ name, items: catItems }));
    currentHidden = !!(dayStatus && dayStatus.hidden);
    renderAdmin();
    return;
  }

  const [{ data: items, error: itemsError }, { data: dayStatus }] = await Promise.all([
    sb.from("menu_items").select("*").eq("cafeteria_id", cafeteriaId).eq("date", dateStr).order("sort_order", { ascending: true }),
    sb.from("menu_day_status").select("*").eq("cafeteria_id", cafeteriaId).eq("date", dateStr).maybeSingle()
  ]);

  if (itemsError) {
    console.error("admin load error", itemsError);
    alert("Не удалось загрузить меню. Проверьте подключение и права доступа.");
    return;
  }

  const grouped = new Map();
  (items || []).forEach(it => {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category).push({
      id: it.id,
      name: it.name,
      weight: it.weight || "",
      price: it.price === null || it.price === undefined ? "" : String(it.price),
      featured: !!it.featured,
      combo: !!it.combo,
      hidden: !!it.hidden
    });
  });
  currentCats = Array.from(grouped.entries()).map(([name, catItems]) => ({ name, items: catItems }));
  currentHidden = !!(dayStatus && dayStatus.hidden);

  renderAdmin();
}

function collectRowsForSave() {
  const rows = [];
  let order = 0;
  currentCats.forEach(cat => {
    (cat.items || []).forEach(it => {
      if (!it.name || !it.name.trim()) return; // skip blank rows
      const priceNum = it.price === "" || it.price === null || it.price === undefined ? null : Number(String(it.price).replace(",", "."));
      rows.push({
        id: it.id || null,
        cafeteria_id: editingCafeteriaId,
        date: editingDate,
        category: cat.name,
        name: it.name.trim(),
        weight: it.weight || null,
        price: isNaN(priceNum) ? null : priceNum,
        featured: !!it.featured,
        combo: !!it.combo,
        hidden: !!it.hidden,
        sort_order: order++
      });
    });
  });
  return rows;
}

async function saveDay() {
  const st = document.getElementById("saveStatus");
  st.textContent = "Сохраняю…";

  if (!sb) {
    const rows = currentCats.flatMap(cat => (cat.items || []).map(item => ({ ...item, category: cat.name })));
    persistLocalMenu(editingCafeteriaId, editingDate, rows, currentHidden);
    st.textContent = "Сохранено ✓";
    setTimeout(() => (st.textContent = ""), 2000);
    await loadDayIntoAdmin(editingCafeteriaId, editingDate);
    return;
  }

  // ids that existed before this edit session (to detect deletions)
  const { data: existingRows } = await sb.from("menu_items").select("id").eq("cafeteria_id", editingCafeteriaId).eq("date", editingDate);
  const existingIds = new Set((existingRows || []).map(r => r.id));

  const rows = collectRowsForSave();
  const keptIds = new Set(rows.filter(r => r.id).map(r => r.id));
  const toDelete = Array.from(existingIds).filter(id => !keptIds.has(id));

  try {
    if (toDelete.length) {
      const { error } = await sb.from("menu_items").delete().in("id", toDelete);
      if (error) throw error;
    }

    for (const row of rows) {
      if (row.id) {
        const { id, ...fields } = row;
        const { error } = await sb.from("menu_items").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const { id, ...fields } = row;
        const { error } = await sb.from("menu_items").insert(fields);
        if (error) throw error;
      }
    }

    const { error: statusError } = await sb.from("menu_day_status").upsert(
      { cafeteria_id: editingCafeteriaId, date: editingDate, hidden: currentHidden },
      { onConflict: "cafeteria_id,date" }
    );
    if (statusError) throw statusError;

    st.textContent = "Сохранено ✓";
    setTimeout(() => (st.textContent = ""), 2000);
    await loadDayIntoAdmin(editingCafeteriaId, editingDate);
  } catch (err) {
    console.error("save error", err);
    st.textContent = "";
    alert("Не удалось сохранить меню: " + (err.message || err));
  }
}

// ====== ADMIN UI ======
function renderAdmin() {
  document.getElementById("catsWrap").innerHTML = currentCats.map((c, ci) => `
    <div class="acat">
      <div class="acat-title">
        <input value="${esc(c.name)}" data-ci="${ci}" class="catname" list="catlist">
        <div class="acat-actions">
          <button class="btn ghost small cat-up" data-ci="${ci}" title="Категория выше">↑</button>
          <button class="btn ghost small cat-down" data-ci="${ci}" title="Категория ниже">↓</button>
          <button class="btn ghost small delcat" data-ci="${ci}">Удалить категорию</button>
        </div>
      </div>
      ${(c.items || []).map((it, ii) => `
        <div class="aitem${it.hidden ? " row-hidden" : ""}" data-ci="${ci}" data-ii="${ii}">
          <input placeholder="Блюдо" value="${esc(it.name)}" class="itname" list="dishlist">
          <input placeholder="Вес, напр. 250" value="${esc(it.weight || "")}" class="itweight">
          <input placeholder="Цена, напр. 990" value="${esc(it.price || "")}" class="itprice">
          <button class="btn small item-up" title="Выше">↑</button>
          <button class="btn small item-down" title="Ниже">↓</button>
          <button class="btn small star-toggle${it.featured ? " on" : ""}" title="Блюдо дня">★</button>
          <button class="btn small combo-toggle${it.combo ? " on" : ""}" title="Входит в комплексный обед">🍽</button>
          <button class="btn small hide-toggle${it.hidden ? " on" : ""}" title="Скрыть блюдо">👁</button>
          <button class="btn ghost small delitem" title="Удалить">✕</button>
        </div>`).join("")}
      <button class="btn ghost small additem" data-ci="${ci}">+ Блюдо</button>
    </div>`).join("");
  refreshDishList();
  updateHideDayButton();
}

function updateHideDayButton() {
  const btn = document.getElementById("toggleHideDay");
  const note = document.getElementById("dayHiddenNote");
  if (!btn) return;
  btn.textContent = currentHidden ? "Показать меню на этот день" : "Скрыть меню на этот день";
  note.textContent = currentHidden ? "Сейчас на сайте: «Меню временно обновляется»" : "";
}

function bindAdminEvents() {
  const cw = document.getElementById("catsWrap");

  cw.addEventListener("input", e => {
    const t = e.target;
    if (t.classList.contains("catname")) currentCats[t.dataset.ci].name = t.value;
    const row = t.closest(".aitem");
    if (!row) return;
    const ci = row.dataset.ci, ii = row.dataset.ii;
    if (t.classList.contains("itname")) currentCats[ci].items[ii].name = t.value;
    if (t.classList.contains("itweight")) currentCats[ci].items[ii].weight = t.value;
    if (t.classList.contains("itprice")) currentCats[ci].items[ii].price = t.value;
  });

  cw.addEventListener("click", e => {
    if (e.target.classList.contains("delcat")) {
      currentCats.splice(Number(e.target.dataset.ci), 1);
      renderAdmin();
      return;
    }
    if (e.target.classList.contains("cat-up")) {
      const ci = Number(e.target.dataset.ci);
      if (ci > 0) { [currentCats[ci - 1], currentCats[ci]] = [currentCats[ci], currentCats[ci - 1]]; renderAdmin(); }
      return;
    }
    if (e.target.classList.contains("cat-down")) {
      const ci = Number(e.target.dataset.ci);
      if (ci < currentCats.length - 1) { [currentCats[ci + 1], currentCats[ci]] = [currentCats[ci], currentCats[ci + 1]]; renderAdmin(); }
      return;
    }
    if (e.target.classList.contains("additem")) {
      currentCats[Number(e.target.dataset.ci)].items.push({ id: null, name: "", weight: "", price: "", featured: false, combo: false, hidden: false });
      renderAdmin();
      return;
    }
    const row = e.target.closest(".aitem");
    if (!row) return;
    const ci = Number(row.dataset.ci), ii = Number(row.dataset.ii);
    if (e.target.classList.contains("delitem")) {
      currentCats[ci].items.splice(ii, 1);
      renderAdmin();
    }
    if (e.target.classList.contains("item-up")) {
      if (ii > 0) {
        const items = currentCats[ci].items;
        [items[ii - 1], items[ii]] = [items[ii], items[ii - 1]];
        renderAdmin();
      }
    }
    if (e.target.classList.contains("item-down")) {
      const items = currentCats[ci].items;
      if (ii < items.length - 1) {
        [items[ii + 1], items[ii]] = [items[ii], items[ii + 1]];
        renderAdmin();
      }
    }
    if (e.target.classList.contains("star-toggle")) {
      currentCats[ci].items[ii].featured = !currentCats[ci].items[ii].featured;
      renderAdmin();
    }
    if (e.target.classList.contains("combo-toggle")) {
      currentCats[ci].items[ii].combo = !currentCats[ci].items[ii].combo;
      renderAdmin();
    }
    if (e.target.classList.contains("hide-toggle")) {
      currentCats[ci].items[ii].hidden = !currentCats[ci].items[ii].hidden;
      renderAdmin();
    }
  });
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  bindAdminEvents();
  checkSessionAndShow();

  document.getElementById("loginBtn").onclick = async () => {
    if (!sb) return;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPass").value;
    document.getElementById("loginError").textContent = "";
    if (!email || !password) {
      document.getElementById("loginError").textContent = "Введите email и пароль.";
      return;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      document.getElementById("loginError").textContent = "Неверный email или пароль.";
      return;
    }
    const ok = await isCurrentUserAdmin(data.user.id);
    if (!ok) {
      document.getElementById("loginError").textContent = "У вас нет прав администратора.";
      await sb.auth.signOut();
      return;
    }
    showPanel(data.user);
  };

  document.getElementById("loginPass").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("loginBtn").click();
  });

  document.getElementById("logoutBtn").onclick = async () => {
    if (sb) await sb.auth.signOut();
    showLogin();
  };

  document.getElementById("cafeteriaSelect").addEventListener("change", e => {
    loadDayIntoAdmin(e.target.value, document.getElementById("dateInput").value);
  });

  document.getElementById("loadDay").onclick = () => {
    loadDayIntoAdmin(document.getElementById("cafeteriaSelect").value, document.getElementById("dateInput").value);
  };

  document.getElementById("copyYesterday").onclick = async () => {
    const dateInput = document.getElementById("dateInput");
    const d = parseISO(dateInput.value);
    d.setDate(d.getDate() - 1);
    const prev = toISO(d);
    if (!sb) {
      const items = getLocalMenuForDate(editingCafeteriaId, prev);
      const grouped = new Map();
      items.forEach(it => {
        if (!grouped.has(it.category)) grouped.set(it.category, []);
        grouped.get(it.category).push({
          id: null,
          name: it.name,
          weight: it.weight || "",
          price: it.price === null || it.price === undefined ? "" : String(it.price),
          featured: !!it.featured,
          combo: !!it.combo,
          hidden: !!it.hidden
        });
      });
      currentCats = Array.from(grouped.entries()).map(([name, catItems]) => ({ name, items: catItems }));
      renderAdmin();
      return;
    }
    const { data: items, error } = await sb.from("menu_items")
      .select("*")
      .eq("cafeteria_id", editingCafeteriaId)
      .eq("date", prev)
      .order("sort_order", { ascending: true });
    if (error) { console.error(error); return; }
    const grouped = new Map();
    (items || []).forEach(it => {
      if (!grouped.has(it.category)) grouped.set(it.category, []);
      grouped.get(it.category).push({
        id: null, // copying creates NEW rows for the target date
        name: it.name,
        weight: it.weight || "",
        price: it.price === null || it.price === undefined ? "" : String(it.price),
        featured: !!it.featured,
        combo: !!it.combo,
        hidden: !!it.hidden
      });
    });
    currentCats = Array.from(grouped.entries()).map(([name, catItems]) => ({ name, items: catItems }));
    renderAdmin();
  };

  document.getElementById("toggleHideDay").onclick = () => {
    currentHidden = !currentHidden;
    updateHideDayButton();
  };

  document.getElementById("addCat").onclick = () => {
    const input = document.getElementById("newCatName");
    const v = input.value.trim();
    if (!v) return;
    currentCats.push({ name: v, items: [] });
    input.value = "";
    renderAdmin();
  };

  document.getElementById("saveDay").onclick = saveDay;
});
