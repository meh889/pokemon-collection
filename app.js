/* ============================================================
   Mi Colección Pokémon — lógica
   Persistencia en localStorage, sin backend.
   ============================================================ */

const STORAGE_KEY = "pokemon-collection-v1";

const LANGUAGES = [
  { code: "es",    name: "Español",                 flag: "🇪🇸" },
  { code: "es-la", name: "Español (Latinoamérica)", flag: "🌎" },
  { code: "en",    name: "Inglés",                  flag: "🇬🇧" },
  { code: "pt",    name: "Portugués",               flag: "🇵🇹" },
  { code: "fr",    name: "Francés",                 flag: "🇫🇷" },
  { code: "it",    name: "Italiano",                flag: "🇮🇹" },
  { code: "de",    name: "Alemán",                  flag: "🇩🇪" },
  { code: "nl",    name: "Holandés",                flag: "🇳🇱" },
  { code: "ru",    name: "Ruso",                    flag: "🇷🇺" },
  { code: "zh",    name: "Chino",                   flag: "🇨🇳" },
  { code: "ko",    name: "Coreano",                 flag: "🇰🇷" },
  { code: "id",    name: "Indonesio",               flag: "🇮🇩" },
];

const BINDER_PRESETS = {
  vaultx480: { cols: 4, rows: 3, sheets: 20, name: "Vault X 480" },
  vaultx360: { cols: 3, rows: 3, sheets: 20, name: "Vault X 360" },
  vaultx216: { cols: 3, rows: 3, sheets: 12, name: "Vault X 216" },
};

/* ============== STATE ============== */
const defaultState = () => ({
  cards: [],          // { id, name, set, number, rarity, language, condition, quantity, image, notes, list, createdAt }
                      // list: "collection" | "wishlist"
  binder: {
    type: "vaultx480",
    custom: { cols: 4, rows: 3, sheets: 20 },
    // map "sheet-side-slot" -> cardId, e.g. "0-front-3"
    slots: {},
  },
  ui: {
    page: 0,        // 0..(sheets-1)
    side: "front",  // 'front' | 'back'
  },
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed,
      binder: { ...defaultState().binder, ...(parsed.binder || {}) },
      ui: { ...defaultState().ui, ...(parsed.ui || {}) },
    };
  } catch (e) {
    console.warn("Storage corrupted, resetting", e);
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ============== HELPERS ============== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uid = () => "c_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const lang = (code) => LANGUAGES.find(l => l.code === code) || { code, name: code, flag: "🏳️" };
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + type;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function getBinderConfig() {
  if (state.binder.type === "custom") return state.binder.custom;
  return BINDER_PRESETS[state.binder.type] || BINDER_PRESETS.vaultx480;
}
function totalSlots(cfg) { return cfg.cols * cfg.rows * cfg.sheets * 2; }
function slotKey(page, side, slot) { return `${page}-${side}-${slot}`; }

/* ============== INIT ============== */
function init() {
  populateLanguages();
  bindHeader();
  bindTabs();
  bindCollection();
  bindWishlist();
  bindBinder();
  bindModal();
  bindPicker();

  renderAll();
}

function renderAll() {
  renderCounts();
  renderCollection();
  renderWishlist();
  renderBinder();
}

/* ============== LANGUAGE DROPDOWNS ============== */
function populateLanguages() {
  const targets = ["#cardLanguage", "#filterLanguage", "#filterLanguageWishlist"];
  for (const sel of targets) {
    const el = $(sel);
    if (!el) continue;
    const isFilter = sel.startsWith("#filter");
    const opts = LANGUAGES
      .map(l => `<option value="${l.code}">${l.flag} ${l.name}</option>`)
      .join("");
    if (isFilter) {
      el.innerHTML = `<option value="">Todos los idiomas</option>` + opts;
    } else {
      el.innerHTML = opts;
      el.value = "es";
    }
  }
}

/* ============== HEADER & TABS ============== */
function bindHeader() {
  $("#btnAddCard").addEventListener("click", () => openCardModal());
  $("#btnExport").addEventListener("click", exportJson);
  $("#btnImport").addEventListener("click", () => $("#fileImport").click());
  $("#fileImport").addEventListener("change", importJson);
}

function bindTabs() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${target}`));
    });
  });

  // Quick action shortcuts in empty states
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    if (a.dataset.action === "add-first") openCardModal();
    if (a.dataset.action === "add-wishlist") openCardModal({ list: "wishlist" });
  });
}

/* ============== COUNTS ============== */
function renderCounts() {
  $("#countCollection").textContent = state.cards.filter(c => c.list === "collection").length;
  $("#countWishlist").textContent  = state.cards.filter(c => c.list === "wishlist").length;
}

/* ============== COLLECTION VIEW ============== */
function bindCollection() {
  $("#searchCollection").addEventListener("input", renderCollection);
  $("#filterLanguage").addEventListener("change", renderCollection);
  $("#sortCollection").addEventListener("change", renderCollection);
}

function getCollectionFiltered() {
  const q = $("#searchCollection").value.trim().toLowerCase();
  const ln = $("#filterLanguage").value;
  const sort = $("#sortCollection").value;

  let list = state.cards.filter(c => c.list === "collection");
  if (q) {
    list = list.filter(c =>
      [c.name, c.set, c.number, c.rarity, c.notes]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }
  if (ln) list = list.filter(c => c.language === ln);

  list.sort((a, b) => {
    if (sort === "name")     return (a.name || "").localeCompare(b.name || "");
    if (sort === "set")      return (a.set || "").localeCompare(b.set || "");
    if (sort === "language") return (a.language || "").localeCompare(b.language || "");
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}

function renderCollection() {
  const list = getCollectionFiltered();
  const grid = $("#collectionGrid");
  const empty = $("#collectionEmpty");

  // Stats
  const all = state.cards.filter(c => c.list === "collection");
  const totalCards = all.reduce((s, c) => s + (c.quantity || 1), 0);
  const byLang = {};
  all.forEach(c => { byLang[c.language] = (byLang[c.language] || 0) + (c.quantity || 1); });
  const assigned = Object.keys(state.binder.slots).length;

  $("#collectionStats").innerHTML = `
    <div class="stat">Únicas: <b>${all.length}</b></div>
    <div class="stat">Total: <b>${totalCards}</b></div>
    <div class="stat">En binder: <b>${assigned}</b></div>
    <div class="stat">Idiomas: <b>${Object.keys(byLang).length}</b></div>
  `;

  if (all.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // build assigned set
  const assignedIds = new Set(Object.values(state.binder.slots));

  grid.innerHTML = list.map(c => cardTemplate(c, {
    isAssigned: assignedIds.has(c.id),
    actions: ["edit", "delete", assignedIds.has(c.id) ? "unassign" : null].filter(Boolean),
  })).join("");

  grid.querySelectorAll("[data-card-action]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = b.dataset.cardAction;
      const id = b.dataset.id;
      if (action === "edit") openCardModal({ editId: id });
      if (action === "delete") deleteCard(id);
      if (action === "unassign") unassignFromBinder(id);
    });
  });
}

function cardTemplate(c, { isAssigned, actions = [] } = {}) {
  const l = lang(c.language);
  const img = c.image
    ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.remove();this.parentNode.classList.add('no-img');" />`
    : "";
  const qty = (c.quantity || 1) > 1 ? `<span class="qty-badge">×${c.quantity}</span>` : "";
  const actBtns = [];
  if (actions.includes("edit"))     actBtns.push(`<button class="btn tiny" data-card-action="edit" data-id="${c.id}">Editar</button>`);
  if (actions.includes("move-coll")) actBtns.push(`<button class="btn tiny primary" data-card-action="move-coll" data-id="${c.id}">Ya la tengo</button>`);
  if (actions.includes("unassign"))  actBtns.push(`<button class="btn tiny" data-card-action="unassign" data-id="${c.id}" title="Sacar del binder">Sacar binder</button>`);
  if (actions.includes("delete"))   actBtns.push(`<button class="btn tiny" data-card-action="delete" data-id="${c.id}">Borrar</button>`);

  const meta = [c.set, c.number, c.condition].filter(Boolean).join(" · ");

  return `
    <div class="card ${isAssigned ? "assigned" : ""}">
      <div class="img-wrap">
        ${img}
        ${qty}
        <span class="lang-flag" title="${l.name}">${l.flag} ${l.code.toUpperCase()}</span>
        ${isAssigned ? `<span class="assigned-mark">EN BINDER</span>` : ""}
      </div>
      <div class="body">
        <div class="name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
        <div class="meta">${escapeHtml(meta || "—")}</div>
      </div>
      <div class="actions">${actBtns.join("")}</div>
    </div>
  `;
}

/* ============== WISHLIST ============== */
function bindWishlist() {
  $("#searchWishlist").addEventListener("input", renderWishlist);
  $("#filterLanguageWishlist").addEventListener("change", renderWishlist);
}

function renderWishlist() {
  const q = $("#searchWishlist").value.trim().toLowerCase();
  const ln = $("#filterLanguageWishlist").value;

  let list = state.cards.filter(c => c.list === "wishlist");
  if (q) {
    list = list.filter(c =>
      [c.name, c.set, c.number, c.rarity, c.notes]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }
  if (ln) list = list.filter(c => c.language === ln);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const grid = $("#wishlistGrid");
  const empty = $("#wishlistEmpty");
  const all = state.cards.filter(c => c.list === "wishlist");

  if (all.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list.map(c => cardTemplate(c, {
    actions: ["move-coll", "edit", "delete"],
  })).join("");

  grid.querySelectorAll("[data-card-action]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = b.dataset.cardAction;
      const id = b.dataset.id;
      if (action === "edit")      openCardModal({ editId: id });
      if (action === "delete")    deleteCard(id);
      if (action === "move-coll") moveToCollection(id);
    });
  });
}

function moveToCollection(id) {
  const c = state.cards.find(x => x.id === id);
  if (!c) return;
  c.list = "collection";
  saveState();
  renderAll();
  toast(`"${c.name}" movida a colección ✅`, "success");
}

/* ============== ADD / EDIT MODAL ============== */
function bindModal() {
  $$("[data-close-modal]").forEach(el => el.addEventListener("click", closeCardModal));
  $("#cardForm").addEventListener("submit", onSaveCard);
  // Click outside content closes
  $("#cardModal").addEventListener("click", (e) => {
    if (e.target.id === "cardModal") closeCardModal();
  });
}

function openCardModal({ editId = null, list = null } = {}) {
  const modal = $("#cardModal");
  const form = $("#cardForm");
  form.reset();
  $("#cardId").value = "";
  $("#cardLanguage").value = "es";
  $("#cardCondition").value = "NM";
  $("#cardQuantity").value = "1";
  document.querySelector('input[name="saveTarget"][value="collection"]').checked = true;

  if (editId) {
    const c = state.cards.find(x => x.id === editId);
    if (!c) return;
    $("#modalTitle").textContent = "Editar carta";
    $("#cardId").value = c.id;
    $("#cardName").value = c.name || "";
    $("#cardNumber").value = c.number || "";
    $("#cardSet").value = c.set || "";
    $("#cardRarity").value = c.rarity || "";
    $("#cardLanguage").value = c.language || "es";
    $("#cardCondition").value = c.condition || "NM";
    $("#cardQuantity").value = c.quantity || 1;
    $("#cardImage").value = c.image || "";
    $("#cardNotes").value = c.notes || "";
    document.querySelector(`input[name="saveTarget"][value="${c.list}"]`).checked = true;
  } else {
    $("#modalTitle").textContent = "Agregar carta";
    if (list) document.querySelector(`input[name="saveTarget"][value="${list}"]`).checked = true;
  }

  modal.hidden = false;
  setTimeout(() => $("#cardName").focus(), 50);
}

function closeCardModal() { $("#cardModal").hidden = true; }

function onSaveCard(e) {
  e.preventDefault();
  const id = $("#cardId").value;
  const data = {
    name:      $("#cardName").value.trim(),
    number:    $("#cardNumber").value.trim(),
    set:       $("#cardSet").value.trim(),
    rarity:    $("#cardRarity").value,
    language:  $("#cardLanguage").value,
    condition: $("#cardCondition").value,
    quantity:  parseInt($("#cardQuantity").value, 10) || 1,
    image:     $("#cardImage").value.trim(),
    notes:     $("#cardNotes").value.trim(),
    list:      document.querySelector('input[name="saveTarget"]:checked').value,
  };

  if (!data.name) { toast("El nombre es obligatorio", "error"); return; }

  if (id) {
    const c = state.cards.find(x => x.id === id);
    Object.assign(c, data);
    toast("Carta actualizada", "success");
  } else {
    state.cards.push({ id: uid(), createdAt: Date.now(), ...data });
    toast(`"${data.name}" agregada a ${data.list === "collection" ? "colección" : "búsquedas"} ✨`, "success");
  }
  saveState();
  closeCardModal();
  renderAll();
}

function deleteCard(id) {
  const c = state.cards.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`¿Eliminar "${c.name}"? No se puede deshacer.`)) return;
  state.cards = state.cards.filter(x => x.id !== id);
  // also remove from binder
  for (const k of Object.keys(state.binder.slots)) {
    if (state.binder.slots[k] === id) delete state.binder.slots[k];
  }
  saveState();
  renderAll();
  toast("Carta eliminada");
}

/* ============== BINDER ============== */
function bindBinder() {
  $("#binderType").value = state.binder.type;
  applyCustomVisibility();
  $("#customCols").value = state.binder.custom.cols;
  $("#customRows").value = state.binder.custom.rows;
  $("#customSheets").value = state.binder.custom.sheets;

  $("#binderType").addEventListener("change", () => {
    state.binder.type = $("#binderType").value;
    state.ui.page = 0;
    state.ui.side = "front";
    applyCustomVisibility();
    saveState();
    renderBinder();
  });
  ["#customCols", "#customRows", "#customSheets"].forEach(sel => {
    $(sel).addEventListener("change", () => {
      state.binder.custom = {
        cols: clamp(parseInt($("#customCols").value, 10), 2, 6),
        rows: clamp(parseInt($("#customRows").value, 10), 2, 6),
        sheets: clamp(parseInt($("#customSheets").value, 10), 1, 60),
      };
      $("#customCols").value = state.binder.custom.cols;
      $("#customRows").value = state.binder.custom.rows;
      $("#customSheets").value = state.binder.custom.sheets;
      state.ui.page = 0;
      state.ui.side = "front";
      saveState();
      renderBinder();
    });
  });

  $("#prevPage").addEventListener("click", () => navigatePage(-1));
  $("#nextPage").addEventListener("click", () => navigatePage(1));
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, isNaN(n) ? min : n)); }

function applyCustomVisibility() {
  $("#customConfig").hidden = state.binder.type !== "custom";
}

function navigatePage(dir) {
  const cfg = getBinderConfig();
  // ordering: sheet 1 front -> sheet 1 back -> sheet 2 front ...
  let idx = state.ui.page * 2 + (state.ui.side === "front" ? 0 : 1);
  idx = clamp(idx + dir, 0, cfg.sheets * 2 - 1);
  state.ui.page = Math.floor(idx / 2);
  state.ui.side = idx % 2 === 0 ? "front" : "back";
  saveState();
  renderBinder();
}

function renderBinder() {
  const cfg = getBinderConfig();
  const total = totalSlots(cfg);
  const filled = Object.keys(state.binder.slots).length;
  $("#binderStats").innerHTML = `<b>${filled}</b> / ${total} slots ocupados`;

  const sideLabel = state.ui.side === "front" ? "Frente" : "Reverso";
  $("#pageLabel").textContent = `Hoja ${state.ui.page + 1} / ${cfg.sheets} — ${sideLabel}`;

  const page = $("#binderPage");
  page.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
  page.style.gridTemplateRows = `repeat(${cfg.rows}, auto)`;

  const slotsPerSide = cfg.cols * cfg.rows;
  let html = "";
  for (let i = 0; i < slotsPerSide; i++) {
    const key = slotKey(state.ui.page, state.ui.side, i);
    const cardId = state.binder.slots[key];
    if (cardId) {
      const c = state.cards.find(x => x.id === cardId);
      if (c) {
        const l = lang(c.language);
        const img = c.image
          ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.parentNode.classList.add('fallback'); this.parentNode.innerHTML='${escapeHtml(c.name)}';" />`
          : `<div class="fallback-text">${escapeHtml(c.name)}</div>`;
        html += `
          <div class="binder-slot filled" data-key="${key}" title="${escapeHtml(c.name)} — ${l.name}">
            ${img}
            <span class="lang-tag">${l.flag} ${l.code.toUpperCase()}</span>
          </div>
        `;
      } else {
        // orphan: card was deleted
        delete state.binder.slots[key];
        html += emptySlotHtml(key);
      }
    } else {
      html += emptySlotHtml(key);
    }
  }
  page.innerHTML = html;

  page.querySelectorAll(".binder-slot").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.key;
      if (state.binder.slots[key]) {
        // unassign
        const id = state.binder.slots[key];
        const c = state.cards.find(x => x.id === id);
        if (confirm(`¿Sacar "${c?.name || "carta"}" del binder?`)) {
          delete state.binder.slots[key];
          saveState();
          renderAll();
        }
      } else {
        openPicker(key);
      }
    });
  });
}

function emptySlotHtml(key) {
  return `<div class="binder-slot" data-key="${key}"><div class="empty-mark">+</div></div>`;
}

function unassignFromBinder(cardId) {
  for (const k of Object.keys(state.binder.slots)) {
    if (state.binder.slots[k] === cardId) delete state.binder.slots[k];
  }
  saveState();
  renderAll();
  toast("Carta sacada del binder");
}

/* ============== PICKER MODAL ============== */
let pickerTargetKey = null;

function bindPicker() {
  $("[data-close-picker]").addEventListener("click", closePicker);
  $("#pickerModal").addEventListener("click", (e) => {
    if (e.target.id === "pickerModal") closePicker();
  });
  $("#pickerSearch").addEventListener("input", renderPicker);
}

function openPicker(targetKey) {
  pickerTargetKey = targetKey;
  $("#pickerSearch").value = "";
  $("#pickerModal").hidden = false;
  renderPicker();
}
function closePicker() { $("#pickerModal").hidden = true; pickerTargetKey = null; }

function renderPicker() {
  const q = $("#pickerSearch").value.trim().toLowerCase();
  const assigned = new Set(Object.values(state.binder.slots));
  let list = state.cards.filter(c => c.list === "collection" && !assigned.has(c.id));
  if (q) {
    list = list.filter(c =>
      [c.name, c.set, c.number].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const grid = $("#pickerGrid");
  const empty = $("#pickerEmpty");
  if (list.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list.map(c => cardTemplate(c, { actions: [] })).join("");
  grid.querySelectorAll(".card").forEach((el, i) => {
    el.addEventListener("click", () => {
      const card = list[i];
      if (!pickerTargetKey) return;
      state.binder.slots[pickerTargetKey] = card.id;
      saveState();
      closePicker();
      renderAll();
      toast(`"${card.name}" asignada al binder ✅`, "success");
    });
  });
}

/* ============== IMPORT / EXPORT ============== */
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pokemon-collection-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado", "success");
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.cards)) throw new Error("Formato inválido");
      if (!confirm(`Importar ${data.cards.length} cartas? Tu colección actual será reemplazada.`)) return;
      state = { ...defaultState(), ...data,
        binder: { ...defaultState().binder, ...(data.binder || {}) },
        ui: { ...defaultState().ui, ...(data.ui || {}) },
      };
      saveState();
      renderAll();
      toast("Importado correctamente ✅", "success");
    } catch (err) {
      toast("Error al importar: " + err.message, "error");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

/* ============== GO ============== */
document.addEventListener("DOMContentLoaded", init);
