import { type ProductWithCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Star, Edit, Trash2, MessageCircle, ZoomIn, ShoppingCart, StarIcon } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/lib/cart-store";
import { useLocation } from "wouter";
import { SavingsAnimation, PulsingDiscount } from "./savings-animation";

interface ProductCardProps {
  product: ProductWithCategory;
  showManageButton?: boolean;
}

export default function ProductCard({ product, showManageButton = false }: ProductCardProps) {
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [orderForm, setOrderForm] = useState({
    fullName: "",
    address: "",
    city: "",
    size: "",
    quantity: 1,
    deliveryTime: ""
  });
  const { toast } = useToast();
  const { addItem } = useCartStore();
  const [, navigate] = useLocation();

  // Funciones auxiliares para manejo de imágenes
  const getMainImage = (product: ProductWithCategory): string => {
    // Prioridad: imageUrl primero, luego primera imagen del array
    if (product.imageUrl && product.imageUrl.trim() !== '') {
      // Si la URL no es absoluta, añadir el dominio base
      return product.imageUrl.startsWith('http') ? product.imageUrl : `${window.location.origin}${product.imageUrl}`;
    }
    if (product.images && product.images.length > 0 && product.images[0].trim() !== '') {
      return product.images[0].startsWith('http') ? product.images[0] : `${window.location.origin}${product.images[0]}`;
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

  const handleOrderSubmit = () => {
    // Validar campos requeridos
    if (!orderForm.fullName || !orderForm.address || !orderForm.city || !orderForm.size || !orderForm.deliveryTime) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos del formulario",
        variant: "destructive"
      });
      return;
    }
    
    // Sin cálculos de precio - se cotiza por WhatsApp
    
    // Obtener la imagen principal del producto
    const getProductImageUrl = () => {
      let imageUrl = product.imageUrl || product.images?.[0];
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `${window.location.origin}${imageUrl}`;
      }
      return imageUrl;
    };

    // Preparar mensaje completo para WhatsApp
    const whatsappMessage = encodeURIComponent(
      `👋 ¡Hola! Quiero hacer un pedido de FastSneaker:\n\n` +
      `📝 *DATOS DEL PEDIDO*\n` +
      `👟 *Producto:* ${product.name}\n` +
      `🔖 *Referencia:* ${product.reference || 'Sin referencia'}\n` +
      `📏 *Talla:* ${orderForm.size}\n` +
      `🔢 *Cantidad:* ${orderForm.quantity}\n\n` +
      `📍 *DATOS DE ENTREGA*\n` +
      `👤 *Nombre:* ${orderForm.fullName}\n` +
      `🏠 *Dirección:* ${orderForm.address}\n` +
      `🌆 *Ciudad:* ${orderForm.city}\n` +
      `⏰ *Horario de entrega:* ${orderForm.deliveryTime}\n\n` +
      `📸 *IMAGEN DEL PRODUCTO:*\n${getProductImageUrl()}\n\n` +
      `Por favor confirma disponibilidad y envía cotización. ¡Gracias!`
    );
    
    // Abrir WhatsApp
    window.open(`https://wa.me/573218646620?text=${whatsappMessage}`, '_blank');
    
    // Limpiar formulario y cerrar modal
    setOrderForm({
      fullName: "",
      address: "",
      city: "",
      size: "",
      quantity: 1,
      deliveryTime: ""
    });
    setIsOrderFormOpen(false);
    
    toast({
      title: "¡Pedido enviado!",
      description: "Te contactaremos pronto para confirmar tu pedido",
    });
  };

  const resetForm = () => {
    setOrderForm({
      fullName: "",
      address: "",
      city: "",
      size: "",
      quantity: 1,
      deliveryTime: ""
    });
  };

  // Remover cálculos de precio - ahora solo se cotiza por WhatsApp

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

  const renderInteractiveStars = (currentRating: number, onRatingChange: (rating: number) => void) => {
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i}
          className={`w-5 h-5 cursor-pointer transition-colors hover:text-yellow-400 ${
            i <= currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:fill-yellow-400/50'
          }`}
          onClick={() => onRatingChange(i)}
          data-testid={`star-${i}-${product.id}`}
        />
      );
    }
    
    return stars;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Evitar navegación si se hace clic en botones o imagen
    const target = e.target as HTMLElement;
    const isButton = target.closest('button') !== null;
    const isImage = target.closest('img') !== null;
    const isImageOverlay = target.closest('[data-zoom-overlay]') !== null;
    
    if (!isButton && !isImage && !isImageOverlay) {
      navigate(`/product/${product.id}`);
    }
  };

  return (
    <div 
      className="product-card bg-card border border-border rounded-lg p-2 sm:p-4 relative transition-all duration-300 hover:shadow-lg cursor-pointer" 
      data-testid={`card-product-${product.id}`}
      onClick={handleCardClick}
    >
      {/* Badges con animaciones de ahorro */}
      <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex flex-col gap-1">
        {product.isFlashSale && product.originalPrice && product.price && (
          <div className="relative">
            {(() => {
              const originalPrice = parseFloat(product.originalPrice.replace(/\./g, ''));
              const currentPrice = parseFloat(product.price.replace(/\./g, ''));
              const savings = originalPrice - currentPrice;
              const discountPercentage = Math.round((savings / originalPrice) * 100);
              
              return (
                <>
                  <PulsingDiscount discountPercentage={discountPercentage} />
                  <SavingsAnimation 
                    savings={savings}
                    originalPrice={originalPrice}
                    showAnimation={true}
                    className="absolute -top-1 -right-1"
                  />
                </>
              );
            })()}
          </div>
        )}
        {product.isFlashSale && (!product.originalPrice || !product.price) && (
          <Badge variant="destructive" className="text-[10px] sm:text-xs font-bold px-1 py-0 sm:px-2 sm:py-1">
            ¡OFERTA!
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

      <div className="relative group">
        <img 
          src={getMainImage(product) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>'} 
          alt={product.name}
          className="w-full h-24 sm:h-36 object-cover rounded-lg mb-2 sm:mb-3 cursor-pointer transition-transform hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            console.error(`❌ Error cargando imagen: ${target.src} para producto: ${product.name}`);
            target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>';
          }}
          onLoad={() => {
            console.log(`✅ Imagen cargada correctamente para producto: ${product.name}`);
          }}
          onClick={() => setIsImageZoomOpen(true)}
          data-testid={`img-product-${product.id}`}
        />
        
        {/* Zoom icon overlay */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
          data-zoom-overlay="true"
          onClick={() => setIsImageZoomOpen(true)}
        >
          <div className="w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </div>
        </div>
        
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
      
      
      <div className="flex items-center space-x-1 mb-2 sm:mb-3">
        <div className="flex">
          {renderStars(Number(product.rating || 0))}
        </div>
        <span className="text-[10px] sm:text-xs text-muted-foreground" data-testid={`text-review-count-${product.id}`}>
          ({product.reviewCount || 0})
        </span>
      </div>

      {/* Sección de calificación para clientes */}
      {!showManageButton && (
        <div className="mb-3 sm:mb-4 p-2 bg-muted/30 rounded-lg">
          <p className="text-xs sm:text-sm font-medium mb-2">¿Cómo calificarías este producto?</p>
          <div className="flex items-center gap-2">
            <div className="flex">
              {renderInteractiveStars(userRating, setUserRating)}
            </div>
            {userRating > 0 && (
              <span className="text-xs text-muted-foreground">
                ({userRating} estrella{userRating > 1 ? 's' : ''})
              </span>
            )}
          </div>
          {userRating > 0 && (
            <p className="text-xs text-green-600 mt-1">¡Gracias por tu calificación!</p>
          )}
        </div>
      )}

      {product.stock !== undefined && (
        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2" data-testid={`text-stock-${product.id}`}>
          Stock: {product.stock}
        </div>
      )}
      
      {/* Botones de acción */}
      <div className="flex gap-2 mb-2 w-full">
        <Button 
          size="sm"
          variant="outline"
          className="flex-1 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg h-7 sm:h-auto min-w-0 max-w-[48%]"
          disabled={(product.stock || 0) === 0}
          onClick={() => {
            addItem(product);
            
            // Calcular ahorro si hay descuento
            let savingsMessage = "";
            if (product.originalPrice && product.price) {
              const originalPrice = parseFloat(product.originalPrice.replace(/\./g, ''));
              const currentPrice = parseFloat(product.price.replace(/\./g, ''));
              const savings = originalPrice - currentPrice;
              if (savings > 0) {
                savingsMessage = ` ¡Ahorras $${Math.round(savings).toLocaleString('es-CO')} COP!`;
              }
            }
            
            toast({
              title: "¡Producto agregado! 🎉",
              description: `${product.name} se agregó al carrito.${savingsMessage}`,
              duration: 3000,
            });
          }}
          data-testid={`button-add-to-cart-${product.id}`}
        >
          <ShoppingCart className="w-3 h-3 mr-1" />
          <span className="truncate">{(product.stock || 0) === 0 ? 'Sin Stock' : 'Al Carrito'}</span>
        </Button>
        
        <Button 
          size="sm"
          className="flex-1 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg h-7 sm:h-auto min-w-0 max-w-[48%]"
          disabled={(product.stock || 0) === 0}
          onClick={() => setIsOrderFormOpen(true)}
          data-testid={`button-order-product-${product.id}`}
        >
          <MessageCircle className="w-3 h-3 mr-1" />
          <span className="truncate">{(product.stock || 0) === 0 ? 'Sin Stock' : 'Pedir Ya'}</span>
        </Button>
      </div>
      
      <Dialog open={isOrderFormOpen} onOpenChange={setIsOrderFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulario de Pedido - {product.name}</DialogTitle>
            <DialogDescription>
              Completa tus datos para hacer el pedido por WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Imagen del producto */}
            <div className="flex justify-center">
              <div className="relative aspect-square w-32 bg-muted rounded-lg overflow-hidden">
                {getMainImage(product) ? (
                  <img 
                    src={getMainImage(product)} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    data-testid={`img-product-${product.id}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ZoomIn className="w-8 h-8" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Información del producto */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-primary mb-2">
                {product.name}
              </h3>
              {product.reference && (
                <p className="text-sm text-muted-foreground">
                  Referencia: {product.reference}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                El precio será cotizado via WhatsApp
              </p>
            </div>
            
            {/* Formulario de pedido */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="fullName">Nombre completo *</Label>
                  <Input
                    id="fullName"
                    value={orderForm.fullName}
                    onChange={(e) => setOrderForm({...orderForm, fullName: e.target.value})}
                    placeholder="Ingresa tu nombre completo"
                    data-testid={`input-fullname-${product.id}`}
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Dirección exacta *</Label>
                  <Textarea
                    id="address"
                    value={orderForm.address}
                    onChange={(e) => setOrderForm({...orderForm, address: e.target.value})}
                    placeholder="Ingresa tu dirección completa con detalles (calle, número, apartamento, referencias)"
                    rows={3}
                    data-testid={`input-address-${product.id}`}
                  />
                </div>
                
                <div>
                  <Label htmlFor="city">Ciudad *</Label>
                  <Input
                    id="city"
                    value={orderForm.city}
                    onChange={(e) => setOrderForm({...orderForm, city: e.target.value})}
                    placeholder="¿En qué ciudad te encuentras?"
                    data-testid={`input-city-${product.id}`}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="size">Talla *</Label>
                    <Select value={orderForm.size} onValueChange={(value) => setOrderForm({...orderForm, size: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu talla" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 11}, (_, i) => 35 + i).map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="quantity">Cantidad *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm({...orderForm, quantity: parseInt(e.target.value) || 1})}
                      data-testid={`input-quantity-${product.id}`}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="deliveryTime">Horario de entrega preferido *</Label>
                  <Textarea
                    id="deliveryTime"
                    value={orderForm.deliveryTime}
                    onChange={(e) => setOrderForm({...orderForm, deliveryTime: e.target.value})}
                    placeholder="¿En qué momento prefieres que se haga el domicilio? (ej: Entre 9am-5pm, Solo fines de semana, etc.)"
                    rows={2}
                    data-testid={`input-delivery-time-${product.id}`}
                  />
                </div>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsOrderFormOpen(false);
                  resetForm();
                }}
                className="flex-1"
                data-testid={`button-cancel-order-${product.id}`}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleOrderSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid={`button-submit-order-${product.id}`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de zoom para imagen */}
      <Dialog open={isImageZoomOpen} onOpenChange={setIsImageZoomOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              Imagen en detalle del producto
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex justify-center">
            <img 
              src={getMainImage(product)} 
              alt={product.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
              data-testid={`img-zoom-${product.id}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
