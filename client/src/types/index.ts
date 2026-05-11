export type UserRole = 'marketing' | 'emulator' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  images: string[];
  category: string;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleReport {
  date: string;
  totalSales: number;
  totalOrders: number;
  products: {
    productId: string;
    quantity: number;
    revenue: number;
  }[];
}

export interface AuditEventDetails {
  field?: string;
  oldValue?: any;
  newValue?: any;
  count?: number;
  type?: string;
  success?: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string | null;
  action: string;
  resource: string;
  details: AuditEventDetails;
  ipAddress: string;
  userAgent: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
}