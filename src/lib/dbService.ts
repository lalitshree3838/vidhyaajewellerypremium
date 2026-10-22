import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Category, Order, OrderStatus, Product, ProductVariation, Review, StoreSettings, UserProfile, Address } from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_STORE_SETTINGS,
  isGenuineImageUrl,
  isGenuineProduct
} from './sampleData';

const PRODUCTS_COL = 'products';
const CATEGORIES_COL = 'categories';
const ORDERS_COL = 'orders';
const REVIEWS_COL = 'reviews';
const SETTINGS_COL = 'settings';
const USERS_COL = 'users';

const ORDERS_CACHE_KEY = 'vidhyaa_orders_cache';

export function getCachedOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedOrders(orders: Order[]): void {
  try {
    localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders));
  } catch {}
}

const PRODUCTS_CACHE_KEY = 'vidhyaa_products_cache';

export function getCachedProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedProducts(products: Product[]): void {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch {}
}

export function cleanLegacyImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (isGenuineImageUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return '';
}

/**
 * Sanitizes and validates a product object for Firestore persistence.
 * CRITICAL: Firestore strictly rejects documents with `undefined` values.
 * This function guarantees all fields are typed, default values applied,
 * and no undefined properties are passed to Firestore setDoc/updateDoc.
 */
export function sanitizeProductForFirestore(product: Product): Product {
  const cleanId = String(product.id || '').trim();
  const cleanName = String(product.name || '').trim();
  const cleanSlug = String(product.slug || cleanName || 'jewellery-piece')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'jewellery-piece';

  const cleanPrice = typeof product.price === 'number' && !isNaN(product.price)
    ? Math.max(0, Math.round(product.price))
    : 0;

  const cleanMrp = typeof product.mrp === 'number' && !isNaN(product.mrp)
    ? Math.max(0, Math.round(product.mrp))
    : cleanPrice;

  const discountPercent = cleanMrp > cleanPrice && cleanMrp > 0
    ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100)
    : 0;

  const cleanStock = typeof product.stock === 'number' && !isNaN(product.stock)
    ? Math.max(0, Math.round(product.stock))
    : 0;

  const inStock = cleanStock > 0;

  const cleanImages = Array.isArray(product.images)
    ? product.images
        .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
        .map((img) => cleanLegacyImageUrl(img))
        .filter(Boolean)
    : [];

  const cleanVariations: ProductVariation[] = Array.isArray(product.variations) && product.variations.length > 0
    ? product.variations.map((v, idx) => {
        const variationImage = v.image && typeof v.image === 'string' && v.image.trim().length > 0
          ? cleanLegacyImageUrl(v.image)
          : (cleanImages[0] || '');

        const vStock = typeof v.stock === 'number' && !isNaN(v.stock) ? Math.max(0, Math.round(v.stock)) : 5;
        const res: ProductVariation = {
          id: String(v.id || `var_${cleanId || Date.now()}_${idx}`).trim(),
          name: String(v.name || 'Imperial Yellow Gold').trim(),
          colorFinish: String(v.colorFinish || 'Yellow Gold').trim(),
          hexCode: String(v.hexCode || '#D4AF37').trim(),
          sku: String(v.sku || `VDH-${Date.now()}-${idx}`).trim(),
          stock: vStock,
          image: variationImage,
          active: v.active !== false,
          price: cleanPrice,
          mrp: cleanMrp
        };
        if (Array.isArray(v.additionalImages)) {
          res.additionalImages = v.additionalImages.filter((img): img is string => typeof img === 'string' && img.trim().length > 0);
        }
        return res;
      })
    : [];

  const cleanProduct: Record<string, any> = {
    id: cleanId,
    name: cleanName,
    slug: cleanSlug,
    categoryId: String(product.categoryId || 'necklaces').trim(),
    categoryName: String(product.categoryName || 'Necklaces & Necklace Sets').trim(),
    subcategory: String(product.subcategory || 'Necklaces').trim(),
    description: String(product.description || '').trim(),
    material: String(product.material || '22K Micro Gold Plated Brass & Heritage Kundan').trim(),
    price: cleanPrice,
    mrp: cleanMrp,
    discountPercent,
    images: cleanImages,
    stock: cleanStock,
    inStock,
    active: product.active !== false,
    rating: typeof product.rating === 'number' && !isNaN(product.rating) ? product.rating : 5,
    reviewCount: typeof product.reviewCount === 'number' && !isNaN(product.reviewCount) ? product.reviewCount : 1,
    careInstructions: String(product.careInstructions || 'Keep away from water and perfumes. Store in airtight pouch.').trim(),
    variations: cleanVariations,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Only attach optional fields if defined and non-empty (never undefined)
  if (product.shortDescription && typeof product.shortDescription === 'string' && product.shortDescription.trim()) {
    cleanProduct.shortDescription = product.shortDescription.trim();
  }
  if (product.videoUrl && typeof product.videoUrl === 'string' && product.videoUrl.trim()) {
    cleanProduct.videoUrl = product.videoUrl.trim();
  }
  if (typeof product.isFeatured === 'boolean') {
    cleanProduct.isFeatured = product.isFeatured;
  }
  if (typeof product.isBestseller === 'boolean') {
    cleanProduct.isBestseller = product.isBestseller;
  }
  if (typeof product.isNewArrival === 'boolean') {
    cleanProduct.isNewArrival = product.isNewArrival;
  }
  if (product.specifications && typeof product.specifications === 'object') {
    cleanProduct.specifications = product.specifications;
  } else {
    cleanProduct.specifications = { 'Plating': '24K Micro Gold Plated', 'Craft': 'Handcrafted Heirlooms' };
  }

  return cleanProduct as Product;
}

const LEGACY_CATEGORY_IDS = new Set(['gold-imitation', 'silver-925', 'oxidised', 'bridal-sets', 'pendants', 'other-jewellery']);

const DELETED_PRODUCTS_KEY = 'vidhyaa_deleted_products';

export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markProductDeleted(id: string): void {
  try {
    const ids = getDeletedProductIds();
    ids.add(id);
    localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function unmarkProductDeleted(id: string): void {
  try {
    const ids = getDeletedProductIds();
    if (ids.has(id)) {
      ids.delete(id);
      localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(ids)));
    }
  } catch {}
}

const DELETED_CATEGORIES_KEY = 'vidhyaa_deleted_categories';

export function getDeletedCategoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_CATEGORIES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markCategoryDeleted(id: string): void {
  try {
    const ids = getDeletedCategoryIds();
    ids.add(id);
    localStorage.setItem(DELETED_CATEGORIES_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function unmarkCategoryDeleted(id: string): void {
  try {
    const ids = getDeletedCategoryIds();
    if (ids.has(id)) {
      ids.delete(id);
      localStorage.setItem(DELETED_CATEGORIES_KEY, JSON.stringify(Array.from(ids)));
    }
  } catch {}
}

// Initialize catalog if empty
export async function initCatalogIfEmpty(): Promise<void> {
  try {
    const productsSnap = await getDocs(collection(db, PRODUCTS_COL));
    if (productsSnap.empty) {
      console.log('Seeding initial catalog...');
      await forceReseedCatalog(false);
    }
  } catch (error) {
    console.warn('Could not verify/seed catalog:', error);
  }
}

export async function forceReseedCatalog(throwOnError: boolean = true): Promise<void> {
  try {
    // 1. Categories
    for (const cat of INITIAL_CATEGORIES) {
      await setDoc(doc(db, CATEGORIES_COL, cat.id), cat);
    }
    // 2. Products - strictly sanitized initial products
    for (const prod of INITIAL_PRODUCTS) {
      const sanitized = sanitizeProductForFirestore(prod);
      await setDoc(doc(db, PRODUCTS_COL, sanitized.id), sanitized);
    }
    // 3. Settings
    await setDoc(doc(db, SETTINGS_COL, INITIAL_STORE_SETTINGS.id), INITIAL_STORE_SETTINGS);
    saveCachedCategories(INITIAL_CATEGORIES);
    saveCachedProducts(INITIAL_PRODUCTS);
    console.log('Catalog successfully seeded with genuine products.');
  } catch (error) {
    if (throwOnError) {
      handleFirestoreError(error, OperationType.WRITE, 'catalog_seed');
    } else {
      console.warn('Initial seeding could not write to Firestore; continuing with local initial catalog data.', error);
    }
  }
}

// Products - Load latest saved products with local cache fallback
export async function fetchProducts(): Promise<Product[]> {
  const cached = getCachedProducts();
  const deletedIds = getDeletedProductIds();
  try {
    const snap = await getDocs(collection(db, PRODUCTS_COL));
    if (snap.empty) {
      if (cached.length > 0) return cached.filter((p) => !deletedIds.has(p.id));
      const cleanInitial = INITIAL_PRODUCTS.filter((p) => !deletedIds.has(p.id));
      saveCachedProducts(cleanInitial);
      return cleanInitial;
    }

    const products: Product[] = [];
    snap.forEach((d) => {
      const data = d.data() as Omit<Product, 'id'>;
      const cleanImgs = Array.isArray(data.images)
        ? data.images.map((img) => cleanLegacyImageUrl(img)).filter(Boolean)
        : [];
      const cleanMrp = typeof data.mrp === 'number' ? data.mrp : (data.price || 0);
      const cleanPrice = typeof data.price === 'number' ? data.price : 0;
      const discountPercent = typeof data.discountPercent === 'number'
        ? data.discountPercent
        : (cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100) : 0);

      const cleanVars = Array.isArray(data.variations)
        ? data.variations.map((v) => ({
            ...v,
            price: cleanPrice,
            mrp: cleanMrp,
            image: cleanLegacyImageUrl(v.image)
          }))
        : [];

      const prodCandidate: Product = {
        id: d.id,
        name: data.name || '',
        slug: data.slug || d.id,
        categoryId: data.categoryId || 'necklaces',
        categoryName: data.categoryName || 'Necklaces & Necklace Sets',
        subcategory: data.subcategory || 'Necklaces',
        description: data.description || '',
        shortDescription: data.shortDescription,
        material: data.material || '22K Micro Gold Plated Brass',
        price: cleanPrice,
        mrp: cleanMrp,
        discountPercent,
        images: cleanImgs,
        stock: typeof data.stock === 'number' ? data.stock : 0,
        inStock: typeof data.stock === 'number' ? data.stock > 0 : Boolean(data.inStock),
        isFeatured: data.isFeatured,
        isBestseller: data.isBestseller,
        isNewArrival: data.isNewArrival,
        active: data.active !== false,
        rating: typeof data.rating === 'number' ? data.rating : 5,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
        specifications: data.specifications || {},
        careInstructions: data.careInstructions || '',
        variations: cleanVars,
        videoUrl: (typeof data.videoUrl === 'string' && data.videoUrl.trim()) ? data.videoUrl.trim() : INITIAL_PRODUCTS.find((p) => p.id === d.id)?.videoUrl,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };

      if (isGenuineProduct(prodCandidate)) {
        products.push(prodCandidate);
      }
    });

    // Merge with any cached products: Firestore is source of truth,
    // but if cached product is newly added or has newer updatedAt, preserve it
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));

    cached.forEach((c) => {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      } else {
        const firestoreProd = map.get(c.id)!;
        const cachedTime = new Date(c.updatedAt || 0).getTime();
        const firestoreTime = new Date(firestoreProd.updatedAt || 0).getTime();
        if (cachedTime > firestoreTime) {
          map.set(c.id, c);
        }
      }
    });

    const finalProducts = Array.from(map.values()).filter((p) => !deletedIds.has(p.id));
    saveCachedProducts(finalProducts);
    return finalProducts;
  } catch (error) {
    console.warn('Error fetching products from Firestore, using cached or initial catalog:', error);
    const fallback = cached.length > 0 ? cached : INITIAL_PRODUCTS;
    return fallback.filter((p) => !deletedIds.has(p.id));
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, PRODUCTS_COL, id));
    if (snap.exists()) {
      const data = snap.data() as Omit<Product, 'id'>;
      const cleanImgs = Array.isArray(data.images)
        ? data.images.map((img) => cleanLegacyImageUrl(img)).filter(Boolean)
        : [];
      const cleanMrp = typeof data.mrp === 'number' ? data.mrp : (data.price || 0);
      const cleanPrice = typeof data.price === 'number' ? data.price : 0;
      const discountPercent = typeof data.discountPercent === 'number'
        ? data.discountPercent
        : (cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100) : 0);

      const cleanVars = Array.isArray(data.variations)
        ? data.variations.map((v) => ({
            ...v,
            price: cleanPrice,
            mrp: cleanMrp,
            image: cleanLegacyImageUrl(v.image)
          }))
        : [];

      const prod: Product = {
        id: snap.id,
        name: data.name || '',
        slug: data.slug || snap.id,
        categoryId: data.categoryId || 'necklaces',
        categoryName: data.categoryName || 'Necklaces & Necklace Sets',
        subcategory: data.subcategory || 'Necklaces',
        description: data.description || '',
        shortDescription: data.shortDescription,
        material: data.material || '22K Micro Gold Plated Brass',
        price: cleanPrice,
        mrp: cleanMrp,
        discountPercent,
        images: cleanImgs,
        stock: typeof data.stock === 'number' ? data.stock : 0,
        inStock: typeof data.stock === 'number' ? data.stock > 0 : Boolean(data.inStock),
        isFeatured: data.isFeatured,
        isBestseller: data.isBestseller,
        isNewArrival: data.isNewArrival,
        active: data.active !== false,
        rating: typeof data.rating === 'number' ? data.rating : 5,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
        specifications: data.specifications || {},
        careInstructions: data.careInstructions || '',
        variations: cleanVars,
        videoUrl: (typeof data.videoUrl === 'string' && data.videoUrl.trim()) ? data.videoUrl.trim() : INITIAL_PRODUCTS.find((p) => p.id === snap.id)?.videoUrl,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      return prod;
    }
  } catch (error) {
    console.warn('Error fetching product by id from Firestore:', error);
  }

  // Check cached products
  const cached = getCachedProducts();
  const localMatch = cached.find((p) => p.id === id);
  if (localMatch) return localMatch;

  const fallback = INITIAL_PRODUCTS.find((p) => p.id === id);
  return fallback || null;
}

export async function saveProduct(product: Product): Promise<Product> {
  const sanitized = sanitizeProductForFirestore(product);

  // 1. Persist to Firestore database FIRST to ensure backend confirmation
  try {
    await setDoc(doc(db, PRODUCTS_COL, sanitized.id), sanitized);
    console.log(`[Firestore] Product "${sanitized.name}" (${sanitized.id}) saved successfully.`);
  } catch (error) {
    console.error('Firestore saveProduct error:', error);
    // Still store in cache as local fallback, then rethrow Firestore error
    const cached = getCachedProducts();
    const index = cached.findIndex((p) => p.id === sanitized.id);
    if (index !== -1) {
      cached[index] = sanitized;
    } else {
      cached.unshift(sanitized);
    }
    saveCachedProducts(cached);
    handleFirestoreError(error, OperationType.WRITE, `${PRODUCTS_COL}/${sanitized.id}`);
  }

  // 2. Update local cache with sanitized saved product
  unmarkProductDeleted(sanitized.id);
  const cached = getCachedProducts();
  const index = cached.findIndex((p) => p.id === sanitized.id);
  if (index !== -1) {
    cached[index] = sanitized;
  } else {
    cached.unshift(sanitized);
  }
  saveCachedProducts(cached);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vidhyaa_products_updated', { detail: cached }));
  }

  return sanitized;
}

export async function deleteProduct(productId: string): Promise<void> {
  // Update local cache and persistent deletion list
  markProductDeleted(productId);
  const cached = getCachedProducts();
  saveCachedProducts(cached.filter((p) => p.id !== productId));

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, PRODUCTS_COL, productId));
    console.log(`[Firestore] Product "${productId}" deleted successfully.`);
  } catch (error) {
    console.warn('Firestore deleteProduct warning:', error);
  }
}

const CATEGORIES_CACHE_KEY = 'vidhyaa_categories_cache';

export function getCachedCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedCategories(cats: Category[]): void {
  try {
    localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cats));
  } catch {}
}

// Categories
export async function fetchCategories(): Promise<Category[]> {
  const cached = getCachedCategories();
  const deletedCatIds = getDeletedCategoryIds();
  try {
    const snap = await getDocs(collection(db, CATEGORIES_COL));
    if (snap.empty) {
      if (cached.length > 0) {
        const cachedMap = new Map<string, Category>(cached.map((c) => [c.id, c]));
        let hasNew = false;
        INITIAL_CATEGORIES.forEach((initCat) => {
          if (!cachedMap.has(initCat.id) && !deletedCatIds.has(initCat.id)) {
            cachedMap.set(initCat.id, initCat);
            hasNew = true;
          } else if (cachedMap.has(initCat.id)) {
            const existing = cachedMap.get(initCat.id)!;
            if (!existing.image && initCat.image) {
              existing.image = initCat.image;
              hasNew = true;
            }
            if (!existing.heroBannerUrl && initCat.heroBannerUrl) {
              existing.heroBannerUrl = initCat.heroBannerUrl;
              hasNew = true;
            }
          }
        });
        const mergedCached = Array.from(cachedMap.values()).filter(
          (c) => !LEGACY_CATEGORY_IDS.has(c.id) && !deletedCatIds.has(c.id)
        );
        if (hasNew) {
          saveCachedCategories(mergedCached);
        }
        return mergedCached;
      }
      const initialAllowed = INITIAL_CATEGORIES.filter((c) => !deletedCatIds.has(c.id));
      saveCachedCategories(initialAllowed);
      return initialAllowed;
    }
    const cats: Category[] = [];
    snap.forEach((d) => {
      cats.push({ id: d.id, ...(d.data() as Omit<Category, 'id'>) });
    });

    // Merge with any cached custom categories or newly added ones
    const map = new Map<string, Category>();
    cats.forEach((c) => map.set(c.id, c));
    cached.forEach((c) => {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      } else {
        // preserve rich CMS fields if locally edited
        const remote = map.get(c.id)!;
        map.set(c.id, { ...c, ...remote });
      }
    });

    INITIAL_CATEGORIES.forEach((initCat) => {
      if (!map.has(initCat.id) && !deletedCatIds.has(initCat.id)) {
        map.set(initCat.id, initCat);
      } else if (map.has(initCat.id)) {
        const existing = map.get(initCat.id)!;
        if (!existing.image && initCat.image) {
          existing.image = initCat.image;
        }
        if (!existing.heroBannerUrl && initCat.heroBannerUrl) {
          existing.heroBannerUrl = initCat.heroBannerUrl;
        }
      }
    });

    // Retain all dynamic categories, filtering out only deleted or legacy sample ids
    const merged = Array.from(map.values())
      .filter((c) => !LEGACY_CATEGORY_IDS.has(c.id) && !deletedCatIds.has(c.id))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    saveCachedCategories(merged);
    return merged.length > 0 ? merged : INITIAL_CATEGORIES;
  } catch (error) {
    console.warn('Error fetching categories from Firestore, using cached or initial:', error);
    const validCached = cached.filter((c) => !LEGACY_CATEGORY_IDS.has(c.id) && !deletedCatIds.has(c.id));
    return validCached.length > 0 ? validCached : INITIAL_CATEGORIES.filter((c) => !deletedCatIds.has(c.id));
  }
}

export async function saveCategory(category: Category): Promise<void> {
  // Unmark from deleted if it was previously deleted
  unmarkCategoryDeleted(category.id);

  // Update local cache first for instant UI response
  const cached = getCachedCategories();
  const index = cached.findIndex((c) => c.id === category.id);
  const updated = {
    ...category,
    updatedAt: new Date().toISOString()
  };

  if (index !== -1) {
    cached[index] = updated;
  } else {
    cached.push(updated);
  }
  saveCachedCategories(cached);

  try {
    await setDoc(doc(db, CATEGORIES_COL, category.id), updated);
  } catch (error) {
    console.warn('Could not save category to Firestore, saved to local cache:', error);
  }
}

export async function duplicateCategory(categoryId: string): Promise<Category | null> {
  const cats = await fetchCategories();
  const source = cats.find((c) => c.id === categoryId);
  if (!source) return null;

  const newId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const clone: Category = {
    ...source,
    id: newId,
    name: `${source.name} (Copy)`,
    slug: `${source.slug}-copy`,
    order: (source.order || cats.length) + 1,
    active: false, // draft by default
    updatedAt: new Date().toISOString()
  };

  await saveCategory(clone);
  return clone;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  // Mark as deleted and remove from local cache
  markCategoryDeleted(categoryId);
  const cached = getCachedCategories();
  const filtered = cached.filter((c) => c.id !== categoryId);
  saveCachedCategories(filtered);

  try {
    await deleteDoc(doc(db, CATEGORIES_COL, categoryId));
  } catch (error) {
    console.warn('Could not delete category from Firestore:', error);
  }
}

// Store Settings
export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, INITIAL_STORE_SETTINGS.id));
    if (!snap.exists()) {
      return INITIAL_STORE_SETTINGS;
    }
    const data = snap.data() as Partial<StoreSettings>;
    return {
      ...INITIAL_STORE_SETTINGS,
      ...data,
      businessOwner: data.businessOwner || 'Neeraj Chauhan',
      pincode: '247667',
      contactPhone: '7302187770',
      contactAddress: 'Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India',
      id: snap.id
    };
  } catch (error) {
    return INITIAL_STORE_SETTINGS;
  }
}

export async function updateStoreSettings(settings: Partial<StoreSettings>): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COL, INITIAL_STORE_SETTINGS.id);
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COL}/${INITIAL_STORE_SETTINGS.id}`);
  }
}

// Orders
export async function createOrder(orderData: Omit<Order, 'id'>): Promise<Order> {
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullOrder: Order = {
    ...orderData,
    id: orderId
  };

  // Cache locally immediately so orders are instantly visible to user and admin
  const cached = getCachedOrders();
  saveCachedOrders([fullOrder, ...cached.filter((o) => o.id !== orderId)]);

  try {
    // Save order to Firestore
    await setDoc(doc(db, ORDERS_COL, orderId), fullOrder);

    // Atomically decrement stock for products and variations
    for (const item of fullOrder.items) {
      try {
        const prodRef = doc(db, PRODUCTS_COL, item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          const newStock = Math.max(0, (prodData.stock || 10) - item.quantity);
          const updatedVariations = (prodData.variations || []).map((v) => {
            if (v.id === item.variationId) {
              return { ...v, stock: Math.max(0, v.stock - item.quantity) };
            }
            return v;
          });
          await updateDoc(prodRef, {
            stock: newStock,
            inStock: newStock > 0,
            variations: updatedVariations,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (stockErr) {
        console.warn('Could not decrement stock for product', item.productId, stockErr);
      }
    }

    return fullOrder;
  } catch (error) {
    console.warn('Could not write order directly to Firestore, cached locally:', error);
    return fullOrder;
  }
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  try {
    const snap = await getDoc(doc(db, ORDERS_COL, orderId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) };
    }
    // Search by orderNumber
    const q = query(collection(db, ORDERS_COL), where('orderNumber', '==', orderId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const firstDoc = querySnap.docs[0];
      return { id: firstDoc.id, ...(firstDoc.data() as Omit<Order, 'id'>) };
    }
  } catch (error) {
    console.warn('Error fetching order from Firestore, checking local cache:', error);
  }

  // Check local cache
  const cached = getCachedOrders();
  const localMatch = cached.find((o) => o.id === orderId || o.orderNumber === orderId);
  return localMatch || null;
}

export async function fetchOrdersByUserId(userId: string): Promise<Order[]> {
  try {
    const q = query(collection(db, ORDERS_COL), where('userId', '==', userId));
    const snap = await getDocs(q);
    const orders: Order[] = [];
    snap.forEach((d) => {
      orders.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) });
    });
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Error fetching user orders:', error);
    const cached = getCachedOrders();
    return cached.filter((o) => o.userId === userId);
  }
}

export async function fetchAllOrders(): Promise<Order[]> {
  const cached = getCachedOrders();
  try {
    const snap = await getDocs(collection(db, ORDERS_COL));
    const orders: Order[] = [];
    snap.forEach((d) => {
      orders.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) });
    });

    // Merge with any locally cached orders
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    cached.forEach((o) => {
      if (!map.has(o.id)) map.set(o.id, o);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    saveCachedOrders(merged);
    return merged;
  } catch (error) {
    console.warn('Error fetching all orders from Firestore, serving cached orders:', error);
    return cached;
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  trackingNumber?: string,
  courierName?: string
): Promise<void> {
  // Update local cache first
  const cached = getCachedOrders();
  const index = cached.findIndex((o) => o.id === orderId);
  if (index !== -1) {
    cached[index].orderStatus = status;
    if (trackingNumber !== undefined) cached[index].trackingNumber = trackingNumber;
    if (courierName !== undefined) cached[index].courierName = courierName;
    cached[index].updatedAt = new Date().toISOString();
    saveCachedOrders(cached);
  }

  try {
    const docRef = doc(db, ORDERS_COL, orderId);
    const updates: Partial<Order> = {
      orderStatus: status,
      updatedAt: new Date().toISOString()
    };
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (courierName !== undefined) updates.courierName = courierName;
    await updateDoc(docRef, updates);
  } catch (error) {
    console.warn('Could not sync updated order status to Firestore:', error);
  }
}

// Reviews
export async function fetchProductReviews(productId: string): Promise<Review[]> {
  try {
    const q = query(collection(db, REVIEWS_COL), where('productId', '==', productId));
    const snap = await getDocs(q);
    const reviews: Review[] = [];
    snap.forEach((d) => {
      reviews.push({ id: d.id, ...(d.data() as Omit<Review, 'id'>) });
    });
    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Error fetching reviews:', error);
    return [];
  }
}

export async function addReview(review: Omit<Review, 'id'>): Promise<Review> {
  const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullReview: Review = { ...review, id: reviewId };
  try {
    await setDoc(doc(db, REVIEWS_COL, reviewId), fullReview);

    // Update product rating and review count
    const prodRef = doc(db, PRODUCTS_COL, review.productId);
    const prodSnap = await getDoc(prodRef);
    if (prodSnap.exists()) {
      const prod = prodSnap.data() as Product;
      const count = (prod.reviewCount || 0) + 1;
      const currentRating = prod.rating || 5;
      const newRating = Number(((currentRating * (count - 1) + review.rating) / count).toFixed(1));
      await updateDoc(prodRef, {
        rating: newRating,
        reviewCount: count,
        updatedAt: new Date().toISOString()
      });
    }

    return fullReview;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${REVIEWS_COL}/${reviewId}`);
  }
}

export async function fetchAllReviews(): Promise<Review[]> {
  try {
    const snap = await getDocs(collection(db, REVIEWS_COL));
    const reviews: Review[] = [];
    snap.forEach((d) => {
      reviews.push({ id: d.id, ...(d.data() as Omit<Review, 'id'>) });
    });
    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Error fetching all reviews:', error);
    return [];
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, REVIEWS_COL, reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${REVIEWS_COL}/${reviewId}`);
  }
}

// User Profile & Addresses
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, USERS_COL, userId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Omit<UserProfile, 'id'>) };
    }
    return null;
  } catch (error) {
    console.warn('Error fetching user profile:', error);
    return null;
  }
}

export async function saveUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const docRef = doc(db, USERS_COL, userId);
    await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS_COL}/${userId}`);
  }
}
