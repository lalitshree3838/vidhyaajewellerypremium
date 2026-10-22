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
  const f = (slug || 'all').toLowerCase();

  return products.filter((p) => {
    const text = `${p.name} ${p.description} ${p.shortDescription || ''} ${p.subcategory || ''} ${p.categoryName || ''} ${p.material}`.toLowerCase();

    // 1. Categories
    if (f === 'necklace' || f === 'necklaces') {
      return p.categoryId === 'necklaces' && !text.includes('choker');
    }
    if (f === 'chocker-set' || f === 'choker-set' || f === 'choker' || f === 'chokers') {
      return text.includes('choker');
    }
    if (f === 'chains' || f === 'chain') {
      return text.includes('chain') || text.includes('matar mala');
    }
    if (f === 'pendant-set' || f === 'pendant-sets' || f === 'pendants' || f === 'pendant') {
      return text.includes('pendant');
    }
    if (f === 'mangalsutra') {
      return p.categoryId === 'mangalsutra' || text.includes('mangalsutra');
    }
    if (f === 'earrings-cuffs' || f === 'earrings' || f === 'cuffs') {
      return text.includes('earring') || text.includes('jhumka') || text.includes('cuff');
    }
    if (
      f === 'bangles-kangan-kada-bracelets' ||
      f === 'kangan-kada-bracelet' ||
      f === 'kangan-kada-and-bracelet' ||
      f === 'kangan-kada' ||
      f === 'bracelet' ||
      f === 'bracelets' ||
      f === 'bangles-bracelets' ||
      f === 'bangles-kangan'
    ) {
      return (
        p.categoryId === 'kangan-kada-bracelet' ||
        /\b(bangle|bangles|kangan|kada|kadas|bracelet|bracelets)\b/.test(p.name.toLowerCase())
      );
    }
    if (f === 'rings' || f === 'devotional-rings') {
      return (
        p.categoryId === 'rings' ||
        p.categoryId === 'devotional-rings' ||
        (/\b(ring|rings)\b/.test(p.name.toLowerCase()) && !/\bearring\b/.test(p.name.toLowerCase()))
      );
    }
    if (f === 'mla-jewellery' || f === 'mala' || f === 'mala-jewellery') {
      return text.includes('mala') || text.includes('haar') || text.includes('pearl');
    }
    if (f === 'elegent-everyday' || f === 'elegant-everyday' || f === 'everyday') {
      return text.includes('daily') || text.includes('everyday');
    }
    if (f === 'best-sellers' || f === 'bestsellers' || f === 'bestseller') {
      return !!p.isBestseller || p.rating >= 4.8;
    }
    if (f === 'watches' || f === 'watch') {
      return text.includes('watch');
    }

    // 2. Collections
    if (f === 'all') {
      return true;
    }
    if (
      f === 'diamond-necklace-sett' ||
      f === 'diamond-necklace-sets' ||
      f === 'diamond-necklace-set'
    ) {
      return (
        (text.includes('diamond') || text.includes(' ad ') || text.includes('ad ')) &&
        (text.includes('necklace') || text.includes('choker') || text.includes('set'))
      );
    }
    if (f === 'diamond-pendant-set' || f === 'diamond-pendant-sets') {
      return (text.includes('diamond') || text.includes('ad')) && text.includes('pendant');
    }
    if (f === 'gold-finish-jewellery') {
      return text.includes('gold');
    }
    if (f === 'kundan-polki-necklace-set' || f === 'kundan-and-polki-necklace-set') {
      return (
        (text.includes('kundan') || text.includes('polki')) &&
        (text.includes('necklace') || text.includes('choker') || text.includes('set') || text.includes('haar'))
      );
    }
    if (f === 'temple-jewellery' || f === 'temple-jewellery-sets' || f === 'temple-sets') {
      return text.includes('temple');
    }
    if (
      f === 'rajwada-collection' ||
      f === 'rajwada-collections' ||
      f === 'ragwada-collections'
    ) {
      return text.includes('rajwada');
    }

    return true;
  });
}

/**
 * Returns human-readable title and description for a nav slug
 */
export function getNavHeadingInfo(slug: string): { title: string; subtitle: string; isCategory: boolean } {
  const f = (slug || 'all').toLowerCase();

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
