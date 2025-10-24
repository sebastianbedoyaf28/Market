/**
 * Common Utilities
 * Pure functions for common operations
 */

// Date Utilities
export class DateUtils {
  static formatDate(date: string | Date, locale = 'es-ES'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale);
  }

  static formatDateTime(date: string | Date, locale = 'es-ES'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(locale);
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static isToday(date: string | Date): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  static daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Number/Currency Utilities
export class NumberUtils {
  static formatCurrency(amount: number, currency = 'COP', locale = 'es-CO'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  static formatNumber(value: number, decimals = 0, locale = 'es-CO'): string {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  static parseNumber(value: string): number {
    return parseFloat(value.replace(/[^\d.-]/g, ''));
  }

  static roundTo(num: number, decimals: number): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

// String Utilities
export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }

  static truncate(str: string, length: number, suffix = '...'): string {
    return str.length > length ? str.substring(0, length) + suffix : str;
  }

  static removeAccents(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

// Validation Utilities
export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
    return phoneRegex.test(phone);
  }

  static isValidId(id: string): boolean {
    return !!id && id.trim().length > 0;
  }

  static isPositiveNumber(value: number): boolean {
    return !isNaN(value) && value > 0;
  }
}

// Array Utilities
export class ArrayUtils {
  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = (groups[item[key] as string] || []);
      group.push(item);
      groups[item[key] as string] = group;
      return groups;
    }, {} as Record<string, T[]>);
  }

  static sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

// Local Storage Utilities
export class StorageUtils {
  static setItem(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  }

  static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return defaultValue || null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  }
}