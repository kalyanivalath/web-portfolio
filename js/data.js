/**
 * VESSEL MANIFEST
 * ----------------
 * This is the single source of truth for every project on the site.
 * To add a new project: append an object to VESSEL_MANIFEST. Nothing else
 * needs to change — the terminal reads this array and draws the panels.
 *
 * Schema:
 *   id          unique slug
 *   designation display name of the "system" (all caps reads best)
 *   category    one of: NAV | PERCEPTION | CRYPTO | OPS | SIM
 *   status      ONLINE | DEGRADED | OFFLINE | RECOVERED | LOCKED
 *   period      short date/duration string
 *   affiliation who/where this was built for
 *   summary     1-3 sentence plain description
 *   logLines    array of short flavor/status strings (diagnostic log style)
 *   stack       array of tech tags
 *   links       array of { label, url }  — SOURCE / DEMO / DOC etc.
 *   hero        optional: 'pointcloud' | 'gesture' | 'simcore' — triggers a
 *               lazy-loaded WebGL/canvas centerpiece instead of a plain card
 *
 * NOTE ON LINKS: url values below point at your GitHub/LinkedIn profile as
 * placeholders where a project-specific repo/demo URL wasn't provided.
 * Swap in the real per-project links whenever you have them — nothing else
 * needs to change.
 *
 * `plainName` is an optional field used only by the plain-resume view (see
 * IDENTITY below) — a jargon-free title for people who skip the fiction.
 * If omitted, the plain view falls back to `designation`.
 */

const IDENTITY = {
  name: "Kalyani Valath",
  tagline: "Computer Science — Autonomous Systems / Robotics / AI",
  email: "kalyani.valath@gmail.com",
  github: "https://github.com/kalyanivalath",
  linkedin: "https://linkedin.com/in/kalyanivalath",
  about: [
    "I'm a Computer Science student at the University of Oklahoma (expected Dec. 2026) with a passion for robotics, autonomous systems, and computer vision. I love building things that interact with the real world, whether that's a LiDAR-guided robot, an ASL recognition pipeline, or AI-powered tools.",
    "Outside of coding, you'll usually find me playing horror games, golfing, or working on another side project. I like figuring out how things work, and building software that's intuitive, reliable, and enjoyable to use.",
  ],
  whyThisSite: {
    heading: "Why This Website?",
    paragraphs: [
      "I wanted this portfolio to feel less like reading a resume and more like exploring a game. I've always loved eerie, dystopian worlds, so building it as a ship felt right. It's still a work in progress (I've already got ideas for the next version), but I wanted it to show a bit more of who I am.",
      "Gaming has always shaped how I think about design, so the small interactive details are here to make exploring my projects more enjoyable. Prefer to skip the adventure? There's a button below for a simpler version.",
      "That's how I approach software too: thoughtful, easy to understand, and built around the people using it, whether it's a class project, an internship, or a client application, always aiming for code that's clean, maintainable, and made with the end user in mind.",
    ],
  },
  availability: "Open to relocation",
  skills: {
    "Languages & Tools": ["Python", "C#", "Java", "C++", "SQL", "JavaScript", "TypeScript", "Git", "GitHub"],
    "AI / ML & Data Science": ["Azure OpenAI", "Semantic Kernel", "Scikit-Learn", "Pandas", "NumPy", "NLP", "Prompt Engineering", "RAG"],
    "Cloud & Systems": ["Azure", "AWS", "REST APIs", "PostgreSQL", "SQL Server", "Docker", "Application Insights", "CI/CD"],
    "Frameworks": [".NET Framework", "ASP.NET Core", "React", "Next.js", "Node.js", "FastAPI"],
  },
  education: [
    {
      school: "University of Oklahoma",
      location: "Norman, OK",
      degree: "Bachelor of Science in Computer Science",
      period: "Expected Dec. 2026",
      details:
        "Relevant coursework: Algorithms, Data Structures, Introduction to Intelligent Robotics, Artificial Intelligence, Database Systems, Theory of Computation, Computer Graphics.",
    },
  ],
  experience: [
    {
      company: "NFP (An Aon Company)",
      role: "Application Development Intern",
      location: "Austin, TX",
      period: "May 2025 – Aug. 2025",
      bullets: [
        "Built an AI-powered Salesforce assistant using C#, .NET Framework, SQL, Azure OpenAI, and Semantic Kernel to automate CRM workflows for Sales and Marketing teams.",
        "Integrated Salesforce APIs to enable natural-language creation and updating of business records, reducing multi-step workflows by 40%.",
        "Improved chatbot question-resolution accuracy by 30% through prompt engineering, NLP enhancements, and retrieval optimization.",
        "Implemented monitoring and telemetry pipelines using Application Insights, reducing issue diagnosis time by 35%.",
      ],
    },
    {
      company: "Trinity Texas Realty",
      role: "Property Management Intern",
      location: "Austin, TX",
      period: "Jun. 2023 – Aug. 2023",
      bullets: [
        "Managed operational and financial data across 50+ rental units using AppFolio.",
        "Automated recurring payment schedules and expense tracking workflows, reducing manual entry errors by 30%.",
        "Produced monthly financial and occupancy reports supporting leasing and property management decisions.",
      ],
    },
  ],
};

const VESSEL_MANIFEST = [
  {
    id: "nav-autonomy-core",
    designation: "VESSEL AUTONOMY CORE",
    plainName: "Autonomous Boat Navigation System",
    category: "NAV",
    status: "DEGRADED",
    period: "SPRING 2026 — ACTIVE",
    affiliation: "University of Oklahoma",
    summary:
      "A Python sensor-fusion dashboard that simulates GPS, IMU, compass, and radar data to estimate vessel position using Kalman filtering.",
    logLines: [
      "FUSING GPS + IMU + PROXIMITY SENSOR STREAMS...",
      "LOCALIZATION CONFIDENCE: WIDENING IN OPEN WATER",
      "PATH PLANNER RECALCULATING AFTER SIMULATED OBSTACLE INTERCEPT",
      "MODULAR ARCHITECTURE: PERCEPTION / PLANNING / CONTROL — ONLINE",
    ],
    stack: ["Python", "C++", "ROS2", "Gazebo", "Sensor Fusion", "Data Visualization"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
    hero: "pointcloud",
  },
  {
    id: "perception-asl",
    designation: "GESTURE / SIGN LANGUAGE VISION",
    plainName: "ASL Recognition — Computer Vision",
    category: "PERCEPTION",
    status: "DEGRADED",
    period: "IN PROGRESS",
    affiliation: "University of Oklahoma",
    summary:
      "Real-time computer vision system recognizing American Sign Language gestures — hand detection, feature extraction, and gesture classification aimed at improving accessibility and communication.",
    logLines: [
      "HAND LANDMARK DETECTION: RUNNING",
      "TRAINING CLASSIFICATION MODEL — ACCURACY IMPROVING",
      "REAL-TIME INFERENCE LATENCY UNDER EVALUATION",
    ],
    stack: ["Python", "OpenCV", "Computer Vision", "Machine Learning", "Deep Learning"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
    hero: "gesture",
  },
  {
    id: "perception-tour-robot",
    designation: "TOUR ESCORT UNIT — LIDAR PERCEPTION",
    plainName: "Autonomous Tour Guide Robot",
    category: "PERCEPTION",
    status: "RECOVERED",
    period: "COMPLETED",
    affiliation: "University of Oklahoma",
    summary:
      "Autonomous mobile robot that navigates while monitoring a tour group using LiDAR-based perception and ROS 2 — real-time people detection, finite-state-machine navigation, obstacle avoidance, and emergency stop behavior.",
    logLines: [
      "LIDAR SCAN MATCHING: NOMINAL",
      "GROUP TRACKING — STATE MACHINE STABLE",
      "EMERGENCY STOP BEHAVIOR VALIDATED IN SIM + PHYSICAL TRIALS",
    ],
    stack: ["ROS2", "LiDAR", "Python", "Robotics", "Autonomous Navigation"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
  },
  {
    id: "crypto-security-labs",
    designation: "CRYPTOGRAPHIC SECURITY ARCHIVE",
    plainName: "Cryptography & Computer Security Labs",
    category: "CRYPTO",
    status: "LOCKED",
    period: "COMPLETED",
    affiliation: "University of Oklahoma",
    summary:
      "Hands-on security labs covering cryptographic protocols, authentication, hashing, digital signatures, and encryption attacks — including MD5 collisions, message authentication attacks, AES, and RSA.",
    logLines: [
      "ARCHIVE ENCRYPTED — AUTHORIZATION REQUIRED",
      "CONTENTS: MD5 COLLISION ANALYSIS, AES, RSA, MAC ATTACKS",
      "DECRYPTION WILL REVEAL FULL LOG",
    ],
    stack: ["C", "Linux", "Cryptography", "Cybersecurity", "Information Security"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
  },
  {
    id: "ops-loan-manager",
    designation: "LOAN MANIFEST & LEDGER SYSTEM",
    plainName: "Loan Management Web Application",
    category: "OPS",
    status: "RECOVERED",
    period: "COMPLETED",
    affiliation: "Independent / Client Project",
    summary:
      "Full-stack loan management application for a financial services business — customer lookup, loan creation, payment recording, authentication, and company-specific account management.",
    logLines: [
      "CUSTOMER LEDGER — SYNCED",
      "PAYMENT RECORDING PIPELINE STABLE",
      "AUTH + COMPANY-SCOPED ACCESS CONTROL ENFORCED",
    ],
    stack: ["Next.js", "TypeScript", "SQLite", "Drizzle ORM", "Full-Stack Development"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
  },
  {
    id: "ops-zbella",
    designation: "CARGO INTAKE AUTOMATION — ZBELLA",
    plainName: "AI-Powered Agentic Product Listing Workflow",
    category: "OPS",
    status: "ONLINE",
    period: "ONGOING",
    affiliation: "ZBella",
    summary:
      "AI-powered agentic workflow that automates product listing creation for an e-commerce clothing retailer — turns product images into Shopify-ready listings, generating descriptions and identifying attributes.",
    logLines: [
      "IMAGE → LISTING PIPELINE: HUMMING ALONG",
      "ATTRIBUTE EXTRACTION (COLOR, CATEGORY) — RUNNING",
      "MANUAL EFFORT REDUCED, CONSISTENCY UP",
    ],
    stack: ["n8n", "Shopify", "AI Automation", "Prompt Engineering", "Python", "FastAPI", "OpenAI APIs"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
  },
  {
    id: "ops-nfp-crm",
    designation: "CRM AUTOMATION RELAY — NFP",
    plainName: "AI-Powered Salesforce CRM Assistant",
    category: "OPS",
    status: "RECOVERED",
    period: "MAY 2025 — AUG 2025",
    affiliation: "NFP (An Aon Company)",
    summary:
      "AI-powered Salesforce assistant automating CRM workflows for Sales and Marketing — natural-language record creation, prompt-tuned chatbot accuracy, and telemetry pipelines for faster diagnosis.",
    logLines: [
      "MULTI-STEP WORKFLOWS REDUCED ~40%",
      "CHATBOT RESOLUTION ACCURACY +30% AFTER TUNING",
      "TELEMETRY PIPELINE CUT DIAGNOSIS TIME ~35%",
    ],
    stack: ["C#", ".NET", "SQL", "Azure OpenAI", "Semantic Kernel", "Application Insights"],
    // Internal company project — no public repo to link to.
    links: [],
  },
  {
    id: "sim-survival-game",
    designation: "SIMULATION CORE — SURVIVAL PROTOCOL",
    plainName: "3D Survival Game (WebGL)",
    category: "SIM",
    status: "ONLINE",
    period: "COMPLETED",
    affiliation: "University of Oklahoma",
    summary:
      "Third-person 3D survival game built in WebGL — character movement, collision detection, dynamic lighting, day/night cycles, power-ups, and health tracking, hand-rolled with custom GLSL shaders.",
    logLines: [
      "RENDER LOOP: STABLE",
      "DAY/NIGHT CYCLE + DYNAMIC LIGHTING — ACTIVE",
      "PLAYABLE BUILD AVAILABLE ON REQUEST",
    ],
    stack: ["JavaScript", "WebGL", "GLSL", "Computer Graphics", "Game Development"],
    links: [
      { label: "SOURCE", url: "https://github.com/kalyanivalath" },
    ],
    hero: "simcore",
  },
];
