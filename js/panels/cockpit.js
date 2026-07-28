/**
 * COCKPIT — the ship's captain's-chair view. A single stylized 3D scene
 * (wireframe dashboard, point-cloud starfield + drifting debris outside
 * the canopy) you look around from a fixed seated position. Four "controls"
 * on the dashboard are 3D anchor points; their on-screen position is
 * projected every frame so the real HTML hotspot buttons (defined in
 * index.html, styled in css/style.css) can track them — clicking one is
 * normal DOM click handling, not 3D raycasting, so it can't misfire.
 *
 * Deliberately reuses the same techniques already proven elsewhere on the
 * site (point clouds, wireframe primitives) rather than attempting modeled
 * geometry or textures — this will not, and isn't trying to, look like a
 * rendered game environment. It's meant to read the same way the rest of
 * the terminal does: intentional, sparse, phosphor-green line art.
 *
 * Three.js loads from the same lazy CDN loader pointcloud.js sets up
 * (window.VesselPanels._loadThree), so the cockpit only costs anything for
 * visitors who actually get it (WebGL-capable, motion not reduced).
 */

window.VesselCockpit = (function () {
  let raf = null;
  let renderer = null;
  let disposed = false;
  // When a 2D overlay panel (skills/about/contact) is open, look-around
  // should freeze — otherwise moving the mouse to read/click inside the
  // panel also drags the 3D scene behind it.
  let lookPaused = false;

  function isWebGLAvailable() {
    try {
      const canvas = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {HTMLElement} container - full-screen host for the canvas
   * @param {Array<{id:string, el:HTMLElement, anchor:[number,number,number]}>} hotspots
   * @param {{onReady?:Function, onError?:Function}} callbacks
   */
  function init(container, hotspots, callbacks) {
    callbacks = callbacks || {};

    if (!isWebGLAvailable()) {
      callbacks.onError && callbacks.onError(new Error("WebGL unavailable"));
      return;
    }

    const loadThree = window.VesselPanels && window.VesselPanels._loadThree;
    if (!loadThree) {
      callbacks.onError && callbacks.onError(new Error("three.js loader missing"));
      return;
    }

    loadThree()
      .then((THREE) => build(THREE, container, hotspots, callbacks))
      .catch((err) => {
        console.error("[cockpit] three.js failed to load:", err);
        callbacks.onError && callbacks.onError(err);
      });
  }

  function build(THREE, container, hotspots, callbacks) {
    if (disposed) return;
    container.innerHTML = "";

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03110a, 0.018);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 200);
    camera.position.set(0, 1.2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const color = new THREE.Color();

    // ---------------- Starfield + drifting debris beyond the canopy ----------------
    const STAR_COUNT = 4000;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 160;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 90 + 10;
      starPositions[i * 3 + 2] = -10 - Math.random() * 140;
      color.setHSL(0.42, 0.6, 0.5 + Math.random() * 0.4);
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // A little debris drifting further out — echoes the derelict-hull point
    // clusters used elsewhere on the site.
    const DEBRIS_COUNT = 2500;
    const debrisPositions = new Float32Array(DEBRIS_COUNT * 3);
    const debrisColors = new Float32Array(DEBRIS_COUNT * 3);
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const cx = (Math.random() - 0.5) * 60;
      const cy = (Math.random() - 0.5) * 20 + 5;
      const cz = -25 - Math.random() * 60;
      debrisPositions[i * 3] = cx;
      debrisPositions[i * 3 + 1] = cy;
      debrisPositions[i * 3 + 2] = cz;
      color.setHSL(0.42, 0.9, 0.3 + Math.random() * 0.25);
      debrisColors[i * 3] = color.r;
      debrisColors[i * 3 + 1] = color.g;
      debrisColors[i * 3 + 2] = color.b;
    }
    const debrisGeo = new THREE.BufferGeometry();
    debrisGeo.setAttribute("position", new THREE.BufferAttribute(debrisPositions, 3));
    debrisGeo.setAttribute("color", new THREE.BufferAttribute(debrisColors, 3));
    const debrisMat = new THREE.PointsMaterial({
      size: 0.06, vertexColors: true, transparent: true, opacity: 0.75, sizeAttenuation: true,
    });
    const debris = new THREE.Points(debrisGeo, debrisMat);
    scene.add(debris);

    // ---------------- Cabin shell ----------------
    // Floor, side walls and ceiling around the seat so the view reads as
    // sitting inside a vessel rather than a console floating in open space.
    // The front stays open (no wall at CABIN_FRONT_Z) — that gap is the
    // windshield the console sits under, framed by mullion lines, with the
    // starfield/debris visible beyond it exactly as before.
    const CABIN_HALF_W = 5.6;
    const FLOOR_Y = -1.2;
    const CEIL_Y = 2.3;
    const CABIN_BACK_Z = 2.5; // just behind the seat
    const CABIN_FRONT_Z = -6.6; // just past the console — the windshield line
    const cabinDepth = CABIN_BACK_Z - CABIN_FRONT_Z;
    const cabinCenterZ = (CABIN_BACK_Z + CABIN_FRONT_Z) / 2;

    function addShellPanel(w, h, d, x, y, z, color) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x, y, z);
      scene.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x1f8a56, transparent: true, opacity: 0.5 })
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    }

    // Floor + ceiling
    addShellPanel(CABIN_HALF_W * 2, 0.08, cabinDepth, 0, FLOOR_Y, cabinCenterZ, 0x040a07);
    addShellPanel(CABIN_HALF_W * 2, 0.08, cabinDepth, 0, CEIL_Y, cabinCenterZ, 0x040a07);
    // Side walls
    addShellPanel(0.12, CEIL_Y - FLOOR_Y, cabinDepth, -CABIN_HALF_W, (CEIL_Y + FLOOR_Y) / 2, cabinCenterZ, 0x050f0a);
    addShellPanel(0.12, CEIL_Y - FLOOR_Y, cabinDepth, CABIN_HALF_W, (CEIL_Y + FLOOR_Y) / 2, cabinCenterZ, 0x050f0a);

    // Faint ceiling ribs and floor grid lines for a bit of texture/depth cueing.
    const structureMat = new THREE.LineBasicMaterial({ color: 0x1f8a56, transparent: true, opacity: 0.35 });
    for (let i = 1; i < 6; i++) {
      const z = CABIN_BACK_Z - (i * cabinDepth) / 6;
      const ribGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-CABIN_HALF_W, CEIL_Y - 0.06, z),
        new THREE.Vector3(CABIN_HALF_W, CEIL_Y - 0.06, z),
      ]);
      scene.add(new THREE.Line(ribGeo, structureMat));

      const floorGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-CABIN_HALF_W, FLOOR_Y + 0.05, z),
        new THREE.Vector3(CABIN_HALF_W, FLOOR_Y + 0.05, z),
      ]);
      scene.add(new THREE.Line(floorGeo, structureMat));
    }

    // Windshield mullion frame at the open front boundary — reads as the
    // window the console sits under, without blocking the starfield beyond.
    const windshieldPts = [
      new THREE.Vector3(-CABIN_HALF_W, FLOOR_Y, CABIN_FRONT_Z),
      new THREE.Vector3(-CABIN_HALF_W, CEIL_Y, CABIN_FRONT_Z),
      new THREE.Vector3(CABIN_HALF_W, CEIL_Y, CABIN_FRONT_Z),
      new THREE.Vector3(CABIN_HALF_W, FLOOR_Y, CABIN_FRONT_Z),
      new THREE.Vector3(-CABIN_HALF_W, FLOOR_Y, CABIN_FRONT_Z),
    ];
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(windshieldPts),
        new THREE.LineBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.6 })
      )
    );

    // ---------------- Console ----------------
    // A shared base slab the modules visually sit on, plus one distinct
    // module per hotspot — solid body + clean edge outline (EdgesGeometry,
    // not WireframeGeometry, so flat panels don't get the diagonal
    // "X" every box face shows when every triangle edge is drawn) + a
    // procedurally-drawn screen so each control reads as its own thing
    // instead of four identical floating boxes.

    function makeScreenTexture(kind) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#03100a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1f8a56";
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

      ctx.strokeStyle = "#3dff9a";
      ctx.fillStyle = "#3dff9a";

      if (kind === "projects") {
        // a small manifest/file list, echoing the terminal's own sidebar
        const rows = [
          ["ONLINE", 0.7],
          ["DEGRADED", 0.5],
          ["RECOVERED", 0.6],
          ["LOCKED", 0.35],
        ];
        rows.forEach((row, i) => {
          const y = 26 + i * 30;
          ctx.fillStyle = i === 3 ? "#ffb347" : "#3dff9a";
          ctx.fillRect(18, y, 10, 10);
          ctx.strokeStyle = "#2a6b48";
          ctx.beginPath();
          ctx.moveTo(38, y + 5);
          ctx.lineTo(38 + 150 * row[1], y + 5);
          ctx.stroke();
        });
      } else if (kind === "skills") {
        // a simple bar chart
        const heights = [0.9, 0.55, 0.75, 0.4, 0.65, 0.3];
        const barW = 26;
        heights.forEach((h, i) => {
          const x = 20 + i * (barW + 8);
          const barH = h * 110;
          ctx.fillStyle = i % 2 === 0 ? "#3dff9a" : "#ffb347";
          ctx.fillRect(x, 130 - barH, barW, barH);
        });
        ctx.strokeStyle = "#2a6b48";
        ctx.beginPath();
        ctx.moveTo(14, 130);
        ctx.lineTo(242, 130);
        ctx.stroke();
      } else if (kind === "about") {
        // a scan-ring dial
        const cx = canvas.width / 2, cy = canvas.height / 2, r = 52;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const inner = r + 4, outer = r + 12;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - r - 16, cy);
        ctx.lineTo(cx + r + 16, cy);
        ctx.moveTo(cx, cy - r - 16);
        ctx.lineTo(cx, cy + r + 16);
        ctx.stroke();
      } else if (kind === "contact") {
        // a signal waveform + antenna bars
        ctx.beginPath();
        for (let x = 20; x <= 190; x += 4) {
          const y = 80 + Math.sin(x * 0.15) * 30 * Math.exp(-Math.abs(x - 105) / 90);
          if (x === 20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const barH = 14 + i * 12;
          ctx.fillStyle = "#ffb347";
          ctx.fillRect(206 + i * 10, 130 - barH, 6, barH);
        }
      }

      return canvas;
    }

    const consoleGroup = new THREE.Group();
    const indicatorLights = []; // { material, phase } — pulsed in the render loop

    // Shared base the four modules sit on top of.
    const baseGeo = new THREE.BoxGeometry(9, 0.35, 0.9);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x060d09 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, -0.78, -6.1);
    consoleGroup.add(base);

    const baseEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(baseGeo),
      new THREE.LineBasicMaterial({ color: 0x1f8a56, transparent: true, opacity: 0.6 })
    );
    baseEdges.position.copy(base.position);
    consoleGroup.add(baseEdges);

    // Shared module dimensions — also referenced by updateHotspots() below
    // so the HTML button label can be projected from a point at the base of
    // each panel (below the screen art and indicator lights) rather than
    // dead center, where it would sit on top of the drawn screen content.
    const MODULE_W = 1.7, MODULE_H = 1.05, MODULE_D = 0.55;

    (hotspots || []).forEach((h) => {
      const moduleGroup = new THREE.Group();
      const bodyW = MODULE_W, bodyH = MODULE_H, bodyD = MODULE_D;

      const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x081410 });
      moduleGroup.add(new THREE.Mesh(bodyGeo, bodyMat));
      moduleGroup.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(bodyGeo),
          new THREE.LineBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.85 })
        )
      );

      const texture = new THREE.CanvasTexture(makeScreenTexture(h.id));
      const screenGeo = new THREE.PlaneGeometry(bodyW * 0.8, bodyH * 0.62);
      const screenMat = new THREE.MeshBasicMaterial({ map: texture });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(0, bodyH * 0.08, bodyD / 2 + 0.01);
      moduleGroup.add(screen);

      for (let i = 0; i < 3; i++) {
        const lightGeo = new THREE.BoxGeometry(0.09, 0.09, 0.04);
        const lightMat = new THREE.MeshBasicMaterial({
          color: i === 1 ? 0xffb347 : 0x3dff9a, transparent: true, opacity: 0.9,
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(-bodyW * 0.3 + i * bodyW * 0.3, -bodyH * 0.44, bodyD / 2 + 0.03);
        moduleGroup.add(light);
        indicatorLights.push({ material: lightMat, phase: Math.random() * 10 });
      }

      moduleGroup.position.set(h.anchor[0], h.anchor[1], h.anchor[2]);
      consoleGroup.add(moduleGroup);
    });

    scene.add(consoleGroup);

    // ---------------- Look-around (no pointer lock — just follows input) ----------------
    let targetYaw = 0;
    let targetPitch = 0;
    let yaw = 0;
    let pitch = 0;
    const MAX_YAW = 0.7; // ~40deg
    const MAX_PITCH = 0.35; // ~20deg

    function setLookFromNormalized(nx, ny) {
      // nx, ny in [-1, 1] relative to viewport center
      targetYaw = -nx * MAX_YAW;
      targetPitch = -ny * MAX_PITCH;
    }

    function onMouseMove(e) {
      if (lookPaused) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      setLookFromNormalized(nx, ny);
    }

    // Touch: drag to look, relative to where the drag started (accumulated),
    // since there's no persistent touch position like a mouse.
    let touchActive = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchBaseYaw = 0;
    let touchBasePitch = 0;

    function onTouchStart(e) {
      if (lookPaused) return;
      if (!e.touches || !e.touches[0]) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchBaseYaw = targetYaw;
      touchBasePitch = targetPitch;
    }
    function onTouchMove(e) {
      if (lookPaused) return;
      if (!touchActive || !e.touches || !e.touches[0]) return;
      const dx = (e.touches[0].clientX - touchStartX) / window.innerWidth;
      const dy = (e.touches[0].clientY - touchStartY) / window.innerHeight;
      targetYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, touchBaseYaw - dx * 2));
      targetPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, touchBasePitch - dy * 2));
    }
    function onTouchEnd() { touchActive = false; }

    window.addEventListener("mousemove", onMouseMove);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    // ---------------- Hotspot screen-space projection ----------------
    const projectVec = new THREE.Vector3();
    function updateHotspots() {
      (hotspots || []).forEach((h) => {
        if (!h.el) return;
        // Project from the base edge of the panel, not its center — the
        // screen art and indicator lights already occupy the middle/top of
        // each module, so the button reads as a labeled control strip
        // beneath the display instead of overlapping it.
        projectVec.set(
          h.anchor[0],
          h.anchor[1] - MODULE_H / 2 - 0.08,
          h.anchor[2] + MODULE_D / 2 + 0.25
        );
        projectVec.project(camera);

        const behind = projectVec.z > 1;
        const x = (projectVec.x * 0.5 + 0.5) * width;
        const y = (1 - (projectVec.y * 0.5 + 0.5)) * height;
        const withinMargin =
          !behind && x > -40 && x < width + 40 && y > -40 && y < height + 40;

        if (withinMargin) {
          h.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
          h.el.style.opacity = "1";
          h.el.style.pointerEvents = "auto";
        } else {
          h.el.style.opacity = "0";
          h.el.style.pointerEvents = "none";
        }
      });
    }

    // ---------------- Render loop ----------------
    let t = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      t += 0.001;

      yaw += (targetYaw - yaw) * 0.06;
      pitch += (targetPitch - pitch) * 0.06;
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      stars.rotation.y = t * 0.02;
      debris.rotation.y = t * 0.015;
      indicatorLights.forEach((l) => {
        l.material.opacity = 0.5 + Math.sin(t * 30 + l.phase) * 0.4;
      });

      renderer.render(scene, camera);
      updateHotspots();
    }
    animate();

    function handleResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    callbacks.onReady && callbacks.onReady();

    // Expose a teardown in case app.js ever needs to leave the cockpit and
    // free the WebGL context (kept simple: this app never destroys it once
    // built, since switching to the terminal just hides it, but this is
    // here for completeness / future-proofing).
    window.VesselCockpit._dispose = function () {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer && renderer.dispose();
    };
  }

  return {
    init,
    setPaused(paused) {
      lookPaused = !!paused;
    },
  };
})();
