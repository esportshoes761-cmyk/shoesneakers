import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCartItemSchema, insertPromotionSchema, insertEventSchema, insertUserSchema, insertBrandSchema, insertCustomerSavingsSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import * as path from "path";

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

// Brand package schema for bulk creation
const brandPackageSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  categoryId: z.string().min(1, "Category ID is required"),
  price: z.string().min(1, "Price is required"),
  description: z.string().default("Hermosa y cómoda zapatillas para el mejor estilo"),
  images: z.array(z.string()).min(10, "Minimum 10 images required"),
  isFlashSale: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
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
  app.post("/api/brands", async (req, res) => {
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

  app.put("/api/brands/:id", async (req, res) => {
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

  // Bulk product creation endpoint
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
      
      // Create products for each image
      for (let i = 0; i < packageData.images.length; i++) {
        try {
          // Generate unique reference for this product
          const reference = await generateUniqueReferenceForProduct();
          
          const productData = {
            name: brand.name, // Use brand name as product name
            description: packageData.description,
            price: packageData.price,
            imageUrl: packageData.images[i],
            reference: reference,
            categoryId: packageData.categoryId,
            brandId: packageData.brandId,
            isFlashSale: packageData.isFlashSale,
            isFeatured: packageData.isFeatured,
            images: [packageData.images[i]], // Single image per product
            sizes: [],
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

  // Endpoint para verificar hash de imagen antes de subir
  app.post("/api/images/check-hash", async (req, res) => {
    try {
      // VALIDACIÓN: Usar Zod para validar datos de entrada
      const hashSchema = z.object({
        hash: z.string().min(1, "Hash requerido").regex(/^[a-fA-F0-9]{64}$/, "Hash SHA-256 inválido")
      });
      
      const { hash } = hashSchema.parse(req.body);

      const existingImage = await storage.getImageByHash(hash);
      
      if (existingImage) {
        return res.status(409).json({ 
          exists: true,
          message: "La imagen ya existe",
          imageUrl: `/api/images/${existingImage.fileName}`,
          hash: hash
        });
      }

      res.json({ exists: false });
    } catch (error) {
      console.error("Error checking image hash:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Error al verificar imagen" });
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
      const { imageData, fileName, mimeType } = req.body || {};
      
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

      // CRÍTICO: Verificar duplicados ANTES de escribir archivo
      const existingImage = await storage.getImageByHash(imageHash);
      if (existingImage) {
        console.log("🔥 DUPLICATE IMAGE DETECTED:", imageHash);
        return res.status(409).json({
          error: "La imagen ya existe",
          exists: true,
          imageUrl: `/api/images/${existingImage.fileName}`,
          message: "Esta imagen ya fue subida anteriormente",
          hash: imageHash
        });
      }

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
  app.put("/api/orders/:orderId/status", async (req, res) => {
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
  app.get("/api/orders/admin/all", async (req, res) => {
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
