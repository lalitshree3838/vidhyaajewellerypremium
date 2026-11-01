import http from 'node:http';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- STARTING COMPREHENSIVE AUTH TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('✅ PASS:', message);
      passed++;
    } else {
      console.error('❌ FAIL:', message);
      failed++;
    }
  }

  // 1. Health & Status
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200 && healthRes.json?.status === 'ok', 'Server health is ok');

  const statusRes = await request('GET', '/api/auth/status');
  assert(statusRes.status === 200 && statusRes.json?.ready === true, 'Auth service status is ready');

  // 2. Validate invalid mobile input on registration
  const invalidPhoneRes = await request('POST', '/api/auth/mobile-register', {
    phone: '123456',
    password: 'securePassword123',
    name: 'Test Patron'
  });
  assert(invalidPhoneRes.status === 400 && invalidPhoneRes.json?.code === 'INVALID_PHONE', 'Rejects invalid mobile number on registration');

  // 3. Validate short password
  const shortPassRes = await request('POST', '/api/auth/mobile-register', {
    phone: '9811122233',
    password: '123',
    name: 'Test Patron'
  });
  assert(shortPassRes.status === 400 && shortPassRes.json?.code === 'INVALID_PASSWORD_LENGTH', 'Rejects password shorter than 6 characters');

  // 4. Validate password mismatch
  const mismatchRes = await request('POST', '/api/auth/mobile-register', {
    phone: '9811122233',
    password: 'secretPassword1',
    confirmPassword: 'differentPassword2',
    name: 'Test Patron'
  });
  assert(mismatchRes.status === 400 && mismatchRes.json?.code === 'PASSWORD_MISMATCH', 'Rejects mismatched confirmPassword');

  // 5. Test new customer registration
  const testPhone = '9811100022';
  const testPassword = 'PatronPassword!@#123';
  const testName = 'Aarav Singhania';

  // Ensure test patron isn't existing before test
  const patrons = JSON.parse(fs.readFileSync('data/patrons.json', 'utf8'));
  const filtered = patrons.filter((p) => p.mobile !== testPhone);
  fs.writeFileSync('data/patrons.json', JSON.stringify(filtered, null, 2), 'utf8');

  const regRes = await request('POST', '/api/auth/mobile-register', {
    phone: `+91 ${testPhone}`,
    mobile: testPhone,
    password: testPassword,
    confirmPassword: testPassword,
    name: testName
  });
  assert(
    regRes.status === 200 && regRes.json?.success === true && regRes.json?.user?.mobile === testPhone,
    'Registers new patron successfully and creates authenticated session'
  );

  // 6. Test duplicate registration rejection
  const dupRes = await request('POST', '/api/auth/mobile-register', {
    phone: `+91${testPhone}`,
    password: 'anotherPassword456',
    name: 'Duplicate Test'
  });
  assert(dupRes.status === 409 && dupRes.json?.code === 'ACCOUNT_EXISTS', 'Rejects duplicate registration with 409 ACCOUNT_EXISTS');

  // 7. Test invalid password login
  const wrongPassRes = await request('POST', '/api/auth/mobile-login', {
    phone: testPhone,
    password: 'WrongPassword999'
  });
  assert(wrongPassRes.status === 401 && wrongPassRes.json?.code === 'INVALID_CREDENTIALS', 'Rejects incorrect password with 401 INVALID_CREDENTIALS');

  // 8. Test valid customer login with 10 digits
  const loginRes10 = await request('POST', '/api/auth/mobile-login', {
    phone: testPhone,
    password: testPassword
  });
  assert(loginRes10.status === 200 && loginRes10.json?.success === true, 'Signs in successfully with 10-digit number');

  // 9. Test valid customer login with +91 prefix
  const loginRes91 = await request('POST', '/api/auth/mobile-login', {
    phone: `+91 ${testPhone}`,
    password: testPassword
  });
  assert(loginRes91.status === 200 && loginRes91.json?.success === true, 'Signs in successfully with +91 prefix');

  // 10. Test format normalization with registered patron (+91, leading 0, 91 prefix)
  const loginRes0 = await request('POST', '/api/auth/mobile-login', {
    phone: `0${testPhone}`,
    password: testPassword
  });
  assert(loginRes0.status === 200 && loginRes0.json?.user?.mobile === testPhone, 'Signs in successfully with leading 0 (09811100022)');

  const loginRes91Prefix = await request('POST', '/api/auth/mobile-login', {
    phone: `91${testPhone}`,
    password: testPassword
  });
  assert(loginRes91Prefix.status === 200 && loginRes91Prefix.json?.user?.mobile === testPhone, 'Signs in successfully with 91 prefix (919811100022)');

  // 11. Test Admin login
  const adminRes = await request('POST', '/api/admin/login', {
    email: 'anavneeraj2003@gmail.com',
    password: 'any'
  });
  assert(adminRes.status === 200 && adminRes.json?.success === true && adminRes.json?.token, 'Admin account login works');

  // 12. Test frontend bundle serves properly and includes both options
  const bundleContent = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');
  assert(bundleContent.includes('Existing Customer: Sign In'), 'Bundle includes "Existing Customer: Sign In" option');
  assert(bundleContent.includes('New Customer: Create Account / Register'), 'Bundle includes "New Customer: Create Account / Register" option');
  assert(bundleContent.includes('/api/auth/mobile-register'), 'Bundle connects to mobile registration API');

  // Clean up test patron to preserve pristine original state
  const cleanPatrons = JSON.parse(fs.readFileSync('data/patrons.json', 'utf8')).filter((p) => p.mobile !== testPhone);
  fs.writeFileSync('data/patrons.json', JSON.stringify(cleanPatrons, null, 2), 'utf8');

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
