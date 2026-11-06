import https from 'node:https';

const projectId = 'gen-lang-client-0706507905';
const apiKey = 'AIzaSyBLPj2e2dCfXiFM_lI_TIpMAc2ShzJ1p_4';
const dbIds = [
  'ai-studio-remixvidhyaajewe-9c5bfd35-5275-4309-91ca-6a8bcd824c24',
  '(default)'
];

function fetchFirestore(databaseId, collectionPath) {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionPath}?key=${apiKey}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) res[k] = v.stringValue;
    else if ('integerValue' in v) res[k] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) res[k] = v.doubleValue;
    else if ('booleanValue' in v) res[k] = v.booleanValue;
    else if ('timestampValue' in v) res[k] = v.timestampValue;
    else if ('mapValue' in v) res[k] = parseFirestoreFields(v.mapValue.fields);
    else if ('arrayValue' in v) res[k] = (v.arrayValue.values || []).map(val => parseFirestoreFields({ item: val }).item);
    else res[k] = v;
  }
  return res;
}

async function run() {
  console.log('--- Querying Firestore REST API ---');

  for (const dbId of dbIds) {
    console.log(`\nChecking database: "${dbId}"`);
    
    // Check 'orders'
    const ordersRes = await fetchFirestore(dbId, 'orders');
    console.log(` - orders endpoint status: ${ordersRes.status}`);
    if (ordersRes.body?.documents) {
      console.log(`   Found ${ordersRes.body.documents.length} order documents!`);
      for (const doc of ordersRes.body.documents) {
        const id = doc.name.split('/').pop();
        const parsed = parseFirestoreFields(doc.fields);
        console.log(`\n   >>> Order Doc ID: ${id}`);
        console.log(`       orderNumber: ${parsed.orderNumber}`);
        console.log(`       customerName: ${parsed.customerName || parsed.shippingAddress?.fullName}`);
        console.log(`       customerPhone: ${parsed.customerPhone || parsed.shippingAddress?.phone}`);
        console.log(`       total: ₹${parsed.totalAmount || parsed.total}`);
        console.log(`       paymentMethod: ${parsed.paymentMethod}`);
        console.log(`       paymentStatus: ${parsed.paymentStatus}`);
        console.log(`       orderStatus: ${parsed.orderStatus}`);
        console.log(`       paymentReference: ${parsed.paymentReference || parsed.utrNumber}`);
        console.log(`       createdAt: ${parsed.createdAt}`);
      }
    } else {
      console.log(`   No documents found in orders collection or error:`, ordersRes.body?.error || ordersRes.body);
    }

    // Check 'products' to verify connection
    const prodRes = await fetchFirestore(dbId, 'products');
    console.log(` - products endpoint status: ${prodRes.status}, count: ${prodRes.body?.documents?.length || 0}`);
  }
}

run();
