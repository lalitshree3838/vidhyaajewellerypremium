import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Heart,
  ShoppingBag,
  User as UserIcon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Truck,
  LogOut,
  Package,
  Settings,
  Flame,
  Phone,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Category } from '../types';
import { SHOP_BY_CATEGORY_ITEMS, SHOP_BY_COLLECTION_ITEMS } from '../lib/navigationConfig';

interface HeaderProps {
  currentView: string;
  categories?: Category[];
  onNavigate: (view: string, param?: string) => void;
  onOpenSearch: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  categories = [],
  onNavigate,
  onOpenSearch,
  onOpenAuth
}) => {
  const { user, userProfile, isAdmin, signOut } = useAuth();
  const { items, openCart, finalTotal } = useCart();
  const { wishlistCount } = useWishlist();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [collectionDropdownOpen, setCollectionDropdownOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const collectionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setCategoryDropdownOpen(false);
      }
      if (collectionDropdownRef.current && !collectionDropdownRef.current.contains(target)) {
        setCollectionDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCategoryDropdownOpen(false);
        setCollectionDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const totalCartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleNav = (view: string, param?: string) => {
    onNavigate(view, param);
    setMobileMenuOpen(false);
    setCategoryDropdownOpen(false);
    setCollectionDropdownOpen(false);
    setUserDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DCCF] transition-all">
      {/* Top Announcement Bar */}
      <div className="bg-[#0F5C4D] text-[#F4EBE1] text-xs font-medium py-2 px-4 transition-colors border-b border-[#0A4338]/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center">
            <span className="inline-flex items-center gap-1 text-[#DFB982] font-semibold tracking-wider uppercase text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              Royal Heritage Atelier
            </span>
            <span className="hidden md:inline text-white/30">•</span>
            <span className="tracking-wide">
              Handcrafted Luxury Jewellery & Certified 92.5 Sterling Silver
            </span>
            <span className="hidden lg:inline text-white/40">| Insured Pan-India Express Dispatch</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-[#E8DCCF]/90">
            <a
              href="tel:7302187770"
              className="hover:text-[#DFB982] transition-colors hidden sm:flex items-center gap-1 font-semibold"
              title="Call VIDHYAA Studio Concierge"
            >
              <Phone className="w-3 h-3 text-[#DFB982]" />
              <span>7302187770</span>
            </a>
            <span className="text-white/30 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('track-order')}
              className="hover:text-[#DFB982] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Truck className="w-3 h-3 text-[#DFB982]" />
              Track Order
            </button>
            <span className="text-white/30">•</span>
            <button
              onClick={() => handleNav('care-guide')}
              className="hover:text-[#DFB982] transition-colors hidden sm:inline cursor-pointer"
            >
              Jewellery Care
            </button>
            <span className="text-white/30 hidden sm:inline">•</span>
            <button
              onClick={() => handleNav('admin')}
              className="bg-[#D4AF37] hover:bg-[#c39e2d] text-[#3B1E22] px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              title="Open Store Admin Panel"
            >
              <Settings className="w-3 h-3" />
              <span>Admin Panel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Luxury Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#3B1E22] hover:text-[#802336] focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Brand Mark & Monogram */}
          <div
            onClick={() => handleNav('home')}
            className="flex flex-col items-center justify-center cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#B8860B] group-hover:rotate-45 transition-transform duration-500 text-lg">
                ✦
              </span>
              <span className="text-2xl sm:text-3xl font-serif tracking-[0.2em] font-semibold text-[#3B1E22] group-hover:text-[#802336] transition-colors">
                VIDHYAA
              </span>
              <span className="text-[#B8860B] group-hover:-rotate-45 transition-transform duration-500 text-lg">
                ✦
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] tracking-[0.35em] text-[#802336] uppercase font-medium -mt-1">
              Jewellery Studio
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-3.5 xl:space-x-5 text-[11px] xl:text-[12px] font-semibold tracking-wider uppercase text-[#241C1A]">
            <button
              onClick={() => handleNav('home')}
              className={`hover:text-[#802336] transition-colors pb-1 cursor-pointer ${
                currentView === 'home' ? 'text-[#802336] border-b-2 border-[#802336]' : ''
              }`}
            >
              Home
            </button>

            {/* 1. SHOP BY CATEGORY — DROPDOWN MENU */}
            <div
              ref={categoryDropdownRef}
              className="relative"
              onMouseEnter={() => {
                setCategoryDropdownOpen(true);
                setCollectionDropdownOpen(false);
              }}
              onMouseLeave={() => setCategoryDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                  setCollectionDropdownOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCategoryDropdownOpen(true);
                    setCollectionDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setCategoryDropdownOpen(false);
                  }
                }}
                aria-haspopup="true"
                aria-expanded={categoryDropdownOpen}
                aria-label="Shop by Category"
                className={`flex items-center gap-1 hover:text-[#802336] transition-colors pb-1 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#802336] rounded-xs ${
                  categoryDropdownOpen ? 'text-[#802336]' : ''
                }`}
              >
                <span>Shop by Category</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    categoryDropdownOpen ? 'rotate-180 text-[#802336]' : 'text-gray-500'
                  }`}
                />
              </button>

              {categoryDropdownOpen && (
                <div
                  role="menu"
                  aria-label="Shop by Category menu"
                  className="absolute top-full left-0 w-[520px] max-w-[90vw] bg-[#FAF7F2] rounded-2xl shadow-2xl border border-[#E8DCCF] p-4 z-50 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E8DCCF]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="text-[11px] font-bold text-[#802336] uppercase tracking-widest">
                        Shop by Category
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 lowercase">
                      12 curated categories
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {/* Left Column (Items 1-6) */}
                    <div className="space-y-1">
                      {SHOP_BY_CATEGORY_ITEMS.slice(0, 6).map((item, idx) => (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => handleNav('shop', item.id)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#241C1A] hover:text-[#802336] hover:bg-[#F4EBE1] transition-all cursor-pointer flex items-center justify-between group focus:outline-none focus-visible:bg-[#F4EBE1]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono text-[#B8860B] font-bold w-4">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-[#241C1A] group-hover:text-[#802336] truncate">
                                {item.name}
                              </p>
                              {item.subtitle && (
                                <p className="text-[10px] text-gray-500 truncate font-normal tracking-normal">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#802336] group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1" />
                        </button>
                      ))}
                    </div>

                    {/* Right Column (Items 7-12) */}
                    <div className="space-y-1">
                      {SHOP_BY_CATEGORY_ITEMS.slice(6, 12).map((item, idx) => (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => handleNav('shop', item.id)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#241C1A] hover:text-[#802336] hover:bg-[#F4EBE1] transition-all cursor-pointer flex items-center justify-between group focus:outline-none focus-visible:bg-[#F4EBE1]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono text-[#B8860B] font-bold w-4">
                              {String(idx + 7).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-[#241C1A] group-hover:text-[#802336] truncate">
                                {item.name}
                              </p>
                              {item.subtitle && (
                                <p className="text-[10px] text-gray-500 truncate font-normal tracking-normal">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#802336] group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#E8DCCF] flex items-center justify-between text-[10px] text-[#6E5A4E] font-medium tracking-normal">
                    <span>Certified 92.5 Sterling Silver & 22K Micro Gold Plated</span>
                    <button
                      onClick={() => handleNav('shop', 'all')}
                      className="text-[#802336] hover:underline font-bold cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. SHOP BY COLLECTIONS — DROPDOWN MENU */}
            <div
              ref={collectionDropdownRef}
              className="relative"
              onMouseEnter={() => {
                setCollectionDropdownOpen(true);
                setCategoryDropdownOpen(false);
              }}
              onMouseLeave={() => setCollectionDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setCollectionDropdownOpen(!collectionDropdownOpen);
                  setCategoryDropdownOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCollectionDropdownOpen(true);
                    setCategoryDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setCollectionDropdownOpen(false);
                  }
                }}
                aria-haspopup="true"
                aria-expanded={collectionDropdownOpen}
                aria-label="Shop by Collections"
                className={`flex items-center gap-1 hover:text-[#802336] transition-colors pb-1 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#802336] rounded-xs ${
                  collectionDropdownOpen ? 'text-[#802336]' : ''
                }`}
              >
                <span>Shop by Collections</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    collectionDropdownOpen ? 'rotate-180 text-[#802336]' : 'text-gray-500'
                  }`}
                />
              </button>

              {collectionDropdownOpen && (
                <div
                  role="menu"
                  aria-label="Shop by Collections menu"
                  className="absolute top-full left-0 w-80 bg-[#FAF7F2] rounded-2xl shadow-2xl border border-[#E8DCCF] p-3 z-50 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[#E8DCCF] px-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="text-[11px] font-bold text-[#802336] uppercase tracking-widest">
                        Royal Curations
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 lowercase">
                      8 collections
                    </span>
                  </div>

                  <div className="space-y-1">
                    {SHOP_BY_COLLECTION_ITEMS.map((item, idx) => (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => handleNav('shop', item.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between group focus:outline-none focus-visible:bg-[#F4EBE1] ${
                          item.id === 'all'
                            ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] font-bold hover:bg-[#0F5C4D]/20'
                            : 'text-[#241C1A] hover:text-[#802336] hover:bg-[#F4EBE1]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.id === 'all' ? (
                            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                          ) : (
                            <span className="text-[10px] font-mono text-[#B8860B] font-bold w-3.5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">
                              {item.name}
                            </p>
                            {item.subtitle && (
                              <p className="text-[10px] text-gray-500 truncate font-normal tracking-normal">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#802336] group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#E8DCCF] px-2 text-[10px] text-[#6E5A4E] text-center font-medium">
                    Handcrafted in Roorkee Atelier • Pan-India Delivery
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleNav('shop', 'best-sellers')}
              className="hover:text-[#802336] transition-colors pb-1 cursor-pointer"
            >
              Best Sellers
            </button>

            <button
              onClick={() => {
                const scrollTarget = () => {
                  const el = document.getElementById('shopping-video') || document.getElementById('shop-from-video');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                };
                if (currentView === 'home') {
                  scrollTarget();
                } else {
                  handleNav('home');
                  setTimeout(scrollTarget, 100);
                }
              }}
              className="hover:text-[#802336] transition-colors pb-1 cursor-pointer flex items-center gap-1 text-[#802336] font-bold"
            >
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>Shopping Video</span>
            </button>

            <button
              onClick={() => handleNav('about')}
              className="hover:text-[#802336] transition-colors pb-1 cursor-pointer"
            >
              About Us
            </button>

            <button
              onClick={() => handleNav('contact')}
              className="hover:text-[#802336] transition-colors pb-1 cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Action Icons (Search, Wishlist, Account, Cart) */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Search Button */}
            <button
              onClick={onOpenSearch}
              className="p-2 text-[#3B1E22] hover:text-[#802336] transition-colors cursor-pointer"
              title="Search jewellery"
              aria-label="Search jewellery"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Wishlist */}
            <button
              onClick={() => handleNav('wishlist')}
              className="p-2 text-[#3B1E22] hover:text-[#802336] transition-colors relative cursor-pointer"
              title="Wishlist"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#802336] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Customer Account / Sign In */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!user) {
                    onOpenAuth();
                  } else {
                    setUserDropdownOpen(!userDropdownOpen);
                  }
                }}
                className="p-2 text-[#3B1E22] hover:text-[#802336] transition-colors flex items-center gap-1 cursor-pointer"
                title={user ? user.displayName || user.email || 'My Account' : 'Sign In'}
                aria-label="Account"
              >
                <UserIcon className="w-5 h-5" />
                <span className="hidden xl:inline text-xs font-medium tracking-normal">
                  {user ? (user.displayName?.split(' ')[0] || 'Patron') : 'Sign In'}
                </span>
              </button>

              {user && userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#FAF7F2] rounded-lg shadow-xl border border-[#E8DCCF] py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-[#E8DCCF]">
                    <p className="text-xs font-semibold text-[#3B1E22] truncate">
                      {user.displayName || 'VIDHYAA Patron'}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    {isAdmin && (
                      <span className="inline-block mt-1 bg-[#802336] text-[#FAF7F2] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                        Admin Access
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleNav('account')}
                    className="w-full text-left px-4 py-2 text-xs text-[#241C1A] hover:bg-[#F4EBE1] flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[#802336]" />
                    My Profile & Addresses
                  </button>
                  <button
                    onClick={() => handleNav('orders')}
                    className="w-full text-left px-4 py-2 text-xs text-[#241C1A] hover:bg-[#F4EBE1] flex items-center gap-2 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-[#802336]" />
                    My Orders
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleNav('admin')}
                      className="w-full text-left px-4 py-2 text-xs text-[#802336] font-semibold hover:bg-[#F4EBE1] flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Admin Control Panel
                    </button>
                  )}
                  <div className="h-px bg-[#E8DCCF] my-1"></div>
                  <button
                    onClick={async () => {
                      await signOut();
                      setUserDropdownOpen(false);
                      handleNav('home');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-[#F4EBE1] flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Admin Badge Shortcut if Admin */}
            {isAdmin && (
              <button
                onClick={() => handleNav('admin')}
                className="hidden sm:flex items-center gap-1.5 bg-[#802336] hover:bg-[#631828] text-[#FAF7F2] text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors cursor-pointer shadow-sm"
                title="Open Admin Studio"
              >
                <Settings className="w-3.5 h-3.5 text-[#DFB982]" />
                <span className="text-[11px] uppercase tracking-wider">Admin</span>
              </button>
            )}

            {/* Shopping Cart Trigger */}
            <button
              onClick={openCart}
              className="bg-[#3B2F2A] hover:bg-[#4D3E37] active:bg-[#2E2420] text-[#FAF7F2] border border-[#3B2F2A] px-4 py-2 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-md"
              title="View Cart"
              aria-label="View Cart"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-[#DFB982]" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#DFB982] text-[#3B2F2A] text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {totalCartCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tracking-wide hidden sm:inline text-[#FAF7F2]">
                {totalCartCount > 0 ? `₹${finalTotal.toLocaleString('en-IN')}` : 'Cart'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FAF7F2] border-b border-[#E8DCCF] px-4 pt-2 pb-6 space-y-3">
          <div className="flex flex-col space-y-1.5 pt-2 text-xs font-bold tracking-wider uppercase">
            <button
              onClick={() => handleNav('home')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#F4EBE1] text-[#3B2F2A] cursor-pointer"
            >
              Home
            </button>
            {/* 1. Shop by Category Mobile Accordion */}
            <div className="border-b border-[#E8DCCF]/60 pb-1">
              <button
                type="button"
                onClick={() => {
                  setMobileCategoryOpen(!mobileCategoryOpen);
                  setMobileCollectionOpen(false);
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#F4EBE1] text-[#3B2F2A] font-bold flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>Shop by Category</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    mobileCategoryOpen ? 'rotate-180 text-[#802336]' : 'text-gray-400'
                  }`}
                />
              </button>

              {mobileCategoryOpen && (
                <div className="pl-3 pr-1 py-1 space-y-1 animate-fadeIn">
                  {SHOP_BY_CATEGORY_ITEMS.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => handleNav('shop', item.id)}
                      className="w-full text-left py-2.5 px-3 rounded-lg text-xs text-[#241C1A] hover:bg-[#F4EBE1] hover:text-[#802336] flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-[#B8860B] font-bold w-4">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{item.name}</p>
                          {item.subtitle && (
                            <p className="text-[10px] text-gray-500 font-normal truncate tracking-normal">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#802336]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Shop by Collections Mobile Accordion */}
            <div className="border-b border-[#E8DCCF]/60 pb-1">
              <button
                type="button"
                onClick={() => {
                  setMobileCollectionOpen(!mobileCollectionOpen);
                  setMobileCategoryOpen(false);
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#F4EBE1] text-[#3B2F2A] font-bold flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Shop by Collections</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    mobileCollectionOpen ? 'rotate-180 text-[#802336]' : 'text-gray-400'
                  }`}
                />
              </button>

              {mobileCollectionOpen && (
                <div className="pl-3 pr-1 py-1 space-y-1 animate-fadeIn">
                  {SHOP_BY_COLLECTION_ITEMS.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => handleNav('shop', item.id)}
                      className={`w-full text-left py-2.5 px-3 rounded-lg text-xs flex items-center justify-between cursor-pointer group ${
                        item.id === 'all'
                          ? 'bg-[#0F5C4D]/10 text-[#0F5C4D] font-bold'
                          : 'text-[#241C1A] hover:bg-[#F4EBE1] hover:text-[#802336]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.id === 'all' ? (
                          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                        ) : (
                          <span className="text-[10px] font-mono text-[#B8860B] font-bold w-3.5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{item.name}</p>
                          {item.subtitle && (
                            <p className="text-[10px] text-gray-500 font-normal truncate tracking-normal">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#802336]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => handleNav('shop', 'best-sellers')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#F4EBE1] text-[#3B2F2A] cursor-pointer"
            >
              Best Sellers
            </button>
            <button
              onClick={() => {
                const scrollTarget = () => {
                  const el = document.getElementById('shopping-video') || document.getElementById('shop-from-video');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                };
                if (currentView === 'home') {
                  scrollTarget();
                  setMobileMenuOpen(false);
                } else {
                  handleNav('home');
                  setTimeout(scrollTarget, 100);
                  setMobileMenuOpen(false);
                }
              }}
              className="text-left py-2 px-3 rounded-lg bg-red-50 text-red-700 font-bold flex items-center gap-2 cursor-pointer border border-red-200"
            >
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>Shopping Video</span>
            </button>
            <button
              onClick={() => handleNav('about')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#F4EBE1] text-[#3B2F2A] cursor-pointer"
            >
              About Us
            </button>
            <button
              onClick={() => handleNav('contact')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#F4EBE1] text-[#3B2F2A] cursor-pointer"
            >
              Contact Us & Atelier
            </button>

            {/* Quick Contact & WhatsApp in mobile menu */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
              <a
                href="tel:7302187770"
                className="py-2.5 px-3 rounded-xl bg-white border border-[#E8DCCF] text-[#3B1E22] flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-[#802336]" />
                <span>Call 7302187770</span>
              </a>
              <a
                href="https://wa.me/917302187770"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-[#25D366] text-white flex items-center justify-center gap-1.5 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>

            <button
              onClick={() => handleNav('track-order')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#F4EBE1] text-[#3B2F2A] cursor-pointer flex items-center gap-2"
            >
              <Truck className="w-4 h-4 text-[#DFB982]" />
              Track Order
            </button>

            <button
              onClick={() => handleNav('admin')}
              className="text-left py-2.5 px-3 rounded-xl bg-[#3B2F2A] text-[#FAF7F2] font-bold flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Settings className="w-4 h-4 text-[#DFB982]" />
              <span>Admin Studio Portal</span>
            </button>

            <div className="pt-3 border-t border-[#E8DCCF]">
              {user ? (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-600 font-normal">{user.email}</span>
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-red-600 font-semibold cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-3 bg-[#3B2F2A] hover:bg-[#4D3E37] text-[#FAF7F2] border border-[#3B2F2A] text-xs font-bold rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Sign In / Create Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
