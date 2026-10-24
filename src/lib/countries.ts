import { CountryCode, parsePhoneNumberFromString, getCountryCallingCode } from 'libphonenumber-js';

export interface CountryData {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  placeholder?: string;
  priority?: number;
}

/**
 * Curated list of popular and worldwide countries with flags, dial codes and names
 */
export const POPULAR_COUNTRIES: CountryData[] = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', placeholder: '98765 43210', priority: 1 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', placeholder: '(415) 555-2671', priority: 2 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456', priority: 3 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '(416) 555-0199', priority: 4 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', placeholder: '412 345 678', priority: 5 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567', priority: 6 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', placeholder: '8123 4567', priority: 7 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', placeholder: '12-345 6789', priority: 8 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567', priority: 9 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', placeholder: '3312 3456', priority: 10 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', placeholder: '5123 4567', priority: 11 },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', placeholder: '9123 4567', priority: 12 },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', placeholder: '3612 3456', priority: 13 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', placeholder: '21 123 4567', priority: 14 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', placeholder: '151 12345678', priority: 15 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', priority: 16 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789', priority: 17 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678', priority: 18 },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', placeholder: '78 123 45 67', priority: 19 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', placeholder: '71 123 4567', priority: 20 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', placeholder: '90 1234 5678', priority: 21 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', placeholder: '5123 4567', priority: 22 },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', placeholder: '81 234 5678', priority: 23 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', placeholder: '812-3456-7890', priority: 24 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', placeholder: '917 123 4567', priority: 25 },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', placeholder: '984 1234567', priority: 26 },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', placeholder: '71 234 5678', priority: 27 },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', placeholder: '1712-345678', priority: 28 },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', placeholder: '85 123 4567', priority: 29 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78', priority: 30 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', placeholder: '70 123 45 67', priority: 31 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', placeholder: '412 34 567', priority: 32 },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', placeholder: '20 12 34 56', priority: 33 },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', placeholder: '41 2345678', priority: 34 },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', placeholder: '470 12 34 56', priority: 35 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', placeholder: '664 1234567', priority: 36 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', placeholder: '912 345 678', priority: 37 },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', placeholder: '691 234 5678', priority: 38 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', placeholder: '532 123 45 67', priority: 39 },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', placeholder: '100 123 4567', priority: 40 },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', placeholder: '50-123-4567', priority: 41 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234-5678', priority: 42 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', placeholder: '55 1234 5678', priority: 43 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', placeholder: '10-1234-5678', priority: 44 },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', placeholder: '91 234 56 78', priority: 45 },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', placeholder: '712 345678', priority: 46 },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', placeholder: '802 123 4567', priority: 47 },
  { code: 'MU', name: 'Mauritius', dialCode: '+230', flag: '🇲🇺', placeholder: '5123 4567', priority: 48 },
  { code: 'FJ', name: 'Fiji', dialCode: '+679', flag: '🇫🇯', placeholder: '701 2345', priority: 49 },
  { code: 'TT', name: 'Trinidad and Tobago', dialCode: '+1', flag: '🇹🇹', placeholder: '(868) 291-1234', priority: 50 }
];

export const ALL_COUNTRIES: CountryData[] = [...POPULAR_COUNTRIES].sort((a, b) => {
  if (a.priority && b.priority) return a.priority - b.priority;
  if (a.priority) return -1;
  if (b.priority) return 1;
  return a.name.localeCompare(b.name);
});

export const DEFAULT_COUNTRY = ALL_COUNTRIES[0]; // India

/**
 * Find country by ISO code
 */
export function getCountryByCode(code: string): CountryData {
  const match = ALL_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  return match || DEFAULT_COUNTRY;
}

/**
 * Validates international phone number using libphonenumber-js
 */
export function validateInternationalPhone(
  rawInput: string,
  countryCode: CountryCode = 'IN'
): {
  isValid: boolean;
  isPossible: boolean;
  e164: string;
  formattedInternational: string;
  formattedNational: string;
  country: CountryCode;
  error?: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      isPossible: false,
      e164: '',
      formattedInternational: '',
      formattedNational: '',
      country: countryCode,
      error: 'Please enter a mobile phone number.'
    };
  }

  try {
    // If the user already typed a leading +, parse without default country
    const parsed = trimmed.startsWith('+')
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, countryCode);

    if (!parsed) {
      return {
        isValid: false,
        isPossible: false,
        e164: '',
        formattedInternational: '',
        formattedNational: '',
        country: countryCode,
        error: `Please enter a valid phone number for ${getCountryByCode(countryCode).name}.`
      };
    }

    const isValid = parsed.isValid();
    const isPossible = parsed.isPossible();
    const e164 = parsed.format('E.164');
    const formattedInternational = parsed.formatInternational();
    const formattedNational = parsed.formatNational();
    const detectedCountry = parsed.country || countryCode;

    if (!isValid) {
      return {
        isValid: false,
        isPossible,
        e164,
        formattedInternational,
        formattedNational,
        country: detectedCountry,
        error: isPossible
          ? `The number length is valid, but the mobile prefix is unrecognized in ${getCountryByCode(detectedCountry).name}.`
          : `Invalid phone number format for ${getCountryByCode(detectedCountry).name}.`
      };
    }

    return {
      isValid: true,
      isPossible: true,
      e164,
      formattedInternational,
      formattedNational,
      country: detectedCountry
    };
  } catch (err: any) {
    return {
      isValid: false,
      isPossible: false,
      e164: '',
      formattedInternational: '',
      formattedNational: '',
      country: countryCode,
      error: err?.message || 'Could not parse phone number.'
    };
  }
}

/**
 * Mask an international phone number for safe display in UI
 * e.g. +919876543210 -> +91 98•••••210
 * e.g. +14155552671 -> +1 (415) •••-2671
 */
export function maskPhoneNumber(e164: string): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) {
    return e164.length > 6 ? `${e164.slice(0, 3)}••••${e164.slice(-2)}` : e164;
  }
  const intl = parsed.formatInternational();
  const parts = intl.split(' ');
  if (parts.length <= 2) {
    return `${parts[0]} ••••••${intl.slice(-3)}`;
  }
  // Keep country code and first part, mask the middle, show last 2 digits
  const countryPrefix = parts[0];
  const lastDigits = intl.slice(-3);
  return `${countryPrefix} ${parts[1]?.slice(0, 2) || ''}•••••${lastDigits}`;
}
