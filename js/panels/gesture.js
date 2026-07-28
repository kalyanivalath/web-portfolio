/**
 * PERCEPTION hero panel — a stylized hand-landmark rig cycling through a
 * few ASL letter poses, procedurally posed and drawn on a 2D canvas.
 * No external assets, no webcam, no ML runtime — this is a lightweight
 * visualization of what the recognition pipeline tracks, not a live model.
 * Kept honest about that in the caption drawn under the rig.
 */

window.VesselPanels = window.VesselPanels || {};

(function () {
  // Per-finger curl amount, 0 = fully extended, 1 = fully curled.
  // Order: [thumb, index, middle, ring, pinky]
  const POSES = [
    { letter: "A", curl: [0.2, 1, 1, 1, 1] },
    { letter: "B", curl: [1, 0, 0, 0, 0] },
    { letter: "L", curl: [0, 0, 1, 1, 1] },
    { letter: "Y", curl: [0, 1, 1, 1, 0] },
    { letter: "I", curl: [1, 1, 1, 1, 0] },
  ];

  const FINGER_BASE_X = [-2.2, -1.5, -0.5, 0.5, 1.5];
  const FINGER_BASE_Y = [-0.8, -3, -3.3, -3, -2.6];
  const FINGER_SEG_LEN = [
    [1.1, 0.9, 0.7],
    [1.3, 1.0, 0.8],
    [1.4, 1.1, 0.8],
    [1.3, 1.0, 0.8],
    [1.1, 0.8, 0.6],
  ];
  const FINGER_SPREAD = [-0.9, -0.18, -0.02, 0.14, 0.32]; // radians, base direction offset

  function lerp(a, b, t) { return a + (b - a) * t; }

  function fingerPoints(baseX, baseY, segLens, spread, curl) {
    // direction starts pointing "up" (toward negative y), tilted by spread
    let dir = spread - Math.PI / 2;
    let x = baseX, y = baseY;
    const pts = [[x, y]];
    for (let i = 0; i < segLens.length; i++) {
      // each joint bends progressively more as curl approaches 1
      const bend = curl * (0.9 + i * 0.55);
      dir += bend;
      x += Math.cos(dir) * segLens[i];
      y += Math.sin(dir) * segLens[i];
      pts.push([x, y]);
    }
    return pts;
  }

  function computeHand(curls) {
    const wrist = [0, 0];
    const fingers = curls.map((c, i) =>
      fingerPoints(FINGER_BASE_X[i], FINGER_BASE_Y[i], FINGER_SEG_LEN[i], FINGER_SPREAD[i], c)
    );
    return { wrist, fingers };
  }

  window.VesselPanels.gesture = function (container) {
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    const caption = document.createElement("div");
    caption.style.cssText =
      "position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:10px;letter-spacing:.06em;color:#5a7a68;pointer-events:none;";
    caption.textContent = "STYLIZED LANDMARK VISUALIZATION — NOT A LIVE MODEL FEED";
    container.appendChild(caption);

    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let poseIndex = 0;
    let holdT = 0;
    let transitionT = 1; // 1 = fully arrived at target
    let currentCurl = POSES[0].curl.slice();
    let fromCurl = POSES[0].curl.slice();
    let label = POSES[0].letter;
    let confidence = 96.4;
    let scanning = false;
    let raf = null;

    function nextPose() {
      const prevIndex = poseIndex;
      poseIndex = (poseIndex + 1) % POSES.length;
      fromCurl = POSES[prevIndex].curl.slice();
      transitionT = 0;
      scanning = true;
    }

    let lastTime = performance.now();
    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (transitionT < 1) {
        transitionT = Math.min(1, transitionT + dt * 1.6);
        const target = POSES[poseIndex].curl;
        currentCurl = fromCurl.map((v, i) => lerp(v, target[i], easeInOut(transitionT)));
        if (transitionT >= 1) {
          scanning = false;
          label = POSES[poseIndex].letter;
          confidence = 90 + Math.random() * 9.5;
          holdT = 0;
        }
      } else {
        holdT += dt;
        if (holdT > 1.6) nextPose();
      }

      draw();
    }

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function draw() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2 + h * 0.18);
      const scale = Math.min(w, h) / 11;
      ctx.scale(scale, scale);
      ctx.lineWidth = 0.14;
      ctx.strokeStyle = "rgba(61,255,154,0.75)";
      ctx.fillStyle = "#3dff9a";
      ctx.shadowColor = "rgba(61,255,154,0.6)";
      ctx.shadowBlur = 6;

      const hand = computeHand(currentCurl);

      // palm connections
      ctx.beginPath();
      ctx.moveTo(hand.wrist[0], hand.wrist[1]);
      hand.fingers.forEach((f) => ctx.lineTo(f[0][0], f[0][1]));
      ctx.lineTo(hand.wrist[0], hand.wrist[1]);
      ctx.stroke();

      hand.fingers.forEach((pts) => {
        ctx.beginPath();
        ctx.moveTo(hand.wrist[0], hand.wrist[1]);
        pts.forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 0.14, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.beginPath();
      ctx.arc(hand.wrist[0], hand.wrist[1], 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // HUD text
      ctx.shadowBlur = 0;
      ctx.font = "11px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "#5a7a68";
      ctx.textAlign = "left";
      ctx.fillText(scanning ? "TRACKING HAND POSE..." : "CLASSIFICATION COMPLETE", 12, 20);

      ctx.font = "20px ui-monospace, Menlo, monospace";
      ctx.fillStyle = scanning ? "#ffb347" : "#3dff9a";
      ctx.textAlign = "right";
      ctx.fillText(
        scanning ? "..." : `${label}  ${confidence.toFixed(1)}%`,
        w - 14,
        h - 34
      );
    }

    raf = requestAnimationFrame(tick);

    const observer = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        cancelAnimationFrame(raf);
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById("panel-viewport"), { childList: true, subtree: true });
  };
})();
