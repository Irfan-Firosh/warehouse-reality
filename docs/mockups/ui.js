// Mockup UI wiring that works without WebGL: tabs, panel counts, the
// dependency list, the entity table and the shared selection.
import {
  COUNTS,
  DEPENDENCIES,
  ENTITIES,
  KIND_LABEL,
  MOVING_TRAILER,
  STATE,
  statusText,
} from "./scene-data.js";

export const bus = new EventTarget();
let ui = { selected: null, view: "run", filter: "doors", sceneDown: false };
export const getSelected = () => ui.selected;
export const getView = () => ui.view;

const $ = (sel) => document.querySelector(sel);
const emit = (type, detail) =>
  bus.dispatchEvent(new CustomEvent(type, { detail }));

const TABLE_GROUPS = {
  doors: () => [...STATE.doors, ...STATE.ramps],
  stalls: () => STATE.stalls,
  trailers: () => STATE.trailers,
  equipment: () => [...STATE.tractors, ...STATE.forklifts],
};
const GROUP_OF_KIND = {
  door: "doors",
  ramp: "doors",
  stall: "stalls",
  trailer: "trailers",
  tractor: "equipment",
  forklift: "equipment",
};

const selectButton = (id) =>
  `<button type="button" class="link" data-select="${id}">${id}</button>`;

// Tabs
const showTab = (name) => {
  for (const b of document.querySelectorAll('[role="tab"]'))
    b.setAttribute("aria-selected", String(b.dataset.tab === name));
  for (const p of document.querySelectorAll("[data-panel]"))
    p.hidden = p.dataset.panel !== name;
};

// Counts derived from the same records the scene draws
const renderCounts = () => {
  for (const el of document.querySelectorAll("[data-count]"))
    el.textContent = String(COUNTS[el.dataset.count]);
};

const renderDependencies = () => {
  $("#deps").innerHTML = DEPENDENCIES.map(
    (d) =>
      `<li>${selectButton(d.door)} ${selectButton(d.trailer)} needs ${d.shipment} · ${
        d.heldBy ? `held by ${selectButton(d.heldBy)}: ` : ""
      }${d.reason}</li>`,
  ).join("");
};

// Entity table
const renderTable = () => {
  for (const b of document.querySelectorAll("[data-filter]"))
    b.setAttribute("aria-pressed", String(b.dataset.filter === ui.filter));
  const rows = TABLE_GROUPS[ui.filter]();
  $("#ent-count").textContent = `${rows.length} rows`;
  $("#ent-rows").innerHTML = rows
    .map(
      (e) =>
        `<tr data-row="${e.id}" class="${e.id === ui.selected ? "row-on" : ""}"><td>${selectButton(e.id)}</td><td>${statusText(e, ui.view)}</td></tr>`,
    )
    .join("");
};

const syncTableToSelection = () => {
  const entity = ENTITIES.get(ui.selected);
  if (entity) ui = { ...ui, filter: GROUP_OF_KIND[entity.kind] };
  renderTable();
  document
    .querySelector(`[data-row="${ui.selected}"]`)
    ?.scrollIntoView({ block: "nearest" });
};

// Selection readout (scene overlay); status always appears in text, and the
// one-line summary stays visible and announced when the readout is collapsed.
const RELATED = {
  [MOVING_TRAILER]:
    '<button type="button" class="link" data-tab="agent">Agent DRV-047</button> · <button type="button" class="link" data-tab="commitment">C-88</button>',
};
const relatedIds = (e) =>
  [e.trailer, ENTITIES.has(e.at) ? e.at : null].filter(Boolean);

const renderReadout = () => {
  const e = ENTITIES.get(ui.selected);
  $("#sel").innerHTML = e
    ? `<div class="flex items-baseline justify-between gap-2"><b class="num">${e.id}</b><span class="muted">${KIND_LABEL[e.kind]}</span></div>
       <div>${statusText(e, ui.view)}</div>
       <div class="muted">${[...relatedIds(e).map(selectButton), RELATED[e.id]].filter(Boolean).join(" · ")}</div>`
    : '<span class="muted">Nothing selected. Click the scene or a table row.</span>';
  const summary = e
    ? `${e.id} · ${statusText(e, ui.view)}`
    : "Nothing selected";
  $("#sel-sum").textContent = summary;
  $("#sel-live").textContent = summary;
};

export const selectEntity = (id) => {
  ui = { ...ui, selected: ENTITIES.has(id) ? id : null };
  renderReadout();
  syncTableToSelection();
  emit("select", ui.selected);
};

const toggleView = () => {
  ui = { ...ui, view: ui.view === "run" ? "observed" : "run" };
  const observed = ui.view === "observed";
  $("#occ").textContent = observed
    ? "Occupancy: DFW observed"
    : "Occupancy: run state";
  $("#occ-note").hidden = !observed;
  $("#deco-key").hidden = observed || ui.sceneDown;
  renderReadout();
  renderTable();
  emit("view", ui.view);
};

// Scene failure: show the reason where the canvas was and disable its buttons
const SCENE_BUTTONS = ["roof", "mesh", "focus", "reset"];
export const sceneFailed = (reason) => {
  ui = { ...ui, sceneDown: true };
  const note = $("#scene-fallback");
  note.textContent = `3D scene unavailable: ${reason}. The Entities tab lists the same doors, stalls, trailers and equipment as text.`;
  note.hidden = false;
  for (const id of SCENE_BUTTONS) $(`#${id}`).disabled = true;
  $("#mesh").textContent = "Meshes: scene unavailable";
  $("#model-credit").hidden = true;
  $("#deco-key").hidden = true;
};

const toggleTheme = () => {
  document.documentElement.classList.toggle("dark");
  emit("theme");
};

document.addEventListener("click", (ev) => {
  const target = ev.target instanceof Element ? ev.target : null;
  const sel = target?.closest("[data-select]");
  const tab = target?.closest("[data-tab]");
  const filter = target?.closest("[data-filter]");
  if (sel) selectEntity(sel.dataset.select);
  if (tab) {
    showTab(tab.dataset.tab);
    emit("tab", tab.dataset.tab);
  }
  if (filter) {
    ui = { ...ui, filter: filter.dataset.filter };
    renderTable();
  }
});
$("#theme").addEventListener("click", toggleTheme);
$("#occ").addEventListener("click", toggleView);

renderCounts();
renderDependencies();
showTab("agent");
selectEntity(MOVING_TRAILER);
