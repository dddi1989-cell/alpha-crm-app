const { requestCodef2WayAuth } = require('./src/main/services/codefNtsService');

async function test() {
  console.log('Testing requestCodef2WayAuth execution directly...');
  try {
    const res = await requestCodef2WayAuth({
      sessionId: 'TEST_' + Date.now(),
      clientName: '이재성',
      clientPhone: '01076797880',
      clientBirth: '19890918',
      provider: 'kakao',
      targetYear: 2025
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('Error during execution:', err);
  }
}

test();
