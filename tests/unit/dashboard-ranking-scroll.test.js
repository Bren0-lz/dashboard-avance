"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "../../src/public/assets/js/dashboard.js"),
  "utf8",
);

function rankingHarness({ maxScroll = 60, desktop = true, reduced = false } = {}) {
  let now = 0;
  const frames = [];
  const listeners = new Map();
  const controlListeners = new Map();
  const reducedListeners = new Map();
  const button = {
    hidden: true,
    textContent: "Pausar",
    attributes: {},
    addEventListener(type, listener) { controlListeners.set(type, listener); },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const scroll = {
    scrollHeight: 240 + maxScroll,
    clientHeight: 240,
    scrollTop: 0,
    addEventListener(type, listener) { listeners.set(type, listener); },
    contains(node) { return node === this || node === button; },
  };
  const reducedQuery = {
    matches: reduced,
    addEventListener(type, listener) { reducedListeners.set(type, listener); },
  };
  const document = {
    activeElement: null,
    visibilityState: "visible",
    querySelector(selector) {
      if (selector === ".ranking-scroll") return scroll;
      if (selector === "#ranking-motion-control") return button;
      return null;
    },
    querySelectorAll() { return []; },
  };
  const window = {
    matchMedia(query) {
      return query.includes("reduced-motion")
        ? reducedQuery
        : { matches: desktop };
    },
    requestAnimationFrame(callback) { frames.push(callback); },
  };
  vm.runInNewContext(script, {
    document,
    window,
    performance: { now: () => now },
  });

  return {
    button,
    scroll,
    document,
    reducedQuery,
    stepTo(end) {
      while (now < end || (now === 0 && frames.length)) {
        const next = now === 0 ? 0 : Math.min(now + 50, end);
        if (next === now && now !== 0) break;
        now = next;
        frames.shift()(now);
        if (now === end) break;
        if (now === 0) now = 0.001;
      }
    },
    emit(type, target = scroll) { listeners.get(type)?.({ target }); },
    click() { controlListeners.get("click")(); },
    changeMotion() { reducedListeners.get("change")(); },
  };
}

test("ranking moves slowly, pauses at each edge, then reverses", () => {
  const view = rankingHarness({ maxScroll: 30 });
  view.stepTo(1000);
  assert.equal(view.scroll.scrollTop, 0);
  assert.equal(view.button.hidden, false);
  view.stepTo(4000);
  assert.ok(view.scroll.scrollTop >= 11 && view.scroll.scrollTop <= 13);
  view.stepTo(7000);
  assert.equal(view.scroll.scrollTop, 30);
  view.stepTo(8000);
  assert.equal(view.scroll.scrollTop, 30);
  view.stepTo(9500);
  assert.ok(view.scroll.scrollTop < 30);
});

test("manual input and pointer interaction pause motion; control can stop and resume it", () => {
  const view = rankingHarness({ maxScroll: 300 });
  view.stepTo(4000);
  const before = view.scroll.scrollTop;
  view.emit("wheel");
  view.stepTo(10000);
  assert.equal(view.scroll.scrollTop, before);
  view.stepTo(15000);
  assert.ok(view.scroll.scrollTop > before);
  view.emit("pointermove", {});
  const hovered = view.scroll.scrollTop;
  view.stepTo(16000);
  assert.equal(view.scroll.scrollTop, hovered);
  view.emit("pointerleave");
  view.click();
  assert.equal(view.button.textContent, "Retomar");
  assert.equal(view.button.attributes["aria-pressed"], "true");
  view.stepTo(17000);
  assert.equal(view.scroll.scrollTop, hovered);
  view.click();
  view.stepTo(18000);
  assert.ok(view.scroll.scrollTop > hovered);
});

test("keyboard focus and hidden tabs stop movement until interaction ends", () => {
  const view = rankingHarness({ maxScroll: 300 });
  view.stepTo(4000);
  const before = view.scroll.scrollTop;
  view.document.activeElement = view.scroll;
  view.emit("keydown");
  view.stepTo(12000);
  assert.equal(view.scroll.scrollTop, before);
  view.document.activeElement = null;
  view.document.visibilityState = "hidden";
  view.stepTo(16000);
  assert.equal(view.scroll.scrollTop, before);
  view.document.visibilityState = "visible";
  view.stepTo(17000);
  assert.ok(view.scroll.scrollTop > before);
});

test("reduced motion starts paused, and a ranking without overflow stays still", () => {
  const reducedView = rankingHarness({ reduced: true });
  reducedView.stepTo(5000);
  assert.equal(reducedView.scroll.scrollTop, 0);
  assert.equal(reducedView.button.textContent, "Retomar");
  reducedView.click();
  reducedView.stepTo(6000);
  assert.ok(reducedView.scroll.scrollTop > 0);
  reducedView.reducedQuery.matches = true;
  reducedView.changeMotion();
  const before = reducedView.scroll.scrollTop;
  reducedView.stepTo(7000);
  assert.equal(reducedView.scroll.scrollTop, before);

  const emptyView = rankingHarness({ maxScroll: 0 });
  emptyView.stepTo(6000);
  assert.equal(emptyView.button.hidden, true);
  assert.equal(emptyView.scroll.scrollTop, 0);

  const mobileView = rankingHarness({ desktop: false });
  mobileView.stepTo(6000);
  assert.equal(mobileView.button.hidden, true);
  assert.equal(mobileView.scroll.scrollTop, 0);
});
