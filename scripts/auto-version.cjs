const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const currentVersion = pkg.version || '1.0.0';
const [cMajor, cMinor, cPatch] = currentVersion.split('.').map(n => parseInt(n, 10) || 0);

const major = cMajor;
const minor = cMinor;
let highestExistingTagPatch = -1;

// Fetch git tags to verify existing release versions in repository
try {
  execSync('git fetch --tags --force', { stdio: 'ignore' });
  const rawTags = execSync('git tag -l "v*"').toString();
  const tags = rawTags.split('\n').map(t => t.trim()).filter(Boolean);

  for (const tag of tags) {
    const clean = tag.replace(/^v/, '');
    const [tMaj, tMin, tPat] = clean.split('.').map(n => parseInt(n, 10) || 0);
    if (tMaj === major && tMin === minor && !isNaN(tPat)) {
      if (tPat > highestExistingTagPatch) {
        highestExistingTagPatch = tPat;
      }
    }
  }
} catch (e) {
  // Ignore errors in non-git or offline environments
}

let targetPatch = cPatch;

// If this tag version already exists in GitHub Releases, auto-increment to next patch
if (cPatch <= highestExistingTagPatch) {
  targetPatch = highestExistingTagPatch + 1;
}

const newVersion = `${major}.${minor}.${targetPatch}`;
pkg.version = newVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`[auto-version] Package version set to: ${newVersion} (current: ${currentVersion}, highest released: ${highestExistingTagPatch >= 0 ? `${major}.${minor}.${highestExistingTagPatch}` : 'none'})`);

// Export version for GitHub Actions workflow
if (process.env.GITHUB_OUTPUT) {
  try {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
  } catch (err) {
    console.error('Failed writing to GITHUB_OUTPUT:', err);
  }
}
