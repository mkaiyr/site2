// ====== SETTINGS ======
// Change this to your own admin password before publishing the site.
const ADMIN_PASSWORD = "concord2026";
const STORAGE_KEY = "concordMenuDays"; // { "2026-09-24": { date, categories:[...], hidden, updatedAt }, ... }
const LIBRARY_KEY = "concordDishLibrary"; // { "Суп мампар": { weight: "250", price: "490" }, ... }

// ====== ICONS ======
const ICONS = {
  soup: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M6 12V7M12 12V5M18 12V7" stroke-linecap="round"/>',
  main: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  salad: '<path d="M4 12a8 4 0 0 0 16 0z"/><path d="M12 12V4M8 8l2 2M16 8l-2 2" stroke-linecap="round"/>',
  side: '<circle cx="12" cy="14" r="6"/><path d="M8 9c0-2 2-4 4-4s4 2 4 4" stroke-linecap="round"/>',
  dessert: '<path d="M12 4l2.5 5H9.5z"/><rect x="6" y="9" width="12" height="9" rx="1"/>',
  drink: '<path d="M7 4h10l-1.2 14a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8z"/><path d="M8 9h8" stroke-linecap="round"/>',
  diet: '<path d="M12 20c-4-3-8-6-8-10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 4-4 7-8 10z"/>'
};

function iconFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("суп") || n.includes("уха") || n.includes("холодник")) return ICONS.soup;
  if (n.includes("диет")) return ICONS.diet;
  if (n.includes("десерт") || n.includes("торт") || n.includes("пирож") || n.includes("выпечк")) return ICONS.dessert;
  if (n.includes("салат")) return ICONS.salad;
  if (n.includes("гарнир")) return ICONS.side;
  if (n.includes("напит") || n.includes("сок") || n.includes("чай") || n.includes("компот")) return ICONS.drink;
  return ICONS.main;
}

function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${iconFor(name)}</svg>`;
}

function formatWeight(w) {
  const t = String(w || "").trim();
  if (!t) return "";
  return /^\d+([.,]\d+)?$/.test(t) ? t + " г." : t;
}

function formatPrice(p) {
  const t = String(p || "").trim();
  if (!t) return "";
  return /^\d+([.,]\d+)?$/.test(t) ? t + " ₸" : t;
}

function priceNum(p) {
  const t = String(p || "").replace(",", ".").trim();
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

function slug(s) {
  return "cat-" + (s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

// ====== DATE HELPERS ======
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toISO(new Date());
}

function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(s) {
  const dt = parseISO(s);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
}

function fmtShort(s) {
  const dt = parseISO(s);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// Monday..Friday of the week containing `d`
function weekdaysOf(d) {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const out = [];
  for (let i = 0; i < 5; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    out.push(toISO(dt));
  }
  return out;
}

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// ====== STORAGE ======
function loadAllDays() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveAllDays(days) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function rememberDish(name, weight, price) {
  if (!name) return;
  const lib = loadLibrary();
  lib[name] = { weight: weight || "", price: price || "" };
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
}

function refreshDishList() {
  const dl = document.getElementById("dishlist");
  if (!dl) return;
  const lib = loadLibrary();
  dl.innerHTML = Object.keys(lib).sort().map(n => `<option value="${esc(n)}">`).join("");
}

// ====== SEED / DEMO DATA ======
function buildSeed() {
  const today = todayStr();
  const menu = {
    date: today,
    hidden: false,
    updatedAt: new Date().toISOString(),
    categories: [
      { name: "Первое", items: [
        { name: "Борщ", weight: "300", price: "450", featured: true, combo: true, hidden: false }
      ]},
      { name: "Второе", items: [
        { name: "Курица с рисом", weight: "300", price: "700", featured: false, combo: true, hidden: false },
        { name: "Котлета с пюре", weight: "280", price: "650", featured: false, combo: false, hidden: false }
      ]},
      { name: "Салат", items: [
        { name: "Овощной салат", weight: "150", price: "350", featured: false, combo: true, hidden: false }
      ]},
      { name: "Напиток", items: [
        { name: "Компот", weight: "250", price: "200", featured: false, combo: true, hidden: false },
        { name: "Чай", weight: "250", price: "150", featured: false, combo: false, hidden: false }
      ]}
    ]
  };
  const days = {};
  days[today] = menu;
  const lib = {};
  menu.categories.forEach(c => c.items.forEach(it => { lib[it.name] = { weight: it.weight, price: it.price }; }));
  return { days, lib };
}

function ensureSeedData() {
  const days = loadAllDays();
  if (Object.keys(days).length === 0) {
    const seed = buildSeed();
    saveAllDays(seed.days);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(seed.lib));
  }
}

// ====== PUBLIC MENU ======
let viewingDate = todayStr();

function renderWeekNav() {
  const nav = document.getElementById("weekNav");
  const week = weekdaysOf(parseISO(viewingDate));
  const today = todayStr();
  nav.innerHTML = week.map(dateStr => {
    const dt = parseISO(dateStr);
    const label = WEEKDAY_SHORT[dt.getDay()];
    const isToday = dateStr === today;
    const isActive = dateStr === viewingDate;
    return `<button type="button" class="wk${isActive ? " active" : ""}${isToday ? " is-today" : ""}" data-date="${dateStr}">
      <span class="wk-day">${label}</span><span class="wk-num">${dt.getDate()}</span>
    </button>`;
  }).join("");
  nav.querySelectorAll(".wk").forEach(btn => {
    btn.onclick = () => {
      viewingDate = btn.dataset.date;
      renderPublic();
    };
  });
}

function renderPublic() {
  const wrap = document.getElementById("menuWrap");
  const nav = document.getElementById("catnav");
  const updatedLabel = document.getElementById("updatedLabel");
  document.getElementById("dateLabel").textContent = fmtDate(viewingDate);

  renderWeekNav();

  const days = loadAllDays();
  const doc = days[viewingDate];

  const dod = document.getElementById("dishOfDay");
  const combo = document.getElementById("comboBox");

  if (!doc || !doc.categories || !doc.categories.length) {
    wrap.innerHTML = `<div class="empty">${viewingDate < todayStr() ? "Меню на этот день не было опубликовано." : "Меню на этот день пока не опубликовано."}</div>`;
    nav.innerHTML = "";
    dod.hidden = true;
    combo.hidden = true;
    updatedLabel.hidden = true;
    return;
  }

  if (doc.hidden) {
    wrap.innerHTML = `<div class="empty">Меню временно обновляется.<br>Загляните чуть позже.</div>`;
    nav.innerHTML = "";
    dod.hidden = true;
    combo.hidden = true;
    updatedLabel.hidden = true;
    return;
  }

  if (doc.updatedAt) {
    const sameDay = toISO(new Date(doc.updatedAt)) === todayStr();
    updatedLabel.textContent = sameDay
      ? `Меню обновлено сегодня в ${fmtTime(doc.updatedAt)}`
      : `Меню обновлено ${fmtShort(toISO(new Date(doc.updatedAt)))} в ${fmtTime(doc.updatedAt)}`;
    updatedLabel.hidden = false;
  } else {
    updatedLabel.hidden = true;
  }

  const visibleCats = doc.categories
    .map(c => ({ name: c.name, items: (c.items || []).filter(it => !it.hidden) }))
    .filter(c => c.items.length);

  // dish of the day
  let featured = [];
  visibleCats.forEach(c => c.items.forEach(it => { if (it.featured) featured.push(it); }));
  if (featured.length) {
    document.getElementById("dodLabel").textContent = featured.length > 1 ? "Блюда дня" : "Блюдо дня";
    document.getElementById("dodList").innerHTML = featured.map(f => `
      <span class="dod-pill">
        <span class="dod-name">${esc(f.name)}</span>
        <span class="dod-price">${esc(formatPrice(f.price))}</span>
      </span>`).join("");
    dod.hidden = false;
  } else {
    dod.hidden = true;
  }

  // combo lunch total
  let comboItems = [];
  visibleCats.forEach(c => c.items.forEach(it => { if (it.combo) comboItems.push(it); }));
  if (comboItems.length) {
    document.getElementById("comboList").innerHTML = comboItems.map(it => `
      <span class="combo-pill">${esc(it.name)} — ${esc(formatPrice(it.price))}</span>`).join("");
    const total = comboItems.reduce((sum, it) => sum + priceNum(it.price), 0);
    document.getElementById("comboTotal").textContent = `Итого при выборе полного обеда: ${total} ₸`;
    combo.hidden = false;
  } else {
    combo.hidden = true;
  }

  if (!visibleCats.length) {
    wrap.innerHTML = `<div class="empty">Меню на этот день пока не опубликовано.</div>`;
    nav.innerHTML = "";
    return;
  }

  nav.innerHTML = visibleCats.map(c => `<a href="#${slug(c.name)}">${esc(c.name)}</a>`).join("");

  wrap.innerHTML = visibleCats.map((c, ci) => `
    <div class="cat" id="${slug(c.name)}" style="animation-delay:${ci * 90}ms">
      <div class="cat-head">${svg(c.name)}<h2>${esc(c.name)}</h2></div>
      ${c.items.map(it => `
        <div class="item${it.featured ? " featured" : ""}">
          <span class="name">${it.featured ? '<span class="star">★</span>' : ""}${esc(it.name)}</span>
          <span class="meta">${esc(formatWeight(it.weight))}</span>
          <span class="price">${esc(formatPrice(it.price))}</span>
        </div>`).join("")}
    </div>`).join("");

  setupNavHighlight();
}

function setupNavHighlight() {
  const links = Array.from(document.querySelectorAll(".catnav a"));
  const sections = links.map(a => document.querySelector(a.getAttribute("href")));
  if (!sections.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = "#" + e.target.id;
        links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === id));
      }
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach(s => s && obs.observe(s));
}

// ====== ADMIN ======
let currentCats = [];
let currentHidden = false;
let editingDate = todayStr();

function renderAdmin() {
  document.getElementById("catsWrap").innerHTML = currentCats.map((c, ci) => `
    <div class="acat">
      <div class="acat-title">
        <input value="${esc(c.name)}" data-ci="${ci}" class="catname" list="catlist">
        <button class="btn ghost small delcat" data-ci="${ci}">Удалить категорию</button>
      </div>
      ${(c.items || []).map((it, ii) => `
        <div class="aitem${it.hidden ? " row-hidden" : ""}" data-ci="${ci}" data-ii="${ii}">
          <input placeholder="Блюдо" value="${esc(it.name)}" class="itname" list="dishlist">
          <input placeholder="Вес, напр. 250" value="${esc(it.weight || "")}" class="itweight">
          <input placeholder="Цена, напр. 990" value="${esc(it.price || "")}" class="itprice">
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
    if (t.classList.contains("itname")) {
      currentCats[ci].items[ii].name = t.value;
      const known = loadLibrary()[t.value];
      if (known) {
        if (!currentCats[ci].items[ii].weight) { currentCats[ci].items[ii].weight = known.weight; row.querySelector(".itweight").value = known.weight; }
        if (!currentCats[ci].items[ii].price) { currentCats[ci].items[ii].price = known.price; row.querySelector(".itprice").value = known.price; }
      }
    }
    if (t.classList.contains("itweight")) currentCats[ci].items[ii].weight = t.value;
    if (t.classList.contains("itprice")) currentCats[ci].items[ii].price = t.value;
  });

  cw.addEventListener("click", e => {
    if (e.target.classList.contains("delcat")) {
      currentCats.splice(Number(e.target.dataset.ci), 1);
      renderAdmin();
      return;
    }
    if (e.target.classList.contains("additem")) {
      currentCats[Number(e.target.dataset.ci)].items.push({ name: "", weight: "", price: "", featured: false, combo: false, hidden: false });
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

function loadDayIntoAdmin(dateStr) {
  editingDate = dateStr;
  const days = loadAllDays();
  const doc = days[dateStr];
  currentCats = (doc && doc.categories) || [];
  currentHidden = !!(doc && doc.hidden);
  renderAdmin();
}

// ====== TV MODE ======
function applyTvMode() {
  const params = new URLSearchParams(location.search);
  if (params.get("tv") === "1") {
    document.body.classList.add("tv-mode");
  }
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  ensureSeedData();
  applyTvMode();
  renderPublic();
  bindAdminEvents();
  refreshDishList();

  const overlay = document.getElementById("overlay");
  const loginBox = document.getElementById("loginBox");
  const editBox = document.getElementById("editBox");
  const dateInput = document.getElementById("dateInput");
  dateInput.value = todayStr();

  document.getElementById("adminBtn").onclick = () => {
    overlay.classList.add("open");
    if (sessionStorage.getItem("concordAdmin") === "1") {
      loginBox.style.display = "none";
      editBox.style.display = "block";
      loadDayIntoAdmin(dateInput.value);
    } else {
      loginBox.style.display = "block";
      editBox.style.display = "none";
    }
  };

  document.getElementById("closeAdmin").onclick = () => overlay.classList.remove("open");

  document.getElementById("loginBtn").onclick = () => {
    const val = document.getElementById("adminPass").value;
    if (val === ADMIN_PASSWORD) {
      sessionStorage.setItem("concordAdmin", "1");
      loginBox.style.display = "none";
      editBox.style.display = "block";
      loadDayIntoAdmin(dateInput.value);
    } else {
      document.getElementById("loginError").textContent = "Неверный пароль.";
    }
  };

  document.getElementById("adminPass").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("loginBtn").click();
  });

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.removeItem("concordAdmin");
    overlay.classList.remove("open");
  };

  document.getElementById("loadDay").onclick = () => loadDayIntoAdmin(dateInput.value);

  document.getElementById("copyYesterday").onclick = () => {
    const d = parseISO(dateInput.value);
    d.setDate(d.getDate() - 1);
    const prev = toISO(d);
    const days = loadAllDays();
    currentCats = JSON.parse(JSON.stringify((days[prev] && days[prev].categories) || []));
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

  document.getElementById("saveDay").onclick = () => {
    const days = loadAllDays();
    days[editingDate] = {
      date: editingDate,
      categories: currentCats,
      hidden: currentHidden,
      updatedAt: new Date().toISOString()
    };
    saveAllDays(days);
    currentCats.forEach(c => (c.items || []).forEach(it => rememberDish(it.name, it.weight, it.price)));
    refreshDishList();
    const st = document.getElementById("saveStatus");
    st.textContent = "Сохранено ✓";
    setTimeout(() => (st.textContent = ""), 2000);
    if (editingDate === viewingDate) renderPublic();
  };

  document.getElementById("restoreDefaults").onclick = () => {
    if (!confirm("Это заменит все сохранённые меню демонстрационными данными. Продолжить?")) return;
    const seed = buildSeed();
    saveAllDays(seed.days);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(seed.lib));
    viewingDate = todayStr();
    dateInput.value = todayStr();
    loadDayIntoAdmin(dateInput.value);
    refreshDishList();
    renderPublic();
    const st = document.getElementById("saveStatus");
    st.textContent = "Восстановлено ✓";
    setTimeout(() => (st.textContent = ""), 2000);
  };
});
