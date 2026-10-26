import React from 'react';
import { Sparkles, Gift } from 'lucide-react';
import { StoreSettings } from '../types';

interface ScrollingOfferBarProps {
  storeSettings?: StoreSettings;
  onOfferClick?: () => void;
}

export const ScrollingOfferBar: React.FC<ScrollingOfferBarProps> = ({
  storeSettings,
  onOfferClick
}) => {
  // If explicitly disabled in admin settings, do not show
  if (storeSettings?.scrollingOfferBarEnabled === false) {
    return null;
  }

  const tier1Amount = storeSettings?.offerTier1MinAmount ?? 1500;
  const tier1Gift = storeSettings?.offerTier1GiftName || 'GOLD IMITATION JHOOMKI';
  const tier2Amount = storeSettings?.offerTier2MinAmount ?? 2000;
  const tier2Gift = storeSettings?.offerTier2GiftName || 'GOLD IMITATION BANGLES';

  const defaultMessages = [
    `SHOP ABOVE ₹${tier1Amount.toLocaleString('en-IN')} AND GET A ${tier1Gift.toUpperCase()} GIFT!`,
    `SHOP ABOVE ₹${tier2Amount.toLocaleString('en-IN')} AND GET ${tier2Gift.toUpperCase()} AS A GIFT!`
  ];

  const messagesToDisplay =
    storeSettings?.customOfferMessages && storeSettings.customOfferMessages.length > 0
      ? storeSettings.customOfferMessages
      : defaultMessages;

  // Render a repeated item set
  const renderMessageSet = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex items-center shrink-0">
      {messagesToDisplay.map((msg, index) => (
        <div key={`${keyPrefix}-${index}`} className="flex items-center">
          <div className="flex items-center gap-2 px-6 sm:px-10">
            <span className="text-[#DFB982] text-xs sm:text-sm select-none animate-pulse">✦</span>
            <Gift className="w-3.5 h-3.5 text-[#DFB982] shrink-0" />
            <span className="text-white text-[11px] sm:text-xs font-bold tracking-[0.14em] uppercase whitespace-nowrap">
              {msg}
            </span>
          </div>
          <span className="text-white/30 text-xs select-none">|</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      role="region"
      aria-label="Promotional Offers"
      className="relative w-full overflow-hidden bg-[#174A3A] text-white border-b border-[#0f3529] py-2 sm:py-2.5 z-50 cursor-pointer select-none group transition-colors hover:bg-[#123e31]"
      onClick={onOfferClick}
      title="Exclusive Vidhyaa Jewellery Studio Gifts: Shop above ₹1,500 or ₹2,000 to qualify!"
    >
      {/* Ambient delicate glow line at top border */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#DFB982]/40 to-transparent pointer-events-none" />

      {/* Infinite seamless dual-track marquee (translateX 0% -> -50%) */}
      <div className="flex w-max animate-marquee-continuous group-hover:[animation-play-state:paused]">
        {/* Track 1 */}
        {renderMessageSet('set-a')}
        {renderMessageSet('set-b')}
        {renderMessageSet('set-c')}

        {/* Track 2 (Exact duplicate for gapless infinite seamless loop) */}
        {renderMessageSet('set-d')}
        {renderMessageSet('set-e')}
        {renderMessageSet('set-f')}
      </div>

      {/* Subtle edge fades for ultra-high-end editorial finish */}
      <div className="absolute inset-y-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-[#174A3A] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-[#174A3A] to-transparent pointer-events-none" />
    </div>
  );
};
