/**
 * VESSEL CONSOLE — core app logic.
 * Reads VESSEL_MANIFEST (js/data.js) and draws everything. Hero panels
 * (point cloud / gesture demo / sim core) are lazy-loaded on demand from
 * js/panels/*.js — see the `window.VesselPanels.*` calls below.
 */

(function () {
  "use strict";

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CATEGORY_ORDER = ["NAV", "PERCEPTION", "CRYPTO", "OPS", "SIM"];
  const CATEGORY_LABEL = {
    NAV: "NAV — NAVIGATION",
    PERCEPTION: "PERCEPTION",
    CRYPTO: "CRYPTO / SEC",
    OPS: "OPS — CARGO / MANIFEST",
    SIM: "SIMULATION",
  };

  // A system counts as "repaired" once it's been opened (or, for the locked
  // CRYPTO archive, decrypted). Hull integrity is just (repaired / total) —
  // it's a literal readout of how much of the portfolio has been explored.
  const repairedIds = new Set();
  let fullyRecoveredShown = false;

  // ---------------- Boot sequence ----------------

  const BOOT_LINES = [
    { text: "M/V KALYANI — RECOVERED SYSTEMS LOG", cls: "ok" },
    { text: "" },
    { text: "INITIALIZING VESSEL CORE..." },
    { text: "LIFE SUPPORT: OFFLINE", cls: "err" },
    { text: "AUTONOMY CORE: DEGRADED", cls: "warn" },
    { text: "HULL INTEGRITY: SCANNING..." },
    { text: "NO CREW ABOARD. NAVIGATION CONTINUING." , cls: "warn"},
    { text: "MOUNTING SYSTEM MANIFEST..." },
    { text: `${(typeof VESSEL_MANIFEST !== "undefined" ? VESSEL_MANIFEST.length : 0)} RECORDS FOUND` },
    { text: "" },
    { text: "CONSOLE READY.", cls: "ok" },
  ];

  function runBoot() {
    const bootLog = document.getElementById("boot-log");
    const bootScreen = document.getElementById("boot-screen");
    const consoleEl = document.getElementById("console");
    const skipBtn = document.getElementById("skip-boot");

    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      bootScreen.classList.add("hidden");
      consoleEl.classList.remove("hidden");
      initConsole();
    }

    skipBtn.addEventListener("click", finish);

    if (REDUCED_MOTION) {
      bootLog.textContent = BOOT_LINES.map((l) => l.text).join("\n");
      setTimeout(finish, 400);
      return;
    }

    let lineIndex = 0;
    function nextLine() {
      if (lineIndex >= BOOT_LINES.length) {
        setTimeout(finish, 500);
        return;
      }
      const line = BOOT_LINES[lineIndex];
      const span = document.createElement("div");
      if (line.cls) span.className = line.cls;
      bootLog.appendChild(span);

      let charIndex = 0;
      const speed = line.text.length > 0 ? 14 : 0;

      function typeChar() {
        if (charIndex >= line.text.length) {
          lineIndex++;
          setTimeout(nextLine, 90);
          return;
        }
        span.textContent += line.text[charIndex];
        charIndex++;
        setTimeout(typeChar, speed);
      }
      typeChar();
    }
    nextLine();
  }

  // ---------------- Hull integrity ----------------
  // The ship starts broken. Every system you open gets rebooted and adds its
  // share back — hull integrity is just (repaired / total) * 100. Decrypting
  // CRYPTO counts too, but only once it's actually unlocked, not just glanced
  // at. Get through everything and the ship comes fully back online.

  function getEffectiveStatus(project) {
    if (project.status === "LOCKED" && repairedIds.has(project.id)) return "RECOVERED";
    return project.status;
  }

  function computeHullIntegrity() {
    return Math.round((repairedIds.size / VESSEL_MANIFEST.length) * 100);
  }

  function markRepaired(id) {
    if (repairedIds.has(id)) return;
    repairedIds.add(id);
    buildSidebar();
    renderHullIntegrity();
    if (repairedIds.size === VESSEL_MANIFEST.length) {
      setTimeout(triggerFullRecovery, 850);
    }
  }

  let displayedHull = null;
  let hullAnimRaf = null;

  function renderHullIntegrity() {
    const el = document.getElementById("hull-integrity");
    if (!el) return;
    const target = computeHullIntegrity();
    el.classList.toggle("value-complete", target >= 100);

    if (displayedHull === null || REDUCED_MOTION) {
      displayedHull = target;
      el.textContent = target + "%";
      return;
    }
    if (displayedHull === target) return;

    el.classList.add("value-shifting");
    cancelAnimationFrame(hullAnimRaf);
    const start = displayedHull;
    const startTime = performance.now();
    const duration = 700;

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current + "%";
      if (t < 1) {
        hullAnimRaf = requestAnimationFrame(step);
      } else {
        displayedHull = target;
        el.classList.remove("value-shifting");
      }
    }
    hullAnimRaf = requestAnimationFrame(step);
  }

  function startHullJitter() {
    if (REDUCED_MOTION) return;
    setInterval(() => {
      const el = document.getElementById("hull-integrity");
      if (!el || el.classList.contains("value-shifting")) return;
      const base = computeHullIntegrity();
      if (base >= 100) return; // stable once fully repaired — no more noise
      const jitter = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      if (jitter === 0) return;
      el.textContent = (base + jitter) + "%";
      el.classList.add("value-jitter");
      setTimeout(() => {
        el.textContent = base + "%";
        el.classList.remove("value-jitter");
      }, 260);
    }, 3800);
  }

  // ---------------- Full recovery ----------------

  function playRecoveryChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [392, 523.25, 659.25, 784]; // G4 - C5 - E5 - G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.14;
        gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch (e) {
      // Audio isn't essential — fail silently (autoplay policies, etc.)
    }
  }

  // Number of "system light" dots scattered across the power-surge scene —
  // no particular meaning to the count, just enough to read as a control
  // panel waking up rather than a couple of stray dots.
  const SURGE_LIGHT_COUNT = 42;
  const SURGE_SWEEP_DURATION = 1.5; // seconds — must match the CSS surge-sweep animation

  function buildSurgeLights() {
    const host = document.getElementById("surge-lights");
    host.innerHTML = "";
    for (let i = 0; i < SURGE_LIGHT_COUNT; i++) {
      const dot = document.createElement("div");
      dot.className = "surge-light";
      const leftPct = Math.random() * 100;
      const topPct = 10 + Math.random() * 80;
      dot.style.left = leftPct + "%";
      dot.style.top = topPct + "%";
      // Delay each light so it switches on roughly when the sweep bar
      // passes its horizontal position, plus a little jitter so it doesn't
      // look mechanically uniform.
      const delay = (leftPct / 100) * SURGE_SWEEP_DURATION + Math.random() * 0.25;
      dot.style.setProperty("--delay", delay.toFixed(2) + "s");
      host.appendChild(dot);
    }
  }

  function triggerFullRecovery() {
    if (fullyRecoveredShown) return;
    fullyRecoveredShown = true;
    document.body.classList.add("recovered");
    playRecoveryChime();
    document.getElementById("recovery-scene").classList.remove("hidden");

    const message = document.getElementById("recovery-message");
    const surge = document.getElementById("power-surge");
    buildSurgeLights();

    // Kick the CSS animations off on the next frame so the "active" class
    // addition itself triggers them (adding it in the same tick the
    // element becomes visible can get coalesced and skip the animation).
    requestAnimationFrame(() => surge.classList.add("active"));

    // The message fades in once the surge has had time to play out (or
    // right away under reduced motion, where the surge animations are
    // disabled via CSS and there's nothing to wait for).
    setTimeout(
      () => message.classList.add("visible"),
      REDUCED_MOTION ? 200 : 2600
    );
  }

  // ---------------- Clock ----------------

  function tickClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const now = new Date();
    el.textContent = now.toTimeString().slice(0, 8) + " UTC" + (-now.getTimezoneOffset() / 60 >= 0 ? "+" : "") + (-now.getTimezoneOffset() / 60);
  }

  // ---------------- Sidebar ----------------

  function buildSidebar() {
    const list = document.getElementById("system-list");
    list.innerHTML = "";

    CATEGORY_ORDER.forEach((cat) => {
      const projects = VESSEL_MANIFEST.filter((p) => p.category === cat);
      if (projects.length === 0) return;

      const group = document.createElement("div");
      group.className = "system-group";

      const label = document.createElement("div");
      label.className = "system-group-label";
      label.textContent = CATEGORY_LABEL[cat] || cat;
      group.appendChild(label);

      projects.forEach((p) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "project-row";
        row.dataset.id = p.id;
        const effStatus = getEffectiveStatus(p);
        row.innerHTML = `
          <span class="name">${escapeHtml(p.designation)}</span>
          <span class="status-dot ${effStatus}" title="${effStatus}"></span>
        `;
        row.addEventListener("click", () => selectProject(p.id));
        group.appendChild(row);
      });

      list.appendChild(group);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- Panel rendering ----------------

  let currentProjectId = null;

  function highlightActiveRow() {
    document.querySelectorAll(".project-row").forEach((row) => {
      row.classList.toggle("active", row.dataset.id === currentProjectId);
    });
  }

  function selectProject(id) {
    currentProjectId = id;
    const project = VESSEL_MANIFEST.find((p) => p.id === id);
    if (!project) return;
    renderPanel(project); // may rebuild the sidebar via markRepaired()
    highlightActiveRow(); // ...so (re)apply the active state last
  }

  function renderPanel(project) {
    const viewport = document.getElementById("panel-viewport");
    viewport.innerHTML = "";

    const panel = document.createElement("article");
    panel.className = "panel";

    const effStatus = getEffectiveStatus(project);
    const isLocked = effStatus === "LOCKED";

    if (!isLocked) {
      markRepaired(project.id);
    }

    const header = document.createElement("div");
    header.className = "panel-header";
    header.innerHTML = `
      <h2>${escapeHtml(project.designation)}</h2>
      <span class="status-badge ${effStatus}">${effStatus}</span>
    `;
    panel.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "panel-meta";
    meta.textContent = `${project.period} · ${project.affiliation}`;
    panel.appendChild(meta);

    if (isLocked) {
      const gate = document.createElement("div");
      gate.className = "lock-gate";
      gate.innerHTML = `
        <div class="scramble" id="scramble-${project.id}">ARCHIVE ENCRYPTED — AUTHORIZATION REQUIRED</div>
        <button class="decrypt-btn" type="button" id="decrypt-${project.id}">DECRYPT ARCHIVE</button>
      `;
      panel.appendChild(gate);
      viewport.appendChild(panel);

      document.getElementById(`decrypt-${project.id}`).addEventListener("click", () => {
        markRepaired(project.id);
        selectProject(project.id);
      });
      return;
    }

    const summary = document.createElement("p");
    summary.className = "panel-summary";
    summary.textContent = project.summary;
    panel.appendChild(summary);

    if (project.hero) {
      const heroSlot = document.createElement("div");
      heroSlot.className = "hero-slot";
      heroSlot.innerHTML = `<div class="hero-loading">BOOTING SUBSYSTEM...</div>`;
      panel.appendChild(heroSlot);
      viewport.appendChild(panel);
      appendLogAndRest(panel, project);
      mountHero(project, heroSlot);
      return;
    }

    viewport.appendChild(panel);
    appendLogAndRest(panel, project);
  }

  function appendLogAndRest(panel, project) {
    const log = document.createElement("div");
    log.className = "panel-log";
    project.logLines.forEach((line) => {
      const l = document.createElement("div");
      l.className = "line";
      l.textContent = line;
      log.appendChild(l);
    });
    panel.appendChild(log);

    const stack = document.createElement("div");
    stack.className = "panel-stack";
    project.stack.forEach((t) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      stack.appendChild(tag);
    });
    panel.appendChild(stack);

    const links = document.createElement("div");
    links.className = "panel-links";
    (project.links || []).forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = `[ ${link.label} ]`;
      links.appendChild(a);
    });
    panel.appendChild(links);
  }

  function mountHero(project, container) {
    // Lazy hooks — each panel module attaches itself to window.VesselPanels
    // and is only asked to actually do work (fetch three.js, build a scene)
    // once its panel is opened.
    const run = () => {
      if (REDUCED_MOTION) {
        container.innerHTML = `<div class="hero-loading">STATIC PREVIEW — MOTION REDUCED</div>`;
        return;
      }
      if (project.hero === "pointcloud" && window.VesselPanels && window.VesselPanels.pointcloud) {
        window.VesselPanels.pointcloud(container);
      } else if (project.hero === "gesture" && window.VesselPanels && window.VesselPanels.gesture) {
        window.VesselPanels.gesture(container);
      } else if (project.hero === "simcore" && window.VesselPanels && window.VesselPanels.simcore) {
        window.VesselPanels.simcore(container);
      } else {
        container.innerHTML = `<div class="hero-loading">SUBSYSTEM UNAVAILABLE</div>`;
      }
    };
    // panel scripts load with `defer`, so by the time a user has clicked
    // through the boot sequence and picked a project they're normally ready —
    // but guard just in case with a short poll.
    if (window.VesselPanels) {
      run();
    } else {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (window.VesselPanels || tries > 40) {
          clearInterval(poll);
          run();
        }
      }, 50);
    }
  }

  // ---------------- Ambient audio (Web Audio, no asset file) ----------------

  let audioCtx = null;
  let audioNodes = null;

  function toggleAudio() {
    const btn = document.getElementById("audio-toggle");
    const on = btn.getAttribute("aria-pressed") === "true";

    if (on) {
      if (audioNodes) {
        audioNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} });
      }
      if (audioCtx) audioCtx.close();
      audioCtx = null;
      audioNodes = null;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "AMBIENCE: OFF";
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.03;
    gain.connect(audioCtx.destination);

    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 58;

    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.01;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start();
    osc2.start();
    lfo.start();

    audioNodes = [osc1, osc2, lfo];
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "AMBIENCE: ON";
  }

  // ---------------- Plain resume view ----------------
  // A jargon-free alternative for anyone who'd rather not dig through a
  // derelict ship to find a project list. Built from the same IDENTITY /
  // VESSEL_MANIFEST data as the terminal — nothing is authored twice.

  const PLAIN_PROMPT_KEY = "vessel_plain_prompt_seen";

  function safeStorage(fn) {
    try { return fn(); } catch (e) { return undefined; }
  }

  function renderResumeView() {
    const root = document.getElementById("resume-inner");
    if (!root || typeof IDENTITY === "undefined") return;

    const links = [
      `<a href="mailto:${IDENTITY.email}">${IDENTITY.email}</a>`,
      `<a href="${IDENTITY.github}" target="_blank" rel="noopener">GitHub</a>`,
      `<a href="${IDENTITY.linkedin}" target="_blank" rel="noopener">LinkedIn</a>`,
    ].join("");

    const experienceHtml = IDENTITY.experience.map((job) => `
      <div class="resume-entry">
        <div class="resume-entry-head">
          <span class="resume-entry-title">${escapeHtml(job.role)} — ${escapeHtml(job.company)}</span>
          <span class="resume-entry-period">${escapeHtml(job.period)}</span>
        </div>
        <div class="resume-entry-sub">${escapeHtml(job.location)}</div>
        <ul>${job.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
      </div>
    `).join("");

    const educationHtml = IDENTITY.education.map((ed) => `
      <div class="resume-entry">
        <div class="resume-entry-head">
          <span class="resume-entry-title">${escapeHtml(ed.school)}</span>
          <span class="resume-entry-period">${escapeHtml(ed.period)}</span>
        </div>
        <div class="resume-entry-sub">${escapeHtml(ed.degree)} · ${escapeHtml(ed.location)}</div>
        <p>${escapeHtml(ed.details)}</p>
      </div>
    `).join("");

    const projectsHtml = CATEGORY_ORDER.flatMap((cat) => VESSEL_MANIFEST.filter((p) => p.category === cat))
      .map((p) => `
        <div class="resume-entry">
          <div class="resume-entry-head">
            <span class="resume-entry-title">${escapeHtml(p.plainName || p.designation)}</span>
            <span class="resume-entry-period">${escapeHtml(p.period)}</span>
          </div>
          <div class="resume-entry-sub">${escapeHtml(p.affiliation)}</div>
          <p>${escapeHtml(p.summary)}</p>
          <div class="resume-tags">${p.stack.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
          ${(p.links || []).map((l) => `<div class="resume-link"><a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></div>`).join("")}
        </div>
      `).join("");

    root.innerHTML = `
      <button class="resume-back" id="resume-back-btn" type="button">&larr; BACK TO THE TERMINAL</button>
      <h1>${escapeHtml(IDENTITY.name)}</h1>
      <p class="resume-tagline">${escapeHtml(IDENTITY.tagline)}</p>
      <p class="resume-contact">${links}</p>

      <h2>Education</h2>
      ${educationHtml}

      <h2>Experience</h2>
      ${experienceHtml}

      <h2>Projects</h2>
      ${projectsHtml}
    `;

    document.getElementById("resume-back-btn").addEventListener("click", showTerminalView);
  }

  function showResumeView() {
    if (!document.getElementById("resume-inner").childElementCount) {
      renderResumeView();
    }
    document.getElementById("resume-view").classList.remove("hidden");
    document.getElementById("plain-prompt").classList.add("hidden");
    window.scrollTo(0, 0);
  }

  function showTerminalView() {
    document.getElementById("resume-view").classList.add("hidden");
  }

  function maybeShowPlainPrompt() {
    const seen = safeStorage(() => window.localStorage.getItem(PLAIN_PROMPT_KEY));
    if (seen) return;
    setTimeout(() => {
      document.getElementById("plain-prompt").classList.remove("hidden");
    }, 1400);
  }

  function dismissPlainPrompt() {
    document.getElementById("plain-prompt").classList.add("hidden");
    safeStorage(() => window.localStorage.setItem(PLAIN_PROMPT_KEY, "1"));
  }

  // ---------------- Init ----------------

  function initConsole() {
    renderHullIntegrity();
    startHullJitter();
    buildSidebar();
    tickClock();
    setInterval(tickClock, 1000);

    document.getElementById("audio-toggle").addEventListener("click", toggleAudio);
    document.getElementById("plain-view-toggle").addEventListener("click", showResumeView);
    document.getElementById("plain-prompt-accept").addEventListener("click", () => {
      dismissPlainPrompt();
      showResumeView();
    });
    document.getElementById("plain-prompt-dismiss").addEventListener("click", dismissPlainPrompt);
    document.getElementById("full-recovery-close").addEventListener("click", () => {
      document.getElementById("recovery-scene").classList.add("hidden");
    });

    if (REDUCED_MOTION) {
      document.getElementById("reduced-motion-note").classList.remove("hidden");
    }

    maybeShowPlainPrompt();
  }

  document.addEventListener("DOMContentLoaded", runBoot);
})();
