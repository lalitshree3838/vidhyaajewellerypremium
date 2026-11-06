import fs from 'node:fs';

const content = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');

// Find firebase config
const marker = 'apiKey';
let pos = 0;
while ((pos = content.indexOf(marker, pos)) !== -1) {
  console.log('apiKey found at:', pos);
  console.log(content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 250)));
  pos += marker.length;
  break;
}

// Find initializeApp
const initIdx = content.indexOf('initializeApp(');
if (initIdx !== -1) {
  console.log('\ninitializeApp at:', initIdx);
  console.log(content.substring(Math.max(0, initIdx - 50), Math.min(content.length, initIdx + 300)));
}
