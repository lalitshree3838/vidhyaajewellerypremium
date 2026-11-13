import fs from 'node:fs';

async function testCustomerWhatsAppFlow() {
  console.log('=== RUNNING MANDATORY CUSTOMER WHATSAPP CONFIRMATION TEST SUITE ===');
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

  // 1. Create a verified paid test order
  const testOrderId = `order_cust_wa_${Date.now()}`;
  const testOrderNumber = `VDH-WA-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const createRes = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testOrderId,
        orderNumber: testOrderNumber,
        customerName: 'Pooja Kashyap',
        customerPhone: '+91 9988776655',
        customerEmail: 'pooja.kashyap@example.com',
        shippingAddress: {
          street: '45 Civil Lines',
          landmark: 'Opposite Clock Tower',
          city: 'Roorkee',
          state: 'Uttarakhand',
          pincode: '247667'
        },
        items: [
          { productName: 'Royal Kundan Choker Set', quantity: 1, price: 4200 },
          { productName: 'Gold Rajwada Kada', quantity: 2, price: 1500 }
        ],
        subtotal: 7200,
        discount: 500,
        deliveryCharge: 0,
        totalAmount: 6700,
        paymentStatus: 'paid',
        orderStatus: 'Confirmed',
        paymentMethod: 'Cashfree / UPI',
        paymentId: 'CF_TXN_9876543210'
      })
    });
    const createData = await createRes.json();
    assert(createRes.status === 200 && createData.success === true, 'Order created successfully');
    assert(createData.order.whatsappCustomerConfirmed !== true, 'Newly placed order has whatsappCustomerConfirmed false by default');
  } catch (err) {
    assert(false, `Order creation failed: ${err.message}`);
  }

  // 2. Customer confirms sending WhatsApp message via API
  try {
    const confirmRes = await fetch(`http://localhost:3000/api/orders/${testOrderId}/customer-whatsapp-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappCustomerConfirmed: true })
    });
    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 200 && confirmData.success === true, 'Customer WhatsApp confirmation endpoint returns 200');
    assert(confirmData.order.whatsappCustomerConfirmed === true, 'Order record updated with whatsappCustomerConfirmed: true');
    assert(typeof confirmData.order.whatsappCustomerConfirmedAt === 'string', 'whatsappCustomerConfirmedAt timestamp is recorded');
  } catch (err) {
    assert(false, `Customer confirmation endpoint failed: ${err.message}`);
  }

  // 3. Verify customer confirmation is persisted in data/orders.json
  try {
    const orders = JSON.parse(fs.readFileSync('data/orders.json', 'utf8'));
    const orderInDb = orders.find(o => o.id === testOrderId);
    assert(orderInDb && orderInDb.whatsappCustomerConfirmed === true, 'whatsappCustomerConfirmed persists in data/orders.json');
  } catch (err) {
    assert(false, `Database check failed: ${err.message}`);
  }

  // 4. Verify notification log in data/whatsapp_logs.json
  try {
    const logs = JSON.parse(fs.readFileSync('data/whatsapp_logs.json', 'utf8'));
    const customerLog = logs.find(l => l.orderId === testOrderNumber && l.type === 'CUSTOMER_WHATSAPP_CONFIRMATION');
    assert(customerLog !== undefined, 'Customer confirmation logged in data/whatsapp_logs.json');
    assert(customerLog && customerLog.status === 'CONFIRMED_BY_CUSTOMER', 'Log status is CONFIRMED_BY_CUSTOMER');
    assert(customerLog && customerLog.recipient === '+917302187770', 'Recipient is +917302187770');
  } catch (err) {
    assert(false, `WhatsApp logs check failed: ${err.message}`);
  }

  // 5. Verify Frontend bundle contains the required WhatsApp UI text & URL
  try {
    const bundleContent = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');
    assert(bundleContent.includes('CONFIRM ORDER ON WHATSAPP'), 'Bundle contains large green button "CONFIRM ORDER ON WHATSAPP"');
    assert(bundleContent.includes('https://wa.me/917302187770'), 'Bundle contains official click-to-chat URL https://wa.me/917302187770');
    assert(bundleContent.includes('WhatsApp Message Not Yet Sent'), 'Bundle clearly distinguishes "WhatsApp Message Not Yet Sent"');
    assert(bundleContent.includes('Payment Successful'), 'Bundle clearly distinguishes "Payment Successful"');
    assert(bundleContent.includes('WhatsApp Confirmation Completed'), 'Bundle clearly distinguishes "WhatsApp Confirmation Completed"');
    assert(bundleContent.includes('I Have Sent the Message on WhatsApp'), 'Bundle includes verification step "I Have Sent the Message on WhatsApp"');
    assert(bundleContent.includes('Did you press the SEND button in WhatsApp?'), 'Bundle includes prompt for manual SEND button press in WhatsApp');
  } catch (err) {
    assert(false, `Bundle content check failed: ${err.message}`);
  }

  // Clean up ephemeral test order
  try {
    const ordersFile = 'data/orders.json';
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    const filtered = orders.filter(o => o.id !== testOrderId);
    fs.writeFileSync(ordersFile, JSON.stringify(filtered, null, 2), 'utf8');
    console.log('Cleaned up ephemeral test order.');
  } catch (err) {
    console.warn('Cleanup notice:', err.message);
  }

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

testCustomerWhatsAppFlow();
