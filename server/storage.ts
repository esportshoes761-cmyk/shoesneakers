import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, type CartItem, type InsertCartItem, type ProductWithCategory, type CartItemWithProduct, type Brand, type InsertBrand, type BrandWithProducts, type Promotion, type InsertPromotion, type Event, type InsertEvent, type CustomerSavings, type InsertCustomerSavings, type Review, type InsertReview, type Order, type InsertOrder, type ProductWithReviews, type Image, type InsertImage } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, categories, brands, products, promotions, events, cartItems, customerSavings, reviews, orders, images } from "@shared/schema";
import { eq, and, gte, lte, ilike, inArray, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, amount: string): Promise<User | undefined>;
  authenticateUser(username: string, password: string): Promise<User | undefined>;

  // Category methods
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Brand methods
  getBrands(): Promise<Brand[]>;
  getBrandsWithProducts(): Promise<BrandWithProducts[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, brand: InsertBrand): Promise<Brand | undefined>;

  // Product methods
  getProducts(): Promise<ProductWithCategory[]>;
  getProductsByCategory(categoryId: string): Promise<ProductWithCategory[]>;
  getProductsByBrand(brandId: string): Promise<ProductWithCategory[]>;
  getFlashSaleProducts(): Promise<ProductWithCategory[]>;
  getFeaturedProducts(): Promise<ProductWithCategory[]>;
  getProduct(id: string): Promise<ProductWithCategory | undefined>;
  getProductByReference(reference: string): Promise<Product | undefined>;
  getProductByNameNormalized(nameNormalized: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getProductWithReviews(id: string): Promise<ProductWithReviews | undefined>;

  // Image methods
  getImageByHash(hash: string): Promise<Image | undefined>;
  createImage(image: InsertImage): Promise<Image>;

  // Review methods
  createReview(review: InsertReview): Promise<Review>;
  getProductReviews(productId: string): Promise<Review[]>;

  // Order methods
  createOrder(order: InsertOrder): Promise<Order>;
  getCustomerOrdersForProduct(customerId: string, productId: string): Promise<Order[]>;
  updateOrderStatus(orderId: string, updateData: { status?: string; deliveryTime?: string; notes?: string }): Promise<Order | undefined>;
  getOrdersByCustomerId(customerId: string): Promise<Order[]>;
  getOrdersByTrackingNumber(trackingNumber: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;

  // Promotion methods
  getPromotions(): Promise<Promotion[]>;
  getActivePromotions(): Promise<Promotion[]>;
  getPromotion(id: string): Promise<Promotion | undefined>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, promotion: Partial<InsertPromotion>): Promise<Promotion | undefined>;
  deletePromotion(id: string): Promise<boolean>;

  // Event methods
  getEvents(): Promise<Event[]>;
  getActiveEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;

  // Cart methods
  getCartItems(userId: string): Promise<CartItemWithProduct[]>;
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;

  // Customer Savings methods
  getCustomerSavings(customerId: string): Promise<CustomerSavings | undefined>;
  createCustomerSavings(customerSavings: InsertCustomerSavings): Promise<CustomerSavings>;
  updateCustomerSavings(customerId: string, updateData: Partial<InsertCustomerSavings>): Promise<CustomerSavings | undefined>;
  addSavings(customerId: string, amount: string): Promise<CustomerSavings | undefined>;
  applySavingsDiscount(customerId: string, discountAmount: string): Promise<CustomerSavings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private categories: Map<string, Category>;
  private brands: Map<string, Brand>;
  private products: Map<string, Product>;
  private promotions: Map<string, Promotion>;
  private events: Map<string, Event>;
  private cartItems: Map<string, CartItem>;
  private customerSavings: Map<string, CustomerSavings>;
  private reviews: Map<string, Review>;
  private images: Map<string, Image>;
  private orders: Map<string, Order>;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.brands = new Map();
    this.products = new Map();
    this.promotions = new Map();
    this.events = new Map();
    this.cartItems = new Map();
    this.customerSavings = new Map();
    this.reviews = new Map();
    this.images = new Map();
    this.orders = new Map();
    this.initializeData();
  }

  private initializeData() {
    // Initialize categories
    const defaultCategories = [
      { name: "Tacones", emoji: "👠", description: "Elegantes tacones para toda ocasión" },
      { name: "Deportivos", emoji: "👟", description: "Zapatos deportivos y cómodos" },
      { name: "Botas", emoji: "👢", description: "Botas para todas las temporadas" },
      { name: "Sandalias", emoji: "🩴", description: "Sandalias frescas y cómodas" },
      { name: "Casuales", emoji: "🥿", description: "Zapatos casuales para el día a día" },
      { name: "Formales", emoji: "👞", description: "Zapatos formales y elegantes" },
    ];

    defaultCategories.forEach(cat => {
      const id = randomUUID();
      this.categories.set(id, { ...cat, id, description: cat.description });
    });

    // Initialize real brands
    const realBrands = [
      { 
        name: "Nike", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png",
        description: "Just Do It - Marca líder en deportivos",
        catalogUrl: "https://nike.com/catalog",
        isActive: true
      },
      { 
        name: "Adidas", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png",
        description: "Impossible is Nothing - Deportivos de alta calidad",
        catalogUrl: "https://adidas.com/catalog",
        isActive: true
      },
      { 
        name: "Puma", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Puma-Logo.png",
        description: "Forever Faster - Estilo deportivo innovador",
        catalogUrl: "https://puma.com/catalog",
        isActive: true
      },
      { 
        name: "Jordan", 
        logo: "https://logoeps.com/wp-content/uploads/2013/03/jordan-vector-logo.png",
        description: "Jumpman - Calzado de baloncesto premium",
        catalogUrl: "https://jordan.com/catalog",
        isActive: true
      },
      { 
        name: "Asics", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/ASICS-Logo.png",
        description: "Sound Mind, Sound Body - Tecnología japonesa",
        catalogUrl: "https://asics.com/catalog",
        isActive: true
      },
      { 
        name: "New Balance", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/New-Balance-Logo.png",
        description: "Endorsed by No One - Calidad y rendimiento",
        catalogUrl: "https://newbalance.com/catalog",
        isActive: true
      },
      { 
        name: "Under Armour", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Under-Armour-Logo.png",
        description: "I Will - Innovación deportiva y rendimiento",
        catalogUrl: "https://underarmour.com/catalog",
        isActive: true
      },
      { 
        name: "Reebok", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Reebok-Logo.png",
        description: "Be More Human - Fitness y lifestyle",
        catalogUrl: "https://reebok.com/catalog",
        isActive: true
      },
      { 
        name: "Skechers", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Skechers-Logo.png",
        description: "Comfort Technology - Comodidad y estilo",
        catalogUrl: "https://skechers.com/catalog",
        isActive: true
      },
      { 
        name: "On Cloud", 
        logo: "https://logos-world.net/wp-content/uploads/2020/12/On-Running-Logo.png",
        description: "Run on Clouds - Tecnología suiza innovadora",
        catalogUrl: "https://on-running.com/catalog",
        isActive: true
      }
    ];

    realBrands.forEach(brand => {
      const id = randomUUID();
      this.brands.set(id, { 
        ...brand, 
        id,
        description: brand.description,
        catalogUrl: brand.catalogUrl,
        isActive: brand.isActive
      });
    });

    // Initialize default admin user
    const adminId = randomUUID();
    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      email: "admin@zapashop.com",
      password: "admin123",
      firstName: "Administrador",
      lastName: "ZapaShop",
      phone: null,
      isSeller: false,
      isAdmin: true,
      credits: "0",
      totalPurchases: "0",
      loyaltyLevel: "platinum",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize a test user
    const testUserId = randomUUID();
    this.users.set(testUserId, {
      id: testUserId,
      username: "usuario",
      email: "usuario@test.com",
      password: "123456",
      firstName: "María",
      lastName: "García",
      phone: "+34 123 456 789",
      isSeller: false,
      isAdmin: false,
      credits: "50.00",
      totalPurchases: "150.00",
      loyaltyLevel: "silver",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      isSeller: insertUser.isSeller ?? false,
      isAdmin: insertUser.isAdmin ?? false,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      phone: insertUser.phone ?? null,
      credits: insertUser.credits ?? "0",
      totalPurchases: insertUser.totalPurchases ?? "0",
      loyaltyLevel: insertUser.loyaltyLevel ?? "bronze",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserCredits(userId: string, amount: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const currentCredits = parseFloat(user.credits || "0");
    const newCredits = currentCredits + parseFloat(amount);
    
    user.credits = newCredits.toString();
    user.updatedAt = new Date();
    
    this.users.set(userId, user);
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user || user.password !== password) {
      return undefined;
    }
    return user;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = { 
      ...insertCategory, 
      id,
      description: insertCategory.description ?? null
    };
    this.categories.set(id, category);
    return category;
  }

  // Brand methods
  async getBrands(): Promise<Brand[]> {
    return Array.from(this.brands.values()).filter(brand => brand.isActive);
  }

  async getBrandsWithProducts(): Promise<BrandWithProducts[]> {
    const brands = await this.getBrands();
    return brands.map(brand => {
      const brandProducts = Array.from(this.products.values())
        .filter(product => product.brandId === brand.id)
        .map(product => ({
          ...product,
          category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
          brand: brand
        }));
      
      return {
        ...brand,
        products: brandProducts,
        productCount: brandProducts.length
      };
    });
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    return this.brands.get(id);
  }

  async createBrand(insertBrand: InsertBrand): Promise<Brand> {
    const id = randomUUID();
    const brand: Brand = { 
      ...insertBrand, 
      id,
      description: insertBrand.description ?? null,
      catalogUrl: insertBrand.catalogUrl ?? null,
      isActive: insertBrand.isActive ?? true
    };
    this.brands.set(id, brand);
    return brand;
  }

  async updateBrand(id: string, insertBrand: InsertBrand): Promise<Brand | undefined> {
    const existingBrand = this.brands.get(id);
    if (!existingBrand) return undefined;

    const updatedBrand: Brand = {
      ...existingBrand,
      ...insertBrand,
      id,
      description: insertBrand.description ?? null,
      catalogUrl: insertBrand.catalogUrl ?? null,
      isActive: insertBrand.isActive ?? true
    };
    this.brands.set(id, updatedBrand);
    return updatedBrand;
  }

  // Promotion methods
  async getPromotions(): Promise<Promotion[]> {
    return Array.from(this.promotions.values());
  }

  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();
    return Array.from(this.promotions.values()).filter(promotion => 
      promotion.isActive && 
      new Date(promotion.startDate!) <= now && 
      new Date(promotion.endDate!) >= now
    );
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    return this.promotions.get(id);
  }

  async createPromotion(insertPromotion: InsertPromotion): Promise<Promotion> {
    const id = randomUUID();
    const promotion: Promotion = { 
      ...insertPromotion, 
      id,
      createdAt: new Date(),
      description: insertPromotion.description ?? null,
      discountPercentage: insertPromotion.discountPercentage ?? null,
      discountAmount: insertPromotion.discountAmount ?? null,
      code: insertPromotion.code ?? null,
      isActive: insertPromotion.isActive ?? true,
      minPurchase: insertPromotion.minPurchase ?? null,
      maxUses: insertPromotion.maxUses ?? null,
      currentUses: insertPromotion.currentUses ?? 0
    };
    this.promotions.set(id, promotion);
    return promotion;
  }

  async updatePromotion(id: string, updateData: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const promotion = this.promotions.get(id);
    if (!promotion) return undefined;

    const updatedPromotion = { ...promotion, ...updateData };
    this.promotions.set(id, updatedPromotion);
    return updatedPromotion;
  }

  async deletePromotion(id: string): Promise<boolean> {
    return this.promotions.delete(id);
  }

  // Event methods
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getActiveEvents(): Promise<Event[]> {
    const now = new Date();
    return Array.from(this.events.values())
      .filter(event => 
        event.isActive && 
        new Date(event.startDate!) <= now && 
        new Date(event.endDate!) >= now
      )
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = { 
      ...insertEvent, 
      id,
      createdAt: new Date(),
      description: insertEvent.description ?? null,
      imageUrl: insertEvent.imageUrl ?? null,
      isActive: insertEvent.isActive ?? true,
      priority: insertEvent.priority ?? 0
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...updateData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
  }

  // Product methods
  async getProducts(): Promise<ProductWithCategory[]> {
    return Array.from(this.products.values()).map(product => ({
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
      brand: product.brandId ? this.brands.get(product.brandId) : undefined,
    }));
  }

  async getProductsByCategory(categoryId: string): Promise<ProductWithCategory[]> {
    return Array.from(this.products.values())
      .filter(product => product.categoryId === categoryId)
      .map(product => ({
        ...product,
        category: this.categories.get(product.categoryId!),
        brand: product.brandId ? this.brands.get(product.brandId) : undefined,
      }));
  }

  async getProductsByBrand(brandId: string): Promise<ProductWithCategory[]> {
    return Array.from(this.products.values())
      .filter(product => product.brandId === brandId)
      .map(product => ({
        ...product,
        category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
        brand: this.brands.get(product.brandId!),
      }));
  }

  async getFlashSaleProducts(): Promise<ProductWithCategory[]> {
    return Array.from(this.products.values())
      .filter(product => product.isFlashSale)
      .map(product => ({
        ...product,
        category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
        brand: product.brandId ? this.brands.get(product.brandId) : undefined,
      }));
  }

  async getFeaturedProducts(): Promise<ProductWithCategory[]> {
    return Array.from(this.products.values())
      .filter(product => product.isFeatured)
      .map(product => ({
        ...product,
        category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
        brand: product.brandId ? this.brands.get(product.brandId) : undefined,
      }));
  }

  async getProduct(id: string): Promise<ProductWithCategory | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    return {
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
      brand: product.brandId ? this.brands.get(product.brandId) : undefined,
    };
  }

  async getProductByReference(reference: string): Promise<Product | undefined> {
    for (const product of Array.from(this.products.values())) {
      if (product.reference === reference) {
        return product;
      }
    }
    return undefined;
  }

  // Función utilitaria para normalizar nombres
  private normalizeProductName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  async getProductByNameNormalized(nameNormalized: string): Promise<Product | undefined> {
    for (const product of Array.from(this.products.values())) {
      if (product.nameNormalized === nameNormalized) {
        return product;
      }
    }
    return undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const nameNormalized = this.normalizeProductName(insertProduct.name);
    const product: Product = { 
      ...insertProduct, 
      id,
      nameNormalized,
      createdAt: new Date(),
      description: insertProduct.description ?? null,
      originalPrice: insertProduct.originalPrice ?? null,
      discountPercentage: insertProduct.discountPercentage ?? 0,
      categoryId: insertProduct.categoryId ?? null,
      brandId: insertProduct.brandId ?? null,
      sellerId: insertProduct.sellerId ?? null,
      reference: insertProduct.reference ?? null,
      images: insertProduct.images ?? null,
      imageUrl: insertProduct.imageUrl ?? null,
      sizes: insertProduct.sizes ?? null,
      colors: insertProduct.colors ?? null,
      rating: insertProduct.rating ?? "0",
      reviewCount: insertProduct.reviewCount ?? 0,
      isFlashSale: insertProduct.isFlashSale ?? false,
      isFeatured: insertProduct.isFeatured ?? false
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    // CRÍTICO: Si se actualiza el nombre, actualizar también nameNormalized
    const finalUpdateData = { ...updateData };
    if (updateData.name) {
      finalUpdateData.nameNormalized = this.normalizeProductName(updateData.name);
    }

    const updatedProduct = { ...product, ...finalUpdateData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  // Image methods
  async getImageByHash(hash: string): Promise<Image | undefined> {
    for (const image of Array.from(this.images.values())) {
      if (image.sha256 === hash) {
        return image;
      }
    }
    return undefined;
  }

  async createImage(insertImage: InsertImage): Promise<Image> {
    const id = randomUUID();
    const image: Image = {
      ...insertImage,
      id,
      createdAt: new Date()
    };
    this.images.set(id, image);
    return image;
  }

  // Review methods  
  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      ...insertReview,
      id,
      createdAt: new Date(),
      productId: insertReview.productId ?? null,
      customerId: insertReview.customerId ?? null,
      rating: insertReview.rating ?? 5,
      comment: insertReview.comment ?? null
    };
    this.reviews.set(id, review);
    return review;
  }

  async getProductReviews(productId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.productId === productId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async getProductWithReviews(id: string): Promise<ProductWithReviews | undefined> {
    const product = await this.getProduct(id);
    if (!product) {
      return undefined;
    }

    const productReviews = await this.getProductReviews(id);
    
    return {
      ...product,
      reviews: productReviews,
    };
  }

  // Cart methods
  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    return Array.from(this.cartItems.values())
      .filter(item => item.userId === userId)
      .map(item => {
        const product = this.products.get(item.productId!);
        return {
          ...item,
          product: product!,
        };
      })
      .filter(item => item.product);
  }

  async addToCart(insertCartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItem = Array.from(this.cartItems.values())
      .find(item => item.userId === insertCartItem.userId && item.productId === insertCartItem.productId);

    if (existingItem) {
      // Update quantity
      existingItem.quantity = (existingItem.quantity || 1) + (insertCartItem.quantity || 1);
      this.cartItems.set(existingItem.id, existingItem);
      return existingItem;
    }

    const id = randomUUID();
    const cartItem: CartItem = { 
      ...insertCartItem, 
      id,
      createdAt: new Date(),
      userId: insertCartItem.userId ?? null,
      productId: insertCartItem.productId ?? null,
      quantity: insertCartItem.quantity ?? 1
    };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const cartItem = this.cartItems.get(id);
    if (!cartItem) return undefined;

    cartItem.quantity = quantity;
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async removeFromCart(id: string): Promise<boolean> {
    return this.cartItems.delete(id);
  }

  async clearCart(userId: string): Promise<boolean> {
    const userItems = Array.from(this.cartItems.entries())
      .filter(([, item]) => item.userId === userId);
    
    userItems.forEach(([id]) => {
      this.cartItems.delete(id);
    });
    
    return true;
  }

  // Customer Savings methods
  async getCustomerSavings(customerId: string): Promise<CustomerSavings | undefined> {
    return this.customerSavings.get(customerId);
  }

  async createCustomerSavings(insertCustomerSavings: InsertCustomerSavings): Promise<CustomerSavings> {
    const id = randomUUID();
    const customerSaving: CustomerSavings = { 
      ...insertCustomerSavings, 
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalSaved: insertCustomerSavings.totalSaved ?? "0",
      achievementsUnlocked: insertCustomerSavings.achievementsUnlocked ?? [],
      lastPurchaseAmount: insertCustomerSavings.lastPurchaseAmount ?? "0",
      totalPurchases: insertCustomerSavings.totalPurchases ?? 0
    };
    this.customerSavings.set(insertCustomerSavings.customerId, customerSaving);
    return customerSaving;
  }

  async updateCustomerSavings(customerId: string, updateData: Partial<InsertCustomerSavings>): Promise<CustomerSavings | undefined> {
    const customerSaving = this.customerSavings.get(customerId);
    if (!customerSaving) return undefined;

    const updatedCustomerSavings = { 
      ...customerSaving, 
      ...updateData,
      updatedAt: new Date()
    };
    this.customerSavings.set(customerId, updatedCustomerSavings);
    return updatedCustomerSavings;
  }

  async addSavings(customerId: string, amount: string): Promise<CustomerSavings | undefined> {
    let customerSaving = this.customerSavings.get(customerId);
    
    if (!customerSaving) {
      // Create new customer savings record
      customerSaving = await this.createCustomerSavings({
        customerId,
        totalSaved: amount,
        achievementsUnlocked: [],
        lastPurchaseAmount: "0",
        totalPurchases: 0
      });
    } else {
      // Update existing savings
      const currentSavings = parseFloat(customerSaving.totalSaved || "0");
      const addAmount = parseFloat(amount);
      const newTotal = currentSavings + addAmount;
      
      customerSaving = await this.updateCustomerSavings(customerId, {
        totalSaved: newTotal.toString()
      });
    }
    
    return customerSaving;
  }

  async applySavingsDiscount(customerId: string, discountAmount: string): Promise<CustomerSavings | undefined> {
    const customerSaving = this.customerSavings.get(customerId);
    if (!customerSaving) return undefined;

    const currentSavings = parseFloat(customerSaving.totalSaved || "0");
    const discount = parseFloat(discountAmount);
    const newTotal = Math.max(0, currentSavings - discount);
    
    return await this.updateCustomerSavings(customerId, {
      totalSaved: newTotal.toString()
    });
  }

  // Order methods
  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      ...insertOrder,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      customerId: insertOrder.customerId ?? null,
      productId: insertOrder.productId ?? null,
      quantity: insertOrder.quantity ?? 1,
      totalAmount: insertOrder.totalAmount ?? "0",
      status: insertOrder.status ?? "pending",
      trackingNumber: insertOrder.trackingNumber ?? null,
      deliveryTime: insertOrder.deliveryTime ?? null,
      notes: insertOrder.notes ?? null
    };
    this.orders.set(id, order);
    return order;
  }

  async getCustomerOrdersForProduct(customerId: string, productId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.customerId === customerId && order.productId === productId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async updateOrderStatus(orderId: string, updateData: { status?: string; deliveryTime?: string; notes?: string }): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    const updatedOrder = {
      ...order,
      ...updateData,
      updatedAt: new Date()
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.customerId === customerId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async getOrdersByTrackingNumber(trackingNumber: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.trackingNumber === trackingNumber);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values())
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }
}

// DatabaseStorage implementation for persistent data
export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Only initialize if no data exists
      const existingCategories = await db.select().from(categories).limit(1);
      if (existingCategories.length === 0) {
        // Initialize default categories
        const defaultCategories = [
          { name: "Tacones", emoji: "👠", description: "Elegantes tacones para toda ocasión" },
          { name: "Deportivos", emoji: "👟", description: "Zapatos deportivos y cómodos" },
          { name: "Botas", emoji: "👢", description: "Botas para todas las temporadas" },
          { name: "Sandalias", emoji: "🩴", description: "Sandalias frescas y cómodas" },
          { name: "Casuales", emoji: "🥿", description: "Zapatos casuales para el día a día" },
          { name: "Formales", emoji: "👞", description: "Zapatos formales y elegantes" },
        ];
        
        await db.insert(categories).values(defaultCategories);
      }

      // Initialize default brands
      const existingBrands = await db.select().from(brands).limit(1);
      if (existingBrands.length === 0) {
        const defaultBrands = [
          { 
            name: "Nike", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png",
            description: "Just Do It - Marca líder en deportivos",
            catalogUrl: "https://nike.com/catalog",
            isActive: true
          },
          { 
            name: "Adidas", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png",
            description: "Impossible is Nothing - Deportivos de alta calidad",
            catalogUrl: "https://adidas.com/catalog",
            isActive: true
          },
          { 
            name: "Puma", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Puma-Logo.png",
            description: "Forever Faster - Estilo deportivo innovador",
            catalogUrl: "https://puma.com/catalog",
            isActive: true
          },
          { 
            name: "Jordan", 
            logo: "https://logoeps.com/wp-content/uploads/2013/03/jordan-vector-logo.png",
            description: "Jumpman - Calzado de baloncesto premium",
            catalogUrl: "https://jordan.com/catalog",
            isActive: true
          },
          { 
            name: "Asics", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/ASICS-Logo.png",
            description: "Sound Mind, Sound Body - Tecnología japonesa",
            catalogUrl: "https://asics.com/catalog",
            isActive: true
          },
          { 
            name: "New Balance", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/New-Balance-Logo.png",
            description: "Endorsed by No One - Calidad y rendimiento",
            catalogUrl: "https://newbalance.com/catalog",
            isActive: true
          },
          { 
            name: "Under Armour", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Under-Armour-Logo.png",
            description: "I Will - Innovación deportiva y rendimiento",
            catalogUrl: "https://underarmour.com/catalog",
            isActive: true
          },
          { 
            name: "Reebok", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Reebok-Logo.png",
            description: "Be More Human - Fitness y lifestyle",
            catalogUrl: "https://reebok.com/catalog",
            isActive: true
          },
          { 
            name: "Skechers", 
            logo: "https://logos-world.net/wp-content/uploads/2020/04/Skechers-Logo.png",
            description: "Comfort Technology - Comodidad y estilo",
            catalogUrl: "https://skechers.com/catalog",
            isActive: true
          },
          { 
            name: "On Cloud", 
            logo: "https://logos-world.net/wp-content/uploads/2020/12/On-Running-Logo.png",
            description: "Run on Clouds - Tecnología suiza innovadora",
            catalogUrl: "https://on-running.com/catalog",
            isActive: true
          }
        ];
        
        await db.insert(brands).values(defaultBrands);
      }

      // Initialize admin user only if it doesn't exist
      const existingAdmin = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
      if (existingAdmin.length === 0) {
        await db.insert(users).values({
          username: "admin",
          email: "admin@zapashop.com",
          password: "admin123",
          firstName: "Administrador",
          lastName: "ZapaShop",
          phone: null,
          isSeller: false,
          isAdmin: true,
          credits: "0",
          totalPurchases: "0",
          loyaltyLevel: "platinum",
        });
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUserCredits(userId: string, amount: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ credits: amount })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.username, username), eq(users.password, password)));
    return user;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Brand methods
  async getBrands(): Promise<Brand[]> {
    return await db.select().from(brands).where(eq(brands.isActive, true));
  }

  async getBrandsWithProducts(): Promise<BrandWithProducts[]> {
    const brandList = await db.select().from(brands).where(eq(brands.isActive, true));
    const allProducts = await db.select().from(products);
    const allCategories = await db.select().from(categories);
    
    return brandList.map(brand => {
      const brandProducts = allProducts
        .filter(product => product.brandId === brand.id)
        .map(product => ({
          ...product,
          category: product.categoryId ? allCategories.find(c => c.id === product.categoryId) : undefined,
          brand: brand
        } as ProductWithCategory));
      
      return {
        ...brand,
        products: brandProducts,
        productCount: brandProducts.length
      };
    });
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const [newBrand] = await db.insert(brands).values(brand).returning();
    return newBrand;
  }

  async updateBrand(id: string, brand: InsertBrand): Promise<Brand | undefined> {
    const [updatedBrand] = await db.update(brands)
      .set(brand)
      .where(eq(brands.id, id))
      .returning();
    return updatedBrand;
  }

  // Product methods
  async getProducts(): Promise<ProductWithCategory[]> {
    const result = await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      categoryId2: categories.id,
      categoryName: categories.name,
      categoryEmoji: categories.emoji,
      categoryDescription: categories.description
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.id)); // Orden cronológico: más recientes arriba
    
    return result.map(item => ({
      ...item,
      category: item.categoryId2 ? {
        id: item.categoryId2,
        name: item.categoryName!,
        emoji: item.categoryEmoji!,
        description: item.categoryDescription
      } : undefined
    }));
  }

  async getProductsByCategory(categoryId: string): Promise<ProductWithCategory[]> {
    return await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        description: categories.description
      }
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.categoryId, categoryId));
  }

  async getProductsByBrand(brandId: string): Promise<ProductWithCategory[]> {
    return await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        description: categories.description
      }
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.brandId, brandId));
  }

  async getFlashSaleProducts(): Promise<ProductWithCategory[]> {
    return await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        description: categories.description
      }
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isFlashSale, true));
  }

  async getFeaturedProducts(): Promise<ProductWithCategory[]> {
    return await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        description: categories.description
      }
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isFeatured, true));
  }

  async getProduct(id: string): Promise<ProductWithCategory | undefined> {
    const result = await db.select({
      id: products.id,
      name: products.name,
      nameNormalized: products.nameNormalized,
      description: products.description,
      price: products.price,
      originalPrice: products.originalPrice,
      discountPercentage: products.discountPercentage,
      categoryId: products.categoryId,
      brandId: products.brandId,
      sellerId: products.sellerId,
      imageUrl: products.imageUrl,
      images: products.images,
      reference: products.reference,
      sizes: products.sizes,
      colors: products.colors,

      rating: products.rating,
      reviewCount: products.reviewCount,
      isFlashSale: products.isFlashSale,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        description: categories.description
      }
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);
    
    return result[0];
  }

  async getProductByReference(reference: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.reference, reference));
    return product;
  }

  // Función utilitaria para normalizar nombres
  private normalizeProductName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  async getProductByNameNormalized(nameNormalized: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.nameNormalized, nameNormalized));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    // Generar nameNormalized automáticamente
    const nameNormalized = this.normalizeProductName(product.name);
    const productWithNormalized = { ...product, nameNormalized };
    
    const [newProduct] = await db.insert(products).values(productWithNormalized).returning();
    return newProduct;
  }

  // Image methods
  async getImageByHash(hash: string): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.sha256, hash));
    return image;
  }

  async createImage(image: InsertImage): Promise<Image> {
    const [newImage] = await db.insert(images).values(image).returning();
    return newImage;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Promotion methods
  async getPromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions);
  }

  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();
    return await db.select().from(promotions)
      .where(and(
        eq(promotions.isActive, true),
        lte(promotions.startDate, now),
        gte(promotions.endDate, now)
      ));
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [newPromotion] = await db.insert(promotions).values(promotion).returning();
    return newPromotion;
  }

  async updatePromotion(id: string, promotion: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updatedPromotion] = await db.update(promotions)
      .set(promotion)
      .where(eq(promotions.id, id))
      .returning();
    return updatedPromotion;
  }

  async deletePromotion(id: string): Promise<boolean> {
    const result = await db.delete(promotions).where(eq(promotions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Event methods
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async getActiveEvents(): Promise<Event[]> {
    const now = new Date();
    return await db.select().from(events)
      .where(and(
        eq(events.isActive, true),
        lte(events.startDate, now),
        gte(events.endDate, now)
      ));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updatedEvent] = await db.update(events)
      .set(event)
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Cart methods
  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    return await db.select({
      id: cartItems.id,
      userId: cartItems.userId,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      createdAt: cartItems.createdAt,
      product: {
        id: products.id,
        name: products.name,
        nameNormalized: products.nameNormalized,
        description: products.description,
        price: products.price,
        originalPrice: products.originalPrice,
        discountPercentage: products.discountPercentage,
        categoryId: products.categoryId,
        brandId: products.brandId,
        sellerId: products.sellerId,
        imageUrl: products.imageUrl,
        images: products.images,
        reference: products.reference,
        sizes: products.sizes,
        colors: products.colors,
  
        rating: products.rating,
        reviewCount: products.reviewCount,
        isFlashSale: products.isFlashSale,
        isFeatured: products.isFeatured,
        createdAt: products.createdAt
      }
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId));
  }

  async addToCart(cartItem: InsertCartItem): Promise<CartItem> {
    const [newCartItem] = await db.insert(cartItems).values(cartItem).returning();
    return newCartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updatedCartItem] = await db.update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return updatedCartItem;
  }

  async removeFromCart(id: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async clearCart(userId: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.userId, userId));
    return (result.rowCount ?? 0) >= 0;
  }

  // Customer Savings methods
  async getCustomerSavings(customerId: string): Promise<CustomerSavings | undefined> {
    const [savings] = await db.select().from(customerSavings).where(eq(customerSavings.customerId, customerId));
    return savings;
  }

  async createCustomerSavings(customerSaving: InsertCustomerSavings): Promise<CustomerSavings> {
    const [newCustomerSavings] = await db.insert(customerSavings).values(customerSaving).returning();
    return newCustomerSavings;
  }

  async updateCustomerSavings(customerId: string, updateData: Partial<InsertCustomerSavings>): Promise<CustomerSavings | undefined> {
    const [updatedCustomerSavings] = await db.update(customerSavings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(customerSavings.customerId, customerId))
      .returning();
    return updatedCustomerSavings;
  }

  async addSavings(customerId: string, amount: string): Promise<CustomerSavings | undefined> {
    const existingSaving = await this.getCustomerSavings(customerId);
    
    if (!existingSaving) {
      return await this.createCustomerSavings({
        customerId,
        totalSaved: amount,
        achievementsUnlocked: [],
        lastPurchaseAmount: "0",
        totalPurchases: 0
      });
    } else {
      const currentSavings = parseFloat(existingSaving.totalSaved || "0");
      const addAmount = parseFloat(amount);
      const newTotal = currentSavings + addAmount;
      
      return await this.updateCustomerSavings(customerId, {
        totalSaved: newTotal.toString()
      });
    }
  }

  async applySavingsDiscount(customerId: string, discountAmount: string): Promise<CustomerSavings | undefined> {
    const existingSaving = await this.getCustomerSavings(customerId);
    if (!existingSaving) return undefined;

    const currentSavings = parseFloat(existingSaving.totalSaved || "0");
    const discount = parseFloat(discountAmount);
    const newTotal = Math.max(0, currentSavings - discount);
    
    return await this.updateCustomerSavings(customerId, {
      totalSaved: newTotal.toString()
    });
  }

  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getProductReviews(productId: string): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(reviews.createdAt);
  }

  async getProductWithReviews(id: string): Promise<ProductWithReviews | undefined> {
    const product = await this.getProduct(id);
    if (!product) {
      return undefined;
    }

    const productReviews = await this.getProductReviews(id);
    
    return {
      ...product,
      reviews: productReviews,
    };
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getCustomerOrdersForProduct(customerId: string, productId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.productId, productId)
      ))
      .orderBy(orders.createdAt);
  }

  async updateOrderStatus(orderId: string, updateData: { status?: string; deliveryTime?: string; notes?: string }): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set({ 
        ...(updateData.status && { status: updateData.status }),
        ...(updateData.deliveryTime && { deliveryTime: updateData.deliveryTime }),
        ...(updateData.notes && { notes: updateData.notes }),
        updatedAt: new Date() 
      })
      .where(eq(orders.id, orderId))
      .returning();
    return updatedOrder;
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    const orderList = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(orders.createdAt);
    return orderList;
  }

  async getOrdersByTrackingNumber(trackingNumber: string): Promise<Order[]> {
    const orderList = await db.select()
      .from(orders)
      .where(eq(orders.trackingNumber, trackingNumber));
    return orderList;
  }

  async getAllOrders(): Promise<Order[]> {
    const orderList = await db.select()
      .from(orders)
      .orderBy(orders.createdAt);
    return orderList;
  }
}

export const storage = new DatabaseStorage();
