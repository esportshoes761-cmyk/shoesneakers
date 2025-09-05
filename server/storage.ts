import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, type CartItem, type InsertCartItem, type ProductWithCategory, type CartItemWithProduct, type Brand, type InsertBrand, type BrandWithProducts, type Promotion, type InsertPromotion, type Event, type InsertEvent, type CustomerSavings, type InsertCustomerSavings } from "@shared/schema";
import { randomUUID } from "crypto";

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

  // Product methods
  getProducts(): Promise<ProductWithCategory[]>;
  getProductsByCategory(categoryId: string): Promise<ProductWithCategory[]>;
  getProductsByBrand(brandId: string): Promise<ProductWithCategory[]>;
  getFlashSaleProducts(): Promise<ProductWithCategory[]>;
  getFeaturedProducts(): Promise<ProductWithCategory[]>;
  getProduct(id: string): Promise<ProductWithCategory | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

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

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.brands = new Map();
    this.products = new Map();
    this.promotions = new Map();
    this.events = new Map();
    this.cartItems = new Map();
    this.customerSavings = new Map();
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

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = { 
      ...insertProduct, 
      id,
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
      stock: insertProduct.stock ?? 0,
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

    const updatedProduct = { ...product, ...updateData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
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
}

export const storage = new MemStorage();
