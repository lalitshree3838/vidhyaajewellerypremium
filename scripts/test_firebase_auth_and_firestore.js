import https from 'node:https';

const apiKey = 'AIzaSyBLPj2e2dCfXiFM_lI_TIpMAc2ShzJ1p_4';
const projectId = 'gen-lang-client-0706507905';
const dbId = 'ai-studio-remixvidhyaajewe-9c5bfd35-5275-4309-91ca-6a8bcd824c24';

// 1. Try Anonymous Auth to get an ID token
function signInAnonymously() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ returnSecureToken: true });
    const req = https.request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

function fetchWithAuth(idToken, path) {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${path}`;
    const headers = idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
    https.get(url, { headers }, (res) => {
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

async function run() {
  console.log('Testing Firebase Auth & Firestore with ID token:');
  const authRes = await signInAnonymously();
  console.log('Anonymous Auth status:', authRes.status);
  const idToken = authRes.body?.idToken;
  console.log('Got ID Token:', !!idToken);

  if (idToken) {
    console.log('\nQuerying /orders with ID token:');
    const ordersRes = await fetchWithAuth(idToken, 'orders');
    console.log('Orders status:', ordersRes.status);
    console.log('Orders result:', JSON.stringify(ordersRes.body, null, 2));

    console.log('\nQuerying /products with ID token:');
    const prodRes = await fetchWithAuth(idToken, 'products');
    console.log('Products status:', prodRes.status);
    console.log('Products count:', prodRes.body?.documents?.length || 0);

    console.log('\nQuerying /users with ID token:');
    const usersRes = await fetchWithAuth(idToken, 'users');
    console.log('Users status:', usersRes.status);
    console.log('Users result:', JSON.stringify(usersRes.body, null, 2));
  }
}

run();
