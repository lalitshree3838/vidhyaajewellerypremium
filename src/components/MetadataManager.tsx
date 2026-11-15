import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface MetadataProductInfo {
  name: string;
  sku?: string;
  price?: number;
  mrp?: number;
  currency?: string;
  inStock?: boolean;
  image?: string;
  category?: string;
  material?: string;
  rating?: number;
  reviewCount?: number;
}

export interface MetadataManagerProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'product';
  canonicalUrl?: string;
  product?: MetadataProductInfo;
  categoryName?: string;
  keywords?: string[];
}

const DEFAULT_TITLE = 'VIDHYAA Jewellery Studio | Premium Women\'s Jewellery & Watches';
const DEFAULT_DESCRIPTION = 'Shop exclusive handcrafted gold imitation jewellery, certified 92.5 sterling silver, luxury watches, and oxidised bridal & festive collections with insured pan-India express dispatch.';
const DEFAULT_IMAGE = '/hero-section-image-final.jpg';
const BRAND_NAME = 'VIDHYAA Jewellery Studio';

export const MetadataManager: React.FC<MetadataManagerProps> = ({
  title,
  description,
  image,
  type = 'website',
  canonicalUrl,
  product,
  categoryName,
  keywords
}) => {
  // 1. Dynamic Branded Title
  let fullTitle = DEFAULT_TITLE;
  if (title) {
    fullTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;
  }

  // 2. Canonical and Asset URL resolution
  const finalDescription = description || DEFAULT_DESCRIPTION;
  const finalImage = image || DEFAULT_IMAGE;
  const finalUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

  // 3. Dynamic keywords
  const defaultKeywords = [
    'VIDHYAA Jewellery',
    'handcrafted Indian jewellery',
    'temple gold jewellery',
    'uncut kundan choker',
    '92.5 sterling silver',
    'women luxury watches',
    'Jaipur jewellery'
  ];
  if (categoryName) defaultKeywords.push(categoryName, `${categoryName} online`);
  if (product?.name) defaultKeywords.push(product.name, product.material || '');
  const finalKeywords = (keywords && keywords.length > 0 ? keywords : defaultKeywords).join(', ');

  // 4. Schema.org JSON-LD Structured Data
  let jsonLdContent: string | null = null;
  if (product) {
    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: product.image || finalImage,
      description: finalDescription,
      sku: product.sku || 'VDH-PROD',
      brand: {
        '@type': 'Brand',
        name: BRAND_NAME
      },
      material: product.material,
      category: product.category || categoryName,
      offers: {
        '@type': 'Offer',
        url: finalUrl,
        priceCurrency: product.currency || 'INR',
        price: product.price || 0,
        availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: BRAND_NAME
        }
      },
      ...(product.rating
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.rating,
              reviewCount: product.reviewCount || 1,
              bestRating: '5',
              worstRating: '1'
            }
          }
        : {})
    };
    jsonLdContent = JSON.stringify(productSchema);
  } else if (categoryName) {
    const categorySchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${categoryName} Collection`,
      description: finalDescription,
      url: finalUrl,
      publisher: {
        '@type': 'Organization',
        name: BRAND_NAME
      }
    };
    jsonLdContent = JSON.stringify(categorySchema);
  } else {
    const storeSchema = {
      '@context': 'https://schema.org',
      '@type': 'JewelryStore',
      name: BRAND_NAME,
      description: DEFAULT_DESCRIPTION,
      url: finalUrl,
      image: finalImage,
      priceRange: '₹₹',
      telephone: '+91 7302187770',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee',
        addressLocality: 'Roorkee, District Haridwar',
        addressRegion: 'Uttarakhand',
        postalCode: '247667',
        addressCountry: 'IN'
      }
    };
    jsonLdContent = JSON.stringify(storeSchema);
  }

  return (
    <Helmet>
      {/* Standard Meta */}
      <title>{fullTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      {finalUrl && <link rel="canonical" href={finalUrl} />}

      {/* Open Graph Tags */}
      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={finalImage} />
      {finalUrl && <meta property="og:url" content={finalUrl} />}

      {/* Product-specific Open Graph tags */}
      {type === 'product' && product && (
        <>
          {product.price && <meta property="product:price:amount" content={String(product.price)} />}
          <meta property="product:price:currency" content={product.currency || 'INR'} />
          <meta
            property="product:availability"
            content={product.inStock ? 'in stock' : 'out of stock'}
          />
          <meta property="product:brand" content={BRAND_NAME} />
          {product.category && <meta property="product:category" content={product.category} />}
        </>
      )}

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalImage} />

      {/* Schema.org Structured Data */}
      {jsonLdContent && <script type="application/ld+json">{jsonLdContent}</script>}
    </Helmet>
  );
};
