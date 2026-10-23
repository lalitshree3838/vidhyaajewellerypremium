import { Category, Product, StoreSettings } from '../types';

export const GENUINE_PRODUCT_IMAGE_FILENAMES = new Set([
  'pink_pearl_rani_haar_1150.jpg',
  'pink_emerald_cocktail_ring_1900.jpg',
  'ad_floral_cocktail_ring_750.jpg',
  'lord_ganesha_ring_300.jpg',
  'polki_rajwada_dome_ring_900.jpg',
  'rajwada_choker_set_green_2100.jpg',
  'pink_beaded_choker_set_1250.jpg',
  'rose_gold_diamond_set_2000.jpg',
  'sapphire_wheel_cocktail_ring_1650.jpg',
  'cushion_solitaire_winged_ring_1850.jpg',
  'oval_solitaire_infinity_ring_1150.jpg',
  '_gold_plated_multicolor_polki__1792725900655_ib5s.jpg',
  'diamond_set_with_violet_dublet_1792726066491_1ps7.jpg',
  'gold__diamond_plated_neclace_l_1792726223045_u5vt.jpg',
  'gold_polish_daily_use_no_effec_1792725709360_k74e.png',
  'gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
  'royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
  'hero-section-image-final.jpg'
]);

// Explicit list of sample/unwanted images to strictly exclude
const BANNED_SAMPLE_IMAGES = [
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
  'category_pendants',
  '/categories/'
];

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

  // Check against verified uploaded jewellery files
  for (const filename of GENUINE_PRODUCT_IMAGE_FILENAMES) {
    if (trimmed === `/products/${filename}` || trimmed.endsWith(`/${filename}`)) {
      return true;
    }
  }

  // Allow genuine user uploads stored in /products/uploads/ or /uploads/
  if (trimmed.startsWith('/products/uploads/') || trimmed.startsWith('/uploads/')) {
    return true;
  }

  // Allow genuine user uploads in base64 data format
  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  // Allow uploads stored in Firebase Cloud Storage
  if (trimmed.includes('firebasestorage.googleapis.com') || trimmed.includes('firebasestorage.app')) {
    return true;
  }

  // Allow luxury fallback banner
  if (trimmed === '/hero-section-image-final.jpg') {
    return true;
  }

  // Allow blob previews during local upload
  if (trimmed.startsWith('blob:')) {
    return true;
  }

  // Allow external web URLs (https://, http://) as long as not a banned placeholder
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return true;
  }

  return false;
}

export function isGenuineVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject dummy/sample videos from Google sample buckets, demo placeholders, or Big Buck Bunny
  if (
    trimmed.includes('commondatastorage.googleapis.com') ||
    trimmed.includes('gtv-videos-bucket') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('sample') ||
    trimmed.includes('dummy') ||
    trimmed.includes('demo') ||
    trimmed.includes('ForBigger') ||
    trimmed.includes('WeAreGoingOnBullrun')
  ) {
    return false;
  }

  // Allow valid user uploaded video URLs (e.g. data URLs, blob, Firebase storage, or direct uploads)
  return (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/videos/uploads/') ||
    trimmed.startsWith('/products/uploads/') ||
    trimmed.includes('firebasestorage.googleapis.com') ||
    trimmed.includes('firebasestorage.app') ||
    trimmed.startsWith('https://')
  );
}

export function isGenuineProduct(product?: Product | null): boolean {
  if (!product || !product.id || !product.name) return false;
  return true;
}


export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'necklaces',
    name: 'Necklaces & Necklace Sets',
    slug: 'necklaces',
    subtitle: 'Heritage 22K Micro Gold Plated & Temple Choker Sets',
    description: 'Regal bridal sets, floral chokers, temple necklaces, and 22K micron gold-plated heirlooms with matching earrings.',
    image: '/products/pink_pearl_rani_haar_1150.jpg',
    heroBannerUrl: '/products/pink_pearl_rani_haar_1150.jpg',
    subcategories: ['Chokers', 'Temple Jewellery', 'Kundan & Polki', 'Rani Haar', 'Necklace Sets'],
    active: true,
    order: 1,
    seoTitle: 'Necklaces & Necklace Sets | Temple Heirlooms & Floral Chokers',
    seoDescription: 'Shop handcrafted 22K micron gold imitation necklaces, bridal choker sets with free gifts, and temple jewellery with insured express delivery.',
    seoKeywords: 'necklaces, necklace sets, temple jewellery, floral choker, bridal necklace, vidhyaa jewellery',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [
      {
        id: 'img-neck-4',
        url: '/products/pink_pearl_rani_haar_1150.jpg',
        title: 'Pink White Pearl Multi-Layer Rani Haar with Antique Kundan Earrings',
        caption: '₹1,150 with Antique Kundan Earrings',
        altText: 'Pink White Pearl Multi-Layer Rani Haar with Antique Kundan Earrings',
        isCover: true,
        order: 1
      }
    ],
    videos: [
      {
        id: 'vid-necklace-01',
        title: 'Pink White Pearl Rani Haar Live 360° Atelier Showcase',
        videoUrl: '/videos/uploads/whatsapp_video_2026-10-20_at_8_00_00_pm_1792507723422_zdve.mp4',
        thumbnailUrl: '/products/pink_pearl_rani_haar_1150.jpg',
        description: 'Live studio reel showcasing the natural luster and movement of multi-layer freshwater seed pearls.',
        duration: '0:15',
        order: 1,
        published: true
      }
    ],
    promoBanners: [],
    featuredProductIds: ['prod-user-005'],
    customStoryTitle: 'The Art of 22K Antique Micron Gold Plating',
    customStoryBody: 'Each piece in our Necklaces collection undergoes a multi-layer micro electroplating process utilizing pure 22-karat gold over hypoallergenic brass. Handcrafted by heritage artisans, every design mimics the heft, touch, and heirloom luster of solid hallmarked gold.',
    customStoryImage: '',
    ctaTitle: 'Looking for a Custom Bridal Set?',
    ctaSubtitle: 'Connect with our head jewellery stylist for bespoke consultations and live video showcases.',
    ctaButtonText: 'Chat on WhatsApp',
    ctaButtonLink: 'https://wa.me/917302187770',
    ctaBgColor: '#FAF7F2'
  },
  {
    id: 'mangalsutra',
    name: 'Mangalsutra',
    slug: 'mangalsutra',
    subtitle: 'Sacred American Diamond & Black Onyx Heirlooms',
    description: 'Contemporary elegant bridal mangalsutras featuring sunburst feather motifs paved with VVS American Diamonds and matching earrings.',
    image: '/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
    heroBannerUrl: '/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
    subcategories: ['Sunburst Designs', 'AD Mangalsutras', 'Daily Wear'],
    active: true,
    order: 2,
    seoTitle: 'Designer AD Mangalsutra | Sunburst Feather Wing Design',
    seoDescription: 'Shop designer gold plated sunburst feather wing AD mangalsutra with matching stud earrings at ₹600.',
    seoKeywords: 'mangalsutra, ad mangalsutra, sunburst mangalsutra, gold mangalsutra',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [],
    videos: [],
    promoBanners: [],
    featuredProductIds: ['prod-user-003'],
    customStoryTitle: 'Sacred Tradition Meets Contemporary Grace',
    customStoryBody: 'Our mangalsutras feature 24K micro gold plating over hypoallergenic brass, genuine black spinel beads, and prong-set VVS-grade American Diamonds.',
    customStoryImage: '',
    ctaTitle: 'Everyday Sacred Elegance',
    ctaSubtitle: 'Complimentary velvet presentation box included with every mangalsutra.',
    ctaButtonText: 'Shop Mangalsutra',
    ctaButtonLink: '#products',
    ctaBgColor: '#FAF7F2'
  },
  {
    id: 'rings',
    name: 'Rings',
    slug: 'rings',
    subtitle: 'Solitaire Statement, Rajputana Polki & Divine Mandalas',
    description: 'Statement cocktail rings with pink emerald-cut solitaires, tiara coronets, Lord Ganesha blessings, and Rajwada uncut Polki domes.',
    image: '/products/pink_emerald_cocktail_ring_1900.jpg',
    heroBannerUrl: '/products/pink_emerald_cocktail_ring_1900.jpg',
    subcategories: ['Cocktail Rings', 'AD Rings', 'Devotional Rings', 'Polki Rings'],
    active: true,
    order: 3,
    seoTitle: 'Statement Rings | Pink Emerald Cut & Polki Rajwada Rings',
    seoDescription: 'Handcrafted luxury cocktail rings from ₹300 to ₹1,900 with free-size comfort adjustable shanks.',
    seoKeywords: 'statement rings, cocktail ring, ganesha ring, polki ring, ad ring',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [
      {
        id: 'img-ring-1',
        url: '/products/pink_emerald_cocktail_ring_1900.jpg',
        title: 'Gold Plated Pink Emerald Cut AD Statement Cocktail Ring',
        caption: 'Step-cut pink crystal & marquise diamond trellis',
        isCover: true,
        order: 1
      },
      {
        id: 'img-ring-2',
        url: '/products/ad_floral_cocktail_ring_750.jpg',
        title: 'American Diamond (AD) Floral Cocktail Ring',
        caption: 'Dual radiant solitaires & tiara petal coronet',
        order: 2
      },
      {
        id: 'img-ring-3',
        url: '/products/lord_ganesha_ring_300.jpg',
        title: 'Antique Gold-Plated Lord Ganesha Ring',
        caption: 'Sacred embossed idol with sunburst mandala',
        order: 3
      },
      {
        id: 'img-ring-4',
        url: '/products/polki_rajwada_dome_ring_900.jpg',
        title: 'Polki Rajwada Gold Imitation Ring',
        caption: 'Uncut Polki glass in 24K gold foil jadau bezel',
        order: 4
      },
      {
        id: 'img-ring-sapphire',
        url: '/products/sapphire_wheel_cocktail_ring_1650.jpg',
        title: 'Royal Sapphire Blue Doublet & Baguette Diamond Wheel Ring',
        caption: '₹1,650 • 360° Video Available • Sapphire petals with baguette halo',
        order: 5
      },
      {
        id: 'img-ring-cushion',
        url: '/products/cushion_solitaire_winged_ring_1850.jpg',
        title: 'Imperial Cushion Solitaire Winged Cocktail Ring',
        caption: '₹1,850 • 360° Video Available • Cushion solitaire with marquise wings',
        order: 6
      },
      {
        id: 'img-ring-oval',
        url: '/products/oval_solitaire_infinity_ring_1150.jpg',
        title: '22K Gold Oval Solitaire Halo Infinity Ring',
        caption: '₹1,150 • 360° Video Available • Oval diamond with crossover shank',
        order: 7
      }
    ],
    videos: [
      {
        id: 'vid-ring-01',
        title: 'Gold Plated Pink Emerald Cut AD Statement Ring Showcase',
        videoUrl: '/videos/uploads/beautiful_solitaire_ring_studed_with_dia_1792500643287_z8tw.mp4',
        thumbnailUrl: '/products/pink_emerald_cocktail_ring_1900.jpg',
        description: '360° light refraction through precision emerald-cut simulant and cathedral marquise trellis.',
        duration: '0:15',
        order: 1,
        published: true
      }
    ],
    promoBanners: [],
    featuredProductIds: ['prod-user-010', 'prod-user-031', 'prod-user-032', 'prod-user-033'],
    customStoryTitle: 'Universal Comfort-Fit Adjustable Shanks',
    customStoryBody: 'Every Vidhyaa ring is engineered with our comfort-fit adjustable band, allowing effortless wear across different fingers without resizing hassles.',
    customStoryImage: '/products/pink_emerald_cocktail_ring_1900.jpg',
    ctaTitle: 'Elevate Every Hand Gesture',
    ctaSubtitle: 'Free velvet presentation cushion included with every statement ring.',
    ctaButtonText: 'Shop Rings',
    ctaButtonLink: '#products',
    ctaBgColor: '#FAF7F2'
  },
  {
    id: 'devotional-rings',
    name: 'Devotional Rings',
    slug: 'devotional-rings',
    subtitle: 'Lord Ganesha Temple Blessing & Auspicious Mandalas',
    description: 'Sacred devotional rings featuring Lord Ganesha blessing idols, divine mandala cut-work filigree, and royal uncut Polki domes from ₹300.',
    image: '/products/lord_ganesha_ring_300.jpg',
    heroBannerUrl: '/products/lord_ganesha_ring_300.jpg',
    subcategories: ['Devotional Rings', 'Temple Rings', 'Mandala Rings', 'Cocktail Rings'],
    active: true,
    order: 4,
    seoTitle: 'Devotional Rings | Antique Gold Lord Ganesha Rings',
    seoDescription: 'Handcrafted spiritual temple rings featuring Lord Ganesha idols and sacred mandalas from ₹300.',
    seoKeywords: 'devotional rings, ganesha ring, temple ring, spiritual jewellery',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [
      {
        id: 'img-dev-ring-1',
        url: '/products/lord_ganesha_ring_300.jpg',
        title: 'Antique Gold-Plated Lord Ganesha Ring',
        caption: '₹300 • Auspicious seated Ganesha idol with mandala halo',
        isCover: true,
        order: 1
      },
      {
        id: 'img-dev-ring-2',
        url: '/products/polki_rajwada_dome_ring_900.jpg',
        title: 'Polki Rajwada Gold Imitation Ring',
        caption: 'Uncut Polki glass in 24K gold foil jadau bezel',
        order: 2
      },
      {
        id: 'img-dev-ring-3',
        url: '/products/ad_floral_cocktail_ring_750.jpg',
        title: 'American Diamond (AD) Floral Cocktail Ring',
        caption: 'Dual radiant solitaires & tiara petal coronet',
        order: 3
      },
      {
        id: 'img-dev-ring-4',
        url: '/products/pink_emerald_cocktail_ring_1900.jpg',
        title: 'Gold Plated Pink Emerald Cut AD Statement Cocktail Ring',
        caption: 'Step-cut pink crystal & marquise diamond trellis',
        order: 4
      }
    ],
    videos: [],
    promoBanners: [],
    featuredProductIds: ['prod-user-012', 'prod-user-013', 'prod-user-011', 'prod-user-010'],
    customStoryTitle: 'Auspicious Devotional Craftsmanship',
    customStoryBody: 'Handcrafted temple devotional rings blessed with sacred iconography and adjustable comfortable bands for daily prayer and festive celebrations.',
    customStoryImage: '/products/lord_ganesha_ring_300.jpg',
    ctaTitle: 'Sacred Blessings for Every Day',
    ctaSubtitle: 'Free protective velvet pouch included with every devotional ring.',
    ctaButtonText: 'Shop Devotional Rings',
    ctaButtonLink: '#products',
    ctaBgColor: '#FAF7F2'
  },
  {
    id: 'kangan-kada-bracelet',
    name: 'Kangan/Kada and Bracelet',
    slug: 'kangan-kada-and-bracelet',
    subtitle: 'Royal Rajputana Kadas, Traditional Kangans & Designer Cuffs',
    description: 'Handcrafted 22K micro gold plated kangan, artisanal openable kadas, and luxury American diamond bracelets with secure safety locks.',
    image: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
    heroBannerUrl: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
    subcategories: ['All Styles', 'Kangan / Kada', 'Bracelets', 'Openable Kadas', 'Traditional Bangles', 'Cuff Bracelets'],
    active: true,
    order: 5,
    seoTitle: 'Kangan, Kada & Bracelets | 22K Gold Finish Traditional Wristwear',
    seoDescription: 'Shop handcrafted 22K micro gold plated royal kadas, traditional wedding kangans, and designer diamond bracelets from ₹1,200.',
    seoKeywords: 'kangan, kada, bracelet, bangles, gold kangan, bridal kada, american diamond bracelet',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [
      {
        id: 'img-kb-polki-pair',
        url: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
        title: 'Royal 22K Gold Plated Polki Kundan & AD Openable Kadas',
        caption: '₹1,450 • Uncut Polki Kundan and Marquise Lattice',
        isCover: true,
        order: 1
      }
    ],
    videos: [],
    promoBanners: [],
    featuredProductIds: ['prod-user-034'],
    customStoryTitle: 'Precision Fit & Master Artisan Electroplating',
    customStoryBody: 'Our kangan, kada, and bracelet collections are forged from hypoallergenic brass, micro-electroplated with radiant 22K gold or platinum rhodium, and feature screw/hinge safety clasps designed for comfortable daily wear and bridal elegance.',
    customStoryImage: '',
    ctaTitle: 'Adorn Your Wrists with Royal Splendour',
    ctaSubtitle: 'Complimentary velvet storage pouch with every kada and bracelet.',
    ctaButtonText: 'Shop Kangan & Bracelets',
    ctaButtonLink: '#products',
    ctaBgColor: '#FAF7F2'
  },
  {
    id: 'watches',
    name: 'Watches',
    slug: 'watches',
    subtitle: 'Luxury Royal Timepieces & Artisan Wristwear',
    description: 'Handcrafted royal luxury watches and heritage timepieces celebrating timeless Indian craftsmanship with 22K micro gold and rose gold finishes.',
    image: '/products/uploads/gold__diamond_plated_neclace_l_1792726223045_u5vt.jpg',
    heroBannerUrl: '/products/uploads/gold__diamond_plated_neclace_l_1792726223045_u5vt.jpg',
    subcategories: ['All Watches', 'Royal Timepieces', 'Gold Finish Watches', 'Diamond Studded', 'Daily Wear'],
    active: true,
    order: 6,
    seoTitle: 'Luxury Watches & Heritage Timepieces | VIDHYAA Jewellery Studio',
    seoDescription: 'Shop handcrafted luxury watches, 22K gold-finish timepieces, and royal artisan wristwear with insured pan-India delivery.',
    seoKeywords: 'watches, luxury watches, gold watches, royal timepieces, vidhyaa jewellery',
    sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
    hiddenSections: [],
    galleryImages: [],
    videos: [],
    promoBanners: [],
    featuredProductIds: [],
    customStoryTitle: 'Precision Horology Meets Royal Heritage',
    customStoryBody: 'Our bespoke watch collection marries high-precision movements with imperial Indian metalcraft, featuring 22-karat micro gold plating and sapphire crystal glass.',
    customStoryImage: '',
    ctaTitle: 'Explore Bespoke Royal Timepieces',
    ctaSubtitle: 'Personalized caseback engraving and custom strap sizing available.',
    ctaButtonText: 'Enquire on WhatsApp',
    ctaButtonLink: 'https://wa.me/917302187770',
    ctaBgColor: '#FAF7F2'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  // 1. Antique Gold Floral Choker Set with Matching Drop Earrings (₹1,250)
  {
    id: 'prod-user-001',
    name: 'Antique Gold Floral Choker Set with Matching Drop Earrings',
    slug: 'antique-gold-floral-choker-set-drop-earrings',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Chokers',
    description: 'Artisanal antique 22K micro gold plated choker necklace adorned with sculpted floral petals and cascading drop pendant. Paired with matching floral drop earrings and includes a complimentary special gift of Gold Imitation Jhoomki earrings.',
    shortDescription: '₹1,250 with FREE Gift! Antique gold floral choker necklace with matching drop earrings + complimentary Gold Imitation Jhoomki.',
    material: '22K Antique Micro Gold Plated Brass & Floral Filigree',
    price: 1250,
    mrp: 2500,
    discountPercent: 50,
    images: ['/products/pink_beaded_choker_set_1250.jpg'],
    stock: 15,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 4.9,
    reviewCount: 52,
    specifications: {
      'Special Offer': '₹1,250 | FREE Gift Gold Imitation Jhoomki Included',
      'Included Gift': '1 Pair Matching Gold Imitation Jhoomki Earrings',
      'Plating': '22K Micro Antique Gold Finish',
      'Closure': 'Adjustable Gold Zari Thread Dori'
    },
    careInstructions: 'Store in the complimentary velvet pouch. Keep away from water and direct perfume spray.',
    variations: [
      {
        id: 'var-user-001-gold',
        name: 'Antique Gold + Free Jhumki',
        colorFinish: 'Antique Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-FLORAL-CHOKER-01',
        price: 1250,
        mrp: 2500,
        stock: 15,
        image: '/products/pink_beaded_choker_set_1250.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 2. Antique Gold Oxidised Pink Stone Temple Necklace Set with Bead Jhumka Earrings (₹1,250)
  {
    id: 'prod-user-002',
    name: 'Antique Gold Oxidised Pink Stone Temple Necklace Set with Bead Jhumka Earrings',
    slug: 'antique-gold-oxidised-pink-stone-temple-necklace-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Temple Jewellery',
    description: 'Exquisite antique gold oxidised temple jewellery necklace set showcasing handcrafted golden elephant medallions, hanging bell beads, and a regal pink teardrop stone centerpiece. Paired with matching statement jhumkas and includes a complimentary pair of Gold Imitation Bangles!',
    shortDescription: '₹1,250 with FREE Gift! Antique gold oxidised temple necklace with pink teardrop cabochon, gold elephant motifs, bead jhumkas + free Gold Imitation Bangles pair.',
    material: 'Antique Dual Tone German Silver & Gold Finish with Pink Cabochons',
    price: 1250,
    mrp: 2500,
    discountPercent: 50,
    images: ['/products/pink_beaded_choker_set_1250.jpg'],
    stock: 18,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    active: true,
    rating: 5.0,
    reviewCount: 46,
    specifications: {
      'Special Offer': '₹1,250 | FREE Gift Gold Imitation Bangles Included',
      'Included Gift': '1 Pair Handcrafted Gold Imitation Bangles',
      'Theme': 'Temple Heritage & Golden Elephant Medallions',
      'Earrings': 'Matching Pink Teardrop Bead Jhumkas'
    },
    careInstructions: 'Wipe with soft cotton cloth. Store airtight in pouch.',
    variations: [
      {
        id: 'var-user-002-pink',
        name: 'Oxidised Gold Pink + Free Bangles',
        colorFinish: 'Dual Tone Antique Gold',
        hexCode: '#C08081',
        sku: 'VDH-TEMPLE-PINK-02',
        price: 1250,
        mrp: 2500,
        stock: 18,
        image: '/products/pink_beaded_choker_set_1250.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 3. Gold Plated Multicolor Polki Kundan Choker Set with Green Stone Earrings (₹2,200)
  {
    id: 'prod-user-004',
    name: 'Gold Plated Multicolor Polki Kundan Choker Set with Green Stone Earrings',
    slug: 'gold-plated-multicolor-polki-kundan-choker-green-stone-earrings',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Kundan & Polki',
    description: 'Stunning high-fashion Navratna Polki Kundan choker necklace as featured on our atelier models. Hand-set with radiant emerald cabochons, ruby, sapphire, coral, and moonstone gemstones nestled in sparkling diamond filigree frames. Paired with designer emerald drop earrings.',
    shortDescription: '₹2,200! Regal Navratna multicolor Kundan choker encrusted with emerald, ruby, sapphire stones and matching green tops.',
    material: '22K Micron Gold Plated Alloy, Multi-Gem Cabochons & Handcrafted Jadau Polki',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/uploads/_gold_plated_multicolor_polki__1792725900655_ib5s.jpg'],
    stock: 12,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 84,
    specifications: {
      'Festive Offer': '₹2,200 (MRP ₹4,400)',
      'Setting': 'Hand-set Rajputana Jadau Kundan with Polki Cut Crystals',
      'Stones': 'Emerald, Ruby, Blue Sapphire, Topaz & Jade Accents',
      'Earrings': 'Matching Emerald & Polki Leaf Studs'
    },
    careInstructions: 'Clean with dry cloth only. Store in soft cotton velvet box.',
    variations: [
      {
        id: 'var-user-004-multi',
        name: 'Multicolor Royal Polki',
        colorFinish: 'Navratna Gold',
        hexCode: '#10B981',
        sku: 'VDH-KUNDAN-NAVRATNA-04',
        price: 2200,
        mrp: 4400,
        stock: 12,
        image: '/products/uploads/_gold_plated_multicolor_polki__1792725900655_ib5s.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 4. Pink White Pearl Multi-Layer Rani Haar with Antique Kundan Earrings (₹1,150)
  {
    id: 'prod-user-005',
    name: 'Pink White Pearl Multi-Layer Rani Haar with Antique Kundan Earrings',
    slug: 'pink-white-pearl-multi-layer-rani-haar-kundan-earrings',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Rani Haar',
    description: 'Aristocratic multi-strand Rani Haar featuring cascading layers of micro faceted pink beads and lustrous white freshwater seed pearls. Interspersed with six ornate antique Kundan floral circular brooches centered with ruby cabochons. Accompanied by matching floral studs.',
    shortDescription: '₹1,150 only! Multi-layer pink and white seed pearl rani haar with floral ruby kundan side brooches and matching earrings.',
    material: 'Multi-Strand Seed Pearls, Pink Crystal Beads, Ruby Kundan Floral Brooches',
    price: 1150,
    mrp: 2300,
    discountPercent: 50,
    images: [
      '/products/pink_pearl_rani_haar_1150.jpg'
    ],
    videoUrl: '/videos/uploads/whatsapp_video_2026-10-20_at_8_00_00_pm_1792507723422_zdve.mp4',
    stock: 20,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 39,
    specifications: {
      'Price': '₹1,150',
      'Length': '26-inch Majestic Long Rani Haar',
      'Beads': 'Faceted Pink Spinel Beads & Cultured White Seed Pearls',
      'Brooches': 'Antique Kundan Floral Rosettes with Ruby Centers'
    },
    careInstructions: 'Store in airtight box provided. Keep away from perfumes.',
    variations: [
      {
        id: 'var-user-005-pearl',
        name: 'Pink White Pearl Rani Haar',
        colorFinish: 'Pearl Gold',
        hexCode: '#F472B6',
        sku: 'VDH-RANI-HAAR-PEARL-05',
        price: 1150,
        mrp: 2300,
        stock: 20,
        image: '/products/pink_pearl_rani_haar_1150.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 5. Fancy Gold Plated AD Mangalsutra with Matching Earrings (₹600)
  {
    id: 'prod-user-003',
    name: 'Fancy Gold Plated AD Mangalsutra with Matching Earrings',
    slug: 'fancy-gold-plated-ad-mangalsutra-matching-earrings',
    categoryId: 'mangalsutra',
    categoryName: 'Mangalsutra',
    subcategory: 'Sunburst Designs',
    description: 'Contemporary elegant bridal mangalsutra featuring a radiant sunburst wing pendant paved with VVS-grade American Diamonds, a dangling solitaire teardrop, traditional dual-strand black beads chain, and matching sunburst stud earrings.',
    shortDescription: '₹600 only! Designer gold plated sunburst feather wing AD mangalsutra with black onyx beads and matching stud earrings.',
    material: '24K Micro Gold Plated Brass, Black Spinel Beads & VVS American Diamonds',
    price: 600,
    mrp: 1200,
    discountPercent: 50,
    images: ['/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg'],
    stock: 30,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 65,
    specifications: {
      'Price Tag': '₹600 Special Value',
      'Design': 'Sunburst Wing Silhouette with Teardrop Solitaire',
      'Chain': 'Black Onyx & Micro Gold Link Beads (18-inch)',
      'Earrings': '1 Pair Matching Sunburst Tops Included'
    },
    careInstructions: 'Keep in velvet box, avoid moisture and sprays.',
    variations: [
      {
        id: 'var-user-003-ms',
        name: 'Gold Plated AD Sunburst',
        colorFinish: 'Yellow Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-MANGL-SUNBURST-03',
        price: 600,
        mrp: 1200,
        stock: 30,
        image: '/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 6. Gold Plated Pink Emerald Cut AD Statement Cocktail Ring (₹1,450)
  {
    id: 'prod-user-010',
    name: 'Gold Plated Pink Emerald Cut AD Statement Cocktail Ring',
    slug: 'gold-plated-pink-emerald-cut-ad-statement-cocktail-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'Cocktail Rings',
    description: 'Showstopping red-carpet cocktail ring showcasing a massive step-cut pink morganite/sapphire simulant, flanked by an intricate cathedral trellis of marquise-cut American Diamonds. Set on an 18K yellow gold plated comfort-fit adjustable band.',
    shortDescription: 'Monumental pink emerald-cut solitaire cocktail ring with elaborate floral marquise diamond halo and adjustable gold band.',
    material: '18K Micro Gold Plated Alloy, Pink Emerald-Cut Crystal & Marquise Diamonds',
    price: 1450,
    mrp: 2900,
    discountPercent: 50,
    images: [
      '/products/pink_emerald_cocktail_ring_1900.jpg'
    ],
    videoUrl: '/videos/uploads/beautiful_solitaire_ring_studed_with_dia_1792500643287_z8tw.mp4',
    stock: 20,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    active: true,
    rating: 5.0,
    reviewCount: 34,
    specifications: {
      'Center Stone': 'Faceted Pink Emerald Step-Cut (16x12mm)',
      'Halo': 'Multi-Tier Marquise Cluster Cathedral Trellis',
      'Size': 'Universal Free-Size Comfort Adjustable Shank',
      'Collection': 'Royal Statement Cocktail Rings'
    },
    careInstructions: 'Avoid chemicals, sprays, and water. Wipe clean before storing.',
    variations: [
      {
        id: 'var-user-010-pink',
        name: 'Pink Emerald Statement Ring',
        colorFinish: 'Pink & Yellow Gold',
        hexCode: '#F472B6',
        sku: 'VDH-RING-PINK-EMERALD-10',
        price: 1450,
        mrp: 2900,
        stock: 20,
        image: '/products/pink_emerald_cocktail_ring_1900.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 7. American Diamond (AD) Floral Cocktail Ring (₹700)
  {
    id: 'prod-user-011',
    name: 'American Diamond (AD) Floral Cocktail Ring',
    slug: 'american-diamond-ad-floral-cocktail-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'AD Rings',
    description: 'Modern crossover bypass ring spotlighting two luminous radiant-cut American Diamonds crowned by fan-shaped marquise diamond petal coronets. Finished with double pavé eternity bands and micro gold plating.',
    shortDescription: 'Avant-garde dual radiant-cut American Diamond floral tiara crossover cocktail ring.',
    material: 'Micro Gold & Rhodium Dual Plated Alloy with VVS American Diamonds',
    price: 700,
    mrp: 1400,
    discountPercent: 50,
    images: [
      '/products/ad_floral_cocktail_ring_750.jpg'
    ],
    videoUrl: '/videos/uploads/beautiful_diamond_ring_size_adjustable_l_1792502221377_pj9u.mp4',
    stock: 25,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.8,
    reviewCount: 29,
    specifications: {
      'Design': 'Bypass Tiara Crossover with Twin Solitaires',
      'Shank': 'Dual Eternity Pavé Micro Bands',
      'Size': 'Free Size Adjustable Fit',
      'Collection': 'Floral AD Rings'
    },
    careInstructions: 'Store in soft velvet box. Avoid direct contact with detergents.',
    variations: [
      {
        id: 'var-user-011-floral',
        name: 'Dual Radiant Floral AD Ring',
        colorFinish: 'Dual Tone Gold',
        hexCode: '#DFB982',
        sku: 'VDH-RING-AD-FLORAL-11',
        price: 700,
        mrp: 1400,
        stock: 25,
        image: '/products/ad_floral_cocktail_ring_750.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 8. Antique Gold-Plated Lord Ganesha Ring (₹300)
  {
    id: 'prod-user-012',
    name: 'Antique Gold-Plated Lord Ganesha Ring',
    slug: 'antique-gold-plated-lord-ganesha-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'Devotional Rings',
    description: 'Auspicious spiritual jewellery: Deeply embossed three-dimensional seated Lord Ganesha blessing idol encircled by an ornate openwork mandala sunburst halo. Micro antique gold plated with comfortable adjustable shank.',
    shortDescription: 'Sacred antique gold temple circular mandala ring with three-dimensional Lord Ganesha centerpiece.',
    material: 'Antique 22K Micro Gold Plated Hypoallergenic Alloy',
    price: 300,
    mrp: 600,
    discountPercent: 50,
    images: [
      '/products/lord_ganesha_ring_300.jpg'
    ],
    stock: 40,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    active: true,
    rating: 5.0,
    reviewCount: 95,
    specifications: {
      'Motif': 'Lord Ganesha Divine Blessing Posture',
      'Frame': 'Intricate Cut-Work Mandala Filigree',
      'Size': 'Free Size Adjustable Band',
      'Collection': 'Devotional Temple Rings'
    },
    careInstructions: 'Store in airtight pouch. Clean with soft cloth.',
    variations: [
      {
        id: 'var-user-012-ganesha',
        name: 'Lord Ganesha Temple Blessing',
        colorFinish: 'Antique Temple Gold',
        hexCode: '#B8860B',
        sku: 'VDH-RING-GANESHA-12',
        price: 300,
        mrp: 600,
        stock: 40,
        image: '/products/lord_ganesha_ring_300.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 9. Polki Rajwada Gold Imitation Ring (₹700)
  {
    id: 'prod-user-013',
    name: 'Polki Rajwada Gold Imitation Ring',
    slug: 'polki-rajwada-gold-imitation-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'Polki Rings',
    description: 'Timeless royal court craftsmanship: Majestic convex dome ring handset with uncut Polki glass cabochons in 24K gold foil jadau bezels, accented with micro pavé diamonds and an intricately embossed vintage shank.',
    shortDescription: 'Heritage Rajasthani Rajwada dome cocktail ring studded with uncut Polki glass stones and royal carving.',
    material: '24K Gold Foil Jadau Bezel, Uncut Polki Glass & Micro Diamonds',
    price: 700,
    mrp: 1400,
    discountPercent: 50,
    images: [
      '/products/polki_rajwada_dome_ring_900.jpg'
    ],
    stock: 22,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 40,
    specifications: {
      'Style': 'Royal Rajasthani Rajwada Dome',
      'Setting': 'Jadau Foil Bezel with Cut-Glass Polki',
      'Size': 'Adjustable Back Band',
      'Collection': 'Rajwada Polki Rings'
    },
    careInstructions: 'Clean with dry cloth only. Store in soft cotton velvet box.',
    variations: [
      {
        id: 'var-user-013-polki',
        name: 'Polki Rajwada Gold Dome Ring',
        colorFinish: 'Polki Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-RING-POLKI-RAJWADA-13',
        price: 700,
        mrp: 1400,
        stock: 22,
        image: '/products/polki_rajwada_dome_ring_900.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 10. Gold polish rajwada choker set with Mang tika (₹2,100)
  {
    id: 'prod-user-014',
    name: 'Gold Polish Rajwada Choker Set with Mang Tikka',
    slug: 'gold-polish-rajwada-choker-set-mang-tika',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Kundan & Polki',
    description: 'Regal Rajasthani Rajwada bridal choker set crafted in 22K gold polish with cascading emerald green beads, radiant uncut Polki Jadau teardrop centerpiece, matching jhumka earrings, and ornate Mang Tikka.',
    shortDescription: '₹2,100! Gold polish Rajwada choker set with emerald green drops, matching jhumkas, and Mang Tikka.',
    material: '22K Gold Polish Alloy, Uncut Polki Jadau, Emerald Green Beads & Fine Pearls',
    price: 2100,
    mrp: 4200,
    discountPercent: 50,
    images: ['/products/rajwada_choker_set_green_2100.jpg'],
    videoUrl: '/videos/uploads/whatsapp_video_2026-10-13_at_9_15_20_pm_1792506416620_5m3u.mp4',
    stock: 15,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 38,
    specifications: {
      'Price': '₹2,100',
      'Set Includes': 'Choker Necklace + Matching Jhumkas + Forehead Mang Tikka',
      'Finish': '22K Antique Gold Polish with Rajputana Meenakari Detailing',
      'Stones': 'Emerald Green Glass Cabochons & Polki Kundan'
    },
    careInstructions: 'Store in airtight box. Keep away from water and direct sprays.',
    variations: [
      {
        id: 'var-user-014-green',
        name: 'Rajwada Green + Mang Tikka',
        colorFinish: 'Gold Polish & Emerald Green',
        hexCode: '#0B6623',
        sku: 'VDH-RAJWADA-CHOKER-14',
        price: 2100,
        mrp: 4200,
        stock: 15,
        image: '/products/rajwada_choker_set_green_2100.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 11. Pink beautiful choker set (₹1,250)
  {
    id: 'prod-user-015',
    name: 'Pink Crystal Pearl Beaded Choker Set',
    slug: 'pink-crystal-pearl-beaded-choker-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Chokers',
    description: 'Enchanting multi-strand blush pink crystal and natural pearl choker set featuring an imperial square pink doublet stone centerpiece surrounded by diamond zircon accents and matching floral tops.',
    shortDescription: '₹1,250! Pink beautiful choker set with layered pearls, pink gemstone center, and matching earrings.',
    material: 'Multi-Layer Pink Crystals, Fresh Water Pearls & Pink Doublet Stone',
    price: 1250,
    mrp: 2500,
    discountPercent: 50,
    images: ['/products/pink_beaded_choker_set_1250.jpg'],
    stock: 18,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 29,
    specifications: {
      'Price': '₹1,250',
      'Centerpiece': 'Cushion Cut Pink Doublet Gemstone in Diamond Bezel',
      'Strands': '7-Row Multi-Tier Seed Pearls & Pink Quartz Crystals',
      'Earrings': 'Matching Cushion Pink Studs'
    },
    careInstructions: 'Wipe with microfiber cloth after wear. Store in dry pouch.',
    variations: [
      {
        id: 'var-user-015-pink',
        name: 'Blush Pink & Pearl',
        colorFinish: 'Rose Pink & Pearl',
        hexCode: '#F4C2C2',
        sku: 'VDH-PINK-CHOKER-15',
        price: 1250,
        mrp: 2500,
        stock: 18,
        image: '/products/pink_beaded_choker_set_1250.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 12. Rose gold diamond set look alike real diamond set (₹2,000)
  {
    id: 'prod-user-016',
    name: 'Rose Gold American Diamond Waterfall Fringe Set',
    slug: 'rose-gold-american-diamond-waterfall-fringe-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Breathtaking luxury rose gold plated necklace set designed to mimic real solitaire diamonds, featuring a cascading waterfall fringe of VVS diamond zircons and matching chandelier drop earrings.',
    shortDescription: '₹2,000! Rose gold diamond set, look-alike real diamond jewellery with matching chandelier earrings.',
    material: 'Rose Gold Micron Plating, VVS Quality American Diamond (AD) Zircons',
    price: 2000,
    mrp: 4000,
    discountPercent: 50,
    images: ['/products/rose_gold_diamond_set_2000.jpg'],
    stock: 14,
    inStock: true,
    isFeatured: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 42,
    specifications: {
      'Price': '₹2,000',
      'Plating': 'Everlasting Rose Gold Micro Electroplating',
      'Stones': 'High Refraction VVS Lab-Created Solitaire Zircons',
      'Clasp': 'Adjustable Box Safety Clasp'
    },
    careInstructions: 'Keep away from moisture and chemical sprays. Store in velvet casing.',
    variations: [
      {
        id: 'var-user-016-rosegold',
        name: 'Rose Gold Solitaire',
        colorFinish: 'Rose Gold',
        hexCode: '#B76E79',
        sku: 'VDH-ROSE-DIAMOND-16',
        price: 2000,
        mrp: 4000,
        stock: 14,
        image: '/products/rose_gold_diamond_set_2000.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 13. Diamond chocker with pink dublet stone (₹2,200)
  {
    id: 'prod-user-017',
    name: 'Diamond Choker with Pink Doublet Centerpiece',
    slug: 'diamond-choker-pink-doublet-centerpiece',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Chokers',
    description: 'Stately wide bridal diamond choker set paved with brilliant-cut diamonds and an oval glowing pink doublet gemstone cabochon centerpiece. Includes matching teardrop earrings.',
    shortDescription: '₹2,200! Diamond choker with pink doublet stone, look-alike real diamond fine jewellery.',
    material: 'Platinum Rhodium & Gold Finish, Pink Doublet Gemstone & Pavé Diamonds',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/pink_doublet_diamond_choker_2200.jpg'],
    stock: 16,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 31,
    specifications: {
      'Price': '₹2,200',
      'Design': 'Crown Lattice Pavé Band with Oval Pink Doublet',
      'Style': 'Royal Red Carpet High Jewellery',
      'Earrings': 'Matching Teardrop Pink Doublet Drops'
    },
    careInstructions: 'Clean gently with dry soft cloth. Avoid perfumes and water.',
    variations: [
      {
        id: 'var-user-017-pinkdoublet',
        name: 'Silver Diamond & Pink Doublet',
        colorFinish: 'Platinum & Pink',
        hexCode: '#E0A899',
        sku: 'VDH-DIAMOND-PINK-17',
        price: 2200,
        mrp: 4400,
        stock: 16,
        image: '/products/pink_doublet_diamond_choker_2200.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 14. Gold +Diamond Plated Neclace (₹2,200) + Free Bangles
  {
    id: 'prod-user-018',
    name: 'Gold & Diamond Plated Ruby Teardrop Necklace Set',
    slug: 'gold-diamond-plated-ruby-teardrop-necklace-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Artisan gold & diamond plated necklace showcasing a teardrop ruby centerpiece surrounded by scrolling diamond vines. Comes with matching earrings and includes a complimentary special gift of Gold Imitation Bangles.',
    shortDescription: '₹2,200 with FREE Gift! Gold + Diamond plated necklace set + complimentary Gold Imitation Bangles.',
    material: '22K Micro Gold & Rhodium Plating, Ruby Gemstone & Brilliant AD',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/gold_diamond_plated_necklace_2200.jpg'],
    stock: 20,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 5.0,
    reviewCount: 37,
    specifications: {
      'Special Offer': '₹2,200 | FREE Gift Gold Imitation Bangles Included',
      'Included Gift': '1 Pair Handcrafted Gold Imitation Bangles',
      'Center Stone': 'Teardrop Pigeon Blood Ruby Cabochon',
      'Finish': 'Dual Tone 22K Gold & Silver Rhodium'
    },
    careInstructions: 'Store in complimentary pouch. Keep away from water and direct sprays.',
    variations: [
      {
        id: 'var-user-018-ruby',
        name: 'Gold Diamond Ruby + Free Bangles',
        colorFinish: 'Gold & Ruby Red',
        hexCode: '#9B111E',
        sku: 'VDH-RUBY-NECKLACE-18',
        price: 2200,
        mrp: 4400,
        stock: 20,
        image: '/products/gold_diamond_plated_necklace_2200.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 15. Gold n Diamond pendent set with matar mala (₹2,200)
  {
    id: 'prod-user-019',
    name: 'Gold & Diamond Peacock Pendant Set with Matar Mala',
    slug: 'gold-diamond-peacock-pendant-matar-mala',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Majestic gold and diamond peacock pendant set suspended on a dual-tone gold and silver matar mala beaded chain. Repolishable in the future and looks identical to real diamond gold heirlooms.',
    shortDescription: '₹2,200! Gold & diamond peacock pendant set with matar mala chain, repolishable real-diamond look.',
    material: 'Dual-Tone Micron Gold Plating, Dual-Tone Matar Mala Chain, Ruby & AD',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg'],
    stock: 15,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 45,
    specifications: {
      'Price': '₹2,200',
      'Durability': 'Lifetime Repolishable Alloy Guarantee',
      'Chain': 'Handcrafted Dual-Tone Gold & Silver Fluted Matar Mala',
      'Motif': 'Imperial Dancing Peacock with Ruby Accents'
    },
    careInstructions: 'Wipe with cotton cloth. Repolishable when needed.',
    variations: [
      {
        id: 'var-user-019-peacock',
        name: 'Peacock Matar Mala Gold',
        colorFinish: 'Two-Tone Gold & Ruby',
        hexCode: '#D4AF37',
        sku: 'VDH-MATARMALA-PEACOCK-19',
        price: 2200,
        mrp: 4400,
        stock: 15,
        image: '/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 16. Diamond Imitation pendent set with matar mala (₹2,200) + Free Bangles
  {
    id: 'prod-user-020',
    name: 'Diamond Imitation Medallion Pendant Set with Matar Mala',
    slug: 'diamond-imitation-medallion-pendant-matar-mala',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Spectacular circular medallion diamond pendant set with concentric floral rings, hung from a two-tone matar mala chain with matching tops. Includes a special complimentary gift of Gold Imitation Bangles.',
    shortDescription: '₹2,200 with FREE Gift! Diamond imitation pendant set with matar mala chain + free Gold Imitation Bangles.',
    material: 'Diamond Zircons, 22K Micro Gold Accent & Two-Tone Matar Mala Chain',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg'],
    stock: 18,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 5.0,
    reviewCount: 36,
    specifications: {
      'Special Offer': '₹2,200 | FREE Gift Gold Imitation Bangles Included',
      'Included Gift': '1 Pair Handcrafted Gold Imitation Bangles',
      'Pendant': 'Concentric Floral Wheel Diamond Medallion',
      'Earrings': 'Matching Circular Diamond Studs'
    },
    careInstructions: 'Store in velvet pouch. Protect from moisture and sprays.',
    variations: [
      {
        id: 'var-user-020-medallion',
        name: 'Diamond Medallion + Free Bangles',
        colorFinish: 'Gold & Diamond',
        hexCode: '#FDFBF7',
        sku: 'VDH-MEDALLION-DIAMOND-20',
        price: 2200,
        mrp: 4400,
        stock: 18,
        image: '/products/uploads/royal_gold_ad_square_pendant_n_1792726395202_nzjd.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 17. Gold plated antique gold set with Mang tika (₹10,000) + Free 4 Bangles
  {
    id: 'prod-user-006',
    name: 'Gold Plated Antique Rajwada Bridal Set with Mang Tikka & 4 Free Bangles',
    slug: 'gold-plated-antique-rajwada-bridal-set-mang-tika-bangles',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Temple Jewellery',
    description: 'Masterpiece antique gold Rajwada bridal set featuring multi-tiered kundan temple necklace, long chandelier earrings, and matching forehead Mang Tikka. Real antique gold diamond look with complimentary 4-piece Gold Plated Bangles set.',
    shortDescription: '₹10,000 Bridal Special! Complete antique gold Rajwada set with Mang Tikka, long earrings + FREE 4-piece gold plated bangles set.',
    material: 'Heavy Antique 24K Micron Gold Plated Brass, Polki Kundan & Gold Filigree',
    price: 10000,
    mrp: 20000,
    discountPercent: 50,
    images: ['/products/rajwada_choker_set_green_2100.jpg'],
    stock: 8,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    active: true,
    rating: 5.0,
    reviewCount: 65,
    specifications: {
      'Grand Special Offer': '₹10,000 | FREE Gift 4-Piece Gold Plated Bangles Set Included',
      'Included Gift': '4-Piece Gold Plated Traditional Rajwada Bangles',
      'Complete Set': 'Heavy Multi-Tier Choker + Long Heirlooms + Mang Tikka',
      'Luster': '24K Micron Heavy Antique Gold Hand-Finished by Heritage Goldsmiths'
    },
    careInstructions: 'Store in the luxury wooden heirloom box provided. Clean with dry cloth only.',
    variations: [
      {
        id: 'var-user-006-rajwada-bridal',
        name: 'Grand Rajwada Bridal + 4 Bangles',
        colorFinish: '24K Antique Royal Gold',
        hexCode: '#CF9B34',
        sku: 'VDH-RAJWADA-GRAND-06',
        price: 10000,
        mrp: 20000,
        stock: 8,
        image: '/products/rajwada_choker_set_green_2100.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 18. Diamond set with violet dublet stone (₹2,450)
  {
    id: 'prod-user-021',
    name: 'Diamond Set with Violet Amethyst Doublet Teardrop Stone',
    slug: 'diamond-set-violet-amethyst-doublet-stone',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Contemporary red carpet collar necklace paved with micro baguette and round diamonds, culminating in a dramatic deep violet amethyst doublet teardrop centerpiece with matching earrings.',
    shortDescription: '₹2,450! Designer diamond set with regal violet doublet teardrop stone and matching tops.',
    material: 'Platinum Rhodium Plated Alloy, Amethyst Violet Doublet & VVS Zircons',
    price: 2450,
    mrp: 4900,
    discountPercent: 50,
    images: ['/products/diamond_violet_doublet_set_2450.jpg'],
    stock: 12,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.9,
    reviewCount: 24,
    specifications: {
      'Price': '₹2,450',
      'Stone': 'Deep Amethyst Violet Doublet Faceted Teardrop',
      'Pavé': 'Feather Leaf Pavé Diamond Trellis Band',
      'Earrings': 'Matching Violet Doublet Drops'
    },
    careInstructions: 'Store in provided presentation box. Avoid harsh chemicals.',
    variations: [
      {
        id: 'var-user-021-violet',
        name: 'Diamond & Violet Doublet',
        colorFinish: 'Platinum & Violet',
        hexCode: '#8A2BE2',
        sku: 'VDH-VIOLET-DOUBLET-21',
        price: 2450,
        mrp: 4900,
        stock: 12,
        image: '/products/diamond_violet_doublet_set_2450.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 19. Gold Plated AD Necklace Set with Ruby Stone (₹2,100)
  {
    id: 'prod-user-022',
    name: 'Gold Plated AD Collar Necklace Set with Ruby Center Stone',
    slug: 'gold-plated-ad-collar-necklace-ruby-center-stone',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Chic gold plated omega collar necklace featuring a central oval ruby cabochon encircled by dual rows of brilliant American diamonds. Includes matching stud drop earrings.',
    shortDescription: '₹2,100! Gold plated AD necklace set with oval ruby centerpiece and matching earrings.',
    material: '22K Micro Gold Plated Omega Band, Lab-Created Ruby & Sparkling AD',
    price: 2100,
    mrp: 4200,
    discountPercent: 50,
    images: ['/products/gold_ad_ruby_necklace_set_2100.jpg'],
    stock: 15,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 5.0,
    reviewCount: 39,
    specifications: {
      'Price': '₹2,100',
      'Necklace Type': 'Rigid Smooth Omega Collar Band',
      'Center Stone': 'Oval Cut Royal Ruby with Double Diamond Halos',
      'Earrings': 'Matching Ruby Halo Drop Earrings'
    },
    careInstructions: 'Do not bend collar band. Store flat in velvet tray.',
    variations: [
      {
        id: 'var-user-022-rubyomega',
        name: 'Gold Collar Ruby Halo',
        colorFinish: '22K Gold & Ruby',
        hexCode: '#C71585',
        sku: 'VDH-OMEGA-RUBY-22',
        price: 2100,
        mrp: 4200,
        stock: 15,
        image: '/products/gold_ad_ruby_necklace_set_2100.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 20. Rainbow Crystal Bird Pendant Necklace Set (₹1,000)
  {
    id: 'prod-user-023',
    name: 'Rainbow Crystal Hummingbird Pendant Necklace Set',
    slug: 'rainbow-crystal-hummingbird-pendant-necklace-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Playful and joyful high-fashion necklace featuring a sculpted flying hummingbird pendant paved with multicolored rainbow micro-crystals (ruby, sapphire, turquoise, emerald) with matching bird stud earrings.',
    shortDescription: '₹1,000! Rainbow crystal bird pendant necklace set with matching hummingbird stud earrings.',
    material: '22K Gold Finish Chain, Multi-Color Rainbow Crystal Pavé',
    price: 1000,
    mrp: 2000,
    discountPercent: 50,
    images: ['/products/rainbow_bird_pendant_necklace_1000.jpg'],
    stock: 25,
    inStock: true,
    isFeatured: true,
    isNewArrival: true,
    active: true,
    rating: 4.9,
    reviewCount: 51,
    specifications: {
      'Price': '₹1,000',
      'Motif': 'Hummingbird in Flight with Enamelled Wings',
      'Crystals': 'Multi-Gem Rainbow Micro Zircons',
      'Chain Length': '18 Inches with 2 Inch Extender'
    },
    careInstructions: 'Keep in soft pouch. Wipe clean after wear.',
    variations: [
      {
        id: 'var-user-023-bird',
        name: 'Rainbow Hummingbird',
        colorFinish: 'Rainbow Multi-Color',
        hexCode: '#20B2AA',
        sku: 'VDH-RAINBOW-BIRD-23',
        price: 1000,
        mrp: 2000,
        stock: 25,
        image: '/products/rainbow_bird_pendant_necklace_1000.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 21. Antique 22K Micro Gold Royal Floral Choker Set with Jhumkas (₹2,400)
  {
    id: 'prod-user-024',
    name: 'Antique 22K Micro Gold Royal Floral Choker Set with Jhumkas',
    slug: 'antique-22k-micro-gold-royal-floral-choker-set-jhumkas',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Chokers',
    description: 'Traditional royal court bridal choker crafted in solid 22K micro gold plating with handcrafted floral crests, dangling bell drops, and paired with matching traditional bell jhumkas.',
    shortDescription: '₹2,400! Antique 22K micro gold royal floral choker set with matching bridal jhumkas.',
    material: '22K Micro Antique Gold Finish Hypoallergenic Brass, Floral Filigree',
    price: 2400,
    mrp: 4800,
    discountPercent: 50,
    images: ['/products/antique_22k_micro_gold_choker_set_1.jpg'],
    stock: 14,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 5.0,
    reviewCount: 44,
    specifications: {
      'Price': '₹2,400',
      'Design': 'Sculpted Lotus Rosettes with Cascading Floral Fringe',
      'Earrings': 'Matching Bell Jhumkas with Seed Pearl Hangings',
      'Plating': '22K Micro Gold Plated'
    },
    careInstructions: 'Store in padded pouch. Avoid direct contact with moisture.',
    variations: [
      {
        id: 'var-user-024-floral',
        name: '22K Micro Gold Floral',
        colorFinish: '22K Antique Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-CHOKER-FLORAL-24',
        price: 2400,
        mrp: 4800,
        stock: 14,
        image: '/products/antique_22k_micro_gold_choker_set_1.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 22. Royal Gold AD Square Pendant Necklace Set (₹2,200)
  {
    id: 'prod-user-025',
    name: 'Royal Gold AD Square Mosaic Pendant Necklace Set',
    slug: 'royal-gold-ad-square-mosaic-pendant-necklace-set',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Geometric haute couture necklace featuring a polished gold flat curb chain and a statement rectangular baguette diamond mosaic pendant with matching earrings.',
    shortDescription: '₹2,200! Royal gold AD square mosaic pendant collar necklace set with matching tops.',
    material: '22K Gold Plated Curb Chain, Baguette & Round Cut American Diamonds',
    price: 2200,
    mrp: 4400,
    discountPercent: 50,
    images: ['/products/royal_gold_ad_square_pendant_2200.jpg'],
    stock: 16,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 4.8,
    reviewCount: 33,
    specifications: {
      'Price': '₹2,200',
      'Pendant': 'Rectangular Baguette-Cut Mosaic Diamond Frame',
      'Chain': 'High-Polish Italian Style Flat Gold Curb Link',
      'Earrings': 'Matching Geometric Baguette Studs'
    },
    careInstructions: 'Wipe with microfiber cloth. Store flat in case.',
    variations: [
      {
        id: 'var-user-025-mosaic',
        name: 'Gold & Baguette Diamond',
        colorFinish: 'Gold & Clear Diamond',
        hexCode: '#E5C158',
        sku: 'VDH-MOSAIC-SQUARE-25',
        price: 2200,
        mrp: 4400,
        stock: 16,
        image: '/products/royal_gold_ad_square_pendant_2200.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 23. Pink Green Jade Stone Diamond Floral Necklace Set with Tiara (₹2,500) + Free Bangles
  {
    id: 'prod-user-026',
    name: 'Pink & Green Jade Stone Floral Necklace Set with Tiara & Free Bangles',
    slug: 'pink-green-jade-stone-floral-necklace-tiara-free-bangles',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Necklace Sets',
    description: 'Breathtaking garden-inspired fine jewellery: Hand-carved pastel pink and mint green jade stone blossoms accented with diamond clusters. Includes matching floral cuff tiara bracelet and complimentary Gold Imitation Bangles.',
    shortDescription: '₹2,500 with FREE Gift! Pink green jade stone floral necklace set with tiara + complimentary Gold Imitation Bangles.',
    material: 'Carved Natural Pink & Mint Green Jade Stones, AD Diamonds, Silver Rhodium',
    price: 2500,
    mrp: 5000,
    discountPercent: 50,
    images: ['/products/jade_diamond_floral_tiara_set_2500.jpg'],
    stock: 12,
    inStock: true,
    isFeatured: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 48,
    specifications: {
      'Special Offer': '₹2,500 | FREE Gift Gold Imitation Bangles Included',
      'Included Gift': '1 Pair Handcrafted Gold Imitation Bangles',
      'Tiara Bracelet': 'Matching Carved Jade Floral Cuff Bracelet / Tiara',
      'Gems': 'Natural Hand-Carved Jade Flowers & VVS Zircons'
    },
    careInstructions: 'Handle carved gemstones with care. Store in individual padded compartment.',
    variations: [
      {
        id: 'var-user-026-jade',
        name: 'Pink Mint Jade Floral + Tiara',
        colorFinish: 'Pink & Mint Jade',
        hexCode: '#98FF98',
        sku: 'VDH-JADE-FLORAL-26',
        price: 2500,
        mrp: 5000,
        stock: 12,
        image: '/products/jade_diamond_floral_tiara_set_2500.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 24. Gold polish Daily use no effect of perfume shampoo and water (₹900)
  {
    id: 'prod-user-027',
    name: 'Waterproof 22K Gold Polish Triangular Filigree Daily Wear Pendant Set',
    slug: 'waterproof-22k-gold-polish-triangular-filigree-daily-pendant',
    categoryId: 'necklaces',
    categoryName: 'Necklaces & Necklace Sets',
    subcategory: 'Daily Wear',
    description: 'Everyday waterproof jewellery engineered with zero tarnishing: 22K micro gold polish filigree pendant with ruby stone center. Tested to have zero effect from perfume, shampoo, or water. Includes matching drop earrings.',
    shortDescription: '₹900 Daily Wear! Zero tarnish waterproof gold polish pendant set, safe from perfume, shampoo & water.',
    material: 'Waterproof 22K Micro Gold Plated Brass, Anti-Tarnish Seal, Ruby Accent',
    price: 900,
    mrp: 1800,
    discountPercent: 50,
    images: ['/products/gold_polish_daily_use_pendant_900.jpg'],
    stock: 30,
    inStock: true,
    isFeatured: true,
    active: true,
    rating: 5.0,
    reviewCount: 62,
    specifications: {
      'Daily Wear Guarantee': 'No effect of perfume, shampoo, soap or water (100% Waterproof)',
      'Plating': 'Advanced PVD 22K Micron Gold Anti-Tarnish Coat',
      'Stone': 'Bezel-Set Ruby Red Crystal',
      'Earrings': 'Matching Triangular Drop Earrings'
    },
    careInstructions: 'Suitable for daily shower and wear. Zero special maintenance required.',
    variations: [
      {
        id: 'var-user-027-daily',
        name: 'Waterproof Daily Gold',
        colorFinish: '22K Gold Polish',
        hexCode: '#FFD700',
        sku: 'VDH-DAILY-GOLD-27',
        price: 900,
        mrp: 1800,
        stock: 30,
        image: '/products/gold_polish_daily_use_pendant_900.jpg',
        active: true
      }
    ],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },

  // 25. AD Kada with Kundan Work Size 2.6 Gold Plated (₹1,200)
  {
    id: 'prod-user-030',
    name: 'AD Kada with Kundan Work Size 2.6 Gold Plated (Pair)',
    slug: 'ad-kada-with-kundan-work-size-2-6-gold-plated-1200',
    categoryId: 'kangan-kada-bracelet',
    categoryName: 'Kangan/Kada and Bracelet',
    subcategory: 'Kangan / Kada',
    description: 'Exquisite pair of handcrafted 22K gold-plated openable bridal kadas featuring an intricate openwork lattice paved with micro-set American Diamonds (AD zircons), centered with radiant round bezel-set clear Kundan solitaire gems with yellow gold rims. Comes in standard size 2.6 with side hinge clasp and safety chain.',
    shortDescription: '₹1,200 Pair! AD Kada with Kundan work, size 2.6 gold plated with VVS zircons and safety clasp.',
    material: '22K Gold Micro Plated Alloy, High-Grade VVS American Diamonds & Bezel-Set Clear Kundan Stones',
    price: 1200,
    mrp: 2400,
    discountPercent: 50,
    images: ['/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg'],
    stock: 25,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 46,
    specifications: {
      'Size': '2.6 (Bangle Diameter: ~2.375 inches / 60 mm)',
      'Set Includes': '1 Pair (2 Pieces of Royal AD Kundan Kadas)',
      'Plating': '22K Micron Gold Polish with Anti-Tarnish Coating',
      'Stones': 'VVS American Diamonds & Clear Cut Bezel Kundan Gems',
      'Closure': 'Side Openable Hinge with Security Lock & Chain',
      'Care': 'Store in airtight velvet pouch. Keep away from perfumes.'
    },
    careInstructions: 'Store in the complimentary velvet pouch. Wipe with soft cotton cloth after wear. Keep away from water and direct perfume spray.',
    variations: [
      {
        id: 'var-user-030-2-6',
        name: 'Size 2.6 (Standard)',
        colorFinish: '22K Gold & Clear Kundan',
        hexCode: '#D4AF37',
        sku: 'VDH-KADA-AD-KUNDAN-26',
        price: 1200,
        mrp: 2400,
        stock: 25,
        image: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
        active: true
      },
      {
        id: 'var-user-030-2-4',
        name: 'Size 2.4 (Small)',
        colorFinish: '22K Gold & Clear Kundan',
        hexCode: '#D4AF37',
        sku: 'VDH-KADA-AD-KUNDAN-24',
        price: 1200,
        mrp: 2400,
        stock: 15,
        image: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
        active: true
      },
      {
        id: 'var-user-030-2-8',
        name: 'Size 2.8 (Large)',
        colorFinish: '22K Gold & Clear Kundan',
        hexCode: '#D4AF37',
        sku: 'VDH-KADA-AD-KUNDAN-28',
        price: 1200,
        mrp: 2400,
        stock: 12,
        image: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
        active: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 28. Royal Sapphire Blue Doublet & Baguette Diamond Wheel Cocktail Ring (₹1,650)
  {
    id: 'prod-user-031',
    name: 'Royal Sapphire Blue Doublet & Baguette Diamond Wheel Cocktail Ring',
    slug: 'royal-sapphire-blue-doublet-baguette-diamond-wheel-cocktail-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'Cocktail Rings',
    description: 'Breathtaking 360-degree statement cocktail ring featuring a brilliant round diamond center embraced by pear-cut royal blue sapphire doublet petals, encircled with a radiant starburst of baguette-cut diamonds and micropavé halo in platinum rhodium polish.',
    shortDescription: '₹1,650! Royal sapphire blue doublet petals with baguette diamond halo & adjustable shank.',
    material: 'Platinum Rhodium & 925 Sterling Silver Polish, Royal Blue Sapphire Doublet, Baguette & Round AD Diamonds',
    price: 1650,
    mrp: 3300,
    discountPercent: 50,
    images: [
      '/products/sapphire_wheel_cocktail_ring_1650.jpg'
    ],
    stock: 20,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 39,
    specifications: {
      'Craftsmanship': 'Master Artisan Handcrafted & Micro Electroplated',
      'Center Stone': 'Round Brilliant Solitaire AD Diamond',
      'Color Gemstones': 'Royal Sapphire Blue Doublet Gemstones',
      'Halo': 'Radial Baguette Cut Diamond Trellis + Round Pavé Rim',
      'Shank': 'Free-Size Comfort Fit Adjustable Band'
    },
    careInstructions: 'Store in airtight velvet case. Avoid water and perfumes.',
    variations: [
      {
        id: 'var-user-031-silver',
        name: 'Platinum Rhodium & Sapphire Blue',
        colorFinish: 'Platinum Rhodium & Blue',
        hexCode: '#002366',
        sku: 'VDH-RING-SAPPHIRE-31',
        price: 1650,
        mrp: 3300,
        stock: 20,
        image: '/products/sapphire_wheel_cocktail_ring_1650.jpg',
        active: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 29. Imperial Cushion Solitaire Winged Marquise Diamond Cocktail Ring (₹1,850)
  {
    id: 'prod-user-032',
    name: 'Imperial Cushion Solitaire Winged Marquise Diamond Cocktail Ring',
    slug: 'imperial-cushion-solitaire-winged-marquise-diamond-cocktail-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'Cocktail Rings',
    description: 'Magnificent monumental cocktail ring showcasing a massive clear cushion-cut diamond solitaire held in four-prong 22K gold basket, flanked by sculptural winged shoulders densely paved with shimmering marquise and pear-cut American Diamonds.',
    shortDescription: '₹1,850! Massive cushion solitaire diamond with winged marquise shoulders in 22K gold.',
    material: '22K Micro Gold Plating, VVS Lab Cushion Solitaire, Marquise & Pear Cut American Diamonds',
    price: 1850,
    mrp: 3700,
    discountPercent: 50,
    images: [
      '/products/cushion_solitaire_winged_ring_1850.jpg'
    ],
    stock: 18,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 42,
    specifications: {
      'Craftsmanship': 'Master Artisan Handcrafted & Micro Electroplated',
      'Center Stone': 'High-Refraction 10-Carat Look Cushion Cut Solitaire Diamond',
      'Shoulder Accents': 'Sculpted Angel Wings of Marquise & Pear Diamonds',
      'Plating': '22K Micro Gold Electroplate with Anti-Tarnish Seal',
      'Band': 'Comfort Smooth Adjustable Shank'
    },
    careInstructions: 'Store in the provided velvet cushion box. Keep clean with dry microfiber cloth.',
    variations: [
      {
        id: 'var-user-032-gold',
        name: '22K Gold & Cushion Solitaire',
        colorFinish: '22K Yellow Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-RING-CUSHION-32',
        price: 1850,
        mrp: 3700,
        stock: 18,
        image: '/products/cushion_solitaire_winged_ring_1850.jpg',
        active: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 30. 22K Gold Oval Solitaire Halo Infinity Ring (₹1,150)
  {
    id: 'prod-user-033',
    name: '22K Gold Oval Solitaire Halo Infinity Ring',
    slug: '22k-gold-oval-solitaire-halo-infinity-ring',
    categoryId: 'rings',
    categoryName: 'Rings',
    subcategory: 'AD Rings',
    description: 'Timeless luxury oval solitaire ring highlighted by a luminous oval brilliant diamond centerpiece framed with an ultra-fine micropavé diamond halo, set upon an infinity crossover split shank paved with diamonds in rich 22K yellow gold.',
    shortDescription: '₹1,150! Oval brilliant solitaire with halo and infinity crossover pavé split shank.',
    material: '22K Micron Gold Plated Alloy, VVS Oval Brilliant Solitaire & Micropavé Diamonds',
    price: 1150,
    mrp: 2300,
    discountPercent: 50,
    images: [
      '/products/oval_solitaire_infinity_ring_1150.jpg'
    ],
    stock: 22,
    inStock: true,
    isFeatured: true,
    isNewArrival: true,
    active: true,
    rating: 4.9,
    reviewCount: 31,
    specifications: {
      'Craftsmanship': 'Master Artisan Handcrafted & Micro Electroplated',
      'Center Stone': 'Oval Brilliant Cut Solitaire Diamond (VVS Simulant)',
      'Halo': 'Prong-Set Micropavé Diamond Coronet',
      'Shank Style': 'Crossover Infinity Split Shank',
      'Finish': '22K Micro Gold Polish'
    },
    careInstructions: 'Wipe with soft cloth. Store in padded jewellery pouch.',
    variations: [
      {
        id: 'var-user-033-oval',
        name: '22K Gold Oval Solitaire',
        colorFinish: '22K Yellow Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-RING-OVAL-33',
        price: 1150,
        mrp: 2300,
        stock: 22,
        image: '/products/oval_solitaire_infinity_ring_1150.jpg',
        active: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 31. Royal 22K Gold Plated Polki Kundan & AD Openable Kadas (Pair) (₹1,450)
  {
    id: 'prod-user-034',
    name: 'Royal 22K Gold Plated Polki Kundan & AD Openable Kadas (Pair)',
    slug: 'royal-22k-gold-plated-polki-kundan-ad-openable-kadas-pair',
    categoryId: 'kangan-kada-bracelet',
    categoryName: 'Kangan/Kada and Bracelet',
    subcategory: 'Kangan / Kada',
    description: 'Regal bridal kada pair crafted in 22K micro gold plating featuring large square cushion-cut clear uncut Polki Kundan stones set in gold foil bezels, framed with openwork jaali lattice of brilliant marquise and pear American Diamonds with side openable screw clasp.',
    shortDescription: '₹1,450 Pair! 360° Video Showcase. Royal Polki Kundan & AD lattice openable bridal kadas with screw clasp.',
    material: '22K Gold Plated Alloy, Uncut Polki Kundan Glass in Gold Foil, Marquise & Pear AD Zircons',
    price: 1450,
    mrp: 2900,
    discountPercent: 50,
    images: [
      '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg'
    ],
    stock: 20,
    inStock: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    active: true,
    rating: 5.0,
    reviewCount: 52,
    specifications: {
      'Craftsmanship': 'Master Artisan Handcrafted & Micro Electroplated',
      'Set Includes': '1 Pair (2 Pieces of Royal Openable Kadas)',
      'Stones': 'Uncut Polki Kundan Square Cabochons & Brilliant AD Zircons',
      'Closure': 'Side Openable Hinge with Security Screw Pin',
      'Finish': '22K Antique Micron Gold Polish'
    },
    careInstructions: 'Store in complimentary velvet pouch. Keep away from water and direct sprays.',
    variations: [
      {
        id: 'var-user-034-pair',
        name: '22K Gold Polki Kundan Pair',
        colorFinish: '22K Antique Gold',
        hexCode: '#D4AF37',
        sku: 'VDH-KADA-POLKI-AD-34',
        price: 1450,
        mrp: 2900,
        stock: 20,
        image: '/products/uploads/gold_rajwada_kada_openable_____1792726903001_4fx1.jpg',
        active: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

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
  updatedAt: new Date().toISOString()
};
