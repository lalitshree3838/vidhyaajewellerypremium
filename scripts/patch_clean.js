import fs from 'node:fs';
import { execSync } from 'node:child_process';

const originalBundlePath = 'assets/index-D2RoHgHG.original.js';
const targetBundlePath = 'assets/index-D2RoHgHG.js';

let bundle = fs.readFileSync(originalBundlePath, 'utf8');
console.log('Original bundle size:', bundle.length);

// 1. In yN:
// Update useEffect initialMode handling
const oldEffect = `e&&(r===\`mobile\`?(u(\`mobile\`),m(\`enter_phone\`)):(u(\`email\`),f(r||\`signin\`))`;
const newEffect = `e&&(r===\`mobile\`?(u(\`mobile\`),f(\`signin\`)):r===\`signup\`?(u(\`mobile\`),f(\`signup\`)):(u(\`email\`),f(r||\`signin\`))`;

if (!bundle.includes(oldEffect)) {
  console.error('Failed to locate oldEffect');
  process.exit(1);
}
bundle = bundle.replace(oldEffect, newEffect);
console.log('Updated useEffect initialMode');

// 2. Update De handler
const oldDeStart = 'De=async e=>{if(e&&e.preventDefault(),ye(null),xe(null),!_.trim()){';
const oldDeEnd = 'finally{Ce(!1)}},Oe=async()=>{';

const deStartIdx = bundle.indexOf(oldDeStart);
const deEndIdx = bundle.indexOf(oldDeEnd, deStartIdx);
if (deStartIdx === -1 || deEndIdx === -1) {
  console.error('Failed to locate De handler range');
  process.exit(1);
}

const newDe = `De=async e=>{if(e&&e.preventDefault,ye(null),xe(null)){};let mD=_.replace(/\\D/g,\`\`);if(mD.length===12&&mD.startsWith(\`91\`))mD=mD.slice(2);else if(mD.length===11&&mD.startsWith(\`0\`))mD=mD.slice(1);else if(mD.length>10&&/^[6-9]\\d{9}$/.test(mD.slice(-10)))mD=mD.slice(-10);if(!mD||mD.length!==10||!/^[6-9]\\d{9}$/.test(mD)){ye(\`Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).\`);return}if(d===\`signup\`){let N=de.trim();if(!N){ye(\`Please enter your full name.\`);return}if(!se||se.trim().length<6){ye(\`Password must be at least 6 characters long.\`);return}if(se!==le){ye(\`Passwords do not match. Please verify your confirm password.\`);return}if(!pe){ye(\`Please agree to the Terms of Service to create an account.\`);return}Ce(!0);try{let r=await fetch(\`/api/auth/mobile-register\`,{method:\`POST\`,headers:{'Content-Type':\`application/json\`},body:JSON.stringify({phone:\`+91\${mD}\`,mobile:mD,name:N,password:se,confirmPassword:le})}),i=await r.json().catch(()=>({}));if(!r.ok||!i.success){throw new Error(i.error||i.message||\`Registration failed. Please check your details.\`)}if(i.user){try{localStorage.setItem(\`vidhyaa_patron_session\`,JSON.stringify(i.user));window.dispatchEvent(new Event(\`vidhyaa_patron_auth_changed\`))}catch{}}xe(i.message||\`Patron account registered successfully! Welcome to VIDHYAA Jewellery Studio.\`);setTimeout(()=>{n?.();typeof t===\`function\`&&t()},800)}catch(e){ye(e?.message||\`Registration failed. Please try again.\`)}finally{Ce(!1)}return}if(!se||se.trim().length<6){ye(\`Please enter your account password (at least 6 characters).\`);return}Ce(!0);try{let r=await fetch(\`/api/auth/mobile-login\`,{method:\`POST\`,headers:{'Content-Type':\`application/json\`},body:JSON.stringify({phone:\`+91\${mD}\`,mobile:mD,password:se})}),i=await r.json().catch(()=>({}));if(!r.ok||!i.success){throw new Error(i.error||i.message||(\`No patron account found for +91 \`+mD+\`. Please verify credentials or create an account.\`))}if(i.user){try{localStorage.setItem(\`vidhyaa_patron_session\`,JSON.stringify(i.user));window.dispatchEvent(new Event(\`vidhyaa_patron_auth_changed\`))}catch{}}xe(i.message||(\`Mobile sign-in successful! Welcome to VIDHYAA Jewellery Studio.\`));setTimeout(()=>{n?.();typeof t===\`function\`&&t()},800)}catch(e){ye(e?.message||(\`Authentication failed. Please verify credentials.\`))}finally{Ce(!1)}}`;

bundle = bundle.slice(0, deStartIdx) + newDe + bundle.slice(deEndIdx + 'finally{Ce(!1)}}'.length);
console.log('Updated De handler');

// 3. Update Title & Subtitle in yN
const oldTitle = `l===\`mobile\`?p===\`enter_phone\`?\`Mobile Number Login\`:\`Verify Mobile OTP\`:d===\`signin\`?\`Sign In to Your Account\`:d===\`signup\`?\`Create Patron Account\`:\`Reset Your Password\``;
const newTitle = `l===\`mobile\`?(d===\`signup\`?\`Create Patron Account\`:\`Existing Customer Sign In\`):(d===\`signin\`?\`Sign In to Your Account\`:d===\`signup\`?\`Create Patron Account\`:\`Reset Your Password\`)`;
if (!bundle.includes(oldTitle)) {
  console.error('Failed to locate oldTitle');
  process.exit(1);
}
bundle = bundle.replace(oldTitle, newTitle);
console.log('Updated Title in yN');

const oldSub = `i||(l===\`mobile\`?\`Worldwide international SMS verification for patrons across India & overseas\`:d===\`forgot\`?\`Enter your registered email address to receive a secure password reset link\`:\`Roorkee, Haridwar Atelier • Royal Handcrafted Heirlooms\`)`;
const newSub = `i||(l===\`mobile\`?(d===\`signup\`?\`Register with your 10-digit Indian mobile number & password\`:\`Sign in with your 10-digit Indian mobile number & password\`):(d===\`forgot\`?\`Enter your registered email address to receive a secure password reset link\`:\`Roorkee, Haridwar Atelier • Royal Handcrafted Heirlooms\`))`;
if (!bundle.includes(oldSub)) {
  console.error('Failed to locate oldSub');
  process.exit(1);
}
bundle = bundle.replace(oldSub, newSub);
console.log('Updated Subtitle in yN');

// 4. Update the sub-tab toggle bar in yN:
// Show "Existing Customer: Sign In" and "New Customer: Create Account / Register" for BOTH mobile and email
const oldSubTab = `l===\`email\`&&d!==\`forgot\`&&(0,I.jsxDEV)(\`div\`,{className:\`flex border-b border-[#E8DCCF] text-xs font-semibold bg-white\`,children:[(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>{f(\`signin\`),ye(null),xe(null)},className:\`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 \${d===\`signin\`?\`text-[#802336] font-bold border-b-2 border-[#802336]\`:\`text-gray-500 hover:text-black\`}\`,children:[(0,I.jsxDEV)(DO,{className:\`w-3 h-3\`},void 0,!1,{fileName:B,lineNumber:486,columnNumber:15},void 0),(0,I.jsxDEV)(\`span\`,{children:\`Sign In\`},void 0,!1,{fileName:B,lineNumber:487,columnNumber:15},void 0)]},void 0,!0,{fileName:B,lineNumber:473,columnNumber:13},void 0),(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>{f(\`signup\`),ye(null),xe(null)},className:\`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 \${d===\`signup\`?\`text-[#802336] font-bold border-b-2 border-[#802336]\`:\`text-gray-500 hover:text-black\`}\`,children:[(0,I.jsxDEV)(gk,{className:\`w-3 h-3\`},void 0,!1,{fileName:B,lineNumber:502,columnNumber:15},void 0),(0,I.jsxDEV)(\`span\`,{children:\`Create Account\`},void 0,!1,{fileName:B,lineNumber:503,columnNumber:15},void 0)]},void 0,!0,{fileName:B,lineNumber:489,columnNumber:13},void 0)]},void 0,!0,{fileName:B,lineNumber:472,columnNumber:11},void 0)`;

const newSubTab = `d!==\`forgot\`&&(0,I.jsxDEV)(\`div\`,{className:\`flex border-b border-[#E8DCCF] text-xs font-semibold bg-white\`,children:[(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>{f(\`signin\`),ye(null),xe(null)},className:\`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 \${d===\`signin\`?\`text-[#802336] font-bold border-b-2 border-[#802336]\`:\`text-gray-500 hover:text-black\`}\`,children:[(0,I.jsxDEV)(DO,{className:\`w-3 h-3\`},void 0,!1,{fileName:B,lineNumber:486,columnNumber:15},void 0),(0,I.jsxDEV)(\`span\`,{children:\`Existing Customer: Sign In\`},void 0,!1,{fileName:B,lineNumber:487,columnNumber:15},void 0)]},void 0,!0,{fileName:B,lineNumber:473,columnNumber:13},void 0),(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>{f(\`signup\`),ye(null),xe(null)},className:\`flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 \${d===\`signup\`?\`text-[#802336] font-bold border-b-2 border-[#802336]\`:\`text-gray-500 hover:text-black\`}\`,children:[(0,I.jsxDEV)(gk,{className:\`w-3 h-3\`},void 0,!1,{fileName:B,lineNumber:502,columnNumber:15},void 0),(0,I.jsxDEV)(\`span\`,{children:\`New Customer: Create Account / Register\`},void 0,!1,{fileName:B,lineNumber:503,columnNumber:15},void 0)]},void 0,!0,{fileName:B,lineNumber:489,columnNumber:13},void 0)]},void 0,!0,{fileName:B,lineNumber:472,columnNumber:11},void 0)`;

if (!bundle.includes(oldSubTab)) {
  console.error('Failed to locate oldSubTab');
  process.exit(1);
}
bundle = bundle.replace(oldSubTab, newSubTab);
console.log('Updated SubTab in yN');

// 5. Replace the entire old mobile form in yN
const oldMobMarker = `l===\`mobile\`&&(0,I.jsxDEV)(\`div\`,{children:p===\`enter_phone\`?(0,I.jsxDEV)(\`form\`,{onSubmit:De,className:\`space-y-4\`,children:[(0,I.jsxDEV)(\`div\`,{children:[(0,I.jsxDEV)(\`label\`,{className:\`block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between\``;

const mobStart = bundle.indexOf(oldMobMarker);
const mobEndMarker = `l===\`email\`&&(0,I.jsxDEV)(\`form\`,{onSubmit:async e=>{`;
const mobEnd = bundle.indexOf(mobEndMarker, mobStart);

if (mobStart === -1 || mobEnd === -1) {
  console.error('Failed to locate old mob form range');
  process.exit(1);
}

const newMobForm = `l===\`mobile\`&&(0,I.jsxDEV)(\`form\`,{onSubmit:De,className:\`space-y-4\`,children:[d===\`signup\`&&(0,I.jsxDEV)(\`div\`,{children:[(0,I.jsxDEV)(\`label\`,{className:\`block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5\`,children:\`Full Name *\`},void 0,!1,{fileName:B,lineNumber:530,columnNumber:21},void 0),(0,I.jsxDEV)(\`div\`,{className:\`relative flex items-center\`,children:[(0,I.jsxDEV)(gk,{className:\`w-4 h-4 text-gray-400 absolute left-3 pointer-events-none\`},void 0,!1,{fileName:B,lineNumber:531,columnNumber:23},void 0),(0,I.jsxDEV)(\`input\`,{type:\`text\`,required:!0,value:de,onChange:e=>fe(e.target.value),placeholder:\`e.g. Radhika Sharma\`,className:\`w-full pl-9 pr-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all\`},void 0,!1,{fileName:B,lineNumber:532,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:531,columnNumber:21},void 0)]},void 0,!0,{fileName:B,lineNumber:529,columnNumber:19},void 0),(0,I.jsxDEV)(\`div\`,{children:[(0,I.jsxDEV)(\`label\`,{className:\`block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between\`,children:[(0,I.jsxDEV)(\`span\`,{children:\`Indian Mobile Number *\`},void 0,!1,{fileName:B,lineNumber:536,columnNumber:23},void 0),(0,I.jsxDEV)(\`span\`,{className:\`text-[10px] text-gray-500 font-normal flex items-center gap-1\`,children:\`+91 India (10 digits)\`},void 0,!1,{fileName:B,lineNumber:537,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:535,columnNumber:21},void 0),(0,I.jsxDEV)(\`div\`,{className:\`flex gap-2 items-stretch\`,children:[(0,I.jsxDEV)(\`div\`,{className:\`px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl flex items-center gap-1.5 text-xs font-bold text-gray-800 select-none shadow-xs\`,children:[(0,I.jsxDEV)(\`span\`,{className:\`text-base leading-none\`,children:\`🇮🇳\`},void 0,!1,{fileName:B,lineNumber:546,columnNumber:25},void 0),(0,I.jsxDEV)(\`span\`,{className:\`font-mono tracking-wider text-[#802336]\`,children:\`+91\`},void 0,!1,{fileName:B,lineNumber:547,columnNumber:25},void 0)]},void 0,!0,{fileName:B,lineNumber:545,columnNumber:23},void 0),(0,I.jsxDEV)(\`div\`,{className:\`relative flex-1 flex items-center\`,children:[(0,I.jsxDEV)(BO,{className:\`w-4 h-4 text-gray-400 absolute left-3 pointer-events-none\`},void 0,!1,{fileName:B,lineNumber:557,columnNumber:25},void 0),(0,I.jsxDEV)(\`input\`,{type:\`tel\`,inputMode:\`numeric\`,pattern:\`[0-9]*\`,maxLength:10,required:!0,autoFocus:!0,value:_,onChange:e=>{let val=e.target.value.replace(/\\D/g,\`\`).slice(0,10);v(val),ye(null)},placeholder:\`9876543210\`,className:\`w-full pl-9 pr-3 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs font-mono font-semibold text-gray-900 placeholder:text-gray-400 outline-none transition-all\`},void 0,!1,{fileName:B,lineNumber:558,columnNumber:25},void 0)]},void 0,!0,{fileName:B,lineNumber:556,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:544,columnNumber:21},void 0),_.trim()&&(0,I.jsxDEV)(\`div\`,{className:\`mt-1.5 flex items-center gap-1.5 text-[11px]\`,children:_.replace(/\\D/g,\`\`).length===10?(0,I.jsxDEV)(\`span\`,{className:\`text-emerald-700 font-medium flex items-center gap-1\`,children:[(0,I.jsxDEV)(XD,{className:\`w-3.5 h-3.5 text-emerald-600\`},void 0,!1,{fileName:B,lineNumber:578,columnNumber:29},void 0),(0,I.jsxDEV)(\`span\`,{children:[\`Valid 10-digit Indian mobile (+91 \`,_.replace(/\\D/g,\`\`),\`)\`]},void 0,!0,{fileName:B,lineNumber:579,columnNumber:29},void 0)]},void 0,!0,{fileName:B,lineNumber:577,columnNumber:27},void 0):(0,I.jsxDEV)(\`span\`,{className:\`text-amber-700 font-medium\`,children:[10-_.replace(/\\D/g,\`\`).length,\` more digit(s) required (10 digits expected)\`]},void 0,!0,{fileName:B,lineNumber:582,columnNumber:27},void 0)},void 0,!1,{fileName:B,lineNumber:575,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:534,columnNumber:19},void 0),(0,I.jsxDEV)(\`div\`,{children:[(0,I.jsxDEV)(\`label\`,{className:\`block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5\`,children:d===\`signup\`?\`Create Password *\`:\`Password *\`},void 0,!1,{fileName:B,lineNumber:588,columnNumber:21},void 0),(0,I.jsxDEV)(\`div\`,{className:\`relative flex items-center\`,children:[(0,I.jsxDEV)(TO,{className:\`w-4 h-4 text-gray-400 absolute left-3 pointer-events-none\`},void 0,!1,{fileName:B,lineNumber:592,columnNumber:23},void 0),(0,I.jsxDEV)(\`input\`,{type:he?\`text\`:\`password\`,required:!0,minLength:6,value:se,onChange:e=>{ce(e.target.value),ye(null)},placeholder:d===\`signup\`?\`Create a password (min. 6 characters)\`:\`Enter your account password\`,className:\`w-full pl-9 pr-10 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all\`},void 0,!1,{fileName:B,lineNumber:593,columnNumber:23},void 0),(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>C(!he),className:\`absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer\`,\"aria-label\":he?\`Hide password\`:\`Show password\`,children:he?(0,I.jsxDEV)(iO,{className:\`w-4 h-4\`},void 0,!1,{fileName:B,lineNumber:599,columnNumber:39},void 0):(0,I.jsxDEV)(aO,{className:\`w-4 h-4\`},void 0,!1,{fileName:B,lineNumber:599,columnNumber:72},void 0)},void 0,!1,{fileName:B,lineNumber:598,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:591,columnNumber:21},void 0)]},void 0,!0,{fileName:B,lineNumber:587,columnNumber:19},void 0),d===\`signup\`&&(0,I.jsxDEV)(\`div\`,{children:[(0,I.jsxDEV)(\`label\`,{className:\`block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5\`,children:\`Confirm Password *\`},void 0,!1,{fileName:B,lineNumber:596,columnNumber:21},void 0),(0,I.jsxDEV)(\`div\`,{className:\`relative flex items-center\`,children:[(0,I.jsxDEV)(TO,{className:\`w-4 h-4 text-gray-400 absolute left-3 pointer-events-none\`},void 0,!1,{fileName:B,lineNumber:597,columnNumber:23},void 0),(0,I.jsxDEV)(\`input\`,{type:ge?\`text\`:\`password\`,required:!0,minLength:6,value:le,onChange:e=>ue(e.target.value),placeholder:\`Re-enter password\`,className:\`w-full pl-9 pr-10 py-2.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none transition-all\`},void 0,!1,{fileName:B,lineNumber:598,columnNumber:23},void 0),(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>_e(!ge),className:\`absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer\`,\"aria-label\":ge?\`Hide confirm password\`:\`Show confirm password\`,children:ge?(0,I.jsxDEV)(iO,{className:\`w-4 h-4\`},void 0,!1,{fileName:B,lineNumber:599,columnNumber:43},void 0):(0,I.jsxDEV)(aO,{className:\`w-4 h-4\`},void 0,!1,{fileName:B,lineNumber:599,columnNumber:76},void 0)},void 0,!1,{fileName:B,lineNumber:599,columnNumber:23},void 0)]},void 0,!0,{fileName:B,lineNumber:597,columnNumber:21},void 0)]},void 0,!0,{fileName:B,lineNumber:595,columnNumber:19},void 0),d===\`signup\`&&(0,I.jsxDEV)(\`label\`,{className:\`flex items-start gap-2 pt-1 cursor-pointer select-none\`,children:[(0,I.jsxDEV)(\`input\`,{type:\`checkbox\`,checked:pe,onChange:e=>me(e.target.checked),className:\`w-4 h-4 mt-0.5 rounded text-[#802336] focus:ring-[#802336] border-gray-300\`},void 0,!1,{fileName:B,lineNumber:602,columnNumber:21},void 0),(0,I.jsxDEV)(\`span\`,{className:\`text-[11px] text-gray-600 leading-tight\`,children:\`I agree to the VIDHYAA Jewellery Studio Terms of Service and Privacy Policy.\`},void 0,!1,{fileName:B,lineNumber:603,columnNumber:21},void 0)]},void 0,!0,{fileName:B,lineNumber:601,columnNumber:19},void 0),(0,I.jsxDEV)(\`button\`,{type:\`submit\`,disabled:Se||_.replace(/\\D/g,\`\`).length!==10||!se||(d===\`signup\`&&(!de.trim()||!le)),className:\`w-full bg-[#802336] hover:bg-[#631B2A] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]\`,children:Se?(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(wO,{className:\`w-4 h-4 animate-spin\`},void 0,!1,{fileName:B,lineNumber:605,columnNumber:25},void 0),(0,I.jsxDEV)(\`span\`,{children:d===\`signup\`?\`Creating Account...\`:\`Signing In...\`},void 0,!1,{fileName:B,lineNumber:606,columnNumber:25},void 0)]},void 0,!0,{fileName:B,lineNumber:604,columnNumber:23},void 0):(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(\`span\`,{children:d===\`signup\`?\`Create Account / Register\`:\`Sign In\`},void 0,!1,{fileName:B,lineNumber:610,columnNumber:25},void 0),(0,I.jsxDEV)(BD,{className:\`w-4 h-4 text-[#DFB982]\`},void 0,!1,{fileName:B,lineNumber:611,columnNumber:25},void 0)]},void 0,!0,{fileName:B,lineNumber:609,columnNumber:23},void 0)},void 0,!1,{fileName:B,lineNumber:603,columnNumber:19},void 0),(0,I.jsxDEV)(\`p\`,{className:\`text-[11px] text-gray-500 text-center leading-relaxed\`,children:d===\`signup\`?\`Instant registration using your 10-digit Indian mobile number.\`:\`Secure login for patrons using registered 10-digit Indian mobile number.\`},void 0,!1,{fileName:B,lineNumber:617,columnNumber:19},void 0),(0,I.jsxDEV)(\`div\`,{className:\`text-center pt-1\`,children:(0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:()=>{u(\`email\`),ye(null),xe(null)},className:\`text-xs text-[#802336] hover:text-[#3B1E22] font-semibold hover:underline cursor-pointer\`,children:\`✉️ Switch to Login with Email\`},void 0,!1,{fileName:B,lineNumber:622,columnNumber:21},void 0)},void 0,!1,{fileName:B,lineNumber:621,columnNumber:19},void 0)]},void 0,!0,{fileName:B,lineNumber:533,columnNumber:17},void 0),`;

bundle = bundle.slice(0, mobStart) + newMobForm + bundle.slice(mobEnd);
console.log('Replaced mobile form');

// 6. Update bottom switch prompt to show for both mobile and email
const oldBottomPrompt = `l===\`email\`&&d!==\`forgot\`&&(0,I.jsxDEV)(\`div\`,{className:\`pt-2 text-center text-xs text-gray-500\`,children:d===\`signin\`?`;
const newBottomPrompt = `(l===\`email\`&&d!==\`forgot\`||l===\`mobile\`)&&(0,I.jsxDEV)(\`div\`,{className:\`pt-2 text-center text-xs text-gray-500\`,children:d===\`signin\`?`;

if (!bundle.includes(oldBottomPrompt)) {
  console.error('Failed to locate oldBottomPrompt');
  process.exit(1);
}
bundle = bundle.replace(oldBottomPrompt, newBottomPrompt);
console.log('Updated bottom prompt');

// Also update the button labels in bottom prompt:
// "Create Account / Register" instead of just "Create Account"
const oldBottomCreateBtn = `children:\`Create Account\`},void 0,!1,{fileName:B,lineNumber:995,columnNumber:19},void 0)`;
const newBottomCreateBtn = `children:\`Create Account / Register\`},void 0,!1,{fileName:B,lineNumber:995,columnNumber:19},void 0)`;
bundle = bundle.replace(oldBottomCreateBtn, newBottomCreateBtn);

// 7. Update PromotionalLoginModal (bN)
// Find bN
const bNMarker = ',bN=({isOpen:e,onClose:t,onSuccess:n';
const bNStart = bundle.indexOf(bNMarker);
const searchModalMarker = ',xN=`/app/applet/src/components/SearchModal.tsx`';
const bNEnd = bundle.indexOf(searchModalMarker, bNStart);

if (bNStart !== -1 && bNEnd !== -1) {
  console.log(`Found bN from ${bNStart} to ${bNEnd}`);
  // In bN, update mobile submit handler `be`
  const oldPromoBeStart = 'be=async e=>{if(e&&e.preventDefault(),de(null)){};let mD=te.replace(/\\D/g,``);';
  const promoBeIdx = bundle.indexOf(oldPromoBeStart, bNStart);
  if (promoBeIdx !== -1 && promoBeIdx < bNEnd) {
    const promoBeEndMarker = 'xe=async e=>{e.preventDefault()';
    const promoBeEndIdx = bundle.indexOf(promoBeEndMarker, promoBeIdx);
    if (promoBeEndIdx !== -1) {
      const newPromoBe = `be=async e=>{if(e&&e.preventDefault(),de(null)){};let mD=te.replace(/\\D/g,\`\`);if(mD.length===12&&mD.startsWith(\`91\`))mD=mD.slice(2);else if(mD.length===11&&mD.startsWith(\`0\`))mD=mD.slice(1);else if(mD.length>10&&/^[6-9]\\d{9}$/.test(mD.slice(-10)))mD=mD.slice(-10);if(!mD||mD.length!==10||!/^[6-9]\\d{9}$/.test(mD)){de(\`Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).\`);return}if(!m||m.trim().length<6){de(\`Please enter your account password (at least 6 characters).\`);return}he(!0);try{let endpoint=c===\`signup\`?\`/api/auth/mobile-register\`:\`/api/auth/mobile-login\`;let payload=c===\`signup\`?{phone:\`+91\${mD}\`,mobile:mD,name:u.trim()||\`Valued Patron\`,password:m}:{phone:\`+91\${mD}\`,mobile:mD,password:m};let r=await fetch(endpoint,{method:\`POST\`,headers:{'Content-Type':\`application/json\`},body:JSON.stringify(payload)}),i=await r.json().catch(()=>({}));if(!r.ok||!i.success){throw new Error(i.error||i.message||(c===\`signup\`?\`Registration failed. Please check your details.\`:\`No patron account found for +91 \`+mD+\`. Please verify credentials or register.\`))}if(i.user){try{localStorage.setItem(\`vidhyaa_patron_session\`,JSON.stringify(i.user));window.dispatchEvent(new Event(\`vidhyaa_patron_auth_changed\`))}catch{}}l(\`success\`);setTimeout(()=>{n?.();typeof t===\`function\`&&t()},1500)}catch(e){de(e?.message||(\`Authentication failed. Please verify credentials.\`))}finally{he(!1)}},`;
      bundle = bundle.slice(0, promoBeIdx) + newPromoBe + bundle.slice(promoBeEndIdx);
      console.log('Successfully updated be handler in bN');
    }
  }
}

// Write the patched bundle to targetBundlePath
fs.writeFileSync(targetBundlePath, bundle, 'utf8');
console.log('Successfully wrote target bundle. Verifying syntax with node -c...');

try {
  execSync(`node -c ${targetBundlePath}`);
  console.log('>>> ALL SYNTAX CHECKS PASSED PERFECTLY! <<<');
} catch (err) {
  console.error('SYNTAX ERROR:', err.message);
  process.exit(1);
}
