const fs = require('fs');

// Search strings in PDF
const pdfBuffer = fs.readFileSync('C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf');
const pdfText = pdfBuffer.toString('latin1');

console.log('PDF Length:', pdfBuffer.length);

// Extract readable text chunks
const matches = pdfText.match(/[\x20-\x7E]{4,}/g) || [];
const filtered = matches.filter(m => 
  m.includes('twoWay') || 
  m.includes('is2Way') || 
  m.includes('simpleAuth') || 
  m.includes('twoWayInfo') || 
  m.includes('jobIndex') ||
  m.includes('jti') ||
  m.includes('income-tax-credit') ||
  m.includes('etc-yearend-tax')
);

console.log('Relevant text matches in PDF:');
filtered.slice(0, 30).forEach(m => console.log(' - ' + m));
