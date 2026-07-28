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

    // ---------------- Cockpit frame (wireframe) ----------------
    const frameMat = new THREE.LineBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.55 });
    const frameGroup = new THREE.Group();

    // Canopy arcs — a few simple curved struts overhead/around, built from
    // straight segments (no curve geometry needed) so it reads as a canopy
    // frame without needing anything fancier than line segments.
    function addArc(radius, yOffset, zOffset, segments, colorHex) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / segments); // upper arc only
        pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius + yOffset, zOffset));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: colorHex || 0x1f8a56, transparent: true, opacity: 0.5 });
      return new THREE.Line(geo, mat);
    }
    frameGroup.add(addArc(7, -2, -3));
    frameGroup.add(addArc(7, -2, -9));
    frameGroup.add(addArc(6.4, -2, -6));
    scene.add(frameGroup);

    // Dashboard — a wireframe console arcing in front of the seat, with a
    // handful of small raised "control" boxes (visual anchors for the
    // hotspots; the actual clickable elements are the HTML buttons that
    // track these positions, not these meshes).
    const dashGeo = new THREE.BoxGeometry(9, 1.1, 0.4);
    const dashWire = new THREE.WireframeGeometry(dashGeo);
    const dashMat = new THREE.LineBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.7 });
    const dash = new THREE.LineSegments(dashWire, dashMat);
    dash.position.set(0, 0.1, -6.2);
    dash.rotation.x = -0.15;
    scene.add(dash);

    const controlBoxes = new THREE.Group();
    (hotspots || []).forEach((h) => {
      const geo = new THREE.BoxGeometry(0.5, 0.35, 0.3);
      const wire = new THREE.WireframeGeometry(geo);
      const mat = new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85 });
      const box = new THREE.LineSegments(wire, mat);
      box.position.set(h.anchor[0], h.anchor[1], h.anchor[2]);
      controlBoxes.add(box);

      // small glow point at the same spot
      const glowGeo = new THREE.BufferGeometry();
      glowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(h.anchor), 3));
      const glowMat = new THREE.PointsMaterial({ color: 0x3dff9a, size: 0.25, transparent: true, opacity: 0.9, sizeAttenuation: true });
      controlBoxes.add(new THREE.Points(glowGeo, glowMat));
    });
    scene.add(controlBoxes);

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
      if (!e.touches || !e.touches[0]) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchBaseYaw = targetYaw;
      touchBasePitch = targetPitch;
    }
    function onTouchMove(e) {
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
        projectVec.set(h.anchor[0], h.anchor[1], h.anchor[2]);
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
      controlBoxes.children.forEach((child, i) => {
        if (child.isPoints) child.material.opacity = 0.7 + Math.sin(t * 40 + i) * 0.2;
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

  return { init };
})();
