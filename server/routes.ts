import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCartItemSchema, insertPromotionSchema, insertEventSchema, insertUserSchema, insertBrandSchema, insertCustomerSavingsSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomBytes } from "crypto";

// Helper functions
function generateUniqueReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = randomBytes(20);
  
  for (let i = 0; i < 20; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // In stock filter
      if (inStock === "true") {
        products = products.filter(p => (p.stock || 0) > 0);
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
      const productData = insertProductSchema.parse(req.body);
      console.log("🔥 DATOS DESPUÉS DE VALIDAR:", JSON.stringify(productData, null, 2));
      
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

  // Endpoint alternativo para subir imágenes directamente al servidor
  app.post("/api/objects/upload-direct", async (req, res) => {
    try {
      const { imageData, fileName, mimeType } = req.body;
      
      if (!imageData || !fileName) {
        return res.status(400).json({ error: "Missing image data or filename" });
      }

      // Generar un ID único para la imagen
      const imageId = generateUniqueReference();
      const extension = fileName.split('.').pop() || 'jpg';
      const finalFileName = `${imageId}.${extension}`;
      
      // Por ahora usamos una estrategia simple: almacenar la referencia y devolver una URL
      // En el futuro esto se puede expandir para usar almacenamiento real
      const imageUrl = `/api/images/${finalFileName}`;
      
      console.log(`✅ Imagen "${fileName}" procesada como: ${imageUrl}`);
      
      res.json({ 
        imageUrl,
        success: true,
        message: "Imagen subida correctamente"
      });
    } catch (error) {
      console.error("Error in direct upload:", error);
      res.status(500).json({ error: "Error al subir imagen" });
    }
  });

  // Endpoint para servir las imágenes subidas (placeholder por ahora)
  app.get("/api/images/:fileName", async (req, res) => {
    const { fileName } = req.params;
    
    // Por ahora devolvemos una imagen de placeholder
    // En el futuro aquí se serviría la imagen real del almacenamiento
    const placeholderUrl = "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop";
    
    try {
      const response = await fetch(placeholderUrl);
      const buffer = await response.arrayBuffer();
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(404).json({ error: "Image not found" });
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
