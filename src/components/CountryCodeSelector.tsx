import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, Globe } from 'lucide-react';
import { CountryData, ALL_COUNTRIES, POPULAR_COUNTRIES } from '../lib/countries';

interface CountryCodeSelectorProps {
  selectedCountry: CountryData;
  onSelectCountry: (country: CountryData) => void;
  disabled?: boolean;
  className?: string;
}

export const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({
  selectedCountry,
  onSelectCountry,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter countries by query (name, dial code, or country code)
  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.dialCode.includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (country: CountryData) => {
    onSelectCountry(country);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="h-full flex items-center gap-1.5 px-3 py-2.5 bg-[#FAF7F2] hover:bg-[#F4EBE1] border border-[#E8DCCF] rounded-xl text-xs font-semibold text-[#3B1E22] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap active:scale-[0.98]"
        title={`Selected: ${selectedCountry.name} (${selectedCountry.dialCode})`}
        aria-label="Select Country Code"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
        <span className="font-mono text-xs font-bold text-gray-800">{selectedCountry.dialCode}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 max-h-96 bg-white rounded-2xl shadow-2xl border border-[#E8DCCF] z-50 overflow-hidden flex flex-col animate-fadeIn">
          {/* Search Header */}
          <div className="p-2.5 border-b border-[#E8DCCF] bg-[#FAF7F2]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code (+1, +44, India)..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8DCCF] focus:border-[#802336] focus:ring-1 focus:ring-[#802336] rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Country List */}
          <div className="overflow-y-auto max-h-72 p-1.5 space-y-0.5 divide-y divide-gray-50">
            {/* Quick Popular Picks header when no search */}
            {!searchQuery.trim() && (
              <div className="px-2.5 py-1 text-[10px] font-bold text-[#802336] uppercase tracking-wider bg-white sticky top-0 z-10">
                Popular Destinations
              </div>
            )}

            {filteredCountries.map((c) => {
              const isSelected = c.code === selectedCountry.code;
              return (
                <button
                  key={`${c.code}-${c.dialCode}`}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#802336]/10 text-[#802336] font-bold'
                      : 'hover:bg-[#FAF7F2] text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base select-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="font-mono text-[11px] font-semibold text-gray-500">
                      {c.dialCode}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#802336]" />}
                  </div>
                </button>
              );
            })}

            {filteredCountries.length === 0 && (
              <div className="p-6 text-center text-xs text-gray-500 space-y-1">
                <Globe className="w-6 h-6 text-gray-400 mx-auto" />
                <p>No matching countries found</p>
                <p className="text-[10px] text-gray-400">Try searching by dialing code like +91 or +1</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
