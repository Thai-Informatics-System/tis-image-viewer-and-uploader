// scripts/bump-and-inject.mjs
import fs from "fs";

// Accept: "patch" | "minor" | "none" (default: "patch")
const BUMP = (process.env.BUMP || "patch").toLowerCase();

// ✅ GET LIB_NAME from environment variable passed from GitHub workflow
const LIB_NAME = process.env.LIB_NAME;

// Validate required environment variables
if (!LIB_NAME) {
  console.error("❌ LIB_NAME environment variable is required");
  process.exit(1);
}

// Validate BUMP value
if (!["patch", "minor", "none"].includes(BUMP)) {
  console.error(`❌ Invalid BUMP value: "${BUMP}". Must be "patch", "minor", or "none".`);
  process.exit(1);
}

function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJSON(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

// Safe semver bumpers (ignore any prerelease/build metadata)
function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Invalid semver in package.json: "${v}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}
function bumpMinor(v) {
  const { major, minor } = parseSemver(v);
  return `${major}.${minor + 1}.0`;
}
function bumpPatch(v) {
  const { major, minor, patch } = parseSemver(v);
  return `${major}.${minor}.${patch + 1}`;
}


// ✅ Use LIB_NAME environment variable to build the correct paths
const rootPkgPath = "package.json";
const libPkgPath = `projects/${LIB_NAME}/package.json`;

console.log(`📦 Processing library: ${LIB_NAME}`);
console.log(`📁 Library package.json path: ${libPkgPath}`);

// Ensure both files exist
if (!exists(rootPkgPath)) {
  console.error(`❌ Root package.json not found at: ${rootPkgPath}`);
  process.exit(1);
}

if (!exists(libPkgPath)) {
  console.error(`❌ Library package.json not found at: ${libPkgPath}`);
  process.exit(1);
}

const rootPkg = readJSON(rootPkgPath);
const libPkg = readJSON(libPkgPath);

// 1) Decide new version (from root)
let newVersion = rootPkg.version;

if (BUMP === "minor") {
  newVersion = bumpMinor(rootPkg.version);
} else if (BUMP === "patch") {
  newVersion = bumpPatch(rootPkg.version);
} else if (BUMP === "none") {
  console.log(`⚪ BUMP=none: keeping current version ${newVersion}`);
}

console.log(`🔄 Bumping version from ${rootPkg.version} → ${newVersion}`);

// Update both package.json files with proper error handling
try {
  // Update root package.json
  rootPkg.version = newVersion;
  writeJSON(rootPkgPath, rootPkg);
  console.log(`✅ Root package.json updated → ${newVersion}`);

  // Update library package.json  
  libPkg.version = newVersion;
  writeJSON(libPkgPath, libPkg);
  console.log(`✅ Library package.json (${LIB_NAME}) updated → ${newVersion}`);

  // Verify the updates were successful
  const verifyRoot = readJSON(rootPkgPath);
  const verifyLib = readJSON(libPkgPath);
  
  if (verifyRoot.version !== newVersion || verifyLib.version !== newVersion) {
    console.error("❌ Version update verification failed!");
    console.error(`Root version: ${verifyRoot.version}, Library version: ${verifyLib.version}, Expected: ${newVersion}`);
    process.exit(1);
  }
  
  console.log(`🎉 Version synchronization successful for ${LIB_NAME}!`);
  
} catch (error) {
  console.error("❌ Failed to update package.json files:", error.message);
  process.exit(1);
}

