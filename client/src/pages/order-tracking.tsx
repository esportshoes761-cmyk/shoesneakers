import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Package, Truck, MapPin, CheckCircle, Clock, Calendar, Phone, Mail, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  productId: string;
  quantity: number;
  totalAmount: string;
  status: string;
  deliveryTime: string;
  notes: string;
  whatsappSent: boolean;
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
  // Información del producto
  productName?: string;
  productImage?: string;
  productBrand?: string;
}

const statusConfig = {
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-500",
    icon: CheckCircle,
    description: "Tu pedido ha sido confirmado y está siendo preparado"
  },
  picked_up: {
    label: "Recogido",
    color: "bg-yellow-500",
    icon: Package,
    description: "El producto ha sido recogido y está en camino"
  },
  in_transit: {
    label: "En Tránsito",
    color: "bg-orange-500",
    icon: Truck,
    description: "Tu pedido está en camino hacia tu dirección"
  },
  delivered: {
    label: "Entregado",
    color: "bg-green-500",
    icon: MapPin,
    description: "¡Tu pedido ha sido entregado exitosamente!"
  }
};

function OrderStatusProgress({ status }: { status: string }) {
  const statuses = ['confirmed', 'picked_up', 'in_transit', 'delivered'];
  const currentIndex = statuses.indexOf(status);

  return (
    <div className="flex items-center justify-between mb-6">
      {statuses.map((statusKey, index) => {
        const config = statusConfig[statusKey as keyof typeof statusConfig];
        const Icon = config.icon;
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={statusKey} className="flex flex-col items-center flex-1">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all
              ${isActive ? config.color + ' text-white' : 'bg-gray-200 text-gray-400'}
              ${isCurrent ? 'ring-4 ring-opacity-30 ' + config.color.replace('bg-', 'ring-') : ''}
            `}>
              <Icon className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {config.label}
            </span>
            {index < statuses.length - 1 && (
              <div className={`
                absolute top-6 left-1/2 w-full h-0.5 transform translate-x-1/2 -z-10
                ${index < currentIndex ? config.color : 'bg-gray-200'}
              `} style={{ width: 'calc(100% - 3rem)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const currentStatus = statusConfig[order.status as keyof typeof statusConfig];
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Seguimiento de Pedido</CardTitle>
            <CardDescription>
              Pedido #{order.trackingNumber || order.id.slice(-8)}
            </CardDescription>
          </div>
          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="text-sm">
            {currentStatus.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progreso del pedido */}
        <div className="relative">
          <OrderStatusProgress status={order.status} />
        </div>
        
        {/* Estado actual */}
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${currentStatus.color}`} />
              <h3 className="font-semibold">{currentStatus.label}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {currentStatus.description}
            </p>
            {order.deliveryTime && (
              <div className="flex items-center gap-2 mt-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Tiempo estimado: {order.deliveryTime}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Información del producto */}
        <div>
          <h4 className="font-semibold mb-3">Información del Producto</h4>
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            {order.productImage && (
              <img 
                src={order.productImage} 
                alt={order.productName}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h5 className="font-medium">{order.productName || 'Producto'}</h5>
              {order.productBrand && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Marca: {order.productBrand}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Cantidad: {order.quantity}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">Total: ${parseInt(order.totalAmount).toLocaleString('es-CO')} COP</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Información de entrega */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Información de Contacto</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{order.customerPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{order.customerEmail}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Dirección de Entrega</h4>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mt-1">
                <Home className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {order.customerAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Notas adicionales */}
        {order.notes && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Notas Adicionales</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                {order.notes}
              </p>
            </div>
          </>
        )}

        {/* Información de fechas */}
        <Separator />
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Pedido realizado: {new Date(order.createdAt).toLocaleDateString('es-CO')}</span>
          </div>
          <div>
            <span>Última actualización: {new Date(order.updatedAt).toLocaleDateString('es-CO')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrderTracking() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"customer" | "tracking">("customer");
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/orders/${searchType}/${searchQuery}`],
    enabled: false, // Solo ejecutar cuando se haga búsqueda manual
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Ingresa tu ID de cliente o número de tracking",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      await refetch();
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Seguimiento de Pedidos</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Rastrea el estado de tu compra en tiempo real
          </p>
        </div>

        {/* Búsqueda */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Buscar Pedido</CardTitle>
            <CardDescription>
              Ingresa tu ID de cliente o número de tracking para ver el estado de tu pedido
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Button
                  variant={searchType === "customer" ? "default" : "outline"}
                  onClick={() => setSearchType("customer")}
                  size="sm"
                >
                  ID de Cliente
                </Button>
                <Button
                  variant={searchType === "tracking" ? "default" : "outline"}
                  onClick={() => setSearchType("tracking")}
                  size="sm"
                >
                  Número de Tracking
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder={searchType === "customer" ? "Ej: abc123def456" : "Ej: TRK123456789"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                  data-testid="input-search-order"
                />
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  data-testid="button-search-order"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {isLoading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                <span>Buscando pedido...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-red-600 dark:text-red-400">
                <h3 className="font-semibold mb-2">Pedido no encontrado</h3>
                <p className="text-sm">
                  Verifica tu ID de cliente o número de tracking e intenta nuevamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {orders && Array.isArray(orders) && orders.length > 0 && (
          <div className="space-y-6">
            {(orders as Order[]).map((order: Order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {orders && Array.isArray(orders) && orders.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-600 dark:text-gray-300">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="font-semibold mb-2">No se encontraron pedidos</h3>
                <p className="text-sm">
                  No hay pedidos asociados con este {searchType === "customer" ? "ID de cliente" : "número de tracking"}.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}