import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING VIDEO UPLOAD & ADMIN FLOW VERIFICATION SUITE ===');
  let passed = 0;
  let failed = 0;
  const createdVideoFiles = [];
  let testProductId = null;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Admin Login
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'anavneeraj2003@gmail.com', password: 'demo-check' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success && loginData.token, 'Admin login issues valid session token');
    const adminToken = loginData.token;

    // 2. Verify session endpoint
    const verifyRes = await fetch(`${BASE_URL}/api/admin/verify-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ token: adminToken })
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.valid === true, 'Admin verify-session validates token');

    // 3. Read a real MP4 from videos/uploads/ for realistic upload testing
    const uploadsDir = path.resolve('videos/uploads');
    const existingVideos = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.mp4'));
    assert(existingVideos.length > 0, `Found existing MP4 fixtures in videos/uploads (${existingVideos.length} files)`);
    const samplePath = path.join(uploadsDir, existingVideos[0]);
    const mp4Buffer = fs.readFileSync(samplePath);

    // 4. Test multipart/form-data upload (same format as updated frontend FormData)
    const formData = new FormData();
    const mp4Blob = new Blob([mp4Buffer], { type: 'video/mp4' });
    formData.append('video', mp4Blob, 'test_jewellery_reel.mp4');

    const uploadRes = await fetch(`${BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
        'x-file-name': encodeURIComponent('test_jewellery_reel.mp4'),
        'x-file-type': 'video/mp4'
      },
      body: formData
    });

    const uploadContentType = uploadRes.headers.get('content-type') || '';
    assert(uploadContentType.includes('application/json'), 'Upload response Content-Type is application/json (not HTML)');
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 200 && uploadData.success === true, 'multipart/form-data MP4 upload returns HTTP 200 success: true');
    assert(typeof uploadData.url === 'string' && uploadData.url.startsWith('/videos/uploads/') && uploadData.url.endsWith('.mp4'), `Returned valid persistent video URL: ${uploadData.url}`);
    assert(uploadData.sizeBytes === mp4Buffer.length, `Uploaded byte size matches original MP4 (${uploadData.sizeBytes} bytes)`);

    if (uploadData.fileName) {
      createdVideoFiles.push(uploadData.fileName);
    }

    // 5. Verify uploaded MP4 is physically saved and playable via HTTP 200 / Range
    const diskPath = path.resolve(uploadData.url.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), 'Uploaded MP4 exists on disk in persistent videos/uploads/');

    const fetchVideoRes = await fetch(`${BASE_URL}${uploadData.url}`);
    assert(fetchVideoRes.status === 200, `Uploaded MP4 URL serves HTTP 200 (${uploadData.url})`);
    const fetchedBuf = Buffer.from(await fetchVideoRes.arrayBuffer());
    assert(fetchedBuf.length === mp4Buffer.length, 'Served MP4 content length matches uploaded MP4');

    // 6. Test raw binary upload fallback as well
    const rawUploadRes = await fetch(`${BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
        'x-file-name': encodeURIComponent('raw_test_reel.mp4'),
        'x-file-type': 'video/mp4',
        'Content-Type': 'video/mp4'
      },
      body: mp4Buffer
    });
    const rawUploadData = await rawUploadRes.json();
    assert(rawUploadRes.status === 200 && rawUploadData.success === true && rawUploadData.url?.endsWith('.mp4'), 'Raw binary MP4 upload fallback also returns HTTP 200 with valid URL');
    if (rawUploadData.fileName) {
      createdVideoFiles.push(rawUploadData.fileName);
    }

    // 7. Error handling checks (never HTML)
    const unauthRes = await fetch(`${BASE_URL}/api/videos/upload`, {
      method: 'POST',
      body: formData
    });
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401 && unauthData.success === false, 'Missing admin token returns 401 JSON error');

    const badForm = new FormData();
    badForm.append('video', new Blob(['not a video'], { type: 'text/plain' }), 'malicious.txt');
    const badRes = await fetch(`${BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: badForm
    });
    const badData = await badRes.json();
    assert(badRes.status === 400 && badData.success === false, 'Unsupported file format returns 400 JSON error (not HTML)');

    // 8. Save product with uploaded videoUrl & verify persistence in /api/products
    testProductId = `prod_test_vid_${Date.now()}`;
    const saveProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        product: {
          id: testProductId,
          name: 'Test Video Verification Choker',
          slug: 'test-video-verification-choker',
          categoryId: 'necklaces',
          categoryName: 'Necklaces & Necklace Sets',
          subcategory: 'Chokers',
          price: 1999,
          mrp: 3999,
          stock: 5,
          inStock: true,
          active: true,
          published: true,
          status: 'published',
          material: '22K Micro Gold Plated Brass',
          description: 'Temporary test product for video upload verification',
          images: ['https://i.postimg.cc/B6hD0NtY/Royal-Pearl-Gold-Choker-Set-l-Rs-1550.jpg'],
          videoUrl: uploadData.url,
          showInShoppingVideos: true,
          variations: [{ id: 'var_test_1', name: 'Gold', colorFinish: 'Gold', hexCode: '#D4AF37', sku: 'TEST-1', price: 1999, mrp: 3999, stock: 5, active: true }]
        }
      })
    });
    const saveProdData = await saveProdRes.json();
    assert(saveProdRes.status === 200 && saveProdData.success === true, 'Product saved via POST /api/products');

    const listRes = await fetch(`${BASE_URL}/api/products`);
    const products = await listRes.json();
    const savedProd = products.find(p => p.id === testProductId);
    assert(savedProd && savedProd.videoUrl === uploadData.url, 'Saved product persists uploaded videoUrl across reload/fetch');

    // 9. Verify frontend bundle guards
    const bundle = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');
    assert(bundle.includes("o.append(`video`,e,e.name)"), 'Frontend OP() sends FormData video field to /api/videos/upload');
    assert(bundle.includes("window.addEventListener(`dragover`") && bundle.includes("window.addEventListener(`drop`"), 'Frontend prevents accidental drag/drop browser navigation');
    assert(!bundle.includes("children:y?(0,I.jsxDEV)(`form`"), 'Nested <form> inside VideoDropzoneUploader removed');
    assert(bundle.includes("window.location.pathname.includes(`/admin`)"), 'App.tsx initializes admin route synchronously from URL');

    // 10. Verify Hostinger .htaccess & upload.php
    const htaccess = fs.readFileSync('.htaccess', 'utf8');
    assert(htaccess.includes('RewriteRule ^api/videos/upload/?$ /api/videos/upload.php'), '.htaccess routes /api/videos/upload to /api/videos/upload.php');
    assert(fs.existsSync('api/videos/upload.php'), 'api/videos/upload.php exists for Hostinger production');
  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    // Cleanup ONLY ephemeral test artifacts (preserve all existing data!)
    if (testProductId) {
      try {
        await fetch(`${BASE_URL}/api/products/${encodeURIComponent(testProductId)}`, { method: 'DELETE' });
        console.log('Cleaned up ephemeral test product:', testProductId);
      } catch {}
    }
    for (const fileName of createdVideoFiles) {
      for (const dir of ['videos/uploads', 'dist/videos/uploads']) {
        const p = path.resolve(dir, fileName);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    }
    console.log('Cleaned up ephemeral test uploaded video files.');
  }

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
