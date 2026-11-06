import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'gen-lang-client-0706507905',
  appId: '1:160618488349:web:4bcb2d3acf5d9df2ba5cf4',
  apiKey: 'AIzaSyBLPj2e2dCfXiFM_lI_TIpMAc2ShzJ1p_4',
  authDomain: 'gen-lang-client-0706507905.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixvidhyaajewe-9c5bfd35-5275-4309-91ca-6a8bcd824c24',
  storageBucket: 'gen-lang-client-0706507905.firebasestorage.app'
};

async function checkDatabase(dbId) {
  console.log(`\n--- Checking Firestore Database: "${dbId}" ---`);
  try {
    const appName = `app_${dbId || 'default'}_${Date.now()}`;
    const app = initializeApp(firebaseConfig, appName);
    const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

    const ordersCol = collection(db, 'orders');
    const snapshot = await getDocs(ordersCol);
    console.log(`Successfully connected! Total orders in "${dbId}": ${snapshot.size}`);

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(` - Doc ID: ${doc.id}`);
      console.log(`   Order Number: ${data.orderNumber}`);
      console.log(`   Customer: ${data.customerName || data.shippingAddress?.fullName}`);
      console.log(`   Phone: ${data.customerPhone || data.shippingAddress?.phone}`);
      console.log(`   Payment Method: ${data.paymentMethod}`);
      console.log(`   Payment Status: ${data.paymentStatus}`);
      console.log(`   Order Status: ${data.orderStatus}`);
      console.log(`   Total Amount: ₹${data.totalAmount || data.total}`);
      console.log(`   UTR / Reference: ${data.paymentReference || data.utrNumber}`);
      console.log(`   Items: ${data.items?.length}`);
      console.log(`   Created At: ${data.createdAt}`);
    });
    return snapshot.size;
  } catch (err) {
    console.error(`Error querying "${dbId}":`, err.code, err.message);
    return -1;
  }
}

async function run() {
  // Test 1: configured databaseId
  await checkDatabase(firebaseConfig.firestoreDatabaseId);

  // Test 2: default databaseId '(default)'
  await checkDatabase('(default)');

  // Test 3: empty databaseId (default Firestore)
  await checkDatabase('');
}

run();
