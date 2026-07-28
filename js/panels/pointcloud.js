/**
 * NAV hero panel — a slowly drifting LiDAR-style point cloud.
 * Three.js is fetched from CDN only when this panel is actually opened
 * (see loadThree() below), so nobody who never clicks NAV pays for it.
 */

window.VesselPanels = window.VesselPanels || {};

(function () {
  let threePromise = null;

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.onload = () => resolve(window.THREE);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return threePromise;
  }
  window.VesselPanels._loadThree = loadThree;

  window.VesselPanels.pointcloud = function (container) {
    loadThree()
      .then((THREE) => buildScene(THREE, container))
      .catch(() => {
        container.innerHTML = '<div class="hero-loading">POINT CLOUD UNAVAILABLE — NETWORK BLOCKED</div>';
      });
  };

  function buildScene(THREE, container) {
    container.innerHTML = "";

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03110a, 0.02);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    camera.position.set(0, 3, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Generate a point cloud that reads as "sonar/lidar scan of open water +
    // hull silhouette" rather than random noise: a scattered volume plus a
    // denser ring suggesting a hull cross-section.
    const COUNT = 60000;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);

    const color = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      let x, y, z;
      if (i % 5 === 0) {
        // hull ring
        const angle = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 0.6;
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r * 0.35 + (Math.random() - 0.5) * 0.5;
        z = (Math.random() - 0.5) * 14;
      } else {
        x = (Math.random() - 0.5) * 40;
        y = (Math.random() - 0.5) * 18;
        z = (Math.random() - 0.5) * 40;
      }
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const depth = (z + 20) / 40;
      color.setHSL(0.42, 0.9, 0.25 + depth * 0.35);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = null;
    let t = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      t += 0.0015;
      points.rotation.y = t;
      camera.position.x = Math.sin(t * 0.6) * 2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    animate();

    // Clean up if the panel viewport gets replaced (user navigates away).
    const observer = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        cancelAnimationFrame(raf);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
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
