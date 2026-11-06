import fs from 'node:fs';

const content = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');

// Search for functions using xE (`orders`)
let pos = 0;
console.log('Occurrences of xE in bundle:');
while ((pos = content.indexOf('xE', pos)) !== -1) {
  const snippet = content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 150));
  if (snippet.includes('rE') || snippet.includes('collection') || snippet.includes('getDocs') || snippet.includes('addDoc') || snippet.includes('setDoc')) {
    console.log(`- at ${pos}: ${snippet}\n`);
  }
  pos += 2;
}

// Search for TE (`vidhyaa_orders_cache`)
pos = 0;
console.log('\nOccurrences of TE (orders cache) in bundle:');
while ((pos = content.indexOf('TE', pos)) !== -1) {
  const snippet = content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 100));
  if (snippet.includes('EE') || snippet.includes('DE') || snippet.includes('localStorage') || snippet.includes('order')) {
    console.log(`- at ${pos}: ${snippet}\n`);
  }
  pos += 2;
}
