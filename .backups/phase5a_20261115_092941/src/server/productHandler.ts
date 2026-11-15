import fs from 'fs';
import path from 'path';
import { Product } from '../types/index.js';

const DATA_DIR = path.resolve('data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BACKUP_FILE = path.join(DATA_DIR, 'products_backup.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[ProductHandler] Could not ensure data directory:', err);
  }
}

export function getStoredProducts(): Product[] {
  ensureDataDir();
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('[ProductHandler] Error reading products file:', err);
  }
  return [];
}

export function saveStoredProduct(product: Partial<Product>): Product {
  ensureDataDir();
  if (!product || !product.id || !product.name) {
    throw new Error('Product must have an id and a name.');
  }

  const existingProducts = getStoredProducts();
  const cleanId = String(product.id).trim();

  const now = new Date().toISOString();
  const cleanPrice = typeof product.price === 'number' && !isNaN(product.price) ? Math.max(0, Math.round(product.price)) : 0;
  const cleanMrp = typeof product.mrp === 'number' && !isNaN(product.mrp) ? Math.max(0, Math.round(product.mrp)) : cleanPrice;
  const discountPercent = cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100) : 0;

  const normalized: Product = {
    id: cleanId,
    name: String(product.name).trim(),
    slug: String(product.slug || product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || cleanId,
    categoryId: String(product.categoryId || 'necklaces').trim(),
    categoryName: String(product.categoryName || 'Necklaces & Necklace Sets').trim(),
    subcategory: String(product.subcategory || 'Necklaces').trim(),
    description: String(product.description || '').trim(),
    shortDescription: product.shortDescription,
    material: String(product.material || '22K Micro Gold Plated Brass').trim(),
    price: cleanPrice,
    mrp: cleanMrp,
    discountPercent,
    images: Array.isArray(product.images) ? product.images.filter((img): img is string => typeof img === 'string' && img.length > 0) : [],
    stock: typeof product.stock === 'number' && !isNaN(product.stock) ? Math.max(0, Math.round(product.stock)) : 0,
    inStock: typeof product.stock === 'number' ? product.stock > 0 : Boolean(product.inStock),
    isFeatured: Boolean(product.isFeatured),
    isBestseller: Boolean(product.isBestseller),
    isNewArrival: Boolean(product.isNewArrival),
    active: product.active !== false,
    rating: typeof product.rating === 'number' ? product.rating : 5,
    reviewCount: typeof product.reviewCount === 'number' ? product.reviewCount : 1,
    specifications: product.specifications || {},
    careInstructions: String(product.careInstructions || '').trim(),
    variations: Array.isArray(product.variations) ? product.variations : [],
    videoUrl: product.videoUrl,
    createdAt: product.createdAt || now,
    updatedAt: now
  };

  const index = existingProducts.findIndex((p) => p.id === cleanId);
  if (index !== -1) {
    existingProducts[index] = { ...existingProducts[index], ...normalized, updatedAt: now };
  } else {
    existingProducts.unshift(normalized);
  }

  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(existingProducts, null, 2), 'utf-8');
    console.log(`[ProductHandler] Product "${normalized.name}" (${normalized.id}) saved to ${PRODUCTS_FILE}`);
  } catch (err) {
    console.error('[ProductHandler] Error writing to products file:', err);
    throw err;
  }

  return normalized;
}

export function deleteStoredProduct(productId: string): boolean {
  ensureDataDir();
  const existingProducts = getStoredProducts();
  const filtered = existingProducts.filter((p) => p.id !== productId);
  if (filtered.length === existingProducts.length) {
    return false;
  }
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    console.log(`[ProductHandler] Product "${productId}" removed from ${PRODUCTS_FILE}`);
    return true;
  } catch (err) {
    console.error('[ProductHandler] Error deleting product:', err);
    throw err;
  }
}
