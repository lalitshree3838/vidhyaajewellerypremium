import React, { useEffect } from 'react';

export interface SeoProductData {
  name: string;
  sku: string;
  price: number;
  mrp?: number;
  currency?: string;
  inStock: boolean;
  image: string;
  category?: string;
  material?: string;
  rating?: number;
  reviewCount?: number;
}

export interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'product';
  canonicalUrl?: string;
  product?: SeoProductData;
  categoryName?: string;
}

const DEFAULT_TITLE = 'VIDHYAA Jewellery Studio | Premium Women\'s Jewellery & Watches';
const DEFAULT_DESCRIPTION = 'Shop exclusive handcrafted gold imitation jewellery, certified 92.5 sterling silver, luxury watches, and oxidised bridal & festive collections with insured pan-India express dispatch.';
const DEFAULT_IMAGE = '/hero-section-image-final.jpg';

export const SeoHead: React.FC<SeoProps> = ({
  title,
  description,
  image,
  type = 'website',
  canonicalUrl,
  product,
  categoryName
}) => {
  useEffect(() => {
    // 1. Document Title
    const brandSuffix = 'VIDHYAA Jewellery Studio';
    let fullTitle = DEFAULT_TITLE;
    if (title) {
      fullTitle = title.includes(brandSuffix) ? title : `${title} | ${brandSuffix}`;
    }
    document.title = fullTitle;

    // Helper to set or create meta tag
    const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalImage = image || DEFAULT_IMAGE;
    const finalUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

    // 2. Standard Meta Description
    setMetaTag('name', 'description', finalDescription);

    // 3. OpenGraph Social Tags
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', finalDescription);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:image', finalImage);
    setMetaTag('property', 'og:site_name', 'VIDHYAA Jewellery Studio');
    if (finalUrl) {
      setMetaTag('property', 'og:url', finalUrl);
    }

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', finalDescription);
    setMetaTag('name', 'twitter:image', finalImage);

    // 5. Canonical Link
    let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', finalUrl);

    // 6. Schema.org JSON-LD Structured Data
    const scriptId = 'vidhyaa-seo-jsonld';
    let jsonLdScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!jsonLdScript) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.id = scriptId;
      jsonLdScript.type = 'application/ld+json';
      document.head.appendChild(jsonLdScript);
    }

    if (product) {
      // Product Schema
      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.image,
        description: finalDescription,
        sku: product.sku,
        brand: {
          '@type': 'Brand',
          name: 'VIDHYAA Jewellery Studio'
        },
        material: product.material,
        category: product.category,
        offers: {
          '@type': 'Offer',
          url: finalUrl,
          priceCurrency: product.currency || 'INR',
          price: product.price,
          availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'VIDHYAA Jewellery Studio'
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
      jsonLdScript.textContent = JSON.stringify(productSchema);
    } else if (categoryName) {
      // Collection / Category Schema
      const categorySchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${categoryName} Collection`,
        description: finalDescription,
        url: finalUrl,
        publisher: {
          '@type': 'Organization',
          name: 'VIDHYAA Jewellery Studio'
        }
      };
      jsonLdScript.textContent = JSON.stringify(categorySchema);
    } else {
      // Jewelry Store / Organization Schema
      const storeSchema = {
        '@context': 'https://schema.org',
        '@type': 'JewelryStore',
        name: 'VIDHYAA Jewellery Studio',
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
      jsonLdScript.textContent = JSON.stringify(storeSchema);
    }

    // Cleanup when unmounting or switching view
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, image, type, canonicalUrl, product, categoryName]);

  return null;
};
