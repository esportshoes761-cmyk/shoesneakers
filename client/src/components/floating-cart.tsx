import { useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Plus, Minus, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";

export default function FloatingCart() {
  const [isExpanded, setIsExpanded] = useState(false);
  const cartItemCount = useCartStore(state => state.getItemCount());
  const { items, getTotalPrice, updateQuantity, removeItem, updateSize } = useCartStore();
  const [location, setLocation] = useLocation();

  // Obtener productos para mostrar en el resumen
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    enabled: items.length > 0,
  });

  const cartItems = items.map(item => {
    const product = (products as any[]).find((p: any) => p.id === item.productId);
    return product ? { ...product, quantity: item.quantity, cartItemId: item.id, selectedSize: item.size } : null;
  }).filter(Boolean);

  const totalPrice = getTotalPrice(products as any[]);

  const handleCartClick = () => {
    if (isExpanded) {
      setLocation("/checkout");
    } else {
      setIsExpanded(true);
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  if (cartItemCount === 0) return null;

  if (isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96">
        <Card className="shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Mi Carrito ({cartItemCount})
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={handleClose}
                data-testid="button-close-cart-summary"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 max-h-64 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.cartItemId} className="space-y-2" data-testid={`cart-summary-item-${item.id}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h4 className="font-medium text-xs leading-tight">{item.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.price)} c/u
                    </p>
                    <p className="text-xs font-medium text-primary">
                      Talla: {item.selectedSize}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatCurrency(Number(item.price) * item.quantity)}
                  </Badge>
                </div>
                
                {/* Controles de cantidad */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      data-testid={`button-decrease-cart-${item.id}`}
                    >
                      <Minus className="h-2 w-2" />
                    </Button>
                    <span className="w-6 text-center text-xs font-medium" data-testid={`quantity-cart-${item.id}`}>
                      {item.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      data-testid={`button-increase-cart-${item.id}`}
                    >
                      <Plus className="h-2 w-2" />
                    </Button>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.cartItemId)}
                    title="Eliminar producto"
                    data-testid={`button-remove-cart-${item.id}`}
                  >
                    <Trash2 className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Separator />
            
            <div className="flex justify-between items-center font-bold">
              <span className="text-sm">Total:</span>
              <span className="text-primary" data-testid="cart-summary-total">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            
            <Button 
              className="w-full mt-2" 
              onClick={() => setLocation("/checkout")}
              data-testid="button-checkout-from-cart"
            >
              Finalizar Compra
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        size="icon"
        className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bounce-animation"
        onClick={handleCartClick}
        data-testid="button-floating-cart"
      >
        <ShoppingCart className="w-6 h-6" />
        <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold" data-testid="text-floating-cart-count">
          {cartItemCount}
        </span>
      </Button>
    </div>
  );
}
