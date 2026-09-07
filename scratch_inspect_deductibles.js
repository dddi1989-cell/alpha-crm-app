const fs = require('fs');
const path = 'C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\scratch\\retrieved_hometax_raw.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log('Top level keys:', Object.keys(raw));
const data = raw.data;
console.log('Is Array?', Array.isArray(data), 'Length:', data?.length);

if (Array.isArray(data)) {
  data.forEach((item, i) => {
    console.log(`[Item ${i}] resDeductibleItem: ${item.resDeductibleItem}, resBasicList count: ${item.resBasicList?.length}`);
    if (item.resBasicList && item.resBasicList.length > 0) {
      item.resBasicList.slice(0, 3).forEach(b => {
        console.log(`   - ${b.resCompanyNm || b.resUserNm}: ${b.resAmount || b.resAmountPayment}원 (resType: ${b.resType})`);
      });
    }
  });
}
