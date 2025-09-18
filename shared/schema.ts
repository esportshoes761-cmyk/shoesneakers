import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  isSeller: integer("is_seller", { mode: "boolean" }).default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
  credits: text("credits").default("0"),
  totalPurchases: text("total_purchases").default("0"),
  loyaltyLevel: text("loyalty_level").default("bronze"), // bronze, silver, gold, platinum
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description"),
});

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  logo: text("logo").notNull(),
  description: text("description"),
  catalogUrl: text("catalog_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  displayLocation: text("display_location").default("client"), // 'admin', 'client' - STRICT SEPARATION
});

export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  discountPercentage: integer("discount_percentage"),
  discountAmount: text("discount_amount"),
  code: text("code").unique(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  minPurchase: text("min_purchase"),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  eventType: text("event_type").notNull(), // 'flash_sale', 'promotion', 'new_arrival', 'seasonal'
  priority: integer("priority").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Tabla para imágenes con hash único
export const images = sqliteTable("images", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // Tamaño en bytes
  sha256: text("sha256").notNull(), // Hash SHA-256 (duplicates allowed)
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(), // Nombre normalizado solo para búsquedas, ya no unique
  description: text("description"),
  price: text("price").notNull(),
  originalPrice: text("original_price"),
  discountPercentage: integer("discount_percentage").default(0),
  categoryId: text("category_id").references(() => categories.id),
  brandId: text("brand_id").references(() => brands.id),
  sellerId: text("seller_id").references(() => users.id),
  imageUrl: text("image_url"),
  images: text("images", { mode: "json" }).$type<string[]>().default(sql`'[]'`), // Hasta 9 imágenes
  reference: text("reference"), // Referencia del producto
  sizes: text("sizes", { mode: "json" }).$type<string[]>().default(sql`'[]'`), // Tallas disponibles
  colors: text("colors", { mode: "json" }).$type<string[]>().default(sql`'[]'`), // Colores disponibles
  rating: text("rating").default("0"),
  reviewCount: integer("review_count").default(0),
  isFlashSale: integer("is_flash_sale", { mode: "boolean" }).default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const cartItems = sqliteTable("cart_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  productId: text("product_id").references(() => products.id),
  quantity: integer("quantity").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Tabla para transacciones de créditos
export const creditTransactions = sqliteTable("credit_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  amount: text("amount").notNull(),
  type: text("type").notNull(), // 'earned', 'spent', 'bonus'
  description: text("description").notNull(),
  orderId: text("order_id"), // Referencia a orden si aplica
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Tabla para sesiones de usuario
export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Tabla para ahorros por cliente (sin necesidad de login)
export const customerSavings = sqliteTable("customer_savings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().unique(), // UUID único por cliente
  totalSaved: text("total_saved").default("0"),
  achievementsUnlocked: text("achievements_unlocked", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  lastPurchaseAmount: text("last_purchase_amount").default("0"),
  totalPurchases: integer("total_purchases").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").references(() => products.id).notNull(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  rating: integer("rating").notNull(), // 1-5 estrellas
  comment: text("comment"),
  isVerified: integer("is_verified", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  productId: text("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").default(1),
  totalAmount: text("total_amount"),
  status: text("status").notNull().default("confirmed"), // 'confirmed', 'picked_up', 'in_transit', 'delivered'
  deliveryTime: text("delivery_time"),
  notes: text("notes"),
  whatsappSent: integer("whatsapp_sent", { mode: "boolean" }).default(true),
  trackingNumber: text("tracking_number"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSavingsSchema = createInsertSchema(customerSavings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  achievementsUnlocked: z.array(z.string()).optional(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertBrandSchema = createInsertSchema(brands).omit({
  id: true,
}).extend({
  displayLocation: z.enum(["admin", "client"]).optional(),
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
}).extend({
  images: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;

export type InsertCustomerSavings = z.infer<typeof insertCustomerSavingsSchema>;
export type CustomerSavings = typeof customerSavings.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Derived types for complex queries
export type ProductWithCategory = Product & {
  category: Category | null;
  brand: Brand | null;
};

export type CartItemWithProduct = CartItem & {
  product: ProductWithCategory | null;
};

export type BrandWithProducts = Brand & {
  products: Product[];
  productCount?: number;
};

export type ProductWithReviews = Product & {
  reviews: Review[];
  category: Category | null;
  brand: Brand | null;
};