import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import PromotionalBanners from "@/components/promotional-banners";
import FlashSaleSection from "@/components/flash-sale-section";
import ProductCard from "@/components/product-card";
import { SavingsDashboard } from "@/components/savings-dashboard";
import { type ProductWithCategory, type Category, type BrandWithProducts } from "@shared/schema";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, ZoomIn } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { getBrandLogoType } from "@/lib/brand-utils";
import AdvancedSearch, { type SearchFilters } from "@/components/advanced-search";
import { useCartStore } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [selectedBrand, setSelectedBrand] = useState<BrandWithProducts | null>(null);
  const [imageZoomData, setImageZoomData] = useState<{product: ProductWithCategory; isOpen: boolean} | null>(null);
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
  
  const { addItem } = useCartStore();
  const { toast } = useToast();

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
    queryKey: ["/api/products", "all-featured"],
    queryFn: () => fetch("/api/products").then(res => res.json()),
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
    // Los productos son ilimitados, no verificamos stock
    
    return params.toString();
  }, [searchFilters]);

  const { data: allProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", searchParams],
    queryFn: () => {
      const url = searchParams ? `/api/products?${searchParams}` : '/api/products';
      return fetch(url).then(res => res.json());
    },
  });

  // Filtrar productos por marca seleccionada y aleatorizarlos
  const [randomizedBrandProducts, setRandomizedBrandProducts] = useState<ProductWithCategory[]>([]);
  
  useEffect(() => {
    if (selectedBrand) {
      const filteredProducts = allProducts.filter(product => product.brandId === selectedBrand.id);
      setRandomizedBrandProducts(shuffleArray(filteredProducts));
    }
  }, [selectedBrand, allProducts]);

  // Función para mostrar catálogo de marca
  const showBrandCatalog = (brand: BrandWithProducts) => {
    setSelectedBrand(brand);
  };

  // Función para volver al inicio
  const backToHome = () => {
    setSelectedBrand(null);
  };

  // Función para aplicar filtros desde el componente de búsqueda
  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    const clearedFilters = {
      query: "",
      priceMin: 0,
      priceMax: 1000000,
      brands: [],
      categories: [],
      sizes: [],
      colors: [],
      onSale: false,
      inStock: false,
    };
    setSearchFilters(clearedFilters);
  };

  // Función para aleatorizar el orden de productos
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Productos en orden aleatorio para la pantalla principal - se actualiza cada vez que se carga
  const [randomizedAllProducts, setRandomizedAllProducts] = useState<ProductWithCategory[]>([]);
  
  // Efecto para aleatorizar productos cada vez que cambian o se monta el componente
  useEffect(() => {
    if (allProducts.length > 0) {
      setRandomizedAllProducts(shuffleArray(allProducts));
    }
  }, [allProducts]);

  // Mostrar productos: aleatorios para pantalla principal, filtrados para búsquedas
  const hasActiveFilters = searchFilters.query || searchFilters.brands.length > 0 || searchFilters.categories.length > 0 || 
                          searchFilters.sizes.length > 0 || searchFilters.colors.length > 0 || searchFilters.onSale || 
                          searchFilters.priceMin > 0 || searchFilters.priceMax < 1000000;
  
  const displayedProducts = hasActiveFilters ? allProducts : randomizedAllProducts;

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
              {getBrandLogoType(selectedBrand.logo) === 'emoji' ? (
                <div 
                  className="w-12 h-12 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-5xl mr-4"
                  data-testid={`emoji-catalog-brand-logo-${selectedBrand.id}`}
                >
                  {selectedBrand.logo}
                </div>
              ) : getBrandLogoType(selectedBrand.logo) === 'image' ? (
                <img 
                  src={selectedBrand.logo} 
                  alt={selectedBrand.name}
                  className="w-12 h-12 sm:w-20 sm:h-20 object-contain mr-4"
                  data-testid={`img-catalog-brand-logo-${selectedBrand.id}`}
                />
              ) : (
                <div 
                  className="w-12 h-12 sm:w-20 sm:h-20 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xl sm:text-3xl font-bold mr-4"
                  data-testid={`placeholder-catalog-brand-logo-${selectedBrand.id}`}
                >
                  {selectedBrand.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-3xl font-bold" data-testid={`text-catalog-brand-name-${selectedBrand.id}`}>
                  Catálogo {selectedBrand.name}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base" data-testid={`text-catalog-product-count-${selectedBrand.id}`}>
                  {randomizedBrandProducts.length} productos disponibles
                </p>
              </div>
            </div>
          </div>

          {/* Productos de la marca */}
          {randomizedBrandProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {randomizedBrandProducts.map((product) => (
                <div key={product.id} className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-brand-product-${product.id}`}>
                  {/* Imagen del producto */}
                  <div className="aspect-square bg-muted relative overflow-hidden group cursor-pointer">
                    {((product.imageUrl && product.imageUrl.trim() !== '') || (product.images && product.images.length > 0)) ? (
                      <>
                        <img 
                          src={(() => {
                            let imageUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : product.images?.[0];
                            if (imageUrl && !imageUrl.startsWith('http')) {
                              imageUrl = `${window.location.origin}${imageUrl}`;
                            }
                            return imageUrl;
                          })()} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                          data-testid={`img-brand-product-${product.id}`}
                          onClick={() => setImageZoomData({product, isOpen: true})}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            console.error(`❌ Error cargando imagen: ${target.src} para producto: ${product.name}`);
                            target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>';
                          }}
                          onLoad={() => {
                            console.log(`✅ Imagen cargada correctamente para producto en catálogo: ${product.name}`);
                          }}
                        />
                        {/* Zoom icon overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                          <div className="w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
                            <ZoomIn className="w-5 h-5 text-gray-700" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    
                  </div>

                  {/* Información del producto */}
                  <div className="p-3 sm:p-4">
                    <h3 className="font-semibold text-sm sm:text-base mb-1 line-clamp-2" data-testid={`text-brand-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    
                    {/* Referencia del producto */}
                    {product.reference && (
                      <div className="mb-2">
                        <span className="text-sm text-muted-foreground bg-gray-100 px-2 py-1 rounded" data-testid={`text-brand-product-reference-${product.id}`}>
                          Ref: {product.reference}
                        </span>
                      </div>
                    )}

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

                    {/* Precio */}
                    {product.price && product.price !== "1" ? (
                      <div className="mb-2">
                        {product.originalPrice && product.originalPrice !== product.price && (
                          <div className="text-xs text-muted-foreground line-through mb-1">
                            {formatCurrency(product.originalPrice)}
                          </div>
                        )}
                        <div className="text-sm font-bold text-primary" data-testid={`text-brand-product-price-${product.id}`}>
                          {formatCurrency(product.price)} COP
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mb-2" data-testid={`text-brand-product-price-whatsapp-${product.id}`}>
                        💬 Precio via WhatsApp
                      </div>
                    )}

                    {/* Disponibilidad ilimitada */}
                    <div className="text-xs text-green-600 font-medium mb-3" data-testid={`text-brand-product-stock-${product.id}`}>
                      ✅ Disponible
                    </div>

                    {/* Botón de Agregar al Carrito */}
                    <button 
                      className="w-full bg-primary text-primary-foreground py-2 px-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        addItem(product);
                        toast({
                          title: "Producto agregado",
                          description: `${product.name} se agregó al carrito`,
                        });
                      }}
                      data-testid={`button-add-to-cart-brand-${product.id}`}
                    >
                      Agregar al Carrito
                    </button>
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

        {/* Modal de zoom para imágenes del catálogo */}
        {imageZoomData && (
          <Dialog open={imageZoomData.isOpen} onOpenChange={(open) => setImageZoomData(open ? imageZoomData : null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-2">
              <DialogHeader>
                <DialogTitle>{imageZoomData.product.name}</DialogTitle>
                <DialogDescription>
                  Imagen en detalle del producto
                </DialogDescription>
              </DialogHeader>
              <div className="relative flex justify-center">
                <img 
                  src={imageZoomData.product.imageUrl && imageZoomData.product.imageUrl.trim() !== '' ? imageZoomData.product.imageUrl : imageZoomData.product.images?.[0]} 
                  alt={imageZoomData.product.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  data-testid={`img-catalog-zoom-${imageZoomData.product.id}`}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
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
            🔥 MEGA DESCUENTOS HOY! 🔥
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
          onSearch={handleSearch}
        />

        {/* Main Promo Banner - Compacto para móvil */}
        <div className="relative mb-4 sm:mb-8 rounded-xl sm:rounded-2xl overflow-hidden gradient-bg p-4 sm:p-8 text-white">
          <div className="relative z-10">
            <h2 className="text-xl sm:text-4xl font-bold mb-2 sm:mb-4" data-testid="text-main-promo-title">¡SUPER OFERTAS!</h2>
            <p className="text-sm sm:text-xl mb-3 sm:mb-4" data-testid="text-main-promo-subtitle">Zapatos de marca con los mejores precios</p>
            <button className="bg-white text-primary px-4 sm:px-8 py-2 sm:py-3 rounded-full font-bold hover:bg-gray-100 transition-colors bounce-animation text-sm sm:text-base" data-testid="button-shop-now">
              ¡Comprar Ahora!
            </button>
          </div>
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
          </div>
        </div>

        {/* Brand Catalogs Section - MOVIDA A LA PARTE SUPERIOR */}
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
                  {/* Nombre de la marca en la parte superior */}
                  <h4 className="text-sm sm:text-xl font-bold text-center mb-2 sm:mb-3" data-testid={`text-brand-name-${brand.id}`}>{brand.name}</h4>
                  
                  {/* Logo centrado */}
                  <div className="flex justify-center mb-2 sm:mb-3">
                    {getBrandLogoType(brand.logo) === 'emoji' ? (
                      <div 
                        className="w-12 h-12 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-5xl"
                        data-testid={`emoji-brand-logo-${brand.id}`}
                      >
                        {brand.logo}
                      </div>
                    ) : getBrandLogoType(brand.logo) === 'image' ? (
                      <img 
                        src={brand.logo} 
                        alt={brand.name}
                        className="w-12 h-12 sm:w-20 sm:h-20 object-contain"
                        data-testid={`img-brand-logo-${brand.id}`}
                      />
                    ) : (
                      <div 
                        className="w-12 h-12 sm:w-20 sm:h-20 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xl sm:text-3xl font-bold"
                        data-testid={`placeholder-brand-logo-${brand.id}`}
                      >
                        {brand.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  
                  {/* Cantidad de productos */}
                  <p className="text-xs sm:text-sm text-muted-foreground text-center mb-2 sm:mb-3" data-testid={`text-brand-product-count-${brand.id}`}>
                    {brand.productCount} productos
                  </p>
                  
                  {/* Descripción */}
                  <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2 text-center" data-testid={`text-brand-description-${brand.id}`}>
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

        <PromotionalBanners />

        <FlashSaleSection products={flashSaleProducts} />

        {/* Search Results Section */}
        {searchFilters.query || searchFilters.brands.length > 0 || searchFilters.categories.length > 0 || 
         searchFilters.sizes.length > 0 || searchFilters.colors.length > 0 || searchFilters.onSale || 
         searchFilters.priceMin > 0 || searchFilters.priceMax < 1000000 ? (
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

        {/* Todos los Productos - Solo se muestra cuando no hay filtros activos */}
        {!(searchFilters.query || searchFilters.brands.length > 0 || searchFilters.categories.length > 0 || 
          searchFilters.sizes.length > 0 || searchFilters.colors.length > 0 || searchFilters.onSale || 
          searchFilters.priceMin > 0 || searchFilters.priceMax < 1000000) && (
          <section className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-2xl font-bold" data-testid="text-all-products-title">
                🛍️ Todos los Productos
              </h3>
              <span className="text-sm text-muted-foreground" data-testid="text-all-products-count">
                {randomizedAllProducts.length} producto{randomizedAllProducts.length !== 1 ? 's' : ''} disponible{randomizedAllProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {randomizedAllProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {randomizedAllProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No hay productos disponibles</h3>
                <p>Aún no se han agregado productos al catálogo.</p>
              </div>
            )}
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-muted mt-16 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h5 className="font-bold text-lg mb-4">🚀 FastSneaker</h5>
              <p className="text-muted-foreground mb-4">Los mejores zapatos deportivos y casuales con envío rápido y garantía de calidad.</p>
              <div className="flex space-x-4">
                <i className="fab fa-facebook text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
                <i className="fab fa-instagram text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
                <i className="fab fa-twitter text-xl text-muted-foreground hover:text-primary cursor-pointer"></i>
              </div>
            </div>
            
            <div>
              <h6 className="font-semibold mb-4">Información</h6>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre FastSneaker</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Calidad Garantizada</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Productos Originales</a></li>
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
            <p>&copy; 2024 FastSneaker. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
      
      <SavingsDashboard />
    </div>
  );
}
