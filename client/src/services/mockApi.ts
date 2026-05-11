import { Product, SaleReport, AuditEvent, Alert } from '@/types';

// Mock products data
export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Nike Air Max 90',
    brand: 'NIKE',
    price: 120.00,
    description: 'Zapatillas clásicas con amortiguación Air',
    images: ['/images/nike-air-max-90.jpg'],
    category: 'Running',
    stock: 50,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-11-01')
  },
  {
    id: '2',
    name: 'Adidas Ultraboost 22',
    brand: 'ADIDAS',
    price: 180.00,
    description: 'Zapatillas de running con tecnología Boost',
    images: ['/images/adidas-ultraboost-22.jpg'],
    category: 'Running',
    stock: 30,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-10-15')
  },
  {
    id: '3',
    name: 'New Balance 574',
    brand: 'NEW BALANCE',
    price: 80.00,
    description: 'Zapatillas casual con estilo retro',
    images: ['/images/new-balance-574.jpg'],
    category: 'Casual',
    stock: 75,
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-09-20')
  }
];

// Mock sales reports
export const mockSaleReports: SaleReport[] = [
  {
    date: '2024-11-29',
    totalSales: 15420.50,
    totalOrders: 89,
    products: [
      { productId: '1', quantity: 15, revenue: 1800.00 },
      { productId: '2', quantity: 8, revenue: 1440.00 },
      { productId: '3', quantity: 22, revenue: 1760.00 }
    ]
  },
  {
    date: '2024-11-28',
    totalSales: 12890.75,
    totalOrders: 67,
    products: [
      { productId: '1', quantity: 12, revenue: 1440.00 },
      { productId: '2', quantity: 6, revenue: 1080.00 },
      { productId: '3', quantity: 18, revenue: 1440.00 }
    ]
  }
];

// Mock audit events
export const mockAuditEvents: AuditEvent[] = [
  {
    id: '1',
    timestamp: new Date('2024-11-29T10:30:00'),
    userId: 'user1',
    action: 'LOGIN',
    resource: 'auth',
    details: { success: true },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  {
    id: '2',
    timestamp: new Date('2024-11-29T11:15:00'),
    userId: 'user1',
    action: 'PRODUCT_UPDATE',
    resource: 'products/1',
    details: { field: 'price', oldValue: 110, newValue: 120 },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  {
    id: '3',
    timestamp: new Date('2024-11-29T14:20:00'),
    userId: 'user2',
    action: 'BULK_UPLOAD',
    resource: 'products',
    details: { count: 50, type: 'images' },
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0...'
  }
];

// Mock alerts
export const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'warning',
    message: 'Stock bajo en producto Nike Air Max 90',
    timestamp: new Date('2024-11-29T09:00:00'),
    resolved: false
  },
  {
    id: '2',
    type: 'error',
    message: 'Error en sincronización de inventario',
    timestamp: new Date('2024-11-29T08:30:00'),
    resolved: true
  },
  {
    id: '3',
    type: 'info',
    message: 'Nueva actualización de seguridad disponible',
    timestamp: new Date('2024-11-29T07:00:00'),
    resolved: false
  }
];

// Mock API functions
export const api = {
  getProducts: (): Promise<Product[]> => Promise.resolve(mockProducts),
  createProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> =>
    Promise.resolve({ ...product, id: Date.now().toString(), createdAt: new Date(), updatedAt: new Date() }),
  updateProduct: (id: string, updates: Partial<Product>): Promise<Product> =>
    Promise.resolve({ ...mockProducts[0], ...updates, updatedAt: new Date() }),
  deleteProduct: (id: string): Promise<void> => Promise.resolve(),

  getSaleReports: (): Promise<SaleReport[]> => Promise.resolve(mockSaleReports),
  getAuditEvents: (): Promise<AuditEvent[]> => Promise.resolve(mockAuditEvents),
  getAlerts: (): Promise<Alert[]> => Promise.resolve(mockAlerts),

  bulkUploadProducts: (file: File): Promise<{ success: number; errors: number }> =>
    Promise.resolve({ success: 45, errors: 5 }),

  triggerAlert: (alert: Omit<Alert, 'id' | 'timestamp'>): Promise<Alert> =>
    Promise.resolve({ ...alert, id: Date.now().toString(), timestamp: new Date() })
};