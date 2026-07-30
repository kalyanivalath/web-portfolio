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
    { text: "KALYANI — RECOVERED SYSTEMS LOG", cls: "ok" },
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

  // Wires every "PLAIN RESUME" quick-link (boot screen + cockpit view both
  // have one — see index.html's .quick-links blocks) to jump straight to
  // the plain resume. If clicked during boot, skip the boot animation first
  // so the state underneath is properly initialized by the time they close
  // the resume view and land back on the ship.
  function wireQuickLinks() {
    document.querySelectorAll("[data-open-resume]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.closest("#boot-screen")) {
          const skipBtn = document.getElementById("skip-boot");
          skipBtn && skipBtn.click();
        }
        showResumeView();
      });
    });
  }

  function runBoot() {
    wireQuickLinks();
    // Ambience starts immediately on page load, not once boot finishes or
    // someone clicks something — see startAmbience()'s note on autoplay
    // policy for how it closes the gap between "toggle reads ON" and
    // "sound is actually audible."
    startAmbience();

    const bootLog = document.getElementById("boot-log");
    const bootScreen = document.getElementById("boot-screen");
    const skipBtn = document.getElementById("skip-boot");

    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      bootScreen.classList.add("hidden");
      initConsole(); // wire up the terminal regardless of which view lands first

      if (REDUCED_MOTION) {
        showTerminalTopView();
        return;
      }
      attemptCockpit();
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
    renderPanel(project, document.getElementById("panel-viewport")); // may rebuild the sidebar via markRepaired()
    highlightActiveRow(); // ...so (re)apply the active state last
  }

  // Renders a full project panel (header, status, meta, lock-gate or
  // summary/hero/log/stack/links) into whichever container is handed in —
  // the terminal's #panel-viewport, or the cockpit's #project-detail-body.
  // Kept container-agnostic so the same project view works in both places
  // without duplicating the hero-mount / CRYPTO decrypt-gate logic.
  function renderPanel(project, viewport) {
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
        renderPanel(project, viewport);
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

  // There are two ambience toggles in the DOM — one in the terminal footer,
  // one in the cockpit's quick-links row — both carry [data-audio-toggle]
  // and stay in sync no matter which one is clicked.
  function setAudioButtonsState(on) {
    document.querySelectorAll("[data-audio-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "AMBIENCE: ON" : "AMBIENCE: OFF";
    });
  }

  function stopAmbience() {
    if (audioNodes) {
      audioNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} });
    }
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
    audioCtx = null;
    audioNodes = null;
    setAudioButtonsState(false);
  }

  function startAmbience() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return; // no Web Audio support — leave the toggle inert

    audioCtx = new AudioCtor();
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
    setAudioButtonsState(true);

    // Browsers suspend a freshly created AudioContext until a real user
    // gesture happens (autoplay policy) — this starts immediately on page
    // load, before boot even finishes, so the very first mouse move, touch,
    // click, or keypress anywhere on the page resumes it. The toggle reads
    // "ON" from the first frame either way; this just closes the gap so
    // sound actually starts as close to instantly as browsers allow.
    if (audioCtx.state === "suspended") {
      const resumeEvents = ["pointerdown", "mousemove", "touchstart", "keydown"];
      const resumeOnce = () => {
        if (audioCtx) audioCtx.resume().catch(() => {});
        resumeEvents.forEach((evt) => document.removeEventListener(evt, resumeOnce));
      };
      resumeEvents.forEach((evt) => document.addEventListener(evt, resumeOnce, { once: true }));
    }
  }

  function toggleAudio() {
    const anyBtn = document.querySelector("[data-audio-toggle]");
    const on = anyBtn && anyBtn.getAttribute("aria-pressed") === "true";
    if (on) stopAmbience();
    else startAmbience();
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
      ${IDENTITY.availability ? `<p class="resume-tagline">${escapeHtml(IDENTITY.availability)}</p>` : ""}
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

  // ---------------- Cockpit ----------------
  // The default landing view when WebGL + motion are available: a single
  // 3D captain's-chair scene (js/panels/cockpit.js) with four controls that
  // open overlay panels. PROJECTS opens an in-cockpit panel listing the
  // manifest; each entry's "OPEN FULL LOG" drops into the terminal already
  // focused on that project (CRYPTO decrypt gate included).

  function showCockpitTopView() {
    document.getElementById("cockpit-view").classList.remove("hidden");
    document.getElementById("console").classList.add("hidden");
  }

  function showTerminalTopView() {
    document.getElementById("cockpit-view").classList.add("hidden");
    document.getElementById("console").classList.remove("hidden");
  }

  function openPanel(id) {
    document.getElementById(id).classList.remove("hidden");
    // Freeze cockpit look-around while a panel is open, otherwise moving the
    // mouse to read/click inside the panel also drags the 3D scene behind it.
    window.VesselCockpit && window.VesselCockpit.setPaused && window.VesselCockpit.setPaused(true);
  }
  function closePanel(id) {
    document.getElementById(id).classList.add("hidden");
    window.VesselCockpit && window.VesselCockpit.setPaused && window.VesselCockpit.setPaused(false);
  }

  function renderSkillsPanel() {
    const grid = document.getElementById("skills-grid");
    if (grid.childElementCount || typeof IDENTITY === "undefined") return;
    grid.innerHTML = Object.entries(IDENTITY.skills)
      .map(
        ([category, items]) => `
      <div>
        <p class="skills-category-title">${escapeHtml(category)}</p>
        <div class="skills-tag-list">${items.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
      </div>
    `
      )
      .join("");
  }

  function renderAboutPanel() {
    const body = document.getElementById("about-body");
    if (body.childElementCount || typeof IDENTITY === "undefined") return;

    const bioHtml = IDENTITY.about.map((para) => `<p>${escapeHtml(para)}</p>`).join("");

    const why = IDENTITY.whyThisSite;
    const whyHtml = why
      ? `<p class="modal-subtitle">${escapeHtml(why.heading)}</p>${why.paragraphs
          .map((para) => `<p>${escapeHtml(para)}</p>`)
          .join("")}`
      : "";

    body.innerHTML = bioHtml + whyHtml;

    const edu = document.getElementById("about-education");
    edu.innerHTML = IDENTITY.education
      .map(
        (ed) => `
      <div class="about-education-entry">
        <strong>${escapeHtml(ed.school)}</strong> — ${escapeHtml(ed.degree)}<br>
        ${escapeHtml(ed.period)} · ${escapeHtml(ed.location)}<br>
        ${escapeHtml(ed.details)}
      </div>
    `
      )
      .join("");
  }

  function renderProjectsPanel() {
    const list = document.getElementById("projects-list");
    if (!list || list.childElementCount || typeof VESSEL_MANIFEST === "undefined") return;

    list.innerHTML = CATEGORY_ORDER.flatMap((cat) => VESSEL_MANIFEST.filter((p) => p.category === cat))
      .map(
        (p) => `
      <div class="project-card">
        <div class="project-card-head">
          <span class="project-card-title">${escapeHtml(p.plainName || p.designation)}</span>
          <span class="project-card-status">${escapeHtml(getEffectiveStatus(p))}</span>
        </div>
        <div class="project-card-sub">${escapeHtml(p.affiliation)} · ${escapeHtml(p.period)}</div>
        <p class="project-card-summary">${escapeHtml(p.summary)}</p>
        <div class="project-card-tags">${p.stack.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        <div class="project-card-actions">
          <button class="modal-btn ghost" type="button" data-open-log="${escapeHtml(p.id)}">OPEN FULL LOG</button>
        </div>
      </div>
    `
      )
      .join("");

    list.querySelectorAll("[data-open-log]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closePanel("projects-panel");
        openProjectDetail(btn.dataset.openLog);
      });
    });
  }

  // Opens a single project's full detail (hero animation, summary, log,
  // stack, source link — same content the old terminal panel showed) as an
  // overlay right on top of the cockpit, via the same renderPanel() used by
  // the terminal sidebar. CRYPTO's decrypt gate works exactly the same way
  // here since it's the same function.
  function openProjectDetail(id) {
    const project = VESSEL_MANIFEST.find((p) => p.id === id);
    if (!project) return;
    // Open the panel FIRST, then render into it. Hero panels (pointcloud/
    // gesture/simcore) size their canvas off container.clientWidth/Height
    // synchronously at mount time — if the panel's still `.hidden` (display:
    // none) when that runs, they measure 0x0 and the canvas never recovers
    // since it only re-measures on a window resize event, not on becoming
    // visible. This was the "ASL panel is just a black box" bug.
    openPanel("project-detail-panel");
    renderPanel(project, document.getElementById("project-detail-body"));
  }

  // Every ".modal-overlay" (skills/about/projects/project-detail/contact/
  // plain-prompt) can be dismissed by clicking its backdrop or pressing
  // Escape, on top of whatever explicit close/back buttons it has.
  function wireModalDismissal() {
    function dismiss(overlay) {
      if (overlay.id === "plain-prompt") {
        dismissPlainPrompt();
      } else {
        closePanel(overlay.id);
      }
    }

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) dismiss(overlay); // backdrop only, not the box itself
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector(".modal-overlay:not(.hidden)");
      if (open) dismiss(open);
    });
  }

  function wireCockpitUI() {
    wireModalDismissal();

    document.querySelectorAll("[data-close-panel]").forEach((btn) => {
      btn.addEventListener("click", () => closePanel(btn.dataset.closePanel));
    });
    document.getElementById("cockpit-to-terminal").addEventListener("click", showTerminalTopView);
    document.getElementById("cockpit-toggle").addEventListener("click", showCockpitTopView);

    document.getElementById("hotspot-projects").addEventListener("click", () => {
      renderProjectsPanel();
      openPanel("projects-panel");
    });
    document.getElementById("hotspot-skills").addEventListener("click", () => {
      renderSkillsPanel();
      openPanel("skills-panel");
    });
    document.getElementById("hotspot-about").addEventListener("click", () => {
      renderAboutPanel();
      openPanel("about-panel");
    });
    document.getElementById("hotspot-contact").addEventListener("click", () => openPanel("contact-panel"));

    const backToProjectsBtn = document.getElementById("project-detail-back");
    if (backToProjectsBtn) {
      backToProjectsBtn.addEventListener("click", () => {
        closePanel("project-detail-panel");
        renderProjectsPanel();
        openPanel("projects-panel");
      });
    }
  }

  function attemptCockpit() {
    let settled = false;
    const safety = setTimeout(() => {
      if (settled) return;
      settled = true;
      showTerminalTopView();
    }, 6000);

    if (!window.VesselCockpit) {
      clearTimeout(safety);
      showTerminalTopView();
      return;
    }

    const hotspotDefs = [
      { id: "projects", el: document.getElementById("hotspot-projects"), anchor: [-3, 0.3, -6] },
      { id: "skills", el: document.getElementById("hotspot-skills"), anchor: [-1, 0.3, -6.3] },
      { id: "about", el: document.getElementById("hotspot-about"), anchor: [1, 0.3, -6.3] },
      { id: "contact", el: document.getElementById("hotspot-contact"), anchor: [3, 0.3, -6] },
    ];

    window.VesselCockpit.init(document.getElementById("cockpit-canvas-host"), hotspotDefs, {
      onReady: () => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        showCockpitTopView();
        document.getElementById("cockpit-toggle").classList.remove("hidden");
      },
      onError: (err) => {
        console.error("[cockpit] falling back to terminal:", err);
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        showTerminalTopView();
      },
    });
  }

  // ---------------- Init ----------------

  function initConsole() {
    renderHullIntegrity();
    startHullJitter();
    buildSidebar();
    tickClock();
    setInterval(tickClock, 1000);
    wireCockpitUI();

    document.querySelectorAll("[data-audio-toggle]").forEach((btn) => {
      btn.addEventListener("click", toggleAudio);
    });
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
