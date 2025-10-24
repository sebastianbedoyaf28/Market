/**
 * Application Configuration
 * Centralized configuration following 12-Factor App principles
 */

export const AppConfig = {
  // API Configuration
  api: {
    baseUrl: 'https://your-supabase-url.supabase.co',
    timeout: 30000,
    retries: 3,
  },

  // Supabase Configuration
  supabase: {
    url: 'https://your-supabase-url.supabase.co',
    anonKey: 'your-anon-key',
  },

  // Pagination Defaults
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
    pageSizeOptions: [10, 20, 50, 100],
  },

  // Business Rules
  business: {
    inventory: {
      lowStockThreshold: 10,
      criticalStockThreshold: 5,
    },
    sales: {
      maxDiscountPercentage: 50,
      defaultTaxRate: 0.19, // 19% IVA Colombia
    },
    reports: {
      maxExportRecords: 50000,
      defaultDateRange: 30, // days
    },
  },

  // UI Configuration
  ui: {
    theme: {
      primary: '#3880ff',
      secondary: '#0cd1e8',
      success: '#10dc60',
      warning: '#ffce00',
      danger: '#f04141',
    },
    animations: {
      enabled: true,
      duration: 300,
    },
    toasts: {
      defaultDuration: 3000,
      position: 'top' as const,
    },
  },

  // Feature Flags
  features: {
    realTimeUpdates: true,
    advancedReports: true,
    multiCurrency: false,
    barcodeScanning: true,
  },

  // Security
  security: {
    sessionTimeout: 3600000, // 1 hour in milliseconds
    maxLoginAttempts: 5,
    passwordMinLength: 8,
  },
} as const;

// Environment-specific overrides
export const getEnvironmentConfig = () => {
  const env = process.env['NODE_ENV'] || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...AppConfig,
        api: {
          ...AppConfig.api,
          baseUrl: process.env['PROD_API_URL'] || AppConfig.api.baseUrl,
        },
      };
    case 'staging':
      return {
        ...AppConfig,
        api: {
          ...AppConfig.api,
          baseUrl: process.env['STAGING_API_URL'] || AppConfig.api.baseUrl,
        },
      };
    default:
      return AppConfig;
  }
};