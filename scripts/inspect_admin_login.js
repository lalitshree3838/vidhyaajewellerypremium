import fs from 'node:fs';

const content = fs.readFileSync('assets/index-D2RoHgHG.js', 'utf8');

// Find admin login function
const idx = content.indexOf('/api/admin/login');
console.log('admin login in frontend at:', idx);
console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 400)));
