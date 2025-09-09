import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Package, Truck, MapPin, CheckCircle, Clock, Edit, Phone, Mail, Home, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
}

const statusConfig = {
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-500",
    icon: CheckCircle,
    badgeVariant: "secondary" as const
  },
  picked_up: {
    label: "Recogido",
    color: "bg-yellow-500",
    icon: Package,
    badgeVariant: "secondary" as const
  },
  in_transit: {
    label: "En Tránsito",
    color: "bg-orange-500",
    icon: Truck,
    badgeVariant: "secondary" as const
  },
  delivered: {
    label: "Entregado",
    color: "bg-green-500",
    icon: MapPin,
    badgeVariant: "default" as const
  }
};

function OrderStatusUpdate({ order, onClose }: { order: Order; onClose: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [deliveryTime, setDeliveryTime] = useState(order.deliveryTime || "");
  const [notes, setNotes] = useState(order.notes || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (updateData: { status: string; deliveryTime: string; notes: string }) => {
      return apiRequest(`/api/orders/${order.id}/status`, {
        method: "PUT",
        body: updateData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Estado actualizado",
        description: "El estado del pedido se actualizó correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/admin/all"] });
      onClose();
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del pedido",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ status, deliveryTime, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="status">Estado del Pedido</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="picked_up">Recogido</SelectItem>
            <SelectItem value="in_transit">En Tránsito</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="deliveryTime">Tiempo de Entrega Estimado</Label>
        <Input
          id="deliveryTime"
          value={deliveryTime}
          onChange={(e) => setDeliveryTime(e.target.value)}
          placeholder="Ej: 2-3 días hábiles"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notas Adicionales</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Información adicional sobre el pedido..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-order">
          {updateMutation.isPending ? "Actualizando..." : "Actualizar Estado"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function OrderCard({ order }: { order: Order }) {
  const currentStatus = statusConfig[order.status as keyof typeof statusConfig];
  const Icon = currentStatus.icon;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              Pedido #{order.trackingNumber || order.id.slice(-8)}
            </CardTitle>
            <CardDescription>
              Cliente: {order.customerName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={currentStatus.badgeVariant} className="flex items-center gap-1">
              <Icon className="w-3 h-3" />
              {currentStatus.label}
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-edit-order-${order.id}`}>
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Actualizar Estado del Pedido</DialogTitle>
                  <DialogDescription>
                    Pedido #{order.trackingNumber || order.id.slice(-8)} - {order.customerName}
                  </DialogDescription>
                </DialogHeader>
                <OrderStatusUpdate 
                  order={order} 
                  onClose={() => {
                    // El diálogo se cerrará automáticamente
                  }} 
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información del cliente */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2 text-sm">Contacto</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span>{order.customerPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-green-600" />
                <span>{order.customerEmail}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 text-sm">Dirección</h4>
            <div className="flex items-start gap-2 text-sm">
              <Home className="w-4 h-4 text-purple-600 mt-0.5" />
              <span className="text-gray-600 dark:text-gray-300">
                {order.customerAddress}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Información del pedido */}
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Cantidad:</span> {order.quantity}
          </div>
          <div>
            <span className="font-medium">Total:</span> ${parseInt(order.totalAmount).toLocaleString('es-CO')} COP
          </div>
          <div>
            <span className="font-medium">ID Cliente:</span> {order.customerId.slice(-8)}
          </div>
        </div>

        {/* Tiempo de entrega */}
        {order.deliveryTime && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>Tiempo estimado: {order.deliveryTime}</span>
          </div>
        )}

        {/* Notas */}
        {order.notes && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
            <span className="font-medium">Notas: </span>
            {order.notes}
          </div>
        )}

        {/* Fechas */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Creado: {new Date(order.createdAt).toLocaleDateString('es-CO')}</span>
          </div>
          <span>Actualizado: {new Date(order.updatedAt).toLocaleDateString('es-CO')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["/api/orders/admin/all"],
  });

  const filteredOrders = orders?.filter((order: Order) => 
    filterStatus === "all" || order.status === filterStatus
  ) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
            <span>Cargando pedidos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600 dark:text-red-400">
            <h3 className="font-semibold mb-2">Error al cargar pedidos</h3>
            <p className="text-sm">No se pudieron cargar los pedidos. Intenta nuevamente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gestión de Pedidos</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Total: {filteredOrders.length} pedidos
          </span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="picked_up">Recogido</SelectItem>
              <SelectItem value="in_transit">En Tránsito</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-600 dark:text-gray-300">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="font-semibold mb-2">No hay pedidos</h3>
              <p className="text-sm">
                {filterStatus === "all" 
                  ? "No se han registrado pedidos aún." 
                  : `No hay pedidos con estado "${statusConfig[filterStatus as keyof typeof statusConfig]?.label || filterStatus}".`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order: Order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}