import { db, sqlite } from './db';
import { users, categories, brands } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing SQLite database...');

    // Create tables using manual SQL to ensure they exist
    // This prevents errors if tables don't exist yet
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "emoji" text NOT NULL,
        "description" text
      );

      CREATE TABLE IF NOT EXISTS "brands" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "logo" text NOT NULL,
        "description" text,
        "catalog_url" text,
        "is_active" integer DEFAULT 1,
        "display_location" text DEFAULT 'client'
      );

      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "username" text NOT NULL UNIQUE,
        "email" text NOT NULL UNIQUE,
        "password" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "phone" text,
        "is_seller" integer DEFAULT 0,
        "is_admin" integer DEFAULT 0,
        "credits" text DEFAULT '0',
        "total_purchases" text DEFAULT '0',
        "loyalty_level" text DEFAULT 'bronze',
        "created_at" integer DEFAULT (unixepoch()),
        "updated_at" integer DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS "products" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "name_normalized" text NOT NULL,
        "description" text,
        "price" text NOT NULL,
        "original_price" text,
        "discount_percentage" integer DEFAULT 0,
        "category_id" text,
        "brand_id" text,
        "seller_id" text,
        "image_url" text,
        "images" text DEFAULT '[]',
        "reference" text,
        "sizes" text DEFAULT '[]',
        "colors" text DEFAULT '[]',
        "rating" text DEFAULT '0',
        "review_count" integer DEFAULT 0,
        "is_flash_sale" integer DEFAULT 0,
        "is_featured" integer DEFAULT 0,
        "created_at" integer DEFAULT (unixepoch()),
        FOREIGN KEY ("category_id") REFERENCES "categories" ("id"),
        FOREIGN KEY ("brand_id") REFERENCES "brands" ("id"),
        FOREIGN KEY ("seller_id") REFERENCES "users" ("id")
      );

      CREATE TABLE IF NOT EXISTS "customer_savings" (
        "id" text PRIMARY KEY NOT NULL,
        "customer_id" text NOT NULL UNIQUE,
        "total_saved" text DEFAULT '0',
        "achievements_unlocked" text DEFAULT '[]',
        "last_purchase_amount" text DEFAULT '0',
        "total_purchases" integer DEFAULT 0,
        "created_at" integer DEFAULT (unixepoch()),
        "updated_at" integer DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS "images" (
        "id" text PRIMARY KEY NOT NULL,
        "file_name" text NOT NULL,
        "original_name" text NOT NULL,
        "path" text NOT NULL,
        "mime_type" text NOT NULL,
        "size" integer NOT NULL,
        "sha256" text NOT NULL,
        "created_at" integer DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" text PRIMARY KEY NOT NULL,
        "product_id" text NOT NULL,
        "customer_id" text NOT NULL,
        "customer_name" text NOT NULL,
        "customer_email" text,
        "rating" integer NOT NULL,
        "comment" text,
        "is_verified" integer DEFAULT 0,
        "created_at" integer DEFAULT (unixepoch()),
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      );

      CREATE TABLE IF NOT EXISTS "orders" (
        "id" text PRIMARY KEY NOT NULL,
        "customer_id" text NOT NULL,
        "customer_name" text NOT NULL,
        "customer_email" text NOT NULL,
        "customer_phone" text NOT NULL,
        "customer_address" text NOT NULL,
        "product_id" text NOT NULL,
        "quantity" integer DEFAULT 1,
        "total_amount" text,
        "status" text NOT NULL DEFAULT 'confirmed',
        "delivery_time" text,
        "notes" text,
        "whatsapp_sent" integer DEFAULT 1,
        "tracking_number" text,
        "created_at" integer DEFAULT (unixepoch()),
        "updated_at" integer DEFAULT (unixepoch()),
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      );

      CREATE TABLE IF NOT EXISTS "promotions" (
        "id" text PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "discount_percentage" integer,
        "discount_amount" text,
        "code" text UNIQUE,
        "start_date" integer NOT NULL,
        "end_date" integer NOT NULL,
        "is_active" integer DEFAULT 1,
        "min_purchase" text,
        "max_uses" integer,
        "current_uses" integer DEFAULT 0,
        "created_at" integer DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS "events" (
        "id" text PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "image_url" text,
        "start_date" integer NOT NULL,
        "end_date" integer NOT NULL,
        "is_active" integer DEFAULT 1,
        "event_type" text NOT NULL,
        "priority" integer DEFAULT 0,
        "created_at" integer DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text,
        "product_id" text,
        "quantity" integer DEFAULT 1,
        "created_at" integer DEFAULT (unixepoch()),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id"),
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      );
    `;

    // Execute table creation SQL
    sqlite.exec(createTablesSQL);
    console.log('✅ SQLite tables created/verified');

    // Insert default categories only if they don't exist
    const defaultCategories = [
      { name: "Tacones", emoji: "👠", description: "Elegantes tacones para toda ocasión" },
      { name: "Deportivos", emoji: "👟", description: "Zapatos deportivos y cómodos" },
      { name: "Botas", emoji: "👢", description: "Botas para todas las temporadas" },
      { name: "Sandalias", emoji: "🩴", description: "Sandalias frescas y cómodas" },
      { name: "Casuales", emoji: "🥿", description: "Zapatos casuales para el día a día" },
      { name: "Formales", emoji: "👞", description: "Zapatos formales y elegantes" },
    ];

    for (const cat of defaultCategories) {
      try {
        const existing = await db.select().from(categories).where(eq(categories.name, cat.name)).limit(1);
        if (existing.length === 0) {
          await db.insert(categories).values({
            id: crypto.randomUUID(),
            ...cat
          });
          console.log(`✅ Inserted category: ${cat.name}`);
        }
      } catch (error) {
        console.log(`Category ${cat.name} might already exist:`, error);
      }
    }

    // Insert default brands
    const defaultBrands = [
      { name: "Nike", logo: "https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png", description: "Just Do It - Marca líder en deportivos", catalogUrl: "https://nike.com/catalog", displayLocation: "admin" },
      { name: "Adidas", logo: "https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png", description: "Impossible is Nothing - Deportivos de alta calidad", catalogUrl: "https://adidas.com/catalog", displayLocation: "admin" },
      { name: "Asics", logo: "https://logos-world.net/wp-content/uploads/2020/04/ASICS-Logo.png", description: "Sound Mind, Sound Body - Tecnología japonesa", catalogUrl: "https://asics.com/catalog", displayLocation: "admin" },
      { name: "CATÁLOGO COMPLETO", logo: "https://via.placeholder.com/100x50/007acc/ffffff?text=CATALOGO", description: "Todos los productos disponibles en nuestra tienda", catalogUrl: null, displayLocation: "admin" },
      { name: "EUROPEO", logo: "https://via.placeholder.com/100x50/2d5a27/ffffff?text=EUROPEO", description: "Calzado de estilo europeo elegante y sofisticado", catalogUrl: null, displayLocation: "admin" },
      { name: "GUALLOS", logo: "https://via.placeholder.com/100x50/8b4513/ffffff?text=GUALLOS", description: "Zapatos de cuero artesanal de alta calidad", catalogUrl: null, displayLocation: "admin" },
    ];

    for (const brand of defaultBrands) {
      try {
        const existing = await db.select().from(brands).where(eq(brands.name, brand.name)).limit(1);
        if (existing.length === 0) {
          await db.insert(brands).values({
            id: crypto.randomUUID(),
            name: brand.name,
            logo: brand.logo,
            description: brand.description,
            catalogUrl: brand.catalogUrl,
            isActive: true,
            displayLocation: brand.displayLocation as "admin" | "client"
          });
          console.log(`✅ Inserted brand: ${brand.name}`);
        }
      } catch (error) {
        console.log(`Brand ${brand.name} might already exist:`, error);
      }
    }

    // 🔒 CRITICAL SECURITY FIX: Migrate existing brands from 'client' to 'admin' displayLocation
    // This ensures admin has COMPLETE control over which brands clients can see
    try {
      const brandsToMigrate = await db.select().from(brands).where(eq(brands.displayLocation, 'client'));
      if (brandsToMigrate.length > 0) {
        console.log(`🔧 Migrating ${brandsToMigrate.length} brands from 'client' to 'admin' display location...`);
        
        for (const brand of brandsToMigrate) {
          await db.update(brands)
            .set({ displayLocation: 'admin' })
            .where(eq(brands.id, brand.id));
          console.log(`✅ Migrated brand "${brand.name}" to admin control`);
        }
        
        console.log('🔒 Brand migration complete: Admin now has FULL control over all brand visibility');
      } else {
        console.log('✅ No brand migration needed: All brands already under admin control');
      }
    } catch (error) {
      console.error('❌ Error migrating brands to admin control:', error);
    }

    // Insert default admin user
    try {
      const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
      if (existingAdmin.length === 0) {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          username: 'admin',
          email: 'admin@zapashop.com',
          password: 'admin123',
          firstName: 'Administrador',
          lastName: 'ZapaShop',
          isAdmin: true
        });
        console.log('✅ Inserted admin user');
      }
    } catch (error) {
      console.log('Admin user might already exist:', error);
    }

    console.log('✅ Default data insertion complete');
    console.log('🎉 SQLite database initialization complete!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}