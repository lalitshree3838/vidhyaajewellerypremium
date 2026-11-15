import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Truck,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Heart,
  User,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { MetadataManager } from '../components/MetadataManager';

interface PolicyViewProps {
  type: 'about' | 'contact' | 'shipping' | 'returns' | 'care' | 'privacy' | 'terms';
  onNavigateShop: () => void;
}

export const PolicyViews: React.FC<PolicyViewProps> = ({ type, onNavigateShop }) => {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setContactName('');
    setContactEmail('');
    setContactMessage('');
  };

  const policyTitles: Record<string, { title: string; desc: string }> = {
    about: {
      title: 'Our Story & Heritage Atelier',
      desc: 'Discover the heritage of VIDHYAA Jewellery Studio headquartered at Vidhya Villa, Solani Puram West, Roorkee, District Haridwar, Uttarakhand, celebrating royal uncut Kundan, 92.5 sterling silver, and master karigar artistry.'
    },
    contact: {
      title: 'Contact Concierge Support',
      desc: 'Connect with VIDHYAA Jewellery Studio atelier at Vidhya Villa, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand for personal jewellery styling, bespoke orders, and order inquiries.'
    },
    shipping: {
      title: 'Shipping & Delivery Policy',
      desc: 'Insured express shipping across India. Safe, tamper-proof luxury packaging dispatched in 24 hours.'
    },
    returns: {
      title: '7-Day Easy Returns & Exchange',
      desc: 'Hassle-free 7-day returns and exchanges for your peace of mind with 100% money-back guarantee.'
    },
    care: {
      title: 'Jewellery Care Guide',
      desc: 'How to clean, store, and maintain your 24K gold plated imitation jewellery, 92.5 sterling silver, and luxury watches.'
    },
    privacy: {
      title: 'Privacy Policy',
      desc: 'How VIDHYAA Jewellery Studio protects patron privacy, confidential records, and encrypted UPI payments.'
    },
    terms: {
      title: 'Terms & Conditions',
      desc: 'Terms of sale, certified authentic jewellery guarantees, and UPI transaction protocols at VIDHYAA.'
    }
  };

  const currentPolicy = policyTitles[type] || {
    title: 'Customer Information',
    desc: 'Customer policies and service guidelines for VIDHYAA Jewellery Studio.'
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-fadeIn">
      <MetadataManager
        title={currentPolicy.title}
        description={currentPolicy.desc}
      />
      {/* 1. About Us */}
      {type === 'about' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              The Atelier Story
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              About VIDHYAA Jewellery Studio
            </h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Headquartered at <strong>Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India (PIN: 247667)</strong> and founded by <strong>Neeraj Chauhan</strong>, <strong>VIDHYAA Jewellery Studio</strong> was envisioned to celebrate the grandeur of royal Indian jewellery craftsmanship while making regal elegance accessible to the modern discerning woman.
            </p>
            <p>
              For centuries, royal courts patronized master karigars who sculpted uncut polki, jadau Kundan, and delicate meenakari enamel. VIDHYAA translates these timeless heirlooms into wearable poetry — merging centuries of artisanal heritage with contemporary design sensibilities.
            </p>
            
            {/* Official Business Information Section */}
            <div className="p-6 bg-[#FAF7F2] rounded-2xl border border-[#DFB982] space-y-3">
              <h3 className="font-serif text-base font-bold text-[#3B1E22] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#802336]" />
                Official Business Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Business Name</span>
                  <span className="font-bold text-[#241C1A]">VIDHYAA Jewellery Studio</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Business Owner</span>
                  <span className="font-bold text-[#802336]">Neeraj Chauhan</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Complete Business Address</span>
                  <span className="font-medium text-gray-800">
                    Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">PIN Code</span>
                  <span className="font-mono font-bold text-gray-800">247667</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Business Contact Number</span>
                  <a href="tel:7302187770" className="font-bold text-[#802336] hover:underline flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    7302187770
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="tel:7302187770"
                  className="inline-flex items-center gap-2 bg-[#3B1E22] hover:bg-[#802336] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5 text-[#DFB982]" />
                  <span>Call 7302187770</span>
                </a>
                <a
                  href="https://wa.me/917302187770"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-center">
              <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <h4 className="font-serif text-base font-bold text-[#3B1E22]">24K Micron Gold</h4>
                <p className="text-xs text-gray-500 mt-1">High-durability gold plating that retains its radiant lustre.</p>
              </div>
              <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <h4 className="font-serif text-base font-bold text-[#3B1E22]">92.5 Hallmarked</h4>
                <p className="text-xs text-gray-500 mt-1">100% genuine solid sterling silver stamped for certified purity.</p>
              </div>
              <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <h4 className="font-serif text-base font-bold text-[#3B1E22]">Master Karigars</h4>
                <p className="text-xs text-gray-500 mt-1">Hand-set stones and precision craftsmanship in every detail.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Contact Us */}
      {type === 'contact' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              We Are Here For You
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              Contact VIDHYAA Studio
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 shadow-sm space-y-5 text-xs">
              <div className="flex items-center justify-between border-b pb-3 border-[#E8DCCF]">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#3B1E22]">Studio Headquarters</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                    VIDHYAA Jewellery Studio
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-[#FAF7F2] border border-[#DFB982] text-[#802336] rounded-full text-[10px] font-bold">
                  Verified Atelier
                </span>
              </div>

              <div className="space-y-3.5 text-gray-600">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-[#802336] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Business Owner</span>
                    <span className="font-bold text-[#241C1A]">Neeraj Chauhan</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#802336] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Complete Business Address</span>
                    <span className="font-medium text-gray-800 leading-relaxed block">
                      Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India
                    </span>
                    <span className="inline-block mt-1 font-mono text-xs font-bold text-[#802336] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      PIN Code: 247667
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#802336] flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Business Contact Number</span>
                    <a href="tel:7302187770" className="hover:text-[#802336] font-bold text-gray-900 text-sm">
                      7302187770
                    </a>
                    <span className="text-[10px] text-gray-500 block">(Mon - Sat, 10:00 AM - 7:00 PM IST)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#802336] flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Customer Care Email</span>
                    <a href="mailto:care@vidhyaajewellery.com" className="hover:text-[#802336] font-medium text-gray-800">
                      care@vidhyaajewellery.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#802336] flex-shrink-0" />
                  <span>Insured Express Dispatch within 24 Hours</span>
                </div>
              </div>

              {/* Direct Call & WhatsApp Contact Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <a
                  href="tel:7302187770"
                  className="flex-1 bg-[#3B1E22] hover:bg-[#802336] text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm text-xs"
                >
                  <Phone className="w-4 h-4 text-[#DFB982]" />
                  <span>Call 7302187770</span>
                </a>
                <a
                  href="https://wa.me/917302187770"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] hover:bg-[#20ba59] text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm text-xs"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>WhatsApp Contact</span>
                </a>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 shadow-sm space-y-4 text-xs">
              <h3 className="font-serif text-xl font-bold text-[#3B1E22]">Send Us an Inquiry</h3>
              {submitted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>Thank you! Your message has reached our concierge. We will respond within 4 hours.</span>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Your Email Address"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                  />
                  <textarea
                    rows={4}
                    required
                    placeholder="How may our jewellery stylists assist you?"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full p-3 border border-[#E8DCCF] rounded-lg"
                  />
                  <button
                    type="submit"
                    className="bg-[#3B2F2A] hover:bg-[#4D3E37] active:bg-[#2E2420] text-[#FAF7F2] border border-[#3B2F2A] px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    Send Inquiry
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Integrated Google Maps Location Section */}
          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E8DCCF]">
              <div>
                <span className="text-[10px] font-bold text-[#802336] uppercase tracking-wider block">
                  Interactive Studio Location
                </span>
                <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                  Find VIDHYAA Jewellery Studio on Google Maps
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Vidhya Villa, 152/9, Solani Puram (West), Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand, India - 247667
                </p>
              </div>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Vidhya+Villa%2C+152%2F9%2C+Solani+Puram+%28West%29%2C+Near+IIT+Roorkee%2C+Roorkee%2C+District+Haridwar%2C+Uttarakhand%2C+India+247667"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FAF7F2] hover:bg-[#F2ECE4] text-[#802336] border border-[#DFB982] rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
              >
                <MapPin className="w-3.5 h-3.5 text-[#802336]" />
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </a>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#E8DCCF] bg-[#FAF7F2]">
              <iframe
                title="VIDHYAA Jewellery Studio Google Maps Location"
                width="100%"
                height="280"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src="https://maps.google.com/maps?q=Vidhya+Villa,+152/9,+Solani+Puram+(West),+Near+IIT+Roorkee,+Roorkee,+District+Haridwar,+Uttarakhand,+India+247667&t=&z=15&ie=UTF8&iwloc=&output=embed"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Shipping & Delivery */}
      {type === 'shipping' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              Prompt & Secure
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              Shipping & Delivery Policy
            </h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#D4AF37] flex items-center gap-3">
              <Truck className="w-6 h-6 text-[#802336] flex-shrink-0" />
              <div>
                <h4 className="font-serif text-base font-bold text-[#0F4C4A]">
                  INSURED EXPRESS SHIPPING ACROSS INDIA
                </h4>
                <p className="text-xs text-gray-600">
                  Every order is dispatched with 100% insured, tamper-proof luxury packaging and express door-to-door courier tracking across all Indian pin codes.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">Dispatch & Transit Timelines</h3>
              <p>
                All orders are dispatched directly from our Roorkee atelier (Vidhya Villa, 152/9, Solani Puram West, Near IIT Roorkee, Roorkee, District Haridwar, Uttarakhand 247667) within 24 to 48 hours of verified UPI payment confirmation. We partner exclusively with premier express courier networks including <strong>BlueDart Express, Delhivery, DTDC, and Speed Post</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 pl-2">
                <li><strong>Metro Cities (Mumbai, Delhi NCR, Bangalore, Kolkata, Hyderabad, Chennai):</strong> 2 to 3 business days.</li>
                <li><strong>Tier 2 & 3 Cities across India:</strong> 3 to 5 business days.</li>
                <li><strong>North-East & Remote Regions:</strong> 5 to 7 business days.</li>
              </ul>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-100">
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">Tamper-Proof Luxury Packaging</h3>
              <p>
                Every jewel is encased in a custom velvet-cushioned jewellery box, sealed with high-security tamper-evident security tape to ensure your order arrives in pristine condition.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Returns & Exchange */}
      {type === 'returns' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              Peace of Mind
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              7-Day Returns & Exchange Policy
            </h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-10 shadow-sm space-y-5 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              At VIDHYAA Jewellery Studio, your delight is our greatest jewel. If for any reason your selected piece does not exceed your expectations, we offer a hassle-free <strong>7-Day Easy Return & Exchange policy</strong> from the day of delivery.
            </p>
            <div className="space-y-2">
              <h4 className="font-serif text-base font-bold text-[#3B1E22]">Eligibility Criteria:</h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 pl-2">
                <li>Item must be in its original, unworn condition with tags attached.</li>
                <li>Accompanied by the original VIDHYAA box and certificate card.</li>
                <li>To initiate a return, email us at <strong>care@vidhyaajewellery.com</strong> or WhatsApp our support with your Order Number.</li>
              </ul>
            </div>
            <p className="text-xs text-gray-600 pt-2 border-t">
              Refunds are processed back directly to the patron's originating UPI ID or bank account within 48 hours of quality inspection.
            </p>
          </div>
        </div>
      )}

      {/* 5. Jewellery Care Guide */}
      {type === 'care' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              Preserve The Radiance
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              Jewellery Care Guide
            </h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
              <h4 className="font-serif text-base font-bold text-[#3B1E22] mb-1">
                The Golden Rule: "Last On, First Off"
              </h4>
              <p className="text-xs text-gray-600">
                Always put your jewellery on <em>after</em> putting on perfume, makeup, hairspray, and lotions. Take your jewellery off first before stepping into the shower or going to sleep.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-gray-100 bg-[#FAF7F2]/50 space-y-2">
                <h4 className="font-serif text-sm font-bold text-[#802336]">92.5 Sterling Silver Care</h4>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  <li>Store in airtight ziplock bags away from open humidity.</li>
                  <li>Wipe with our specialized anti-tarnish polishing cloth.</li>
                  <li>Regular wear actually prevents silver from oxidising!</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl border border-gray-100 bg-[#FAF7F2]/50 space-y-2">
                <h4 className="font-serif text-sm font-bold text-[#802336]">Gold Imitation & Kundan Care</h4>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  <li>Never submerge Kundan in water or ultrasonic baths.</li>
                  <li>Clean gently with a soft microfibre cloth.</li>
                  <li>Store flat in velvet pouches to prevent scratches.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Privacy & Terms */}
      {(type === 'privacy' || type === 'terms') && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold tracking-[0.25em] text-[#802336] uppercase">
              Legal & Trust
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#241C1A]">
              {type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
            </h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DCCF] p-8 sm:p-10 shadow-sm space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              VIDHYAA Jewellery Studio is committed to safeguarding patron privacy. All patron data, including delivery coordinates, transaction references, and contact records, are encrypted and never disclosed to unauthorized third parties.
            </p>
            <p>
              All online payments are conducted via verified UPI gateways. We never ask for or store UPI PINs, passwords, or bank credentials.
            </p>
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <button
          onClick={onNavigateShop}
          className="bg-[#3B2F2A] hover:bg-[#4D3E37] active:bg-[#2E2420] text-[#FAF7F2] border border-[#3B2F2A] px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md"
        >
          Explore VIDHYAA Collections
        </button>
      </div>
    </div>
  );
};
