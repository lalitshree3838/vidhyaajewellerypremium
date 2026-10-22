import React, { useState } from 'react';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  ArrowRight,
  Heart,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  User
} from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
    setEmailInput('');
  };

  // 1. Shop By Category Items (Exact 6 items requested)
  const categoriesList = [
    { name: 'Necklace', slug: 'necklace' },
    { name: 'Pendant Sets', slug: 'pendant-sets' },
    { name: 'Kangan/Kada & Bracelet', slug: 'kangan-kada-bracelet' },
    { name: 'Rings', slug: 'rings' },
    { name: 'Watches', slug: 'watches' },
    { name: 'Earrings / Cuffs', slug: 'earrings-cuffs' }
  ];

  // 2. Shop By Collection Items (Exact 22 items requested)
  const collectionsList = [
    { name: 'Shop All', slug: 'all' },
    { name: 'Diamond Necklace Sets', slug: 'diamond-necklace-sets' },
    { name: 'Diamond Pendant Sets', slug: 'diamond-pendant-sets' },
    { name: 'Kundan & Polki Necklace Sets', slug: 'kundan-polki-necklace-sets' },
    { name: 'Kundan & Polki Pendant Sets', slug: 'kundan-polki-pendant-sets' },
    { name: 'Temple Jewellery Sets', slug: 'temple-jewellery-sets' },
    { name: 'Gold Finish Jewellery', slug: 'gold-finish-jewellery' },
    { name: 'Ragwada Collections', slug: 'ragwada-collections' },
    { name: 'Moissanite Collection', slug: 'moissanite-collection' },
    { name: 'Emerald Jewellery', slug: 'emerald-jewellery' },
    { name: 'Ruby Jewellery Collection', slug: 'ruby-jewellery-collection' },
    { name: 'Pearl & Stone Mala Collection', slug: 'pearl-stone-mala-collection' },
    { name: 'Wedding Guest Jewellery Collection', slug: 'wedding-guest-jewellery' },
    { name: 'Festive Jewellery Collection', slug: 'festive-jewellery-collection' },
    { name: 'Sangeet Jewellery Collection', slug: 'sangeet-jewellery-collection' },
    { name: 'Rhodium Plating', slug: 'rhodium-plating' },
    { name: 'Choker Sets', slug: 'choker-sets' },
    { name: 'Hasli Sets', slug: 'hasli-sets' },
    { name: 'Chain Collection', slug: 'chain-collection' },
    { name: 'Mangalsutra', slug: 'mangalsutra' },
    { name: '92.5 Silver Jewellery', slug: '925-silver-jewellery' },
    { name: 'Anklets Collection', slug: 'anklets-collection' }
  ];

  return (
    <footer className="bg-[#0F5B46] footer-teak-green text-white border-t border-[#0B4536] pt-14 pb-8 w-full transition-colors duration-200">
      {/* Top Value Propositions / Trust Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 px-6 bg-[#0B4536]/80 rounded-2xl border border-white/20 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Insured Express Shipping
              </h4>
              <p className="text-[11px] text-white/95 font-medium">Pan-India express courier dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                92.5 Hallmarked Silver
              </h4>
              <p className="text-[11px] text-white/95 font-medium">100% Certified authentic purity</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                UPI-Only Fast Checkout
              </h4>
              <p className="text-[11px] text-white/95 font-medium">Zero fee instant verified payments</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                7-Day Easy Returns
              </h4>
              <p className="text-[11px] text-white/95 font-medium">Hassle-free replacement policy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links - Multi-column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8">
          
          {/* Column 1: Brand & Studio Contact Information (lg:col-span-3) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[#B2F5E8] text-xl">✦</span>
              <span className="font-serif text-2xl font-bold tracking-[0.2em] text-white">
                VIDHYAA
              </span>
              <span className="text-[#B2F5E8] text-xl">✦</span>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-white font-bold">
              Jewellery Studio • Roorkee, District Haridwar, Uttarakhand
            </p>
            <p className="text-xs text-white leading-relaxed font-medium">
              VIDHYAA Jewellery Studio crafts timeless jewellery heirlooms designed for the discerning Indian woman. From imperial uncut Kundan chokers to certified 92.5 sterling silver, oxidised bohemian art, and swiss-precision luxury watches.
            </p>
            
            {/* Contact Details */}
            <div className="pt-1 flex flex-col gap-2.5 text-xs text-white">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-[#B2F5E8] flex-shrink-0" />
                <span className="font-medium">Business Owner: <strong className="text-white">Neeraj Chauhan</strong></span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#B2F5E8] flex-shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">
                  Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India - 247667
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#B2F5E8] flex-shrink-0" />
                <a 
                  href="tel:7302187770" 
                  className="text-white hover:text-[#B2F5E8] hover:underline font-bold transition-colors"
                >
                  7302187770 <span className="font-normal text-white/80">(Click to Call)</span>
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#B2F5E8] flex-shrink-0" />
                <a 
                  href="mailto:care@vidhyaajewellery.com" 
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-colors"
                >
                  care@vidhyaajewellery.com
                </a>
              </div>

              {/* Working WhatsApp button */}
              <div className="pt-1">
                <a
                  href="https://wa.me/917302187770"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>WhatsApp 7302187770</span>
                </a>
              </div>
            </div>

            {/* Social Media Icons */}
            <div className="pt-2">
              <p className="text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                Follow Our Studio
              </p>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:text-[#B2F5E8] hover:bg-white/25 transition-all shadow-xs"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:text-[#B2F5E8] hover:bg-white/25 transition-all shadow-xs"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:text-[#B2F5E8] hover:bg-white/25 transition-all shadow-xs"
                >
                  <Youtube className="w-4 h-4" />
                </a>
                <a
                  href="https://wa.me/917302187770"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:text-[#B2F5E8] hover:bg-white/25 transition-all shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Shop By Category (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-serif text-sm font-bold text-white tracking-widest uppercase mb-4 border-l-2 border-white pl-2">
              Shop By Category
            </h3>
            <ul className="space-y-2 text-xs">
              {categoriesList.map((cat) => (
                <li key={cat.slug}>
                  <a
                    href={`/shop?category=${cat.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('shop', cat.slug);
                    }}
                    className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Shop By Collection (lg:col-span-4) - Balanced 2-Subcolumn Layout */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="font-serif text-sm font-bold text-white tracking-widest uppercase mb-4 border-l-2 border-white pl-2">
              Shop By Collection
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {collectionsList.map((col) => (
                <div key={col.slug}>
                  <a
                    href={col.slug === 'all' ? '/shop' : `/shop?collection=${col.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('shop', col.slug);
                    }}
                    className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                  >
                    {col.name}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Column 4: Customer Care (lg:col-span-3) */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="font-serif text-sm font-bold text-white tracking-widest uppercase mb-4 border-l-2 border-white pl-2">
              Customer Care
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/track-order"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('track-order');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                >
                  Track Your Order
                </a>
              </li>
              <li>
                <a
                  href="/shipping"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('shipping');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                >
                  Shipping & Delivery
                </a>
              </li>
              <li>
                <a
                  href="/returns"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('returns');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                >
                  Returns & Exchange
                </a>
              </li>
              <li>
                <a
                  href="/care-guide"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('care-guide');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                >
                  Jewellery Care Guide
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('contact');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium transition-all duration-150 block py-0.5 text-left focus:outline-none focus:ring-1 focus:ring-[#B2F5E8] rounded-xs"
                >
                  Contact Support
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/admin/login"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('admin');
                  }}
                  className="text-[#B2F5E8] hover:text-white hover:underline font-bold transition-colors block py-0.5 text-left"
                >
                  <span>✦ Admin Studio Portal</span>
                </a>
              </li>
            </ul>

            {/* Newsletter Subscription Card in Customer Care Column */}
            <div className="pt-3 border-t border-white/15 space-y-2.5">
              <h4 className="font-serif text-xs font-bold text-white uppercase tracking-wider">
                The VIDHYAA Circle
              </h4>
              <p className="text-[11px] text-white/95 leading-relaxed font-medium">
                Subscribe for private preview invitations & receive an instant <strong>10% OFF</strong> code.
              </p>

              {subscribed ? (
                <div className="bg-white/20 p-2.5 rounded-lg border border-white/30 text-xs text-white flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#B2F5E8] flex-shrink-0" />
                  <span>Use code <strong>VIDHYAA10</strong> at checkout!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-1.5">
                  <div className="flex">
                    <input
                      type="email"
                      required
                      placeholder="Enter email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="bg-white/15 border border-white/30 rounded-l-lg px-3 py-1.5 text-xs text-white placeholder-white/80 w-full focus:outline-none focus:border-white focus:bg-white/20"
                    />
                    <button
                      type="submit"
                      className="bg-[#0B4536] hover:bg-[#083A2D] border border-l-0 border-white/30 text-white px-3 py-1.5 rounded-r-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                      title="Subscribe"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-1 text-[11px] text-white space-x-2">
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('privacy');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium cursor-pointer"
                >
                  Privacy Policy
                </a>
                <span className="text-white/60">•</span>
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('terms');
                  }}
                  className="text-white hover:text-[#B2F5E8] hover:underline font-medium cursor-pointer"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Payment Info & Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white">
        <p className="flex items-center gap-1 text-center sm:text-left text-white font-medium">
          © {new Date().getFullYear()} VIDHYAA Jewellery Studio. All rights reserved. Handcrafted with
          <Heart className="w-3.5 h-3.5 text-[#B2F5E8] fill-[#B2F5E8] inline mx-1" />
          in Roorkee, District Haridwar, Uttarakhand, India.
        </p>

        {/* Accepted Payment badges */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-[10px] uppercase tracking-wider text-white font-bold">
            Payment Partners:
          </span>
          <span className="bg-white/15 px-2.5 py-1 rounded text-[11px] font-semibold text-white border border-white/20">
            UPI
          </span>
          <span className="bg-white/15 px-2.5 py-1 rounded text-[11px] font-semibold text-white border border-white/20">
            Google Pay
          </span>
          <span className="bg-white/15 px-2.5 py-1 rounded text-[11px] font-semibold text-white border border-white/20">
            PhonePe
          </span>
          <span className="bg-white/15 px-2.5 py-1 rounded text-[11px] font-semibold text-white border border-white/20">
            Paytm
          </span>
          <span className="bg-white/15 px-2.5 py-1 rounded text-[11px] font-semibold text-white border border-white/20">
            BHIM
          </span>
        </div>
      </div>
    </footer>
  );
};
