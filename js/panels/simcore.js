/**
 * SIMULATION hero panel — small lazy-loaded wireframe preview representing
 * the WebGL survival game's render core, plus a launch link out to the
 * actual playable build (swap the URL in data.js once hosted).
 */

window.VesselPanels = window.VesselPanels || {};

(function () {
  window.VesselPanels.simcore = function (container) {
    const loadThree = window.VesselPanels._loadThree;
    if (!loadThree) {
      container.innerHTML = '<div class="hero-loading">SIM CORE UNAVAILABLE</div>';
      return;
    }
    loadThree()
      .then((THREE) => buildScene(THREE, container))
      .catch(() => {
        container.innerHTML = '<div class="hero-loading">SIM CORE UNAVAILABLE — NETWORK BLOCKED</div>';
      });
  };

  function buildScene(THREE, container) {
    container.innerHTML = "";

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(4, 3, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geo = new THREE.IcosahedronGeometry(1.6, 0);
    const wire = new THREE.WireframeGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.8 });
    const mesh = new THREE.LineSegments(wire, mat);
    group.add(mesh);

    // day/night cycle nod: a slowly orbiting point light
    const light = new THREE.PointLight(0xffb347, 1.2, 20);
    light.position.set(3, 2, 3);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x113322, 1));

    // ground grid to suggest a playfield
    const grid = new THREE.GridHelper(10, 10, 0x1f8a56, 0x122417);
    grid.position.y = -1.8;
    scene.add(grid);

    let raf = null;
    let t = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      t += 0.01;
      group.rotation.y = t * 0.6;
      group.rotation.x = Math.sin(t * 0.4) * 0.2;
      light.position.x = Math.cos(t * 0.5) * 4;
      light.position.z = Math.sin(t * 0.5) * 4;
      renderer.render(scene, camera);
    }
    animate();

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:10px;letter-spacing:.06em;color:#5a7a68;pointer-events:none;";
    overlay.textContent = "RENDER CORE PREVIEW — FULL BUILD LINKED BELOW";
    container.appendChild(overlay);

    const observer = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        cancelAnimationFrame(raf);
        renderer.dispose();
        geo.dispose();
        wire.dispose();
        mat.dispose();
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById("panel-viewport"), { childList: true, subtree: true });

    window.addEventListener("resize", () => {
      if (!document.body.contains(container)) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  }
})();
