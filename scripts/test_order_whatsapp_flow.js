import fs from 'node:fs';

async function runTests() {
  console.log('=== STARTING AUTOMATIC ORDER CONFIRMATION & WHATSAPP TEST SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. WhatsApp status endpoint check
  try {
    const res = await fetch('http://localhost:3000/api/admin/whatsapp-status');
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'GET /api/admin/whatsapp-status returns 200');
    assert(data.ownerNumber === '+917302187770', 'Owner WhatsApp number is correctly set to +91 7302187770');
  } catch (err) {
    assert(false, `whatsapp-status failed: ${err.message}`);
  }

  // 2. WhatsApp message template formatting check
  try {
    const res = await fetch('http://localhost:3000/api/admin/test-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /api/admin/test-whatsapp succeeds');
    assert(data.previewMessage.includes('VIDHYAA JEWELLERY STUDIO'), 'WhatsApp message contains VIDHYAA JEWELLERY STUDIO header');
    assert(data.previewMessage.includes('🟢 NEW ORDER CONFIRMED ✓'), 'WhatsApp message contains 🟢 NEW ORDER CONFIRMED ✓');
    assert(data.previewMessage.includes('Order ID: VDH-TEST-001'), 'WhatsApp message contains Order ID');
    assert(data.previewMessage.includes('Mobile: +91 9876543210'), 'WhatsApp message contains Mobile');
    assert(data.previewMessage.includes('Payment Status: SUCCESSFUL'), 'WhatsApp message contains Payment Status: SUCCESSFUL');
    assert(data.previewMessage.includes('Please prepare this order for delivery.'), 'WhatsApp message contains call to action');
    assert(data.result.directLink.includes('wa.me/917302187770'), 'Direct wa.me link targets 917302187770');
  } catch (err) {
    assert(false, `test-whatsapp failed: ${err.message}`);
  }

  // 3. Create an order with pending payment (no false confirmation)
  const pendingOrderId = `order_test_pending_${Date.now()}`;
  const pendingOrderNumber = `VDH-PEND-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const createRes = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: pendingOrderId,
        orderNumber: pendingOrderNumber,
        customerName: 'Ananya Verma',
        customerPhone: '+91 9811122233',
        items: [{ productName: 'Royal Polki Choker', quantity: 1, price: 3500 }],
        totalAmount: 3500,
        paymentStatus: 'pending',
        orderStatus: 'Pending',
        paymentMethod: 'UPI'
      })
    });
    const createData = await createRes.json();
    assert(createData.order.orderStatus === 'Pending', 'Pending payment is NOT falsely marked Confirmed');
    assert(createData.order.paymentStatus === 'pending', 'Payment status remains pending until verification');
  } catch (err) {
    assert(false, `Pending order test failed: ${err.message}`);
  }

  // 4. Verify payment via Cashfree verify endpoint
  try {
    const verifyRes = await fetch('http://localhost:3000/api/payments/cashfree/verify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: pendingOrderId })
    });
    const verifyData = await verifyRes.json();
    assert(verifyData.success === true && verifyData.isPaid === true, 'Cashfree verify-order reports payment success');
    assert(verifyData.order && verifyData.order.orderStatus === 'Confirmed', 'Order automatically marked as Confirmed upon payment verification');
    assert(verifyData.order && verifyData.order.whatsappClickToChatUrl && verifyData.order.whatsappClickToChatUrl.includes('917302187770'), 'Click-to-chat WhatsApp link prepared for +91 7302187770');
  } catch (err) {
    assert(false, `Cashfree verify order test failed: ${err.message}`);
  }

  // 5. Duplicate payment notification prevention
  try {
    const secondVerifyRes = await fetch('http://localhost:3000/api/payments/cashfree/verify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: pendingOrderId })
    });
    const secondVerifyData = await secondVerifyRes.json();
    assert(secondVerifyData.success === true, 'Repeated verification succeeds without throwing');
  } catch (err) {
    assert(false, `Duplicate prevention test failed: ${err.message}`);
  }

  // 6. Check order in orders list
  try {
    const listRes = await fetch('http://localhost:3000/api/orders');
    const listData = await listRes.json();
    const found = listData.find(o => o.id === pendingOrderId);
    assert(found && found.orderStatus === 'Confirmed', 'Order persists as Confirmed in orders list');
  } catch (err) {
    assert(false, `Order retrieval test failed: ${err.message}`);
  }

  // Clean up test order so we do not pollute customer database
  try {
    const ordersFile = 'data/orders.json';
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    const filtered = orders.filter(o => o.id !== pendingOrderId);
    fs.writeFileSync(ordersFile, JSON.stringify(filtered, null, 2), 'utf8');
    console.log('Cleaned up ephemeral test order.');
  } catch (err) {
    console.warn('Cleanup notice:', err.message);
  }

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
