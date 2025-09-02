import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import CategoryTabs from "@/components/category-tabs";
import PromotionalBanners from "@/components/promotional-banners";
import FlashSaleSection from "@/components/flash-sale-section";
import ProductCard from "@/components/product-card";
import FloatingCart from "@/components/floating-cart";
import { type ProductWithCategory, type Category, type BrandWithProducts } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package } from "lucide-react";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery<BrandWithProducts[]>({
    queryKey: ["/api/brands/with-products"],
  });

  const { data: flashSaleProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", "flash-sale"],
    queryFn: () => fetch("/api/products?flashSale=true").then(res => res.json()),
  });

  const { data: featuredProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", "featured"],
    queryFn: () => fetch("/api/products?featured=true").then(res => res.json()),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Promo Bar - Móvil optimizado */}
      <div className="gradient-bg text-white py-1 sm:py-2">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 text-center">
          <span className="font-bold flash-sale text-xs sm:text-sm" data-testid="text-promo-banner">
            🔥 MEGA DESCUENTOS HOY! 🔥 Hasta 70% OFF
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6">
        
        <CategoryTabs 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          isLoading={categoriesLoading}
        />

        {/* Main Promo Banner - Compacto para móvil */}
        <div className="relative mb-4 sm:mb-8 rounded-xl sm:rounded-2xl overflow-hidden gradient-bg p-4 sm:p-8 text-white">
          <div className="relative z-10">
            <h2 className="text-xl sm:text-4xl font-bold mb-2 sm:mb-4" data-testid="text-main-promo-title">¡SUPER OFERTAS!</h2>
            <p className="text-sm sm:text-xl mb-3 sm:mb-4" data-testid="text-main-promo-subtitle">Zapatos de marca hasta 70% de descuento</p>
            <button className="bg-white text-primary px-4 sm:px-8 py-2 sm:py-3 rounded-full font-bold hover:bg-gray-100 transition-colors bounce-animation text-sm sm:text-base" data-testid="button-shop-now">
              ¡Comprar Ahora!
            </button>
          </div>
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
            <span className="bg-accent text-accent-foreground px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-2xl" data-testid="text-discount-badge">
              70% OFF
            </span>
          </div>
        </div>

        <PromotionalBanners />

        <FlashSaleSection products={flashSaleProducts} />

        {/* Brand Catalogs Section */}
        <section className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4" data-testid="text-brand-catalogs-title">👟 Catálogos por Marca</h3>
          
          {brandsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-6 animate-pulse">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 bg-muted rounded-lg mb-2 sm:mb-4"></div>
                  <div className="h-4 sm:h-6 bg-muted rounded mb-1 sm:mb-2"></div>
                  <div className="h-3 sm:h-4 bg-muted rounded mb-2 sm:mb-4"></div>
                  <div className="h-8 sm:h-10 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {brands.map((brand) => (
                <div key={brand.id} className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-6 hover:shadow-lg transition-shadow" data-testid={`card-brand-${brand.id}`}>
                  <div className="flex items-center mb-2 sm:mb-4">
                    <img 
                      src={brand.logo} 
                      alt={brand.name}
                      className="w-10 h-10 sm:w-16 sm:h-16 object-contain mr-2 sm:mr-4"
                      data-testid={`img-brand-logo-${brand.id}`}
                    />
                    <div className="flex-1">
                      <h4 className="text-sm sm:text-xl font-bold" data-testid={`text-brand-name-${brand.id}`}>{brand.name}</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground" data-testid={`text-brand-product-count-${brand.id}`}>
                        {brand.productCount} productos
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2" data-testid={`text-brand-description-${brand.id}`}>
                    {brand.description}
                  </p>
                  
                  <div className="flex gap-1 sm:gap-2">
                    <Button 
                      size="sm"
                      className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                      onClick={() => window.open(brand.catalogUrl || '#', '_blank')}
                      data-testid={`button-view-catalog-${brand.id}`}
                    >
                      <Package className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Ver Catálogo</span>
                      <span className="sm:hidden">Ver</span>
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="h-8 sm:h-10 w-8 sm:w-auto sm:px-3"
                      onClick={() => window.open(brand.catalogUrl || '#', '_blank')}
                      data-testid={`button-external-catalog-${brand.id}`}
                    >
                      <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!brandsLoading && brands.length === 0 && (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-brands">
              No hay marcas disponibles en este momento.
            </div>
          )}
        </section>

        {/* Seller Section - Compacto para móvil */}
        <section className="bg-muted rounded-lg sm:rounded-xl p-3 sm:p-6 mb-4 sm:mb-8">
          <h3 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-4" data-testid="text-seller-section-title">💼 ¿Quieres vender tus zapatos?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
            <div>
              <h4 className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2">Sube tus productos fácilmente</h4>
              <ul className="space-y-1 sm:space-y-2 text-muted-foreground text-xs sm:text-sm">
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-500 text-xs"></i>
                  <span>Subida de fotos fácil</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-500 text-xs"></i>
                  <span>Inventario automático</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-500 text-xs"></i>
                  <span>Promociones</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-500 text-xs"></i>
                  <span>Analytics</span>
                </li>
              </ul>
            </div>
            <div className="space-y-2 sm:space-y-4">
              <button 
                className="w-full bg-secondary text-secondary-foreground py-2 sm:py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm sm:text-base"
                onClick={() => window.location.href = '/seller'}
                data-testid="button-create-seller-account"
              >
                <i className="fas fa-plus mr-2"></i>Crear Cuenta Vendedor
              </button>
              <button className="w-full border border-border py-2 sm:py-3 rounded-lg font-semibold hover:bg-muted transition-colors text-sm sm:text-base" data-testid="button-more-info">
                <i className="fas fa-info-circle mr-2"></i>Más Información
              </button>
            </div>
          </div>
        </section>

        {/* Categories Grid - Compacto para móvil */}
        <section className="mb-4 sm:mb-8">
          <h3 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-4" data-testid="text-categories-title">🏪 Explora por Categorías</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {categories.map((category, index) => {
              const gradients = [
                "from-red-400 to-pink-500",
                "from-blue-400 to-purple-500", 
                "from-green-400 to-blue-500",
                "from-yellow-400 to-orange-500"
              ];
              
              // Count products across all brands for this category
              const categoryProductCount = brands.reduce((total, brand) => {
                return total + brand.products.filter(p => p.categoryId === category.id).length;
              }, 0);
              
              return (
                <div 
                  key={category.id}
                  className={`bg-gradient-to-br ${gradients[index % gradients.length]} rounded-lg sm:rounded-xl p-3 sm:p-6 text-white text-center hover:shadow-lg transition-shadow cursor-pointer`}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`card-category-${category.id}`}
                >
                  <div className="text-xl sm:text-3xl mb-1 sm:mb-2">{category.emoji}</div>
                  <h4 className="font-semibold text-xs sm:text-base">{category.name}</h4>
                  <p className="text-xs sm:text-sm opacity-90">
                    {categoryProductCount} productos
                  </p>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      <FloatingCart />

      {/* Footer */}
      <footer className="bg-muted mt-16 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h5 className="font-bold text-lg mb-4">👟 ZapaShop</h5>
              <p className="text-muted-foreground mb-4">Tu tienda de zapatos online favorita con los mejores precios y calidad.</p>
              <div className="flex space-x-4">
                <i className="fab fa-facebook text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
                <i className="fab fa-instagram text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
                <i className="fab fa-twitter text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
              </div>
            </div>
            
            <div>
              <h6 className="font-semibold mb-4">Categorías</h6>
              <ul className="space-y-2 text-muted-foreground">
                {categories.map(category => (
                  <li key={category.id}>
                    <button 
                      onClick={() => setSelectedCategory(category.id)}
                      className="hover:text-primary transition-colors text-left"
                      data-testid={`link-footer-category-${category.id}`}
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h6 className="font-semibold mb-4">Ayuda</h6>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Envíos</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Devoluciones</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
              </ul>
            </div>
            
            <div>
              <h6 className="font-semibold mb-4">Vendedores</h6>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/seller" className="hover:text-primary transition-colors">Vender en ZapaShop</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Guía del Vendedor</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Políticas</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Soporte</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 ZapaShop. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
