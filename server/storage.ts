import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, type CartItem, type InsertCartItem, type ProductWithCategory, type CartItemWithProduct, type Brand, type InsertBrand, type BrandWithProducts } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  // Cart methods
  getCartItems(userId: string): Promise<CartItemWithProduct[]>;
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private categories: Map<string, Category>;
  private brands: Map<string, Brand>;
  private products: Map<string, Product>;
  private cartItems: Map<string, CartItem>;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.brands = new Map();
    this.products = new Map();
    this.cartItems = new Map();
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
        name: "Reebok", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Reebok-Logo.png",
        description: "Be More Human - Fitness y lifestyle",
        catalogUrl: "https://reebok.com/catalog",
        isActive: true
      },
      { 
        name: "Converse", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Converse-Logo.png",
        description: "All Star - Estilo clásico y urbano",
        catalogUrl: "https://converse.com/catalog",
        isActive: true
      },
      { 
        name: "Vans", 
        logo: "https://logos-world.net/wp-content/uploads/2020/04/Vans-Logo.png",
        description: "Off The Wall - Cultura skate y street",
        catalogUrl: "https://vans.com/catalog",
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      isSeller: insertUser.isSeller ?? false
    };
    this.users.set(id, user);
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
}

export const storage = new MemStorage();
