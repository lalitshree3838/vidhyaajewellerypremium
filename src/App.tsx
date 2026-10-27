/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { Product, ProductVariation, Category, StoreSettings, Order } from './types';
import {
  initCatalogIfEmpty,
  fetchProducts,
  fetchCategories,
  fetchStoreSettings,
  getCachedProducts,
  getCachedCategories
} from './lib/dbService';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS, isGenuineProduct } from './lib/sampleData';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { QuickViewModal } from './components/QuickViewModal';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { PromotionalLoginModal } from './components/PromotionalLoginModal';
import { SearchModal } from './components/SearchModal';
import { MessageCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { HomeView } from './views/HomeView';
import { ShopView } from './views/ShopView';
import { ProductDetailView } from './views/ProductDetailView';
import { CheckoutView } from './views/CheckoutView';
import { TrackOrderView } from './views/TrackOrderView';
import { AccountView } from './views/AccountView';
import { WishlistView } from './views/WishlistView';
import { AdminView } from './views/AdminView';
import { PolicyViews } from './views/PolicyViews';
import { GoLiveView } from './views/GoLiveView';
import { CategoryView } from './views/CategoryView';

function MainApp() {
  const { user, isAdmin } = useAuth();
  const { openCart } = useCart();

  // Navigation State
  const [currentView, setCurrentView] = useState<string>('home');
  const [currentParam, setCurrentParam] = useState<string | undefined>(undefined);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedInitialVariation, setSelectedInitialVariation] = useState<ProductVariation | undefined>(undefined);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string>('');

  // Modals
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [quickViewVariation, setQuickViewVariation] = useState<ProductVariation | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [promoLoginOpen, setPromoLoginOpen] = useState(false);

  // Automatically trigger the promotional login popup after 3.5 seconds if visitor is not logged in
  useEffect(() => {
    if (user) return;
    const isDismissed = sessionStorage.getItem('vidhyaa_promo_popup_dismissed') === 'true';
    if (isDismissed) return;

    const timer = setTimeout(() => {
      if (!user && sessionStorage.getItem('vidhyaa_promo_popup_dismissed') !== 'true') {
        setPromoLoginOpen(true);
      }
    }, 3800);

    return () => clearTimeout(timer);
  }, [user]);

  const handleClosePromoLogin = () => {
    setPromoLoginOpen(false);
    sessionStorage.setItem('vidhyaa_promo_popup_dismissed', 'true');
  };

  const handlePromoLoginSuccess = () => {
    setPromoLoginOpen(false);
    sessionStorage.setItem('vidhyaa_promo_popup_dismissed', 'true');
  };

  // Firestore Live Catalog Data initialized with cached or empty while loading
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedProducts();
    return cached.length > 0 ? cached : [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = getCachedCategories();
    return cached.length > 0 ? cached : INITIAL_CATEGORIES;
  });
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [loadingInitial, setLoadingInitial] = useState(() => {
    const cached = getCachedProducts();
    return cached.length === 0;
  });
  const [initError, setInitError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setInitError(null);
      const [prods, cats, sets] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchStoreSettings()
      ]);

      if (Array.isArray(prods)) {
        setProducts(prods);
        window.dispatchEvent(new CustomEvent('vidhyaa_products_updated', { detail: prods }));
      }
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
      if (sets) {
        setStoreSettings(sets);
      }
    } catch (e: any) {
      console.warn('Live data load warning:', e);
      const cached = getCachedProducts();
      if (cached.length > 0) {
        setProducts(cached);
      }
      setInitError(e?.message || 'Unable to sync live catalog data. Displaying saved catalog.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    // Check initial catalog in background without blocking live data load
    initCatalogIfEmpty().catch(() => {});
    loadData();

    const handleProductsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setProducts(e.detail);
      }
    };
    window.addEventListener('vidhyaa_products_updated', handleProductsUpdated);
    return () => window.removeEventListener('vidhyaa_products_updated', handleProductsUpdated);
  }, []);

  useEffect(() => {

    // Direct URL detection for /admin, /shop, categories, or collections
    const checkDirectUrl = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);

      if (pathname.includes('/admin') || hash.includes('admin')) {
        setCurrentView('admin');
        return;
      }

      const catParam = urlParams.get('category') || urlParams.get('collection') || urlParams.get('filter');
      if (pathname.startsWith('/shop') || catParam) {
        setCurrentView('shop');
        if (catParam) {
          setCurrentParam(catParam);
        }
        return;
      }

      if (pathname.startsWith('/category/') || pathname.startsWith('/collection/') || pathname.startsWith('/collections/')) {
        const parts = pathname.split('/').filter(Boolean);
        const segment = parts[1];
        if (segment) {
          setCurrentView('shop');
          setCurrentParam(segment);
          return;
        }
      }
    };

    checkDirectUrl();

    const handlePopState = () => {
      checkDirectUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (view: string, param?: string) => {
    setCurrentView(view);
    setCurrentParam(param);
    if (view === 'admin') {
      window.history.pushState({}, '', '/admin/login');
    } else if (view === 'home' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    } else if (view === 'collections' || view === 'collection') {
      setCurrentView('shop');
      setCurrentParam(param || 'all');
      window.history.pushState({}, '', `/collections/${param || 'all'}`);
    } else if (view === 'shop') {
      if (param && param !== 'all') {
        const isCat = [
          'necklace',
          'necklaces',
          'chocker-set',
          'choker-set',
          'chains',
          'pendant-set',
          'pendant-sets',
          'mangalsutra',
          'earrings-cuffs',
          'kada-bangles',
          'bangles-kangan-kada-bracelets',
          'bangles-bracelets',
          'rings',
          'devotional-jewellery',
          'devotional-rings',
          'mla-jewellery',
          'elegent-everyday',
          'best-sellers',
          'watches',
          'oxidised-jewellery',
          'kangan-kada-bracelet',
          'kangan-kada-and-bracelet',
          'kangan-kada',
          'bracelet',
          'bracelets',
          'bangles-kangan'
        ].includes(param.toLowerCase());
        const queryKey = isCat ? 'category' : 'collection';
        window.history.pushState({}, '', `/shop?${queryKey}=${encodeURIComponent(param)}`);
      } else {
        window.history.pushState({}, '', '/shop');
      }
    }
    if (view === 'track-order' && param) {
      setTrackingOrderNumber(param);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProduct = (product: Product, variation?: ProductVariation) => {
    setSelectedProduct(product);
    setSelectedInitialVariation(variation);
    setCurrentView('product-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenQuickView = (product: Product, variation?: ProductVariation) => {
    setQuickViewProduct(product);
    setQuickViewVariation(variation);
  };

  const handleBuyNowDirect = () => {
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSuccess = (order: Order) => {
    setTrackingOrderNumber(order.orderNumber);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#241C1A]">
      {/* Header Navigation */}
      {currentView !== 'admin' && (
        <Header
          currentView={currentView}
          categories={categories}
          storeSettings={storeSettings}
          onNavigate={handleNavigate}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAuth={() => setAuthOpen(true)}
        />
      )}

      {/* Sync Warning Bar (non-blocking) */}
      {initError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{initError}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1 font-semibold text-[#802336] hover:underline cursor-pointer ml-3 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {loadingInitial ? (
          <div className="py-28 flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full border-3 border-[#E8DCCF] border-t-[#802336] animate-spin" />
            <p className="font-serif text-sm font-semibold text-[#802336] tracking-wider uppercase">
              Loading VIDHYAA Studio...
            </p>
          </div>
        ) : (
          <>
            {currentView === 'home' && (
              <HomeView
                products={products}
                categories={categories}
                onNavigate={handleNavigate}
                onSelectProduct={handleSelectProduct}
                onOpenQuickView={handleOpenQuickView}
              />
            )}

            {currentView === 'category' && (
              <CategoryView
                category={
                  categories.find(
                    (c) =>
                      c.id === currentParam ||
                      c.slug === currentParam ||
                      (currentParam &&
                        [
                          'kangan-kada',
                          'bracelet',
                          'bracelets',
                          'bangles-kangan',
                          'bangles-bracelets',
                          'kangan-kada-bracelet',
                          'kangan-kada-and-bracelet'
                        ].includes(currentParam.toLowerCase()) &&
                        c.id === 'kangan-kada-bracelet')
                  ) || categories[0]
                }
                categories={categories}
                products={products}
                onSelectProduct={handleSelectProduct}
                onOpenQuickView={handleOpenQuickView}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'shop' && (
              <ShopView
                products={products}
                categories={categories}
                initialCategory={currentParam || 'all'}
                onSelectProduct={handleSelectProduct}
                onOpenQuickView={handleOpenQuickView}
              />
            )}

            {currentView === 'product-detail' && selectedProduct && (
              <ProductDetailView
                product={products.find((p) => p.id === selectedProduct.id) || selectedProduct}
                allProducts={products}
                initialVariation={selectedInitialVariation}
                onSelectProduct={handleSelectProduct}
                onOpenQuickView={handleOpenQuickView}
                onBuyNowDirect={handleBuyNowDirect}
              />
            )}

            {currentView === 'checkout' && (
              <CheckoutView
                storeSettings={storeSettings}
                onOrderSuccess={handleOrderSuccess}
                onNavigateHome={() => handleNavigate('home')}
                onTrackOrder={(orderNum) => handleNavigate('track-order', orderNum)}
              />
            )}

            {currentView === 'track-order' && (
              <TrackOrderView
                initialOrderNumber={trackingOrderNumber}
                onNavigateShop={() => handleNavigate('shop', 'all')}
              />
            )}

            {(currentView === 'account' || currentView === 'orders') && (
              <AccountView
                onNavigateOrders={() => handleNavigate('orders')}
                onNavigateWishlist={() => handleNavigate('wishlist')}
                onNavigateAdmin={() => handleNavigate('admin')}
                onTrackOrder={(orderNum) => handleNavigate('track-order', orderNum)}
                onOpenAuth={() => setAuthOpen(true)}
              />
            )}

            {currentView === 'wishlist' && (
              <WishlistView
                products={products}
                onSelectProduct={handleSelectProduct}
                onNavigateShop={() => handleNavigate('shop', 'all')}
              />
            )}

            {currentView === 'go-live' && (
              <GoLiveView
                products={products}
                onSelectProduct={handleSelectProduct}
                onNavigateCheckout={() => handleNavigate('checkout')}
                onNavigateShop={() => handleNavigate('shop', 'all')}
              />
            )}

            {currentView === 'admin' && (
              <AdminView
                products={products}
                categories={categories}
                storeSettings={storeSettings}
                onRefreshData={loadData}
                onExitAdmin={() => handleNavigate('home')}
                onNavigateGoLive={() => handleNavigate('go-live')}
                onNavigateCategory={(catId) => handleNavigate('category', catId)}
              />
            )}

            {['about', 'contact', 'shipping', 'returns', 'care-guide', 'privacy', 'terms'].includes(currentView) && (
              <PolicyViews
                type={currentView as any}
                onNavigateShop={() => handleNavigate('shop', 'all')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      {currentView !== 'admin' && currentView !== 'go-live' && <Footer onNavigate={handleNavigate} />}

      {/* Global Interactive Modals */}
      <QuickViewModal
        product={quickViewProduct ? (products.find((p) => p.id === quickViewProduct.id) || quickViewProduct) : null}
        initialVariation={quickViewVariation}
        onClose={() => setQuickViewProduct(null)}
        onViewFullProduct={(prod) => handleSelectProduct(prod, quickViewVariation)}
      />

      <CartDrawer
        onCheckout={() => {
          handleNavigate('checkout');
        }}
        onViewShop={() => handleNavigate('shop', 'all')}
      />

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        onSelectProduct={handleSelectProduct}
      />

      <PromotionalLoginModal
        isOpen={promoLoginOpen}
        onClose={handleClosePromoLogin}
        onSuccess={handlePromoLoginSuccess}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
      />

      {/* Floating WhatsApp Contact Button (Requirement 6) */}
      {currentView !== 'admin' && (
        <a
          href="https://wa.me/917302187770"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with VIDHYAA Jewellery on WhatsApp"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group"
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
          </div>
          <span className="text-xs font-bold tracking-wide hidden sm:inline-block">
            Chat with Us
          </span>
        </a>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <MainApp />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
