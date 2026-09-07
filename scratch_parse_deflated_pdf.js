const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf');

let pos = 0;
let streams = [];
while (true) {
  const start = buf.indexOf('stream', pos);
  if (start === -1) break;
  const end = buf.indexOf('endstream', start);
  if (end === -1) break;
  
  let sPos = start + 6;
  if (buf[sPos] === 0x0d && buf[sPos + 1] === 0x0a) sPos += 2;
  else if (buf[sPos] === 0x0a || buf[sPos] === 0x0d) sPos += 1;

  const streamBuf = buf.slice(sPos, end);
  try {
    const decomp = zlib.inflateSync(streamBuf);
    streams.push(decomp.toString('utf8'));
  } catch (e) {
    try {
      const rawDecomp = zlib.inflateRawSync(streamBuf);
      streams.push(rawDecomp.toString('utf8'));
    } catch (e2) {}
  }
  pos = end + 9;
}

console.log('Extracted streams count:', streams.length);
const allText = streams.join('\n');

const keywords = ['simpleAuth', 'twoWayInfo', 'jobIndex', 'is2Way', 'CF-00000', 'CF-03002', '다건', '추가인증'];
keywords.forEach(kw => {
  const idx = allText.indexOf(kw);
  console.log(`Keyword "${kw}": ${idx !== -1 ? 'FOUND at ' + idx : 'NOT FOUND'}`);
  if (idx !== -1) {
    console.log(`Snippet [${kw}]:`, allText.substring(Math.max(0, idx - 100), Math.min(allText.length, idx + 200)));
  }
});
