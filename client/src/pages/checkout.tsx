import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ArrowLeft, ShoppingBag, MessageCircle, Plus, Minus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";

// Esquema de validación para el checkout
const checkoutSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  city: z.string().min(2, "La ciudad es requerida"),
  address: z.string().min(10, "La dirección debe tener al menos 10 caracteres"),
  additionalInfo: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { items, getTotalPrice, getTotalSavings, clearCart, updateQuantity, removeItem, updateSize } = useCartStore();

  // Obtener productos del carrito
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    enabled: items.length > 0,
  });

  const cartItems = items.map(item => {
    const product = (products as any[]).find((p: any) => p.id === item.productId);
    return product ? { ...product, quantity: item.quantity, cartItemId: item.id, selectedSize: item.size } : null;
  }).filter(Boolean);

  const totalPrice = getTotalPrice(products as any[]);
  const totalSavings = getTotalSavings(products as any[]);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      city: "",
      address: "",
      additionalInfo: "",
    },
  });

  const handleCheckout = async (data: CheckoutFormData) => {
    setIsProcessing(true);
    
    try {
      // Preparar mensaje para WhatsApp
      const itemsList = cartItems.map(item => 
        `• ${item.name} (Talla ${item.selectedSize}) x${item.quantity} - ${formatCurrency(Number(item.price) * item.quantity)}`
      ).join('\n');

      const whatsappMessage = encodeURIComponent(
        `🛍️ *NUEVA ORDEN - ZAPASHOP*\n\n` +
        `👤 *Cliente:* ${data.fullName}\n` +
        `📱 *Teléfono:* ${data.phone}\n` +
        `🏙️ *Ciudad:* ${data.city}\n` +
        `📍 *Dirección:* ${data.address}\n` +
        `${data.additionalInfo ? `💬 *Información adicional:* ${data.additionalInfo}\n` : ''}` +
        `\n📦 *PRODUCTOS:*\n${itemsList}\n\n` +
        `💰 *TOTAL: ${formatCurrency(totalPrice)}*\n\n` +
        `Por favor confirmen disponibilidad y tiempo de entrega. ¡Gracias!`
      );

      // Limpiar carrito
      clearCart();

      toast({
        title: "¡Orden procesada!",
        description: "Te estamos redirigiendo a WhatsApp para confirmar tu orden",
      });

      // Redirigir a WhatsApp después de un breve delay
      setTimeout(() => {
        window.open(`https://wa.me/573219236683?text=${whatsappMessage}`, '_blank');
        window.location.href = '/';
      }, 1500);

    } catch (error) {
      toast({
        title: "Error",
        description: "Hubo un problema al procesar tu orden. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Si el carrito está vacío, redirigir
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Carrito Vacío</CardTitle>
            <CardDescription>
              No tienes productos en tu carrito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Continuar Comprando
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a ZapaShop
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario de Checkout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Información de Entrega
              </CardTitle>
              <CardDescription>
                Completa tus datos para procesar la orden
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCheckout)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-checkout-fullname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Teléfono *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 3012345678" data-testid="input-checkout-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Bogotá, Medellín, Cali..." data-testid="input-checkout-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección Completa *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Calle, número, barrio..." data-testid="input-checkout-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additionalInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Información Adicional (Opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Punto de referencia, instrucciones especiales..." data-testid="input-checkout-additional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isProcessing}
                    data-testid="button-confirm-order"
                  >
                    {isProcessing ? (
                      "Procesando..."
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Confirmar Orden por WhatsApp
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Resumen de la Orden */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de la Orden</CardTitle>
              <CardDescription>
                Revisa tus productos antes de confirmar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cartItems.map((item) => {
                const cartItem = items.find(i => i.productId === item.id);
                if (!cartItem) return null;
                
                return (
                  <div key={item.cartItemId} className="space-y-3" data-testid={`order-item-${item.id}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.price)} c/u
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatCurrency(Number(item.price) * item.quantity)}
                      </Badge>
                    </div>

                    {/* Selector de talla */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Talla:</label>
                      <Select 
                        value={item.selectedSize} 
                        onValueChange={(value) => updateSize(cartItem.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {item.sizes && item.sizes.map((size: string) => (
                            <SelectItem key={size} value={size} className="text-xs">
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Controles de cantidad */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                          data-testid={`button-decrease-${item.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium" data-testid={`quantity-${item.id}`}>
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                          data-testid={`button-increase-${item.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeItem(cartItem.id)}
                        title="Eliminar producto"
                        data-testid={`button-remove-${item.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              <Separator />
              
              {totalSavings > 0 && (
                <div className="flex justify-between items-center text-green-600 font-semibold">
                  <span className="flex items-center gap-1">
                    🎉 Total Ahorrado:
                  </span>
                  <span data-testid="order-savings">
                    {formatCurrency(totalSavings)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total:</span>
                <span className="text-primary" data-testid="order-total">
                  {formatCurrency(totalPrice)}
                </span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💬 Al confirmar, serás redirigido a WhatsApp para completar tu orden con nuestro equipo de ventas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}