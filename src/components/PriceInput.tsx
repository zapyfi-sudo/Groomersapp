import React, { useState, useEffect } from 'react';
import { parsePrice } from '../utils/priceUtils';

export interface PriceInputProps {
  value: number;
  onChange: (val: number) => void;
  currency?: string;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Controlled numeric/decimal price input component.
 * Allows entering decimals smoothly (both '.' and ','), prevents browser step validation issues,
 * and eliminates race conditions where typing the decimal dot gets cleared.
 */
export const PriceInput: React.FC<PriceInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0.00',
  min = 0,
  max,
  id,
  name,
  required = false,
  disabled = false,
  autoFocus = false,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === 0 || value === undefined || value === null) return '0';
    return String(value);
  });

  // Keep internal string in sync when external value changes
  useEffect(() => {
    const currentParsed = parsePrice(displayValue);
    if (currentParsed !== value) {
      setDisplayValue(value === 0 ? '0' : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Filter out everything except digits, dots and commas
    const filtered = raw.replace(/[^0-9.,]/g, '');

    // Allow at most one decimal separator
    const separators = (filtered.match(/[.,]/g) || []).length;
    if (separators > 1) {
      return;
    }

    setDisplayValue(filtered);

    // If typing just '.' or ',' or empty, notify 0 without resetting display string
    if (filtered === '' || filtered === '.' || filtered === ',') {
      onChange(0);
      return;
    }

    const parsed = parsePrice(filtered);
    if (min !== undefined && parsed < min) {
      onChange(min);
    } else if (max !== undefined && parsed > max) {
      onChange(max);
    } else {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (displayValue === '' || displayValue === '.' || displayValue === ',') {
      setDisplayValue('0');
      onChange(0);
    } else {
      const parsed = parsePrice(displayValue);
      setDisplayValue(String(parsed));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};
