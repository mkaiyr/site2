// ====== SETTINGS ======
// Change this to your own admin password before publishing the site.
const ADMIN_PASSWORD = "admin2026";
const STORAGE_KEY = "concordMenuDays"; // { "2026-09-24": { categories: [...] }, ... }

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
  if (n.includes("десерт") || n.includes("торт") || n.includes("пирож")) return ICONS.dessert;
  if (n.includes("салат")) return ICONS.salad;
  if (n.includes("гарнир")) return ICONS.side;
  if (n.includes("напит") || n.includes("сок") || n.includes("чай")) return ICONS.drink;
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

function slug(s) {
  return "cat-" + (s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

// ====== HELPERS ======
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(s) {
  const [y, m, d] = s.split("-");
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

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

// ====== DISH LIBRARY (autocomplete + auto-fill for admin) ======
const LIBRARY_KEY = "concordDishLibrary"; // { "Суп мампар": { weight: "250", price: "490" }, ... }

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

// ====== PUBLIC MENU ======
function renderPublic() {
  const wrap = document.getElementById("menuWrap");
  const nav = document.getElementById("catnav");
  document.getElementById("dateLabel").textContent = fmtDate(todayStr());

  const days = loadAllDays();
  const doc = days[todayStr()];

  if (!doc || !doc.categories || !doc.categories.length) {
    wrap.innerHTML = '<div class="empty">Меню на сегодня ещё не опубликовано.<br>Загляните чуть позже.</div>';
    nav.innerHTML = "";
    document.getElementById("dishOfDay").hidden = true;
    return;
  }

  // dish of the day
 let featured = [];
doc.categories.forEach(c => (c.items || []).forEach(it => { if (it.featured) featured.push(it); }));
const dod = document.getElementById("dishOfDay");
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

  nav.innerHTML = doc.categories.map(c => `<a href="#${slug(c.name)}">${esc(c.name)}</a>`).join("");

  wrap.innerHTML = doc.categories.map((c, ci) => `
    <div class="cat" id="${slug(c.name)}" style="animation-delay:${ci * 90}ms">
      <div class="cat-head">${svg(c.name)}<h2>${esc(c.name)}</h2></div>
      ${(c.items || []).map(it => `
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
let editingDate = todayStr();

function renderAdmin() {
  document.getElementById("catsWrap").innerHTML = currentCats.map((c, ci) => `
    <div class="acat">
      <div class="acat-title">
        <input value="${esc(c.name)}" data-ci="${ci}" class="catname">
        <button class="btn ghost small delcat" data-ci="${ci}">Удалить категорию</button>
      </div>
      ${(c.items || []).map((it, ii) => `
        <div class="aitem" data-ci="${ci}" data-ii="${ii}">
          <input placeholder="Блюдо" value="${esc(it.name)}" class="itname" list="dishlist">
          <input placeholder="Вес, напр. 250" value="${esc(it.weight || "")}" class="itweight">
          <input placeholder="Цена, напр. 990" value="${esc(it.price || "")}" class="itprice">
          <button class="btn small star-toggle${it.featured ? " on" : ""}" title="Блюдо дня">★</button>
          <button class="btn ghost small delitem">✕</button>
        </div>`).join("")}
      <button class="btn ghost small additem" data-ci="${ci}">+ Блюдо</button>
    </div>`).join("");
  refreshDishList();
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
      currentCats.splice(e.target.dataset.ci, 1);
      renderAdmin();
    }
    if (e.target.classList.contains("additem")) {
      currentCats[e.target.dataset.ci].items.push({ name: "", weight: "", price: "", featured: false });
      renderAdmin();
    }
    if (e.target.classList.contains("delitem")) {
      const row = e.target.closest(".aitem");
      currentCats[row.dataset.ci].items.splice(row.dataset.ii, 1);
      renderAdmin();
    }
    if (e.target.classList.contains("star-toggle")) {
  const row = e.target.closest(".aitem");
  const ci = row.dataset.ci, ii = row.dataset.ii;
  currentCats[ci].items[ii].featured = !currentCats[ci].items[ii].featured;
  renderAdmin();
}
  });
}

function loadDayIntoAdmin(dateStr) {
  editingDate = dateStr;
  const days = loadAllDays();
  currentCats = (days[dateStr] && days[dateStr].categories) || [];
  renderAdmin();
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  renderPublic();
  bindAdminEvents();
  refreshDishList();


  // показать кнопку только тем, кто зашёл по ссылке ?admin=1 (запоминается в браузере)
  const params = new URLSearchParams(location.search);
  if (params.has("admin")) localStorage.setItem("kalinkaAdminAccess", "1");
  if (localStorage.getItem("kalinkaAdminAccess") === "1") {
    document.getElementById("adminBtn").style.display = "block";
  }

  // ...остальной код без изменений
  const overlay = document.getElementById("overlay");
  const loginBox = document.getElementById("loginBox");
  const editBox = document.getElementById("editBox");
  const dateInput = document.getElementById("dateInput");
  dateInput.value = todayStr();

  document.getElementById("adminBtn").onclick = () => {
    overlay.classList.add("open");
    if (sessionStorage.getItem("kalinkaAdmin") === "1") {
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
      sessionStorage.setItem("kalinkaAdmin", "1");
      loginBox.style.display = "none";
      editBox.style.display = "block";
      loadDayIntoAdmin(dateInput.value);
    } else {
      document.getElementById("loginError").textContent = "Неверный пароль.";
    }
  };

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.removeItem("kalinkaAdmin");
    overlay.classList.remove("open");
  };

  document.getElementById("loadDay").onclick = () => loadDayIntoAdmin(dateInput.value);

  document.getElementById("copyYesterday").onclick = () => {
    const d = new Date(dateInput.value);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    const prev = `${y}-${m}-${day}`;
    const days = loadAllDays();
    currentCats = JSON.parse(JSON.stringify((days[prev] && days[prev].categories) || []));
    renderAdmin();
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
    days[editingDate] = { date: editingDate, categories: currentCats };
    saveAllDays(days);
    currentCats.forEach(c => c.items.forEach(it => rememberDish(it.name, it.weight, it.price)));
    refreshDishList();
    const st = document.getElementById("saveStatus");
    st.textContent = "Сохранено ✓";
    setTimeout(() => (st.textContent = ""), 2000);
    if (editingDate === todayStr()) renderPublic();
  };
});
