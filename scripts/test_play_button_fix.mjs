import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// 1. Verify dist/ and safe-deploy-package/ integrity
const distHtml = fs.readFileSync('dist/index.html', 'utf8');
const jsMatch = distHtml.match(/src="(\/assets\/index-[^"]+\.js)"/);
const cssMatch = distHtml.match(/href="(\/assets\/index-[^"]+\.css)"/);
assert(!!jsMatch && jsMatch[1] === '/assets/index-BaL4kABd.js', `dist/index.html references new bundle /assets/index-BaL4kABd.js (got ${jsMatch?.[1]})`);
assert(!!cssMatch && cssMatch[1] === '/assets/index-CD1gwki0.css', `dist/index.html references /assets/index-CD1gwki0.css`);
assert(!distHtml.includes('index-DfwSxkcQ.js') && !distHtml.includes('index-_P-bKwFU.js'), 'dist/index.html does not reference stale bundles');

const distBundlePath = path.join('dist', jsMatch[1].replace(/^\//, ''));
const distBundle = fs.readFileSync(distBundlePath, 'utf8');
assert(sha256(distBundlePath) === sha256(path.join('safe-deploy-package', jsMatch[1].replace(/^\//, ''))), 'safe-deploy-package JS matches dist JS byte-for-byte (SHA-256 identical)');
assert(sha256('dist/index.html') === sha256('safe-deploy-package/index.html'), 'safe-deploy-package/index.html matches dist/index.html byte-for-byte');

// 2. Static DOM & CSS safety checks on built dist/assets/index-BaL4kABd.js
const diagnosticLogs = [
  '[ShopByVideo] Play button clicked',
  '[ShopByVideo] play() Promise RESOLVED',
  '[ShopByVideo] play() Promise REJECTED',
  '[ShopByVideo] Video playback error event',
  '[ShopByVideo Modal] Play button clicked',
  '[ShopByVideo Modal] Play button play() RESOLVED',
  '[ShopByVideo Modal] Play button play() REJECTED',
  '[SeamlessLoopVideo] Play button clicked',
  '[SeamlessLoopVideo] play() Promise RESOLVED',
  '[SeamlessLoopVideo] play() Promise REJECTED',
  '[SeamlessLoopVideo] Playback error'
];
for (const log of diagnosticLogs) {
  assert(distBundle.includes(log), `Built production bundle contains diagnostic log: ${log}`);
}

// Verify modalPlaying no longer initializes to fake true (!0)
const modalInitIdx = distBundle.indexOf('[ShopByVideo Modal] Play button clicked');
const sbvSectionSlice = distBundle.slice(Math.max(0, distBundle.indexOf('uN=') ), modalInitIdx + 1500);
assert(!sbvSectionSlice.includes('useState)(!0),[modalMuted') && sbvSectionSlice.includes('useState)(!1)'), 'ShopByVideoSection modalPlaying initializes to false (no fake playback state)');

// Verify no destructive t.load() right before play() on normal Play clicks
const pnSnippet = distBundle.slice(distBundle.indexOf('[ShopByVideo] Play button clicked') - 250, distBundle.indexOf('[ShopByVideo] Video playback error event') + 1500);
assert(pnSnippet.includes('t.error||t.networkState===3'), 'PN click handler only calls el.load() on actual media error / NETWORK_NO_SOURCE');
assert(pnSnippet.includes('zIndex:25') && pnSnippet.includes('pointerEvents:`auto`'), 'PN Play button sets zIndex: 25 and pointerEvents: auto above scrim/overlays');

const lkSnippet = distBundle.slice(distBundle.indexOf('[SeamlessLoopVideo] Play button clicked') - 250, distBundle.indexOf('[SeamlessLoopVideo] Play button clicked') + 3800);
assert(lkSnippet.includes('zIndex:30') && lkSnippet.includes('pointerEvents:`auto`'), 'SeamlessLoopVideo Play button renders at zIndex: 30 with pointerEvents: auto');

// 3. Simulate real React hook + Play Button DOM & click execution against the EXACT built code
// Extract PN function expression cleanly from distBundle and test both:
//   (a) Play resolves with !el.paused -> logs clicked + resolved, invokes el.play(), stops propagation, hides overlay
//   (b) Play rejects with NotAllowedError -> logs clicked + rejected, does NOT set playing=true (no fake state!)
const fnNameMatch = distBundle.match(/([A-Za-z_$][\w$]*)=\(\{videoUrl:e,fallbackImage:t,title:n,isMuted:r=!0,isActive:i=!0\}\)=>\{/);
assert(!!fnNameMatch, 'Located compiled ReelVideoPlayer component in built dist bundle');

if (fnNameMatch) {
  const startIdx = distBundle.indexOf(fnNameMatch[0]);
  // Balance braces to extract exact compiled component body
  let depth = 0, i = startIdx + fnNameMatch[0].length - 1;
  for (; i < distBundle.length; i++) {
    const ch = distBundle[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const fnSource = distBundle.slice(startIdx + fnNameMatch[1].length + 1, i + 1);

  // Build minimal hook harness in VM so the EXACT compiled dist component executes
  const capturedLogs = [];
  const fakeConsole = {
    log: (...a) => capturedLogs.push(['log', ...a]),
    warn: (...a) => capturedLogs.push(['warn', ...a]),
    error: (...a) => capturedLogs.push(['error', ...a])
  };

  function runHookComponent(videoBehavior) {
    capturedLogs.length = 0;
    const states = [];
    const refs = [];
    let statePtr = 0;
    let refPtr = 0;
    let cbPtr = 0;
    const cbs = [];

    const mockVideoEl = {
      src: '',
      currentSrc: 'https://vidhyaajewellerystudio.com/videos/uploads/test.mp4',
      paused: true,
      muted: true,
      defaultMuted: true,
      playsInline: true,
      readyState: 4,
      networkState: 1,
      error: null,
      loadCalls: 0,
      playCalls: 0,
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] ?? this.src; },
      removeAttribute(k) { delete this.attrs[k]; },
      load() { this.loadCalls++; },
      play() {
        this.playCalls++;
        if (videoBehavior === 'resolve') {
          this.paused = false;
          return Promise.resolve();
        }
        return Promise.reject(Object.assign(new Error('NotAllowedError: play blocked'), { name: 'NotAllowedError' }));
      }
    };

    const hooks = {
      useRef: (init) => {
        const idx = refPtr++;
        if (!refs[idx]) refs[idx] = { current: init };
        return refs[idx];
      },
      useState: (init) => {
        const idx = statePtr++;
        if (!(idx in states)) states[idx] = typeof init === 'function' ? init() : init;
        const setter = (val) => {
          states[idx] = typeof val === 'function' ? val(states[idx]) : val;
        };
        return [states[idx], setter];
      },
      useCallback: (fn) => {
        const idx = cbPtr++;
        cbs[idx] = fn;
        return fn;
      },
      useEffect: () => {}
    };

    const jsxDEV = (type, props) => ({ type, props });

    // Detect helper identifiers referenced inside fnSource (in Vite/Rolldown minified code they vary by hash)
    const uNMatch = fnSource.match(/,s=([A-Za-z_$][\w$]*)\(e\),/);
    const jsxMatch = fnSource.match(/\(0,([A-Za-z_$][\w$]*)\.jsxDEV\)/);
    const iconMatch = fnSource.match(/children:\(0,[A-Za-z_$][\w$]*\.jsxDEV\)\(([A-Za-z_$][\w$]*),\{className:/);
    const fileMatch = fnSource.match(/fileName:([A-Za-z_$][\w$]*),lineNumber:60/);
    const hookMatch = fnSource.match(/\(0,([A-Za-z_$][\w$]*)\.useRef\)/);

    const scope = {
      console: fakeConsole,
      IntersectionObserver: undefined,
      window: { addEventListener() {}, removeEventListener() {} },
      document: { addEventListener() {}, removeEventListener() {} }
    };
    if (hookMatch) scope[hookMatch[1]] = hooks;
    if (jsxMatch) scope[jsxMatch[1]] = { jsxDEV };
    if (uNMatch) scope[uNMatch[1]] = (u) => u;
    if (iconMatch) scope[iconMatch[1]] = 'PlayIcon';
    if (fileMatch) scope[fileMatch[1]] = 'ShopByVideoSection.tsx';

    const comp = vm.runInNewContext(`(${fnSource})`, scope);
    const props = {
      videoUrl: '/videos/uploads/whatsapp_video_2026-10-26_at_8_24_18_pm_1793205548029_rufk.mp4',
      fallbackImage: 'https://i.postimg.cc/B6hD0NtY/Royal-Pearl-Gold-Choker-Set-l-Rs-1550.jpg',
      title: 'Royal Diamond Solitaire Ring',
      isMuted: true,
      isActive: true
    };

    const renderOnce = () => {
      statePtr = 0; refPtr = 0; cbPtr = 0;
      const tree = comp(props);
      // Attach ref manually as React does on mount
      refs[0].current = mockVideoEl;
      return tree;
    };

    const tree1 = renderOnce();
    const buttonVNode = tree1.props.children.find(c => c && c.type === 'button');
    const videoVNode = tree1.props.children.find(c => c && c.type === 'video');
    return { buttonVNode, videoVNode, renderOnce, mockVideoEl, states };
  }

  // Test Scenario A: Real click resolves play() -> stops propagation, invokes play(), logs click + resolved, hides Play overlay
  const resA = runHookComponent('resolve');
  assert(!!resA.buttonVNode, 'Compiled PN renders visible <button> when !playing');
  assert(resA.buttonVNode.props.type === 'button', 'Compiled PN Play button has type="button"');
  assert(!resA.buttonVNode.props.disabled, 'Compiled PN Play button is NOT disabled');
  assert(resA.buttonVNode.props.style?.pointerEvents === 'auto' && resA.buttonVNode.props.style?.zIndex === 25, 'Compiled PN Play button has pointerEvents: auto and zIndex: 25');

  let prevented = false, stopped = false;
  resA.buttonVNode.props.onClick({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await new Promise(r => setTimeout(r, 10));

  assert(prevented && stopped, 'Clicking PN Play button prevents default and stops propagation');
  assert(resA.mockVideoEl.playCalls === 1 && resA.mockVideoEl.loadCalls === 0, 'Clicking PN Play button calls video.play() once without resetting video via load()');
  assert(capturedLogs.some(l => l[1] === '[ShopByVideo] Play button clicked' && l[2]?.hasVideoEl === true), 'Logs [ShopByVideo] Play button clicked with hasVideoEl: true & videoUrl');
  assert(capturedLogs.some(l => l[1] === '[ShopByVideo] play() Promise RESOLVED'), 'Logs [ShopByVideo] play() Promise RESOLVED after real playback starts');

  const treeA2 = resA.renderOnce();
  const buttonAfterPlay = treeA2.props.children.find(c => c && c.type === 'button');
  assert(!buttonAfterPlay, 'Play button overlay hides ONLY after play() resolved and !el.paused');

  // Test Scenario B: play() rejects -> NO fake playback state (button remains visible!)
  const resB = runHookComponent('reject');
  resB.buttonVNode.props.onClick({ preventDefault() {}, stopPropagation() {} });
  await new Promise(r => setTimeout(r, 10));

  assert(capturedLogs.some(l => l[1] === '[ShopByVideo] play() Promise REJECTED'), 'Logs [ShopByVideo] play() Promise REJECTED when browser blocks/fails play()');
  const treeB2 = resB.renderOnce();
  const buttonAfterReject = treeB2.props.children.find(c => c && c.type === 'button');
  assert(!!buttonAfterReject, 'No fake playback state: Play button remains visible when play() rejects');

  // Trigger onError on video element -> verify Video playback error diagnostic console.error
  resB.videoVNode.props.onError();
  assert(capturedLogs.some(l => l[0] === 'error' && l[1] === '[ShopByVideo] Video playback error event'), 'Logs [ShopByVideo] Video playback error event on media error');
}

// 4. Verify live local API & MP4 streaming endpoints (preserve all 60 products & 6 videos)
const prodRes = await fetch('http://localhost:3000/api/products');
assert(prodRes.status === 200, 'GET /api/products returns HTTP 200');
const products = await prodRes.json();
assert(Array.isArray(products) && products.length === 60, `Preserves all 60 product records (got ${products.length})`);
const videoProducts = products.filter(p => p.videoUrl);
assert(videoProducts.length === 6, `Preserves all 6 video-linked products (got ${videoProducts.length})`);
for (const vp of videoProducts) {
  const r = await fetch(`http://localhost:3000${vp.videoUrl}`, { headers: { Range: 'bytes=0-1023' } });
  assert(r.status === 200 || r.status === 206, `Video accessible locally (HTTP ${r.status}): ${vp.videoUrl}`);
}

console.log(`\nVERIFICATION SUMMARY: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
