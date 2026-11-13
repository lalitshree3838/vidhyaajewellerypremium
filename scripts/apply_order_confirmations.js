import fs from 'node:fs';
import vm from 'node:vm';

const filePath = 'assets/index-D2RoHgHG.js';
let code = fs.readFileSync(filePath, 'utf8');

const replacements = [
  {
    name: 'Admin Orders Table Status Dropdown -> Non-editable Green Confirmed Badge',
    target: "(0,I.jsxDEV)(`select`,{value:e.orderStatus,onChange:t=>Xt(e.id,t.target.value),className:`border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer focus:outline-none ${e.orderStatus===`Delivered`?`bg-emerald-50 border-emerald-300 text-emerald-800`:e.orderStatus===`Shipped`?`bg-blue-50 border-blue-300 text-blue-800`:e.orderStatus===`Cancelled`?`bg-red-50 border-red-300 text-red-800`:`bg-amber-50 border-amber-300 text-amber-800`}`,children:[(0,I.jsxDEV)(`option`,{value:`Pending`,children:`Pending`},void 0,!1,{fileName:X,lineNumber:1937,columnNumber:31},void 0),(0,I.jsxDEV)(`option`,{value:`Confirmed`,children:`Confirmed`},void 0,!1,{fileName:X,lineNumber:1938,columnNumber:31},void 0),(0,I.jsxDEV)(`option`,{value:`Processing`,children:`Processing`},void 0,!1,{fileName:X,lineNumber:1939,columnNumber:31},void 0),(0,I.jsxDEV)(`option`,{value:`Shipped`,children:`Shipped`},void 0,!1,{fileName:X,lineNumber:1940,columnNumber:31},void 0),(0,I.jsxDEV)(`option`,{value:`Delivered`,children:`Delivered`},void 0,!1,{fileName:X,lineNumber:1941,columnNumber:31},void 0),(0,I.jsxDEV)(`option`,{value:`Cancelled`,children:`Cancelled`},void 0,!1,{fileName:X,lineNumber:1942,columnNumber:31},void 0)]},void 0,!0,{fileName:X,lineNumber:1922,columnNumber:29},void 0)",
    replacement: "(0,I.jsxDEV)(`span`,{className:`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?`bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs`:`bg-amber-100 text-amber-900 border border-amber-300 shadow-xs`}`,children:e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?[(0,I.jsxDEV)(`span`,{className:`text-emerald-700 font-extrabold text-sm`,children:`✓`},void 0,!1,{fileName:X,lineNumber:1922,columnNumber:30},void 0),` CONFIRMED`]:`PAYMENT PENDING`},void 0,!0,{fileName:X,lineNumber:1922,columnNumber:29},void 0)"
  },
  {
    name: 'Admin Order Details Modal Status Dropdown -> Non-editable Green Confirmed Badge',
    target: "(0,I.jsxDEV)(`select`,{value:fe.orderStatus,onChange:e=>pe({...fe,orderStatus:e.target.value}),className:`px-2 py-1 border rounded-lg text-xs font-bold`,children:[(0,I.jsxDEV)(`option`,{value:`Pending`,children:`Pending`},void 0,!1,{fileName:X,lineNumber:2579,columnNumber:23},void 0),(0,I.jsxDEV)(`option`,{value:`Confirmed`,children:`Confirmed`},void 0,!1,{fileName:X,lineNumber:2580,columnNumber:23},void 0),(0,I.jsxDEV)(`option`,{value:`Processing`,children:`Processing`},void 0,!1,{fileName:X,lineNumber:2581,columnNumber:23},void 0),(0,I.jsxDEV)(`option`,{value:`Shipped`,children:`Shipped`},void 0,!1,{fileName:X,lineNumber:2582,columnNumber:23},void 0),(0,I.jsxDEV)(`option`,{value:`Delivered`,children:`Delivered`},void 0,!1,{fileName:X,lineNumber:2583,columnNumber:23},void 0),(0,I.jsxDEV)(`option`,{value:`Cancelled`,children:`Cancelled`},void 0,!1,{fileName:X,lineNumber:2584,columnNumber:23},void 0)]},void 0,!0,{fileName:X,lineNumber:2569,columnNumber:21},void 0)",
    replacement: "(0,I.jsxDEV)(`span`,{className:`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${fe.paymentStatus===`paid`||fe.orderStatus===`Confirmed`?`bg-emerald-100 text-emerald-800 border border-emerald-300`:`bg-amber-100 text-amber-900 border border-amber-300`}`,children:fe.paymentStatus===`paid`||fe.orderStatus===`Confirmed`?[(0,I.jsxDEV)(`span`,{className:`text-emerald-700 font-extrabold text-sm`,children:`✓`},void 0,!1,{fileName:X,lineNumber:2569,columnNumber:22},void 0),` CONFIRMED`]:`PAYMENT PENDING`},void 0,!0,{fileName:X,lineNumber:2569,columnNumber:21},void 0)"
  },
  {
    name: 'Customer Order History Status Badge -> ✓ CONFIRMED',
    target: "className:`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${e.orderStatus===`Delivered`?`bg-emerald-100 text-emerald-800`:e.orderStatus===`Cancelled`?`bg-red-100 text-red-800`:`bg-amber-100 text-amber-800`}`,children:e.orderStatus}",
    replacement: "className:`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?`bg-emerald-100 text-emerald-800 border border-emerald-300`:`bg-amber-100 text-amber-800`}`,children:e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?`✓ CONFIRMED`:e.orderStatus}"
  },
  {
    name: 'Order Tracking Screen Status Badge -> ✓ CONFIRMED',
    target: "className:`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${o.orderStatus===`Delivered`?`bg-emerald-100 text-emerald-800`:o.orderStatus===`Cancelled`?`bg-red-100 text-red-800`:`bg-amber-100 text-amber-800`}`,children:o.orderStatus}",
    replacement: "className:`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${o.paymentStatus===`paid`||o.orderStatus===`Confirmed`?`bg-emerald-100 text-emerald-800 border border-emerald-300`:`bg-amber-100 text-amber-800`}`,children:o.paymentStatus===`paid`||o.orderStatus===`Confirmed`?`✓ CONFIRMED`:o.orderStatus}"
  },
  {
    name: 'Dashboard Summary Orders Badge -> ✓ CONFIRMED',
    target: "className:`text-[10px] font-bold px-2 py-0.2 rounded ${e.orderStatus===`Delivered`?`bg-emerald-100 text-emerald-800`:e.orderStatus===`Shipped`?`bg-blue-100 text-blue-800`:`bg-amber-100 text-amber-800`}`,children:e.orderStatus}",
    replacement: "className:`text-[10px] font-bold px-2 py-0.2 rounded ${e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?`bg-emerald-100 text-emerald-800 border border-emerald-300`:`bg-amber-100 text-amber-800`}`,children:e.paymentStatus===`paid`||e.orderStatus===`Confirmed`?`✓ CONFIRMED`:e.orderStatus}"
  },
  {
    name: 'Order Success Page Header Badge -> ✓ Order Confirmed',
    target: "children:ke.paymentStatus===`paid`?`Payment Verified • Order Confirmed`:`Order Received • Pending Payment Verification`",
    replacement: "children:ke.paymentStatus===`paid`||ke.orderStatus===`Confirmed`?`✓ Order Confirmed`:`Order Received • Pending Payment Verification`"
  },
  {
    name: 'Order Success Page Details Status Line -> ✓ Confirmed',
    target: "children:ke.orderStatus===`Confirmed`?`Confirmed`:`Pending Payment`",
    replacement: "children:ke.paymentStatus===`paid`||ke.orderStatus===`Confirmed`?`✓ Confirmed`:`Pending Payment`"
  },
  {
    name: 'Modal Save Tracking Preserve Confirmed Status',
    target: "await Xt(fe.id,fe.orderStatus===`Pending`||fe.orderStatus===`Confirmed`?`Shipped`:fe.orderStatus,C.trim()||fe.trackingNumber,me.trim()||fe.courierName),alert(`Tracking and fulfillment saved successfully!`)",
    replacement: "await Xt(fe.id,fe.orderStatus,C.trim()||fe.trackingNumber,me.trim()||fe.courierName),alert(`Tracking details saved successfully!`)"
  },
  {
    name: 'Modal Save Button Text',
    target: "children:_e?`Saving...`:`Save Tracking & Status`",
    replacement: "children:_e?`Saving...`:`Save Tracking Information`"
  }
];

let appliedCount = 0;
for (const rep of replacements) {
  if (code.includes(rep.target)) {
    code = code.replace(rep.target, rep.replacement);
    console.log(`[SUCCESS] Applied: ${rep.name}`);
    appliedCount++;
  } else {
    console.warn(`[WARN] Target not found for: ${rep.name}`);
  }
}

if (appliedCount === replacements.length) {
  // Validate syntax
  try {
    new vm.Script(code);
    console.log('[SUCCESS] Syntax validation passed completely!');
    fs.writeFileSync(filePath, code, 'utf8');
    if (fs.existsSync('dist/' + filePath)) {
      fs.writeFileSync('dist/' + filePath, code, 'utf8');
    }
    console.log('[SUCCESS] Successfully updated bundle files!');
  } catch (err) {
    console.error('[ERROR] Syntax error detected in modified bundle:', err);
    process.exit(1);
  }
} else {
  console.error(`Only ${appliedCount}/${replacements.length} replacements matched.`);
  process.exit(1);
}
