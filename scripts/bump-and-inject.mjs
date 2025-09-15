// scripts/bump-and-inject.mjs
import fs from "fs";

// Accept: "patch" | "minor" | "none" (default: "patch")
const BUMP = (process.env.BUMP || "patch").toLowerCase();

// Validate BUMP value
if (!["patch", "minor", "none"].includes(BUMP)) {
  console.error(`Invalid BUMP value: "${BUMP}". Must be "patch", "minor", or "none".`);
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


// Paths for both package.json files
const rootPkgPath = "package.json";
const libPkgPath = "projects/tis-image-and-file-upload-and-view/package.json";

const rootPkg = readJSON(rootPkgPath);
const libPkg = exists(libPkgPath) ? readJSON(libPkgPath) : null;

// 1) Decide new version (from root)
let newVersion = rootPkg.version;

if (BUMP === "minor") {
  newVersion = bumpMinor(rootPkg.version);
} else if (BUMP === "patch") {
  newVersion = bumpPatch(rootPkg.version);
} else if (BUMP === "none") {
  // keep current version
} else {
  newVersion = bumpPatch(rootPkg.version);
}

// Update both package.json files
rootPkg.version = newVersion;
writeJSON(rootPkgPath, rootPkg);
console.log(`Root package.json bumped → ${newVersion}`);

if (libPkg) {
  libPkg.version = newVersion;
  writeJSON(libPkgPath, libPkg);
  console.log(`Library package.json bumped → ${newVersion}`);
}

