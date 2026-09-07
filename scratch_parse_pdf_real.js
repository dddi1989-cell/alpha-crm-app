const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf';

console.log('pdf type:', typeof pdf, Object.keys(pdf));

const parseFunc = typeof pdf === 'function' ? pdf : (pdf.default || pdf.PDFParser || Object.values(pdf).find(v => typeof v === 'function'));

const dataBuffer = fs.readFileSync(pdfPath);
parseFunc(dataBuffer).then(data => {
  console.log('PDF Page Count:', data.numpages);
  console.log('PDF Text Length:', data.text.length);
  fs.writeFileSync('parsed_codef_spec.txt', data.text, 'utf8');
  console.log('Saved to parsed_codef_spec.txt');
}).catch(err => {
  console.error('Error:', err);
});
