import fs from 'node:fs';

const content = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');

// Search for "PENDING VERIFICATION" or "Pending Payment"
const queries = ['PENDING VERIFICATION', 'Pending Payment', 'order details', 'OrderDetails', 'order-tracking', 'track-order'];
for (const q of queries) {
  let pos = 0;
  console.log(`\n=== Searching for: "${q}" ===`);
  while ((pos = content.indexOf(q, pos)) !== -1) {
    console.log(`- found at ${pos}:`);
    console.log(content.substring(Math.max(0, pos - 150), Math.min(content.length, pos + 250)));
    pos += q.length;
    break;
  }
}
