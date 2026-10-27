export interface ProductVariation {
  id: string;
  name: string; // e.g. "Yellow Gold", "Rose Gold", "92.5 Silver", "Antique Oxidised"
  colorFinish: string;
  hexCode: string; // for UI color dot e.g. "#D4AF37", "#E0A996", "#E5E7EB", "#4B5563"
  sku: string;
  price?: number; // optional override
  mrp?: number;
  stock: number;
  image: string; // Variation-specific image that switches main product photo!
  additionalImages?: string[];
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string; // 'gold-imitation' | 'silver-925' | 'watches' | 'oxidised'
  categoryName: string;
  subcategory: string; // 'Necklaces', 'Earrings', 'Rings', 'Bracelets', 'Bangles', 'Pendants', 'Anklets', 'Watches', 'Jewellery Sets'
  description: string;
  shortDescription?: string;
  material: string; // '22K Gold Plated Brass', '92.5 Sterling Silver', 'Stainless Steel & Rose Gold', 'German Silver Oxidised'
  price: number;
  mrp: number;
  discountPercent: number;
  images: string[];
  stock: number;
  inStock: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNewArrival?: boolean;
  active: boolean;
  status?: 'published' | 'draft' | string;
  published?: boolean;
  rating: number;
  reviewCount: number;
  specifications: Record<string, string>;
  careInstructions: string;
  variations: ProductVariation[];
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryImage {
  id: string;
  url: string;
  title?: string;
  altText?: string;
  caption?: string;
  isCover?: boolean;
  order: number;
}

export interface CategoryVideo {
  id: string;
  title: string;
  description?: string;
  videoUrl: string; // Direct MP4 / WebM or YouTube / Vimeo URL
  thumbnailUrl?: string;
  isFeatured?: boolean;
  published: boolean;
  order: number;
  duration?: string;
  seoTags?: string;
}

export interface CategoryPromoBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkText?: string;
  linkUrl?: string;
  active: boolean;
  order?: number;
}

export interface CategoryCustomSection {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  order: number;
  active: boolean;
}

export type CategorySectionKey = 
  | 'banner'
  | 'description'
  | 'gallery'
  | 'videos'
  | 'featured_products'
  | 'products'
  | 'custom_story'
  | 'cta';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string; // Cover image
  subcategories: string[];
  active: boolean; // published status
  order: number;

  // CMS Enhancements:
  subtitle?: string;
  heroBannerUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;

  // Section arrangement
  sectionsOrder?: CategorySectionKey[];
  hiddenSections?: CategorySectionKey[];

  // Images Gallery
  galleryImages?: CategoryImage[];

  // Videos
  videos?: CategoryVideo[];

  // Promotional Banners
  promoBanners?: CategoryPromoBanner[];

  // Curated product IDs or pinned badges
  featuredProductIds?: string[];
  bestsellerProductIds?: string[];
  newArrivalProductIds?: string[];
  trendingProductIds?: string[];

  // Custom text & narrative sections
  customStoryTitle?: string;
  customStoryBody?: string;
  customStoryImage?: string;
  customSections?: CategoryCustomSection[];

  // Call to action
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaButtonText?: string;
  ctaButtonLink?: string;
  ctaBgColor?: string;

  updatedAt?: string;
}

export interface CartItem {
  id: string; // composite productId + variationId
  productId: string;
  productName: string;
  variationId: string;
  variationName: string;
  price: number;
  mrp: number;
  quantity: number;
  image: string;
  sku: string;
  material?: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variationId: string;
  variationName: string;
  quantity: number;
  price: number;
  mrp?: number;
  image: string;
  sku: string;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "VDH-78291"
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Address;
  items: OrderItem[];
  originalTotal?: number;
  productSavings?: number;
  couponSavings?: number;
  totalSavings?: number;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  totalAmount: number;
  paymentMethod: 'UPI' | 'Google Pay (UPI)' | 'Pay by UPI Mobile Number' | 'Pay by UPI QR Code' | string;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  cfOrderId?: string | number;
  cardNetwork?: string;
  cardType?: string;
  upiReference?: string;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  courierName?: string;
  giftItem?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface StoreSettings {
  id: string;
  freeDeliveryThreshold: number;
  deliveryCharge: number;
  upiVpa: string; // "vidhyaajewellery@upi"
  upiPayeeName: string; // "VIDHYAA Jewellery Studio"
  upiMobileNumber?: string; // "9758350524"
  upiQrImageUrl?: string;
  businessOwner?: string; // "Neeraj Chauhan"
  pincode?: string; // "247667"
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  announcementText: string;
  // House of Parati-inspired Scrolling Offer Bar & Gift Rewards
  scrollingOfferBarEnabled?: boolean;
  offerTier1MinAmount?: number; // default: 1500
  offerTier1GiftName?: string; // default: "Gold Imitation Jhoomki"
  offerTier2MinAmount?: number; // default: 2000
  offerTier2GiftName?: string; // default: "Gold Imitation Bangles"
  customOfferMessages?: string[];
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  phoneCountryCode?: string;
  phone_verified?: boolean;
  role: 'customer' | 'admin';
  savedAddresses: Address[];
  createdAt: string;
  updatedAt: string;
}

export type AdminRole = 'super_admin' | 'admin' | 'manager' | 'staff';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  twoFactorEnabled: boolean;
  twoFactorEnforced: boolean;
  status: 'active' | 'disabled';
  lastLogin?: string;
  lastPasswordChange?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  category: 'auth' | 'product' | 'order' | 'settings' | 'security' | 'inventory';
  targetResource?: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure' | 'warning';
  details?: string;
  timestamp: string;
}

export interface AdminSession {
  id: string;
  adminId: string;
  adminEmail: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  lastActiveTime: string;
  isCurrent: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  active: boolean;
  expiresAt?: string;
  usageCount: number;
}

export interface LiveChatMessage {
  id: string;
  senderName: string;
  isHost?: boolean;
  message: string;
  timestamp: string;
}

export interface LiveProductShowcase {
  productId: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  price: number;
  mrp: number;
  image: string;
  exclusiveDiscountCode?: string;
  stock: number;
}

export interface LiveStreamSession {
  id: string;
  title: string;
  hostName: string;
  isLive: boolean;
  pinnedProduct?: LiveProductShowcase;
  viewerCount: number;
  startedAt: string;
}

