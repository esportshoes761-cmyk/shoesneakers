import { type ProductWithCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDiscountedPrice, formatCurrency } from "@/lib/currency";
import { Star, Edit, Trash2, MessageCircle, ZoomIn } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductCardProps {
  product: ProductWithCategory;
  showManageButton?: boolean;
}

export default function ProductCard({ product, showManageButton = false }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const { toast } = useToast();

  // Funciones auxiliares para manejo de imágenes
  const getMainImage = (product: ProductWithCategory): string => {
    // Prioridad: imageUrl primero, luego primera imagen del array
    if (product.imageUrl && product.imageUrl.trim() !== '') {
      return product.imageUrl;
    }
    if (product.images && product.images.length > 0 && product.images[0].trim() !== '') {
      return product.images[0];
    }
    return '';
  };

  const getImageCount = (product: ProductWithCategory): number => {
    let count = 0;
    if (product.imageUrl && product.imageUrl.trim() !== '') count++;
    if (product.images) {
      count += product.images.filter(img => img && img.trim() !== '').length;
    }
    return count;
  };

  const handleWhatsAppOrder = (size: string) => {
    if (!size) {
      toast({
        title: "Selecciona una talla",
        description: "Por favor selecciona una talla antes de continuar",
        variant: "destructive"
      });
      return;
    }
    
    // Calcular precio con descuento si aplica
    const finalPrice = priceData.discounted;
    const discountInfo = priceData.savings ? ` (¡Ahorras ${priceData.savings}!)` : '';
    
    // Preparar mensaje para WhatsApp
    const whatsappMessage = encodeURIComponent(
      `👋 ¡Hola! Me interesa este producto de FastSniker:\n\n` +
      `👟 *${product.name}*\n` +
      `📏 *Talla:* ${size}\n` +
      `💰 *Precio:* ${finalPrice}${discountInfo}\n` +
      `🔗 *Producto:* ${product.name}\n\n` +
      `¿Está disponible? ¿Cuál es el tiempo de entrega?`
    );
    
    // Abrir WhatsApp
    window.open(`https://wa.me/573237697966?text=${whatsappMessage}`, '_blank');
    
    setIsZoomOpen(false);
    setSelectedSize("");
    
    toast({
      title: "¡Redirigiendo a WhatsApp!",
      description: "Te contactaremos pronto para confirmar tu pedido",
    });
  };

  const handleSizeConfirm = () => {
    if (selectedSize) {
      handleWhatsAppOrder(selectedSize);
    }
  };

  const discountPercentage = product.discountPercentage || 0;
  const hasDiscount = discountPercentage > 0 && product.originalPrice;
  
  // Calcular precios usando las utilidades de moneda
  const priceData = hasDiscount && product.originalPrice 
    ? formatDiscountedPrice(product.originalPrice, discountPercentage)
    : { 
        discounted: formatCurrency(product.price),
        original: null,
        savings: null,
        discountPercentage: 0
      };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />);
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />);
    }

    return stars;
  };

  return (
    <div className="product-card bg-card border border-border rounded-lg p-2 sm:p-4 relative transition-all duration-300 hover:shadow-lg" data-testid={`card-product-${product.id}`}>
      {/* Badges */}
      <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex flex-col gap-1">
        {product.isFlashSale && discountPercentage > 0 && (
          <Badge variant="destructive" className="text-[10px] sm:text-xs font-bold px-1 py-0 sm:px-2 sm:py-1">
            -{discountPercentage}%
          </Badge>
        )}
        {product.isFeatured && !product.isFlashSale && (
          <Badge className="bg-accent text-accent-foreground text-[10px] sm:text-xs font-bold px-1 py-0 sm:px-2 sm:py-1">
            #1
          </Badge>
        )}
      </div>

      {/* Manage buttons for seller */}
      {showManageButton && (
        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-10 flex gap-1">
          <Button size="sm" variant="outline" className="w-6 h-6 sm:w-8 sm:h-8 p-0" data-testid={`button-edit-${product.id}`}>
            <Edit className="w-2 h-2 sm:w-3 sm:h-3" />
          </Button>
          <Button size="sm" variant="outline" className="w-6 h-6 sm:w-8 sm:h-8 p-0" data-testid={`button-delete-${product.id}`}>
            <Trash2 className="w-2 h-2 sm:w-3 sm:h-3" />
          </Button>
        </div>
      )}

      <div className="relative">
        <img 
          src={getMainImage(product) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>'} 
          alt={product.name}
          className="w-full h-24 sm:h-36 object-cover rounded-lg mb-2 sm:mb-3"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            console.error(`❌ Error cargando imagen: ${target.src} para producto: ${product.name}`);
            target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>';
          }}
          onLoad={() => {
            console.log(`✅ Imagen cargada correctamente para producto: ${product.name}`);
          }}
          data-testid={`img-product-${product.id}`}
        />
        {/* Indicador de múltiples imágenes */}
        {getImageCount(product) > 1 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
            📷 {getImageCount(product)}
          </div>
        )}
      </div>
      
      <h4 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-2" data-testid={`text-product-name-${product.id}`}>
        {product.name}
      </h4>
      
      <div className="flex items-center space-x-1 mb-1 sm:mb-2">
        <span className="text-primary font-bold text-sm sm:text-base" data-testid={`text-price-${product.id}`}>
          {priceData.discounted}
        </span>
        {hasDiscount && priceData.original && (
          <>
            <span className="text-muted-foreground line-through text-[10px] sm:text-xs" data-testid={`text-original-price-${product.id}`}>
              {priceData.original}
            </span>
          </>
        )}
      </div>
      
      <div className="flex items-center space-x-1 mb-2 sm:mb-3">
        <div className="flex">
          {renderStars(Number(product.rating || 0))}
        </div>
        <span className="text-[10px] sm:text-xs text-muted-foreground" data-testid={`text-review-count-${product.id}`}>
          ({product.reviewCount || 0})
        </span>
      </div>

      {product.stock !== undefined && (
        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2" data-testid={`text-stock-${product.id}`}>
          Stock: {product.stock}
        </div>
      )}
      
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogTrigger asChild>
          <Button 
            size="sm"
            className="w-full py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg h-7 sm:h-auto"
            disabled={(product.stock || 0) === 0}
            data-testid={`button-view-product-${product.id}`}
          >
            <ZoomIn className="w-3 h-3 mr-1" />
            {(product.stock || 0) === 0 ? 'Sin Stock' : 'Ver Producto'}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              Selecciona tu talla y conéctate por WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Imagen de zoom */}
            <div className="flex justify-center">
              <div className="relative aspect-square w-full max-w-sm bg-muted rounded-lg overflow-hidden">
                {getMainImage(product) ? (
                  <img 
                    src={getMainImage(product)} 
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    data-testid={`img-zoom-${product.id}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ZoomIn className="w-16 h-16" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Información del producto */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-primary">
                  {priceData.discounted}
                </span>
                {hasDiscount && priceData.original && (
                  <div className="text-right">
                    <span className="text-muted-foreground line-through text-sm">
                      {priceData.original}
                    </span>
                    {priceData.savings && (
                      <div className="text-green-600 font-semibold text-sm">
                        ¡Ahorras {priceData.savings}!
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selector de talla */}
              <div className="space-y-3">
                <h4 className="font-medium">Selecciona tu talla:</h4>
                {product.sizes && product.sizes.length > 0 ? (
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elige una talla" />
                    </SelectTrigger>
                    <SelectContent>
                      {product.sizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          Talla {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Talla única" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unica">Talla única</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsZoomOpen(false)}
                className="flex-1"
                data-testid={`button-cancel-zoom-${product.id}`}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSizeConfirm}
                disabled={!selectedSize}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid={`button-whatsapp-order-${product.id}`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Pedir por WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
