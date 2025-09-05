import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import PromotionalBanners from "@/components/promotional-banners";
import FlashSaleSection from "@/components/flash-sale-section";
import ProductCard from "@/components/product-card";
import { SavingsDashboard } from "@/components/savings-dashboard";
import { type ProductWithCategory, type Category, type BrandWithProducts } from "@shared/schema";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import AdvancedSearch, { type SearchFilters } from "@/components/advanced-search";

export default function Home() {
  const [selectedBrand, setSelectedBrand] = useState<BrandWithProducts | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    priceMin: 0,
    priceMax: 1000000,
    brands: [],
    categories: [],
    sizes: [],
    colors: [],
    onSale: false,
    inStock: false,
  });

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

  // Build query parameters from search filters
  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchFilters.query) params.set('query', searchFilters.query);
    if (searchFilters.priceMin > 0) params.set('priceMin', searchFilters.priceMin.toString());
    if (searchFilters.priceMax < 1000000) params.set('priceMax', searchFilters.priceMax.toString());
    if (searchFilters.brands.length > 0) params.set('brands', searchFilters.brands.join(','));
    if (searchFilters.categories.length > 0) params.set('categories', searchFilters.categories.join(','));
    if (searchFilters.sizes.length > 0) params.set('sizes', searchFilters.sizes.join(','));
    if (searchFilters.colors.length > 0) params.set('colors', searchFilters.colors.join(','));
    if (searchFilters.onSale) params.set('onSale', 'true');
    if (searchFilters.inStock) params.set('inStock', 'true');
    
    return params.toString();
  }, [searchFilters]);

  const { data: allProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", searchParams],
    queryFn: () => {
      const url = searchParams ? `/api/products?${searchParams}` : '/api/products';
      return fetch(url).then(res => res.json());
    },
  });

  // Filtrar productos por marca seleccionada
  const brandProducts = selectedBrand ? allProducts.filter(product => product.brandId === selectedBrand.id) : [];

  // Función para mostrar catálogo de marca
  const showBrandCatalog = (brand: BrandWithProducts) => {
    setSelectedBrand(brand);
  };

  // Función para volver al inicio
  const backToHome = () => {
    setSelectedBrand(null);
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setSearchFilters({
      query: "",
      priceMin: 0,
      priceMax: 1000000,
      brands: [],
      categories: [],
      sizes: [],
      colors: [],
      onSale: false,
      inStock: false,
    });
  };

  // Mostrar todos los productos
  const displayedProducts = allProducts;

  // Si se seleccionó una marca, mostrar su catálogo
  if (selectedBrand) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6">
          {/* Header del catálogo de marca */}
          <div className="mb-4 sm:mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={backToHome}
              className="mb-3 sm:mb-4"
              data-testid="button-back-to-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
            
            <div className="flex items-center mb-4">
              <img 
                src={selectedBrand.logo} 
                alt={selectedBrand.name}
                className="w-12 h-12 sm:w-20 sm:h-20 object-contain mr-4"
                data-testid={`img-catalog-brand-logo-${selectedBrand.id}`}
              />
              <div>
                <h1 className="text-xl sm:text-3xl font-bold" data-testid={`text-catalog-brand-name-${selectedBrand.id}`}>
                  Catálogo {selectedBrand.name}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base" data-testid={`text-catalog-product-count-${selectedBrand.id}`}>
                  {brandProducts.length} productos disponibles
                </p>
              </div>
            </div>
          </div>

          {/* Productos de la marca */}
          {brandProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {brandProducts.map((product) => (
                <div key={product.id} className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-brand-product-${product.id}`}>
                  {/* Imagen del producto */}
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        data-testid={`img-brand-product-${product.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    
                    {/* Badge de descuento */}
                    {product.discountPercentage && product.discountPercentage > 0 && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        -{product.discountPercentage}%
                      </div>
                    )}
                  </div>

                  {/* Información del producto */}
                  <div className="p-3 sm:p-4">
                    <h3 className="font-semibold text-sm sm:text-base mb-1 line-clamp-2" data-testid={`text-brand-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    
                    {/* Precios */}
                    <div className="mb-2">
                      {product.discountPercentage && product.discountPercentage > 0 ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                          <span className="text-lg sm:text-xl font-bold text-green-600" data-testid={`text-brand-product-sale-price-${product.id}`}>
                            {formatCurrency(Number(product.price))}
                          </span>
                          <span className="text-sm text-muted-foreground line-through" data-testid={`text-brand-product-original-price-${product.id}`}>
                            {formatCurrency(Math.round((Number(product.price) || 0) / (1 - ((product.discountPercentage || 0) / 100))))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg sm:text-xl font-bold" data-testid={`text-brand-product-price-${product.id}`}>
                          {formatCurrency(Number(product.price))}
                        </span>
                      )}
                    </div>

                    {/* Tallas disponibles */}
                    {product.sizes && product.sizes.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Tallas:</p>
                        <div className="flex flex-wrap gap-1">
                          {product.sizes.slice(0, 4).map((size) => (
                            <span 
                              key={size} 
                              className="px-2 py-1 bg-muted rounded text-xs"
                              data-testid={`text-brand-product-size-${product.id}-${size}`}
                            >
                              {size}
                            </span>
                          ))}
                          {product.sizes.length > 4 && (
                            <span className="px-2 py-1 bg-muted rounded text-xs">
                              +{product.sizes.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stock */}
                    <div className="text-xs text-muted-foreground" data-testid={`text-brand-product-stock-${product.id}`}>
                      {(product.stock || 0) > 0 ? `${product.stock} disponibles` : 'Sin stock'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-brand-products">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay productos disponibles</h3>
              <p>Esta marca aún no tiene productos en el catálogo.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

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
        
        {/* Advanced Search Component */}
        <AdvancedSearch
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          categories={categories}
          brands={brands}
          onClear={clearFilters}
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

        {/* Search Results Section */}
        {searchFilters.query || searchFilters.brands.length > 0 || searchFilters.categories.length > 0 || 
         searchFilters.sizes.length > 0 || searchFilters.colors.length > 0 || searchFilters.onSale || 
         searchFilters.inStock || searchFilters.priceMin > 0 || searchFilters.priceMax < 1000000 ? (
          <section className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-2xl font-bold" data-testid="text-search-results-title">
                🔍 Resultados de búsqueda
              </h3>
              <span className="text-sm text-muted-foreground" data-testid="text-search-results-count">
                {displayedProducts.length} producto{displayedProducts.length !== 1 ? 's' : ''} encontrado{displayedProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {displayedProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {displayedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-search-results">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
                <p className="mb-4">Intenta ajustar tus filtros de búsqueda</p>
                <Button onClick={clearFilters} variant="outline" data-testid="button-clear-search-filters">
                  Limpiar filtros
                </Button>
              </div>
            )}
          </section>
        ) : null}

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
                      onClick={() => showBrandCatalog(brand)}
                      data-testid={`button-view-catalog-${brand.id}`}
                    >
                      <Package className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Ver Catálogo</span>
                      <span className="sm:hidden">Ver</span>
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
                  onClick={() => {}}
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
                      onClick={() => {}}
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
            
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 ZapaShop. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
      
      <SavingsDashboard />
    </div>
  );
}
