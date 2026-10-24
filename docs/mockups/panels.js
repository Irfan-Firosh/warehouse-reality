// Collapsible panels. A panel is [data-collapsible="name"] with a [data-body]
// (hidden when closed) and optionally a [data-rail] (shown only when closed).
// Every [data-collapse="name"] button toggles it. Side panels also set
// #layout[data-left|data-right] so the grid gives the scene their width.
// A [data-tab] click (bus "tab") opens the inspector so the tab is visible.
// Until the user toggles it, a [data-compact] overlay starts closed while the
// scene is narrower than COMPACT_BELOW, so the overlays do not cover each other.
import { bus } from "./ui.js";

const STORE_KEY = "ws-mockup-panels";
const COMPACT_BELOW = 700;
const scene = document.getElementById("scene");
const PANELS = new Set(
  [...document.querySelectorAll("[data-collapsible]")].map(
    (p) => p.dataset.collapsible,
  ),
);

// Keep only known panel names with boolean values from whatever was stored.
const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    return Object.fromEntries(
      Object.entries(saved ?? {}).filter(
        ([name, open]) => PANELS.has(name) && typeof open === "boolean",
      ),
    );
  } catch (err) {
    console.warn("Panel state not restored; using defaults", err);
    return {};
  }
};
const saveState = (state) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Panel state not saved", err);
  }
};

let state = loadState();
const layout = document.getElementById("layout");
const panelOf = (name) =>
  document.querySelector(`[data-collapsible="${name}"]`);
const buttonsOf = (name) =>
  document.querySelectorAll(`[data-collapse="${name}"]`);

const apply = (name, open) => {
  const panel = panelOf(name);
  panel.dataset.state = open ? "open" : "closed";
  for (const b of buttonsOf(name))
    b.setAttribute("aria-expanded", String(open));
  if (panel.dataset.layout)
    layout.dataset[panel.dataset.layout] = open ? "open" : "closed";
};

// The clicked button may be hidden by the toggle; keep focus on its visible twin.
const focusVisibleButton = (name) =>
  [...buttonsOf(name)].find((b) => b.offsetParent !== null)?.focus();

const setOpen = (name, open) => {
  state = { ...state, [name]: open };
  apply(name, open);
  saveState(state);
};

const toggle = (name) => {
  setOpen(name, panelOf(name).dataset.state !== "open");
  focusVisibleButton(name);
};

const defaultOpen = (name) =>
  !(panelOf(name).hasAttribute("data-compact") &&
    scene.clientWidth < COMPACT_BELOW);
const applyAll = () => {
  for (const name of PANELS) apply(name, state[name] ?? defaultOpen(name));
};

applyAll();
new ResizeObserver(applyAll).observe(scene);
bus.addEventListener("tab", () => setOpen("right", true));
document.addEventListener("click", (ev) => {
  const btn =
    ev.target instanceof Element ? ev.target.closest("[data-collapse]") : null;
  if (btn) toggle(btn.dataset.collapse);
});
