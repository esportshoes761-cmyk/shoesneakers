import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCartStore } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, MessageCircle } from "lucide-react";

interface CheckoutForm {
  fullName: string;
  address: string;
  city: string;
  deliveryTime: string;
}

export default function CartModal() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, updateSize, clearCart } = useCartStore();
  const { toast } = useToast();
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    fullName: "",
    address: "",
    city: "",
    deliveryTime: ""
  });

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    updateQuantity(productId, newQuantity);
  };

  const handleSizeChange = (productId: string, size: string) => {
    updateSize(productId, size);
  };

  const handleCheckout = () => {
    // Validar que todos los productos tengan talla seleccionada
    const itemsWithoutSize = items.filter(item => 
      item.product.sizes && item.product.sizes.length > 0 && !item.selectedSize
    );
    
    if (itemsWithoutSize.length > 0) {
      toast({
        title: "Selecciona las tallas",
        description: "Por favor selecciona la talla para todos los productos",
        variant: "destructive"
      });
      return;
    }

    setIsCheckoutOpen(true);
  };

  const handleSubmitOrder = () => {
    // Validar campos requeridos
    if (!checkoutForm.fullName || !checkoutForm.address || !checkoutForm.city || !checkoutForm.deliveryTime) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos del formulario",
        variant: "destructive"
      });
      return;
    }

    // Preparar mensaje para WhatsApp
    let productsList = '';
    items.forEach((item, index) => {
      productsList += `${index + 1}. 👟 ${item.product.name}\n`;
      if (item.product.reference) {
        productsList += `   🔖 Ref: ${item.product.reference}\n`;
      }
      if (item.selectedSize) {
        productsList += `   📏 Talla: ${item.selectedSize}\n`;
      }
      productsList += `   🔢 Cantidad: ${item.quantity}\n\n`;
    });

    const whatsappMessage = encodeURIComponent(
      `👋 ¡Hola! Quiero hacer un pedido de FastSniker:\n\n` +
      `📝 *PRODUCTOS SOLICITADOS*\n${productsList}` +
      `📍 *DATOS DE ENTREGA*\n` +
      `👤 *Nombre:* ${checkoutForm.fullName}\n` +
      `🏠 *Dirección:* ${checkoutForm.address}\n` +
      `🌆 *Ciudad:* ${checkoutForm.city}\n` +
      `⏰ *Horario de entrega:* ${checkoutForm.deliveryTime}\n\n` +
      `Por favor envía las fotografías de los productos y cotización total. ¡Gracias!`
    );

    // Abrir WhatsApp
    window.open(`https://wa.me/573218646620?text=${whatsappMessage}`, '_blank');

    // Limpiar carrito y formularios
    clearCart();
    setCheckoutForm({
      fullName: "",
      address: "",
      city: "",
      deliveryTime: ""
    });
    setIsCheckoutOpen(false);
    setIsOpen(false);

    toast({
      title: "¡Pedido enviado!",
      description: "Te contactaremos pronto para confirmar tu pedido",
    });
  };

  return (
    <>
      {/* Modal principal del carrito */}
      <Dialog open={isOpen && !isCheckoutOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carrito de Compras</DialogTitle>
            <DialogDescription>
              {items.length === 0 ? 'Tu carrito está vacío' : `${items.length} producto(s) en tu carrito`}
            </DialogDescription>
          </DialogHeader>

          {items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay productos en tu carrito</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-4 p-4 border rounded-lg">
                  <img 
                    src={(() => {
                      let imageUrl = item.product.imageUrl || item.product.images?.[0];
                      if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = `${window.location.origin}${imageUrl}`;
                      }
                      return imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%236b7280">Sin imagen</text></svg>';
                    })()} 
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded"
                    data-testid={`img-cart-item-${item.product.id}`}
                  />
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{item.product.name}</h4>
                    {item.product.reference && (
                      <p className="text-xs text-muted-foreground">Ref: {item.product.reference}</p>
                    )}
                    
                    {/* Selector de talla */}
                    {item.product.sizes && item.product.sizes.length > 0 && (
                      <div className="mt-2">
                        <Label className="text-xs">Talla:</Label>
                        <Select 
                          value={item.selectedSize || ""} 
                          onValueChange={(size) => handleSizeChange(item.product.id, size)}
                        >
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue placeholder="Talla" />
                          </SelectTrigger>
                          <SelectContent>
                            {item.product.sizes.map((size) => (
                              <SelectItem key={size} value={size}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-8 h-8 p-0"
                        onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.product.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-8 h-8 p-0"
                        onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.product.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {/* Botón eliminar */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-8 h-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.product.id)}
                      data-testid={`button-remove-${item.product.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => clearCart()}
                  className="flex-1"
                  data-testid="button-clear-cart"
                >
                  Vaciar Carrito
                </Button>
                <Button 
                  onClick={handleCheckout}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-checkout"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Hacer Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de checkout */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulario de Pedido</DialogTitle>
            <DialogDescription>
              Completa tus datos para enviar el pedido por WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nombre completo *</Label>
              <Input
                id="fullName"
                value={checkoutForm.fullName}
                onChange={(e) => setCheckoutForm({...checkoutForm, fullName: e.target.value})}
                placeholder="Tu nombre completo"
                data-testid="input-checkout-name"
              />
            </div>

            <div>
              <Label htmlFor="address">Dirección de entrega *</Label>
              <Input
                id="address"
                value={checkoutForm.address}
                onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})}
                placeholder="Dirección completa incluyendo barrio"
                data-testid="input-checkout-address"
              />
            </div>

            <div>
              <Label htmlFor="city">Ciudad *</Label>
              <Input
                id="city"
                value={checkoutForm.city}
                onChange={(e) => setCheckoutForm({...checkoutForm, city: e.target.value})}
                placeholder="Ciudad"
                data-testid="input-checkout-city"
              />
            </div>

            <div>
              <Label htmlFor="deliveryTime">Horario de entrega preferido *</Label>
              <Textarea
                id="deliveryTime"
                value={checkoutForm.deliveryTime}
                onChange={(e) => setCheckoutForm({...checkoutForm, deliveryTime: e.target.value})}
                placeholder="¿En qué momento prefieres que se haga el domicilio? (ej: Entre 9am-5pm, Solo fines de semana, etc.)"
                rows={2}
                data-testid="input-checkout-delivery-time"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1"
                data-testid="button-cancel-checkout"
              >
                Volver al Carrito
              </Button>
              <Button 
                onClick={handleSubmitOrder}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-submit-checkout"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}