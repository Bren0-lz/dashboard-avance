"use strict";

const body = document.body;
const userId = body.dataset.userId;

if (userId) {
  const eventKey = `avance.events.v2.${userId}`;
  const playedEventKey = `avance.events-played.v2.${userId}`;
  const reminderKey = `avance.reminder-30.v2.${userId}`;
  const pendingKey = "avance.pending-dashboard-sounds.v1";
  const handledKey = "avance.handled-sale.v1";
  const enabledKey = `avance.sounds-enabled.v2.${userId}`;
  const soundControl = document.querySelector("#sound-control");
  const isDashboard = window.location.pathname === "/";
  const isSalesPage =
    window.location.pathname === "/sales" ||
    window.location.pathname.startsWith("/sales/");
  const isSalesList =
    window.location.pathname === "/sales" &&
    new URLSearchParams(window.location.search).get("tab") !== "form";
  const soundFiles = {
    sale_created: "/assets/sounds/venda.mp3",
    ranking_overtake: "/assets/sounds/ultrapassagem.mp3",
    daily_goal_reached: "/assets/sounds/meta.mp3",
    reminder_30: "/assets/sounds/audio_30.mp3",
  };
  const soundPlaybackRules = {
    sale_created: { releaseAfterMs: 2000, stopAfterMs: 2000 },
    ranking_overtake: { releaseAfterMs: 1600 },
    daily_goal_reached: { releaseAfterMs: 30000, stopAfterMs: 30000 },
  };

  let lastId = 0;
  let audioContext;
  let soundBuffers = {};
  let soundBufferPromises = {};
  let soundsEnabled = false;
  let unlockPromise;
  let soundQueue = Promise.resolve();
  let soundQueueVersion = 0;
  let drainingPending = false;
  let reminderInFlightSlot = null;
  let isAudioLeader = !navigator.locks;
  let claimingAudioLeadership = false;
  let fallbackRefreshTimer;
  const refresh = () => {
    if (isSalesList) atualizarListaDeVendas().catch(() => window.location.reload());
    else window.location.reload();
  };
  const createRefreshCoordinator =
    window.DashboardRefreshCoordinator?.createRefreshCoordinator;
  const refreshCoordinator =
    typeof createRefreshCoordinator === "function"
      ? createRefreshCoordinator({
          pendingWork: () => ({
            promise: soundQueue,
            version: soundQueueVersion,
          }),
          refresh,
        })
      : {
          request() {
            clearTimeout(fallbackRefreshTimer);
            fallbackRefreshTimer = window.setTimeout(refresh, 300);
          },
        };

  const atualizarListaDeVendas = async () => {
    const response = await fetch(window.location.href, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Não foi possível atualizar a lista.");

    const documentoAtualizado = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    for (const seletor of [".sales-table", ".pagination"]) {
      const atual = document.querySelector(seletor);
      const atualizado = documentoAtualizado.querySelector(seletor);
      if (!atual || !atualizado)
        throw new Error(`Elemento ${seletor} não encontrado.`);
      atual.replaceWith(atualizado);
    }
  };

  const atualizarDadosDaVenda = () => {
    // Não interrompe quem está preenchendo ou editando uma venda. Na lista,
    // preservamos filtros e atualizamos somente os resultados e a paginação.
    if (!isDashboard && !isSalesList) return;
    refreshCoordinator.request();
  };

  const readJson = (storage, key) => {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const setSoundControl = (enabled) => {
    if (!soundControl) return;
    soundControl.textContent = enabled ? "Sons ativos" : "Ativar sons";
    soundControl.dataset.enabled = String(enabled);
    soundControl.setAttribute("aria-pressed", String(enabled));
  };

  const loadSound = (type) => {
    if (soundBuffers[type]) return Promise.resolve(soundBuffers[type]);
    if (soundBufferPromises[type]) return soundBufferPromises[type];
    const file = soundFiles[type];
    if (!file || !audioContext)
      return Promise.reject(new Error("Áudio indisponível."));
    soundBufferPromises[type] = fetch(file, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Falha ao carregar ${file}`);
        return response.arrayBuffer();
      })
      .then((data) => audioContext.decodeAudioData(data))
      .then((buffer) => {
        soundBuffers[type] = buffer;
        return buffer;
      })
      .catch((error) => {
        delete soundBufferPromises[type];
        throw error;
      });
    return soundBufferPromises[type];
  };

  const preloadSounds = () => {
    if (isSalesPage) loadSound("sale_created").catch(() => {});
    if (isDashboard) {
      for (const type of [
        "ranking_overtake",
        "daily_goal_reached",
        "reminder_30",
      ])
        loadSound(type).catch(() => {});
    }
  };

  const unlockAudio = () => {
    if (soundsEnabled && audioContext?.state === "running")
      return Promise.resolve(true);
    if (unlockPromise) return unlockPromise;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return Promise.resolve(false);
    if (!audioContext) audioContext = new AudioContext();
    unlockPromise = (async () => {
      try {
        await audioContext.resume();
        soundsEnabled = audioContext.state === "running";
        if (soundsEnabled) {
          localStorage.setItem(enabledKey, "1");
          preloadSounds();
        }
        setSoundControl(soundsEnabled);
        return soundsEnabled;
      } catch {
        soundsEnabled = false;
        setSoundControl(false);
        return false;
      } finally {
        unlockPromise = null;
      }
    })();
    return unlockPromise;
  };

  const playNow = async (type) => {
    const file = soundFiles[type];
    if (!file) return false;
    const rule = soundPlaybackRules[type] || {};
    let buffer = soundBuffers[type];
    if (soundsEnabled && audioContext?.state === "running" && !buffer) {
      try {
        buffer = await loadSound(type);
      } catch {}
    }

    return new Promise((resolve) => {
      let finished = false;
      const timers = [];
      const finish = (played) => {
        if (finished) return;
        finished = true;
        for (const timer of timers) clearTimeout(timer);
        resolve(played);
      };

      if (soundsEnabled && buffer && audioContext?.state === "running") {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.addEventListener("ended", () => finish(true), { once: true });
        source.start();
        if (rule.releaseAfterMs)
          timers.push(
            window.setTimeout(() => finish(true), rule.releaseAfterMs),
          );
        if (rule.stopAfterMs)
          window.setTimeout(() => {
            try {
              source.stop();
            } catch {}
          }, rule.stopAfterMs);
        timers.push(
          window.setTimeout(
            () => finish(true),
            Math.ceil(buffer.duration * 1000) + 1000,
          ),
        );
        return;
      }

      const audio = new Audio(file);
      audio.preload = "auto";
      audio.addEventListener("ended", () => finish(true), { once: true });
      audio.addEventListener("error", () => finish(false), { once: true });
      audio.play().catch(() => {
        setSoundControl(false);
        finish(false);
      });
      if (rule.releaseAfterMs)
        timers.push(window.setTimeout(() => finish(true), rule.releaseAfterMs));
      if (rule.stopAfterMs)
        window.setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, rule.stopAfterMs);
      timers.push(
        window.setTimeout(() => {
          audio.pause();
          finish(false);
        }, 60000),
      );
    });
  };

  const queueSound = (type, onStart) => {
    const task = soundQueue
      .catch(() => false)
      .then(async () => {
        if (typeof onStart === "function") onStart();
        return playNow(type);
      });
    soundQueue = task.then(
      () => undefined,
      () => undefined,
    );
    soundQueueVersion += 1;
    return task;
  };

  const createVictoryFlash = () => {
    const flash = document.createElement("div");
    flash.className = "ranking-victory-flash";
    flash.setAttribute("aria-hidden", "true");
    body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add("is-visible"));
    setTimeout(() => {
      flash.classList.remove("is-visible");
      setTimeout(() => flash.remove(), 450);
    }, 260);
  };

  const launchOvertakeFireworks = () => {
    if (typeof window.confetti !== "function") return;

    const duration = 3200;
    const animationEnd = Date.now() + duration;
    const randomInRange = (min, max) => Math.random() * (max - min) + min;
    const colors = ["#facc15", "#f97316", "#ef4444", "#ffffff", "#fde68a"];
    const fire = (options) =>
      window.confetti({ zIndex: 9999, colors, ...options });

    createVictoryFlash();
    fire({
      particleCount: 140,
      spread: 90,
      startVelocity: 42,
      scalar: 1.25,
      ticks: 140,
      origin: { x: 0.5, y: 0.95 },
    });
    fire({
      particleCount: 90,
      angle: 60,
      spread: 70,
      startVelocity: 38,
      scalar: 1.1,
      ticks: 120,
      origin: { x: 0, y: 0.75 },
    });
    fire({
      particleCount: 90,
      angle: 120,
      spread: 70,
      startVelocity: 38,
      scalar: 1.1,
      ticks: 120,
      origin: { x: 1, y: 0.75 },
    });

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = Math.max(
        20,
        Math.round(50 * (timeLeft / duration)),
      );
      fire({
        particleCount,
        angle: randomInRange(50, 75),
        spread: randomInRange(60, 90),
        startVelocity: randomInRange(28, 42),
        scalar: randomInRange(0.95, 1.2),
        ticks: 110,
        origin: { x: 0, y: randomInRange(0.45, 0.85) },
      });
      fire({
        particleCount,
        angle: randomInRange(105, 130),
        spread: randomInRange(60, 90),
        startVelocity: randomInRange(28, 42),
        scalar: randomInRange(0.95, 1.2),
        ticks: 110,
        origin: { x: 1, y: randomInRange(0.45, 0.85) },
      });
      fire({
        particleCount: Math.round(particleCount * 0.7),
        spread: randomInRange(75, 105),
        startVelocity: randomInRange(24, 34),
        scalar: 1,
        ticks: 100,
        origin: { x: randomInRange(0.25, 0.75), y: 0.95 },
      });
    }, 260);
  };

  const celebrate = (type) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (type === "ranking_overtake") {
      launchOvertakeFireworks();
      return;
    }
    body.classList.add("celebrate");
    setTimeout(() => body.classList.remove("celebrate"), 1200);
  };

  const handledSaleId = () => {
    const handled = readJson(sessionStorage, handledKey);
    if (
      !handled ||
      Date.now() - Number(handled.createdAt || 0) > 10 * 60 * 1000
    ) {
      sessionStorage.removeItem(handledKey);
      return null;
    }
    return Number(handled.saleId);
  };

  const originatedByActiveLocalFlow = (payload) => {
    const key = `avance.local-sale-flow.v1.${userId}`;
    const flow = readJson(localStorage, key);
    if (!flow || Date.now() - Number(flow.startedAt || 0) > 2 * 60 * 1000) {
      localStorage.removeItem(key);
      return false;
    }
    return Number(payload?.createdBy) === Number(userId);
  };

  const claimAudioLeadership = () => {
    if (
      !isDashboard ||
      !navigator.locks ||
      isAudioLeader ||
      claimingAudioLeadership
    )
      return;
    claimingAudioLeadership = true;
    navigator.locks
      .request(
        `avance-audio-leader-${userId}`,
        { ifAvailable: true },
        (lock) => {
          claimingAudioLeadership = false;
          if (!lock) return undefined;
          isAudioLeader = true;
          return new Promise((resolve) =>
            window.addEventListener("pagehide", resolve, { once: true }),
          );
        },
      )
      .catch(() => {
        claimingAudioLeadership = false;
      });
  };

  const consume = (event) => {
    const id = Number(event.lastEventId);
    if (!id || id <= lastId) return;
    lastId = id;
    localStorage.setItem(eventKey, String(id));
    let payload = event.payload;
    if (typeof payload === "string")
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    if (!payload && event.data)
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }
    if (event.type === "sale_created") atualizarDadosDaVenda();
    if (Number(payload?.saleId) === handledSaleId()) return;
    if (originatedByActiveLocalFlow(payload)) return;
    if (event.type === "ranking_overtake" && !isDashboard) return;
    if (!isAudioLeader) return;
    const globallyPlayedId = Number(localStorage.getItem(playedEventKey) || 0);
    if (id <= globallyPlayedId) return;
    localStorage.setItem(playedEventKey, String(id));
    queueSound(
      event.type,
      event.type === "sale_created" ? null : () => celebrate(event.type),
    );
  };

  const drainPendingDashboardSounds = async () => {
    if (!isDashboard || drainingPending) return;
    const pending = readJson(sessionStorage, pendingKey);
    if (!pending?.sounds?.length) return;
    drainingPending = true;
    try {
      if (!pending.celebrated) {
        for (const type of pending.sounds) celebrate(type);
        pending.celebrated = true;
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      await unlockAudio();
      while (pending.sounds.length) {
        const type = pending.sounds[0];
        const played = await queueSound(type);
        if (!played) return;
        pending.sounds.shift();
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      sessionStorage.removeItem(pendingKey);
    } finally {
      drainingPending = false;
    }
  };

  const activateSounds = async () => {
    if (await unlockAudio()) {
      drainPendingDashboardSounds();
      playHalfHourReminder();
    }
  };

  setSoundControl(false);
  document.addEventListener("pointerdown", activateSounds, { once: true });
  document.addEventListener("keydown", activateSounds, { once: true });
  soundControl?.addEventListener("click", activateSounds);
  window.AvanceAudio = { unlock: unlockAudio, play: queueSound };

  const localBusinessTime = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: body.dataset.timezone || "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts();
    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
  };

  async function playHalfHourReminder() {
    if (!isDashboard || !isAudioLeader || !soundsEnabled) return;
    const time = localBusinessTime();
    const hour = Number(time.hour);
    const minute = Number(time.minute);
    const withinMorning =
      hour >= 9 && (hour < 11 || (hour === 11 && minute <= 30));
    const withinAfternoon =
      (hour === 13 && minute >= 30) ||
      (hour >= 14 && hour < 17) ||
      (hour === 17 && minute === 0);
    if ((minute !== 0 && minute !== 30) || (!withinMorning && !withinAfternoon))
      return;
    const slot = `${time.year}-${time.month}-${time.day}-${hour}-${minute}`;
    if (
      localStorage.getItem(reminderKey) === slot ||
      reminderInFlightSlot === slot
    )
      return;
    reminderInFlightSlot = slot;
    try {
      if (await queueSound("reminder_30"))
        localStorage.setItem(reminderKey, slot);
    } finally {
      if (reminderInFlightSlot === slot) reminderInFlightSlot = null;
    }
  }

  claimAudioLeadership();
  window.setInterval(claimAudioLeadership, 5000);
  window.setInterval(playHalfHourReminder, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") playHalfHourReminder();
  });
  if (localStorage.getItem(enabledKey) === "1") activateSounds();
  drainPendingDashboardSounds();

  let polling = false;
  const poll = async () => {
    try {
      const response = await fetch(
        `/api/v1/dashboard/events/poll?after=${lastId}`,
        { credentials: "same-origin" },
      );
      const json = await response.json();
      for (const row of json.data || [])
        consume({
          lastEventId: String(row.id),
          type: row.type,
          payload: row.payload,
        });
    } catch {}
    if (polling) setTimeout(poll, 5000);
  };

  const startLiveEvents = async () => {
    if (!isDashboard && !isSalesList) return;
    try {
      const response = await fetch("/api/v1/dashboard/events/cursor", {
        credentials: "same-origin",
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error("Cursor indisponível");
      lastId = Number(json.data?.lastId || 0);
      localStorage.setItem(eventKey, String(lastId));
    } catch {
      window.setTimeout(startLiveEvents, 5000);
      return;
    }

    if (window.EventSource) {
      const source = new EventSource(
        `/api/v1/dashboard/events?after=${lastId}`,
      );
      for (const type of [
        "sale_created",
        "ranking_overtake",
        "daily_goal_reached",
      ])
        source.addEventListener(type, consume);
      source.onerror = () => {
        source.close();
        polling = true;
        poll();
      };
    } else {
      polling = true;
      poll();
    }
  };

  startLiveEvents();
}
