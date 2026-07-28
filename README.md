# M/V Kalyani — Recovered Systems Log

A portfolio site framed as the recovered systems log of an abandoned autonomous vessel. You're not walking around a 3D ship — you're sitting at a terminal, rebooting each system one at a time. Every project on the site is a "system" (NAV, PERCEPTION, CRYPTO, OPS, SIM) drawn from a single data file, so adding a new project never means touching the design.

**Live:** https://kalyanivalath.github.io/web-portfolio/

## What's in here

- A boot sequence, a system sidebar, and per-project panels — all rendered from `js/data.js`.
- Two WebGL "hero" panels (NAV's drifting LiDAR point cloud, a procedural ASL hand-landmark rig) that lazy-load Three.js only when opened.
- A locked CRYPTO archive you have to decrypt.
- Hull integrity that starts at 0% and climbs as you open each system — hit 100% and a power-surge sequence plays before a contact prompt shows up.
- A one-click toggle to a plain, ordinary resume view for anyone who'd rather skip the fiction.
- No build step, no framework, no bundler. Plain HTML/CSS/JS, under ~100KB total, loads instantly on any device.

## Project structure

```
web-portfolio/
├── index.html              # markup + all the modal/overlay scaffolding
├── css/
│   └── style.css           # terminal theme, plain-resume theme, animations
└── js/
    ├── data.js              # VESSEL_MANIFEST + IDENTITY — the single source of truth
    ├── app.js                # boot sequence, panel rendering, hull integrity, all interactions
    └── panels/
        ├── pointcloud.js     # NAV hero — Three.js LiDAR point cloud
        ├── gesture.js         # PERCEPTION hero — canvas hand-landmark rig
        └── simcore.js         # SIM preview — Three.js wireframe render-core
```

## Adding a new project

Open `js/data.js` and append one object to `VESSEL_MANIFEST`:

```js
{
  id: "unique-slug",
  designation: "SOME SYSTEM NAME",   // shown in the terminal (all caps reads best)
  plainName: "Human-Readable Title", // shown in the plain resume view
  category: "NAV",                    // NAV | PERCEPTION | CRYPTO | OPS | SIM
  status: "ONLINE",                   // ONLINE | DEGRADED | OFFLINE | RECOVERED | LOCKED
  period: "COMPLETED",
  affiliation: "Where/who this was built for",
  summary: "1–3 sentence plain description of the project.",
  logLines: ["FLAVOR LOG LINE ONE", "FLAVOR LOG LINE TWO"],
  stack: ["Python", "Some Framework"],
  links: [{ label: "SOURCE", url: "https://github.com/you/repo" }],
}
```

Nothing else needs to change — the sidebar, panel rendering, hull-integrity math, and plain resume view all read from this same array.

## Running locally

No build step required — just open `index.html` directly in a browser, or serve the folder with any static server:

```
python3 -m http.server 8000
```

## Credits

Built by Kalyani Valath. Three.js loaded from cdnjs at runtime; everything else is hand-written.
