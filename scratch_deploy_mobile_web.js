const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployMobileWeb() {
  console.log('=== Starting Mobile Web (gh-pages) Deployment ===\n');

  // 1. Build latest web bundle
  console.log('1. Building latest renderer bundle...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Prepare temporary directory for gh-pages
  const tempDir = path.resolve(__dirname, 'temp_gh_pages');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // 3. Clone / checkout gh-pages branch into tempDir
  console.log('2. Setting up gh-pages worktree...');
  try {
    execSync(`git worktree remove "${tempDir}" --force`, { stdio: 'ignore' });
  } catch (e) {}

  execSync(`git worktree add -B gh-pages "${tempDir}" origin/gh-pages`, { stdio: 'inherit' });

  // 4. Copy dist files into tempDir
  console.log('3. Copying dist files to gh-pages branch...');
  const distDir = path.resolve(__dirname, 'dist');
  
  // Copy all files from dist to tempDir
  function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(distDir, tempDir);

  // Ensure .nojekyll exists
  fs.writeFileSync(path.join(tempDir, '.nojekyll'), '', 'utf8');

  // 5. Git add, commit, push to gh-pages
  console.log('4. Committing and pushing to origin/gh-pages...');
  execSync('git add -A', { cwd: tempDir, stdio: 'inherit' });
  try {
    execSync('git commit -m "feat: deploy mobile web with Hidden Insurance (Medical Expense) tool"', { cwd: tempDir, stdio: 'inherit' });
    execSync('git push origin gh-pages', { cwd: tempDir, stdio: 'inherit' });
    console.log('\n🎉 Successfully deployed Mobile Web to GitHub Pages!');
    console.log('URL: https://dddi1989-cell.github.io/alpha-crm-app/\n');
  } catch (e) {
    console.log('No new changes to commit or push error:', e.message);
  } finally {
    // Cleanup worktree
    try {
      execSync(`git worktree remove "${tempDir}" --force`, { stdio: 'ignore' });
    } catch (e) {}
  }
}

deployMobileWeb().catch(err => {
  console.error('Deployment Failed:', err);
  process.exit(1);
});
