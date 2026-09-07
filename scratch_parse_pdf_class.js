const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf';

async function parse() {
  const dataBuffer = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  
  const fullText = result.text || result;
  fs.writeFileSync('parsed_codef_spec.txt', fullText, 'utf8');
  console.log('Saved to parsed_codef_spec.txt! Text Length:', fullText.length);

  // Search sections
  const lines = fullText.split('\n');
  console.log('\n--- First 30 lines ---');
  lines.slice(0, 30).forEach((l, i) => console.log(`${i + 1}: ${l}`));
}

parse().catch(console.error);
