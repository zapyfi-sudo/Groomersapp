export interface CountryInfo {
  code: string;
  name: string;
  callingCode: string;
  defaultCurrency: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'AR', name: 'Argentina', callingCode: '+54', defaultCurrency: 'ARS' },
  { code: 'BO', name: 'Bolivia', callingCode: '+591', defaultCurrency: 'BOB' },
  { code: 'BR', name: 'Brasil', callingCode: '+55', defaultCurrency: 'BRL' },
  { code: 'CA', name: 'Canadá', callingCode: '+1', defaultCurrency: 'CAD' },
  { code: 'CL', name: 'Chile', callingCode: '+56', defaultCurrency: 'CLP' },
  { code: 'CO', name: 'Colombia', callingCode: '+57', defaultCurrency: 'COP' },
  { code: 'CR', name: 'Costa Rica', callingCode: '+506', defaultCurrency: 'CRC' },
  { code: 'CU', name: 'Cuba', callingCode: '+53', defaultCurrency: 'CUP' },
  { code: 'EC', name: 'Ecuador', callingCode: '+593', defaultCurrency: 'USD' },
  { code: 'ES', name: 'España', callingCode: '+34', defaultCurrency: 'EUR' },
  { code: 'US', name: 'Estados Unidos', callingCode: '+1', defaultCurrency: 'USD' },
  { code: 'GT', name: 'Guatemala', callingCode: '+502', defaultCurrency: 'GTQ' },
  { code: 'HN', name: 'Honduras', callingCode: '+504', defaultCurrency: 'HNL' },
  { code: 'MX', name: 'México', callingCode: '+52', defaultCurrency: 'MXN' },
  { code: 'NI', name: 'Nicaragua', callingCode: '+505', defaultCurrency: 'NIO' },
  { code: 'PA', name: 'Panamá', callingCode: '+507', defaultCurrency: 'USD' },
  { code: 'PY', name: 'Paraguay', callingCode: '+595', defaultCurrency: 'PYG' },
  { code: 'PE', name: 'Perú', callingCode: '+51', defaultCurrency: 'PEN' },
  { code: 'PR', name: 'Puerto Rico', callingCode: '+1', defaultCurrency: 'USD' },
  { code: 'DO', name: 'República Dominicana', callingCode: '+1', defaultCurrency: 'DOP' },
  { code: 'SV', name: 'El Salvador', callingCode: '+503', defaultCurrency: 'USD' },
  { code: 'UY', name: 'Uruguay', callingCode: '+598', defaultCurrency: 'UYU' },
  { code: 'VE', name: 'Venezuela', callingCode: '+58', defaultCurrency: 'USD' }
];

export const CURRENCIES = [
  { code: 'ARS', symbol: '$', name: 'Peso Argentino (ARS)' },
  { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano (MXN)' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano (COP)' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno (CLP)' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano (PEN)' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileño (BRL)' },
  { code: 'UYU', symbol: '$', name: 'Peso Uruguayo (UYU)' },
  { code: 'CAD', symbol: '$', name: 'Dólar Canadiense (CAD)' }
];
