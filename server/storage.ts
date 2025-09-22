import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, type CartItem, type InsertCartItem, type ProductWithCategory, type CartItemWithProduct, type Brand, type InsertBrand, type BrandWithProducts, type Promotion, type InsertPromotion, type Event, type InsertEvent, type CustomerSavings, type InsertCustomerSavings, type Review, type InsertReview, type Order, type InsertOrder, type ProductWithReviews, type Image, type InsertImage, type SelectThemeSettings, type InsertThemeSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, categories, brands, products, promotions, events, cartItems, customerSavings, reviews, orders, images, themeSettings } from "@shared/schema";
import { eq, and, gte, lte, ilike, inArray, desc, or, like, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>; // 🔒 SECURE: Added for session-based auth
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
  getBrandsByLocation(location: string): Promise<Brand[]>;
  getBrandsWithProductsByLocation(location: string): Promise<BrandWithProducts[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, brand: InsertBrand): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<boolean>;

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
  updateProductsBulk(productIds: string[], updates: Partial<InsertProduct>): Promise<{ updated: number; errors: Array<{ id: string; error: string }> }>;
  deleteProduct(id: string): Promise<boolean>;
  getProductWithReviews(id: string): Promise<ProductWithReviews | undefined>;

  // Image methods
  getAllImages(): Promise<Image[]>;
  getImageByHash(hash: string): Promise<Image | undefined>;
  createImage(image: InsertImage): Promise<Image>;
  isImageUsedByProducts(imageUrl: string): Promise<boolean>;

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

  // Duplicate detection methods
  getDuplicateProductsByReference(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>>;
  getDuplicateProductsByNameBrand(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>>;
  getDuplicateProductsByImageHash(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>>;
  mergeProducts(primaryId: string, duplicateIds: string[], strategy: 'keep_primary' | 'merge_data'): Promise<Product | undefined>;
  
  // Package duplicate detection
  checkPackageDuplicates(imageUrls: string[]): Promise<Array<{ imageUrl: string; existingProduct: { id: string; name: string; reference: string; brandName: string; categoryName: string; imageUrl: string; }; duplicateCount: number; }>>;

  // Theme Settings methods
  getThemeSettings(): Promise<SelectThemeSettings[]>;
  getActiveTheme(): Promise<SelectThemeSettings | undefined>;
  getThemeById(id: string): Promise<SelectThemeSettings | undefined>;
  createTheme(theme: InsertThemeSettings): Promise<SelectThemeSettings>;
  updateTheme(id: string, theme: Partial<InsertThemeSettings>): Promise<SelectThemeSettings | undefined>;
  deleteTheme(id: string): Promise<boolean>;
  activateTheme(id: string): Promise<SelectThemeSettings | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user[0];
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return user[0];
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user[0];
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const newUser = await db.insert(users).values({
        id: randomUUID(),
        ...user
      }).returning();
      return newUser[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserCredits(userId: string, amount: string): Promise<User | undefined> {
    try {
      const updatedUser = await db.update(users)
        .set({ credits: amount })
        .where(eq(users.id, userId))
        .returning();
      return updatedUser[0];
    } catch (error) {
      console.error('Error updating user credits:', error);
      return undefined;
    }
  }

  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    try {
      const user = await db.select().from(users)
        .where(and(eq(users.username, username), eq(users.password, password)))
        .limit(1);
      return user[0];
    } catch (error) {
      console.error('Error authenticating user:', error);
      return undefined;
    }
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    try {
      return await db.select().from(categories);
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      const newCategory = await db.insert(categories).values({
        id: randomUUID(),
        ...category
      }).returning();
      return newCategory[0];
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // Brand methods
  async getBrands(): Promise<Brand[]> {
    try {
      return await db.select().from(brands);
    } catch (error) {
      console.error('Error getting brands:', error);
      return [];
    }
  }

  async getBrandsWithProducts(): Promise<BrandWithProducts[]> {
    try {
      const allBrands = await db.select().from(brands);
      const brandsWithProducts: BrandWithProducts[] = [];
      
      for (const brand of allBrands) {
        // 🔍 DEBUG: Log the brand being processed
        console.log(`🔍 Processing brand: ${brand.name} (ID: ${brand.id})`);
        
        const brandProducts = await db.select().from(products)
          .where(eq(products.brandId, brand.id));
        
        // 🔍 DEBUG: Log products found
        console.log(`🔍 Found ${brandProducts.length} products for brand: ${brand.name}`);
        
        brandsWithProducts.push({
          ...brand,
          products: brandProducts
        });
      }
      
      return brandsWithProducts;
    } catch (error) {
      console.error('Error getting brands with products:', error);
      return [];
    }
  }

  async getBrandsByLocation(location: string): Promise<Brand[]> {
    try {
      return await db.select().from(brands)
        .where(eq(brands.displayLocation, location));
    } catch (error) {
      console.error('Error getting brands by location:', error);
      return [];
    }
  }

  async getBrandsWithProductsByLocation(location: string): Promise<BrandWithProducts[]> {
    try {
      const locationBrands = await db.select().from(brands)
        .where(eq(brands.displayLocation, location));
      
      const brandsWithProducts: BrandWithProducts[] = [];
      
      for (const brand of locationBrands) {
        const brandProducts = await db.select().from(products)
          .where(eq(products.brandId, brand.id));
        
        brandsWithProducts.push({
          ...brand,
          products: brandProducts
        });
      }
      
      return brandsWithProducts;
    } catch (error) {
      console.error('Error getting brands with products by location:', error);
      return [];
    }
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    try {
      const brand = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
      return brand[0];
    } catch (error) {
      console.error('Error getting brand:', error);
      return undefined;
    }
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    try {
      const newBrand = await db.insert(brands).values({
        id: randomUUID(),
        ...brand
      }).returning();
      return newBrand[0];
    } catch (error) {
      console.error('Error creating brand:', error);
      throw error;
    }
  }

  async updateBrand(id: string, brand: InsertBrand): Promise<Brand | undefined> {
    try {
      const updatedBrand = await db.update(brands)
        .set(brand)
        .where(eq(brands.id, id))
        .returning();
      return updatedBrand[0];
    } catch (error) {
      console.error('Error updating brand:', error);
      return undefined;
    }
  }

  async deleteBrand(id: string): Promise<boolean> {
    try {
      const result = await db.delete(brands).where(eq(brands.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting brand:', error);
      return false;
    }
  }

  // Product methods
  async getProducts(): Promise<ProductWithCategory[]> {
    try {
      const productsList = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id));

      return productsList;
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  async getProductsByCategory(categoryId: string): Promise<ProductWithCategory[]> {
    try {
      const productsList = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.categoryId, categoryId));

      return productsList;
    } catch (error) {
      console.error('Error getting products by category:', error);
      return [];
    }
  }

  async getProductsByBrand(brandId: string): Promise<ProductWithCategory[]> {
    try {
      const productsList = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.brandId, brandId));

      return productsList;
    } catch (error) {
      console.error('Error getting products by brand:', error);
      return [];
    }
  }

  async getFlashSaleProducts(): Promise<ProductWithCategory[]> {
    try {
      const productsList = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.isFlashSale, true));

      return productsList;
    } catch (error) {
      console.error('Error getting flash sale products:', error);
      return [];
    }
  }

  async getFeaturedProducts(): Promise<ProductWithCategory[]> {
    try {
      const productsList = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.isFeatured, true));

      return productsList;
    } catch (error) {
      console.error('Error getting featured products:', error);
      return [];
    }
  }

  async getProduct(id: string): Promise<ProductWithCategory | undefined> {
    try {
      const product = await db.select({
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
        category: categories,
        brand: brands
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.id, id))
      .limit(1);

      return product[0];
    } catch (error) {
      console.error('Error getting product:', error);
      return undefined;
    }
  }

  async getProductByReference(reference: string): Promise<Product | undefined> {
    try {
      const product = await db.select().from(products)
        .where(eq(products.reference, reference))
        .limit(1);
      return product[0];
    } catch (error) {
      console.error('Error getting product by reference:', error);
      return undefined;
    }
  }

  async getProductByNameNormalized(nameNormalized: string): Promise<Product | undefined> {
    try {
      const product = await db.select().from(products)
        .where(eq(products.nameNormalized, nameNormalized))
        .limit(1);
      return product[0];
    } catch (error) {
      console.error('Error getting product by name normalized:', error);
      return undefined;
    }
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    try {
      const newProduct = await db.insert(products).values({
        id: randomUUID(),
        ...product
      }).returning();
      return newProduct[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    try {
      const updatedProduct = await db.update(products)
        .set(product)
        .where(eq(products.id, id))
        .returning();
      return updatedProduct[0];
    } catch (error) {
      console.error('Error updating product:', error);
      return undefined;
    }
  }

  async updateProductsBulk(productIds: string[], updates: Partial<InsertProduct>): Promise<{ updated: number; errors: Array<{ id: string; error: string }> }> {
    try {
      // Use a transaction to update all products atomically
      const result = await db.update(products)
        .set(updates)
        .where(inArray(products.id, productIds))
        .returning();

      return {
        updated: result.length,
        errors: []
      };
    } catch (error) {
      console.error('Error updating products in bulk:', error);
      
      // If bulk update fails, try updating each product individually to identify which ones failed
      const errors: Array<{ id: string; error: string }> = [];
      let updated = 0;
      
      for (const productId of productIds) {
        try {
          await db.update(products)
            .set(updates)
            .where(eq(products.id, productId));
          updated++;
        } catch (individualError) {
          errors.push({
            id: productId,
            error: individualError instanceof Error ? individualError.message : 'Unknown error'
          });
        }
      }
      
      return { updated, errors };
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      await db.delete(products).where(eq(products.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  async getProductWithReviews(id: string): Promise<ProductWithReviews | undefined> {
    try {
      const product = await this.getProduct(id);
      if (!product) return undefined;

      const productReviews = await this.getProductReviews(id);
      
      return {
        ...product,
        reviews: productReviews
      };
    } catch (error) {
      console.error('Error getting product with reviews:', error);
      return undefined;
    }
  }

  // Image methods
  async getAllImages(): Promise<Image[]> {
    try {
      return await db.select().from(images);
    } catch (error) {
      console.error('Error getting all images:', error);
      return [];
    }
  }

  async getImageByHash(hash: string): Promise<Image | undefined> {
    try {
      const image = await db.select().from(images)
        .where(eq(images.sha256, hash))
        .limit(1);
      return image[0];
    } catch (error) {
      console.error('Error getting image by hash:', error);
      return undefined;
    }
  }

  async createImage(image: InsertImage): Promise<Image> {
    try {
      const newImage = await db.insert(images).values({
        id: randomUUID(),
        ...image
      }).returning();
      return newImage[0];
    } catch (error) {
      console.error('Error creating image:', error);
      throw error;
    }
  }

  async isImageUsedByProducts(imageUrl: string): Promise<boolean> {
    try {
      const productsUsingImage = await db.select().from(products)
        .where(or(
          eq(products.imageUrl, imageUrl),
          like(products.images, `%${imageUrl}%`)
        ))
        .limit(1);
      
      return productsUsingImage.length > 0;
    } catch (error) {
      console.error('Error checking if image is used:', error);
      return false;
    }
  }

  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    try {
      const newReview = await db.insert(reviews).values({
        id: randomUUID(),
        ...review
      }).returning();
      return newReview[0];
    } catch (error) {
      console.error('Error creating review:', error);
      throw error;
    }
  }

  async getProductReviews(productId: string): Promise<Review[]> {
    try {
      return await db.select().from(reviews)
        .where(eq(reviews.productId, productId))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      console.error('Error getting product reviews:', error);
      return [];
    }
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    try {
      const newOrder = await db.insert(orders).values({
        id: randomUUID(),
        ...order
      }).returning();
      return newOrder[0];
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async getCustomerOrdersForProduct(customerId: string, productId: string): Promise<Order[]> {
    try {
      return await db.select().from(orders)
        .where(and(
          eq(orders.customerId, customerId),
          eq(orders.productId, productId)
        ))
        .orderBy(desc(orders.createdAt));
    } catch (error) {
      console.error('Error getting customer orders for product:', error);
      return [];
    }
  }

  async updateOrderStatus(orderId: string, updateData: { status?: string; deliveryTime?: string; notes?: string }): Promise<Order | undefined> {
    try {
      const updatedOrder = await db.update(orders)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning();
      return updatedOrder[0];
    } catch (error) {
      console.error('Error updating order status:', error);
      return undefined;
    }
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    try {
      return await db.select().from(orders)
        .where(eq(orders.customerId, customerId))
        .orderBy(desc(orders.createdAt));
    } catch (error) {
      console.error('Error getting orders by customer ID:', error);
      return [];
    }
  }

  async getOrdersByTrackingNumber(trackingNumber: string): Promise<Order[]> {
    try {
      return await db.select().from(orders)
        .where(eq(orders.trackingNumber, trackingNumber));
    } catch (error) {
      console.error('Error getting orders by tracking number:', error);
      return [];
    }
  }

  async getAllOrders(): Promise<Order[]> {
    try {
      return await db.select().from(orders)
        .orderBy(desc(orders.createdAt));
    } catch (error) {
      console.error('Error getting all orders:', error);
      return [];
    }
  }

  // Promotion methods
  async getPromotions(): Promise<Promotion[]> {
    try {
      return await db.select().from(promotions);
    } catch (error) {
      console.error('Error getting promotions:', error);
      return [];
    }
  }

  async getActivePromotions(): Promise<Promotion[]> {
    try {
      const now = new Date();
      return await db.select().from(promotions)
        .where(and(
          eq(promotions.isActive, true),
          lte(promotions.startDate, now),
          gte(promotions.endDate, now)
        ));
    } catch (error) {
      console.error('Error getting active promotions:', error);
      return [];
    }
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    try {
      const promotion = await db.select().from(promotions)
        .where(eq(promotions.id, id))
        .limit(1);
      return promotion[0];
    } catch (error) {
      console.error('Error getting promotion:', error);
      return undefined;
    }
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    try {
      const newPromotion = await db.insert(promotions).values({
        id: randomUUID(),
        ...promotion
      }).returning();
      return newPromotion[0];
    } catch (error) {
      console.error('Error creating promotion:', error);
      throw error;
    }
  }

  async updatePromotion(id: string, promotion: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    try {
      const updatedPromotion = await db.update(promotions)
        .set(promotion)
        .where(eq(promotions.id, id))
        .returning();
      return updatedPromotion[0];
    } catch (error) {
      console.error('Error updating promotion:', error);
      return undefined;
    }
  }

  async deletePromotion(id: string): Promise<boolean> {
    try {
      await db.delete(promotions).where(eq(promotions.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting promotion:', error);
      return false;
    }
  }

  // Event methods
  async getEvents(): Promise<Event[]> {
    try {
      return await db.select().from(events);
    } catch (error) {
      console.error('Error getting events:', error);
      return [];
    }
  }

  async getActiveEvents(): Promise<Event[]> {
    try {
      const now = new Date();
      return await db.select().from(events)
        .where(and(
          eq(events.isActive, true),
          lte(events.startDate, now),
          gte(events.endDate, now)
        ));
    } catch (error) {
      console.error('Error getting active events:', error);
      return [];
    }
  }

  async getEvent(id: string): Promise<Event | undefined> {
    try {
      const event = await db.select().from(events)
        .where(eq(events.id, id))
        .limit(1);
      return event[0];
    } catch (error) {
      console.error('Error getting event:', error);
      return undefined;
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    try {
      const newEvent = await db.insert(events).values({
        id: randomUUID(),
        ...event
      }).returning();
      return newEvent[0];
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    try {
      const updatedEvent = await db.update(events)
        .set(event)
        .where(eq(events.id, id))
        .returning();
      return updatedEvent[0];
    } catch (error) {
      console.error('Error updating event:', error);
      return undefined;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      await db.delete(events).where(eq(events.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Cart methods
  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    try {
      const cartItemsList = await db.select()
        .from(cartItems)
        .leftJoin(products, eq(cartItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(eq(cartItems.userId, userId));

      // Transform the result to match CartItemWithProduct type
      return cartItemsList.map((item) => ({
        id: item.cart_items.id,
        userId: item.cart_items.userId,
        productId: item.cart_items.productId,
        quantity: item.cart_items.quantity,
        createdAt: item.cart_items.createdAt,
        product: item.products ? {
          ...item.products,
          category: item.categories,
          brand: item.brands
        } : null
      }));
    } catch (error) {
      console.error('Error getting cart items:', error);
      return [];
    }
  }

  async addToCart(cartItem: InsertCartItem): Promise<CartItem> {
    try {
      const newCartItem = await db.insert(cartItems).values({
        id: randomUUID(),
        ...cartItem
      }).returning();
      return newCartItem[0];
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    try {
      const updatedCartItem = await db.update(cartItems)
        .set({ quantity })
        .where(eq(cartItems.id, id))
        .returning();
      return updatedCartItem[0];
    } catch (error) {
      console.error('Error updating cart item:', error);
      return undefined;
    }
  }

  async removeFromCart(id: string): Promise<boolean> {
    try {
      await db.delete(cartItems).where(eq(cartItems.id, id));
      return true;
    } catch (error) {
      console.error('Error removing from cart:', error);
      return false;
    }
  }

  async clearCart(userId: string): Promise<boolean> {
    try {
      await db.delete(cartItems).where(eq(cartItems.userId, userId));
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  }

  // Customer Savings methods
  async getCustomerSavings(customerId: string): Promise<CustomerSavings | undefined> {
    try {
      const customerSaving = await db.select().from(customerSavings)
        .where(eq(customerSavings.customerId, customerId))
        .limit(1);
      return customerSaving[0];
    } catch (error) {
      console.error('Error getting customer savings:', error);
      return undefined;
    }
  }

  async createCustomerSavings(customerSaving: InsertCustomerSavings): Promise<CustomerSavings> {
    try {
      const newCustomerSavings = await db.insert(customerSavings).values({
        id: randomUUID(),
        ...customerSaving
      }).returning();
      return newCustomerSavings[0];
    } catch (error) {
      console.error('Error creating customer savings:', error);
      throw error;
    }
  }

  async updateCustomerSavings(customerId: string, updateData: Partial<InsertCustomerSavings>): Promise<CustomerSavings | undefined> {
    try {
      const updatedCustomerSavings = await db.update(customerSavings)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(customerSavings.customerId, customerId))
        .returning();
      return updatedCustomerSavings[0];
    } catch (error) {
      console.error('Error updating customer savings:', error);
      return undefined;
    }
  }

  async addSavings(customerId: string, amount: string): Promise<CustomerSavings | undefined> {
    try {
      const existing = await this.getCustomerSavings(customerId);
      if (!existing) {
        return await this.createCustomerSavings({
          customerId,
          totalSaved: amount,
          lastPurchaseAmount: amount,
          totalPurchases: 1
        });
      }

      const currentSaved = parseFloat(existing.totalSaved || "0");
      const newAmount = parseFloat(amount);
      const newTotal = (currentSaved + newAmount).toString();

      return await this.updateCustomerSavings(customerId, {
        totalSaved: newTotal,
        lastPurchaseAmount: amount,
        totalPurchases: (existing.totalPurchases || 0) + 1
      });
    } catch (error) {
      console.error('Error adding savings:', error);
      return undefined;
    }
  }

  async applySavingsDiscount(customerId: string, discountAmount: string): Promise<CustomerSavings | undefined> {
    try {
      const existing = await this.getCustomerSavings(customerId);
      if (!existing) return undefined;

      const currentSaved = parseFloat(existing.totalSaved || "0");
      const discount = parseFloat(discountAmount);
      const newTotal = Math.max(0, currentSaved - discount).toString();

      return await this.updateCustomerSavings(customerId, {
        totalSaved: newTotal
      });
    } catch (error) {
      console.error('Error applying savings discount:', error);
      return undefined;
    }
  }

  // Duplicate detection methods implementation
  async getDuplicateProductsByReference(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>> {
    try {
      let whereConditions = sql`reference IS NOT NULL AND reference != ''`;
      
      if (brandId) {
        whereConditions = sql`${whereConditions} AND brand_id = ${brandId}`;
      }

      const allProducts = await db.select().from(products).where(whereConditions);
      
      // Group by reference
      const groupedByReference = allProducts.reduce((acc, product) => {
        if (!product.reference) return acc;
        
        const key = product.reference;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(product);
        return acc;
      }, {} as Record<string, Product[]>);

      // Filter groups with more than 1 product (duplicates)
      return Object.entries(groupedByReference)
        .filter(([_, products]) => products.length > 1)
        .map(([key, products]) => ({
          key,
          products,
          count: products.length
        }))
        .sort((a, b) => b.count - a.count); // Sort by count desc
    } catch (error) {
      console.error('Error getting duplicates by reference:', error);
      return [];
    }
  }

  async getDuplicateProductsByNameBrand(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>> {
    try {
      let whereConditions = sql`name_normalized IS NOT NULL AND name_normalized != '' AND brand_id IS NOT NULL`;
      
      if (brandId) {
        whereConditions = sql`${whereConditions} AND brand_id = ${brandId}`;
      }

      const allProducts = await db.select().from(products).where(whereConditions);
      
      // Group by nameNormalized + brandId
      const groupedByNameBrand = allProducts.reduce((acc, product) => {
        if (!product.nameNormalized || !product.brandId) return acc;
        
        const key = `${product.nameNormalized}|${product.brandId}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(product);
        return acc;
      }, {} as Record<string, Product[]>);

      // Filter groups with more than 1 product (duplicates)
      return Object.entries(groupedByNameBrand)
        .filter(([_, products]) => products.length > 1)
        .map(([key, products]) => ({
          key,
          products,
          count: products.length
        }))
        .sort((a, b) => b.count - a.count); // Sort by count desc
    } catch (error) {
      console.error('Error getting duplicates by name+brand:', error);
      return [];
    }
  }

  async getDuplicateProductsByImageHash(brandId?: string): Promise<Array<{ key: string; products: Product[]; count: number }>> {
    try {
      // Get all images with their hashes
      const allImages = await db.select().from(images);
      const imageHashMap = allImages.reduce((acc, img) => {
        acc[img.path] = img.sha256;
        return acc;
      }, {} as Record<string, string>);

      let whereConditions = sql`image_url IS NOT NULL AND image_url != ''`;
      
      if (brandId) {
        whereConditions = sql`${whereConditions} AND brand_id = ${brandId}`;
      }

      const allProducts = await db.select().from(products).where(whereConditions);
      
      // Group by image hash
      const groupedByImageHash = allProducts.reduce((acc, product) => {
        if (!product.imageUrl) return acc;
        
        // Extract filename from image URL to get hash
        const imagePath = product.imageUrl.split('/').pop();
        const imageHash = imagePath ? imageHashMap[imagePath] : null;
        
        if (!imageHash) return acc;
        
        const key = imageHash;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(product);
        return acc;
      }, {} as Record<string, Product[]>);

      // Filter groups with more than 1 product (duplicates)
      return Object.entries(groupedByImageHash)
        .filter(([_, products]) => products.length > 1)
        .map(([key, products]) => ({
          key,
          products,
          count: products.length
        }))
        .sort((a, b) => b.count - a.count); // Sort by count desc
    } catch (error) {
      console.error('Error getting duplicates by image hash:', error);
      return [];
    }
  }

  async mergeProducts(primaryId: string, duplicateIds: string[], strategy: 'keep_primary' | 'merge_data'): Promise<Product | undefined> {
    if (!duplicateIds.length) {
      console.error('No duplicate IDs provided for merge');
      return undefined;
    }

    try {
      // Start transaction
      return await db.transaction(async (tx) => {
        // Get primary product
        const primaryProduct = await tx.select().from(products).where(eq(products.id, primaryId)).limit(1);
        if (!primaryProduct.length) {
          throw new Error('Primary product not found');
        }

        const primary = primaryProduct[0];

        // Get duplicate products for merging data if needed
        let mergedData = primary;
        if (strategy === 'merge_data') {
          const duplicateProducts = await tx.select().from(products).where(inArray(products.id, duplicateIds));
          
          // Merge logic: combine images, sizes, colors, update ratings
          const allImages = new Set<string>(primary.images || []);
          const allSizes = new Set<string>(primary.sizes || []);
          const allColors = new Set<string>(primary.colors || []);
          
          let totalReviews = primary.reviewCount || 0;
          let totalRating = (parseFloat(primary.rating || '0') * totalReviews);

          duplicateProducts.forEach(dup => {
            // Combine arrays
            (dup.images || []).forEach(img => allImages.add(img));
            (dup.sizes || []).forEach(size => allSizes.add(size));
            (dup.colors || []).forEach(color => allColors.add(color));
            
            // Merge ratings
            const dupReviews = dup.reviewCount || 0;
            const dupRating = parseFloat(dup.rating || '0');
            totalRating += dupRating * dupReviews;
            totalReviews += dupReviews;
          });

          // Calculate new average rating
          const newRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : primary.rating;

          mergedData = {
            ...primary,
            images: Array.from(allImages),
            sizes: Array.from(allSizes),
            colors: Array.from(allColors),
            rating: newRating,
            reviewCount: totalReviews
          };
        }

        // 1. Update all cartItems to point to primary product
        await tx.update(cartItems)
          .set({ productId: primaryId })
          .where(inArray(cartItems.productId, duplicateIds));

        // 2. Update all reviews to point to primary product
        await tx.update(reviews)
          .set({ productId: primaryId })
          .where(inArray(reviews.productId, duplicateIds));

        // 3. Update all orders to point to primary product
        await tx.update(orders)
          .set({ productId: primaryId })
          .where(inArray(orders.productId, duplicateIds));

        // 4. Update primary product with merged data if needed
        if (strategy === 'merge_data') {
          await tx.update(products)
            .set({
              images: mergedData.images,
              sizes: mergedData.sizes,
              colors: mergedData.colors,
              rating: mergedData.rating,
              reviewCount: mergedData.reviewCount
            })
            .where(eq(products.id, primaryId));
        }

        // 5. Delete duplicate products
        await tx.delete(products).where(inArray(products.id, duplicateIds));

        // Return the updated primary product
        const updatedPrimary = await tx.select().from(products).where(eq(products.id, primaryId)).limit(1);
        return updatedPrimary[0];
      });
    } catch (error) {
      console.error('Error merging products:', error);
      throw error;
    }
  }

  // Theme Settings methods
  async getThemeSettings(): Promise<SelectThemeSettings[]> {
    try {
      return await db.select().from(themeSettings);
    } catch (error) {
      console.error('Error getting theme settings:', error);
      return [];
    }
  }

  async getActiveTheme(): Promise<SelectThemeSettings | undefined> {
    try {
      const activeTheme = await db.select().from(themeSettings)
        .where(eq(themeSettings.isActive, true))
        .limit(1);
      return activeTheme[0];
    } catch (error) {
      console.error('Error getting active theme:', error);
      return undefined;
    }
  }

  async getThemeById(id: string): Promise<SelectThemeSettings | undefined> {
    try {
      const theme = await db.select().from(themeSettings)
        .where(eq(themeSettings.id, id))
        .limit(1);
      return theme[0];
    } catch (error) {
      console.error('Error getting theme by id:', error);
      return undefined;
    }
  }

  async createTheme(theme: InsertThemeSettings): Promise<SelectThemeSettings> {
    try {
      const newTheme = await db.insert(themeSettings).values({
        id: randomUUID(),
        ...theme
      }).returning();
      return newTheme[0];
    } catch (error) {
      console.error('Error creating theme:', error);
      throw error;
    }
  }

  async updateTheme(id: string, theme: Partial<InsertThemeSettings>): Promise<SelectThemeSettings | undefined> {
    try {
      const updatedTheme = await db.update(themeSettings)
        .set({
          ...theme,
          updatedAt: sql`(unixepoch())`
        })
        .where(eq(themeSettings.id, id))
        .returning();
      return updatedTheme[0];
    } catch (error) {
      console.error('Error updating theme:', error);
      return undefined;
    }
  }

  async deleteTheme(id: string): Promise<boolean> {
    try {
      await db.delete(themeSettings).where(eq(themeSettings.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting theme:', error);
      return false;
    }
  }

  async activateTheme(id: string): Promise<SelectThemeSettings | undefined> {
    try {
      // Critical business logic: Only one theme can be active at a time
      return await db.transaction(async (tx) => {
        // First, deactivate all themes
        await tx.update(themeSettings)
          .set({ isActive: false })
          .where(sql`1=1`); // Update all rows

        // Then activate the specified theme
        const activatedTheme = await tx.update(themeSettings)
          .set({ 
            isActive: true,
            updatedAt: sql`(unixepoch())`
          })
          .where(eq(themeSettings.id, id))
          .returning();
        
        return activatedTheme[0];
      });
    } catch (error) {
      console.error('Error activating theme:', error);
      return undefined;
    }
  }

  // Package duplicate detection
  async checkPackageDuplicates(imageUrls: string[]): Promise<Array<{ imageUrl: string; existingProduct: { id: string; name: string; reference: string; brandName: string; categoryName: string; imageUrl: string; }; duplicateCount: number; }>> {
    try {
      const duplicates: Array<{ imageUrl: string; existingProduct: { id: string; name: string; reference: string; brandName: string; categoryName: string; imageUrl: string; }; duplicateCount: number; }> = [];

      // Get all products with their brand and category information
      const allProducts = await this.getProducts();

      for (const imageUrl of imageUrls) {
        // Find products that use this specific image URL
        const productsWithImage = allProducts.filter(product => {
          // Check main imageUrl
          if (product.imageUrl === imageUrl) return true;
          
          // Check in images array if it exists
          if (product.images && Array.isArray(product.images)) {
            return product.images.includes(imageUrl);
          }
          
          return false;
        });

        if (productsWithImage.length > 0) {
          // Use the first product as the primary reference
          const firstProduct = productsWithImage[0];
          
          duplicates.push({
            imageUrl,
            existingProduct: {
              id: firstProduct.id,
              name: firstProduct.name,
              reference: firstProduct.reference || '',
              brandName: typeof firstProduct.brand === 'object' ? firstProduct.brand?.name || 'Sin marca' : 'Sin marca',
              categoryName: typeof firstProduct.category === 'object' ? firstProduct.category?.name || 'Sin categoría' : 'Sin categoría',
              imageUrl: firstProduct.imageUrl || '',
            },
            duplicateCount: productsWithImage.length, // How many products use this image
          });
        }
      }

      return duplicates;
    } catch (error) {
      console.error('Error checking package duplicates:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();