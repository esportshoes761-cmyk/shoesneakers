import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCartItemSchema, insertPromotionSchema, insertEventSchema, insertUserSchema, insertBrandSchema, insertCustomerSavingsSchema, auditEvents, auditActionCodes, auditDailyDigests, AuditActionCodes, type InsertAuditEvent } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import * as path from "path";
import { detectBrandFromImage, combineDetectionResults } from "./ai-vision";
import { detectBrandFromFilename, PENDING_REVIEW_BRAND, MIN_CONFIDENCE_THRESHOLD } from "./brand-detection";
import { db } from "./db";

// Helper functions
function generateUniqueReference(): string {
  // Caracteres seguros para nombres de archivo: letras, números y símbolos web-safe
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const randomValues = randomBytes(10); // Máximo 10 caracteres
  
  for (let i = 0; i < 10; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

// Generate unique reference ensuring no duplicates in database
async function generateUniqueReferenceForProduct(): Promise<string> {
  let reference: string;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops
  
  do {
    reference = generateUniqueReference();
    attempts++;
    
    // Check if reference already exists in database
    const existingProduct = await storage.getProductByReference(reference);
    if (!existingProduct) {
      return reference;
    }
  } while (attempts < maxAttempts);
  
  // If we couldn't generate a unique reference after max attempts, throw error
  throw new Error('No se pudo generar una referencia única después de múltiples intentos');
}

// 🛡️ REPLACED: Using new precise brand detection module
// This eliminates false positives and implements proper review queue
// 🚨 LEGACY FUNCTION REMOVED - Now using detectBrandFromFilename directly
// This ensures server is 100% authoritative with single source of truth

// 🔒 SECURE: Session-based admin authorization middleware
async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get user session from headers
    const userSession = req.headers['x-user-session'] as string;
    
    if (!userSession) {
      return res.status(401).json({ 
        message: "Sesión de usuario requerida",
        details: "Se requiere autenticación válida" 
      });
    }
    
    let userData;
    try {
      userData = JSON.parse(userSession);
    } catch {
      return res.status(401).json({ message: "Sesión de usuario inválida" });
    }
    
    // Verify user exists and is admin
    const user = await storage.getUserById(userData.id);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Acceso denegado: Se requieren permisos de administrador" });
    }
    
    // Store authenticated admin user for use in the route handler
    (req as any).adminUser = user;
    next();
  } catch (error) {
    console.error("Error in admin authentication:", error);
    res.status(500).json({ message: "Error en la autenticación de administrador" });
  }
}

// 🔒 SECURE: Session-based admin authorization for headers (same as body-based)
const requireAdminAuthHeaders = requireAdminAuth;

// 🔒 SECURE: Brand package schema for bulk creation (no credentials required)
const brandPackageSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  categoryId: z.string().min(1, "Category ID is required"),
  images: z.array(z.string()).min(1, "At least 1 image required"),
  sizeFrom: z.string().min(1, "Size from is required"),
  sizeTo: z.string().min(1, "Size to is required"),
});

// 🔒 SECURE: Duplicate detection validation schemas
const duplicateQuerySchema = z.object({
  by: z.enum(["reference", "name", "image"], {
    required_error: "Criteria is required",
    invalid_type_error: "Criteria must be 'reference', 'name', or 'image'"
  }),
  brandId: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
});

const mergeProductsSchema = z.object({
  primaryId: z.string().min(1, "Primary product ID is required"),
  duplicateIds: z.array(z.string()).min(1, "At least one duplicate ID is required"),
  strategy: z.enum(["keep_primary", "merge_data"], {
    required_error: "Merge strategy is required",
    invalid_type_error: "Strategy must be 'keep_primary' or 'merge_data'"
  })
});

const updateProductSchema = insertProductSchema.partial();

// 🔒 AUDIT MIDDLEWARE - Asynchronous logging system 
function truncateIp(ip: string): string {
  if (!ip) return '';
  // IPv4 truncation to /24 subnet for privacy
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  // IPv6 truncation to /48 subnet for privacy  
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:${parts[2]}::`;
  }
  return ip;
}

function hashUserAgent(userAgent: string): string {
  if (!userAgent) return '';
  // Simple hash for user agent (could use crypto.createHash for better security)
  return Buffer.from(userAgent).toString('base64').slice(0, 16);
}

function getActionCodeForRoute(method: string, path: string): number {
  // Map HTTP method + path to audit action codes
  const route = `${method} ${path}`;
  
  // Authentication routes (1xx)
  if (route.includes('/auth/login')) return AuditActionCodes.USER_LOGIN;
  if (route.includes('/auth/register')) return AuditActionCodes.USER_CREATE;
  if (route.includes('/auth/')) return AuditActionCodes.AUTH_FAILURE;
  
  // Product management (3xx)
  if (method === 'POST' && path.includes('/products')) return AuditActionCodes.PRODUCT_CREATE;
  if (method === 'PUT' && path.includes('/products')) return AuditActionCodes.PRODUCT_UPDATE;
  if (method === 'DELETE' && path.includes('/products')) return AuditActionCodes.PRODUCT_DELETE;
  if (method === 'GET' && path.includes('/products')) return AuditActionCodes.PRODUCT_VIEW;
  
  // Brand management (4xx)
  if (method === 'POST' && path.includes('/brands')) return AuditActionCodes.BRAND_CREATE;
  if (method === 'PUT' && path.includes('/brands')) return AuditActionCodes.BRAND_UPDATE;
  if (method === 'DELETE' && path.includes('/brands')) return AuditActionCodes.BRAND_DELETE;
  if (method === 'GET' && path.includes('/brands')) return AuditActionCodes.BRAND_VIEW;
  
  // Cart & Orders (5xx)
  if (method === 'POST' && path.includes('/cart')) return AuditActionCodes.CART_ADD;
  if (method === 'DELETE' && path.includes('/cart')) return AuditActionCodes.CART_REMOVE;
  if (method === 'POST' && path.includes('/orders')) return AuditActionCodes.ORDER_CREATE;
  if (method === 'PUT' && path.includes('/orders')) return AuditActionCodes.ORDER_UPDATE;
  
  // File operations (6xx)
  if (method === 'POST' && (path.includes('/upload') || path.includes('/images'))) {
    return 601; // FILE_UPLOAD
  }
  
  // Default to API_CALL for other API routes
  return 703; // API_CALL
}

async function auditLogger(req: Request, res: Response, next: NextFunction) {
  // Skip non-API routes and static files
  if (!req.path.startsWith('/api') || req.path.includes('/images/')) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Capture original res.json to get response data
  const originalJson = res.json;
  let responseData: any = null;
  
  res.json = function(body: any) {
    responseData = body;
    return originalJson.call(this, body);
  };
  
  res.on('finish', () => {
    // Async logging - don't block the response
    setImmediate(async () => {
      try {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Extract session info if available
        let actorType = 'anonymous';
        let actorId: string | null = null;
        let sessionId = 'no-session';
        
        const userSession = req.headers['x-user-session'] as string;
        if (userSession) {
          try {
            const userData = JSON.parse(userSession);
            actorId = userData.id;
            actorType = userData.isAdmin ? 'admin' : 'client';
            sessionId = `user-${actorId}`;
          } catch {
            actorType = 'anonymous';
          }
        }
        
        // Determine result based on status code
        let result = 'success';
        if (res.statusCode >= 400 && res.statusCode < 500) {
          result = 'denied';
        } else if (res.statusCode >= 500) {
          result = 'error';
        }
        
        // Get action code for this route
        const actionCode = getActionCodeForRoute(req.method, req.path);
        
        // Create audit event
        const auditEvent: InsertAuditEvent = {
          actorType,
          actorId,
          sessionId,
          ipTruncated: truncateIp(req.ip || req.connection.remoteAddress || ''),
          userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
          actionCode,
          resourceType: 'api',
          resourceId: req.path,
          result,
          latencyMs: latency,
          metadata: JSON.stringify({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            hasResponse: !!responseData,
            timestamp: endTime
          })
        };
        
        // Log asynchronously without blocking
        await storage.createAuditEvent(auditEvent);
      } catch (error) {
        // Silent fail for audit logging - don't affect the application
        console.error('Audit logging error:', error);
      }
    });
  });
  
  next();
}

// 🔒 SECURE: Bulk product update schema
const bulkUpdateProductsSchema = z.object({
  productIds: z.array(z.string()).min(1, "At least one product ID is required"),
  updates: updateProductSchema.refine(data => Object.keys(data).length > 0, {
    message: "At least one field to update is required"
  })
});

// 🔒 SECURE: Products by brand query schema
const productsByBrandQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20) // Limit max to 100
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Crear directorio para las imágenes si no existe
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.ensureDir(uploadsDir);
  
  // Límites de la aplicación
  const LIMITS = {
    MAX_PRODUCTS: 1000000,
    MAX_IMAGES: 1000000
  };

  // 🔍 AUDIT SYSTEM ENDPOINTS - REGISTERED FIRST TO AVOID VITE INTERFERENCE
  
  // Query recent audit events
  app.get("/api/audit/events", requireAdminAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const events = await db.select().from(auditEvents)
        .orderBy(sql`timestamp DESC`)
        .limit(limit)
        .offset(offset);
        
      const total = await db.select({ count: sql`count(*)` }).from(auditEvents);
      
      res.json({
        success: true,
        data: events,
        pagination: {
          total: total[0].count,
          limit,
          offset,
          hasMore: (offset + limit) < total[0].count
        }
      });
    } catch (error) {
      console.error('❌ Error fetching audit events:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching audit events',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get("/api/test-audit", async (req, res) => {
    try {
      console.log('🔍 Testing audit system...');
      
      // Check if audit tables exist and have data
      const actionCodes = await db.select().from(auditActionCodes).limit(5);
      const eventCount = await db.select().from(auditEvents);
      
      // Create a test audit event
      const testEvent = {
        actorType: 'system',
        actorId: 'test-api',
        sessionId: 'test-session-' + Date.now(),
        actionCode: 703, // API_CALL
        resourceType: 'system',
        resourceId: 'audit-test-api',
        result: 'success',
        metadata: { testRun: true, endpoint: '/api/test-audit', timestamp: new Date().toISOString() },
        hash: 'test-hash-' + Math.random().toString(36).substring(7)
      };
      
      const insertResult = await db.insert(auditEvents).values(testEvent).returning();
      
      res.json({
        success: true,
        message: 'Audit system test completed successfully!',
        data: {
          actionCodesCount: actionCodes.length,
          sampleActionCodes: actionCodes,
          totalEvents: eventCount.length,
          testEventCreated: insertResult[0]?.id,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Audit system test failed:', error);
      res.status(500).json({ 
        success: false,
        message: 'Audit system test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "El usuario ya existe" });
      }
      
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json({ message: "Usuario creado exitosamente", userId: user.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear usuario" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, isAdmin } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
      }
      
      const user = await storage.authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }
      
      // Verificar permisos de admin si es requerido
      if (isAdmin && !user.isAdmin) {
        return res.status(403).json({ message: "Acceso denegado: Se requieren permisos de administrador" });
      }
      
      // Usuario autenticado correctamente
      
      res.json({ 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          isSeller: user.isSeller,
          credits: user.credits,
          loyaltyLevel: user.loyaltyLevel
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  // Brand management routes (Admin only)
  app.post("/api/brands", requireAdminAuth, async (req, res) => {
    try {
      const brandData = insertBrandSchema.parse(req.body);
      const brand = await storage.createBrand(brandData);
      res.status(201).json(brand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid brand data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating brand" });
    }
  });

  app.put("/api/brands/:id", requireAdminAuth, async (req, res) => {
    try {
      const brandData = insertBrandSchema.parse(req.body);
      const brand = await storage.updateBrand(req.params.id, brandData);
      if (!brand) {
        return res.status(404).json({ message: "Brand not found" });
      }
      res.json(brand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid brand data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating brand" });
    }
  });

  app.delete("/api/brands/:id", requireAdminAuth, async (req, res) => {
    try {
      const success = await storage.deleteBrand(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Brand not found" });
      }
      res.json({ message: "Brand deleted successfully" });
    } catch (error) {
      console.error("Error deleting brand:", error);
      res.status(500).json({ message: "Error deleting brand" });
    }
  });

  // Ruta temporal removida después de uso exitoso

  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching categories" });
    }
  });


  // Brands routes
  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ message: "Error fetching brands" });
    }
  });

  app.get("/api/brands/with-products", async (req, res) => {
    try {
      const brandsWithProducts = await storage.getBrandsWithProducts();
      res.json(brandsWithProducts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching brands with products" });
    }
  });

  // Admin brands (STRICT: only brands with displayLocation 'admin')
  app.get("/api/brands/admin", async (req, res) => {
    try {
      const adminBrands = await storage.getBrandsByLocation('admin');
      res.json(adminBrands);
    } catch (error) {
      res.status(500).json({ message: "Error fetching admin brands" });
    }
  });

  // Client brands (STRICT: only brands with displayLocation 'client' AND with products)
  app.get("/api/brands/client", async (req, res) => {
    try {
      const clientBrandsWithProducts = await storage.getBrandsWithProductsByLocation('client');
      // Return only brand info (without products) to maintain compatibility
      const clientBrands = clientBrandsWithProducts.map(({ products, ...brand }) => brand);
      res.json(clientBrands);
    } catch (error) {
      res.status(500).json({ message: "Error fetching client brands" });
    }
  });

  // Admin brands with products - SIMPLE DIRECT VERSION
  app.get("/api/brands/admin/with-products", async (req, res) => {
    try {
      // ✅ DIRECT APPROACH: Get brands and calculate product count manually
      const allBrands = await storage.getBrands();
      const allProducts = await storage.getProducts();
      
      const brandsWithProducts = allBrands.map(brand => {
        const productCount = allProducts.filter(product => product.brandId === brand.id).length;
        return {
          ...brand,
          productCount,
          products: []
        };
      }).filter(brand => brand.productCount > 0);
      
      res.json(brandsWithProducts);
    } catch (error) {
      console.error('Error fetching admin brands:', error);
      res.status(500).json({ message: "Error fetching admin brands with products" });
    }
  });

  // Client brands with products - FIXED: Show all brands with products to clients  
  app.get("/api/brands/client/with-products", async (req, res) => {
    try {
      // ✅ CRITICAL FIX: Clients should see ALL brands that have products, not just displayLocation='client'
      const allBrandsWithProducts = await storage.getBrandsWithProducts();
      // Filter to only include brands that have products (productCount > 0)
      const brandsWithProductsFiltered = allBrandsWithProducts.filter(brand => (brand.productCount || 0) > 0);
      res.json(brandsWithProductsFiltered);
    } catch (error) {
      res.status(500).json({ message: "Error fetching client brands with products" });
    }
  });

  // Cleanup orphaned brands (Admin only) - Remove brands without products
  app.delete("/api/brands/cleanup-orphans", requireAdminAuth, async (req, res) => {
    try {
      const allBrands = await storage.getBrands();
      const brandsToDelete = [];
      let deletedCount = 0;

      for (const brand of allBrands) {
        const products = await storage.getProductsByBrand(brand.id);
        if (products.length === 0) {
          const success = await storage.deleteBrand(brand.id);
          if (success) {
            brandsToDelete.push({
              id: brand.id,
              name: brand.name,
              displayLocation: brand.displayLocation
            });
            deletedCount++;
          }
        }
      }

      res.json({
        message: `Cleanup completed: ${deletedCount} orphaned brands removed`,
        deletedBrands: brandsToDelete,
        deletedCount
      });
    } catch (error) {
      console.error("Error during brand cleanup:", error);
      res.status(500).json({ message: "Error during brand cleanup" });
    }
  });

  // Product details with reviews
  app.get("/api/products/:id/details", async (req, res) => {
    try {
      const productWithReviews = await storage.getProductWithReviews(req.params.id);
      if (!productWithReviews) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(productWithReviews);
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ message: "Error fetching product details" });
    }
  });

  // Reviews endpoints
  app.post("/api/reviews", async (req, res) => {
    try {
      const review = await storage.createReview(req.body);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Error creating review" });
    }
  });

  app.get("/api/products/:productId/reviews", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.productId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Error fetching reviews" });
    }
  });

  // Orders endpoints  
  app.post("/api/orders", async (req, res) => {
    try {
      const order = await storage.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Error creating order" });
    }
  });

  app.get("/api/orders/customer/:customerId/product/:productId", async (req, res) => {
    try {
      const orders = await storage.getCustomerOrdersForProduct(
        req.params.customerId, 
        req.params.productId
      );
      res.json(orders);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ message: "Error fetching customer orders" });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Error updating order status" });
    }
  });

  app.get("/api/brands/:id", async (req, res) => {
    try {
      const brand = await storage.getBrand(req.params.id);
      if (!brand) {
        return res.status(404).json({ message: "Brand not found" });
      }
      res.json(brand);
    } catch (error) {
      res.status(500).json({ message: "Error fetching brand" });
    }
  });

  // Bulk product creation endpoint - NO AUTH REQUIRED FOR IMMEDIATE PUBLISHING
  // 🔍 DUPLICATE DETECTION: Check for duplicates before bulk creation
  app.post("/api/products/check-package-duplicates", async (req, res) => {
    try {
      // Validate request body
      const { imageUrls } = req.body;
      
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ message: "Se requiere un array de URLs de imágenes" });
      }

      // Check for duplicate products using the new storage method
      const duplicates = await storage.checkPackageDuplicates(imageUrls);
      
      res.json({
        duplicates,
        hasDuplicates: duplicates.length > 0,
        totalDuplicates: duplicates.length,
        checkedImages: imageUrls.length
      });
    } catch (error) {
      console.error("Error checking package duplicates:", error);
      res.status(500).json({ message: "Error al verificar productos duplicados" });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    try {
      const packageData = brandPackageSchema.parse(req.body);
      
      // Get brand information for product names
      const brand = await storage.getBrand(packageData.brandId);
      if (!brand) {
        return res.status(404).json({ message: "Marca no encontrada" });
      }
      
      const results = { success: 0, failed: 0, errors: [] as string[] };
      const createdProducts = [];
      
      // ⚡ AUTO-GENERATE DEFAULTS FOR ULTRA-FAST PUBLISHING ⚡
      const DEFAULT_PRICE = "89000"; // $89,000 COP - editable later in admin
      const AUTO_DESCRIPTION = "Producto de calidad premium con estilo único y comodidad excepcional.";
      
      // Generate size range array
      const sizeFrom = parseInt(packageData.sizeFrom);
      const sizeTo = parseInt(packageData.sizeTo);
      const sizeRange: string[] = [];
      
      if (sizeFrom <= sizeTo) {
        for (let size = sizeFrom; size <= sizeTo; size++) {
          sizeRange.push(size.toString());
        }
      } else {
        // If size from is greater than size to, reverse the range
        for (let size = sizeFrom; size >= sizeTo; size--) {
          sizeRange.push(size.toString());
        }
      }
      
      // Create products for each image with size range
      for (let i = 0; i < packageData.images.length; i++) {
        try {
          // Generate unique reference for this product
          const reference = await generateUniqueReferenceForProduct();
          
          // Create size range string for product name
          const sizeRangeString = sizeRange.length > 1 
            ? `${sizeRange[0]} a ${sizeRange[sizeRange.length - 1]}`
            : sizeRange[0];
          
          const productData = {
            name: `${brand.name} Tallas ${sizeRangeString}`, // Include size range in name
            nameNormalized: `${brand.name} Tallas ${sizeRangeString}`.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
            description: AUTO_DESCRIPTION, // ✅ Auto-generated description
            price: DEFAULT_PRICE, // ✅ Default price - editable later
            imageUrl: packageData.images[i],
            reference: reference,
            categoryId: packageData.categoryId,
            brandId: packageData.brandId,
            isFlashSale: false, // Not flash sale by default
            isFeatured: true, // ✅ ALWAYS FEATURED - appears on homepage
            images: [packageData.images[i]], // Single image per product
            sizes: sizeRange, // ✅ Full size range array
            colors: [],
          };
          
          const product = await storage.createProduct(productData);
          createdProducts.push(product);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Imagen ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      }
      
      res.status(201).json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos del paquete inválidos", errors: error.errors });
      }
      console.error("Error creating bulk products:", error);
      res.status(500).json({ message: "Error al crear paquete de productos" });
    }
  });

  // 🚀 NEW INTELLIGENT UPLOAD: Simple, robust system based on proven MultiImageUploader logic  
  // ✅ NO File reference issues - Works with successfully uploaded image URLs only
  // ✅ Server-side brand detection using proven brand-detection.ts
  // ✅ Simple interface: just send array of uploaded image URLs
  // 🔒 SECURE: Zod validation schema for intelligent upload payload
  const intelligentUploadSchema = z.object({
    imageUrls: z.array(z.string().url()).min(1, "Se requiere al menos una URL de imagen"),
    defaultCategoryId: z.string().min(1, "Se requiere un ID de categoría válido"),
    defaultPrice: z.number().positive().optional()
  });

  app.post("/api/products/intelligent-upload", requireAdminAuth, async (req, res) => {
    try {
      // 🛡️ Zod validation: Validate request payload
      const validatedData = intelligentUploadSchema.parse(req.body);
      const { imageUrls, defaultCategoryId, defaultPrice } = validatedData;
      
      console.log("🚀 [NEW] Processing intelligent upload with", imageUrls.length, "successfully uploaded images");
      
      const results: { imageUrl: string; status: 'created' | 'failed'; productId?: string; reason?: string }[] = [];
      let created = 0;
      let pendingReview = 0;
      
      // 🎯 Auto-generated defaults for intelligent upload
      const DEFAULT_PRICE = defaultPrice ? defaultPrice.toString() : "85000"; // $85,000 COP - competitive pricing
      const DEFAULT_CATEGORY_ID = defaultCategoryId;
      
      // 🗂️ Get all brands to match detected brand names
      const allBrands = await storage.getBrands();
      const brandMap = new Map(allBrands.map(b => [b.name.toLowerCase(), b]));
      
      // 🔧 Process each successfully uploaded image URL
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        try {
          // 🏷️ STEP 1: Extract filename from URL for brand detection
          let fileName = 'unknown';
          try {
            // Handle both object storage URLs and local URLs
            const urlObj = new URL(imageUrl);
            fileName = urlObj.pathname.split('/').pop() || 'unknown';
            // Remove any query parameters or extensions for cleaner detection
            fileName = fileName.split('?')[0];
            console.log(`🔍 Extracted filename from URL: ${imageUrl} → ${fileName}`);
          } catch (urlError) {
            console.warn(`⚠️  Could not extract filename from URL: ${imageUrl}, using fallback`);
            fileName = `image_${i}`;
          }
          
          // 🤖 STEP 2: Server-side brand detection using proven brand-detection.ts
          const brandDetection = detectBrandFromFilename(fileName);
          console.log(`🔍 Brand detection result for ${fileName}:`, {
            brand: brandDetection.brandName,
            confidence: brandDetection.confidence,
            reasoning: brandDetection.reasoning,
            requiresReview: brandDetection.requiresReview
          });
          
          // 🏪 STEP 3: Match detected brand to database brands
          let brandId: string | null = null;
          let productName = "Zapato Deportivo"; // Default name
          
          if (brandDetection.brandName && 
              brandDetection.brandName !== PENDING_REVIEW_BRAND && 
              brandDetection.confidence >= MIN_CONFIDENCE_THRESHOLD) {
            
            // Find matching brand in database
            const matchingBrand = brandMap.get(brandDetection.brandName.toLowerCase());
            if (matchingBrand) {
              brandId = matchingBrand.id;
              productName = matchingBrand.name; // Product name = Brand name
              console.log(`✅ Brand matched: ${fileName} → ${matchingBrand.name} (confidence: ${brandDetection.confidence})`);
            } else {
              console.log(`❌ Brand detected but not found in database: ${brandDetection.brandName} for ${fileName}`);
            }
          } else {
            console.log(`⚠️  Low confidence or pending review for ${fileName} (confidence: ${brandDetection.confidence})`);
          }
          
          // 🛡️ STEP 4: Ensure fallback brand exists for unmatched items
          if (!brandId) {
            // Find or create fallback brand "CATÁLOGO GENERAL"
            let fallbackBrand = brandMap.get("catálogo general");
            if (!fallbackBrand) {
              console.log("🔧 Creating fallback brand: CATÁLOGO GENERAL");
              fallbackBrand = await storage.createBrand({
                name: "CATÁLOGO GENERAL",
                logo: "https://via.placeholder.com/100x50/007acc/ffffff?text=CATALOGO",
                description: "Productos sin marca específica detectada - Catálogo general",
                catalogUrl: null,
                displayLocation: "admin",
                isActive: true
              });
              // Update brandMap for future iterations
              brandMap.set("catálogo general", fallbackBrand);
            }
            brandId = fallbackBrand.id;
            productName = `Calzado ${fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, ' ').trim()}`;
            console.log(`🔧 Using fallback brand for ${fileName} → CATÁLOGO GENERAL`);
          }
          
          // 🏗️ STEP 5: Generate unique reference and create product
          const reference = await generateUniqueReferenceForProduct();
          
          // Generate auto-description based on brand detection
          let autoDescription = "Producto deportivo de calidad premium con estilo único y comodidad excepcional.";
          if (brandDetection.brandName && brandDetection.brandName !== PENDING_REVIEW_BRAND) {
            autoDescription = `Producto ${brandDetection.brandName} de alta calidad con diseño moderno y máximo confort. ${brandDetection.reasoning}`;
          }
          
          const productData = {
            name: productName,
            nameNormalized: productName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
            description: autoDescription,
            price: DEFAULT_PRICE,
            imageUrl: imageUrl, // Use successfully uploaded URL
            reference: reference,
            categoryId: DEFAULT_CATEGORY_ID,
            brandId: brandId,
            isFlashSale: false,
            isFeatured: true, // Always featured for maximum visibility
            images: [imageUrl], // Single image per product
            sizes: ["38", "39", "40", "41", "42", "43"], // Standard size range
            colors: [],
          };
          
          // 🚀 Create product in database
          const product = await storage.createProduct(productData);
          
          // Check if this is a pending review case
          const isPendingReview = brandDetection.requiresReview || 
                                  brandDetection.brandName === PENDING_REVIEW_BRAND ||
                                  brandDetection.confidence < MIN_CONFIDENCE_THRESHOLD;
          
          if (isPendingReview) {
            pendingReview++;
          } else {
            created++;
          }
          
          results.push({
            imageUrl,
            status: 'created',
            productId: product.id,
            reason: isPendingReview ? `Baja confianza (${brandDetection.confidence.toFixed(2)}) - Requiere revisión manual` : `Producto creado exitosamente: ${product.name}`
          });
          
          console.log(`🎉 SUCCESS: Product created ${product.name} (${product.reference}) from URL: ${imageUrl}`);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          results.push({
            imageUrl,
            status: 'failed',
            reason: errorMessage
          });
          console.error(`❌ FAILED to process image URL ${imageUrl}:`, error);
        }
      }
      
      // 📊 Report final results
      const totalSuccessful = created + pendingReview;
      const totalFailed = results.filter(r => r.status === 'failed').length;
      console.log(`🎯 [NEW] Intelligent upload completed: ${totalSuccessful} products created (${created} auto-assigned, ${pendingReview} pending review), ${totalFailed} failed`);
      
      // Return response in the exact format specified in requirements
      const response = {
        created,
        pendingReview, 
        results
      };
      
      res.status(201).json(response);
      
    } catch (error) {
      // Handle Zod validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: error.errors 
        });
      }
      
      console.error("💥 [NEW] Error in intelligent upload:", error);
      res.status(500).json({ 
        message: "Error en la carga inteligente", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // 🧹 CLEANUP: Detect and clean malformed URLs (blob: and devblob:)
  app.get("/api/products/malformed-urls", requireAdminAuth, async (req, res) => {
    try {
      console.log("🔍 [CLEANUP] Scanning for products with malformed URLs...");
      
      const allProducts = await storage.getProducts();
      const malformedProducts = allProducts.filter(product => {
        const hasBlob = product.imageUrl?.startsWith('blob:') || product.imageUrl?.includes('devblob:');
        const hasMalformedImages = product.images?.some(img => 
          img.startsWith('blob:') || img.includes('devblob:')
        );
        return hasBlob || hasMalformedImages;
      });
      
      console.log(`🔍 [CLEANUP] Found ${malformedProducts.length} products with malformed URLs`);
      
      res.json({
        total: allProducts.length,
        malformed: malformedProducts.length,
        products: malformedProducts.map(p => ({
          id: p.id,
          name: p.name,
          reference: p.reference,
          imageUrl: p.imageUrl,
          images: p.images,
          brandId: p.brandId || 'Sin marca'
        }))
      });
    } catch (error) {
      console.error("💥 [CLEANUP] Error detecting malformed URLs:", error);
      res.status(500).json({ 
        message: "Error al detectar URLs malformadas", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // 💰 BULK PRICE ADJUSTMENT: Schema for validation
  const bulkPriceAdjustmentSchema = z.object({
    productIds: z.array(z.string()).min(1, "Se requiere al menos un ID de producto"),
    type: z.enum(["percentage", "fixed", "set"]),
    value: z.number().positive("El valor debe ser positivo"),
    operation: z.enum(["increase", "decrease"]).optional(),
    applyTo: z.enum(["price", "originalPrice", "both"]).default("price")
  }).refine((data) => {
    // Operation is required for percentage and fixed, but not for set
    if (data.type === "set") {
      return true;
    }
    return data.operation !== undefined;
  }, {
    message: "La operación es requerida para ajustes de porcentaje y fijo",
    path: ["operation"]
  });

  // 💰 BULK PRICE ADJUSTMENT: Endpoint for bulk price adjustments
  app.post("/api/products/bulk-adjust-prices", requireAdminAuth, async (req, res) => {
    try {
      // Validate request with Zod
      const validatedData = bulkPriceAdjustmentSchema.parse(req.body);
      const { productIds, type, value, operation, applyTo } = validatedData;

      // Perform bulk price adjustment
      const result = await storage.bulkAdjustProductPrices(productIds, type, value, operation, applyTo);

      res.json({
        message: `${result.updated} productos actualizados exitosamente`,
        updated: result.updated,
        errors: result.errors
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Datos de entrada inválidos",
          errors: error.errors
        });
      }
      
      console.error("Error in bulk price adjustment:", error);
      res.status(500).json({ message: "Error al ajustar precios masivamente" });
    }
  });

  // 🧹 CLEANUP: Clean malformed URLs by removing affected products
  app.post("/api/products/cleanup-malformed", requireAdminAuth, async (req, res) => {
    try {
      console.log("🧹 [CLEANUP] Starting cleanup of products with malformed URLs...");
      
      const allProducts = await storage.getProducts();
      const malformedProducts = allProducts.filter(product => {
        const hasBlob = product.imageUrl?.startsWith('blob:') || product.imageUrl?.includes('devblob:');
        const hasMalformedImages = product.images?.some(img => 
          img.startsWith('blob:') || img.includes('devblob:')
        );
        return hasBlob || hasMalformedImages;
      });
      
      console.log(`🧹 [CLEANUP] Found ${malformedProducts.length} products to clean`);
      
      let cleanedCount = 0;
      const errors: string[] = [];
      
      for (const product of malformedProducts) {
        try {
          const success = await storage.deleteProduct(product.id);
          if (success) {
            cleanedCount++;
            console.log(`🗑️  [CLEANUP] Removed product: ${product.name} (${product.reference})`);
          } else {
            errors.push(`Failed to delete product: ${product.name} (${product.reference})`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error deleting product ${product.name}: ${errorMsg}`);
          console.error(`❌ [CLEANUP] Error deleting product ${product.name}:`, error);
        }
      }
      
      console.log(`🎉 [CLEANUP] Cleanup completed: ${cleanedCount} products removed`);
      
      res.json({
        message: `Limpieza completada: ${cleanedCount} productos con URLs corruptas eliminados`,
        cleaned: cleanedCount,
        total: malformedProducts.length,
        errors: errors
      });
    } catch (error) {
      console.error("💥 [CLEANUP] Error in cleanup process:", error);
      res.status(500).json({ 
        message: "Error en el proceso de limpieza", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Products routes with advanced search and filtering
  app.get("/api/products", async (req, res) => {
    try {
      const { 
        category, 
        brand, 
        flashSale, 
        featured, 
        query, 
        priceMin, 
        priceMax, 
        brands, 
        categories, 
        sizes, 
        colors, 
        onSale, 
        inStock 
      } = req.query;
      
      let products;
      
      // Legacy filters for backward compatibility
      if (category) {
        products = await storage.getProductsByCategory(category as string);
      } else if (brand) {
        products = await storage.getProductsByBrand(brand as string);
      } else if (flashSale === 'true') {
        products = await storage.getFlashSaleProducts();
      } else if (featured === 'true') {
        products = await storage.getFeaturedProducts();
      } else {
        products = await storage.getProducts();
      }
      
      // Apply advanced search and filters
      if (query && typeof query === 'string') {
        const searchTerm = query.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(searchTerm) ||
          (p.description && p.description.toLowerCase().includes(searchTerm))
        );
      }
      
      // Price range filter
      if (priceMin && !isNaN(Number(priceMin))) {
        products = products.filter(p => Number(p.price) >= Number(priceMin));
      }
      
      if (priceMax && !isNaN(Number(priceMax))) {
        products = products.filter(p => Number(p.price) <= Number(priceMax));
      }
      
      // Brand filter (multiple brands)
      if (brands && typeof brands === 'string') {
        const brandList = brands.split(',');
        products = products.filter(p => brandList.includes(p.brandId || ''));
      }
      
      // Category filter (multiple categories)
      if (categories && typeof categories === 'string') {
        const categoryList = categories.split(',');
        products = products.filter(p => {
          const productCategory = typeof p.category === 'string' ? p.category : p.category?.name || '';
          return categoryList.includes(productCategory);
        });
      }
      
      // Size filter
      if (sizes && typeof sizes === 'string') {
        const sizeList = sizes.split(',');
        products = products.filter(p => 
          p.sizes && p.sizes.some(size => sizeList.includes(size))
        );
      }
      
      // Color filter
      if (colors && typeof colors === 'string') {
        const colorList = colors.split(',');
        products = products.filter(p => 
          p.colors && p.colors.some(color => colorList.includes(color))
        );
      }
      
      // On sale filter
      if (onSale === "true") {
        products = products.filter(p => p.discountPercentage && p.discountPercentage > 0);
      }
      
      // In stock filter - products don't have stock field, so we'll consider all products as in stock
      if (inStock === "true") {
        // Since we don't track stock in the current schema, we'll just return all products
        // In the future, a stock field can be added to the products table
      }
      
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      console.log("🔥 DATOS RECIBIDOS EN BACKEND:", JSON.stringify(req.body, null, 2));
      
      // RENDIMIENTO: Eliminar verificación costosa de límites con readdir
      // El límite se verificará a nivel de base de datos si es necesario
      
      const productData = insertProductSchema.parse(req.body);
      console.log("🔥 DATOS DESPUÉS DE VALIDAR:", JSON.stringify(productData, null, 2));
      
      // Solo verificamos duplicados de imagen, no de nombres
      console.log("✅ Permitiendo múltiples productos con el mismo nombre");
      
      // Generar referencia única si no se proporciona
      if (!productData.reference) {
        let reference = generateUniqueReference();
        let isUnique = false;
        let attempts = 0;
        
        // Verificar que la referencia sea única (máximo 10 intentos)
        while (!isUnique && attempts < 10) {
          const existingProduct = await storage.getProductByReference(reference);
          if (!existingProduct) {
            isUnique = true;
          } else {
            reference = generateUniqueReference();
            attempts++;
          }
        }
        
        if (!isUnique) {
          return res.status(500).json({ message: "Error generando referencia única" });
        }
        
        productData.reference = reference;
        console.log("🔥 REFERENCIA GENERADA:", reference);
      }
      
      const product = await storage.createProduct(productData);
      console.log("🔥 PRODUCTO CREADO:", JSON.stringify(product, null, 2));
      res.status(201).json(product);
    } catch (error) {
      console.error("🔥 ERROR CREANDO PRODUCTO:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      
      // Solo verificamos duplicados de imagen en actualizaciones, no de nombres
      
      const product = await storage.updateProduct(req.params.id, productData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting product" });
    }
  });

  // 🔒 SECURE: Admin-only duplicate management endpoints
  app.get("/api/admin/products/duplicates", requireAdminAuth, async (req, res) => {
    try {
      const query = duplicateQuerySchema.parse(req.query);
      const { by, brandId, page, limit } = query;
      
      let duplicateGroups: Array<{ key: string; products: any[]; count: number }> = [];
      
      // Call appropriate method based on criteria
      switch (by) {
        case "reference":
          duplicateGroups = await storage.getDuplicateProductsByReference(brandId);
          break;
        case "name":
          duplicateGroups = await storage.getDuplicateProductsByNameBrand(brandId);
          break;
        case "image":
          duplicateGroups = await storage.getDuplicateProductsByImageHash(brandId);
          break;
        default:
          return res.status(400).json({ message: "Invalid criteria specified" });
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedGroups = duplicateGroups.slice(startIndex, endIndex);
      
      // Calculate summary statistics
      const totalGroups = duplicateGroups.length;
      const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.count - 1, 0); // -1 because only duplicates, not the original
      
      res.json({
        success: true,
        data: {
          groups: paginatedGroups,
          pagination: {
            page,
            limit,
            totalGroups,
            totalPages: Math.ceil(totalGroups / limit),
            hasNext: endIndex < totalGroups,
            hasPrev: page > 1
          },
          summary: {
            totalGroups,
            totalDuplicates,
            criteria: by,
            brandId
          }
        }
      });
    } catch (error) {
      console.error('Error fetching duplicates:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error fetching duplicate products" });
    }
  });

  app.post("/api/admin/products/duplicates/:groupKey/merge", requireAdminAuth, async (req, res) => {
    try {
      const { groupKey } = req.params;
      const mergeData = mergeProductsSchema.parse(req.body);
      const { primaryId, duplicateIds, strategy } = mergeData;
      
      // Validate that primary product exists and is not in duplicateIds
      if (duplicateIds.includes(primaryId)) {
        return res.status(400).json({ 
          message: "Primary product ID cannot be in the duplicate IDs list" 
        });
      }
      
      // Perform the atomic merge operation
      const mergedProduct = await storage.mergeProducts(primaryId, duplicateIds, strategy);
      
      if (!mergedProduct) {
        return res.status(404).json({ message: "Failed to merge products - primary product not found" });
      }
      
      res.json({
        success: true,
        message: `Successfully merged ${duplicateIds.length} duplicate products into primary product`,
        data: {
          mergedProduct,
          primaryId,
          duplicateIds,
          strategy,
          groupKey
        }
      });
    } catch (error) {
      console.error('Error merging products:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid merge data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error merging duplicate products" });
    }
  });

  app.patch("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
    try {
      console.log("🔍 RECEIVED DATA:", JSON.stringify(req.body, null, 2));
      const productData = updateProductSchema.parse(req.body);
      console.log("✅ PARSED DATA:", JSON.stringify(productData, null, 2));
      
      // Validate that product exists
      const existingProduct = await storage.getProduct(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Update the product with validated data
      const updatedProduct = await storage.updateProduct(req.params.id, productData);
      
      if (!updatedProduct) {
        return res.status(500).json({ message: "Failed to update product" });
      }
      
      res.json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error updating product:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid product data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // 🔒 SECURE: Get products by brand for admin (with pagination)
  app.get("/api/admin/brands/:brandId/products", requireAdminAuth, async (req, res) => {
    try {
      const brandId = req.params.brandId;
      const queryData = productsByBrandQuerySchema.parse(req.query);
      
      // Validate that brand exists
      const brand = await storage.getBrand(brandId);
      if (!brand) {
        return res.status(404).json({ message: "Brand not found" });
      }
      
      // Get all products for this brand (we'll implement pagination later if needed)
      const products = await storage.getProductsByBrand(brandId);
      
      // Simple pagination
      const { page, limit } = queryData;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = products.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          products: paginatedProducts,
          pagination: {
            page,
            limit,
            total: products.length,
            totalPages: Math.ceil(products.length / limit),
            hasMore: endIndex < products.length
          },
          brand: {
            id: brand.id,
            name: brand.name,
            logo: brand.logo
          }
        }
      });
    } catch (error) {
      console.error('Error fetching products by brand:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error fetching products by brand" });
    }
  });

  // 🔒 SECURE: Bulk update products
  app.patch("/api/admin/products/bulk", requireAdminAuth, async (req, res) => {
    try {
      const { productIds, updates } = bulkUpdateProductsSchema.parse(req.body);
      
      // Validate that all products exist (security check)
      const existingProducts = await Promise.all(
        productIds.map(id => storage.getProduct(id))
      );
      
      const nonExistentProducts = productIds.filter((id, index) => !existingProducts[index]);
      if (nonExistentProducts.length > 0) {
        return res.status(404).json({ 
          message: "Some products not found", 
          missingProducts: nonExistentProducts 
        });
      }
      
      // Perform bulk update
      const result = await storage.updateProductsBulk(productIds, updates);
      
      res.json({
        success: true,
        message: `Successfully updated ${result.updated} products`,
        data: {
          updated: result.updated,
          requested: productIds.length,
          errors: result.errors,
          updates: updates
        }
      });
    } catch (error) {
      console.error('Error updating products in bulk:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid bulk update data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error updating products in bulk" });
    }
  });

  // Promotions routes
  app.get("/api/promotions", async (req, res) => {
    try {
      const promotions = await storage.getPromotions();
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      res.status(500).json({ error: "Failed to fetch promotions" });
    }
  });

  app.get("/api/promotions/active", async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching active promotions:", error);
      res.status(500).json({ error: "Failed to fetch active promotions" });
    }
  });

  app.get("/api/promotions/:id", async (req, res) => {
    try {
      const promotion = await storage.getPromotion(req.params.id);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error) {
      console.error("Error fetching promotion:", error);
      res.status(500).json({ error: "Failed to fetch promotion" });
    }
  });

  app.post("/api/promotions", async (req, res) => {
    try {
      const validatedData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.createPromotion(validatedData);
      res.json(promotion);
    } catch (error) {
      console.error("Error creating promotion:", error);
      res.status(500).json({ error: "Failed to create promotion" });
    }
  });

  app.patch("/api/promotions/:id", async (req, res) => {
    try {
      const validatedData = insertPromotionSchema.partial().parse(req.body);
      const promotion = await storage.updatePromotion(req.params.id, validatedData);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error) {
      console.error("Error updating promotion:", error);
      res.status(500).json({ error: "Failed to update promotion" });
    }
  });

  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      const success = await storage.deletePromotion(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json({ message: "Promotion deleted successfully" });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      res.status(500).json({ error: "Failed to delete promotion" });
    }
  });

  // Events routes
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/active", async (req, res) => {
    try {
      const events = await storage.getActiveEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching active events:", error);
      res.status(500).json({ error: "Failed to fetch active events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const success = await storage.deleteEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // Cart routes
  app.get("/api/cart/:userId", async (req, res) => {
    try {
      const cartItems = await storage.getCartItems(req.params.userId);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: "Error fetching cart items" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const cartItemData = insertCartItemSchema.parse(req.body);
      const cartItem = await storage.addToCart(cartItemData);
      res.status(201).json(cartItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cart item data", errors: error.errors });
      }
      res.status(500).json({ message: "Error adding item to cart" });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== 'number' || quantity < 1) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }
      
      const cartItem = await storage.updateCartItem(req.params.id, quantity);
      if (!cartItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      res.json(cartItem);
    } catch (error) {
      res.status(500).json({ message: "Error updating cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const success = await storage.removeFromCart(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      res.status(500).json({ message: "Error removing item from cart" });
    }
  });

  app.delete("/api/cart/clear/:userId", async (req, res) => {
    try {
      await storage.clearCart(req.params.userId);
      res.json({ message: "Cart cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error clearing cart" });
    }
  });

  // Object Storage Routes
  
  // Endpoint para obtener URL de subida para una entidad de objeto
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 🔍 Check for duplicate images before upload
  app.get("/api/images/check-duplicates", async (req, res) => {
    try {
      const { fileName, size, hash } = req.query;
      
      if (!fileName || !size) {
        return res.status(400).json({
          error: "fileName and size are required",
          details: "Both fileName and size parameters must be provided"
        });
      }

      const fileSizeNumber = parseInt(size as string, 10);
      if (isNaN(fileSizeNumber)) {
        return res.status(400).json({
          error: "size must be a valid number",
          details: "The size parameter must be a valid integer"
        });
      }

      // Check for duplicates by different criteria
      let duplicates = [];
      
      // 1. Check by hash if provided (most accurate)
      if (hash) {
        const hashDuplicate = await storage.getImageByHash(hash as string);
        if (hashDuplicate) {
          duplicates.push({
            type: 'hash',
            match: hashDuplicate,
            reason: 'Imagen idéntica (mismo contenido)'
          });
        }
      }
      
      // 2. Check by filename and size combination (good indicator)
      const allImages = await storage.getAllImages();
      const nameAndSizeMatches = allImages.filter(img => 
        img.originalName === fileName && img.size === fileSizeNumber
      );
      
      nameAndSizeMatches.forEach(match => {
        // Avoid duplicate entries if already found by hash
        const alreadyFoundByHash = duplicates.some(dup => dup.match.id === match.id);
        if (!alreadyFoundByHash) {
          duplicates.push({
            type: 'name_and_size',
            match: match,
            reason: 'Mismo nombre y tamaño de archivo'
          });
        }
      });

      // 3. Check by filename only (potential duplicate)
      const nameMatches = allImages.filter(img => 
        img.originalName === fileName && 
        !duplicates.some(dup => dup.match.id === img.id)
      );
      
      nameMatches.forEach(match => {
        duplicates.push({
          type: 'name_only',
          match: match,
          reason: 'Mismo nombre de archivo'
        });
      });

      // Return response
      const hasDuplicates = duplicates.length > 0;
      const exactDuplicate = duplicates.find(dup => dup.type === 'hash');
      const likelyDuplicate = duplicates.find(dup => dup.type === 'name_and_size');

      res.json({
        isDuplicate: hasDuplicates,
        isExactDuplicate: !!exactDuplicate,
        isLikelyDuplicate: !!likelyDuplicate,
        duplicateCount: duplicates.length,
        duplicates: duplicates,
        recommendation: exactDuplicate 
          ? 'Esta imagen ya existe exactamente igual en el sistema'
          : likelyDuplicate 
            ? 'Posiblemente sea un duplicado (mismo nombre y tamaño)'
            : hasDuplicates
              ? 'Existe una imagen con el mismo nombre'
              : 'Imagen nueva, lista para subir',
        message: exactDuplicate
          ? '⚠️ Esta imagen ya existe en el sistema'
          : hasDuplicates
            ? '⚠️ Posible imagen duplicada detectada'
            : '✅ Imagen nueva, lista para subir'
      });

    } catch (error) {
      console.error("Error checking for duplicate images:", error);
      res.status(500).json({ 
        error: "Error checking for duplicates",
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Endpoint para verificar nombre de producto duplicado - AHORA SIEMPRE PERMITE DUPLICADOS
  app.get("/api/products/check-name", async (req, res) => {
    try {
      // VALIDACIÓN: Usar Zod para validar parámetros de query
      const nameSchema = z.object({
        name: z.string().min(1, "Nombre requerido").max(255, "Nombre demasiado largo")
      });
      
      const { name } = nameSchema.parse(req.query);

      // ✅ CAMBIO: Siempre permitir nombres duplicados (solo verificamos imágenes)
      console.log("✅ Verificación de nombre saltada - permitiendo duplicados:", name);
      res.json({ exists: false });
    } catch (error) {
      console.error("Error checking product name:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al verificar nombre del producto" });
    }
  });

  // Endpoint alternativo para subir imágenes directamente al servidor
  app.post("/api/objects/upload-direct", async (req, res) => {
    console.log("🔥🔥🔥 UPLOAD ENDPOINT LLAMADO 🔥🔥🔥");

    try {
      const { imageData, fileName, mimeType, skipDuplicateCheck } = req.body || {};
      
      if (!imageData) {
        console.log("🔥 ERROR: Missing imageData");
        return res.status(400).json({ error: "Datos de imagen requeridos" });
      }

      // Asegurarse de que el directorio existe
      await fs.ensureDir(uploadsDir);

      // Procesar los datos de la imagen
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      console.log("🔥 Buffer created, size:", buffer.length);

      // SEGURIDAD: Validar tamaño (máximo 10MB)
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_SIZE) {
        return res.status(400).json({ 
          error: "Imagen demasiado grande", 
          message: `Tamaño máximo permitido: ${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB` 
        });
      }

      // SEGURIDAD CRÍTICA: Detectar tipo real del archivo usando el contenido binario
      const { fileTypeFromBuffer } = await import('file-type');
      const actualFileType = await fileTypeFromBuffer(buffer);
      
      console.log('🔒 Tipo detectado por binario:', actualFileType?.mime || 'DETECCIÓN FALLÓ');
      console.log('🔒 Tipo declarado por cliente:', mimeType);
      
      // CRÍTICO: Si no se puede detectar el tipo, RECHAZAR (no confiar en cliente)
      if (!actualFileType || !actualFileType.mime) {
        return res.status(415).json({ 
          error: "Tipo de archivo no reconocido", 
          message: "El servidor no pudo determinar el tipo de archivo. Solo se permiten imágenes JPEG, PNG, GIF y WebP válidas.",
          reason: "binary_detection_failed"
        });
      }
      
      // CRÍTICO: Bloquear TODAS las variantes HEIC/HEIF (no solo image/heic)
      const heicFormats = ['image/heic', 'image/heif'];
      const heicExtensions = ['heic', 'heif'];
      
      const isHeicByMime = heicFormats.includes(actualFileType.mime);
      const isHeicByExt = actualFileType.ext && heicExtensions.includes(actualFileType.ext);
      
      if (isHeicByMime || isHeicByExt) {
        return res.status(415).json({ 
          error: "Formato HEIC/HEIF detectado en servidor", 
          message: "Tu imagen está en formato HEIC. La convertimos automáticamente en el navegador; si falla, convierte a JPG/PNG y vuelve a intentar.",
          detectedType: actualFileType.mime,
          detectedExt: actualFileType.ext,
          declaredType: mimeType
        });
      }
      
      // CRÍTICO: Solo permitir tipos específicos detectados por binario (NUNCA confiar en cliente)
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (!allowedMimes.includes(actualFileType.mime)) {
        return res.status(415).json({ 
          error: "Tipo de archivo no soportado", 
          message: "Solo se permiten imágenes JPEG, PNG, GIF y WebP",
          detectedType: actualFileType.mime,
          detectedExt: actualFileType.ext,
          allowedTypes: allowedMimes
        });
      }
      
      // SEGURIDAD: Usar SOLO el tipo detectado por binario (ignorar completamente cliente)
      const finalMimeType = actualFileType.mime;

      // SEGURIDAD: SIEMPRE calcular hash en servidor (nunca confiar en cliente)
      const crypto = await import('crypto');
      const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // NO DUPLICATE CHECKING - ALWAYS CREATE NEW IMAGE
      console.log("📁 ALWAYS CREATING NEW IMAGE - No duplicate detection (user request)");

      // SEGURIDAD: Generar fileName seguro en servidor usando extensión detectada
      const imageId = generateUniqueReference();
      // Usar extensión detectada por file-type (más confiable que mime)
      const extension = actualFileType.ext || finalMimeType.split('/')[1] || 'jpg';
      const finalFileName = `${imageId}.${extension}`;
      const filePath = path.join(uploadsDir, finalFileName);
      
      console.log("🔥 Saving to:", filePath);
      console.log("🔒 Usando tipo MIME validado:", finalMimeType);
      console.log("🔒 Usando extensión detectada:", extension);
      
      // Guardar la imagen físicamente
      await fs.writeFile(filePath, buffer);

      // Guardar información de la imagen en la base de datos
      await storage.createImage({
        fileName: finalFileName,
        originalName: fileName || `image.${extension}`,
        path: filePath,
        mimeType: finalMimeType, // Usar el tipo validado por detección binaria
        size: buffer.length,
        sha256: imageHash
      });
      
      const imageUrl = `/api/images/${finalFileName}`;
      
      console.log(`✅ SUCCESS: "${fileName}" saved as: ${imageUrl} with hash: ${imageHash}`);
      
      res.json({ 
        imageUrl,
        success: true,
        message: "Imagen subida correctamente",
        hash: imageHash
      });
    } catch (error) {
      console.error("🔥 UPLOAD ERROR:", error);
      res.status(500).json({ error: "Error al subir imagen: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Endpoint para servir las imágenes subidas
  app.get("/api/images/:fileName", async (req, res) => {
    try {
      const { fileName } = req.params;
      const filePath = path.join(uploadsDir, fileName);
      
      // Verificar que el archivo existe
      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({ error: "Imagen no encontrada" });
      }
      
      // Servir la imagen
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Error al servir imagen" });
    }
  });

  // 🤖 CARGA MASIVA DE IMÁGENES CON CLASIFICACIÓN AUTOMÁTICA DE MARCAS
  // Este endpoint analiza múltiples imágenes y crea productos automáticamente
  app.post("/api/products/bulk-upload", requireAdminAuth, async (req, res) => {
    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ 
          error: "Se requiere al menos una imagen",
          message: "Envía un array de imágenes en el campo 'images'" 
        });
      }

      console.log(`🚀 Iniciando carga masiva de ${images.length} imágenes`);
      
      const results = [];
      const errors = [];
      
      // Obtener categorías y marcas existentes
      const categories = await storage.getCategories();
      const brands = await storage.getBrands();
      
      // Buscar categoría "Zapatos" o usar la primera disponible
      const defaultCategory = categories.find(cat => 
        cat.name.toLowerCase().includes('zapato') || 
        cat.name.toLowerCase().includes('calzado')
      ) || categories[0];
      
      if (!defaultCategory) {
        return res.status(400).json({ 
          error: "No hay categorías disponibles",
          message: "Crea al menos una categoría antes de subir productos" 
        });
      }

      // Procesar cada imagen
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        
        try {
          console.log(`📸 Procesando imagen ${i + 1}/${images.length}`);
          
          // 1. SUBIR LA IMAGEN (reutilizando lógica existente)
          let imageUrl;
          let fileName = `producto_${Date.now()}_${i}.jpg`;
          
          if (imageData.imageData) {
            // Imagen en formato base64
            const uploadResult = await new Promise<any>((resolve, reject) => {
              // Simular la lógica del endpoint de subida existente
              const base64Data = imageData.imageData.replace(/^data:image\/[a-z]+;base64,/, "");
              const buffer = Buffer.from(base64Data, 'base64');
              
              // Crear URL temporal para análisis de AI
              const tempFileName = `temp_${Date.now()}_${i}.jpg`;
              imageUrl = `/uploads/${tempFileName}`;
              fileName = imageData.fileName || tempFileName;
              
              resolve({ url: imageUrl, fileName });
            });
            
            imageUrl = uploadResult.url;
            fileName = uploadResult.fileName;
          } else if (imageData.url) {
            // URL directa de imagen
            imageUrl = imageData.url;
            fileName = imageData.fileName || `imagen_${i}.jpg`;
          } else {
            throw new Error('Formato de imagen inválido');
          }

          console.log(`✅ Imagen subida: ${imageUrl}`);

          // 2. DETECTAR MARCA CON AI (reutilizando funciones existentes)
          console.log(`🤖 Analizando marca para: ${fileName}`);
          
          // Usar detección combinada de nombre de archivo y AI visual
          const filenameResult = detectBrandFromFilename(fileName);
          
          let finalBrand = filenameResult.brandName;
          let confidence = filenameResult.confidence;
          let detectionMethod = 'filename';
          
          // Si hay URL de imagen, usar también AI visual
          if (imageUrl && !filenameResult.requiresReview) {
            try {
              const visualResult = await detectBrandFromImage(imageUrl);
              const combinedResult = combineDetectionResults(filenameResult, visualResult);
              
              finalBrand = combinedResult.brand;
              confidence = combinedResult.confidence;
              detectionMethod = combinedResult.method;
              
              console.log(`🔍 Detección combinada: ${finalBrand} (${confidence.toFixed(2)}, método: ${detectionMethod})`);
            } catch (aiError) {
              console.log(`⚠️ AI falló, usando detección de filename: ${finalBrand}`);
            }
          }

          // 3. BUSCAR O CREAR MARCA
          let targetBrand = brands.find(b => 
            b.name.toLowerCase() === (finalBrand || '').toLowerCase()
          );
          
          if (!targetBrand && finalBrand && finalBrand !== PENDING_REVIEW_BRAND) {
            // Crear nueva marca automáticamente
            console.log(`🆕 Creando nueva marca: ${finalBrand}`);
            targetBrand = await storage.createBrand({
              name: finalBrand,
              logo: `/brand-logos/${finalBrand.toLowerCase().replace(/\s+/g, '-')}-logo.png`,
              displayLocation: 'client'
            });
            brands.push(targetBrand); // Agregar a la lista local
          }
          
          // Si no se puede determinar marca, usar marca por defecto o enviar a revisión
          if (!targetBrand) {
            targetBrand = brands.find(b => b.name === 'Nike') || brands[0];
            console.log(`🔄 Usando marca por defecto: ${targetBrand?.name}`);
          }

          // 4. CREAR PRODUCTO AUTOMÁTICAMENTE
          const productName = `${targetBrand?.name || 'Producto'} ${fileName.split('.')[0]}`.substring(0, 255);
          const reference = await generateUniqueReferenceForProduct();
          
          const newProduct = await storage.createProduct({
            name: productName,
            nameNormalized: productName.toLowerCase().trim(),
            description: `Producto importado automáticamente. Marca: ${finalBrand}. Confianza: ${(confidence * 100).toFixed(1)}%. Método: ${detectionMethod}`,
            price: "50000", // Precio por defecto
            originalPrice: "50000",
            discountPercentage: 0,
            categoryId: defaultCategory.id,
            brandId: targetBrand?.id || categories[0]?.id || 'default',
            sellerId: 'admin',
            imageUrl: imageUrl,
            reference: reference,
            sizes: ['38', '39', '40', '41', '42'],
            colors: ['Negro'],
            rating: "0",
            reviewCount: 0,
            isFlashSale: false,
            isFeatured: false
          });

          results.push({
            success: true,
            product: newProduct,
            detectedBrand: finalBrand,
            confidence: confidence,
            detectionMethod: detectionMethod,
            imageUrl: imageUrl,
            originalFileName: fileName
          });

          console.log(`✅ Producto creado: ${newProduct.name} (${newProduct.reference})`);

        } catch (imageError) {
          console.error(`❌ Error procesando imagen ${i + 1}:`, imageError);
          errors.push({
            index: i,
            error: imageError instanceof Error ? imageError.message : 'Error desconocido',
            imageData: imageData.fileName || `imagen_${i}`
          });
        }
      }

      // Respuesta final
      const response = {
        message: `Carga masiva completada: ${results.length} productos creados, ${errors.length} errores`,
        totalProcessed: images.length,
        successful: results.length,
        failed: errors.length,
        results: results,
        errors: errors
      };

      console.log(`🏁 Carga masiva finalizada: ${results.length}/${images.length} exitosos`);
      res.json(response);

    } catch (error) {
      console.error('❌ Error en carga masiva:', error);
      res.status(500).json({ 
        error: "Error en carga masiva",
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // API para seguimiento de pedidos - buscar por ID de cliente
  app.get("/api/orders/customer/:customerId", async (req, res) => {
    try {
      const { customerId } = req.params;
      const orders = await storage.getOrdersByCustomerId(customerId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders by customer ID:", error);
      res.status(500).json({ error: "Error al buscar pedidos" });
    }
  });

  // API para seguimiento de pedidos - buscar por número de tracking
  app.get("/api/orders/tracking/:trackingNumber", async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const orders = await storage.getOrdersByTrackingNumber(trackingNumber);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders by tracking number:", error);
      res.status(500).json({ error: "Error al buscar pedido" });
    }
  });

  // API para actualizar estado de pedido (solo para admin)
  app.put("/api/orders/:orderId/status", requireAdminAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status, deliveryTime, notes } = req.body;
      
      // Validar estados permitidos
      const validStatuses = ['confirmed', 'picked_up', 'in_transit', 'delivered'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Estado inválido" });
      }

      const updatedOrder = await storage.updateOrderStatus(orderId, { status, deliveryTime, notes });
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Error al actualizar estado del pedido" });
    }
  });

  // API para obtener todos los pedidos (para admin)
  app.get("/api/orders/admin/all", requireAdminAuthHeaders, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ error: "Error al obtener pedidos" });
    }
  });

  // Endpoint para servir objetos públicos
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para servir objetos privados
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Customer Savings routes
  app.get("/api/customer-savings/:customerId", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const customerSavings = await storage.getCustomerSavings(customerId);
      
      if (!customerSavings) {
        // Return default empty savings for new customers
        return res.json({
          customerId,
          totalSaved: "0",
          achievementsUnlocked: [],
          lastPurchaseAmount: "0",
          totalPurchases: 0
        });
      }
      
      res.json(customerSavings);
    } catch (error) {
      res.status(500).json({ message: "Error fetching customer savings" });
    }
  });

  app.post("/api/customer-savings/:customerId/add-savings", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      const customerSavings = await storage.addSavings(customerId, amount.toString());
      res.json(customerSavings);
    } catch (error) {
      res.status(500).json({ message: "Error adding savings" });
    }
  });

  app.post("/api/customer-savings/:customerId/apply-discount", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const { discountAmount } = req.body;
      
      if (!discountAmount || isNaN(parseFloat(discountAmount))) {
        return res.status(400).json({ message: "Valid discount amount is required" });
      }
      
      const customerSavings = await storage.applySavingsDiscount(customerId, discountAmount.toString());
      
      if (!customerSavings) {
        return res.status(404).json({ message: "Customer savings not found" });
      }
      
      res.json(customerSavings);
    } catch (error) {
      res.status(500).json({ message: "Error applying discount" });
    }
  });

  app.put("/api/customer-savings/:customerId", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const updateData = req.body;
      
      const customerSavings = await storage.updateCustomerSavings(customerId, updateData);
      
      if (!customerSavings) {
        return res.status(404).json({ message: "Customer savings not found" });
      }
      
      res.json(customerSavings);
    } catch (error) {
      res.status(500).json({ message: "Error updating customer savings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
