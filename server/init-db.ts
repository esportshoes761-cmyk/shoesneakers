import { db } from './db';
import { users, categories, brands, products, promotions, events, cartItems, customerSavings, reviews, orders, images } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing SQLite database...');

    // Create tables manually using SQL
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        is_seller BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        credits REAL DEFAULT 0,
        total_purchases REAL DEFAULT 0,
        loyalty_level TEXT DEFAULT 'bronze',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        description TEXT
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        logo TEXT NOT NULL,
        description TEXT,
        catalog_url TEXT,
        is_active BOOLEAN DEFAULT true,
        display_location TEXT DEFAULT 'client'
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        name_normalized TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        original_price REAL,
        discount_percentage INTEGER DEFAULT 0,
        category_id TEXT,
        brand_id TEXT,
        seller_id TEXT,
        image_url TEXT,
        images TEXT DEFAULT '[]',
        reference TEXT,
        sizes TEXT DEFAULT '[]',
        colors TEXT DEFAULT '[]',
        rating REAL DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        is_flash_sale BOOLEAN DEFAULT false,
        is_featured BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (brand_id) REFERENCES brands(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        title TEXT NOT NULL,
        description TEXT,
        discount_percentage INTEGER,
        discount_amount REAL,
        code TEXT UNIQUE,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        min_purchase REAL,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        event_type TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        selected_size TEXT,
        selected_color TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS customer_savings (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        customer_id TEXT NOT NULL UNIQUE,
        total_saved REAL DEFAULT 0,
        lifetime_purchases REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        product_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        is_verified BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        total_amount TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        delivery_time TEXT,
        notes TEXT,
        whatsapp_sent BOOLEAN DEFAULT true,
        tracking_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created successfully');

    // Insert default categories
    const defaultCategories = [
      { name: "Tacones", emoji: "👠", description: "Elegantes tacones para toda ocasión" },
      { name: "Deportivos", emoji: "👟", description: "Zapatos deportivos y cómodos" },
      { name: "Botas", emoji: "👢", description: "Botas para todas las temporadas" },
      { name: "Sandalias", emoji: "🩴", description: "Sandalias frescas y cómodas" },
      { name: "Casuales", emoji: "🥿", description: "Zapatos casuales para el día a día" },
      { name: "Formales", emoji: "👞", description: "Zapatos formales y elegantes" },
    ];

    for (const cat of defaultCategories) {
      await db.run(sql`
        INSERT OR IGNORE INTO categories (name, emoji, description) 
        VALUES (${cat.name}, ${cat.emoji}, ${cat.description})
      `);
    }

    // Insert default brands - Split between admin and client
    const defaultBrands = [
      // Admin brands (brands without products - for admin only)
      { name: "Nike", logo: "https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png", description: "Just Do It - Marca líder en deportivos", catalogUrl: "https://nike.com/catalog", displayLocation: "admin" },
      { name: "Adidas", logo: "https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png", description: "Impossible is Nothing - Deportivos de alta calidad", catalogUrl: "https://adidas.com/catalog", displayLocation: "admin" },
      { name: "Puma", logo: "https://logos-world.net/wp-content/uploads/2020/04/Puma-Logo.png", description: "Forever Faster - Estilo deportivo innovador", catalogUrl: "https://puma.com/catalog", displayLocation: "admin" },
      { name: "Jordan", logo: "https://logoeps.com/wp-content/uploads/2013/03/jordan-vector-logo.png", description: "Jumpman - Calzado de baloncesto premium", catalogUrl: "https://jordan.com/catalog", displayLocation: "admin" },
      
      // Client brands (brands that will have products)
      { name: "Asics", logo: "https://logos-world.net/wp-content/uploads/2020/04/ASICS-Logo.png", description: "Sound Mind, Sound Body - Tecnología japonesa", catalogUrl: "https://asics.com/catalog", displayLocation: "client" },
      { name: "CATÁLOGO COMPLETO", logo: "https://via.placeholder.com/100x50/007acc/ffffff?text=CATALOGO", description: "Todos los productos disponibles en nuestra tienda", catalogUrl: null, displayLocation: "client" },
      { name: "EUROPEO", logo: "https://via.placeholder.com/100x50/2d5a27/ffffff?text=EUROPEO", description: "Calzado de estilo europeo elegante y sofisticado", catalogUrl: null, displayLocation: "client" },
      { name: "GUALLOS", logo: "https://via.placeholder.com/100x50/8b4513/ffffff?text=GUALLOS", description: "Zapatos de cuero artesanal de alta calidad", catalogUrl: null, displayLocation: "client" },
    ];

    for (const brand of defaultBrands) {
      await db.run(sql`
        INSERT OR IGNORE INTO brands (name, logo, description, catalog_url, is_active, display_location) 
        VALUES (${brand.name}, ${brand.logo}, ${brand.description}, ${brand.catalogUrl}, true, ${brand.displayLocation})
      `);
    }

    // Insert default admin user
    await db.run(sql`
      INSERT OR IGNORE INTO users (username, email, password, first_name, last_name, is_admin) 
      VALUES ('admin', 'admin@zapashop.com', 'admin123', 'Administrador', 'ZapaShop', true)
    `);

    console.log('✅ Default data inserted successfully');
    console.log('🎉 SQLite database initialization complete!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}