const fs = require('fs');
const sampleData = fs.readFileSync('src/lib/sampleData.ts', 'utf8');
const diskImages = new Set(fs.readdirSync('public/products'));

const prods = [];
const blocks = sampleData.split(/\{\s*id:\s*'\s*(prod-[^']+)'/);
for (let i = 1; i < blocks.length; i += 2) {
  const id = blocks[i];
  const block = blocks[i + 1];
  const nameM = block.match(/name:\s*'([^']+)'/);
  const name = nameM ? nameM[1] : '';
  const catM = block.match(/categoryId:\s*'([^']+)'/);
  const cat = catM ? catM[1] : '';
  const imgM = block.match(/images:\s*\[([\s\S]*?)\]/);
  const rawImgs = imgM ? imgM[1] : '';
  const imgList = (rawImgs.match(/'([^']+)'/g) || []).map((s) => s.replace(/'/g, ''));
  prods.push({ id, name, cat, imgList });
}

console.log('Total products in INITIAL_PRODUCTS:', prods.length);
prods.forEach((p) => {
  const valid = p.imgList.filter((img) => {
    const base = img.replace(/^\/products\//, '');
    return diskImages.has(base);
  });
  console.log(p.id, '|', p.name.padEnd(50), '| cat:', p.cat.padEnd(20), '| valid on disk:', valid);
});
