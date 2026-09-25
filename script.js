// This file talks to Supabase (see supabase-config.js, loaded before this file).
// No menu data is stored in localStorage — everything comes from the shared database.
// localStorage is used only for one thing: remembering which cafeteria this browser
// last looked at, purely a display convenience, not menu data.
const CANTEEN_KEY = "concordSelectedCanteen";

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
  if (p === null || p === undefined || p === "") return "";
  return `${p} ₸`;
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

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// ====== TV MODE ======
function applyTvMode() {
  const params = new URLSearchParams(location.search);
  if (params.get("tv") === "1") {
    document.body.classList.add("tv-mode");
  }
}

// ====== LOCAL FALLBACK ======
const LOCAL_MENU_KEY = "concordLocalMenuData";
const DEFAULT_CAFETERIA_ID = "default";

function getSeedMenu() {
  return [
    { id: "1", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Первое", name: "Борщ", weight: "300", price: 450, featured: true, combo: true, hidden: false, sort_order: 0 },
    { id: "2", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Второе", name: "Курица с рисом", weight: "300", price: 700, featured: false, combo: true, hidden: false, sort_order: 1 },
    { id: "3", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Второе", name: "Котлета с пюре", weight: "280", price: 650, featured: false, combo: false, hidden: false, sort_order: 2 },
    { id: "4", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Салат", name: "Овощной салат", weight: "150", price: 350, featured: false, combo: true, hidden: false, sort_order: 3 },
    { id: "5", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Напиток", name: "Компот", weight: "250", price: 200, featured: false, combo: true, hidden: false, sort_order: 4 },
    { id: "6", cafeteria_id: DEFAULT_CAFETERIA_ID, date: todayStr(), category: "Напиток", name: "Чай", weight: "250", price: 150, featured: false, combo: false, hidden: false, sort_order: 5 }
  ];
}

function getLocalMenuData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_MENU_KEY) || "null");
    if (raw && Array.isArray(raw)) return raw;
  } catch (e) {}
  const seed = getSeedMenu();
  localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(seed));
  return seed;
}

function getLocalMenuForDate(cafeteriaId, dateStr) {
  const all = getLocalMenuData();
  const filtered = all.filter(item => item.cafeteria_id === cafeteriaId && item.date === dateStr);
  return filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function saveLocalMenuForDate(cafeteriaId, dateStr, items, hidden) {
  const all = getLocalMenuData();
  const next = all.filter(item => !(item.cafeteria_id === cafeteriaId && item.date === dateStr));
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
  next.push(...rows);
  localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(next));
  const status = { cafeteria_id: cafeteriaId, date: dateStr, hidden: !!hidden, updated_at: new Date().toISOString() };
  localStorage.setItem(`concordLocalMenuStatus-${cafeteriaId}-${dateStr}`, JSON.stringify(status));
}

function getLocalMenuStatus(cafeteriaId, dateStr) {
  try {
    const raw = localStorage.getItem(`concordLocalMenuStatus-${cafeteriaId}-${dateStr}`);
    return raw ? JSON.parse(raw) : { hidden: false, updated_at: new Date().toISOString() };
  } catch (e) {
    return { hidden: false, updated_at: new Date().toISOString() };
  }
}

// ====== STATE ======
let cafeterias = [];
let activeCafeteriaId = null;
let realtimeChannel = null;

// ====== CANTEEN SWITCHER ======
async function initCanteens() {
  const select = document.getElementById("canteenSelect");
  if (!sb) {
    cafeterias = [{ id: DEFAULT_CAFETERIA_ID, name: "Concord" }];
    select.innerHTML = cafeterias.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const saved = localStorage.getItem("concordSelectedCanteen") || DEFAULT_CAFETERIA_ID;
    select.value = saved;
    select.addEventListener("change", () => selectCafeteria(select.value));
    selectCafeteria(saved || DEFAULT_CAFETERIA_ID);
    return;
  }
  const { data, error } = await sb.from("cafeterias").select("*").order("name", { ascending: true });

  if (error || !data || !data.length) {
    document.getElementById("menuWrap").innerHTML =
      '<div class="empty">Не удалось загрузить список столовых.<br>Проверьте подключение к базе данных.</div>';
    console.error("cafeterias load error", error);
    return;
  }

  cafeterias = data;
  select.innerHTML = cafeterias.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");

  const saved = localStorage.getItem(CANTEEN_KEY);
  const initial = cafeterias.some(c => c.id === saved) ? saved : cafeterias[0].id;
  select.value = initial;

  select.addEventListener("change", () => selectCafeteria(select.value));

  selectCafeteria(initial);
}

function selectCafeteria(id) {
  activeCafeteriaId = id;
  localStorage.setItem(CANTEEN_KEY, id);

  const canteen = cafeterias.find(c => c.id === id);
  const title = document.getElementById("canteenTitle");
  if (title && canteen) title.textContent = canteen.name;
  const select = document.getElementById("canteenSelect");
  if (select && select.value !== id) select.value = id;

  if (!sb) {
    loadAndRenderMenu();
    return;
  }

  subscribeRealtime(id);
  loadAndRenderMenu();
}

// ====== REALTIME SYNC ======
// Any admin's change to this cafeteria's menu is pushed to every open tab/device instantly.
function subscribeRealtime(cafeteriaId) {
  if (!sb) return;
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = sb
    .channel("public-menu-" + cafeteriaId)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `cafeteria_id=eq.${cafeteriaId}` }, () => loadAndRenderMenu())
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_day_status", filter: `cafeteria_id=eq.${cafeteriaId}` }, () => loadAndRenderMenu())
    .subscribe();
}

// ====== PUBLIC MENU ======
async function loadAndRenderMenu() {
  const today = todayStr();
  document.getElementById("dateLabel").textContent = fmtDate(today);

  if (!sb) {
    const items = getLocalMenuForDate(activeCafeteriaId || DEFAULT_CAFETERIA_ID, today);
    const dayStatus = getLocalMenuStatus(activeCafeteriaId || DEFAULT_CAFETERIA_ID, today);
    renderMenu(items || [], dayStatus || { hidden: false, updated_at: new Date().toISOString() });
    return;
  }

  const [{ data: items, error: itemsError }, { data: dayStatus }] = await Promise.all([
    sb.from("menu_items").select("*").eq("cafeteria_id", activeCafeteriaId).eq("date", today).order("sort_order", { ascending: true }),
    sb.from("menu_day_status").select("*").eq("cafeteria_id", activeCafeteriaId).eq("date", today).maybeSingle()
  ]);

  if (itemsError) {
    console.error("menu load error", itemsError);
    document.getElementById("menuWrap").innerHTML = '<div class="empty">Не удалось загрузить меню. Попробуйте обновить страницу.</div>';
    document.getElementById("catnav").innerHTML = "";
    document.getElementById("dishOfDay").hidden = true;
    document.getElementById("comboBox").hidden = true;
    document.getElementById("updatedLabel").hidden = true;
    return;
  }

  renderMenu(items || [], dayStatus || null);
}

function renderMenu(items, dayStatus) {
  const wrap = document.getElementById("menuWrap");
  const nav = document.getElementById("catnav");
  const dod = document.getElementById("dishOfDay");
  const combo = document.getElementById("comboBox");
  const updatedLabel = document.getElementById("updatedLabel");

  if (dayStatus && dayStatus.hidden) {
    wrap.innerHTML = `<div class="empty">Меню временно обновляется.<br>Загляните чуть позже.</div>`;
    nav.innerHTML = "";
    dod.hidden = true;
    combo.hidden = true;
    updatedLabel.hidden = true;
    return;
  }

  const visible = items.filter(it => !it.hidden);

  if (!visible.length) {
    wrap.innerHTML = `<div class="empty">Меню на сегодня пока не опубликовано.</div>`;
    nav.innerHTML = "";
    dod.hidden = true;
    combo.hidden = true;
    updatedLabel.hidden = true;
    return;
  }

  if (dayStatus && dayStatus.updated_at) {
    updatedLabel.textContent = `Меню обновлено сегодня в ${fmtTime(dayStatus.updated_at)}`;
    updatedLabel.hidden = false;
  } else {
    updatedLabel.hidden = true;
  }

  // group by category, preserving first-seen order (items already sorted by sort_order)
  const grouped = new Map();
  visible.forEach(it => {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category).push(it);
  });
  const cats = Array.from(grouped.entries()).map(([name, catItems]) => ({ name, items: catItems }));

  // dish of the day
  const featured = visible.filter(it => it.featured);
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
  const comboItems = visible.filter(it => it.combo);
  if (comboItems.length) {
    document.getElementById("comboList").innerHTML = comboItems.map(it => `
      <span class="combo-pill">${esc(it.name)} — ${esc(formatPrice(it.price))}</span>`).join("");
    const total = comboItems.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
    document.getElementById("comboTotal").textContent = `Итого при выборе полного обеда: ${total} ₸`;
    combo.hidden = false;
  } else {
    combo.hidden = true;
  }

  nav.innerHTML = cats.map(c => `<a href="#${slug(c.name)}">${esc(c.name)}</a>`).join("");

  wrap.innerHTML = cats.map((c, ci) => `
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

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  applyTvMode();
  initCanteens();

  // Safety net: catches midnight rollover to the next day even if nothing
  // changed in the database (realtime only fires on actual writes).
  setInterval(() => { if (activeCafeteriaId) loadAndRenderMenu(); }, 5 * 60 * 1000);
});
