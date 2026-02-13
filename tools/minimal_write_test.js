const fs = require('fs');
const path = require('path');
const marker = path.join(__dirname, 'minimal_test_marker.txt');
try {
  fs.writeFileSync(marker, `marker:${new Date().toISOString()}\n`);
  console.log('WROTE', marker);
} catch (e) {
  console.error('WRITE_FAILED', e && e.message);
  try { fs.writeFileSync(path.join(__dirname, 'minimal_test_error.txt'), String(e)); } catch (e2) {}
  process.exit(1);
}