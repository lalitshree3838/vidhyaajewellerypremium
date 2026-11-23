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
  subscribeToProducts,
  fetchCategories,
  fetchStoreSettings,
  getCachedProducts,
  getCachedProductsAsync,
  getCachedCategories,
  getDeletedProductIds,
  sortCatalogProducts,
  __mergeProductMedia
} from './lib/dbService';
import { connectionReadyPromise } from './lib/firebase';
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

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('[VIDHYAA ADMIN] Caught runtime error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#120D0E] text-[#FAF7F2] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#1F1517] border border-[#DFB982]/40 rounded-3xl p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-white">
                  VIDHYAA Executive Admin - Workstation Protected
                </h2>
                <p className="text-xs text-[#DFB982]/80">
                  A safe display error was intercepted so your inventory and orders remain untouched.
                </p>
              </div>
            </div>
            {this.state.error && (
              <pre className="bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-amber-200/90 overflow-x-auto max-h-36">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-[#802336] hover:bg-[#9c2b42] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Admin Workspace</span>
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="flex-1 bg-white/10 hover:bg-white/20 text-[#FAF7F2] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Return to Storefront
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const POLICY_VIEWS = ['about', 'contact', 'shipping', 'returns', 'care-guide', 'privacy', 'terms'];

const parseLocationRoute = () => {
  if (typeof window === 'undefined') {
    return { view: 'home', param: undefined as string | undefined, productId: null as string | null, trackingOrder: '', openCartDrawer: false };
  }
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  const queryView = (params.get('view') || '').toLowerCase();

  if (pathname.includes('/admin') || hash.includes('admin')) {
    return { view: 'admin', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (params.has('cf_order_id') || queryView === 'checkout' || pathname.startsWith('/checkout')) {
    return { view: 'checkout', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (queryView === 'orders' || pathname.startsWith('/orders')) {
    return { view: 'orders', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (queryView === 'account' || pathname.startsWith('/account')) {
    return { view: 'account', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (queryView === 'wishlist' || pathname.startsWith('/wishlist')) {
    return { view: 'wishlist', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (queryView === 'go-live' || pathname.startsWith('/go-live')) {
    return { view: 'go-live', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (queryView === 'track-order' || pathname.startsWith('/track-order')) {
    return { view: 'track-order', param: undefined, productId: null, trackingOrder: params.get('order') || '', openCartDrawer: false };
  }

  const productParam = params.get('product');
  if (productParam) {
    return { view: 'product-detail', param: undefined, productId: productParam, trackingOrder: '', openCartDrawer: false };
  }
  if (pathname.startsWith('/product/')) {
    const seg = decodeURIComponent(pathname.split('/').filter(Boolean)[1] || '');
    if (seg) {
      return { view: 'product-detail', param: undefined, productId: seg, trackingOrder: '', openCartDrawer: false };
    }
  }

  if (POLICY_VIEWS.includes(queryView)) {
    return { view: queryView, param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  const strippedPath = pathname.replace(/^\//, '').toLowerCase();
  if (POLICY_VIEWS.includes(strippedPath)) {
    return { view: strippedPath, param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
  }

  if (strippedPath === 'cart' || queryView === 'cart') {
    return { view: 'shop', param: 'all', productId: null, trackingOrder: '', openCartDrawer: true };
  }
  if (strippedPath === 'new-arrivals' || strippedPath === 'best-sellers' || strippedPath === 'trending') {
    return { view: 'shop', param: strippedPath, productId: null, trackingOrder: '', openCartDrawer: false };
  }
  if (strippedPath === 'categories') {
    return { view: 'shop', param: 'all', productId: null, trackingOrder: '', openCartDrawer: false };
  }

  if (pathname.startsWith('/category/')) {
    const seg = decodeURIComponent(pathname.split('/').filter(Boolean)[1] || '');
    if (seg) {
      return { view: 'category', param: seg, productId: null, trackingOrder: '', openCartDrawer: false };
    }
  }

  if (pathname.startsWith('/collection/') || pathname.startsWith('/collections/')) {
    const seg = decodeURIComponent(pathname.split('/').filter(Boolean)[1] || '');
    return { view: 'shop', param: seg || 'all', productId: null, trackingOrder: '', openCartDrawer: false };
  }

  const catParam = params.get('category') || params.get('collection') || params.get('filter');
  if (pathname.startsWith('/shop') || catParam || hash.toLowerCase() === '#shop') {
    return { view: 'shop', param: catParam || 'all', productId: null, trackingOrder: '', openCartDrawer: false };
  }

  return { view: 'home', param: undefined, productId: null, trackingOrder: '', openCartDrawer: false };
};

function MainApp() {
  const { user, patronSession, isAdmin } = useAuth();
  const { openCart, closeCart } = useCart();

  const initialRoute = parseLocationRoute();

  // Navigation State
  const [currentView, setCurrentView] = useState<string>(initialRoute.view);
  const [currentParam, setCurrentParam] = useState<string | undefined>(initialRoute.param);
  const [pendingProductId, setPendingProductId] = useState<string | null>(initialRoute.productId);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedInitialVariation, setSelectedInitialVariation] = useState<ProductVariation | undefined>(undefined);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string>(initialRoute.trackingOrder);

  // Modals
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [quickViewVariation, setQuickViewVariation] = useState<ProductVariation | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [promoLoginOpen, setPromoLoginOpen] = useState(false);

  // Automatically trigger the promotional login popup after 3.5 seconds if visitor is not logged in
  useEffect(() => {
    if (user || patronSession) return;
    if (currentView === 'checkout' || currentView === 'admin') return;
    const isDismissed = sessionStorage.getItem('vidhyaa_promo_popup_dismissed') === 'true';
    if (isDismissed) return;

    const timer = setTimeout(() => {
      if (!user && !patronSession && sessionStorage.getItem('vidhyaa_promo_popup_dismissed') !== 'true') {
        setPromoLoginOpen(true);
      }
    }, 3800);

    return () => clearTimeout(timer);
  }, [user, patronSession, currentView]);

  const handleClosePromoLogin = () => {
    setPromoLoginOpen(false);
    sessionStorage.setItem('vidhyaa_promo_popup_dismissed', 'true');
  };

  const handlePromoLoginSuccess = () => {
    setPromoLoginOpen(false);
    sessionStorage.setItem('vidhyaa_promo_popup_dismissed', 'true');
  };

  // Firestore Live Catalog Data initialized with cached or sorted baseline so storefront renders immediately
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedProducts();
    const hasUsableCache =
      cached.length > 0 &&
      !cached.some((p) => p && p._strippedImg && (!p.images || p.images.length === 0));
    if (hasUsableCache) return cached;
    const deletedIds = getDeletedProductIds();
    return sortCatalogProducts(
      INITIAL_PRODUCTS.filter((p) => isGenuineProduct(p) && !deletedIds.has(p.id)).map((p) =>
        __mergeProductMedia(p, null)
      )
    );
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = getCachedCategories();
    return cached.length > 0 ? cached : INITIAL_CATEGORIES;
  });
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [liveCatalogSynced, setLiveCatalogSynced] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const safeSetProducts = (nextList: Product[]) => {
    if (!Array.isArray(nextList)) return;
    setProducts((prev) => {
      const prevMap = new Map<string, Product>();
      prev.forEach((item) => {
        if (item && item.id) prevMap.set(item.id, item);
      });
      return nextList.map((p) => __mergeProductMedia(p, prevMap.get(p.id)));
    });
  };

  const loadData = async () => {
    try {
      setInitError(null);
      await Promise.race([
        connectionReadyPromise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
      ]);
      const [prods, cats, sets] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchStoreSettings()
      ]);

      if (Array.isArray(prods)) {
        safeSetProducts(prods);
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
      const idbOrLocal = await getCachedProductsAsync().catch(() => getCachedProducts());
      if (idbOrLocal.length > 0) {
        safeSetProducts(idbOrLocal);
      }
      setInitError(e?.message || 'Unable to sync live catalog data. Displaying saved catalog.');
    } finally {
      setLoadingInitial(false);
      setLiveCatalogSynced(true);
    }
  };

  useEffect(() => {
    let active = true;
    // Immediately hydrate full unstripped images from IndexedDB before remote sync finishes
    getCachedProductsAsync()
      .then((cachedFull) => {
        if (active && Array.isArray(cachedFull) && cachedFull.length > 0) {
          safeSetProducts(cachedFull);
        }
      })
      .catch(() => {});

    void loadData();

    const handleProductsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        safeSetProducts(e.detail);
      }
    };
    window.addEventListener('vidhyaa_products_updated', handleProductsUpdated);

    return () => {
      active = false;
      window.removeEventListener('vidhyaa_products_updated', handleProductsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    let unsubscribe = () => {};

    Promise.race([
      connectionReadyPromise,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
    ]).then(() => {
      if (!active) return;
      unsubscribe = subscribeToProducts(
        (liveProds) => {
          if (Array.isArray(liveProds) && liveProds.length > 0) {
            safeSetProducts(liveProds);
          }
        },
        (err) => {
          console.warn('[Storefront] Firestore real-time notice:', err?.message || err);
        }
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAdmin]);

  useEffect(() => {
    const checkDirectUrl = () => {
      const route = parseLocationRoute();
      setCurrentView(route.view);
      setCurrentParam(route.param);
      if (route.trackingOrder) {
        setTrackingOrderNumber(route.trackingOrder);
      }
      if (route.productId) {
        setPendingProductId(route.productId);
      }
      if (route.openCartDrawer) {
        openCart();
      }
    };

    checkDirectUrl();

    const handlePopState = () => {
      checkDirectUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!pendingProductId || products.length === 0) return;
    const found = products.find((p) => p.id === pendingProductId || p.slug === pendingProductId);
    if (found) {
      setSelectedProduct(found);
      setCurrentView('product-detail');
      setPendingProductId(null);
    } else if (liveCatalogSynced && !loadingInitial) {
      setCurrentView('shop');
      setPendingProductId(null);
    }
  }, [pendingProductId, products, loadingInitial, liveCatalogSynced]);

  const handleNavigate = (view: string, param?: string) => {
    setPendingProductId(null);
    setCurrentView(view);
    setCurrentParam(param);
    if (view === 'admin') {
      closeCart();
      window.history.pushState({}, '', '/admin/login');
    } else if (view === 'home' && (window.location.pathname !== '/' || window.location.search)) {
      window.history.pushState({}, '', '/');
    } else if (view === 'orders' || view === 'account' || view === 'wishlist' || view === 'go-live') {
      window.history.pushState({}, '', `/?view=${view}`);
    } else if (POLICY_VIEWS.includes(view)) {
      window.history.pushState({}, '', `/?view=${view}`);
    } else if (view === 'track-order') {
      const url = param ? `/?view=track-order&order=${encodeURIComponent(param)}` : '/?view=track-order';
      window.history.pushState({}, '', url);
    } else if (view === 'checkout') {
      closeCart();
      if (!window.location.search.includes('cf_order_id=')) {
        window.history.pushState({}, '', '/?view=checkout');
      }
    } else if (view === 'category') {
      window.history.pushState({}, '', `/category/${encodeURIComponent(param || 'necklaces')}`);
    } else if (view === 'collections' || view === 'collection') {
      setCurrentView('shop');
      setCurrentParam(param || 'all');
      window.history.pushState({}, '', `/collections/${encodeURIComponent(param || 'all')}`);
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
    setPendingProductId(null);
    setSelectedProduct(product);
    setSelectedInitialVariation(variation);
    setCurrentView('product-detail');
    window.history.pushState({}, '', `/?product=${encodeURIComponent(product.id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenQuickView = (product: Product, variation?: ProductVariation) => {
    setQuickViewProduct(product);
    setQuickViewVariation(variation);
  };

  const handleBuyNowDirect = () => {
    handleNavigate('checkout');
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
                category={(() => {
                  const rawParam = (currentParam || '').toLowerCase().trim();
                  const aliasedId =
                    rawParam === 'devotional-jewellery'
                      ? 'devotional-rings'
                      : [
                          'kangan-kada',
                          'bracelet',
                          'bracelets',
                          'bangles-kangan',
                          'bangles-bracelets',
                          'kada-bangles',
                          'kada-and-bangles',
                          'bangles-kangan-kada-bracelets',
                          'kangan-kada-bracelet',
                          'kangan-kada-and-bracelet'
                        ].includes(rawParam)
                      ? 'kangan-kada-bracelet'
                      : rawParam === 'necklace'
                      ? 'necklaces'
                      : rawParam === 'ring'
                      ? 'rings'
                      : rawParam === 'watch'
                      ? 'watches'
                      : rawParam;
                  return (
                    categories.find(
                      (c) =>
                        c.id === currentParam ||
                        c.slug === currentParam ||
                        c.id.toLowerCase() === aliasedId ||
                        c.slug.toLowerCase() === aliasedId
                    ) || categories[0]
                  );
                })()}
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
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'checkout' && (
              <CheckoutView
                storeSettings={storeSettings}
                onOrderSuccess={handleOrderSuccess}
                onNavigateHome={() => handleNavigate('home')}
                onViewMyOrders={() => handleNavigate('orders')}
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
              <AdminErrorBoundary>
                <AdminView
                  products={products}
                  categories={categories}
                  storeSettings={storeSettings}
                  onRefreshData={loadData}
                  onExitAdmin={() => handleNavigate('home')}
                  onNavigateGoLive={() => handleNavigate('go-live')}
                  onNavigateCategory={(catId) => handleNavigate('category', catId)}
                />
              </AdminErrorBoundary>
            )}

            {['about', 'contact', 'shipping', 'returns', 'care-guide', 'privacy', 'terms'].includes(currentView) && (
              <PolicyViews
                type={(currentView === 'care-guide' ? 'care' : currentView) as any}
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
