const fs = require('fs');

const buf = fs.readFileSync('C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\.user_uploaded\\media_1788072360573.pdf');

// Find occurrences of streams and decode
let str = buf.toString('binary');
console.log('Searching for keywords in binary stream:');
const keywords = ['simpleAuth', 'twoWayInfo', 'jobIndex', 'is2Way', 'income-tax-credit', 'CF-00000', 'CF-03002'];

keywords.forEach(kw => {
  const idx = str.indexOf(kw);
  console.log(`Keyword "${kw}": found at ${idx}`);
  if (idx !== -1) {
    console.log('Snippet:', str.substring(Math.max(0, idx - 50), Math.min(str.length, idx + 150)));
  }
});
