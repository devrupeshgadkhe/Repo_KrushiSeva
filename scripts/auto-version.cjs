const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const currentVersion = pkg.version || '1.0.0';
const [cMajor, cMinor, cPatch] = currentVersion.split('.').map(n => parseInt(n, 10) || 0);

const major = cMajor;
const minor = cMinor;
let highestPatch = cPatch;

// Try to fetch tags and scan existing releases/tags in Git
try {
  execSync('git fetch --tags --force', { stdio: 'ignore' });
  const rawTags = execSync('git tag -l "v*"').toString();
  const tags = rawTags.split('\n').map(t => t.trim()).filter(Boolean);

  for (const tag of tags) {
    const clean = tag.replace(/^v/, '');
    const [tMaj, tMin, tPat] = clean.split('.').map(n => parseInt(n, 10) || 0);
    if (tMaj === major && tMin === minor && !isNaN(tPat)) {
      if (tPat > highestPatch) {
        highestPatch = tPat;
      }
    }
  }
} catch (e) {
  // Ignore git tag fetch errors in non-git or shallow environments
}

// Next patch version is always at least highest existing + 1
let nextPatch = highestPatch + 1;

// If GITHUB_RUN_NUMBER is available and higher, align to avoid any collision
const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || '0', 10);
if (runNumber > 0 && runNumber > nextPatch) {
  nextPatch = runNumber;
}

const newVersion = `${major}.${minor}.${nextPatch}`;
pkg.version = newVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`[auto-version] Bumping version: ${currentVersion} ➔ ${newVersion}`);

// Support GitHub Actions step output
if (process.env.GITHUB_OUTPUT) {
  try {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
  } catch (err) {
    console.error('Failed writing to GITHUB_OUTPUT:', err);
  }
}
