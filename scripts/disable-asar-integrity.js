// disable-asar-integrity.js
// Removes the ASAR integrity hash from the Electron executable
// so that hot-swapping app.asar (micro-patch) does not cause
// Electron to refuse to start due to hash mismatch.
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  // On Windows, electron-builder embeds integrity info in the exe resource.
  // We strip it by removing the integrity entry from the package.json inside the asar.
  // The simplest reliable way: delete the integrity field from electron's internal check.
  const appOutDir = context.appOutDir;
  const exeName = context.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(appOutDir, exeName);

  if (!fs.existsSync(exePath)) return;

  console.log('[afterPack] Stripping ASAR integrity from:', exePath);

  // Read the exe binary and search for the integrity JSON sentinel
  const exeBuf = fs.readFileSync(exePath);

  // electron-builder stores integrity as a resource with sentinel "integrity"
  // We look for the JSON pattern and zero it out
  const sentinel = Buffer.from('{"algorithm":"SHA256"', 'utf8');
  let idx = exeBuf.indexOf(sentinel);
  if (idx === -1) {
    console.log('[afterPack] No ASAR integrity sentinel found. Skipping.');
    return;
  }

  // Find the end of the JSON object
  let braceDepth = 0;
  let jsonStart = idx;
  // Walk backwards to find the opening brace
  while (jsonStart > 0 && exeBuf[jsonStart] !== 0x7B) jsonStart--;

  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < exeBuf.length; i++) {
    if (exeBuf[i] === 0x7B) braceDepth++;
    if (exeBuf[i] === 0x7D) {
      braceDepth--;
      if (braceDepth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  // Replace the integrity JSON with spaces (same length to preserve exe structure)
  const len = jsonEnd - jsonStart;
  const replacement = Buffer.alloc(len, 0x20); // fill with spaces
  replacement[0] = 0x7B; // {
  replacement[1] = 0x7D; // }
  exeBuf.fill(0x20, jsonStart, jsonEnd);
  exeBuf[jsonStart] = 0x7B;
  exeBuf[jsonStart + 1] = 0x7D;

  fs.writeFileSync(exePath, exeBuf);
  console.log('[afterPack] ASAR integrity stripped successfully (' + len + ' bytes at offset ' + jsonStart + ')');
};
