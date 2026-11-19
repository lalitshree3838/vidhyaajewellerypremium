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
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Category, Order, OrderItem, OrderStatus, Product, ProductVariation, Review, StoreSettings, UserProfile, Address } from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_STORE_SETTINGS,
  isGenuineImageUrl,
  isGenuineProduct,
  resolveCategoryCoverImage
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

let __vidhyaaMemProducts: Product[] = [];

export function __normVidUrl(u?: string): string {
  if (!u || typeof u !== 'string') return '';
  let s = u.trim().replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1');
  if (/^videos\/uploads\//i.test(s)) s = '/' + s;
  return s;
}

export function __mergeProductMedia(incoming: Product, fallback?: Product | null): Product {
  if (!incoming || typeof incoming !== 'object') return incoming;
  const incAny = incoming as any;
  const fbAny = fallback as any;
  const incImgs = Array.isArray(incoming.images)
    ? incoming.images.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const fbImgs = fallback && Array.isArray(fallback.images)
    ? fallback.images.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const mergedImgs = incImgs.length > 0 ? incImgs : fbImgs;

  const mergedVars: ProductVariation[] =
    Array.isArray(incoming.variations) && incoming.variations.length > 0
      ? incoming.variations.map((v, idx) => {
          const fv =
            fallback?.variations?.[idx] ||
            (fallback?.variations || []).find((x) => x && v && x.id === v.id);
          const img =
            v && typeof v.image === 'string' && v.image.trim()
              ? v.image
              : fv?.image || mergedImgs[0] || '';
          return { ...v, image: img };
        })
      : fallback?.variations || [];

  const rawVid = __normVidUrl(
    incoming.videoUrl || incAny.video || incAny.videoURL || fbAny?.videoUrl || ''
  );

  const out: Product = {
    ...incoming,
    images: mergedImgs,
    variations: mergedVars,
    videoUrl: rawVid || undefined,
    showInShoppingVideos:
      incoming.showInShoppingVideos !== undefined
        ? incoming.showInShoppingVideos
        : fallback?.showInShoppingVideos
  };

  if (out._strippedImg && mergedImgs.length > 0) {
    delete out._strippedImg;
  }
  return out;
}

export function getCachedProducts(): Product[] {
  const baseMap = new Map<string, Product>();
  if (Array.isArray(INITIAL_PRODUCTS)) {
    INITIAL_PRODUCTS.forEach((p) => {
      if (p && p.id) baseMap.set(p.id, p);
    });
  }

  if (Array.isArray(__vidhyaaMemProducts) && __vidhyaaMemProducts.length > 0) {
    __vidhyaaMemProducts.forEach((p) => {
      if (p && p.id) baseMap.set(p.id, __mergeProductMedia(p, baseMap.get(p.id)));
    });
    return Array.from(baseMap.values());
  }

  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: Product) => {
      if (!p || !p.id) return p;
      const fb = baseMap.get(p.id);
      return __mergeProductMedia(p, fb);
    });
  } catch {
    return [];
  }
}

export function saveCachedProducts(products: Product[]): void {
  if (!Array.isArray(products) || products.length === 0) return;
  const prevMap = new Map<string, Product>();
  if (Array.isArray(INITIAL_PRODUCTS)) {
    INITIAL_PRODUCTS.forEach((p) => {
      if (p && p.id) prevMap.set(p.id, p);
    });
  }
  if (Array.isArray(__vidhyaaMemProducts)) {
    __vidhyaaMemProducts.forEach((p) => {
      if (p && p.id) prevMap.set(p.id, p);
    });
  }

  const clean = products.map((p) => (p && p.id ? __mergeProductMedia(p, prevMap.get(p.id)) : p));
  __vidhyaaMemProducts = clean;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(clean));
    } catch {
      try {
        const slim = clean.map((item) => {
          if (!item || typeof item !== 'object') return item;
          const hadDataImg =
            (Array.isArray(item.images) &&
              item.images.some((x) => typeof x === 'string' && x.startsWith('data:image/'))) ||
            (Array.isArray(item.variations) &&
              item.variations.some(
                (v) => v && typeof v.image === 'string' && v.image.startsWith('data:image/')
              ));
          const safeImages = Array.isArray(item.images)
            ? item.images
                .map((img) => (typeof img === 'string' && img.startsWith('data:image/') ? '' : img))
                .filter(Boolean)
            : [];
          const safeVariations = Array.isArray(item.variations)
            ? item.variations.map((v) =>
                v && typeof v.image === 'string' && v.image.startsWith('data:image/')
                  ? { ...v, image: '' }
                  : v
              )
            : item.variations;
          const copy: Product = {
            ...item,
            images: safeImages,
            variations: safeVariations
          };
          if (hadDataImg) {
            copy._strippedImg = true;
          }
          return copy;
        });
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(slim));
      } catch (fallbackErr) {
        console.warn('[Cache Diagnostic] Could not persist products to localStorage:', fallbackErr);
      }
    }
  }
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
    status: (product as any).status || (product.active !== false ? 'published' : 'draft'),
    published: (product as any).published !== undefined ? Boolean((product as any).published) : (product.active !== false),
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
  const nv = __normVidUrl(
    product.videoUrl || (product as any).video || (product as any).videoURL || ''
  );
  if (nv) {
    cleanProduct.videoUrl = nv;
    cleanProduct.showInShoppingVideos = product.showInShoppingVideos !== false;
  }
  if (typeof product.showInShoppingVideos === 'boolean') {
    cleanProduct.showInShoppingVideos = product.showInShoppingVideos;
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

export const PERMANENTLY_DELETED_PRODUCT_IDS = new Set([
  'prod-user-005',
  'prod-user-010',
  'prod-user-011',
  'prod-user-012',
  'prod-user-013',
  'prod-user-014',
  'prod-user-015',
  'prod-user-016',
  'prod-user-031',
  'prod-user-032',
  'prod-user-033'
]);

export function getDeletedProductIds(): Set<string> {
  const result = new Set<string>(PERMANENTLY_DELETED_PRODUCT_IDS);
  try {
    const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => result.add(id));
      }
    }
  } catch {}
  return result;
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

// Initialize catalog only if Firestore is completely empty (zero products)
export async function initCatalogIfEmpty(): Promise<void> {
  try {
    const productsSnap = await getDocs(collection(db, PRODUCTS_COL));
    if (productsSnap.empty) {
      console.log('[Catalog Init] Empty Firestore database detected. Seeding initial baseline catalog...');
      await forceReseedCatalog(false);
      return;
    }
    // Database already contains live catalog products; do not overwrite or inject sample products.
  } catch (error) {
    console.warn('[Catalog Init] Notice while checking Firestore catalog state:', error);
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
    console.log('[Firestore] Catalog successfully seeded with initial products and categories.');
  } catch (error) {
    if (throwOnError) {
      handleFirestoreError(error, OperationType.WRITE, 'catalog_seed');
    } else {
      console.warn('[Firestore] Initial seeding notice; continuing with local initial catalog data.', error);
    }
  }
}

// Products - Load latest saved products directly from persistent Firestore collection
export async function fetchProducts(): Promise<Product[]> {
  const cached = getCachedProducts();
  const deletedIds = getDeletedProductIds();

  // Unified catalog map ensuring zero products are ever dropped
  const catalogMap = new Map<string, Product>();

  // 1. Seed baseline INITIAL_PRODUCTS
  INITIAL_PRODUCTS.forEach((p) => {
    if (!deletedIds.has(p.id) && isGenuineProduct(p)) {
      catalogMap.set(p.id, __mergeProductMedia(p, null));
    }
  });

  // 2. Fetch server store products from /api/products (persisted in data/products.json)
  let apiSucceeded = false;
  try {
    if (typeof fetch !== 'undefined') {
      const resp = await fetch('/api/products', { cache: 'no-store' }).catch(() => null);
      if (resp && resp.ok) {
        const json = await resp.json().catch(() => null);
        if (Array.isArray(json) && json.length > 0) {
          apiSucceeded = true;
          json.forEach((sp: Product) => {
            if (isGenuineProduct(sp) && !deletedIds.has(sp.id)) {
              catalogMap.set(sp.id, __mergeProductMedia(sp, catalogMap.get(sp.id)));
            }
          });
        }
      }
    }
  } catch {}

  // 3. Merge cached products (including products created or updated locally in Admin Panel)
  if (Array.isArray(cached) && cached.length > 0) {
    cached.forEach((cp) => {
      if (isGenuineProduct(cp) && !deletedIds.has(cp.id)) {
        const existing = catalogMap.get(cp.id);
        if (!existing) {
          catalogMap.set(cp.id, __mergeProductMedia(cp, null));
        } else if (!cp._strippedImg) {
          const timeExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const timeCached = new Date(cp.updatedAt || cp.createdAt || 0).getTime();
          if (timeCached > timeExisting || !apiSucceeded) {
            catalogMap.set(cp.id, __mergeProductMedia(cp, existing));
          }
        }
      }
    });
  }

  // 4. Query authoritative Firestore collection /products
  try {
    const snap = await getDocs(collection(db, PRODUCTS_COL));
    snap.forEach((d) => {
      const data = d.data() as Omit<Product, 'id'>;
      const cleanImgs = Array.isArray(data.images)
        ? data.images.map((img) => cleanLegacyImageUrl(img)).filter(Boolean)
        : [];
      const cleanMrp = typeof data.mrp === 'number' && !isNaN(data.mrp) ? data.mrp : (data.price || 0);
      const cleanPrice = typeof data.price === 'number' && !isNaN(data.price) ? data.price : 0;
      const discountPercent = typeof data.discountPercent === 'number'
        ? data.discountPercent
        : (cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100) : 0);

      const cleanVars = Array.isArray(data.variations)
        ? data.variations.map((v) => ({
            ...v,
            price: typeof v.price === 'number' ? v.price : cleanPrice,
            mrp: typeof v.mrp === 'number' ? v.mrp : cleanMrp,
            image: cleanLegacyImageUrl(v.image)
          }))
        : [];

      const cleanVideoUrl = __normVidUrl(
        data.videoUrl || (data as any).video || (data as any).videoURL || ''
      );

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
        isFeatured: typeof data.isFeatured === 'boolean' ? data.isFeatured : true,
        isBestseller: Boolean(data.isBestseller),
        isNewArrival: typeof data.isNewArrival === 'boolean' ? data.isNewArrival : true,
        active: data.active !== false && (data as any).status !== 'draft',
        status: (data as any).status || (data.active !== false ? 'published' : 'draft'),
        published: (data as any).published !== undefined ? Boolean((data as any).published) : (data.active !== false),
        rating: typeof data.rating === 'number' ? data.rating : 5,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
        specifications: data.specifications || {},
        careInstructions: data.careInstructions || '',
        variations: cleanVars,
        videoUrl: cleanVideoUrl || undefined,
        showInShoppingVideos:
          typeof data.showInShoppingVideos === 'boolean' ? data.showInShoppingVideos : undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
      };

      if (isGenuineProduct(prodCandidate) && !deletedIds.has(prodCandidate.id)) {
        const existing = catalogMap.get(prodCandidate.id);
        if (!existing) {
          catalogMap.set(prodCandidate.id, prodCandidate);
        } else {
          const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const fbTs = new Date(prodCandidate.updatedAt || prodCandidate.createdAt || 0).getTime();
          if (fbTs >= existingTs) {
            catalogMap.set(prodCandidate.id, __mergeProductMedia(prodCandidate, existing));
          } else {
            catalogMap.set(prodCandidate.id, __mergeProductMedia(existing, prodCandidate));
          }
        }
      }
    });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded')) {
      console.warn('[Firestore Notice] Daily free read quota currently active; serving from unified local catalog store.');
    } else {
      console.warn('[Firestore] Notice fetching products from Firestore:', error?.message || error);
    }
  }

  const merged = Array.from(catalogMap.values());
  merged.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  saveCachedProducts(merged);
  return merged;
}

/**
 * Subscribes to real-time changes on the Firestore 'products' collection.
 * Whenever an admin saves, updates, or deletes a product, this listener receives
 * the latest snapshot and invokes the callback immediately.
 */
export function subscribeToProducts(
  callback: (products: Product[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const unsub = onSnapshot(
      collection(db, PRODUCTS_COL),
      (snap) => {
        const deletedIds = getDeletedProductIds();
        const liveProducts: Product[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<Product, 'id'>;
          const cleanImgs = Array.isArray(data.images)
            ? data.images.map((img) => cleanLegacyImageUrl(img)).filter(Boolean)
            : [];
          const cleanMrp = typeof data.mrp === 'number' && !isNaN(data.mrp) ? data.mrp : (data.price || 0);
          const cleanPrice = typeof data.price === 'number' && !isNaN(data.price) ? data.price : 0;
          const discountPercent = typeof data.discountPercent === 'number'
            ? data.discountPercent
            : (cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100) : 0);

          const cleanVars = Array.isArray(data.variations)
            ? data.variations.map((v) => ({
                ...v,
                price: typeof v.price === 'number' ? v.price : cleanPrice,
                mrp: typeof v.mrp === 'number' ? v.mrp : cleanMrp,
                image: cleanLegacyImageUrl(v.image)
              }))
            : [];

          const cleanVideoUrl = __normVidUrl(
            data.videoUrl || (data as any).video || (data as any).videoURL || ''
          );

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
            isFeatured: typeof data.isFeatured === 'boolean' ? data.isFeatured : true,
            isBestseller: Boolean(data.isBestseller),
            isNewArrival: typeof data.isNewArrival === 'boolean' ? data.isNewArrival : true,
            active: data.active !== false && (data as any).status !== 'draft',
            status: (data as any).status || (data.active !== false ? 'published' : 'draft'),
            published: (data as any).published !== undefined ? Boolean((data as any).published) : (data.active !== false),
            rating: typeof data.rating === 'number' ? data.rating : 5,
            reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
            specifications: data.specifications || {},
            careInstructions: data.careInstructions || '',
            variations: cleanVars,
            videoUrl: cleanVideoUrl || undefined,
            showInShoppingVideos:
              typeof data.showInShoppingVideos === 'boolean' ? data.showInShoppingVideos : undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
          };

          if (isGenuineProduct(prodCandidate) && !deletedIds.has(prodCandidate.id)) {
            liveProducts.push(prodCandidate);
          }
        });

        if (liveProducts.length > 0) {
          const base = __vidhyaaMemProducts.length > 0 ? __vidhyaaMemProducts : getCachedProducts();
          const mergedMap = new Map<string, Product>();
          INITIAL_PRODUCTS.forEach((p) => {
            if (!deletedIds.has(p.id) && isGenuineProduct(p)) {
              mergedMap.set(p.id, __mergeProductMedia(p, null));
            }
          });
          base.forEach((p) => {
            if (!deletedIds.has(p.id) && isGenuineProduct(p)) {
              mergedMap.set(p.id, __mergeProductMedia(p, mergedMap.get(p.id)));
            }
          });
          liveProducts.forEach((p) => {
            if (!deletedIds.has(p.id) && isGenuineProduct(p)) {
              const existing = mergedMap.get(p.id);
              if (!existing) {
                mergedMap.set(p.id, p);
              } else {
                const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                const liveTs = new Date(p.updatedAt || p.createdAt || 0).getTime();
                mergedMap.set(
                  p.id,
                  liveTs >= existingTs ? __mergeProductMedia(p, existing) : __mergeProductMedia(existing, p)
                );
              }
            }
          });

          const sorted = Array.from(mergedMap.values()).sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          saveCachedProducts(sorted);
          callback(sorted);
        }
      },
      (err) => {
        console.warn('[Firestore] onSnapshot notice on products collection:', err?.message || err);
        if (onError) onError(err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('[Firestore] Could not attach onSnapshot listener:', err);
    return () => {};
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
        videoUrl: (typeof data.videoUrl === 'string' && data.videoUrl.trim()) ? data.videoUrl.trim() : undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
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

function getAdminAuthToken(): string {
  try {
    return (
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vidhyaa_admin_token') : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('vidhyaa_admin_token') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_session_token') : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('admin_session_token') : null) ||
      ''
    );
  } catch {
    return '';
  }
}

export async function getCustomerAuthToken(): Promise<string> {
  try {
    const patronTok =
      typeof localStorage !== 'undefined' ? localStorage.getItem('vidhyaa_patron_token') || '' : '';
    const hasPatronSession =
      typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem('vidhyaa_patron_session')) : false;

    if (patronTok && hasPatronSession) {
      return patronTok;
    }

    const { auth } = await import('./firebase');
    if (auth?.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) return idToken;
    }

    if (patronTok) {
      return patronTok;
    }
  } catch {}
  return '';
}

const RECEIPT_TOKENS_KEY = 'vidhyaa_order_receipt_tokens';

export function saveOrderReceiptToken(orderKey: string, receiptToken?: string): void {
  if (!orderKey || !receiptToken) return;
  try {
    const raw = sessionStorage.getItem(RECEIPT_TOKENS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(orderKey).trim()] = String(receiptToken).trim();
    sessionStorage.setItem(RECEIPT_TOKENS_KEY, JSON.stringify(map));
  } catch {}
}

export function getOrderReceiptToken(orderKey: string): string {
  if (!orderKey) return '';
  try {
    const raw = sessionStorage.getItem(RECEIPT_TOKENS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return String(map?.[String(orderKey).trim()] || '');
  } catch {
    return '';
  }
}

export async function saveProduct(product: Product): Promise<Product> {
  const sanitized = sanitizeProductForFirestore(product);
  if (sanitized.videoUrl && sanitized.showInShoppingVideos === undefined) {
    sanitized.showInShoppingVideos = true;
  }
  unmarkProductDeleted(sanitized.id);

  let firestoreSuccess = false;
  let firestoreError: any = null;

  // 1. Persist directly to individual Firestore document /products/{id}
  try {
    await setDoc(doc(db, PRODUCTS_COL, sanitized.id), sanitized);
    firestoreSuccess = true;
    console.log(`[Firestore] Product "${sanitized.name}" (${sanitized.id}) saved successfully.`);
  } catch (error: any) {
    firestoreError = error;
    console.error('[Firestore] Error saving product to Firestore:', error);
  }

  // 2. Persist to server REST API /api/products as a reliable backup
  let serverSuccess = false;
  try {
    if (typeof fetch !== 'undefined') {
      const adminToken = getAdminAuthToken();
      if (adminToken) {
        const resp = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-token': adminToken
          },
          body: JSON.stringify({ product: sanitized })
        }).catch(() => null);

        if (resp && resp.ok) {
          serverSuccess = true;
          console.log(`[Server] Product "${sanitized.name}" (${sanitized.id}) saved to server store.`);
        }
      }
    }
  } catch (serverErr) {
    console.warn('[Server] Notice saving product to server endpoint:', serverErr);
  }

  // 3. Update local cache
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

  // Report or throw Firestore errors only if both Firestore and server persistence failed
  if (!firestoreSuccess) {
    if (serverSuccess || cached.length > 0) {
      console.warn(`[Firestore Warning] Firestore write delayed (${firestoreError?.message || 'offline/quota'}). Product preserved in server and local store.`);
    } else if (firestoreError) {
      handleFirestoreError(firestoreError, OperationType.WRITE, `${PRODUCTS_COL}/${sanitized.id}`);
    } else {
      throw new Error('Failed to confirm product save to database.');
    }
  }

  return sanitized;
}

export async function deleteProduct(productId: string): Promise<void> {
  // Update local cache and persistent deletion list
  markProductDeleted(productId);
  const updated = getCachedProducts().filter((p) => p.id !== productId);
  __vidhyaaMemProducts = updated;
  saveCachedProducts(updated);

  // 1. Delete from Firestore document
  try {
    await deleteDoc(doc(db, PRODUCTS_COL, productId));
    console.log(`[Firestore] Product "${productId}" deleted successfully.`);
  } catch (error) {
    console.warn('[Firestore] Notice deleting product from Firestore:', error);
  }

  // 2. Delete from server REST API
  try {
    if (typeof fetch !== 'undefined') {
      const adminToken = getAdminAuthToken();
      if (adminToken) {
        await fetch(`/api/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-token': adminToken
          }
        }).catch(() => null);
      }
    }
  } catch (serverErr) {
    console.warn('[Server] Notice deleting product from server endpoint:', serverErr);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vidhyaa_products_updated', { detail: updated }));
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
      .map((c) => ({ ...c, image: resolveCategoryCoverImage(c.id, c.slug, c.image) }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    saveCachedCategories(merged);
    return merged.length > 0 ? merged : INITIAL_CATEGORIES;
  } catch (error) {
    console.warn('Error fetching categories from Firestore, using cached or initial:', error);
    const validCached = cached
      .filter((c) => !LEGACY_CATEGORY_IDS.has(c.id) && !deletedCatIds.has(c.id))
      .map((c) => ({ ...c, image: resolveCategoryCoverImage(c.id, c.slug, c.image) }));
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

export function formatIndianPhone(raw?: string | null): string {
  const str = String(raw || '').trim();
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91 ${digits.slice(1)}`;
  return str;
}

export function formatFullAddress(addr?: Partial<Address> | string | null): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  const streetParts = [addr.houseNo, addr.area].filter(Boolean).join(', ');
  const mainStreet = addr.street || streetParts;
  const cityStatePin = [addr.city, addr.state].filter(Boolean).join(', ');
  const withPin = addr.pincode ? (cityStatePin ? `${cityStatePin} - ${addr.pincode}` : addr.pincode) : cityStatePin;
  return [mainStreet, addr.landmark, withPin].filter(Boolean).join(', ');
}

export function isOrderPaid(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (order.isPaid === true) return true;
  const s = String(order.paymentStatus || '').trim().toLowerCase();
  return s === 'paid' || s === 'success' || s === 'captured' || s === 'completed';
}

function parseMoney(val: any, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹,\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return input;
}

export function $sanitizeOrder(raw: any): Order | null {
  if (!raw || typeof raw !== 'object') return null;

  const items: OrderItem[] = Array.isArray(raw.items)
    ? raw.items.map((it: any) => {
        const price = Math.max(0, parseMoney(it?.price ?? it?.unitPrice, 0));
        const qty = Math.max(1, Math.round(parseMoney(it?.quantity ?? it?.qty, 1)));
        const mrp = Math.max(0, parseMoney(it?.mrp, price));
        return {
          productId: String(it?.productId || it?.id || 'prod-custom'),
          productName: String(it?.productName || it?.title || it?.name || 'Jewellery Item'),
          variationId: String(it?.variationId || 'default'),
          variationName: String(it?.variationName || it?.variation || ''),
          quantity: qty,
          price,
          mrp,
          image: String(it?.image || it?.thumbnail || ''),
          sku: String(it?.sku || '')
        };
      })
    : [];

  const itemsSubtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
  const parsedSubtotal = parseMoney(raw.subtotal ?? raw.subTotal, 0);
  const subtotal = parsedSubtotal > 0 ? parsedSubtotal : itemsSubtotal;
  const discount = Math.max(0, parseMoney(raw.discount ?? raw.couponSavings, 0));
  const deliveryCharge = Math.max(0, parseMoney(raw.deliveryCharge ?? raw.shippingCharge, 0));
  const computedTotal = Math.max(0, subtotal - discount + deliveryCharge);

  let rawTotal = parseMoney(raw.totalAmount, 0);
  if (rawTotal <= 0) rawTotal = parseMoney(raw.total, 0);
  if (rawTotal <= 0) rawTotal = parseMoney(raw.orderAmount ?? raw.order_amount ?? raw.finalAmount ?? raw.amount, 0);
  const totalAmount = rawTotal > 0 ? rawTotal : computedTotal;

  const rawCustomer = raw.customer && typeof raw.customer === 'object' ? raw.customer : raw.customer_details || {};
  const rawAddrObj =
    raw.shippingAddress && typeof raw.shippingAddress === 'object'
      ? raw.shippingAddress
      : raw.shipping_address && typeof raw.shipping_address === 'object'
      ? raw.shipping_address
      : null;

  const customerName = String(
    raw.customerName ||
      raw.name ||
      rawCustomer.name ||
      rawCustomer.customer_name ||
      rawAddrObj?.name ||
      rawAddrObj?.fullName ||
      'Customer'
  ).trim();
  const customerEmail = String(
    raw.customerEmail || raw.email || rawCustomer.email || rawCustomer.customer_email || ''
  ).trim();
  const customerPhone = formatIndianPhone(
    raw.customerPhone ||
      raw.phone ||
      raw.mobile ||
      rawCustomer.phone ||
      rawCustomer.customer_phone ||
      rawAddrObj?.phone ||
      ''
  );

  const houseNo = rawAddrObj
    ? String(rawAddrObj.houseNo || rawAddrObj.houseNumber || rawAddrObj.flatNo || '').trim()
    : '';
  const area = rawAddrObj
    ? String(rawAddrObj.area || rawAddrObj.addressLine2 || '').trim()
    : '';
  const rawStreet = rawAddrObj
    ? String(rawAddrObj.street || rawAddrObj.addressLine1 || [houseNo, area].filter(Boolean).join(', ')).trim()
    : typeof raw.shippingAddress === 'string'
    ? raw.shippingAddress.trim()
    : '';

  const shipping: Address = {
    id: String(rawAddrObj?.id || 'ship_addr'),
    name: String(rawAddrObj?.name || rawAddrObj?.fullName || customerName),
    phone: formatIndianPhone(rawAddrObj?.phone || customerPhone),
    ...(houseNo ? { houseNo } : {}),
    ...(area ? { area } : {}),
    street: rawStreet || [houseNo, area].filter(Boolean).join(', '),
    landmark: String(rawAddrObj?.landmark || '').trim(),
    city: String(rawAddrObj?.city || '').trim(),
    state: String(rawAddrObj?.state || '').trim(),
    pincode: String(rawAddrObj?.pincode || rawAddrObj?.zip || '').trim()
  };

  const rawPayStatus = String(raw.paymentStatus || raw.payment_status || '').trim().toLowerCase();
  let paymentStatus: Order['paymentStatus'] = 'pending';
  if (
    raw.isPaid === true ||
    ['paid', 'success', 'captured', 'completed'].includes(rawPayStatus)
  ) {
    paymentStatus = 'paid';
  } else if (['failed', 'cancelled', 'canceled', 'terminated'].includes(rawPayStatus)) {
    paymentStatus = 'failed';
  }

  const validStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  let orderStatus: OrderStatus = validStatuses.includes(raw.orderStatus) ? raw.orderStatus : 'Pending';
  if (paymentStatus === 'paid' && orderStatus === 'Pending') {
    orderStatus = 'Confirmed';
  }
  if (paymentStatus === 'failed' && orderStatus === 'Confirmed') {
    orderStatus = 'Pending';
  }

  const orderNumber = String(raw.orderNumber || raw.order_id || raw.id || 'VDH-ORD');
  const orderId = String(raw.id || `order_${orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`);

  const sanitized: Order & { total?: number } = {
    id: orderId,
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress: shipping,
    items,
    subtotal: subtotal > 0 ? subtotal : totalAmount,
    discount,
    deliveryCharge,
    total: totalAmount,
    totalAmount,
    paymentMethod: String(raw.paymentMethod || 'Online Payment'),
    paymentStatus,
    isPaid: paymentStatus === 'paid',
    currency: String(raw.currency || 'INR').toUpperCase(),
    orderStatus,
    upiReference: String(raw.upiReference || ''),
    trackingNumber: String(raw.trackingNumber || ''),
    courierName: String(raw.courierName || ''),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };

  if (raw.userId) sanitized.userId = String(raw.userId);
  if (raw.appliedPromo) sanitized.appliedPromo = String(raw.appliedPromo).trim().toUpperCase();
  if (raw.paymentId || raw.cf_payment_id) sanitized.paymentId = String(raw.paymentId || raw.cf_payment_id);
  if (raw.cfOrderId !== undefined || raw.cf_order_id !== undefined) sanitized.cfOrderId = raw.cfOrderId ?? raw.cf_order_id;
  if (raw.gatewayOrderId) sanitized.gatewayOrderId = String(raw.gatewayOrderId);
  if (raw.cardNetwork) sanitized.cardNetwork = String(raw.cardNetwork);
  if (raw.cardType) sanitized.cardType = String(raw.cardType);
  if (raw.paidAt) sanitized.paidAt = String(raw.paidAt);
  if (raw.paymentVerifiedAt) sanitized.paymentVerifiedAt = String(raw.paymentVerifiedAt);
  if (raw.verifiedAmount !== undefined) sanitized.verifiedAmount = parseMoney(raw.verifiedAmount, totalAmount);
  if (raw.verifiedVia) sanitized.verifiedVia = String(raw.verifiedVia);
  if (raw.failureReason) sanitized.failureReason = String(raw.failureReason);
  if (raw.giftItem) sanitized.giftItem = String(raw.giftItem);
  if (raw.notes) sanitized.notes = String(raw.notes);
  if (typeof raw.whatsappCustomerConfirmed === 'boolean') {
    sanitized.whatsappCustomerConfirmed = raw.whatsappCustomerConfirmed;
  }

  return sanitized;
}

export async function syncOrderToLocalAndFirestore(order: Order): Promise<Order> {
  const cleanOrder = $sanitizeOrder(order) || order;
  const cached = getCachedOrders();
  const filtered = cached.filter(
    (o) => o && o.id !== cleanOrder.id && o.orderNumber !== cleanOrder.orderNumber
  );
  saveCachedOrders([cleanOrder, ...filtered]);

  try {
    await setDoc(doc(db, ORDERS_COL, cleanOrder.id), stripUndefinedDeep(cleanOrder), { merge: true });
  } catch (err) {
    console.warn('Could not sync order directly to Firestore (saved in server & local cache):', err);
  }
  return cleanOrder;
}

// Orders
export async function createOrder(orderData: Omit<Order, 'id'>, preferredId?: string): Promise<Order> {
  const safeSuffix = orderData.orderNumber
    ? orderData.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderId = preferredId || `order_${safeSuffix}`;
  const rawFullOrder: Order = {
    ...orderData,
    customerPhone: formatIndianPhone(orderData.customerPhone),
    shippingAddress: {
      ...orderData.shippingAddress,
      phone: formatIndianPhone(orderData.shippingAddress?.phone || orderData.customerPhone)
    },
    id: orderId
  };

  let persistedOrder: Order = $sanitizeOrder(rawFullOrder) || rawFullOrder;

  // Persist to server REST API /api/orders and wait so server/JSON DB is updated cleanly
  try {
    if (typeof fetch !== 'undefined') {
      const customerToken = await getCustomerAuthToken();
      const adminToken = getAdminAuthToken();
      const authToken = customerToken || adminToken;
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(customerToken ? { 'x-customer-token': customerToken } : {}),
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(stripUndefinedDeep(persistedOrder))
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data?.order) {
          persistedOrder = $sanitizeOrder(data.order) || data.order;
        }
        if (data?.receiptToken) {
          saveOrderReceiptToken(persistedOrder.id, data.receiptToken);
          saveOrderReceiptToken(persistedOrder.orderNumber, data.receiptToken);
        }
      }
    }
  } catch {}

  const cached = getCachedOrders();
  saveCachedOrders([
    persistedOrder,
    ...cached.filter((o) => o && o.id !== persistedOrder.id && o.orderNumber !== persistedOrder.orderNumber)
  ]);

  try {
    // Save order to Firestore (strip undefined keys so Firestore never rejects)
    await setDoc(doc(db, ORDERS_COL, persistedOrder.id), stripUndefinedDeep(persistedOrder), { merge: true });

    // Atomically decrement stock for products and variations
    for (const item of persistedOrder.items) {
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

    return persistedOrder;
  } catch (error) {
    console.warn('Could not write order directly to Firestore, saved to API/local cache:', error);
    return persistedOrder;
  }
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  const cleanId = orderId.trim();
  if (!cleanId) return null;

  try {
    if (typeof fetch !== 'undefined') {
      const adminToken = getAdminAuthToken();
      const customerToken = await getCustomerAuthToken();
      const receiptToken = getOrderReceiptToken(cleanId);
      const authToken = adminToken || customerToken;
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      if (adminToken) headers['x-admin-token'] = adminToken;
      if (customerToken) headers['x-customer-token'] = customerToken;
      if (receiptToken) headers['x-order-token'] = receiptToken;

      const resp = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`, { headers });
      if (resp && resp.ok) {
        const data = await resp.json();
        if (data && (data.id || data.orderNumber)) {
          const sanitized = $sanitizeOrder(data) || data;
          if (data.redactedPii) (sanitized as Order).redactedPii = true;
          return sanitized;
        }
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, ORDERS_COL, cleanId));
    if (snap.exists()) {
      const ord = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) };
      return $sanitizeOrder(ord) || ord;
    }
    const q = query(collection(db, ORDERS_COL), where('orderNumber', '==', cleanId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const firstDoc = querySnap.docs[0];
      const ord = { id: firstDoc.id, ...(firstDoc.data() as Omit<Order, 'id'>) };
      return $sanitizeOrder(ord) || ord;
    }
  } catch (error) {
    console.warn('Error fetching order from Firestore, checking local cache:', error);
  }

  const cached = getCachedOrders();
  const localMatch = cached.find((o) => o && (o.id === cleanId || o.orderNumber === cleanId));
  return localMatch ? ($sanitizeOrder(localMatch) || localMatch) : null;
}

export async function fetchOrdersByUserId(
  userId: string,
  userEmail?: string,
  userPhone?: string
): Promise<Order[]> {
  const cleanUid = String(userId || '').trim();
  const cleanEmail = String(userEmail || '').trim().toLowerCase();
  const cleanPhoneDigits = String(userPhone || '').replace(/\D/g, '').slice(-10);

  const collected: any[] = [];

  // 1. Authoritative server API /api/orders
  try {
    if (typeof fetch !== 'undefined') {
      const params = new URLSearchParams();
      if (cleanUid) params.set('userId', cleanUid);
      if (cleanEmail) params.set('email', cleanEmail);
      if (cleanPhoneDigits) params.set('phone', cleanPhoneDigits);

      const customerToken = await getCustomerAuthToken();
      const adminToken = getAdminAuthToken();
      const authToken = customerToken || adminToken;
      if (authToken) {
        const resp = await fetch(`/api/orders?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            ...(customerToken ? { 'x-customer-token': customerToken } : {}),
            ...(adminToken ? { 'x-admin-token': adminToken } : {})
          }
        });
        if (resp && resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) collected.push(...data);
        }
      }
    }
  } catch {}

  // 2. Firestore queries (by userId and optional customerEmail)
  try {
    if (cleanUid) {
      const q = query(collection(db, ORDERS_COL), where('userId', '==', cleanUid));
      const snap = await getDocs(q);
      snap.forEach((d) => collected.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
    }
    if (cleanEmail && !cleanEmail.includes('@phone.vidhyaajewellery.com')) {
      const qEmail = query(collection(db, ORDERS_COL), where('customerEmail', '==', cleanEmail));
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => collected.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
    }
  } catch (error) {
    console.warn('Error fetching user orders from Firestore:', error);
  }

  // 3. Local cache fallback matching uid/email/phone
  const cached = getCachedOrders();
  cached.forEach((o) => {
    if (!o) return;
    const ordPhoneDigits = String(o.customerPhone || o.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
    const matchesUid = cleanUid && o.userId === cleanUid;
    const matchesEmail = cleanEmail && o.customerEmail && o.customerEmail.toLowerCase() === cleanEmail;
    const matchesPhone = cleanPhoneDigits && ordPhoneDigits === cleanPhoneDigits;
    if (matchesUid || matchesEmail || matchesPhone) {
      collected.push(o);
    }
  });

  // Deduplicate by orderNumber / id, preferring verified paid / newest record
  const byKey = new Map<string, Order>();
  for (const raw of collected) {
    const clean = $sanitizeOrder(raw);
    if (!clean) continue;
    const dedupeKey = clean.orderNumber || clean.id;
    const existing = byKey.get(dedupeKey);
    if (!existing) {
      byKey.set(dedupeKey, clean);
    } else {
      const existingPaid = isOrderPaid(existing);
      const nextPaid = isOrderPaid(clean);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const nextTime = new Date(clean.updatedAt || clean.createdAt || 0).getTime();
      if ((nextPaid && !existingPaid) || (nextPaid === existingPaid && nextTime >= existingTime)) {
        byKey.set(dedupeKey, clean);
      }
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function fetchAllOrders(): Promise<Order[]> {
  const cached = getCachedOrders();
  let serverOrders: any[] = [];
  try {
    if (typeof fetch !== 'undefined') {
      const adminToken = getAdminAuthToken();
      if (adminToken) {
        const resp = await fetch('/api/orders', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'x-admin-token': adminToken
          }
        });
        if (resp && resp.ok) {
          serverOrders = await resp.json();
        }
      }
    }
  } catch {}

  try {
    const snap = await getDocs(collection(db, ORDERS_COL));
    const firestoreOrders: any[] = [];
    snap.forEach((d) => {
      if (d && d.id) {
        firestoreOrders.push({ id: d.id, ...d.data() });
      }
    });

    const map = new Map<string, any>();
    (Array.isArray(serverOrders) ? serverOrders : []).forEach((o) => {
      if (o && (o.id || o.orderNumber)) map.set(o.id || o.orderNumber, o);
    });
    firestoreOrders.forEach((o) => {
      const key = o?.id || o?.orderNumber;
      if (o && key) {
        if (map.has(key)) {
          const ex = map.get(key);
          const mergedItems =
            Array.isArray(ex.items) && ex.items.length > 0
              ? ex.items
              : Array.isArray(o.items)
              ? o.items
              : [];
          const mergedShipping =
            ex.shippingAddress && typeof ex.shippingAddress === 'object'
              ? { ...o.shippingAddress, ...ex.shippingAddress }
              : o.shippingAddress;
          map.set(key, { ...o, ...ex, items: mergedItems, shippingAddress: mergedShipping });
        } else {
          map.set(key, o);
        }
      }
    });
    (Array.isArray(cached) ? cached : []).forEach((o) => {
      const key = o?.id || o?.orderNumber;
      if (o && key && !map.has(key)) map.set(key, o);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const cleanMerged = merged.map($sanitizeOrder).filter((x): x is Order => Boolean(x));
    saveCachedOrders(cleanMerged);
    return cleanMerged;
  } catch (error) {
    console.warn('Error fetching all orders from Firestore, serving unified cached/server orders:', error);
    const map = new Map<string, any>();
    (Array.isArray(serverOrders) ? serverOrders : []).forEach((o) => {
      if (o && (o.id || o.orderNumber)) map.set(o.id || o.orderNumber, o);
    });
    (Array.isArray(cached) ? cached : []).forEach((o) => {
      const key = o?.id || o?.orderNumber;
      if (o && key && !map.has(key)) map.set(key, o);
    });
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const cleanMerged = merged.map($sanitizeOrder).filter((x): x is Order => Boolean(x));
    saveCachedOrders(cleanMerged);
    return cleanMerged;
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  trackingNumber?: string,
  courierName?: string
): Promise<void> {
  const now = new Date().toISOString();
  const cached = getCachedOrders();
  const index = cached.findIndex((o) => o && (o.id === orderId || o.orderNumber === orderId));
  if (index !== -1) {
    cached[index].orderStatus = status;
    if (trackingNumber !== undefined) cached[index].trackingNumber = trackingNumber;
    if (courierName !== undefined) cached[index].courierName = courierName;
    cached[index].updatedAt = now;
    saveCachedOrders(cached);
  }

  try {
    if (typeof fetch !== 'undefined') {
      const adminToken = getAdminAuthToken();
      if (adminToken) {
        await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
            'x-admin-token': adminToken
          },
          body: JSON.stringify(stripUndefinedDeep({ orderStatus: status, trackingNumber, courierName }))
        });
      }
    }
  } catch {}

  try {
    const docRef = doc(db, ORDERS_COL, orderId);
    const updates: Partial<Order> = {
      orderStatus: status,
      updatedAt: now
    };
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (courierName !== undefined) updates.courierName = courierName;
    await updateDoc(docRef, stripUndefinedDeep(updates));
  } catch (error) {
    console.warn('Could not sync updated order status to Firestore:', error);
  }
}

export async function confirmOrderPaymentAdmin(orderId: string): Promise<Order | null> {
  const adminToken = getAdminAuthToken();
  if (!adminToken) {
    return null;
  }

  let updatedOrder: Order | null = null;
  try {
    const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-admin-token': adminToken
      }
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.order) {
        updatedOrder = $sanitizeOrder(data.order) || data.order;
      }
    }
  } catch {}

  if (updatedOrder) {
    await syncOrderToLocalAndFirestore(updatedOrder);
  }
  return updatedOrder;
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
