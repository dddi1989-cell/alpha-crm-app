const fs = require('fs');
const { parseHometaxMultiYearsData } = require('./src/main/services/hometaxDataParser');

const rawData = JSON.parse(fs.readFileSync('C:\\Users\\dddi1\\.gemini\\antigravity\\brain\\90c4763b-e313-423a-a9ca-056066cf2d30\\scratch\\retrieved_hometax_raw.json', 'utf8'));

console.log('Testing parseHometaxMultiYearsData with raw CODEF response:');

const yearsMap = {
  2024: rawData
};

const result = parseHometaxMultiYearsData(yearsMap, {
  clientName: '이재성',
  clientPhone: '01076797880',
  clientBirth: '19890918',
  authProvider: 'kakao'
});

console.log('--- Parse Result ---');
console.log('Success:', result.success);
console.log('Total Expense Count:', result.totalExpenseCount);
console.log('Total Expense Amount:', result.totalExpenseAmount.toLocaleString() + '원');
console.log('Total Indemnity Count:', result.totalIndemnityCount);
console.log('Total Indemnity Amount:', result.totalIndemnityAmount.toLocaleString() + '원');
console.log('Unclaimed Estimated Amount:', result.unclaimedEstimatedAmount.toLocaleString() + '원');
console.log('byYear keys:', Object.keys(result.byYear));
for (const [yr, yrData] of Object.entries(result.byYear)) {
  console.log(` Year ${yr}: ${yrData.totalExpenseCount}건 (${yrData.totalExpenseAmount.toLocaleString()}원)`);
}
console.log('Top 3 Expenses:');
result.expenseList.slice(0, 3).forEach(e => {
  console.log(` - [${e.date}] ${e.hospitalName} (${e.patientName}): ${e.amount.toLocaleString()}원`);
});
