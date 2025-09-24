import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, 
  Star, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock,
  MessageCircle,
  ShoppingCart,
  User,
  Calendar,
  MapPin
} from "lucide-react";
import type { ProductWithReviews, Review, Order } from "@shared/schema";
import { insertReviewSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCartStore } from "@/lib/cart-store";

const reviewFormSchema = insertReviewSchema.extend({
  customerName: z.string().min(1, "Tu nombre es requerido"),
  rating: z.number().min(1, "Calificación requerida").max(5, "Máximo 5 estrellas"),
  comment: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewFormSchema>;

const getCustomerId = () => {
  let customerId = localStorage.getItem("fastSneaker_customerId");
  if (!customerId) {
    customerId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("fastSneaker_customerId", customerId);
  }
  return customerId;
};

export default function ProductDetails() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addItem } = useCartStore();
  
  const productId = params?.id;
  const customerId = getCustomerId();

  // Query para obtener detalles del producto con reseñas
  const { data: product, isLoading: productLoading } = useQuery<ProductWithReviews>({
    queryKey: [`/api/products/${productId}/details`],
    enabled: !!productId,
  });

  // Query para obtener pedidos del cliente para este producto
  const { data: customerOrders = [] } = useQuery<Order[]>({
    queryKey: [`/api/orders/customer/${customerId}/product/${productId}`],
    enabled: !!productId && !!customerId,
  });

  // Estado controlado para los tabs - FIJO: Evita cambios automáticos
  const [activeTab, setActiveTab] = useState<'reviews' | 'tracking'>('reviews');

  // Función simple para manejar el cambio de tab - SIN automatizaciones
  const handleTabChange = (value: string) => {
    if (value === 'reviews' || value === 'tracking') {
      setActiveTab(value);
    }
  };

  // Form para reseñas
  const reviewForm = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      customerId: customerId,
      productId: productId || "",
      customerName: "",
      rating: 0,
      comment: "",
    }
  });

  // Mutación para crear reseña
  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      const response = await fetch(`/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Error creating review');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Reseña enviada!",
        description: "Tu reseña ha sido registrada exitosamente",
      });
      reviewForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/details`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar tu reseña. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  });

  const handleReviewSubmit = (data: ReviewFormData) => {
    createReviewMutation.mutate({
      ...data,
      productId: productId!,
      customerId: customerId,
    });
  };

  const renderStars = (rating: number, interactive = false, onStarClick?: (rating: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-5 h-5 ${interactive ? 'cursor-pointer' : ''} transition-colors ${
            i <= rating 
              ? 'fill-yellow-400 text-yellow-400' 
              : 'text-gray-300 hover:text-yellow-400'
          }`}
          onClick={interactive && onStarClick ? () => onStarClick(i) : undefined}
        />
      );
    }
    return stars;
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'picked_up': return <Package className="w-5 h-5 text-blue-500" />;
      case 'in_transit': return <Truck className="w-5 h-5 text-orange-500" />;
      case 'delivered': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Pedido Confirmado';
      case 'picked_up': return 'Pedido Recogido';
      case 'in_transit': return 'En Camino';
      case 'delivered': return 'Entregado';
      default: return 'Pendiente';
    }
  };

  const getOrderStatusDescription = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Tu pedido ha sido confirmado y está siendo preparado';
      case 'picked_up': return 'Tu pedido ha sido recogido y está en proceso de envío';
      case 'in_transit': return 'Tu pedido está en camino hacia su destino';
      case 'delivered': return 'Tu pedido ha sido entregado exitosamente';
      default: return 'Estado pendiente de actualización';
    }
  };

  if (!match) {
    navigate('/');
    return null;
  }

  if (productLoading || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getMainImage = (product: ProductWithReviews) => {
    if (product.imageUrl && product.imageUrl.trim() !== '') return product.imageUrl;
    if (product.images && product.images.length > 0) return product.images[0];
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      {/* Header con botón de volver */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">{product.name}</h1>
          {product.brand && (
            <p className="text-sm text-muted-foreground">{product.brand.name}</p>
          )}
        </div>
      </div>

      {/* Imagen principal del producto */}
      <div className="mb-6">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden max-w-md mx-auto">
          {getMainImage(product) ? (
            <img 
              src={getMainImage(product)!} 
              alt={product.name}
              className="w-full h-full object-cover"
              data-testid="img-product-main"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="w-16 h-16" />
            </div>
          )}
        </div>
      </div>

      {/* Información básica */}
      <div className="mb-6 text-center">
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="flex">
            {renderStars(Number(product.rating || 0))}
          </div>
          <span className="text-sm text-muted-foreground">
            ({product.reviewCount || 0} reseñas)
          </span>
        </div>
        
        {product.description && (
          <p className="text-muted-foreground mb-4">{product.description}</p>
        )}
        
        <div className="flex gap-2 justify-center mb-4">
          <Button 
            size="sm"
            variant="outline"
            className="flex-1 max-w-40"
            onClick={() => {
              addItem(product);
              toast({
                title: "Producto agregado",
                description: `${product.name} se agregó al carrito`,
              });
            }}
            data-testid="button-add-to-cart"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Al Carrito
          </Button>
        </div>
      </div>

      {/* Botones para reseñas y seguimiento - Reemplaza Tabs para evitar problemas touch */}
      <div className="w-full">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground grid grid-cols-2 w-full">
          <Button
            variant={activeTab === 'reviews' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('reviews')}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'reviews' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'hover:bg-background/50'
            }`}
            data-testid="tab-reviews"
          >
            Reseñas
          </Button>
          <Button
            variant={activeTab === 'tracking' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('tracking')}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'tracking' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'hover:bg-background/50'
            }`}
            data-testid="tab-tracking"
          >
            Seguimiento
          </Button>
        </div>

        {/* Contenido condicional basado en activeTab */}
        {activeTab === 'reviews' && (
        <div className="space-y-6 mt-6">
          {/* Formulario para nueva reseña */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deja tu reseña</CardTitle>
              <CardDescription>
                Comparte tu experiencia con este producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...reviewForm}>
                <form onSubmit={reviewForm.handleSubmit(handleReviewSubmit)} className="space-y-4">
                  <FormField
                    control={reviewForm.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tu nombre</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ingresa tu nombre" data-testid="input-reviewer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={reviewForm.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calificación</FormLabel>
                        <FormControl>
                          <div className="flex gap-1">
                            {renderStars(field.value, true, (rating) => {
                              field.onChange(rating);
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={reviewForm.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comentario (opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Cuéntanos tu experiencia con este producto..."
                            rows={4}
                            data-testid="textarea-review-comment"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    disabled={createReviewMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-review"
                  >
                    {createReviewMutation.isPending ? "Enviando..." : "Enviar Reseña"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Lista de reseñas existentes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Reseñas de otros clientes</h3>
            {product.reviews && product.reviews.length > 0 ? (
              product.reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{review.customerName}</span>
                        {review.isVerified && (
                          <Badge variant="secondary" className="text-xs">
                            ✓ Verificado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {renderStars(review.rating)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Fecha no disponible'}
                        </span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-muted-foreground">
                    Aún no hay reseñas para este producto. ¡Sé el primero en dejar una!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        )}

        {/* Contenido de Seguimiento */}
        {activeTab === 'tracking' && (
        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seguimiento de tus pedidos</h3>
            
            {customerOrders.length > 0 ? (
              customerOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Pedido #{order.id.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {getOrderStatusText(order.status)}
                      </Badge>
                    </div>
                    <CardDescription>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Pedido realizado el {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Fecha no disponible'}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Línea de seguimiento */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className={`flex items-center gap-2 ${
                          order.status === 'confirmed' || order.status === 'picked_up' || 
                          order.status === 'in_transit' || order.status === 'delivered' 
                            ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirmado</span>
                        </div>
                        <div className={`flex items-center gap-2 ${
                          order.status === 'picked_up' || order.status === 'in_transit' || order.status === 'delivered'
                            ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <Package className="w-4 h-4" />
                          <span>Recogido</span>
                        </div>
                        <div className={`flex items-center gap-2 ${
                          order.status === 'in_transit' || order.status === 'delivered'
                            ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <Truck className="w-4 h-4" />
                          <span>En Camino</span>
                        </div>
                        <div className={`flex items-center gap-2 ${
                          order.status === 'delivered'
                            ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Entregado</span>
                        </div>
                      </div>
                      
                      {/* Barra de progreso */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: order.status === 'confirmed' ? '25%' :
                                   order.status === 'picked_up' ? '50%' :
                                   order.status === 'in_transit' ? '75%' :
                                   order.status === 'delivered' ? '100%' : '0%'
                          }}
                        ></div>
                      </div>
                      
                      {/* Estado actual */}
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        {getOrderStatusIcon(order.status)}
                        <div>
                          <p className="font-medium text-sm">{getOrderStatusText(order.status)}</p>
                          <p className="text-xs text-muted-foreground">{getOrderStatusDescription(order.status)}</p>
                        </div>
                      </div>
                      
                      {/* Información del pedido */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Cantidad:</span> {order.quantity}
                        </div>
                        {order.deliveryTime && (
                          <div>
                            <span className="font-medium">Horario:</span> {order.deliveryTime}
                          </div>
                        )}
                        {order.customerAddress && (
                          <div className="col-span-2">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 mt-0.5" />
                              <div>
                                <span className="font-medium">Dirección:</span>
                                <p className="text-muted-foreground">{order.customerAddress}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No tienes pedidos de este producto aún.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      ¡Haz tu primer pedido para empezar a hacer seguimiento!
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}