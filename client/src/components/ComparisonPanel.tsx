import { X, Scale, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useComparisonStore } from '@/lib/comparison-store';
import { useCartStore } from '@/lib/cart-store';
import { useToast } from '@/hooks/use-toast';
import type { ProductWithCategory } from '@shared/schema';

export function ComparisonPanel() {
  const { products, isOpen, setIsOpen, removeProduct, clearComparison } = useComparisonStore();
  const { addItem } = useCartStore();
  const { toast } = useToast();

  const buildImageSrc = (product: ProductWithCategory): string => {
    const rawImageUrl = product.imageUrl || (product.images && product.images.length > 0 ? product.images[0] : null);
    
    if (!rawImageUrl || rawImageUrl.trim() === '') {
      return '';
    }
    
    let imageUrl = rawImageUrl.trim();
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    imageUrl = imageUrl.replace(/\/?api\/images\/*/g, '');
    imageUrl = imageUrl.replace(/\/+/g, '').trim();
    
    if (!imageUrl) {
      return '';
    }
    
    return `/api/images/${encodeURIComponent(imageUrl)}`;
  };

  const formatCurrency = (value: string | number | null | undefined): string => {
    if (!value || value === '' || value === 'null' || value === null || value === undefined) {
      return '0';
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value;
    if (isNaN(numValue)) return '0';
    
    return new Intl.NumberFormat('es-CO').format(numValue);
  };

  const addToCart = (product: ProductWithCategory) => {
    addItem(product, 1);
    toast({
      title: "Producto agregado al carrito",
      description: `${product.name} ha sido agregado a tu carrito`,
    });
  };

  const getDiscountPercentage = (product: ProductWithCategory): number => {
    if (!product.originalPrice || !product.price || product.originalPrice === product.price) {
      return 0;
    }
    
    const originalPrice = parseFloat(String(product.originalPrice).replace(/\./g, ''));
    const currentPrice = parseFloat(String(product.price).replace(/\./g, ''));
    const savings = originalPrice - currentPrice;
    const discountPercentage = Math.round((savings / originalPrice) * 100);
    
    return discountPercentage > 0 && !isNaN(discountPercentage) ? discountPercentage : 0;
  };

  if (products.length === 0) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="fixed bottom-4 right-4 z-50 shadow-lg"
            data-testid="button-open-comparison"
          >
            <Scale className="h-4 w-4 mr-2" />
            Comparar (0)
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Comparación de productos</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Scale className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay productos para comparar</h3>
            <p className="text-muted-foreground">
              Agrega productos a tu lista de comparación haciendo clic en "Comparar" en cualquier producto
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="fixed bottom-4 right-4 z-50 shadow-lg bg-white border-2 border-primary"
          data-testid="button-open-comparison"
        >
          <Scale className="h-4 w-4 mr-2" />
          Comparar ({products.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-6xl overflow-y-auto">
        <SheetHeader className="sticky top-0 bg-white z-10 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Comparación de productos ({products.length})</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearComparison}
              data-testid="button-clear-comparison"
            >
              Limpiar todo
            </Button>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {products.map((product) => (
            <div key={product.id} className="border rounded-lg p-4 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => removeProduct(product.id)}
                data-testid={`button-remove-comparison-${product.id}`}
              >
                <X className="h-3 w-3" />
              </Button>

              {/* Imagen del producto */}
              <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                {buildImageSrc(product) ? (
                  <img
                    src={buildImageSrc(product)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    data-testid={`img-comparison-${product.id}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-gray-400 text-xs">Sin imagen</span>
                  </div>
                )}
              </div>

              {/* Información del producto */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm leading-tight" data-testid={`text-comparison-name-${product.id}`}>
                    {product.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.brand?.name} • {product.category?.name}
                  </p>
                </div>

                {/* Precio */}
                <div>
                  <div className="flex flex-col space-y-1">
                    {product.originalPrice && product.originalPrice !== product.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(product.originalPrice)} COP
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary" data-testid={`text-comparison-price-${product.id}`}>
                        {formatCurrency(product.price)} COP
                      </span>
                      {getDiscountPercentage(product) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          -{getDiscountPercentage(product)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Características */}
                <div className="space-y-2 text-xs">
                  {/* Tallas */}
                  {product.sizes && product.sizes.length > 0 && (
                    <div>
                      <span className="font-medium">Tallas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.sizes.slice(0, 4).map((size, index) => (
                          <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                            {size}
                          </Badge>
                        ))}
                        {product.sizes.length > 4 && (
                          <span className="text-muted-foreground">+{product.sizes.length - 4}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Colores */}
                  {product.colors && product.colors.length > 0 && (
                    <div>
                      <span className="font-medium">Colores:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.colors.slice(0, 3).map((color, index) => (
                          <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                            {color}
                          </Badge>
                        ))}
                        {product.colors.length > 3 && (
                          <span className="text-muted-foreground">+{product.colors.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rating */}
                  {product.rating && parseFloat(product.rating) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Rating:</span>
                      <span className="text-yellow-500">★ {product.rating}</span>
                      {product.reviewCount && product.reviewCount > 0 && (
                        <span className="text-muted-foreground">({product.reviewCount})</span>
                      )}
                    </div>
                  )}

                  {/* Badges especiales */}
                  <div className="flex flex-wrap gap-1">
                    {product.isFlashSale && (
                      <Badge variant="destructive" className="text-xs">⚡ Flash Sale</Badge>
                    )}
                    {product.isFeatured && (
                      <Badge variant="secondary" className="text-xs">🌟 Destacado</Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Botón agregar al carrito */}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => addToCart(product)}
                  data-testid={`button-add-cart-comparison-${product.id}`}
                >
                  <ShoppingCart className="h-3 w-3 mr-2" />
                  Agregar al carrito
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Consejos para el usuario */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold text-sm mb-2">💡 Consejos para comparar</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Puedes comparar hasta 4 productos al mismo tiempo</li>
            <li>• Compara precios, tallas disponibles y características especiales</li>
            <li>• Haz clic en "Agregar al carrito" para comprar directamente desde aquí</li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}