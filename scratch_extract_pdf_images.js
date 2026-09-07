const fs = require('fs');

const buf = fs.readFileSync('C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf');

// Look for images in PDF
let count = 0;
let pos = 0;
while (true) {
  const start = buf.indexOf('/DCTDecode', pos);
  if (start === -1) break;
  console.log(`Found DCTDecode (JPEG Image) at pos ${start}`);
  
  const streamStart = buf.indexOf('stream', start);
  const streamEnd = buf.indexOf('endstream', streamStart);
  
  let sPos = streamStart + 6;
  if (buf[sPos] === 0x0d && buf[sPos + 1] === 0x0a) sPos += 2;
  else if (buf[sPos] === 0x0a || buf[sPos] === 0x0d) sPos += 1;

  const imgBuf = buf.slice(sPos, streamEnd);
  count++;
  fs.writeFileSync(`pdf_page_image_${count}.jpg`, imgBuf);
  console.log(`Saved pdf_page_image_${count}.jpg (size: ${imgBuf.length} bytes)`);

  pos = streamEnd + 9;
}

console.log('Total extracted images:', count);
