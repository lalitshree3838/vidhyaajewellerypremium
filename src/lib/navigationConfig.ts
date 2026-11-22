/**
 * VIDHYAA Jewellery Studio Navigation Configuration
 * Exact Categories & Collections as specified by user requirements
 */

import { Product } from '../types';

export interface NavDropdownItem {
  id: string;
  name: string;
  type: 'category' | 'collection';
  subtitle?: string;
}

export const SHOP_BY_CATEGORY_ITEMS: NavDropdownItem[] = [
  { id: 'necklace', name: 'Necklace', type: 'category', subtitle: 'Royal Haar & Bridal Necklaces' },
  { id: 'chocker-set', name: 'Chocker Set', type: 'category', subtitle: 'Floral & Kundan Chokers' },
  { id: 'chains', name: 'Chains', type: 'category', subtitle: 'Gold Finish & Matar Mala Chains' },
  { id: 'pendant-set', name: 'Pendant Set', type: 'category', subtitle: 'Peacock & AD Medallion Sets' },
  { id: 'mangalsutra', name: 'Mangalsutra', type: 'category', subtitle: 'Sunburst & Black Bead Heirlooms' },
  { id: 'earrings-cuffs', name: 'Earrings / Cuffs', type: 'category', subtitle: 'Drop Earrings & Jhumkas' },
  { id: 'bangles-kangan-kada-bracelets', name: 'Bangles / Kangan / Kada / Bracelets', type: 'category', subtitle: 'Openable Kadas & Royal Bangles' },
  { id: 'rings', name: 'Rings', type: 'category', subtitle: 'Solitaire & Devotional Rings' },
  { id: 'mla-jewellery', name: 'Mla Jewellery', type: 'category', subtitle: 'Multi-Strand Pearl & Gem Malas' },
  { id: 'elegent-everyday', name: 'Elegent Everyday', type: 'category', subtitle: 'Waterproof Daily Wear Pieces' },
  { id: 'best-sellers', name: 'Best Sellers', type: 'category', subtitle: 'Most Adored Royal Pieces' },
  { id: 'watches', name: 'Watches', type: 'category', subtitle: 'Luxury Royal Timepieces' },
];

export const SHOP_BY_COLLECTION_ITEMS: NavDropdownItem[] = [
  { id: 'all', name: 'Shop All', type: 'collection', subtitle: 'Complete Handcrafted Catalogue' },
  { id: 'new-arrivals', name: 'New Arrivals', type: 'collection', subtitle: 'Latest Handcrafted Studio Releases' },
  { id: 'trending', name: 'Trending Now', type: 'collection', subtitle: 'Most Coveted & Featured Pieces' },
  { id: 'diamond-necklace-sett', name: 'Diamond Necklace Sett', type: 'collection', subtitle: 'VVS American Diamond Collars' },
  { id: 'diamond-pendant-set', name: 'Diamond Pendant Set', type: 'collection', subtitle: 'Baguette & Solitaire Pendants' },
  { id: 'gold-finish-jewellery', name: 'Gold Finish Jewellery', type: 'collection', subtitle: '22K Micro Micron Gold Electroplating' },
  { id: 'kundan-polki-necklace-set', name: 'Kundan Polki Necklace Set', type: 'collection', subtitle: 'Handcrafted Jadau & Glass Polki' },
  { id: 'kundan-and-polki-necklace-set', name: 'Kundan and Polki Necklace Set', type: 'collection', subtitle: 'Traditional Rajasthani Kundan' },
  { id: 'temple-jewellery', name: 'Temple Jewellery', type: 'collection', subtitle: 'Antique German Silver & Divine Idols' },
  { id: 'rajwada-collection', name: 'Rajwada Collection', type: 'collection', subtitle: 'Royal Rajputana Heritage Jewellery' },
];

/**
 * Filter catalog products by navigation category or collection slug
 */
export function filterProductsByNavSlug(products: Product[], slug: string): Product[] {
  const f = (slug || 'all').toLowerCase().trim();
  if (f === 'all' || f === 'new-arrivals' || f === 'new') return products;

  return products.filter((p) => {
    const text = `${p.name} ${p.description} ${p.shortDescription || ''} ${p.subcategory || ''} ${p.categoryName || ''} ${p.material}`.toLowerCase();
    const pCatId = (p.categoryId || '').toLowerCase().trim();
    const pCatSlug = pCatId.replace(/[^a-z0-9]+/g, '-');

    // 1. Direct match by categoryId or slug
    if (pCatId === f || pCatSlug === f) {
      return true;
    }

    // 2. Curated collections (Trending / Best Sellers)
    if (f === 'trending') {
      return !!p.isFeatured || !!p.isBestseller || (p.rating || 0) >= 4.8;
    }
    if (f === 'best-sellers' || f === 'bestsellers' || f === 'bestseller') {
      return !!p.isBestseller || (p.rating || 0) >= 4.8;
    }

    // 3. Categories with specialized mapping
    if (f === 'necklace' || f === 'necklaces') {
      return (
        pCatId === 'necklaces' ||
        pCatId === 'necklace' ||
        text.includes('necklace') ||
        text.includes('choker') ||
        text.includes('haar')
      );
    }
    if (f === 'chocker-set' || f === 'choker-set' || f === 'choker-sets' || f === 'choker' || f === 'chokers') {
      return text.includes('choker') || pCatId === 'chocker-set' || pCatId === 'choker-set';
    }
    if (f === 'chains' || f === 'chain' || f === 'chain-collection') {
      return (
        pCatId === 'chains' ||
        pCatId === 'mangalsutra' ||
        text.includes('chain') ||
        text.includes('matar mala') ||
        text.includes('mangalsutra') ||
        text.includes('haar')
      );
    }
    if (f === 'pendant-set' || f === 'pendant-sets' || f === 'pendants' || f === 'pendant') {
      return pCatId === 'pendant-set' || pCatId === 'pendants' || text.includes('pendant') || text.includes('necklace') || text.includes('haar');
    }
    if (f === 'mangalsutra') {
      return pCatId === 'mangalsutra' || text.includes('mangalsutra');
    }
    if (f === 'earrings-cuffs' || f === 'earrings' || f === 'cuffs') {
      return pCatId === 'earrings-cuffs' || text.includes('earring') || text.includes('jhumka') || text.includes('cuff');
    }
    if (
      f === 'kada-bangles' ||
      f === 'kada-and-bangles' ||
      f === 'kadas-bangles' ||
      f === 'bangles-kangan-kada-bracelets' ||
      f === 'kangan-kada-bracelet' ||
      f === 'kangan-kada-and-bracelet' ||
      f === 'kangan-kada' ||
      f === 'bracelet' ||
      f === 'bracelets' ||
      f === 'bangles-bracelets' ||
      f === 'bangles-kangan' ||
      f === 'bangles' ||
      f === 'kada' ||
      f === 'kadas'
    ) {
      return (
        pCatId === 'kangan-kada-bracelet' ||
        pCatId === 'bangles' ||
        pCatId === 'bracelets' ||
        /\b(bangle|bangles|kangan|kada|kadas|bracelet|bracelets)\b/.test(text)
      );
    }
    if (f === 'devotional-jewellery' || f === 'devotional' || f === 'devotional-rings') {
      return (
        pCatId === 'devotional-rings' ||
        text.includes('ganesha') ||
        text.includes('devotional') ||
        text.includes('mandala') ||
        text.includes('temple')
      );
    }
    if (f === 'rings' || f === 'ring') {
      return (
        pCatId === 'rings' ||
        pCatId === 'devotional-rings' ||
        (/\b(ring|rings)\b/.test(text) && !/\bearring\b/.test(text))
      );
    }
    if (f === 'oxidised-jewellery' || f === 'oxidised' || f === 'oxidise' || f === 'oxidise-sets') {
      return (
        pCatId === 'oxidised-jewellery' ||
        text.includes('oxidised') ||
        text.includes('oxidise') ||
        text.includes('german silver')
      );
    }
    if (f === 'mla-jewellery' || f === 'mala' || f === 'mala-jewellery' || f === 'pearl-stone-mala-collection') {
      return text.includes('mala') || text.includes('haar') || text.includes('pearl') || text.includes('moti');
    }
    if (f === 'elegent-everyday' || f === 'elegant-everyday' || f === 'everyday') {
      return pCatId === 'elegent-everyday' || text.includes('daily') || text.includes('everyday') || text.includes('waterproof');
    }
    if (f === 'watches' || f === 'watch') {
      return pCatId === 'watches' || text.includes('watch') || text.includes('timepiece');
    }

    // 4. Collections & Footer Curations
    if (
      f === 'diamond-necklace-sett' ||
      f === 'diamond-necklace-sets' ||
      f === 'diamond-necklace-set'
    ) {
      return (
        (text.includes('diamond') || text.includes(' ad ') || text.includes('ad ') || text.includes('cz') || text.includes('cubic')) &&
        (text.includes('necklace') || text.includes('choker') || text.includes('set'))
      );
    }
    if (f === 'diamond-pendant-set' || f === 'diamond-pendant-sets') {
      return (text.includes('diamond') || text.includes('ad') || text.includes('solitaire')) && (text.includes('pendant') || text.includes('mangalsutra') || text.includes('necklace'));
    }
    if (f === 'gold-finish-jewellery') {
      return text.includes('gold') || text.includes('22k') || text.includes('24k');
    }
    if (
      f === 'kundan-polki-necklace-set' ||
      f === 'kundan-polki-necklace-sets' ||
      f === 'kundan-and-polki-necklace-set'
    ) {
      return (
        (text.includes('kundan') || text.includes('polki') || text.includes('jadau')) &&
        (text.includes('necklace') || text.includes('choker') || text.includes('set') || text.includes('haar'))
      );
    }
    if (f === 'kundan-polki-pendant-sets' || f === 'kundan-polki-pendant-set') {
      return text.includes('kundan') || text.includes('polki') || text.includes('jadau');
    }
    if (f === 'temple-jewellery' || f === 'temple-jewellery-sets' || f === 'temple-sets') {
      return text.includes('temple') || text.includes('ganesha') || text.includes('antique') || text.includes('lakshmi');
    }
    if (
      f === 'rajwada-collection' ||
      f === 'rajwada-collections' ||
      f === 'ragwada-collections'
    ) {
      return text.includes('rajwada') || text.includes('royal') || text.includes('polki') || text.includes('heritage');
    }
    if (f === 'moissanite-collection') {
      return text.includes('moissanite') || text.includes('diamond') || text.includes('solitaire') || text.includes('ad ') || text.includes('crystal');
    }
    if (f === 'emerald-jewellery') {
      return text.includes('emerald') || text.includes('green') || text.includes('panna');
    }
    if (f === 'ruby-jewellery-collection') {
      return text.includes('ruby') || text.includes('pink') || text.includes('maroon') || text.includes('red') || text.includes('rose');
    }
    if (f === 'wedding-guest-jewellery') {
      return (
        pCatId === 'necklaces' ||
        text.includes('wedding') ||
        text.includes('bridal') ||
        text.includes('choker') ||
        text.includes('kundan') ||
        text.includes('polki') ||
        text.includes('haar')
      );
    }
    if (f === 'festive-jewellery-collection') {
      return (
        text.includes('festive') ||
        text.includes('traditional') ||
        text.includes('temple') ||
        text.includes('kundan') ||
        text.includes('bangle') ||
        text.includes('kada') ||
        text.includes('choker')
      );
    }
    if (f === 'sangeet-jewellery-collection') {
      return (
        pCatId === 'rings' ||
        text.includes('sangeet') ||
        text.includes('cocktail') ||
        text.includes('statement') ||
        text.includes('diamond') ||
        text.includes('choker')
      );
    }
    if (f === 'rhodium-plating') {
      return text.includes('rhodium') || text.includes('silver') || text.includes('platinum') || text.includes('micro gold') || text.includes('gold');
    }
    if (f === 'hasli-sets') {
      return text.includes('hasli') || text.includes('choker') || text.includes('collar') || text.includes('temple');
    }
    if (f === '925-silver-jewellery') {
      return (
        pCatId === 'oxidised-jewellery' ||
        text.includes('92.5') ||
        text.includes('925') ||
        text.includes('sterling') ||
        text.includes('silver') ||
        text.includes('oxidised')
      );
    }
    if (f === 'anklets-collection') {
      return text.includes('anklet') || text.includes('payal') || text.includes('temple') || text.includes('oxidised') || text.includes('traditional');
    }

    return false;
  });
}

/**
 * Returns human-readable title and description for a nav slug
 */
export function getNavHeadingInfo(slug: string): { title: string; subtitle: string; isCategory: boolean } {
  const f = (slug || 'all').toLowerCase();

  // Explicit handling for curated & footer collections
  const CURATED_HEADINGS: Record<string, { title: string; subtitle: string; isCategory: boolean }> = {
    'new-arrivals': {
      title: 'New Arrivals',
      subtitle: 'Discover the latest handcrafted releases from our Roorkee jewellery atelier.',
      isCategory: false,
    },
    'new': {
      title: 'New Arrivals',
      subtitle: 'Discover the latest handcrafted releases from our Roorkee jewellery atelier.',
      isCategory: false,
    },
    'trending': {
      title: 'Trending Now',
      subtitle: 'Our most coveted bridal chokers, statement rings, and patron-favourite designs.',
      isCategory: false,
    },
    'kundan-polki-necklace-sets': {
      title: 'Kundan & Polki Necklace Sets',
      subtitle: 'Handcrafted Jadau, uncut polki, and royal Rajasthani bridal necklace sets.',
      isCategory: false,
    },
    'kundan-polki-pendant-sets': {
      title: 'Kundan & Polki Pendant Sets',
      subtitle: 'Artisanal kundan and polki pendant sets crafted with 22K micro gold finishes.',
      isCategory: false,
    },
    'moissanite-collection': {
      title: 'Moissanite & American Diamond Collection',
      subtitle: 'Brilliant-cut solitaire, moissanite, and VVS American Diamond luxury designs.',
      isCategory: false,
    },
    'emerald-jewellery': {
      title: 'Emerald & Green Stone Jewellery',
      subtitle: 'Lush emerald-toned statement rings, chokers, and regal green stone heirlooms.',
      isCategory: false,
    },
    'ruby-jewellery-collection': {
      title: 'Ruby & Pink Stone Collection',
      subtitle: 'Vibrant ruby and rose-hued handcrafted jewellery crafted for celebrations.',
      isCategory: false,
    },
    'pearl-stone-mala-collection': {
      title: 'Pearl & Stone Mala Collection',
      subtitle: 'Multi-strand freshwater pearl malas, rani haars, and heritage stone necklaces.',
      isCategory: false,
    },
    'wedding-guest-jewellery': {
      title: 'Wedding Guest Jewellery Collection',
      subtitle: 'Regal chokers, kundan sets, and statement pieces curated for weddings.',
      isCategory: false,
    },
    'festive-jewellery-collection': {
      title: 'Festive Jewellery Collection',
      subtitle: 'Timeless temple, kundan, and 22K gold-finish designs for Indian festivities.',
      isCategory: false,
    },
    'sangeet-jewellery-collection': {
      title: 'Sangeet & Cocktail Jewellery',
      subtitle: 'Dazzling cocktail rings, diamond chokers, and glamour-ready statement sets.',
      isCategory: false,
    },
    'rhodium-plating': {
      title: 'Rhodium & Micro Plated Jewellery',
      subtitle: 'High-lustre rhodium, silver, and 22K micro-plated anti-tarnish designs.',
      isCategory: false,
    },
    'choker-sets': {
      title: 'Choker Sets',
      subtitle: 'Handcrafted royal bridal chokers with matching statement earrings.',
      isCategory: false,
    },
    'hasli-sets': {
      title: 'Hasli & Collar Sets',
      subtitle: 'Sculpted traditional hasli, collar necklaces, and antique temple sets.',
      isCategory: false,
    },
    'chain-collection': {
      title: 'Chain & Mangalsutra Collection',
      subtitle: 'Delicate gold-finish chains, matar malas, and handcrafted mangalsutras.',
      isCategory: false,
    },
    '925-silver-jewellery': {
      title: '92.5 Silver & Oxidised Jewellery',
      subtitle: 'Certified sterling silver finishes and artisanal antique oxidised designs.',
      isCategory: false,
    },
    'anklets-collection': {
      title: 'Traditional Anklets & Heirlooms',
      subtitle: 'Heritage temple and ethnic silver-tone accents crafted for festive grace.',
      isCategory: false,
    },
    'ragwada-collections': {
      title: 'Rajwada Heritage Collection',
      subtitle: 'Royal Rajputana craftsmanship with antique gold and polki silhouettes.',
      isCategory: false,
    },
  };

  if (CURATED_HEADINGS[f]) {
    return CURATED_HEADINGS[f];
  }

  // Explicit handling for the 7 primary storefront categories
  if (f === 'necklaces' || f === 'necklace') {
    return {
      title: 'Necklaces',
      subtitle: 'Handcrafted 22K micro gold plated choker sets, rani haar, and royal bridal necklaces.',
      isCategory: true,
    };
  }
  if (f === 'kada-bangles' || f === 'kada-and-bangles' || f === 'kadas-bangles' || f === 'bangles-kangan-kada-bracelets' || f === 'kangan-kada-bracelet') {
    return {
      title: 'Kada & Bangles',
      subtitle: 'Handcrafted 22K micro gold openable kadas, traditional wedding kangans, and royal bracelets.',
      isCategory: true,
    };
  }
  if (f === 'rings' || f === 'ring') {
    return {
      title: 'Rings',
      subtitle: 'Elegant artificial jewellery cocktail rings, emerald cuts, and solitaire statement designs.',
      isCategory: true,
    };
  }
  if (f === 'mangalsutra') {
    return {
      title: 'Mangalsutra',
      subtitle: 'Sacred American diamond sunburst pendants and traditional black bead bridal heirlooms.',
      isCategory: true,
    };
  }
  if (f === 'devotional-jewellery' || f === 'devotional' || f === 'devotional-rings') {
    return {
      title: 'Devotional Jewellery',
      subtitle: 'Sacred Lord Ganesha temple blessing rings and auspicious spiritual jewellery designs.',
      isCategory: true,
    };
  }
  if (f === 'watches' || f === 'watch') {
    return {
      title: 'Watches',
      subtitle: "Stylish women's luxury watches and royal artisan jewellery timepieces.",
      isCategory: true,
    };
  }
  if (f === 'oxidised-jewellery' || f === 'oxidised' || f === 'oxidise-sets') {
    return {
      title: 'Oxidised Jewellery',
      subtitle: 'Handcrafted antique oxidised silver necklaces, traditional jhumkas, and ethnic jewellery.',
      isCategory: true,
    };
  }

  const foundCat = SHOP_BY_CATEGORY_ITEMS.find((c) => c.id === f);
  if (foundCat) {
    return {
      title: foundCat.name,
      subtitle: `Handcrafted ${foundCat.name} heirlooms designed with 22K micro gold plating, hypoallergenic brass, and royal artisanal finishes.`,
      isCategory: true,
    };
  }

  const foundCol = SHOP_BY_COLLECTION_ITEMS.find((c) => c.id === f);
  if (foundCol) {
    return {
      title: foundCol.name,
      subtitle: foundCol.id === 'all'
        ? 'Explore all handcrafted 24K gold plated sets, 92.5 sterling silver, luxury watches, and royal bridal heirlooms.'
        : `Exclusive ${foundCol.name} curated with royal heritage elegance, certified quality, and insured pan-India express dispatch.`,
      isCategory: false,
    };
  }

  return {
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: 'Handcrafted luxury jewellery from VIDHYAA Jewellery Studio.',
    isCategory: true,
  };
}
