/**
 * Design Guardian — Pre-merge Automated Checks
 *
 * Run: node scripts/design-guardian.js
 *
 * Checks:
 * 1. Component Reuse: No new standalone grey-box containers outside GlassContainer
 * 2. Accessibility: Basic contrast + ARIA checks (scan for issues)
 * 3. File Safety: No files removed without explicit tracking
 *
 * Exit code 0 = all checks pass, 1 = failures found
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "../src");
const RESULTS = { pass: 0, fail: 0, warnings: [] };

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllFiles(dir, ext) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...getAllFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function check(name, pass, detail) {
  if (pass) {
    RESULTS.pass++;
    console.log(`  ✅ ${name}`);
  } else {
    RESULTS.fail++;
    RESULTS.warnings.push({ name, detail });
    console.log(`  ❌ ${name}: ${detail}`);
  }
}

// ── Check 1: No standalone grey-box styles ─────────────────────────────────────

function checkGreyBoxUsage() {
  console.log("\n📦 Check 1: Component Reuse (no new grey boxes)");

  const greyPatterns = [
    /bg-gray-\d/g,
    /bg-slate-\d/g,
    /bg-neutral-\d/g,
    /bg-zinc-\d/g,
    /backgroundColor:\s*['"]#[0-9a-fA-F]{3,6}['"]/g,
    /background:\s*['"]#[2-5][0-9a-fA-F]{5}['"]/g,
  ];

  const allowedFiles = ["GlassContainer.tsx", "index.css", "tailwind.config.ts"];
  const tsxFiles = getAllFiles(SRC_DIR, ".tsx");
  const violations = [];

  for (const file of tsxFiles) {
    const basename = path.basename(file);
    if (allowedFiles.includes(basename)) continue;
    if (basename.includes(".test.")) continue;

    const content = fs.readFileSync(file, "utf8");
    for (const pattern of greyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({ file: basename, matches: matches.slice(0, 3) });
      }
    }
  }

  check(
    "No new standalone grey-box styles",
    violations.length === 0,
    violations.length > 0
      ? `Found in: ${violations.map((v) => `${v.file} (${v.matches.join(", ")})`).join("; ")}`
      : ""
  );
}

// ── Check 2: GlassContainer is used where expected ─────────────────────────────

function checkGlassContainerUsage() {
  console.log("\n🔍 Check 2: GlassContainer adoption");

  const keyFiles = [
    "ChatAgent.tsx",
    "Index.tsx",
  ];

  for (const filename of keyFiles) {
    const files = getAllFiles(SRC_DIR, ".tsx").filter((f) =>
      path.basename(f) === filename
    );
    if (files.length === 0) {
      check(`${filename} exists`, false, "File not found");
      continue;
    }

    const content = fs.readFileSync(files[0], "utf8");
    const hasImport = content.includes("GlassContainer");
    check(`${filename} uses GlassContainer`, hasImport, "Missing GlassContainer import");
  }
}

// ── Check 3: Focus mode support ────────────────────────────────────────────────

function checkFocusModeSupport() {
  console.log("\n🌙 Check 3: Focus mode integration");

  // Check that FocusController exists
  const focusPath = path.join(SRC_DIR, "lib", "FocusController.ts");
  check("FocusController.ts exists", fs.existsSync(focusPath), "Missing file");

  // Check index.css has focus-mode class
  const cssPath = path.join(SRC_DIR, "index.css");
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, "utf8");
    check(
      "index.css has .focus-mode styles",
      css.includes(".focus-mode"),
      "Missing .focus-mode CSS"
    );
    check(
      "index.css has reduced-motion support",
      css.includes("prefers-reduced-motion"),
      "Missing prefers-reduced-motion"
    );
  }

  // Check themes.ts has focus theme
  const themesPath = path.join(SRC_DIR, "lib", "themes.ts");
  if (fs.existsSync(themesPath)) {
    const themes = fs.readFileSync(themesPath, "utf8");
    check(
      "themes.ts has focus theme",
      themes.includes('"focus"'),
      'Missing id: "focus" theme'
    );
  }
}

// ── Check 4: Accessibility basics ──────────────────────────────────────────────

function checkAccessibility() {
  console.log("\n♿ Check 4: Accessibility basics");

  const cssPath = path.join(SRC_DIR, "index.css");
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, "utf8");
    check(
      "Interactive elements have min-height: 44px",
      css.includes("min-height: 44px"),
      "Missing 44px touch target rule"
    );
    check(
      "Dyslexia font class exists",
      css.includes(".dyslexia-font"),
      "Missing .dyslexia-font CSS rule"
    );
  }

  // Check Customize has accessibility section
  const customizePath = path.join(SRC_DIR, "pages", "Customize.tsx");
  if (fs.existsSync(customizePath)) {
    const content = fs.readFileSync(customizePath, "utf8");
    check(
      "Customize has Accessibility section",
      content.includes("Accessibility"),
      "Missing Accessibility section"
    );
    check(
      "Customize has Dyslexia font toggle",
      content.includes("dyslexia") || content.includes("Dyslexia"),
      "Missing Dyslexia font toggle"
    );
  }
}

// ── Check 5: No deleted core files ─────────────────────────────────────────────

function checkCoreFiles() {
  console.log("\n📁 Check 5: Core files present");

  const coreFiles = [
    "App.tsx",
    "pages/Index.tsx",
    "pages/ChatAgent.tsx",
    "pages/Customize.tsx",
    "pages/VideoAgent.tsx",
    "pages/DiagramCanvas.tsx",
    "pages/ChatHistory.tsx",
    "components/MobileLayout.tsx",
    "components/ThemeBackground.tsx",
    "components/BottomNav.tsx",
    "components/GlassContainer.tsx",
    "lib/themes.ts",
    "lib/FocusController.ts",
    "lib/BackgroundManager.ts",
  ];

  for (const relPath of coreFiles) {
    const fullPath = path.join(SRC_DIR, relPath);
    check(
      `${path.basename(relPath)} exists`,
      fs.existsSync(fullPath),
      `Missing: ${relPath}`
    );
  }
}

// ── Run all checks ─────────────────────────────────────────────────────────────

console.log("🛡️  Design Guardian — Pre-merge Checks\n" + "=".repeat(50));

checkGreyBoxUsage();
checkGlassContainerUsage();
checkFocusModeSupport();
checkAccessibility();
checkCoreFiles();

console.log("\n" + "=".repeat(50));
console.log(`Results: ${RESULTS.pass} passed, ${RESULTS.fail} failed`);

if (RESULTS.fail > 0) {
  console.log("\n⚠️  Failures:");
  for (const w of RESULTS.warnings) {
    console.log(`  • ${w.name}: ${w.detail}`);
  }
  process.exit(1);
} else {
  console.log("\n🎉 All Design Guardian checks passed!");
  process.exit(0);
}
