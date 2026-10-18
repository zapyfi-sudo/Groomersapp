/**
 * Centralized Price & Currency Formatting Utilities
 * Ensures consistent price entry, parsing, and display across the entire application.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  symbolSpacing?: boolean;
  hasDecimals: boolean;
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.';
  name: string;
}

export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    name: 'Dólar Estadounidense (USD)'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolPosition: 'suffix',
    symbolSpacing: true,
    hasDecimals: true,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Euro (EUR)'
  },
  MXN: {
    code: 'MXN',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    name: 'Peso Mexicano (MXN)'
  },
  ARS: {
    code: 'ARS',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Peso Argentino (ARS)'
  },
  COP: {
    code: 'COP',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: false,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Peso Colombiano (COP)'
  },
  CLP: {
    code: 'CLP',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: false,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Peso Chileno (CLP)'
  },
  PEN: {
    code: 'PEN',
    symbol: 'S/',
    symbolPosition: 'prefix',
    symbolSpacing: true,
    hasDecimals: true,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    name: 'Sol Peruano (PEN)'
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    symbolPosition: 'prefix',
    symbolSpacing: true,
    hasDecimals: true,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Real Brasileño (BRL)'
  },
  UYU: {
    code: 'UYU',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: ',',
    thousandsSeparator: '.',
    name: 'Peso Uruguayo (UYU)'
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    name: 'Dólar Canadiense (CAD)'
  }
};

/**
 * Returns currency configuration for a given code, defaulting to USD-like formatting if unknown.
 */
export function getCurrencyConfig(currencyCode?: string): CurrencyConfig {
  const code = (currencyCode || 'USD').toUpperCase().trim();
  if (CURRENCY_CONFIGS[code]) {
    return CURRENCY_CONFIGS[code];
  }
  return {
    code,
    symbol: '$',
    symbolPosition: 'prefix',
    hasDecimals: true,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    name: code
  };
}

export interface FormatPriceOptions {
  includeCode?: boolean;
  forceDecimals?: boolean;
  includeSymbol?: boolean;
}

/**
 * Robust price parser:
 * Recognizes whole and decimal numbers properly.
 * Supports both dot and comma decimal delimiters.
 * Ensures numbers are never mistakenly multiplied by 100 or 1000.
 */
export function parsePrice(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : input;
  }
  const str = String(input).trim();
  if (!str) return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  let cleaned = str;

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Format 1.250,50 -> 1250.50
      cleaned = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format 1,250.50 -> 1250.50
      cleaned = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Single delimiter comma: 25,50 -> 25.50
    cleaned = str.replace(',', '.');
  }

  // Remove currency signs, letters, spaces except digits, dot, and minus
  cleaned = cleaned.replace(/[^0-9.-]/g, '');

  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return Math.round(val * 100) / 100;
}

/**
 * Global price formatter respecting the configured business currency:
 * - USD: $25, $25.50, $100.50, $1.99
 * - EUR: 25 €, 25,50 €, 100,50 €
 * - CLP / COP: $25.000 (no unnecessary decimals for zero-decimal currencies)
 */
export function formatPrice(
  amount: number | string | null | undefined,
  currencyCode?: string,
  options: FormatPriceOptions = {}
): string {
  const numericAmount = parsePrice(amount);
  const cfg = getCurrencyConfig(currencyCode);
  const { includeCode = false, forceDecimals = false, includeSymbol = true } = options;

  let decimals = 0;
  if (cfg.hasDecimals) {
    const hasFraction = Math.abs(numericAmount % 1) > 0.0001;
    if (hasFraction || forceDecimals) {
      decimals = 2;
    }
  }

  // Split integer and fraction
  const fixedStr = numericAmount.toFixed(decimals);
  const parts = fixedStr.split('.');
  const integerPart = parts[0];
  const fractionalPart = parts[1];

  // Insert thousands separators
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, cfg.thousandsSeparator);

  let formattedNumber = formattedInteger;
  if (decimals > 0 && fractionalPart) {
    formattedNumber += cfg.decimalSeparator + fractionalPart;
  }

  let result = formattedNumber;

  if (includeSymbol) {
    if (cfg.symbolPosition === 'prefix') {
      const spacing = cfg.symbolSpacing ? ' ' : '';
      result = `${cfg.symbol}${spacing}${formattedNumber}`;
    } else {
      const spacing = cfg.symbolSpacing ? ' ' : '';
      result = `${formattedNumber}${spacing}${cfg.symbol}`;
    }
  }

  if (includeCode) {
    result = `${result} ${cfg.code}`;
  }

  return result;
}
