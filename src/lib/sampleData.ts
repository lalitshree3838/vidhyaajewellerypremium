import { Category, Product, StoreSettings } from '../types';
import categoriesJson from '../../data/categories.json';
import productsJson from '../../data/products.json';

export const GENUINE_PRODUCT_IMAGE_FILENAMES = new Set([
  '_gold_plated_multicolor_polki__1792725900655_ib5s.jpg',
  'diamond_set_with_violet_dublet_1792726066491_1ps7.jpg',
  'gold__diamond_plated_neclace_l_1792726223045_u5vt.jpg',
  'gold_polish_daily_use_no_effec_1792725709360_k74e.png',
  'gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
  'royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg'
]);

// Explicit list of sample/unwanted images and videos to strictly exclude
const BANNED_SAMPLE_IMAGES = [
  'ad_floral_cocktail_ring_750.jpg',
  'cushion_solitaire_winged_ring_1850.jpg',
  'lord_ganesha_ring_300.jpg',
  'oval_solitaire_infinity_ring_1150.jpg',
  'pink_beaded_choker_set_1250.jpg',
  'pink_emerald_cocktail_ring_1900.jpg',
  'pink_pearl_rani_haar_1150.jpg',
  'polki_rajwada_dome_ring_900.jpg',
  'rajwada_choker_set_green_2100.jpg',
  'rose_gold_diamond_set_2000.jpg',
  'sapphire_wheel_cocktail_ring_1650.jpg',
  'whatsapp_video_2026-10-20_at_8_00_00_pm_1792507723422_zdve.mp4',
  'beautiful_solitaire_ring_studed_with_dia_1792500643287_z8tw.mp4',
  'beautiful_diamond_ring_size_adjustable_l_1792502221377_pj9u.mp4',
  'whatsapp_video_2026-10-13_at_9_15_20_pm_1792506416620_5m3u.mp4',
  'antique_gold_floral_choker_1250',
  'antique_gold_temple_necklace_1250',
  'multicolor_polki_kundan_choker_2200',
  'ad_mangalsutra_sunburst_600',
  'gold_diamond_matar_mala_pendant_2200',
  'diamond_imitation_matar_mala_pendant_2200',
  'rajwada_bridal_antique_gold_set_10000',
  'ad_kada_kundan_work_gold_plated_1200',
  'ad_kundan_kada',
  'category_earrings_1791798255871',
  'category_anklets',
  'category_bangles',
  'category_bracelets',
  'category_chains',
  'category_pendants'
];

export const BANNED_PRODUCT_IDS = new Set([
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

export function isGenuineImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Immediately reject any sample, placeholder, demo, stock categories, or banned images
  if (
    trimmed.includes('unsplash.com') ||
    trimmed.includes('via.placeholder') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('sample') ||
    trimmed.includes('dummy') ||
    trimmed.includes('demo') ||
    trimmed.includes('necklace-1') ||
    trimmed.includes('earrings-1')
  ) {
    return false;
  }

  for (const banned of BANNED_SAMPLE_IMAGES) {
    if (trimmed.includes(banned)) {
      return false;
    }
  }

  // Allow official category showcase images in /categories/
  if (trimmed.startsWith('/categories/')) {
    return true;
  }

  // Allow all uploaded products in /products/ or /assets/
  if (trimmed.startsWith('/products/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/uploads/')) {
    return true;
  }

  // Check against verified uploaded jewellery files
  for (const filename of GENUINE_PRODUCT_IMAGE_FILENAMES) {
    if (trimmed === `/products/${filename}` || trimmed.endsWith(`/${filename}`)) {
      return true;
    }
  }

  // Allow genuine user uploads in base64 data format
  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  // Allow uploads stored in Firebase Cloud Storage or Google Cloud Storage
  if (
    trimmed.includes('firebasestorage.googleapis.com') ||
    trimmed.includes('firebasestorage.app') ||
    trimmed.includes('storage.googleapis.com')
  ) {
    return true;
  }

  // Allow blob previews during local upload
  if (trimmed.startsWith('blob:')) {
    return true;
  }

  // Allow external web URLs (https://, http://) as long as not a banned placeholder
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
    return true;
  }

  return false;
}

export function isGenuineVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject target videos
  for (const banned of BANNED_SAMPLE_IMAGES) {
    if (trimmed.includes(banned)) {
      return false;
    }
  }

  // Reject known dummy test buckets / public demo placeholders
  if (
    trimmed.includes('commondatastorage.googleapis.com/gtv-videos-bucket') ||
    trimmed.includes('w3schools.com/html/mov_bbb') ||
    trimmed.includes('BigBuckBunny') ||
    trimmed.includes('ForBiggerBlazes') ||
    trimmed.includes('ForBiggerEscapes') ||
    trimmed.includes('ForBiggerFun') ||
    trimmed.includes('ForBiggerJoy') ||
    trimmed.includes('ForBiggerMeltdowns') ||
    trimmed.includes('WeAreGoingOnBullrun')
  ) {
    return false;
  }

  // Allow all genuine video formats, blob previews, data URLs, Firebase storage, and local uploaded paths
  return (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}

export function isGenuineProduct(product?: Product | null): boolean {
  if (!product || !product.id || !product.name) return false;
  if (BANNED_PRODUCT_IDS.has(product.id)) return false;
  return true;
}

export const INITIAL_CATEGORIES: Category[] = (categoriesJson as unknown as Category[]).map((cat) => ({
  ...cat,
  galleryImages: (cat.galleryImages || []).filter((g) => isGenuineImageUrl(g.url)),
  videos: (cat.videos || []).filter((v) => isGenuineVideoUrl(v.videoUrl))
}));

export const INITIAL_PRODUCTS: Product[] = (productsJson as unknown as Product[]).filter(
  (p) => isGenuineProduct(p) && !BANNED_PRODUCT_IDS.has(p.id)
);

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  id: 'global-settings',
  freeDeliveryThreshold: 0,
  deliveryCharge: 100, // Fixed shipping charge of ₹100 per order
  upiVpa: 'neerajchauhan2000-1@oksbi',
  upiPayeeName: 'neeraj chauhan',
  upiMobileNumber: '9758350524',
  businessOwner: 'Neeraj Chauhan',
  pincode: '247667',
  contactPhone: '7302187770',
  contactEmail: 'care@vidhyaajewellery.com',
  contactAddress: 'Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India',
  announcementText: 'ROYAL HERITAGE ATELIER • CERTIFIED 92.5 STERLING SILVER • INSURED EXPRESS DISPATCH',
  scrollingOfferBarEnabled: true,
  offerTier1MinAmount: 1500,
  offerTier1GiftName: 'Gold Imitation Jhoomki',
  offerTier2MinAmount: 2000,
  offerTier2GiftName: 'Gold Imitation Bangles',
  updatedAt: new Date().toISOString()
};
