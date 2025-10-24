/**
 * Base Models - Common interfaces used across the application
 * Following Domain-Driven Design principles
 */

// Base Entity Interface
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Base Response Interface for API calls
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination Interface
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter Base Interface
export interface BaseFilter {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  isActive?: boolean;
}

// User Context Interface
export interface UserContext {
  id: string;
  email: string;
  role?: string;
  permissions?: string[];
}

// Toast/Alert Interface
export interface AlertConfig {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// Form State Interface
export interface FormState {
  loading: boolean;
  errors: { [key: string]: string };
  touched: { [key: string]: boolean };
}

// Export Options (for reports)
export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  includeHeaders: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}