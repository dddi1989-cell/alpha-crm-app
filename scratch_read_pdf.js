const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = 'C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf';

async function readPdf() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Total pages:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(s => s.str).join(' ');
    console.log(`\n--- PAGE ${i} ---`);
    console.log(pageText);
  }
}

readPdf().catch(console.error);
