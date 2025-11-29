import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, insertPromotionSchema, insertEventSchema, insertBrandSchema } from "@shared/schema";
import type { Product, Promotion, Event, Category, Brand, BrandWithProducts, ProductDuplicateAlert } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Package, Gift, Calendar as CalendarIcon, Trash2, Edit, X, ImagePlus, LogOut, Users, Briefcase, Lightbulb, ZoomIn, Star, Truck, Eye, Layers, Sparkles, Check, Settings, Search, Upload, Copy, Merge, Filter, ChevronDown, ChevronRight, AlertTriangle, Hash, UserX, ArrowLeft, DollarSign, FileText, BarChart3, Clock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useAuth, logout } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { MultiImageUploader } from "@/components/MultiImageUploader";
import IntelligentUploader from "@/components/IntelligentUploader";
import { formatCurrency } from "@/lib/currency";
import { getBrandLogoType } from "@/lib/brand-utils";
import AdminOrders from "@/components/admin-orders";
import { parseApiError } from "@/lib/parse-api-error";
import { DuplicatesDetailedReport } from "@/components/DuplicatesDetailedReport";

const productFormSchema = insertProductSchema.extend({
  categoryId: z.string().min(1, "Selecciona una categoría"),
  brandId: z.string().min(1, "Selecciona una marca"),
});

const promotionFormSchema = insertPromotionSchema.extend({
  title: z.string().min(1, "El título es requerido"),
  startDate: z.date({ required_error: "La fecha de inicio es requerida" }),
  endDate: z.date({ required_error: "La fecha de fin es requerida" }),
});

const eventFormSchema = insertEventSchema.extend({
  title: z.string().min(1, "El título es requerido"),
  eventType: z.string().min(1, "El tipo de evento es requerido"),
  startDate: z.date({ required_error: "La fecha de inicio es requerida" }),
  endDate: z.date({ required_error: "La fecha de fin es requerida" }),
});

const brandFormSchema = insertBrandSchema.extend({
  name: z.string().min(1, "El nombre de la marca es requerido"),
  logo: z.string().optional(),
});

// Duplicate management schemas
const duplicateFiltersSchema = z.object({
  by: z.enum(["reference", "name", "image"]),
  brandId: z.string().optional(),
  search: z.string().optional(),
});

const mergeProductsSchema = z.object({
  primaryId: z.string().min(1, "Primary product ID is required"),
  duplicateIds: z.array(z.string()).min(1, "At least one duplicate ID is required"),
  strategy: z.enum(["keep_primary", "merge_data"]),
});

const editProductSchema = insertProductSchema.partial();

// 🤖 BULK UPLOAD: Schemas and interfaces for AI-powered bulk upload
interface BulkUploadResult {
  success: boolean;
  product?: Product;
  detectedBrand: string;
  confidence: number;
  detectionMethod: string;
  imageUrl: string;
  originalFileName: string;
}

interface BulkUploadResponse {
  message: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  results: BulkUploadResult[];
  errors: Array<{
    index: number;
    error: string;
    imageData: string;
  }>;
}

// 🔒 SECURE: Brand bulk editing schemas
const bulkUpdateSchema = z.object({
  productIds: z.array(z.string()).min(1, "Selecciona al menos un producto"),
  updates: z.object({
    price: z.string().optional(),
    salePrice: z.string().optional(),
    stock: z.number().optional(),
    imageUrl: z.string().optional(),
  }).refine(data => Object.values(data).some(value => value !== undefined && value !== ""), {
    message: "Debe especificar al menos un campo para actualizar"
  })
});

const priceAdjustmentSchema = z.object({
  productIds: z.array(z.string()).min(1, "Selecciona al menos un producto"),
  adjustmentType: z.enum(["percentage", "fixed", "set"]),
  adjustmentValue: z.number().min(0.01, "El valor debe ser mayor a 0"),
  operation: z.enum(["increase", "decrease"]).optional(),
  applyTo: z.enum(["price", "originalPrice", "both"])
}).refine((data) => {
  // Operation is required for percentage and fixed, but not for set
  if (data.adjustmentType === "set") {
    return true;
  }
  return data.operation !== undefined;
}, {
  message: "La operación es requerida para ajustes de porcentaje y fijo",
  path: ["operation"]
});

type ProductFormData = z.infer<typeof productFormSchema>;
type PromotionFormData = z.infer<typeof promotionFormSchema>;
type EventFormData = z.infer<typeof eventFormSchema>;
type BrandFormData = z.infer<typeof brandFormSchema>;
type DuplicateFiltersData = z.infer<typeof duplicateFiltersSchema>;
type MergeProductsData = z.infer<typeof mergeProductsSchema>;
type EditProductData = z.infer<typeof editProductSchema>;
type BulkUpdateData = z.infer<typeof bulkUpdateSchema>;
type PriceAdjustmentData = z.infer<typeof priceAdjustmentSchema>;

// Duplicate group type
type DuplicateGroup = {
  key: string;
  products: Product[];
  count: number;
  brands: string[];
  categories: string[];
};

// Brand package schema for bulk product creation - SECURE VERSION 🔒
const brandPackageSchema = z.object({
  brandId: z.string().min(1, "Selecciona una marca"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  images: z.array(z.string()).min(1, "Se requiere al menos 1 imagen"),
  sizeFrom: z.string().min(1, "Selecciona talla inicial"),
  sizeTo: z.string().min(1, "Selecciona talla final"),
});

type BrandPackageFormData = z.infer<typeof brandPackageSchema>;

// Utilidades para formateo de precios colombianos
const formatPrice = (value: string) => {
  // Remover todo excepto números
  const numericValue = value.replace(/\D/g, '');
  // Formatear con separadores de miles
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parsePrice = (formattedValue: string) => {
  // Convertir de formato con puntos a número
  return formattedValue.replace(/\./g, '');
};

const calculateDiscount = (originalPrice: string, salePrice: string) => {
  const original = parseFloat(parsePrice(originalPrice));
  const sale = parseFloat(parsePrice(salePrice));
  
  if (original === 0 || sale >= original) return 0;
  return Math.round(((original - sale) / original) * 100);
};

// ✨ DUPLICATE MANAGEMENT: Component for displaying duplicate groups
interface DuplicateGroupsListProps {
  filters: DuplicateFiltersData;
  page: number;
  expandedGroups: Set<string>;
  selectedProducts: Set<string>;
  onToggleExpand: (groupKey: string) => void;
  onToggleSelect: (productId: string) => void;
  onEditProduct: (product: Product) => void;
  onMergeProducts: (groupKey: string, products: Product[]) => void;
  onPageChange: (page: number) => void;
}

const DuplicateGroupsList: React.FC<DuplicateGroupsListProps> = ({
  filters,
  page,
  expandedGroups,
  selectedProducts,
  onToggleExpand,
  onToggleSelect,
  onEditProduct,
  onMergeProducts,
  onPageChange,
}) => {
  const { toast } = useToast();

  const duplicatesQuery = useQuery({
    queryKey: ["/api/admin/products/duplicates", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        by: filters.by,
        page: page.toString(),
        limit: "20",
      });
      
      if (filters.brandId) {
        params.append("brandId", filters.brandId);
      }
      
      if (filters.search) {
        params.append("search", filters.search);
      }
      
      const response = await apiRequest("GET", `/api/admin/products/duplicates?${params}`);
      return response.json();
    },
  });

  if (duplicatesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Buscando productos duplicados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (duplicatesQuery.isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p>Error al cargar los productos duplicados</p>
            <Button 
              variant="outline" 
              onClick={() => duplicatesQuery.refetch()}
              className="mt-2"
            >
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = duplicatesQuery.data;
  const groups = data?.data?.groups || [];
  const summary = data?.data?.summary || {};
  const pagination = data?.data?.pagination || {};

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4" />
            <p>No se encontraron productos duplicados con los filtros actuales</p>
            <p className="text-sm mt-2">Intenta cambiar los criterios de búsqueda</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{summary.totalGroups || 0}</div>
              <div className="text-sm text-muted-foreground">Grupos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{summary.totalDuplicates || 0}</div>
              <div className="text-sm text-muted-foreground">Duplicados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{summary.totalProducts || 0}</div>
              <div className="text-sm text-muted-foreground">Productos Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{summary.brandCount || 0}</div>
              <div className="text-sm text-muted-foreground">Marcas Afectadas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((group: DuplicateGroup) => {
          const isExpanded = expandedGroups.has(group.key);
          const groupSelectedProducts = group.products.filter(p => selectedProducts.has(p.id));
          
          return (
            <Card key={group.key} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleExpand(group.key)}
                      data-testid={`button-expand-${group.key}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{group.key}</span>
                        <Badge variant="secondary">
                          {group.count} productos
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>Marcas: {group.brands?.join(", ") || "N/A"}</span>
                        <span>Categorías: {group.categories?.join(", ") || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {groupSelectedProducts.length > 0 && (
                      <Badge variant="outline">
                        {groupSelectedProducts.length} seleccionados
                      </Badge>
                    )}
                    
                    {isExpanded && group.products.length > 1 && (
                      <Button
                        size="sm"
                        onClick={() => onMergeProducts(group.key, group.products)}
                        disabled={group.products.length < 2}
                        data-testid={`button-merge-${group.key}`}
                      >
                        <Merge className="h-4 w-4 mr-1" />
                        Fusionar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {group.products.map((product, index) => {
                      const isSelected = selectedProducts.has(product.id);
                      
                      return (
                        <div
                          key={product.id}
                          className={`border rounded-lg p-3 ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelect(product.id)}
                                className="mt-1"
                                data-testid={`checkbox-select-${product.id}`}
                              />
                              
                              {product.imageUrl && (
                                <img
                                  src={buildImageSrc(product.imageUrl)}
                                  alt={product.name}
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium truncate">{product.name}</h4>
                                  {index === 0 && (
                                    <Badge variant="default" className="text-xs">
                                      Primario
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-sm text-muted-foreground">
                                  <span>Ref: {product.reference || "Sin referencia"}</span>
                                  <span>Precio: {formatCurrency(product.price)} COP</span>
                                  <span>ID: {product.id.slice(0, 8)}...</span>
                                </div>
                                
                                {product.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {product.description}
                                  </p>
                                )}
                                
                                {((product.sizes?.length ?? 0) > 0 || (product.colors?.length ?? 0) > 0) && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {product.sizes?.map((size) => (
                                      <Badge key={size} variant="outline" className="text-xs">
                                        {size}
                                      </Badge>
                                    ))}
                                    {product.colors?.map((color) => (
                                      <Badge key={color} variant="secondary" className="text-xs">
                                        {color}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditProduct(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Página {pagination.currentPage} de {pagination.totalPages}
                ({pagination.totalItems} elementos total)
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage <= 1}
                  onClick={() => onPageChange(pagination.currentPage - 1)}
                  data-testid="button-prev-page"
                >
                  Anterior
                </Button>
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, pagination.currentPage - 2) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage >= pagination.totalPages}
                  onClick={() => onPageChange(pagination.currentPage + 1)}
                  data-testid="button-next-page"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// 🎯 COMPONENT: Simple Brand Product Manager - SOLUCIÓN DIRECTA
const SimpleBrandProductManager: React.FC = () => {
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get brands with products
  const brandsQuery = useQuery({
    queryKey: ["/api/brands/admin/with-products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/brands/admin/with-products");
      return response.json();
    },
  });

  // Get products for selected brand
  const productsQuery = useQuery({
    queryKey: ["/api/products/brand", selectedBrand?.id],
    queryFn: async () => {
      if (!selectedBrand?.id) return [];
      const response = await apiRequest("GET", "/api/products");
      const allProducts = await response.json();
      return allProducts.filter((p: any) => p.brandId === selectedBrand.id);
    },
    enabled: !!selectedBrand?.id,
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/products/${data.id}`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.updates),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Producto Actualizado",
        description: "Los cambios se guardaron correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products/brand", selectedBrand?.id] });
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo actualizar el producto",
        variant: "destructive",
      });
    },
  });

  // Edit form
  const editForm = useForm({
    defaultValues: {}
  });

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    editForm.reset({
      name: product.name || "",
      price: product.price || "",
      originalPrice: product.originalPrice || "",
      description: product.description || "",
      sizes: Array.isArray(product.sizes) ? product.sizes.join(", ") : (product.sizes || ""),
      colors: Array.isArray(product.colors) ? product.colors.join(", ") : (product.colors || ""),
      reference: product.reference || "",
    });
  };

  const handleSaveProduct = (data: any) => {
    if (!editingProduct) return;
    
    const payload: any = {};
    
    if (data.name && data.name.trim()) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description;
    if (data.price) payload.price = data.price;
    if (data.originalPrice) payload.originalPrice = data.originalPrice;
    if (data.reference !== undefined) payload.reference = data.reference;
    if (data.categoryId) payload.categoryId = data.categoryId;
    if (data.brandId) payload.brandId = data.brandId;
    if (data.sizes) payload.sizes = data.sizes.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (data.colors) payload.colors = data.colors.split(",").map((c: string) => c.trim()).filter(Boolean);

    updateProductMutation.mutate({ id: editingProduct.id, updates: payload });
  };

  // Si no hay marca seleccionada, mostrar lista de marcas
  if (!selectedBrand) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🏷️ Gestión de Productos por Marca</h1>
          <p className="text-muted-foreground">Selecciona una marca para editar sus productos</p>
        </div>

        {brandsQuery.isLoading ? (
          <div className="flex justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg">Cargando marcas...</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {brandsQuery.data?.map((brand: any) => (
              <Card key={brand.id} className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-blue-300">
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} className="w-20 h-20 object-contain mx-auto" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg mx-auto flex items-center justify-center">
                        <Briefcase className="h-10 w-10 text-gray-500" />
                      </div>
                    )}
                    
                    <div>
                      <h2 className="text-2xl font-bold">{brand.name}</h2>
                      <Badge variant="secondary" className="mt-2 text-lg px-4 py-1">
                        {brand.productCount} productos
                      </Badge>
                    </div>
                    
                    <Button 
                      onClick={() => setSelectedBrand(brand)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                      size="lg"
                    >
                      <Package className="h-5 w-5 mr-2" />
                      Ver Productos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Si hay marca seleccionada, mostrar productos
  return (
    <div className="space-y-6">
      {/* Header con botón de regreso */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setSelectedBrand(null)}
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Marcas
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-blue-900">🏷️ {selectedBrand.name}</h1>
            <p className="text-blue-700">
              {productsQuery.data?.length || 0} productos disponibles
            </p>
          </div>
          
          <div className="w-32"></div>
        </div>
      </div>

      {/* Lista de productos en 2 columnas */}
      {productsQuery.isLoading ? (
        <div className="flex justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">Cargando productos...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {productsQuery.data?.map((product: any) => (
            <Card key={product.id} className="hover:shadow-lg transition-all border-2 hover:border-blue-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {/* Imagen */}
                  <div className="flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={buildImageSrc(product.imageUrl)}
                        alt={product.name}
                        className="w-32 h-32 object-cover rounded-lg border"
                        onError={(e) => {
                          console.error(`❌ Error cargando imagen: ${product.imageUrl}`);
                          e.currentTarget.style.display = 'none';
                        }}
                        onLoad={() => console.log(`✅ Imagen cargada: ${product.name}`)}
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Package className="h-12 w-12 text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1">Sin imagen</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Información */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">Ref: {product.reference || "Sin referencia"}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Precio:</span>
                        <div className="font-bold text-lg">{formatCurrency(product.price)} COP</div>
                        {product.salePrice && (
                          <div className="text-green-600 font-medium">
                            Oferta: {formatCurrency(product.salePrice)} COP
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stock:</span>
                        <div className="font-semibold">{product.stock || 0} unidades</div>
                      </div>
                    </div>
                    
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const response = await apiRequest("PATCH", `/api/products/${product.id}/toggle-price`);
                            const data = await response.json();
                            if (data.success) {
                              toast({
                                title: data.message,
                                description: `Precio ahora ${data.data.showPrice ? 'visible' : 'oculto'}`
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/products", "brands", selectedBrand?.id] });
                            }
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message,
                              variant: "destructive"
                            });
                          }
                        }}
                        variant={product.showPrice ? "default" : "outline"}
                        className={product.showPrice ? "bg-green-600 hover:bg-green-700" : ""}
                        data-testid={`button-toggle-price-${product.id}`}
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>✏️ Editar Producto</DialogTitle>
            <DialogDescription>Modifica todos los datos del producto</DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSaveProduct)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre completo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Código/referencia" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Normal</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="originalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Original</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0 (opcional)" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="sizes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tallas</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="35, 36, 37..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descripción del producto" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {updateProductMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// 🔥 FUNCIÓN GLOBAL: Construir URLs de imagen sin duplicación  
const buildImageSrc = (imageUrl: string | null | undefined): string => {
  if (!imageUrl || imageUrl.trim() === '') {
    return '';
  }
  
  let cleanUrl = imageUrl.trim();
  
  // Si ya es una URL completa (http/https), usarla tal como está
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }
  
  // 🔥 CRÍTICO: LIMPIAR cualquier duplicación existente de api/images
  cleanUrl = cleanUrl.replace(/\/?api\/images\/*/g, '');
  cleanUrl = cleanUrl.replace(/\/+/g, '').trim();
  
  if (!cleanUrl) {
    return '';
  }
  
  // ✅ CONSTRUIR URL LIMPIA: Siempre empezar desde cero con una sola instancia
  return `/api/images/${encodeURIComponent(cleanUrl)}`;
};

// 🚀 COMPONENT: Products by Brand Manager
const ProductsByBrandManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Navigation state
  const [currentView, setCurrentView] = useState<"brands" | "products" | "edit">("brands");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Form management for product editing
  const editForm = useForm<EditProductData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {}
  });

  // Queries
  const brandsQuery = useQuery({
    queryKey: ["/api/brands/admin/with-products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/brands/admin/with-products");
      return response.json();
    },
  });

  const productsQuery = useQuery({
    queryKey: ["/api/admin/brands", selectedBrandId, "products", currentPage],
    queryFn: async () => {
      if (!selectedBrandId) return null;
      const response = await apiRequest("GET", `/api/admin/brands/${selectedBrandId}/products?page=${currentPage}&limit=20`);
      return response.json();
    },
    enabled: !!selectedBrandId && currentView === "products",
  });

  const allBrandsQuery = useQuery({
    queryKey: ["/api/brands"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/brands");
      return response.json();
    },
    enabled: currentView === "edit",
  });

  // Mutations
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: EditProductData }) => {
      const response = await apiRequest("PATCH", `/api/admin/products/${data.id}`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.updates),
      });
      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "✅ Producto Actualizado",
        description: "El producto se ha actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brands", selectedBrandId, "products"] });
      setCurrentView("products");
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al Actualizar",
        description: error.message || "No se pudo actualizar el producto",
        variant: "destructive",
      });
    },
  });

  // ✅ ARREGLO NAVEGACIÓN: Asegurar que siempre vaya a productos
  const handleViewProducts = (brand: any) => {
    console.log('🎯 Navegando a productos de marca:', brand.name, 'ID:', brand.id);
    setSelectedBrandId(brand.id);
    setSelectedBrand(brand);
    setCurrentView("products"); // ✅ CORRECTO: ir a vista de productos
    setCurrentPage(1);
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    editForm.reset({
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice || "",
      reference: product.reference,
      brandId: product.brandId,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
      description: product.description || "",
    });
    setCurrentView("edit");
  };

  const handleBackToBrands = () => {
    setCurrentView("brands");
    setSelectedBrandId("");
    setSelectedBrand(null);
  };

  const handleBackToProducts = () => {
    setCurrentView("products");
    setEditingProduct(null);
  };

  const handleSaveProduct = (data: EditProductData) => {
    if (!editingProduct) return;
    
    updateProductMutation.mutate({
      id: editingProduct.id,
      updates: data
    });
  };

  const products = productsQuery.data?.data.products || [];
  const pagination = productsQuery.data?.data.pagination;

  // Brands View
  if (currentView === "brands") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gestión de Productos por Marca</h3>
          <Badge variant="outline">
            {brandsQuery.data?.filter((b: any) => b.productCount > 0).length || 0} marcas con productos
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Marcas Disponibles
            </CardTitle>
            <CardDescription>
              Selecciona una marca para ver y editar sus productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brandsQuery.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Cargando marcas...</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {brandsQuery.data?.filter((brand: any) => brand.productCount > 0).map((brand: any) => (
                  <Card key={brand.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-lg">{brand.name}</h4>
                        {brand.logoUrl && (
                          <img
                            src={`/api/images/${brand.logoUrl}`}
                            alt={brand.name}
                            className="w-12 h-12 object-contain"
                          />
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Productos:</span>
                          <Badge variant="secondary">{brand.productCount}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ubicación:</span>
                          <span className="capitalize">{brand.displayLocation}</span>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleViewProducts(brand)}
                        className="w-full"
                        data-testid={`button-view-products-${brand.id}`}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Ver Productos
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Products View
  if (currentView === "products") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleBackToBrands}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Marcas
            </Button>
            <div>
              <h3 className="text-lg font-semibold">Productos de {selectedBrand?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {pagination ? `${pagination.total} productos encontrados` : "Cargando productos..."}
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {productsQuery.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Cargando productos...</p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center p-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron productos para esta marca</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product: any) => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        {/* Product Image */}
                        <div className="aspect-square relative">
                          {product.imageUrl ? (
                            <img
                              src={buildImageSrc(product.imageUrl)}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-t-lg"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center rounded-t-lg">
                              <Package className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm leading-tight">{product.name}</h4>
                            <p className="text-xs text-muted-foreground">{product.category?.name}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Precio:</span>
                              <span className="font-mono text-sm">${formatCurrency(product.price)}</span>
                            </div>
                            
                            {product.originalPrice && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Precio Orig:</span>
                                <span className="font-mono text-sm text-muted-foreground line-through">${formatCurrency(product.originalPrice)}</span>
                              </div>
                            )}
                            
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Ref:</span>
                              <span className="font-mono text-xs">{product.reference}</span>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={() => handleEditProduct(product)}
                            size="sm"
                            className="w-full"
                            data-testid={`button-edit-product-${product.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Producto
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {pagination.page} de {pagination.totalPages} ({pagination.total} productos)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!pagination.hasMore}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Edit Product View
  if (currentView === "edit" && editingProduct) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleBackToProducts}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Productos
            </Button>
            <div>
              <h3 className="text-lg font-semibold">Editar Producto</h3>
              <p className="text-sm text-muted-foreground">{editingProduct.name}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Product Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="aspect-square relative">
                  {editingProduct.imageUrl ? (
                    <img
                      src={buildImageSrc(editingProduct.imageUrl)}
                      alt={editingProduct.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center rounded-lg">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold">{editingProduct.name}</h4>
                  <p className="text-sm text-muted-foreground">{editingProduct.category?.name}</p>
                  <div className="flex items-center gap-4">
                    <span className="font-mono">${formatCurrency(editingProduct.price)}</span>
                    {editingProduct.originalPrice && (
                      <span className="font-mono text-muted-foreground line-through">${formatCurrency(editingProduct.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>Editar Información</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSaveProduct)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Producto</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nombre del producto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="50.000"
                              onChange={(e) => field.onChange(formatPrice(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="originalPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio Original</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="45.000"
                              onChange={(e) => field.onChange(formatPrice(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referencia</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="REF-001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar marca" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allBrandsQuery.data?.map((brand: any) => (
                              <SelectItem key={brand.id} value={brand.id}>
                                {brand.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            value={field.value ?? ""}
                            className="w-full px-3 py-2 border border-input rounded-md"
                            rows={3}
                            placeholder="Descripción del producto..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBackToProducts}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateProductMutation.isPending}
                      className="flex-1"
                    >
                      {updateProductMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

// 🤖 COMPONENTE: Panel de Carga Masiva con Clasificación Automática de Marcas
function BulkUploadPanel() {
  const { toast } = useToast();
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<BulkUploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Mutation para carga masiva
  const bulkUploadMutation = useMutation({
    mutationFn: async (images: File[]) => {
      const formattedImages = await Promise.all(
        images.map(async (file, index) => {
          return new Promise<{imageData: string, fileName: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                imageData: reader.result as string,
                fileName: file.name || `imagen_${index}.jpg`
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const response = await apiRequest("POST", "/api/products/bulk-upload", {
        images: formattedImages
      });
      return response.json();
    },
    onSuccess: (data: BulkUploadResponse) => {
      setUploadResults(data);
      toast({
        title: "✅ Carga masiva completada",
        description: `${data.successful} productos creados exitosamente, ${data.failed} errores`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error en carga masiva",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validar tipos de archivo
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024 // 10MB max
    );

    if (validFiles.length !== files.length) {
      toast({
        title: "⚠️ Archivos filtrados",
        description: `${files.length - validFiles.length} archivos fueron excluidos (solo imágenes, máximo 10MB)`,
        variant: "destructive",
      });
    }

    setSelectedImages(validFiles);
    setUploadResults(null); // Limpiar resultados anteriores
  };

  const handleBulkUpload = async () => {
    if (selectedImages.length === 0) {
      toast({
        title: "⚠️ No hay imágenes",
        description: "Selecciona al menos una imagen para subir",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedImages.length });
    
    try {
      await bulkUploadMutation.mutateAsync(selectedImages);
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedImages([]);
    setUploadResults(null);
  };

  return (
    <div className="space-y-6">
      {/* Selector de imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Seleccionar Imágenes
          </CardTitle>
          <CardDescription>
            Selecciona múltiples imágenes de productos. El sistema analizará cada imagen automáticamente para detectar la marca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-4">
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelection}
              className="cursor-pointer"
              data-testid="input-bulk-upload-images"
            />
            
            {selectedImages.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">
                  📸 {selectedImages.length} imágenes seleccionadas
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vista previa de imágenes seleccionadas */}
      {selectedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>
              Revisa las imágenes antes de iniciar el procesamiento automático
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {selectedImages.map((file, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs text-center px-2">
                      {file.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botón de procesamiento */}
      {selectedImages.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleBulkUpload}
              disabled={isUploading}
              className="w-full"
              size="lg"
              data-testid="button-start-bulk-upload"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando {uploadProgress.current}/{uploadProgress.total}...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Procesar con IA ({selectedImages.length} imágenes)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultados de la carga */}
      {uploadResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Resultados del Procesamiento
            </CardTitle>
            <CardDescription>
              {uploadResults.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{uploadResults.successful}</div>
                <div className="text-sm text-green-700">Exitosos</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{uploadResults.failed}</div>
                <div className="text-sm text-red-700">Errores</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{uploadResults.totalProcessed}</div>
                <div className="text-sm text-blue-700">Total</div>
              </div>
            </div>

            {/* Lista de productos creados */}
            {uploadResults.results.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold">Productos Creados:</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {uploadResults.results.map((result, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <img
                        src={result.imageUrl}
                        alt={result.originalFileName}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {result.product?.name || 'Producto sin nombre'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Marca: <span className="font-medium">{result.detectedBrand}</span>
                          {' • '}
                          Confianza: {(result.confidence * 100).toFixed(1)}%
                          {' • '}
                          Método: {result.detectionMethod === 'visual_ai' ? 'IA Visual' : 'Archivo'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Ref: {result.product?.reference}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {result.product?.reference}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de errores */}
            {uploadResults.errors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-red-600">Errores:</h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {uploadResults.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg">
                      <div className="text-sm font-medium text-red-700">
                        {error.imageData}
                      </div>
                      <div className="text-xs text-red-600">{error.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // ✨ REORGANIZED: Main tab navigation
  const [activeTab, setActiveTab] = useState("catalog");
  const [catalogSubTab, setCatalogSubTab] = useState("list");
  const [toolsSubTab, setToolsSubTab] = useState("duplicates");
  
  // ✨ CENTRALIZED: Single modal state per tab
  const [activeModal, setActiveModal] = useState<{
    type: "product" | "brand" | "promotion" | "event" | "brandProducts" | "duplicateWarning" | "deleteBrand" | "brandPackage" | "malformedUrls" | "mergeConfirm" | "editProduct" | "bulkPriceAdjust" | null;
    data?: any;
  }>({ type: null });
  
  // ✨ UNIFIED: Image zoom with Drawer
  const [imageZoomDrawer, setImageZoomDrawer] = useState<{
    product: Product;
    isOpen: boolean;
  } | null>(null);
  
  // ✨ CENTRALIZED: Edit states
  const [editingItem, setEditingItem] = useState<{
    type: "product" | "brand" | null;
    item: Product | BrandWithProducts | null;
  }>({ type: null, item: null });
  
  // ✨ PRODUCT FORM: Centralized product form states
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [searchReference, setSearchReference] = useState("");
  
  // ✨ UNIFIED: Bulk operations
  const [bulkOperations, setBulkOperations] = useState<{
    brandPackage: {
      images: string[];
      progress: { isProcessing: boolean; currentIndex: number; total: number; results: { success: number; failed: number; errors: string[] } };
    };
    intelligentUpload: {
      images: string[];
      progress: { isProcessing: boolean; currentIndex: number; total: number; results: { success: number; failed: number; errors: string[] } };
    };
  }>({ 
    brandPackage: { images: [], progress: { isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } } },
    intelligentUpload: { images: [], progress: { isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } } }
  });

  // ✨ CENTRALIZED: Specific operation states (replacing legacy)
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [pendingProductData, setPendingProductData] = useState<ProductFormData | null>(null);
  const [duplicatedProducts, setDuplicatedProducts] = useState<Product[]>([]);
  const [brandToDelete, setBrandToDelete] = useState<BrandWithProducts | null>(null);

  // ✨ CENTRALIZED: Intelligent upload states (replacing legacy)
  const [intelligentUploadedImages, setIntelligentUploadedImages] = useState<string[]>([]);

  // ✨ DUPLICATE MANAGEMENT: Centralized duplicate states
  const [duplicateFilters, setDuplicateFilters] = useState<DuplicateFiltersData>({
    by: "reference",
    brandId: "",
    search: "",
  });
  const [duplicatePage, setDuplicatePage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Estados para ajuste masivo de precios
  const [bulkPriceAdjustment, setBulkPriceAdjustment] = useState<{
    type: "percentage" | "fixed" | "set";
    value: string;
    operation?: "increase" | "decrease";
    applyTo: "price" | "originalPrice" | "both";
  }>({
    type: "percentage",
    value: "",
    operation: "increase",
    applyTo: "price"
  });
  const [mergeData, setMergeData] = useState<{
    groupKey: string;
    primaryId: string;
    duplicateIds: string[];
    strategy: "keep_primary" | "merge_data";
  } | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 🔍 PACKAGE DUPLICATE DETECTION: Brand package duplicate detection states
  const [packageDuplicates, setPackageDuplicates] = useState<ProductDuplicateAlert[]>([]);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [pendingPackageData, setPendingPackageData] = useState<BrandPackageFormData | null>(null);

  // Forms initialization after all states
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      originalPrice: null,
      imageUrl: "",
      reference: "",
      categoryId: "",
      brandId: "",
      isFlashSale: false,
      isFeatured: false,
      images: [],
      sizes: [],
      colors: [],
    },
  });

  const promotionForm = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      title: "",
      description: "",
      discountPercentage: null,
      discountAmount: null,
      code: "",
      minPurchase: null,
      maxUses: null,
      isActive: true,
    },
  });

  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
      eventType: "",
      priority: 0,
      isActive: true,
    },
  });

  const brandForm = useForm<BrandFormData>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: "",
      logo: "🏷️",
      description: "",
      catalogUrl: "",
      isActive: true,
    },
  });

  const brandPackageForm = useForm<BrandPackageFormData>({
    resolver: zodResolver(brandPackageSchema),
    defaultValues: {
      brandId: "",
      categoryId: "",
      images: [],
      sizeFrom: "",
      sizeTo: "",
    },
  });

  // ✨ DUPLICATE MANAGEMENT: Forms
  const duplicateFiltersForm = useForm<DuplicateFiltersData>({
    resolver: zodResolver(duplicateFiltersSchema),
    defaultValues: duplicateFilters,
  });

  const editProductForm = useForm<EditProductData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {},
  });

  // ✨ REORGANIZED: Authentication check
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
      setLocation("/admin-login");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  // ✨ CLEAN: Close modals when switching main tabs
  useEffect(() => {
    setActiveModal({ type: null });
    setImageZoomDrawer(null);
    setEditingItem({ type: null, item: null });
  }, [activeTab]);

  // ✨ CLEAN: Close modals when switching catalog sub-tabs
  useEffect(() => {
    if (activeTab === "catalog") {
      setActiveModal({ type: null });
      setEditingItem({ type: null, item: null });
    }
  }, [catalogSubTab, activeTab]);

  // ✨ CLEAN: Close modals when switching tools sub-tabs
  useEffect(() => {
    if (activeTab === "tools") {
      setActiveModal({ type: null });
      setEditingProduct(null);
      setMergeData(null);
      setSelectedProducts(new Set());
    }
  }, [toolsSubTab, activeTab]);

  // 🔍 DUPLICATE DETECTION: Package duplicates check mutation
  const checkPackageDuplicatesMutation = useMutation({
    mutationFn: async (imageUrls: string[]) => {
      console.log('🔍 Checking for duplicate products with images:', imageUrls);
      const response = await apiRequest('POST', '/api/products/check-package-duplicates', { imageUrls });
      return response.json();
    },
    onSuccess: (data: { duplicates: ProductDuplicateAlert[]; hasDuplicates: boolean; packageReport?: any }) => {
      console.log('✅ Duplicate check completed:', data);
      setPackageDuplicates(data.duplicates);
      
      // Mostrar notificaciones detalladas si hay duplicados en el paquete
      if (data.hasDuplicates && data.packageReport) {
        const report = data.packageReport;
        
        // Toast principal con resumen del paquete
        toast({
          title: `⚠️ Duplicados Detectados en Paquete`,
          description: `${report.duplicateImages}/${report.totalImages} imágenes duplicadas encontradas. Los productos se crearán de todos modos.`,
          variant: "default",
          duration: 10000
        });
        
        // Log reporte WhatsApp-ready para revisión inmediata
        console.log('🚨 ALERTA PAQUETE - REPORTE DETALLADO LISTO PARA WHATSAPP:');
        console.log(report.detailedReport);
        
        // Mostrar detalles de duplicados en consola para referencia
        if (data.duplicates && data.duplicates.length > 0) {
          console.log('📋 DETALLES DE DUPLICADOS:');
          data.duplicates.forEach((dup, index) => {
            console.log(`${index + 1}. Imagen duplicada en:`, {
              producto: dup.existingProduct.name,
              referencia: dup.existingProduct.reference,
              marca: dup.existingProduct.brandName,
              vecesUsada: dup.duplicateCount
            });
          });
        }
      } else if (data.hasDuplicates) {
        // Fallback para duplicados sin reporte detallado
        toast({
          title: "⚠️ Duplicados Detectados",
          description: `Se encontraron ${data.duplicates.length} imágenes duplicadas. Los productos se crearán de todos modos.`,
          variant: "default",
          duration: 10000
        });
      } else {
        // No duplicates detected
        toast({
          title: "✅ Verificación Completada",
          description: "No se detectaron duplicados. Procediendo con la creación del paquete.",
          duration: 5000
        });
      }
      
      // SIEMPRE proceder con la creación del paquete (duplicados o no)
      if (pendingPackageData) {
        console.log('🚀 Procediendo con creación de paquete...');
        bulkCreateProductsMutation.mutate(pendingPackageData);
      }
    },
    onError: async (error: Error) => {
      const parsedError = await parseApiError(error);
      toast({
        title: "Error al verificar duplicados",
        description: parsedError.description,
        variant: "destructive",
      });
    },
  });

  // ✨ REORGANIZED: Bulk product creation mutation
  const bulkCreateProductsMutation = useMutation({
    mutationFn: async (data: BrandPackageFormData) => {
      console.log('🔑 Sending bulk request with session-based authentication');
      const response = await apiRequest('POST', '/api/products/bulk', data);
      return response.json();
    },
    onMutate: () => {
      setBulkOperations(prev => ({
        ...prev,
        brandPackage: {
          ...prev.brandPackage,
          progress: { isProcessing: true, currentIndex: 0, total: prev.brandPackage.images.length, results: { success: 0, failed: 0, errors: [] } }
        }
      }));
    },
    onSuccess: (data: { success: number; failed: number; errors: string[] }) => {
      setBulkOperations(prev => ({
        ...prev,
        brandPackage: {
          ...prev.brandPackage,
          progress: { ...prev.brandPackage.progress, isProcessing: false, results: data }
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "¡Paquete creado exitosamente! 🎉",
        description: `Se crearon ${data.success} productos destacados. ${data.failed > 0 ? `${data.failed} fallaron.` : 'Todos aparecerán en la página principal.'}`,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      brandPackageForm.reset();
      setBulkOperations(prev => ({ ...prev, brandPackage: { images: [], progress: { isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } } } }));
      closeModal();
    },
    onError: async (error: Error) => {
      setBulkOperations(prev => ({
        ...prev,
        brandPackage: {
          ...prev.brandPackage,
          progress: { ...prev.brandPackage.progress, isProcessing: false }
        }
      }));
      const parsedError = await parseApiError(error);
      toast({
        title: parsedError.title,
        description: parsedError.description,
        variant: "destructive",
      });
    },
  });

  // Consultas de datos
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  
  // Filtrar productos por referencia - fixed to handle null/undefined references
  const products = allProducts.filter(product => {
    if (!searchReference || searchReference.trim() === '') {
      return true; // Show all products when no search term
    }
    // Handle cases where product.reference might be null, undefined, or empty
    const productRef = product.reference || '';
    return productRef.toLowerCase().includes(searchReference.toLowerCase());
  });
  const { data: promotions = [] } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: brands = [] } = useQuery<BrandWithProducts[]>({ queryKey: ["/api/brands/admin/with-products"] });
  
  // ✨ MISSING QUERIES: Brand products query
  const { data: brandProducts = [], isLoading: brandProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "brands", selectedBrandId],
    queryFn: () => fetch(`/api/products?brands=${selectedBrandId}`).then(res => res.json()),
    enabled: !!selectedBrandId && activeModal.type === "brandProducts",
  });

  // ✨ MISSING QUERIES: Malformed URLs query
  const { data: malformedUrlsData, isLoading: isLoadingMalformed, refetch: refetchMalformed } = useQuery({
    queryKey: ["/api/products/malformed-urls"],
    queryFn: async () => {
      const response = await fetch("/api/products/malformed-urls");
      return response.json();
    },
    enabled: false, // Only fetch when explicitly called
  });

  // 🔍 Duplicate Images Report Query
  const { data: duplicateImagesData, isLoading: isLoadingDuplicates, refetch: refetchDuplicates } = useQuery({
    queryKey: ["/api/admin/reports/duplicate-images"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reports/duplicate-images");
      return response.json();
    },
    enabled: false, // Only fetch when explicitly called
  });

  // ✨ UNIFIED: Product form helpers
  const addProductImage = () => {
    if (productImages.length < 9) {
      setProductImages([...productImages, ""]);
    }
  };

  const updateProductImage = (index: number, value: string) => {
    const newImages = [...productImages];
    newImages[index] = value;
    setProductImages(newImages);
    productForm.setValue("images", newImages.filter(img => img.trim() !== ""));
  };

  const removeProductImage = (index: number) => {
    const newImages = productImages.filter((_, i) => i !== index);
    setProductImages(newImages);
    productForm.setValue("images", newImages);
  };

  const addProductSize = (size: string) => {
    if (size.trim() && !productSizes.includes(size.trim())) {
      const newSizes = [...productSizes, size.trim()];
      setProductSizes(newSizes);
      productForm.setValue("sizes", newSizes);
    }
  };

  const removeProductSize = (size: string) => {
    const newSizes = productSizes.filter(s => s !== size);
    setProductSizes(newSizes);
    productForm.setValue("sizes", newSizes);
  };

  const addProductColor = (color: string) => {
    if (color.trim() && !productColors.includes(color.trim())) {
      const newColors = [...productColors, color.trim()];
      setProductColors(newColors);
      productForm.setValue("colors", newColors);
    }
  };

  const removeProductColor = (color: string) => {
    const newColors = productColors.filter(c => c !== color);
    setProductColors(newColors);
    productForm.setValue("colors", newColors);
  };

  // ✨ CENTRALIZED: Modal handlers
  const openModal = (type: "product" | "brand" | "promotion" | "event" | "brandProducts" | "duplicateWarning" | "deleteBrand" | "brandPackage" | "malformedUrls" | "mergeConfirm" | "editProduct" | "bulkPriceAdjust", data?: any) => {
    console.log("🚀 OPENING MODAL:", type, data);
    console.log("🚀 CURRENT MODAL STATE:", activeModal);
    
    // Reset forms when opening modals for new items (no data provided)
    if (type === "brand" && !data) {
      brandForm.reset({
        name: "",
        logo: "🏷️",
        description: "",
        catalogUrl: "",
        isActive: true,
      });
      setEditingItem({ type: null, item: null });
    }
    
    setActiveModal({ type, data });
  };

  const closeModal = () => {
    setActiveModal({ type: null });
    setEditingItem({ type: null, item: null });
    // Clear form states when closing modals
    productForm.reset();
    brandForm.reset();
    promotionForm.reset();
    eventForm.reset();
    setProductImages([]);
    setProductSizes([]);
    setProductColors([]);
  };

  // 💰 BULK PRICE ADJUSTMENT: Handler
  const handleBulkPriceAdjust = () => {
    if (!bulkPriceAdjustment.value || !activeModal.data?.productIds?.length) {
      toast({
        title: "Error",
        description: "Por favor ingresa un valor válido",
        variant: "destructive"
      });
      return;
    }

    const value = parseFloat(bulkPriceAdjustment.value);
    if (isNaN(value) || value <= 0) {
      toast({
        title: "Error",
        description: "El valor debe ser un número positivo",
        variant: "destructive"
      });
      return;
    }

    // Validate operation for percentage and fixed types
    if (bulkPriceAdjustment.type !== "set" && !bulkPriceAdjustment.operation) {
      toast({
        title: "Error",
        description: "Selecciona una operación",
        variant: "destructive"
      });
      return;
    }

    bulkPriceAdjustmentMutation.mutate({
      productIds: activeModal.data.productIds,
      type: bulkPriceAdjustment.type,
      value: value,
      operation: bulkPriceAdjustment.operation,
      applyTo: bulkPriceAdjustment.applyTo
    });
  };

  // ✨ UNIFIED: Edit handlers
  const handleEditProduct = (product: Product) => {
    console.log("✨ Editing product:", product.name, product.id);
    
    // Navigate to catalog edit tab
    setActiveTab("catalog");
    setCatalogSubTab("edit");
    
    // Set editing state
    setEditingItem({ type: "product", item: product });
    
    // Populate form
    productForm.reset({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() || undefined,
      imageUrl: product.imageUrl || undefined,
      reference: product.reference || "",
      categoryId: product.categoryId || undefined,
      brandId: product.brandId || undefined,
      isFlashSale: product.isFlashSale || false,
      isFeatured: product.isFeatured || false,
      images: product.images || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
    });
    
    // Populate auxiliary states
    setProductImages(product.images || []);
    setProductSizes(product.sizes || []);
    setProductColors(product.colors || []);
    
    // Close any open modal
    closeModal();
  };

  const handleEditBrand = (brand: BrandWithProducts) => {
    console.log("✨ Editing brand:", brand.name, brand.id);
    
    // Set editing state
    setEditingItem({ type: "brand", item: brand });
    
    // Populate form
    brandForm.reset({
      name: brand.name,
      logo: brand.logo,
      description: brand.description || "",
      catalogUrl: brand.catalogUrl || "",
      isActive: brand.isActive ?? true,
    });
    
    // Open brand modal
    openModal("brand", brand);
  };

  const handleCancelEdit = () => {
    setEditingItem({ type: null, item: null });
    productForm.reset();
    brandForm.reset();
    setProductImages([]);
    setProductSizes([]);
    setProductColors([]);
  };

  // ✨ MISSING: Brand cancel edit handler
  const handleCancelBrandEdit = () => {
    closeModal();
    setEditingItem({ type: null, item: null });
    brandForm.reset();
  };

  // Función para detectar productos duplicados
  const checkForDuplicates = (productName: string, productReference?: string) => {
    const duplicates = allProducts.filter(product => {
      // Verificar por nombre (similar)
      const nameMatch = product.name.toLowerCase().trim() === productName.toLowerCase().trim();
      
      // Verificar por referencia si existe
      const referenceMatch = productReference && product.reference && 
        product.reference.toLowerCase().trim() === productReference.toLowerCase().trim();
      
      return nameMatch || referenceMatch;
    });
    
    return duplicates;
  };

  // Función para crear producto con verificación de duplicados
  const createProductWithDuplicateCheck = async (data: ProductFormData, forceDuplicate = false): Promise<Response> => {
    // Si no es forzado, verificar duplicados primero
    if (!forceDuplicate) {
      const duplicates = checkForDuplicates(data.name, data.reference || "");
      
      if (duplicates.length > 0) {
        // Encontrar duplicados - mostrar advertencia
        setDuplicatedProducts(duplicates);
        setPendingProductData(data);
        openModal("duplicateWarning", { duplicates, productData: data });
        // Retornar una Promise rechazada para detener el flujo
        throw new Error("DUPLICATE_DETECTED");
      }
    }
    
    // Continuar con la creación normal del producto
    const discountPercentage = data.originalPrice && data.price 
      ? calculateDiscount(data.originalPrice.toString(), data.price)
      : 0;
    
    const productData = {
      ...data,
      price: data.price || "1",
      originalPrice: data.originalPrice || null,
      discountPercentage,
      images: productImages.filter(img => img.trim() !== ""),
      sizes: productSizes,
      colors: productColors,
    };
    
    console.log("Datos completos del producto a enviar:", productData);
    console.log("ImageURL principal:", data.imageUrl);
    console.log("Imágenes adicionales:", productImages);
    
    return await apiRequest("POST", "/api/products", productData);
  };

  // Mutaciones
  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => createProductWithDuplicateCheck(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      closeModal();
      productForm.reset();
      setProductImages([]);
      setProductSizes([]);
      setProductColors([]);
      toast({ title: "¡Éxito!", description: "Producto publicado correctamente con todas sus imágenes" });
    },
    onError: async (error: any) => {
      // Si es error de duplicado detectado, no mostrar toast de error
      if (error.message === "DUPLICATE_DETECTED") {
        return; // No mostrar error, el modal se encargará
      }
      
      console.error("Error creando producto:", error);
      
      const { title, description } = await parseApiError(error, "Error al crear el producto");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  // Mutación para forzar creación de productos duplicados
  const forceCreateProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => createProductWithDuplicateCheck(data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      closeModal();
      setPendingProductData(null);
      setDuplicatedProducts([]);
      productForm.reset();
      setProductImages([]);
      setProductSizes([]);
      setProductColors([]);
      toast({ 
        title: "¡Éxito!", 
        description: "Producto duplicado publicado correctamente (se permiten duplicados)" 
      });
    },
    onError: async (error: any) => {
      console.error("Error creando producto duplicado:", error);
      
      const { title, description } = await parseApiError(error, "Error al crear el producto duplicado");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  // Función para manejar cancelación de duplicados
  const handleCancelDuplicate = () => {
    closeModal();
    setPendingProductData(null);
    setDuplicatedProducts([]);
  };

  // Función para proceder con producto duplicado
  const handleProceedWithDuplicate = () => {
    if (pendingProductData) {
      forceCreateProductMutation.mutate(pendingProductData);
    }
    closeModal();
  };

  // Funciones para eliminar marca
  const handleDeleteBrand = (brand: BrandWithProducts) => {
    setBrandToDelete(brand);
    openModal("deleteBrand", brand);
  };

  const handleCancelDeleteBrand = () => {
    setBrandToDelete(null);
    closeModal();
  };

  const handleConfirmDeleteBrand = () => {
    if (brandToDelete) {
      deleteBrandMutation.mutate(brandToDelete.id);
      setBrandToDelete(null);
      closeModal();
    }
  };

  // 🚀 NEW Intelligent upload handlers - Simple and robust
  const handleIntelligentImagesUploaded = (imageUrls: string[]) => {
    setIntelligentUploadedImages(imageUrls);
    console.log("✅ Images uploaded successfully:", imageUrls.length, "images");
    console.log("🔗 Image URLs:", imageUrls);
  };

  const handleStartIntelligentUpload = () => {
    if (intelligentUploadedImages.length === 0) {
      toast({
        title: "Sin imágenes",
        description: "Primero debes subir imágenes usando el componente de arriba",
        variant: "destructive"
      });
      return;
    }

    // Start the intelligent upload process with uploaded image URLs
    setBulkOperations(prev => ({
      ...prev,
      intelligentUpload: {
        ...prev.intelligentUpload,
        progress: {
          isProcessing: true,
          currentIndex: 0,
          total: intelligentUploadedImages.length,
          results: { success: 0, failed: 0, errors: [] }
        }
      }
    }));

    console.log(`🚀 Starting intelligent upload processing with ${intelligentUploadedImages.length} uploaded images`);
    intelligentUploadMutation.mutate(intelligentUploadedImages);
  };

  const updateProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => {
      if (editingItem.type !== "product" || !editingItem.item) throw new Error("No hay producto para editar");
      
      // Calcular descuento si hay precio original
      const discountPercentage = data.originalPrice && data.price 
        ? calculateDiscount(data.originalPrice.toString(), data.price)
        : 0;
      
      const productData = {
        ...data,
        price: data.price || "1", // Usar precio del formulario, fallback a "1"
        originalPrice: data.originalPrice || null,
        discountPercentage,
        images: productImages.filter(img => img.trim() !== ""),
        sizes: productSizes,
        colors: productColors,
      };
      console.log("Actualizando producto:", (editingItem.item as Product).id, productData);
      return apiRequest("PUT", `/api/products/${(editingItem.item as Product).id}`, productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      closeModal();
      // Legacy state removed - using centralized editingItem
      // Legacy state removed - using centralized editingItem
      productForm.reset();
      setProductImages([]);
      setProductSizes([]);
      setProductColors([]);
      toast({ title: "¡Éxito!", description: "Producto actualizado correctamente" });
    },
    onError: async (error: any) => {
      console.error("Error actualizando producto:", error);
      
      const { title, description } = await parseApiError(error, "Error al actualizar el producto");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  const createPromotionMutation = useMutation({
    mutationFn: (data: PromotionFormData) => apiRequest("POST", "/api/promotions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      closeModal();
      promotionForm.reset();
      toast({ title: "Éxito", description: "Promoción creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al crear la promoción", variant: "destructive" });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (data: EventFormData) => apiRequest("POST", "/api/events", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      closeModal();
      eventForm.reset();
      toast({ title: "Éxito", description: "Evento creado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al crear el evento", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Éxito", description: "Producto eliminado exitosamente" });
    },
    onError: async (error: any) => {
      console.error("Error eliminando producto:", error);
      
      const { title, description } = await parseApiError(error, "Error al eliminar el producto");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/promotions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Éxito", description: "Promoción eliminada exitosamente" });
    },
    onError: async (error: any) => {
      console.error("Error eliminando promoción:", error);
      
      const { title, description } = await parseApiError(error, "Error al eliminar la promoción");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Éxito", description: "Evento eliminado exitosamente" });
    },
    onError: async (error: any) => {
      console.error("Error eliminando evento:", error);
      
      const { title, description } = await parseApiError(error, "Error al eliminar el evento");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  const createBrandMutation = useMutation({
    mutationFn: (data: BrandFormData) => {
      if (editingItem.type === "brand" && editingItem.item) {
        return apiRequest("PUT", `/api/brands/${editingItem.item.id}`, data);
      }
      return apiRequest("POST", "/api/brands", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands/admin/with-products"] });
      closeModal();
      // Legacy state removed - using centralized editingItem
      // Legacy state removed - using centralized editingItem
      brandForm.reset();
      toast({ 
        title: "Éxito", 
        description: editingItem.type === "brand" ? "Marca actualizada exitosamente" : "Marca creada exitosamente" 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: editingItem.type === "brand" ? "No se pudo actualizar la marca" : "No se pudo crear la marca", 
        variant: "destructive" 
      });
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (brandId: string) => apiRequest("DELETE", `/api/brands/${brandId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands/admin/with-products"] });
      toast({ 
        title: "¡Éxito!", 
        description: "Marca eliminada correctamente" 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "No se pudo eliminar la marca", 
        variant: "destructive" 
      });
    },
  });

  // 🚀 NEW Intelligent upload mutation - Simple and robust
  const intelligentUploadMutation = useMutation({
    mutationFn: async (imageUrls: string[]): Promise<{ created: number; pendingReview: number; results: any[]; duplicateAlerts?: ProductDuplicateAlert[] }> => {
      console.log(`🚀 [NEW] Starting intelligent upload with ${imageUrls.length} successfully uploaded image URLs`);
      console.log(`🔗 Image URLs:`, imageUrls);
      
      if (imageUrls.length === 0) {
        throw new Error('No hay URLs de imágenes para procesar');
      }
      
      // 🎯 Simple payload: just the uploaded image URLs + optional defaults
      const payload = {
        imageUrls: imageUrls,
        defaultCategoryId: categories.find(c => c.name === "Deportivos")?.id || "C3D950FF197A9F23FE76B2351508D4D7",
        defaultPrice: 85000 // Number as required by Zod schema
      };
      
      console.log(`🎯 Sending payload to server:`, payload);
      const response = await apiRequest("POST", "/api/products/intelligent-upload", payload);
      return response.json();
    },
    onSuccess: (data: { created: number; pendingReview: number; results: any[]; duplicateAlerts?: ProductDuplicateAlert[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands/admin/with-products"] });
      
      const totalSuccessful = data.created + data.pendingReview;
      const totalFailed = data.results.filter((r: any) => r.status === 'failed').length;
      
      setBulkOperations(prev => ({
        ...prev,
        intelligentUpload: {
          ...prev.intelligentUpload,
          progress: {
            ...prev.intelligentUpload.progress,
            isProcessing: false,
            results: { 
              success: totalSuccessful, 
              failed: totalFailed, 
              errors: data.results.filter((r: any) => r.status === 'failed').map((r: any) => r.reason || 'Error desconocido')
            }
          }
        }
      }));
      
      // 🔍 Show duplicate alerts if found
      if (data.duplicateAlerts && data.duplicateAlerts.length > 0) {
        const totalDuplicates = data.duplicateAlerts.length;
        const duplicateDetails = data.duplicateAlerts.map(dup => 
          `• ${dup.existingProduct.name} (${dup.existingProduct.reference}) - Marca: ${dup.existingProduct.brandName} [Usada ${dup.duplicateCount} veces]`
        ).join('\n');
        
        toast({
          title: `⚠️ ${totalDuplicates} imagen${totalDuplicates > 1 ? 'es' : ''} duplicada${totalDuplicates > 1 ? 's' : ''} detectada${totalDuplicates > 1 ? 's' : ''}`,
          description: `Las siguientes imágenes ya existen en otros productos:\n${duplicateDetails}`,
          variant: "destructive",
          duration: 10000
        });
      }
      
      // Build descriptive message based on results
      let description = `${totalSuccessful} productos procesados exitosamente`;
      if (data.created > 0 && data.pendingReview > 0) {
        description += ` (${data.created} auto-asignados, ${data.pendingReview} requieren revisión)`;
      } else if (data.pendingReview > 0) {
        description += ` (todos requieren revisión manual)`;
      }
      if (totalFailed > 0) {
        description += `, ${totalFailed} fallaron`;
      }
      
      toast({ 
        title: "¡Proceso de detección inteligente completado!", 
        description
      });
      
      // Clear uploaded images after successful upload
      setTimeout(() => {
        setIntelligentUploadedImages([]);
        setBulkOperations(prev => ({
          ...prev,
          intelligentUpload: {
            images: [],
            progress: { 
              isProcessing: false, 
              currentIndex: 0, 
              total: 0, 
              results: { success: 0, failed: 0, errors: [] } 
            }
          }
        }));
      }, 3000);
    },
    onError: async (error: any) => {
      console.error("Error en carga inteligente:", error);
      
      const { title, description } = await parseApiError(error, "Error en la carga inteligente");
      
      setBulkOperations(prev => ({
        ...prev,
        intelligentUpload: {
          ...prev.intelligentUpload,
          progress: {
            ...prev.intelligentUpload.progress,
            isProcessing: false
          }
        }
      }));
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    }
  });

  // 🧹 CLEANUP: Mutation to clean malformed URLs
  const cleanupMalformedUrlsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/products/cleanup-malformed", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands/admin/with-products"] });
      
      toast({
        title: "¡Limpieza completada!",
        description: data.message || `${data.cleaned || 0} productos con URLs corruptas eliminados`
      });
      
      // Refetch malformed URLs to update the count
      refetchMalformed();
      closeModal();
    },
    onError: async (error: any) => {
      const { title, description } = await parseApiError(error, "Error en la limpieza");
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  });

  // ✨ DUPLICATE MANAGEMENT: Queries and mutations
  const duplicatesQuery = useQuery({
    queryKey: ["/api/admin/products/duplicates", duplicateFilters, duplicatePage],
    queryFn: async () => {
      const params = new URLSearchParams({
        by: duplicateFilters.by,
        page: duplicatePage.toString(),
        limit: "20",
      });
      
      if (duplicateFilters.brandId) {
        params.append("brandId", duplicateFilters.brandId);
      }
      
      if (duplicateFilters.search) {
        params.append("search", duplicateFilters.search);
      }
      
      const response = await apiRequest("GET", `/api/admin/products/duplicates?${params}`);
      return response.json();
    },
    enabled: activeTab === "tools" && toolsSubTab === "duplicates",
  });

  const mergeProductsMutation = useMutation({
    mutationFn: async (data: { groupKey: string; mergeData: MergeProductsData }) => {
      const response = await apiRequest("POST", `/api/admin/products/duplicates/${data.groupKey}/merge`, data.mergeData);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "✅ Productos fusionados exitosamente",
        description: `${data.merged || 1} productos han sido combinados en uno solo`,
      });
      setActiveModal({ type: null });
      setMergeData(null);
      setSelectedProducts(new Set());
    },
    onError: async (error: Error) => {
      const parsedError = await parseApiError(error);
      toast({
        title: parsedError.title,
        description: parsedError.description,
        variant: "destructive",
      });
    },
  });

  const editProductMutation = useMutation({
    mutationFn: async (data: { id: string; productData: EditProductData }) => {
      const response = await apiRequest("PATCH", `/api/admin/products/${data.id}`, data.productData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "✅ Producto actualizado",
        description: "Los cambios han sido guardados correctamente",
      });
      setActiveModal({ type: null });
      setEditingProduct(null);
      editProductForm.reset();
    },
    onError: async (error: Error) => {
      const parsedError = await parseApiError(error);
      toast({
        title: parsedError.title,
        description: parsedError.description,
        variant: "destructive",
      });
    },
  });

  // 💰 BULK PRICE ADJUSTMENT: Mutation
  const bulkPriceAdjustmentMutation = useMutation({
    mutationFn: async (data: {
      productIds: string[];
      type: "percentage" | "fixed" | "set";
      value: number;
      operation?: "increase" | "decrease";
      applyTo: "price" | "originalPrice" | "both";
    }) => {
      const response = await apiRequest("POST", "/api/products/bulk-adjust-prices", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands/admin/with-products"] });
      
      toast({
        title: "¡Precios ajustados exitosamente!",
        description: `${data.updated || 0} productos actualizados`
      });
      
      closeModal();
      setSelectedProducts(new Set());
    },
    onError: async (error: any) => {
      const { title, description } = await parseApiError(error, "Error al ajustar precios");
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  });

  // Función para sugerir categoría y marca basado en el nombre del producto
  const getSuggestions = (productName: string) => {
    const name = productName.toLowerCase();
    
    // Sugerencias de categoría basadas en palabras clave
    let suggestedCategory = "";
    if (name.includes("tacon") || name.includes("heel") || name.includes("stiletto")) {
      suggestedCategory = categories.find(c => c.name === "Tacones")?.id || "";
    } else if (name.includes("deport") || name.includes("running") || name.includes("sport") || name.includes("gym")) {
      suggestedCategory = categories.find(c => c.name === "Deportivos")?.id || "";
    } else if (name.includes("bota") || name.includes("boot") || name.includes("ankle")) {
      suggestedCategory = categories.find(c => c.name === "Botas")?.id || "";
    } else if (name.includes("sandal") || name.includes("flip") || name.includes("playa")) {
      suggestedCategory = categories.find(c => c.name === "Sandalias")?.id || "";
    } else if (name.includes("formal") || name.includes("dress") || name.includes("oxford")) {
      suggestedCategory = categories.find(c => c.name === "Formales")?.id || "";
    } else {
      suggestedCategory = categories.find(c => c.name === "Casuales")?.id || "";
    }
    
    // Sugerencias de marca basadas en palabras clave
    let suggestedBrand = "";
    if (name.includes("nike") || name.includes("air") || name.includes("jordan")) {
      suggestedBrand = brands.find(b => b.name === "Nike")?.id || "";
    } else if (name.includes("adidas") || name.includes("ultra") || name.includes("gazelle")) {
      suggestedBrand = brands.find(b => b.name === "Adidas")?.id || "";
    } else if (name.includes("puma") || name.includes("suede") || name.includes("speed")) {
      suggestedBrand = brands.find(b => b.name === "Puma")?.id || "";
    } else if (name.includes("converse") || name.includes("chuck") || name.includes("all star")) {
      suggestedBrand = brands.find(b => b.name === "Converse")?.id || "";
    } else if (name.includes("vans") || name.includes("authentic") || name.includes("old skool")) {
      suggestedBrand = brands.find(b => b.name === "Vans")?.id || "";
    } else if (name.includes("reebok") || name.includes("classic")) {
      suggestedBrand = brands.find(b => b.name === "Reebok")?.id || "";
    }
    
    return { suggestedCategory, suggestedBrand };
  };

  // Función para aplicar sugerencias automáticamente
  const applySuggestions = () => {
    const productName = productForm.getValues("name");
    if (productName && productName.length > 2) {
      const { suggestedCategory, suggestedBrand } = getSuggestions(productName);
      
      if (suggestedCategory && !productForm.getValues("categoryId")) {
        productForm.setValue("categoryId", suggestedCategory);
        toast({
          title: "💡 Sugerencia aplicada",
          description: "Categoría sugerida automáticamente",
        });
      }
      
      if (suggestedBrand && !productForm.getValues("brandId")) {
        productForm.setValue("brandId", suggestedBrand);
        toast({
          title: "💡 Sugerencia aplicada", 
          description: "Marca sugerida automáticamente",
        });
      }
    }
  };

  // Mostrar loading si está cargando
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado como admin, redirigir al login de admin
  if (!isAuthenticated || !user?.isAdmin) {
    window.location.href = '/admin-login';
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Redirigiendo al login de administrador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 px-2 sm:px-4">
      <div className="mb-4 sm:mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Panel de Administración - ZapaShop</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Gestiona productos, promociones y eventos de la tienda</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {user.firstName} {user.lastName}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              data-testid="button-admin-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 sm:space-y-4">
        {/* ✨ REORGANIZED: Clean main tab structure */}
        <TabsList className="grid w-full grid-cols-7 h-auto">
          <TabsTrigger value="catalog" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-catalog">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Catálogo</span>
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-brands">
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Marcas</span>
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-promotions">
            <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Promociones</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-events">
            <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Eventos</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-orders">
            <Truck className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Pedidos</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-tools">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Herramientas</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-reports">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Reportes</span>
          </TabsTrigger>
        </TabsList>

        {/* ✨ REORGANIZED: Catálogo with sub-tabs */}
        <TabsContent value="catalog" className="space-y-2 sm:space-y-4">
          <Tabs value={catalogSubTab} onValueChange={setCatalogSubTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="list" className="flex items-center gap-2" data-testid="subtab-catalog-list">
                <Search className="h-4 w-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="edit" className="flex items-center gap-2" data-testid="subtab-catalog-edit">
                <Edit className="h-4 w-4" />
                Crear/Editar
              </TabsTrigger>
              <TabsTrigger value="by-brand" className="flex items-center gap-2" data-testid="subtab-catalog-by-brand">
                <Briefcase className="h-4 w-4" />
                Por Marca
              </TabsTrigger>
              <TabsTrigger value="uploads" className="flex items-center gap-2" data-testid="subtab-catalog-uploads">
                <Upload className="h-4 w-4" />
                Cargas
              </TabsTrigger>
              <TabsTrigger value="cleanup" className="flex items-center gap-2" data-testid="subtab-catalog-cleanup">
                <Sparkles className="h-4 w-4" />
                Limpieza
              </TabsTrigger>
            </TabsList>

            {/* Sub-tab: Lista de productos */}
            <TabsContent value="list" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Lista de Productos</h3>
                <Button 
                  size="sm" 
                  className="h-8 sm:h-10 text-xs sm:text-sm" 
                  data-testid="button-add-product"
                  onClick={() => setCatalogSubTab("edit")}
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Crear Producto</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </div>
          
              {/* Búsqueda por referencia */}
              <div className="mb-4">
                <div className="max-w-sm">
                  <label htmlFor="search-reference" className="block text-sm font-medium mb-2">
                    Buscar por referencia
                  </label>
                  <Input
                    id="search-reference"
                    type="text"
                    placeholder="Ingresa la referencia del producto..."
                    value={searchReference}
                    onChange={(e) => setSearchReference(e.target.value)}
                    className="w-full"
                    data-testid="input-search-reference"
                  />
                  {searchReference && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {products.length} producto(s) encontrado(s)
                    </p>
                  )}
                </div>
              </div>
          
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(product);
                        }}
                        data-testid={`button-edit-product-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProductMutation.mutate(product.id);
                        }}
                        data-testid={`button-delete-product-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Imagen del producto */}
                    {(product.imageUrl || (product.images && product.images.length > 0)) && (
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden relative group cursor-pointer">
                        <img 
                          src={buildImageSrc(product.imageUrl || product.images?.[0])} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                          onClick={() => setImageZoomDrawer({product, isOpen: true})}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="%236b7280">Sin imagen</text></svg>';
                          }}
                        />
                        {/* Zoom icon overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
                            <ZoomIn className="w-5 h-5 text-gray-700" />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {product.reference && (
                        <p className="text-sm font-medium text-primary">Ref: {product.reference}</p>
                      )}
                      
                      {/* PRECIO - CRÍTICO para admin */}
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                        {(product.price !== null && product.price !== undefined && String(product.price) !== "1") ? (
                          <div className="space-y-1">
                            {/* Mostrar precio original tachado si hay descuento */}
                            {product.originalPrice && product.originalPrice !== product.price && (
                              <div className="text-xs text-muted-foreground line-through">
                                Antes: {formatCurrency(product.originalPrice)}
                              </div>
                            )}
                            
                            {/* Precio actual */}
                            <div className="text-lg font-bold text-blue-800">
                              {formatCurrency(product.price)}
                              <span className="text-xs text-muted-foreground ml-1">COP</span>
                            </div>
                            
                            {/* Badge de descuento si aplica */}
                            {product.originalPrice && product.originalPrice !== product.price && (() => {
                              const originalPrice = parseFloat(String(product.originalPrice).replace(/\./g, ''));
                              const currentPrice = parseFloat(String(product.price).replace(/\./g, ''));
                              const savings = originalPrice - currentPrice;
                              const discountPercentage = Math.round((savings / originalPrice) * 100);
                              
                              return discountPercentage > 0 ? (
                                <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                                  🎁 {discountPercentage}% OFF
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground font-medium">
                            💬 Precio disponible via WhatsApp
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {product.isFlashSale && <Badge variant="destructive">Oferta Flash</Badge>}
                        {product.isFeatured && <Badge>Destacado</Badge>}
                      </div>
                      
                      {/* Sistema de calificación administrativa */}
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2">Calificación:</p>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <Star 
                                key={rating}
                                className={`w-4 h-4 cursor-pointer transition-colors hover:text-yellow-400 ${
                                  rating <= Math.floor(Number(product.rating || 0))
                                    ? 'fill-yellow-400 text-yellow-400' 
                                    : 'text-gray-300 hover:fill-yellow-400/50'
                                }`}
                                onClick={() => {
                                  toast({
                                    title: "Calificación actualizada",
                                    description: `Producto calificado con ${rating} estrella${rating > 1 ? 's' : ''}`,
                                  });
                                }}
                                data-testid={`admin-star-${rating}-${product.id}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ({Number(product.rating || 0).toFixed(1)})
                          </span>
                        </div>
                      </div>
                      {product.images && product.images.length > 0 && (
                        <p className="text-sm text-muted-foreground">Imágenes: {product.images.length + 1}</p>
                      )}
                      {product.sizes && product.sizes.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Tallas:</span>
                          {product.sizes.slice(0, 3).map((size) => (
                            <Badge key={size} variant="outline" className="text-xs">{size}</Badge>
                          ))}
                          {product.sizes.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{product.sizes.length - 3}</Badge>
                          )}
                        </div>
                      )}
                      {product.colors && product.colors.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Colores:</span>
                          {product.colors.slice(0, 3).map((color) => (
                            <Badge key={color} variant="outline" className="text-xs">{color}</Badge>
                          ))}
                          {product.colors.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{product.colors.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
              </div>
            </TabsContent>

            {/* Sub-tab: Crear/Editar productos */}
            <TabsContent value="edit" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingItem.type === "product" ? "Editar Producto" : "Crear Producto"}
                </h3>
                {editingItem.type === "product" && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleCancelEdit();
                      setCatalogSubTab("list");
                    }}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </div>
              {/* Product form will be rendered here */}
              <Card>
                <CardHeader>
                  <CardTitle>Formulario de Producto</CardTitle>
                  <CardDescription>
                    {editingItem.type === "product" 
                      ? "Modifica la información del producto"
                      : "Completa los datos del nuevo producto"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">El formulario de producto se implementará aquí con los nuevos estados centralizados.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sub-tab: Productos por Marca */}
            <TabsContent value="by-brand" className="space-y-4">
              <ProductsByBrandManager />
            </TabsContent>

            {/* Sub-tab: Cargas (uploads) */}
            <TabsContent value="uploads" className="space-y-4">
              <h3 className="text-lg font-semibold">Herramientas de Carga</h3>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Paquetes por Marca
                    </CardTitle>
                    <CardDescription>
                      Crea múltiples productos de una marca de forma eficiente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => openModal("brandPackage")}
                      data-testid="button-brand-packages"
                    >
                      <Layers className="h-4 w-4 mr-2" />
                      Crear Paquete
                    </Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Carga Inteligente
                    </CardTitle>
                    <CardDescription>
                      Upload con detección automática de marcas por IA
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Funcionalidad de carga inteligente estará disponible aquí
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Sub-tab: Limpieza */}
            <TabsContent value="cleanup" className="space-y-4">
              <h3 className="text-lg font-semibold">Herramientas de Limpieza</h3>
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5" />
                      Limpieza de Datos
                    </CardTitle>
                    <CardDescription>
                      Herramientas para limpiar y organizar el catálogo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">URLs mal formadas</p>
                          <p className="text-sm text-muted-foreground">Detectar y corregir URLs de imágenes problemáticas</p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Search className="h-4 w-4 mr-2" />
                          Escanear
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Productos duplicados</p>
                          <p className="text-sm text-muted-foreground">Encontrar productos con nombres o referencias similares</p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Search className="h-4 w-4 mr-2" />
                          Buscar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Panel de Marcas */}
        <TabsContent value="brands" className="space-y-2 sm:space-y-4">
          
          {/* 🎯 SOLUCIÓN DIRECTA: Gestión Simple de Productos por Marca */}
          <SimpleBrandProductManager />

          <div className="flex justify-between items-center mb-2 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-semibold">Configuración de Marcas</h2>
            <Dialog open={activeModal.type === "brand"} onOpenChange={(open) => open ? openModal("brand") : closeModal()}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-10 text-xs sm:text-sm" data-testid="button-add-brand">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Agregar Marca</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem.type === "brand" ? "Editar Marca" : "Agregar Nueva Marca"}</DialogTitle>
                  <DialogDescription>
                    {editingItem.type === "brand" ? "Modifica la información de la marca" : "Crea una nueva marca para organizar los productos"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...brandForm}>
                  <form onSubmit={brandForm.handleSubmit(
                    (data) => {
                      console.log("✅ Formulario válido, enviando:", data);
                      createBrandMutation.mutate(data);
                    },
                    (errors) => {
                      console.error("❌ Errores de validación:", errors);
                      toast({
                        title: "Error en el formulario",
                        description: "Por favor completa todos los campos requeridos",
                        variant: "destructive"
                      });
                    }
                  )} className="space-y-4">
                    <FormField
                      control={brandForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la Marca</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ej: Nike, Adidas, Puma" data-testid="input-brand-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={brandForm.control}
                      name="logo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo de la Marca (opcional)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input 
                                {...field} 
                                value={field.value || ""}
                                placeholder="Emoji o URL del logo (ej: 🏷️ o https://...)" 
                                data-testid="input-brand-logo"
                              />
                              <ObjectUploader
                                value={field.value}
                                onComplete={(imageUrl) => field.onChange(imageUrl)}
                                data-testid="uploader-brand-logo"
                              />
                            </div>
                          </FormControl>
                          {field.value && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">Logo: {field.value}</p>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={brandForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción (opcional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Describe la marca y sus características" data-testid="textarea-brand-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={brandForm.control}
                      name="catalogUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL del Catálogo (opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="https://ejemplo.com/catalog" data-testid="input-brand-catalog" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={brandForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Marca Activa</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              La marca aparecerá en la tienda
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                              data-testid="switch-brand-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={createBrandMutation.isPending}
                        data-testid="button-submit-brand"
                      >
                        {createBrandMutation.isPending 
                          ? (editingItem.type === "brand" ? "Actualizando..." : "Creando...") 
                          : (editingItem.type === "brand" ? "Actualizar Marca" : "Crear Marca")
                        }
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCancelBrandEdit}
                        data-testid="button-cancel-brand"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de marcas existentes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {brands.map((brand) => (
              <Card key={brand.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {getBrandLogoType(brand.logo) === 'emoji' ? (
                      <div 
                        className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center text-xl sm:text-2xl"
                        data-testid={`emoji-admin-brand-logo-${brand.id}`}
                      >
                        {brand.logo}
                      </div>
                    ) : getBrandLogoType(brand.logo) === 'image' ? (
                      <img 
                        src={brand.logo} 
                        alt={brand.name}
                        className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        data-testid={`img-admin-brand-logo-${brand.id}`}
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 sm:w-12 sm:h-12 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm font-bold"
                        data-testid={`placeholder-admin-brand-logo-${brand.id}`}
                      >
                        {brand.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-sm sm:text-lg">{brand.name}</CardTitle>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={brand.isActive ? "default" : "secondary"} className="text-xs">
                          {brand.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {brand.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">{brand.description}</p>
                  )}
                  
                  {/* Mostrar conteo de productos */}
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground" data-testid={`text-brand-product-count-${brand.id}`}>
                      {brand.productCount || 0} productos en la tienda
                    </span>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBrand(brand);
                      }}
                      data-testid={`button-edit-brand-${brand.id}`}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBrand(brand);
                      }}
                      data-testid={`button-delete-brand-${brand.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Eliminar
                    </Button>
                    {(brand.productCount || 0) > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBrandId(brand.id);
                          openModal('brandProducts');
                        }}
                        data-testid={`button-view-brand-products-${brand.id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Productos
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Panel de Pedidos */}
        <TabsContent value="orders" className="space-y-2 sm:space-y-4">
          <AdminOrders />
        </TabsContent>

        {/* Panel de Herramientas */}
        <TabsContent value="tools" className="space-y-2 sm:space-y-4">
          <Tabs value={toolsSubTab} onValueChange={setToolsSubTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="duplicates" className="flex items-center gap-2" data-testid="subtab-tools-duplicates">
                <Copy className="h-4 w-4" />
                Duplicados
              </TabsTrigger>
              <TabsTrigger value="duplicates-report" className="flex items-center gap-2" data-testid="subtab-tools-duplicates-report">
                <AlertTriangle className="h-4 w-4" />
                Reporte Detallado
              </TabsTrigger>
              <TabsTrigger value="bulk-upload" className="flex items-center gap-2" data-testid="subtab-tools-bulk-upload">
                <Upload className="h-4 w-4" />
                Carga Masiva
              </TabsTrigger>
            </TabsList>

            {/* Sub-tab: Gestión de Duplicados */}
            <TabsContent value="duplicates" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Gestión de Productos Duplicados</h2>
                  <p className="text-muted-foreground">Encuentra, edita y fusiona productos duplicados en el catálogo</p>
                </div>
              </div>

              {/* Filtros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros de Búsqueda
                  </CardTitle>
                  <CardDescription>
                    Configure los criterios para detectar productos duplicados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...duplicateFiltersForm}>
                    <form className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={duplicateFiltersForm.control}
                          name="by"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Criterio de Búsqueda</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setDuplicateFilters(prev => ({ ...prev, by: value as "reference" | "name" | "image" }));
                                  setDuplicatePage(1);
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-duplicate-criteria">
                                    <SelectValue placeholder="Selecciona criterio" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="reference">Referencia del Producto</SelectItem>
                                  <SelectItem value="name">Nombre + Marca</SelectItem>
                                  <SelectItem value="image">Hash de Imagen</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={duplicateFiltersForm.control}
                          name="brandId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Filtrar por Marca</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setDuplicateFilters(prev => ({ ...prev, brandId: value }));
                                  setDuplicatePage(1);
                                }} 
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-duplicate-brand">
                                    <SelectValue placeholder="Todas las marcas" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">Todas las marcas</SelectItem>
                                  {brands?.map((brand) => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                      {brand.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={duplicateFiltersForm.control}
                          name="search"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Búsqueda de Texto</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Buscar productos..."
                                    className="pl-8"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setDuplicateFilters(prev => ({ ...prev, search: e.target.value }));
                                      setDuplicatePage(1);
                                    }}
                                    data-testid="input-duplicate-search"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Lista de Grupos Duplicados */}
              <DuplicateGroupsList 
                filters={duplicateFilters}
                page={duplicatePage}
                expandedGroups={expandedGroups}
                selectedProducts={selectedProducts}
                onToggleExpand={(groupKey) => {
                  setExpandedGroups(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(groupKey)) {
                      newSet.delete(groupKey);
                    } else {
                      newSet.add(groupKey);
                    }
                    return newSet;
                  });
                }}
                onToggleSelect={(productId) => {
                  setSelectedProducts(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(productId)) {
                      newSet.delete(productId);
                    } else {
                      newSet.add(productId);
                    }
                    return newSet;
                  });
                }}
                onEditProduct={(product) => {
                  setEditingProduct(product);
                  editProductForm.reset({
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    originalPrice: product.originalPrice,
                    reference: product.reference,
                    sizes: product.sizes || [],
                    colors: product.colors || [],
                  });
                  setActiveModal({ type: "editProduct", data: product });
                }}
                onMergeProducts={(groupKey, products) => {
                  if (products.length < 2) return;
                  
                  const primaryId = products[0].id;
                  const duplicateIds = products.slice(1).map(p => p.id);
                  
                  setMergeData({
                    groupKey,
                    primaryId,
                    duplicateIds,
                    strategy: "keep_primary"
                  });
                  setActiveModal({ type: "mergeConfirm", data: { groupKey, products } });
                }}
                onPageChange={setDuplicatePage}
              />
            </TabsContent>

            {/* Sub-tab: Reporte Detallado de Duplicados */}
            <TabsContent value="duplicates-report" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Reporte Detallado de Duplicados</h2>
                  <p className="text-muted-foreground">Análisis completo de imágenes duplicadas con productos y referencias específicas</p>
                </div>
                <Button
                  onClick={() => {
                    // Refrescar datos del reporte
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/duplicates-report'] });
                  }}
                  data-testid="button-refresh-duplicates-report"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Actualizar Reporte
                </Button>
              </div>

              <DuplicatesDetailedReport />
            </TabsContent>

            {/* Sub-tab: Carga Masiva con Clasificación Automática */}
            <TabsContent value="bulk-upload" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Carga Masiva con Clasificación Automática</h2>
                  <p className="text-muted-foreground">Sube múltiples imágenes y el sistema detectará automáticamente las marcas usando IA</p>
                </div>
              </div>

              <BulkUploadPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Modal para ver productos de una marca */}
        <Dialog open={activeModal.type === "brandProducts"} onOpenChange={(open) => open ? openModal("brandProducts") : closeModal()}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Productos de {brands.find(b => b.id === selectedBrandId)?.name || 'la marca'}
              </DialogTitle>
              <DialogDescription>
                Lista de todos los productos asignados a esta marca
              </DialogDescription>
            </DialogHeader>
            
            {brandProductsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
                <span>Cargando productos...</span>
              </div>
            ) : brandProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="font-semibold mb-2">No hay productos</h3>
                <p className="text-sm text-gray-600">
                  Esta marca no tiene productos asignados aún.
                </p>
              </div>
            ) : (
              <>
                {/* Controles de selección múltiple */}
                <div className="flex items-center justify-between mb-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedProducts.size === brandProducts.length && brandProducts.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedProducts(new Set(brandProducts.map(p => p.id)));
                        } else {
                          setSelectedProducts(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all-brand-products"
                    />
                    <span className="text-sm font-medium">
                      Seleccionar todos ({brandProducts.length} productos)
                    </span>
                    {selectedProducts.size > 0 && (
                      <Badge variant="secondary">
                        {selectedProducts.size} seleccionados
                      </Badge>
                    )}
                  </div>
                  
                  {selectedProducts.size > 0 && (
                    <Button
                      onClick={() => setActiveModal({ type: "bulkPriceAdjust", data: { brandId: selectedBrandId, productIds: Array.from(selectedProducts) } })}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-bulk-adjust-prices"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Ajustar Precios ({selectedProducts.size})
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {brandProducts.map((product) => (
                    <Card key={product.id} className="relative">
                      {/* Checkbox de selección */}
                      <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProducts(prev => {
                            const newSet = new Set(prev);
                            if (checked) {
                              newSet.add(product.id);
                            } else {
                              newSet.delete(product.id);
                            }
                            return newSet;
                          });
                        }}
                        data-testid={`checkbox-select-product-${product.id}`}
                        className="bg-white border-2 shadow-sm"
                      />
                      </div>
                      <CardHeader className="pb-3">
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-3">
                        {product.imageUrl ? (
                          <img 
                            src={buildImageSrc(product.imageUrl)} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-sm line-clamp-2">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {product.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        {product.reference && (
                          <div className="text-xs">
                            <span className="font-medium">Ref:</span> {product.reference}
                          </div>
                        )}
                        
                        
                        {/* Tallas disponibles */}
                        {product.sizes && product.sizes.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium">Tallas:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.sizes.slice(0, 4).map((size, index) => (
                                <span 
                                  key={index}
                                  className="bg-muted text-muted-foreground px-1 py-0.5 rounded text-xs"
                                >
                                  {size}
                                </span>
                              ))}
                              {product.sizes.length > 4 && (
                                <span className="text-xs text-muted-foreground">
                                  +{product.sizes.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Precio del producto */}
                        {product.price && product.price !== "1" && (
                          <div className="text-xs">
                            <span className="font-medium">Precio:</span> {formatCurrency(product.price)} COP
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {product.isFlashSale && (
                            <Badge variant="destructive" className="text-xs">
                              ¡OFERTA!
                            </Badge>
                          )}
                          {product.isFeatured && (
                            <Badge className="text-xs">
                              Destacado
                            </Badge>
                          )}
                        </div>
                        
                        {/* Botones de acción */}
                        <div className="flex gap-1 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product);
                            }}
                            data-testid={`button-edit-brand-product-${product.id}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          {product.imageUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setImageZoomDrawer({product, isOpen: true})}
                              data-testid={`button-zoom-brand-product-${product.id}`}
                            >
                              <ZoomIn className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              </>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={closeModal}
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Panel de Promociones - Manteniendo el código existente */}
        <TabsContent value="promotions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Promociones</h2>
            <Dialog open={activeModal.type === "promotion"} onOpenChange={(open) => open ? openModal("promotion") : closeModal()}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-promotion">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Promoción
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Agregar Nueva Promoción</DialogTitle>
                  <DialogDescription>Completa los datos de la promoción</DialogDescription>
                </DialogHeader>
                <Form {...promotionForm}>
                  <form onSubmit={promotionForm.handleSubmit((data) => createPromotionMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={promotionForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-promotion-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={promotionForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} data-testid="input-promotion-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={promotionForm.control}
                        name="discountPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descuento (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                data-testid="input-promotion-discount-percentage" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promotionForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-promotion-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={promotionForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha de Inicio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                    data-testid="button-promotion-start-date"
                                  >
                                    {field.value ? format(field.value, "dd/MM/yyyy") : "Selecciona fecha"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promotionForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha de Fin</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                    data-testid="button-promotion-end-date"
                                  >
                                    {field.value ? format(field.value, "dd/MM/yyyy") : "Selecciona fecha"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={promotionForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Promoción Activa</FormLabel>
                          </div>
                          <FormControl>
                            <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-promotion-active" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => closeModal()}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createPromotionMutation.isPending} data-testid="button-submit-promotion">
                        {createPromotionMutation.isPending ? "Creando..." : "Crear Promoción"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {promotions.map((promotion) => (
              <Card key={promotion.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{promotion.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePromotionMutation.mutate(promotion.id)}
                      data-testid={`button-delete-promotion-${promotion.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>{promotion.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {promotion.discountPercentage && (
                      <p className="font-semibold">Descuento: {promotion.discountPercentage}%</p>
                    )}
                    {promotion.code && (
                      <p className="text-sm">Código: <code className="bg-muted px-1 rounded">{promotion.code}</code></p>
                    )}
                    <div className="flex gap-2">
                      <Badge variant={promotion.isActive ? "default" : "secondary"}>
                        {promotion.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {promotion.startDate && format(new Date(promotion.startDate), "dd/MM/yyyy")} - {promotion.endDate && format(new Date(promotion.endDate), "dd/MM/yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Panel de Eventos - Manteniendo el código existente */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Eventos</h2>
            <Dialog open={activeModal.type === "event"} onOpenChange={(open) => open ? openModal("event") : closeModal()}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-event">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Evento</DialogTitle>
                  <DialogDescription>Completa los datos del evento</DialogDescription>
                </DialogHeader>
                <Form {...eventForm}>
                  <form onSubmit={eventForm.handleSubmit((data) => createEventMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={eventForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-event-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={eventForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} data-testid="input-event-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={eventForm.control}
                        name="eventType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Evento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-event-type">
                                  <SelectValue placeholder="Selecciona un tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="flash_sale">Oferta Flash</SelectItem>
                                <SelectItem value="promotion">Promoción</SelectItem>
                                <SelectItem value="new_arrival">Nueva Llegada</SelectItem>
                                <SelectItem value="seasonal">Estacional</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prioridad</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                value={field.value || 0}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                data-testid="input-event-priority" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={eventForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha de Inicio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                    data-testid="button-event-start-date"
                                  >
                                    {field.value ? format(field.value, "dd/MM/yyyy") : "Selecciona fecha"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha de Fin</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                    data-testid="button-event-end-date"
                                  >
                                    {field.value ? format(field.value, "dd/MM/yyyy") : "Selecciona fecha"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={eventForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Imagen del Evento</FormLabel>
                          <FormControl>
                            <ObjectUploader
                              onComplete={(imageUrl) => field.onChange(imageUrl)}
                              data-testid="uploader-event-image"
                            />
                          </FormControl>
                          {field.value && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">Imagen subida: {field.value}</p>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={eventForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Evento Activo</FormLabel>
                          </div>
                          <FormControl>
                            <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-event-active" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => closeModal()}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                        {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEventMutation.mutate(event.id)}
                      data-testid={`button-delete-event-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>{event.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Badge variant={event.isActive ? "default" : "secondary"}>
                        {event.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Badge variant="outline">{event.eventType}</Badge>
                    </div>
                    <p className="text-sm">Prioridad: {event.priority}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.startDate && format(new Date(event.startDate), "dd/MM/yyyy")} - {event.endDate && format(new Date(event.endDate), "dd/MM/yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Brand Packages Tab - Bulk Product Creation */}
        <TabsContent value="brand-packages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes por Marca</h2>
            <Button 
              onClick={() => openModal("brandPackage")}
              data-testid="button-add-brand-package"
            >
              <Layers className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>
          
          {/* Contenido del paquete por marcas aquí */}
          <div className="text-center py-8">
            <p className="text-muted-foreground">El modal de paquetes se abrirá cuando presiones "Crear Paquete"</p>
          </div>

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                Creación Masiva de Productos
              </CardTitle>
              <CardDescription>
                Crea múltiples productos de una marca de forma eficiente. Cada producto tendrá una referencia única autogenerada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <div>
                    <strong>Referencias únicas:</strong> Se generan automáticamente códigos de 10 caracteres únicos para cada producto.
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <div>
                    <strong>Nombre automático:</strong> El nombre del producto será el nombre de la marca seleccionada.
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <div>
                    <strong>Mínimo 10 imágenes:</strong> Cada imagen se convertirá en un producto individual con la misma información base.
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <div>
                    <strong>Proceso rápido:</strong> Todos los productos se crean simultáneamente para máxima eficiencia.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Panel de Carga Inteligente */}
        <TabsContent value="intelligent-upload" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                Carga Inteligente de Productos
              </h2>
              <p className="text-muted-foreground mt-1">
                Sube imágenes de múltiples marcas y el sistema las organizará automáticamente
              </p>
            </div>
          </div>

          <IntelligentUploader
            onImagesUploaded={handleIntelligentImagesUploaded}
            maxImages={50}
          />

          {intelligentUploadedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🚀 Imágenes Listas para Procesamiento Inteligente</CardTitle>
                <CardDescription>
                  Creación automática de productos con detección de marcas por IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="text-4xl font-bold text-green-600 mb-2">
                      {intelligentUploadedImages.length}
                    </div>
                    <div className="text-lg font-semibold text-green-800 mb-1">
                      Imágenes Subidas Exitosamente
                    </div>
                    <div className="text-sm text-green-700">
                      Listas para detección automática de marcas y creación de productos
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleStartIntelligentUpload}
                    disabled={bulkOperations.intelligentUpload.progress.isProcessing || intelligentUploadedImages.length === 0}
                    className="flex-1"
                    data-testid="button-start-intelligent-upload"
                  >
                    {bulkOperations.intelligentUpload.progress.isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Procesando con IA... ({bulkOperations.intelligentUpload.progress.currentIndex}/{bulkOperations.intelligentUpload.progress.total})
                      </div>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Crear {intelligentUploadedImages.length} Productos con IA
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIntelligentUploadedImages([]);
                      setBulkOperations(prev => ({
                        ...prev,
                        intelligentUpload: {
                          images: [],
                          progress: { 
                            isProcessing: false, 
                            currentIndex: 0, 
                            total: 0, 
                            results: { success: 0, failed: 0, errors: [] } 
                          }
                        }
                      }));
                    }}
                    disabled={bulkOperations.intelligentUpload.progress.isProcessing}
                    data-testid="button-clear-intelligent-uploads"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                </div>

                {bulkOperations.intelligentUpload.progress.isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>{Math.round((bulkOperations.intelligentUpload.progress.currentIndex / bulkOperations.intelligentUpload.progress.total) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(bulkOperations.intelligentUpload.progress.currentIndex / bulkOperations.intelligentUpload.progress.total) * 100} 
                      className="w-full"
                    />
                  </div>
                )}

                {bulkOperations.intelligentUpload.progress.results.success > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <Check className="h-5 w-5" />
                      <span className="font-semibold">
                        ¡Proceso completado! {bulkOperations.intelligentUpload.progress.results.success} productos creados exitosamente.
                      </span>
                    </div>
                    {bulkOperations.intelligentUpload.progress.results.failed > 0 && (
                      <div className="mt-2 text-red-600">
                        {bulkOperations.intelligentUpload.progress.results.failed} productos fallaron al crear.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Usage Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Guía de Uso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Nombres de archivo:</strong> Usa nombres descriptivos con la marca incluida (ej: "nike_air_max.jpg", "adidas_ultraboost.jpg")
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Detección automática:</strong> El sistema reconoce más de 20 marcas populares incluyendo Nike, Adidas, Jordan, Puma, etc.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Productos automáticos:</strong> Cada imagen se convierte en un producto con el nombre de la marca detectada y referencia única.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Categoría requerida:</strong> Selecciona una categoría por defecto antes de iniciar la creación masiva.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Panel de Limpieza */}
        <TabsContent value="cleanup" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-red-600" />
                Herramientas de Limpieza
              </h2>
              <p className="text-muted-foreground mt-1">
                Detectar y limpiar datos corruptos del sistema
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🧹 Limpieza de URLs Malformadas
              </CardTitle>
              <CardDescription>
                Detecta y elimina productos con URLs corruptas (blob: y devblob:)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    refetchMalformed();
                    openModal("malformedUrls");
                  }}
                  disabled={isLoadingMalformed}
                  data-testid="button-detect-malformed-urls"
                >
                  {isLoadingMalformed ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Detectar URLs Corruptas
                    </>
                  )}
                </Button>
                
                {malformedUrlsData && malformedUrlsData.malformed > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {malformedUrlsData.malformed} URLs corruptas encontradas
                  </Badge>
                )}
              </div>

              {malformedUrlsData && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-blue-800">
                    <strong>Estado del Sistema:</strong>
                    <ul className="mt-2 space-y-1">
                      <li>• Total de productos: {malformedUrlsData.total}</li>
                      <li>• URLs corruptas: {malformedUrlsData.malformed}</li>
                      <li>• URLs válidas: {malformedUrlsData.total - malformedUrlsData.malformed}</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Panel de Reportes */}
        <TabsContent value="reports" className="space-y-2 sm:space-y-4">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                Sistema de Reportes Automáticos
              </h2>
              <p className="text-muted-foreground mt-1">
                Generación automática de reportes diarios con estadísticas completas del sistema
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Panel de control manual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Generar Reporte Manual
                </CardTitle>
                <CardDescription>
                  Crear y enviar un reporte inmediato con todas las estadísticas del sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">Estado del Sistema</span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>✅ Reportes automáticos habilitados</li>
                    <li>⏰ Programados diariamente a las 12:00 AM</li>
                    <li>📊 Incluye estadísticas completas</li>
                    <li>🔍 Detección automática de duplicados</li>
                  </ul>
                </div>
                
                <Button 
                  className="w-full"
                  onClick={async () => {
                    try {
                      toast({ title: "⏳ Generando reporte...", description: "Por favor espera mientras se genera el reporte completo" });
                      
                      const response = await apiRequest("GET", "/api/admin/generate-report");
                      const data = await response.json();
                      
                      if (data.success) {
                        toast({ 
                          title: "✅ Reporte generado exitosamente", 
                          description: `${data.message || 'Reporte completo generado y enviado via múltiples canales'}`,
                          duration: 5000
                        });
                      } else {
                        throw new Error(data.message || 'Error desconocido');
                      }
                    } catch (error: any) {
                      console.error('Error generating report:', error);
                      toast({ 
                        title: "❌ Error al generar reporte", 
                        description: error.message || 'No se pudo generar el reporte',
                        variant: "destructive"
                      });
                    }
                  }}
                  data-testid="button-generate-manual-report"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generar Reporte Ahora
                </Button>
              </CardContent>
            </Card>

            {/* Configuración de reportes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  Configuración de Reportes
                </CardTitle>
                <CardDescription>
                  Información sobre el sistema de reportes automáticos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Reportes Automáticos</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Activo</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Horario</span>
                    <Badge variant="outline">12:00 AM (Bogotá)</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Frecuencia</span>
                    <Badge variant="outline">Diario</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Incluye</span>
                    <Badge variant="outline">Estadísticas completas</Badge>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Métodos de notificación activos:</strong><br />
                    • Archivo local de logs<br />
                    • Reporte en consola<br />
                    • Webhook genérico (configurable)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Información adicional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Contenido de los Reportes
              </CardTitle>
              <CardDescription>
                Estadísticas y métricas incluidas en cada reporte automático
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📦 Inventario</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Total de productos</li>
                    <li>• Productos por marca</li>
                    <li>• Categorías activas</li>
                    <li>• Stock y disponibilidad</li>
                  </ul>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">🖼️ Imágenes</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Total de imágenes</li>
                    <li>• Duplicados detectados</li>
                    <li>• Referencias afectadas</li>
                    <li>• Optimizaciones sugeridas</li>
                  </ul>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">📊 Actividad</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Eventos del sistema</li>
                    <li>• Usuarios activos</li>
                    <li>• Acciones realizadas</li>
                    <li>• Auditoría completa</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 🔍 Duplicate Images Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-orange-600" />
                Reporte de Imágenes Duplicadas
              </CardTitle>
              <CardDescription>
                Análisis completo de imágenes duplicadas en el sistema usando SHA-256
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button 
                  onClick={async () => {
                    try {
                      await refetchDuplicates();
                      toast({ 
                        title: "✅ Reporte actualizado", 
                        description: "Se ha generado el reporte más reciente de imágenes duplicadas" 
                      });
                    } catch (error: any) {
                      toast({ 
                        title: "❌ Error", 
                        description: error.message || 'No se pudo generar el reporte',
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={isLoadingDuplicates}
                  data-testid="button-generate-duplicates-report"
                >
                  {isLoadingDuplicates ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Hash className="h-4 w-4 mr-2" />
                      Generar Reporte de Duplicados
                    </>
                  )}
                </Button>
              </div>

              {duplicateImagesData && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="text-sm text-orange-600 font-medium">Total Duplicados</div>
                      <div className="text-2xl font-bold text-orange-800">
                        {duplicateImagesData.summary?.totalDuplicateImages || 0}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm text-red-600 font-medium">Productos Afectados</div>
                      <div className="text-2xl font-bold text-red-800">
                        {duplicateImagesData.summary?.totalProductsAffected || 0}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">Marcas Afectadas</div>
                      <div className="text-2xl font-bold text-blue-800">
                        {duplicateImagesData.summary?.totalBrandsAffected || 0}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="text-sm text-purple-600 font-medium">Total Imágenes</div>
                      <div className="text-2xl font-bold text-purple-800">
                        {duplicateImagesData.summary?.totalImagesInSystem || 0}
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Groups */}
                  {duplicateImagesData.duplicateGroups && duplicateImagesData.duplicateGroups.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Grupos de Duplicados Detectados:</h3>
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {duplicateImagesData.duplicateGroups.map((group: any, index: number) => (
                          <div 
                            key={group.imageHash || index} 
                            className="p-4 bg-gray-50 border rounded-lg"
                            data-testid={`duplicate-group-${index}`}
                          >
                            <div className="flex items-start gap-4">
                              {/* Image Preview */}
                              <div className="flex-shrink-0">
                                <img 
                                  src={group.imageUrl} 
                                  alt="Duplicate" 
                                  className="w-24 h-24 object-cover rounded border"
                                />
                              </div>
                              
                              {/* Details */}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">
                                    {group.usageCount} usos
                                  </Badge>
                                  <span className="text-xs text-gray-500 font-mono">
                                    Hash: {group.imageHash?.substring(0, 16)}...
                                  </span>
                                </div>
                                
                                {/* Products using this image */}
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-gray-700">
                                    Productos afectados:
                                  </div>
                                  <div className="grid gap-1">
                                    {group.productsUsingImage?.slice(0, 3).map((prod: any) => (
                                      <div 
                                        key={prod.productId} 
                                        className="text-sm text-gray-600 flex items-center gap-2"
                                      >
                                        <span className="font-medium">{prod.productName}</span>
                                        <span className="text-xs text-gray-500">
                                          ({prod.brandName} - Ref: {prod.productReference})
                                        </span>
                                      </div>
                                    ))}
                                    {group.productsUsingImage?.length > 3 && (
                                      <div className="text-xs text-gray-500 italic">
                                        +{group.productsUsingImage.length - 3} productos más...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                      <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-green-800 font-medium">
                        ✨ No se encontraron imágenes duplicadas en el sistema
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>

      {/* Dialog para mostrar URLs malformadas */}
      <Dialog open={activeModal.type === "malformedUrls"} onOpenChange={(open) => open ? openModal("malformedUrls") : closeModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              URLs Malformadas Detectadas
            </DialogTitle>
            <DialogDescription>
              {malformedUrlsData?.malformed || 0} productos con URLs corruptas encontrados
            </DialogDescription>
          </DialogHeader>
          
          {malformedUrlsData?.products && malformedUrlsData.products.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">
                  <strong>⚠️ Advertencia:</strong> Esta acción eliminará permanentemente todos los productos con URLs corruptas.
                  No se puede deshacer.
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="grid gap-3">
                  {malformedUrlsData.products.map((product: any) => (
                    <div key={product.id} className="p-3 bg-gray-50 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{product.name}</h4>
                          <p className="text-sm text-gray-600">Ref: {product.reference}</p>
                          <p className="text-sm text-gray-600">Marca: {product.brandName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-red-600 font-mono break-all max-w-xs">
                            {product.imageUrl}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => closeModal()}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    cleanupMalformedUrlsMutation.mutate();
                  }}
                  disabled={cleanupMalformedUrlsMutation.isPending}
                  className="flex-1"
                  data-testid="button-cleanup-malformed-urls"
                >
                  {cleanupMalformedUrlsMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Limpiando...
                    </div>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpiar {malformedUrlsData.malformed} Productos
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                ¡Sistema Limpio!
              </h3>
              <p className="text-green-600">
                No se encontraron URLs malformadas en el sistema
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Brand Package - Creación masiva de productos */}
      <Dialog open={activeModal.type === "brandPackage"} onOpenChange={(open) => open ? openModal("brandPackage") : closeModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Crear Paquete de Productos
            </DialogTitle>
            <DialogDescription>
              Crea múltiples productos de una marca de forma eficiente. Cada imagen se convertirá en un producto individual.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...brandPackageForm}>
            <form onSubmit={brandPackageForm.handleSubmit((data) => {
              console.log('🚀 Enviando paquete:', data);
              // Store the package data for potential use after duplicate check
              setPendingPackageData(data);
              // First, check for duplicates
              checkPackageDuplicatesMutation.mutate(data.images);
            })} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={brandPackageForm.control}
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-brand-package">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la marca" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brands?.map((brand: Brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={brandPackageForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-category-package">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.emoji} {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={brandPackageForm.control}
                  name="sizeFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Talla Inicial</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-size-from">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona talla inicial" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"].map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={brandPackageForm.control}
                  name="sizeTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Talla Final</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-size-to">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona talla final" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"].map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={brandPackageForm.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fotografías ⚡ (Mínimo 1)</FormLabel>
                    <FormControl>
                      <IntelligentUploader 
                        onImagesUploaded={(imageUrls) => {
                          field.onChange(imageUrls);
                          setBulkOperations(prev => ({
                            ...prev,
                            brandPackage: { ...prev.brandPackage, images: imageUrls }
                          }));
                        }}
                        maxImages={50}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Progress indicator */}
              {bulkOperations.brandPackage.progress.isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">Creando productos...</span>
                    <span className="text-sm text-blue-700">
                      {bulkOperations.brandPackage.progress.currentIndex} / {bulkOperations.brandPackage.progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(bulkOperations.brandPackage.progress.currentIndex / bulkOperations.brandPackage.progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {!bulkOperations.brandPackage.progress.isProcessing && (bulkOperations.brandPackage.progress.results.success > 0 || bulkOperations.brandPackage.progress.results.failed > 0) && (
                <div className={`border rounded-lg p-4 ${
                  bulkOperations.brandPackage.progress.results.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <h4 className="font-medium mb-2">Resultados:</h4>
                  <div className="text-sm space-y-1">
                    <p className="text-green-700">✅ Exitosos: {bulkOperations.brandPackage.progress.results.success}</p>
                    {bulkOperations.brandPackage.progress.results.failed > 0 && (
                      <p className="text-red-700">❌ Fallidos: {bulkOperations.brandPackage.progress.results.failed}</p>
                    )}
                    {bulkOperations.brandPackage.progress.results.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-red-700">Errores:</p>
                        <ul className="list-disc list-inside text-red-600 text-xs space-y-1">
                          {bulkOperations.brandPackage.progress.results.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    closeModal();
                    brandPackageForm.reset();
                    setBulkOperations(prev => ({
                      ...prev,
                      brandPackage: { ...prev.brandPackage, images: [] }
                    }));
                    setBulkOperations(prev => ({
                      ...prev,
                      brandPackage: { ...prev.brandPackage, progress: { isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } } }
                    }));
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={checkPackageDuplicatesMutation.isPending || bulkCreateProductsMutation.isPending || (brandPackageForm.watch('images')?.length || 0) < 1}
                  data-testid="button-submit-brand-package"
                >
                  {checkPackageDuplicatesMutation.isPending 
                    ? "Verificando duplicados..." 
                    : bulkCreateProductsMutation.isPending 
                    ? "Creando productos destacados..." 
                    : `Crear ${(brandPackageForm.watch('images')?.length || 0)} Productos Destacados`
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 🔍 Modal de Alertas de Productos Duplicados - INFORMATIVO, NO BLOQUEANTE */}
      <Dialog open={showDuplicateAlert} onOpenChange={(open) => {
        if (!open) {
          setShowDuplicateAlert(false);
          setPackageDuplicates([]);
          setPendingPackageData(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Productos Duplicados Detectados
            </DialogTitle>
            <DialogDescription>
              Se encontraron {packageDuplicates.length} imagen(es) que ya están siendo usadas en productos existentes.
              Esta información es solo para tu conocimiento - puedes continuar con la creación si lo deseas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Información general */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-800 mb-1">Información Importante</h4>
                  <p className="text-orange-700 text-sm">
                    Las siguientes imágenes ya están siendo utilizadas en productos existentes. 
                    Crear productos duplicados puede confundir a los clientes y afectar la organización del inventario.
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de productos duplicados */}
            <div className="space-y-3">
              <h4 className="font-semibold">Detalles de Productos Duplicados:</h4>
              
              {packageDuplicates.map((duplicate, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-4">
                    {/* Vista previa de la imagen */}
                    <div className="flex-shrink-0">
                      <img 
                        src={duplicate.imageUrl} 
                        alt="Producto duplicado"
                        className="w-16 h-16 object-cover rounded-lg border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-product.jpg';
                        }}
                      />
                    </div>
                    
                    {/* Información del producto */}
                    <div className="flex-1 min-w-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Producto Existente:</p>
                          <p className="font-semibold text-gray-900 truncate">{duplicate.existingProduct.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Referencia:</p>
                          <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">
                            {duplicate.existingProduct.reference || 'Sin referencia'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Marca:</p>
                          <p className="font-medium text-blue-700">{duplicate.existingProduct.brandName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Categoría:</p>
                          <p className="font-medium text-green-700">{duplicate.existingProduct.categoryName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total de usos de esta imagen:</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-orange-700 bg-orange-100">
                              {duplicate.duplicateCount} {duplicate.duplicateCount === 1 ? 'vez' : 'veces'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">ID del producto:</p>
                          <p className="font-mono text-xs text-gray-500 break-all">{duplicate.existingProduct.id}</p>
                        </div>
                      </div>
                      
                      {/* Alerta descriptiva */}
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                          ⚠️ La imagen <code className="bg-yellow-100 px-1 rounded text-xs">{duplicate.imageUrl.split('/').pop()}</code> ya está usada en el producto 
                          '<strong>{duplicate.existingProduct.name}</strong>' (REF: <strong>{duplicate.existingProduct.reference || 'N/A'}</strong>) 
                          en categoría '<strong>{duplicate.existingProduct.categoryName}</strong>', marca '<strong>{duplicate.existingProduct.brandName}</strong>'. 
                          Total usos: <strong>{duplicate.duplicateCount}</strong> {duplicate.duplicateCount === 1 ? 'vez' : 'veces'}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDuplicateAlert(false);
                  setPackageDuplicates([]);
                  setPendingPackageData(null);
                }}
                className="flex-1"
                data-testid="button-cancel-duplicate-alert"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar Creación
              </Button>
              <Button
                onClick={() => {
                  // Usuario decide continuar a pesar de los duplicados
                  if (pendingPackageData) {
                    console.log('👤 Usuario decidió continuar con creación a pesar de duplicados');
                    bulkCreateProductsMutation.mutate(pendingPackageData);
                  }
                  setShowDuplicateAlert(false);
                  setPackageDuplicates([]);
                  setPendingPackageData(null);
                }}
                disabled={bulkCreateProductsMutation.isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                data-testid="button-continue-despite-duplicates"
              >
                {bulkCreateProductsMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creando productos...
                  </div>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Continuar Creación
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de productos movido fuera de TabsContent para resolver problemas de z-index */}
      <Dialog open={activeModal.type === "product"} onOpenChange={(open) => open ? openModal("product") : closeModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>{editingItem.type === "product" ? "Editar Producto" : "Agregar Nuevo Producto"}</DialogTitle>
            <DialogDescription>
              {editingItem.type === "product" 
                ? "Modifica los detalles del producto que desees actualizar"
                : "Completa todos los detalles del producto incluyendo imágenes, tallas y colores"
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit((data) => {
              if (editingItem.type === "product") {
                updateProductMutation.mutate(data);
              } else {
                createProductMutation.mutate(data);
              }
            })} className="space-y-6">
              {/* Información Básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <FormField
                  control={productForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto *</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} data-testid="input-product-name" />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={applySuggestions}
                          disabled={!field.value || field.value.length < 3}
                          data-testid="button-apply-suggestions"
                        >
                          <Lightbulb className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Sugerir</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-product-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={productForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="input-product-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stock y Precios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                
                <FormField
                  control={productForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de Venta (COP) *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ej: 150.000"
                          value={formatPrice(field.value || "")}
                          onChange={(e) => {
                            const formattedValue = formatPrice(e.target.value);
                            field.onChange(parsePrice(formattedValue));
                          }}
                          data-testid="input-product-price" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={productForm.control}
                  name="originalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Original (COP)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ej: 200.000 (opcional)"
                          value={field.value ? formatPrice(field.value.toString()) : ""}
                          onChange={(e) => {
                            const formattedValue = formatPrice(e.target.value);
                            field.onChange(formattedValue ? parsePrice(formattedValue) : null);
                          }}
                          data-testid="input-product-original-price" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Mostrar descuento calculado */}
              {productForm.watch("price") && productForm.watch("originalPrice") && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800">
                    💰 Descuento: {calculateDiscount(
                      productForm.watch("originalPrice")?.toString() || "0", 
                      productForm.watch("price") || "0"
                    )}% de descuento
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Los clientes verán: <span className="line-through">${formatPrice(productForm.watch("originalPrice")?.toString() || "0")}</span> → ${formatPrice(productForm.watch("price") || "0")}
                  </p>
                </div>
              )}

              {/* Categoría y Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <FormField
                  control={productForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-category">
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.emoji} {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-brand">
                            <SelectValue placeholder="Selecciona una marca" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Imagen Principal */}
              <FormField
                control={productForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagen Principal *</FormLabel>
                    <FormControl>
                      <ObjectUploader
                        onComplete={(imageUrl) => {
                          console.log("🔥 IMAGEN PRINCIPAL RECIBIDA:", imageUrl);
                          console.log("🔥 Actualizando campo con field.onChange");
                          field.onChange(imageUrl);
                          
                          // Forzar actualización del formulario
                          productForm.setValue("imageUrl", imageUrl, { 
                            shouldValidate: true, 
                            shouldDirty: true,
                            shouldTouch: true 
                          });
                          
                          console.log("🔥 Valor actual del campo:", productForm.getValues("imageUrl"));
                          console.log("🔥 Todos los valores del form:", productForm.getValues());
                          
                          toast({
                            title: "¡Imagen principal cargada!",
                            description: `URL: ${imageUrl}`,
                          });
                        }}
                        data-testid="uploader-product-image"
                      />
                    </FormControl>
                    {field.value && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-700 font-medium">✅ Imagen subida:</p>
                        <p className="text-xs text-green-600 break-all">{field.value}</p>
                        <img 
                          src={field.value} 
                          alt="Preview" 
                          className="mt-2 w-20 h-20 object-cover rounded border"
                          onError={(e) => {
                            console.error("Error loading preview image:", field.value);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Imágenes Adicionales */}
              <div>
                <FormLabel>Más Imágenes del Producto 📸</FormLabel>
                <p className="text-xs text-muted-foreground mb-2">
                  Agrega hasta 9 imágenes para mostrar diferentes ángulos, colores o detalles
                </p>
                <div className="space-y-2">
                  {/* Siempre mostrar al menos un uploader si no hay imágenes */}
                  {productImages.length === 0 && (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                      <ObjectUploader
                        onComplete={(imageUrl) => {
                          console.log("Imagen adicional subida:", imageUrl); // Debug
                          const newImages = [...productImages, imageUrl];
                          setProductImages(newImages);
                          toast({
                            title: "¡Imagen adicional cargada!",
                            description: "La imagen se guardará cuando publiques el producto",
                          });
                        }}
                        data-testid="uploader-product-extra-image-0"
                      />
                      <div className="flex flex-col items-center gap-2 mt-2">
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        <span>Agregar primera imagen adicional</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Mostrar imágenes ya agregadas */}
                  {productImages.map((image, index) => (
                    <div key={index} className="flex gap-2 items-center p-3 border rounded-lg bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Imagen {index + 1}</p>
                        <p className="text-xs text-muted-foreground truncate">{image}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeProductImage(index)}
                        data-testid={`button-remove-image-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {/* Botón para agregar más imágenes */}
                  {productImages.length > 0 && productImages.length < 9 && (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 text-center">
                      <ObjectUploader
                        onComplete={(imageUrl) => {
                          const newImages = [...productImages, imageUrl];
                          setProductImages(newImages);
                        }}
                        data-testid={`uploader-product-extra-image-${productImages.length}`}
                      />
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <ImagePlus className="h-4 w-4" />
                        <span>Agregar otra imagen ({productImages.length}/9)</span>
                      </div>
                    </div>
                  )}
                  
                  {productImages.length >= 9 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Has alcanzado el límite máximo de 9 imágenes adicionales
                    </p>
                  )}
                </div>
              </div>

              {/* Tallas */}
              <div>
                <FormLabel>Tallas Disponibles</FormLabel>
                <div className="space-y-2 mt-2">
                  <div className="flex gap-2 flex-wrap">
                    {productSizes.map((size) => (
                      <Badge key={size} variant="secondary" className="cursor-pointer" onClick={() => removeProductSize(size)}>
                        {size} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Agregar talla (ej: 40, XL, M)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addProductSize(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      data-testid="input-product-size"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addProductSize(input.value);
                        input.value = '';
                      }}
                      data-testid="button-add-size"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Colores */}
              <div>
                <FormLabel>Colores Disponibles</FormLabel>
                <div className="space-y-2 mt-2">
                  <div className="flex gap-2 flex-wrap">
                    {productColors.map((color) => (
                      <Badge key={color} variant="secondary" className="cursor-pointer" onClick={() => removeProductColor(color)}>
                        {color} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Agregar color (ej: Negro, Blanco, Azul marino)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addProductColor(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      data-testid="input-product-color"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addProductColor(input.value);
                        input.value = '';
                      }}
                      data-testid="button-add-color"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Configuraciones Especiales */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={productForm.control}
                  name="isFlashSale"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Oferta Flash</FormLabel>
                        <div className="text-sm text-muted-foreground">Destacar como oferta por tiempo limitado</div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-product-flash-sale" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Producto Destacado</FormLabel>
                        <div className="text-sm text-muted-foreground">Mostrar en la sección destacados</div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-product-featured" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={editingItem.type === "product" ? handleCancelEdit : closeModal}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={editingItem.type === "product" ? updateProductMutation.isPending : createProductMutation.isPending} 
                  data-testid="button-submit-product"
                >
                  {editingItem.type === "product" 
                    ? (updateProductMutation.isPending ? "Actualizando..." : "Actualizar Producto")
                    : (createProductMutation.isPending ? "Creando..." : "Crear Producto")
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de zoom para imágenes de productos en admin */}
      {imageZoomDrawer && (
        <Dialog open={imageZoomDrawer?.isOpen || false} onOpenChange={(open) => setImageZoomDrawer(open && imageZoomDrawer ? imageZoomDrawer : null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-2">
            <DialogHeader>
              <DialogTitle>{imageZoomDrawer?.product.name}</DialogTitle>
              <DialogDescription>
                Imagen en detalle del producto - Panel Admin
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex justify-center">
              <img 
                src={buildImageSrc(imageZoomDrawer?.product.imageUrl || imageZoomDrawer?.product.images?.[0])} 
                alt={imageZoomDrawer?.product.name || "Product image"}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                data-testid={`img-admin-zoom-${imageZoomDrawer?.product.id}`}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de advertencia de productos duplicados */}
      <Dialog open={activeModal.type === "duplicateWarning"} onOpenChange={(open) => {
        if (!open) {
          handleCancelDuplicate();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                ⚠️
              </div>
              Producto Duplicado Detectado
            </DialogTitle>
            <DialogDescription>
              Hemos encontrado productos similares en tu inventario. ¿Deseas continuar de todos modos?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Información del producto que se intenta crear */}
            {pendingProductData && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📦 Producto a crear:</h4>
                <p className="text-sm text-blue-700">
                  <strong>Nombre:</strong> {pendingProductData.name}
                </p>
                {pendingProductData.reference && (
                  <p className="text-sm text-blue-700">
                    <strong>Referencia:</strong> {pendingProductData.reference}
                  </p>
                )}
                <p className="text-sm text-blue-700">
                  <strong>Precio:</strong> {formatCurrency(pendingProductData.price)} COP
                </p>
              </div>
            )}

            {/* Lista de productos duplicados encontrados */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-3">
                🔍 Productos similares encontrados ({duplicatedProducts.length}):
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {duplicatedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">{product.name}</p>
                      {product.reference && (
                        <p className="text-xs text-amber-600">Ref: {product.reference}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-800">
                        {formatCurrency(product.price)} COP
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mensaje explicativo */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                💡 <strong>Nota:</strong> Puedes continuar y crear el producto de todos modos. 
                Esta advertencia es solo para informarte de posibles duplicados.
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancelDuplicate}
              className="flex-1"
              data-testid="button-cancel-duplicate"
            >
              ❌ Cancelar
            </Button>
            <Button
              onClick={handleProceedWithDuplicate}
              disabled={forceCreateProductMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              data-testid="button-proceed-duplicate"
            >
              {forceCreateProductMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publicando...
                </div>
              ) : (
                <>✅ Continuar de todos modos</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar marca */}
      <Dialog open={activeModal.type === "deleteBrand"} onOpenChange={(open) => open ? openModal("deleteBrand") : closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              Eliminar Marca
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta marca?
            </DialogDescription>
          </DialogHeader>
          
          {brandToDelete && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
                  {brandToDelete.logo ? (
                    <img 
                      src={brandToDelete.logo} 
                      alt={brandToDelete.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-red-800">{brandToDelete.name}</h4>
                  <p className="text-sm text-red-600">
                    {brandToDelete.productCount || 0} productos asociados
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-700">
              ⚠️ <strong>Advertencia:</strong> Los productos asociados a esta marca no se eliminarán, pero quedarán sin marca asignada.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancelDeleteBrand}
              className="flex-1"
              data-testid="button-cancel-delete-brand"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteBrand}
              disabled={deleteBrandMutation.isPending}
              className="flex-1"
              data-testid="button-confirm-delete-brand"
            >
              {deleteBrandMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Eliminando...
                </div>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Marca
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para editar producto individual */}
      <Dialog open={activeModal.type === "editProduct"} onOpenChange={(open) => open ? openModal("editProduct") : closeModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Producto
            </DialogTitle>
            <DialogDescription>
              Edita los detalles del producto. Los cambios se guardarán inmediatamente.
            </DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <Form {...editProductForm}>
              <form
                onSubmit={editProductForm.handleSubmit((data) => {
                  editProductMutation.mutate({
                    id: editingProduct.id,
                    productData: data,
                  });
                })}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editProductForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Producto</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nombre del producto" data-testid="input-edit-product-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editProductForm.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referencia</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="Referencia del producto" data-testid="input-edit-product-reference" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editProductForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""}
                          placeholder="Descripción del producto"
                          className="min-h-[80px]"
                          data-testid="textarea-edit-product-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editProductForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="0" 
                            onChange={(e) => field.onChange(formatPrice(e.target.value))}
                            data-testid="input-edit-product-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editProductForm.control}
                    name="originalPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Original (Opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="0"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? formatPrice(e.target.value) : "")}
                            data-testid="input-edit-product-original-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Product Info Display */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-3">
                    {editingProduct.imageUrl && (
                      <img
                        src={buildImageSrc(editingProduct.imageUrl)}
                        alt={editingProduct.name}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{editingProduct.name}</h4>
                      <p className="text-sm text-muted-foreground">ID: {editingProduct.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Precio actual: {formatCurrency(editingProduct.price)} COP
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActiveModal({ type: null });
                      setEditingProduct(null);
                      editProductForm.reset();
                    }}
                    className="flex-1"
                    data-testid="button-cancel-edit-product"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={editProductMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-edit-product"
                  >
                    {editProductMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Guardando...
                      </div>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para ajuste masivo de precios */}
      <Dialog open={activeModal.type === "bulkPriceAdjust"} onOpenChange={(open) => open ? openModal("bulkPriceAdjust") : closeModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Ajuste Masivo de Precios
            </DialogTitle>
            <DialogDescription>
              Ajusta los precios de los productos seleccionados de manera masiva.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Información de productos seleccionados */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">
                Productos seleccionados: {activeModal.data?.productIds?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Los cambios se aplicarán a todos los productos seleccionados
              </div>
            </div>

            {/* Formulario de ajuste */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Tipo de Ajuste
                  </label>
                  <Select
                    value={bulkPriceAdjustment.type}
                    onValueChange={(value: "percentage" | "fixed" | "set") =>
                      setBulkPriceAdjustment(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-bulk-price-type">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje</SelectItem>
                      <SelectItem value="fixed">Cantidad Fija</SelectItem>
                      <SelectItem value="set">Establecer Precio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {bulkPriceAdjustment.type === "percentage" 
                      ? "Porcentaje (%)" 
                      : bulkPriceAdjustment.type === "fixed" 
                      ? "Cantidad (COP)" 
                      : "Nuevo Precio (COP)"
                    }
                  </label>
                  <Input
                    type="number"
                    value={bulkPriceAdjustment.value}
                    onChange={(e) =>
                      setBulkPriceAdjustment(prev => ({ ...prev, value: e.target.value }))
                    }
                    placeholder={
                      bulkPriceAdjustment.type === "percentage" 
                        ? "Ej: 10" 
                        : "Ej: 50000"
                    }
                    data-testid="input-bulk-price-value"
                  />
                </div>
              </div>

              {bulkPriceAdjustment.type === "percentage" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Operación
                    </label>
                    <Select
                      value={bulkPriceAdjustment.operation}
                      onValueChange={(value: "increase" | "decrease") =>
                        setBulkPriceAdjustment(prev => ({ ...prev, operation: value }))
                      }
                    >
                      <SelectTrigger data-testid="select-bulk-price-operation">
                        <SelectValue placeholder="Selecciona operación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">Aumentar</SelectItem>
                        <SelectItem value="decrease">Disminuir</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Vista previa del cambio */}
              {bulkPriceAdjustment.value && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Vista Previa
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-300">
                    {bulkPriceAdjustment.type === "percentage" 
                      ? `${bulkPriceAdjustment.operation === "increase" ? "Aumentar" : "Disminuir"} precios en ${bulkPriceAdjustment.value}%`
                      : bulkPriceAdjustment.type === "fixed"
                      ? `${bulkPriceAdjustment.operation === "increase" ? "Aumentar" : "Disminuir"} precios en ${formatCurrency(bulkPriceAdjustment.value)} COP`
                      : `Establecer todos los precios a ${formatCurrency(bulkPriceAdjustment.value)} COP`
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={closeModal}
                className="flex-1"
                data-testid="button-cancel-bulk-price-adjust"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkPriceAdjust}
                disabled={!bulkPriceAdjustment.value || bulkPriceAdjustmentMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-bulk-price-adjust"
              >
                {bulkPriceAdjustmentMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Aplicando...
                  </div>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Aplicar Cambios ({activeModal.data?.productIds?.length || 0})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para confirmar fusión de productos */}
      <Dialog open={activeModal.type === "mergeConfirm"} onOpenChange={(open) => open ? openModal("mergeConfirm") : closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Merge className="h-5 w-5" />
              Confirmar Fusión de Productos
            </DialogTitle>
            <DialogDescription>
              Esta acción fusionará los productos duplicados en uno solo. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {mergeData && activeModal.data?.products && (
            <div className="space-y-4">
              {/* Estrategia de fusión */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Estrategia de Fusión</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="mergeStrategy"
                        value="keep_primary"
                        checked={mergeData.strategy === "keep_primary"}
                        onChange={() => setMergeData(prev => prev ? { ...prev, strategy: "keep_primary" } : null)}
                        data-testid="radio-merge-keep-primary"
                      />
                      <div>
                        <div className="font-medium">Mantener Primario</div>
                        <div className="text-sm text-muted-foreground">
                          Conservar solo la información del producto primario y eliminar los duplicados
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="mergeStrategy"
                        value="merge_data"
                        checked={mergeData.strategy === "merge_data"}
                        onChange={() => setMergeData(prev => prev ? { ...prev, strategy: "merge_data" } : null)}
                        data-testid="radio-merge-combine-data"
                      />
                      <div>
                        <div className="font-medium">Combinar Datos</div>
                        <div className="text-sm text-muted-foreground">
                          Fusionar información de todos los productos (imágenes, tallas, colores, etc.)
                        </div>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Producto primario */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Producto Primario (se mantendrá)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const primary = activeModal.data.products.find((p: Product) => p.id === mergeData.primaryId);
                    if (!primary) return null;
                    
                    return (
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-green-50">
                        {primary.imageUrl && (
                          <img
                            src={buildImageSrc(primary.imageUrl)}
                            alt={primary.name}
                            className="w-16 h-16 object-cover rounded border"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium">{primary.name}</h4>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-sm text-muted-foreground">
                            <span>Ref: {primary.reference || "N/A"}</span>
                            <span>Precio: {formatCurrency(primary.price)} COP</span>
                          </div>
                          {primary.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {primary.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Productos a fusionar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" />
                    Productos que se fusionarán ({mergeData.duplicateIds.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {mergeData.duplicateIds.map(id => {
                      const product = activeModal.data.products.find((p: Product) => p.id === id);
                      if (!product) return null;
                      
                      return (
                        <div key={id} className="flex items-start gap-3 p-3 border rounded-lg bg-red-50">
                          {product.imageUrl && (
                            <img
                              src={buildImageSrc(product.imageUrl)}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          )}
                          <div className="flex-1">
                            <h5 className="text-sm font-medium">{product.name}</h5>
                            <div className="text-xs text-muted-foreground">
                              Ref: {product.reference || "N/A"} | Precio: {formatCurrency(product.price)} COP
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Información del grupo */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Información del Grupo</span>
                </div>
                <div className="text-sm text-amber-700 mt-1">
                  Grupo: <span className="font-mono">{mergeData.groupKey}</span> | 
                  Total productos: {activeModal.data.products.length} | 
                  Se eliminarán: {mergeData.duplicateIds.length} productos
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveModal({ type: null });
                    setMergeData(null);
                  }}
                  className="flex-1"
                  data-testid="button-cancel-merge"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (mergeData) {
                      mergeProductsMutation.mutate({
                        groupKey: mergeData.groupKey,
                        mergeData: {
                          primaryId: mergeData.primaryId,
                          duplicateIds: mergeData.duplicateIds,
                          strategy: mergeData.strategy,
                        },
                      });
                    }
                  }}
                  disabled={mergeProductsMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-merge"
                >
                  {mergeProductsMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Fusionando...
                    </div>
                  ) : (
                    <>
                      <Merge className="w-4 h-4 mr-2" />
                      Confirmar Fusión
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}