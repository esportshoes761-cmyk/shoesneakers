import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, insertPromotionSchema, insertEventSchema, insertBrandSchema } from "@shared/schema";
import type { Product, Promotion, Event, Category, Brand } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Package, Gift, Calendar as CalendarIcon, Trash2, Edit, X, ImagePlus, LogOut, Users, Briefcase, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useAuth, logout } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { formatCurrency } from "@/lib/currency";

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
  logo: z.string().min(1, "El logo es requerido"),
});

type ProductFormData = z.infer<typeof productFormSchema>;
type PromotionFormData = z.infer<typeof promotionFormSchema>;
type EventFormData = z.infer<typeof eventFormSchema>;
type BrandFormData = z.infer<typeof brandFormSchema>;

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

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);

  // Check de autenticación
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
      setLocation("/admin-login");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  // Estados para manejar múltiples campos
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productColors, setProductColors] = useState<string[]>([]);
  
  // Estados para edición
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Estado para búsqueda por referencia
  const [searchReference, setSearchReference] = useState("");

  // Consultas de datos
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  
  // Filtrar productos por referencia
  const products = allProducts.filter(product => 
    !searchReference || 
    (product.reference && product.reference.toLowerCase().includes(searchReference.toLowerCase()))
  );
  const { data: promotions = [] } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });

  // Formularios
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "1",
      originalPrice: null,
      imageUrl: "",
      reference: "",
      stock: 0,
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
      logo: "",
      description: "",
      catalogUrl: "",
      isActive: true,
    },
  });

  // Funciones para manejar múltiples campos
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

  // Función para manejar edición de producto
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditMode(true);
    
    // Poblar el formulario con los datos del producto
    productForm.reset({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() || undefined,
      imageUrl: product.imageUrl || undefined,
      reference: product.reference || "",
      stock: product.stock || 0,
      categoryId: product.categoryId || undefined,
      brandId: product.brandId || undefined,
      isFlashSale: product.isFlashSale || false,
      isFeatured: product.isFeatured || false,
      images: product.images || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
    });
    
    // Poblar estados auxiliares
    setProductImages(product.images || []);
    setProductSizes(product.sizes || []);
    setProductColors(product.colors || []);
    
    setProductDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setIsEditMode(false);
    productForm.reset();
    setProductImages([]);
    setProductSizes([]);
    setProductColors([]);
    setProductDialogOpen(false);
  };

  // Mutaciones
  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => {
      // Asegurar que las imágenes adicionales se incluyan en los datos
      const productData = {
        ...data,
        price: "1", // Precio predeterminado, el precio real se da por WhatsApp
        originalPrice: null,
        discountPercentage: 0,
        images: productImages.filter(img => img.trim() !== ""),
        sizes: productSizes,
        colors: productColors,
      };
      console.log("Datos completos del producto a enviar:", productData);
      console.log("ImageURL principal:", data.imageUrl);
      console.log("Imágenes adicionales:", productImages);
      return apiRequest("POST", "/api/products", productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      productForm.reset();
      setProductImages([]);
      setProductSizes([]);
      setProductColors([]);
      toast({ title: "¡Éxito!", description: "Producto publicado correctamente con todas sus imágenes" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Error al crear el producto";
      console.error("Error creando producto:", error); // Debug
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => {
      if (!editingProduct) throw new Error("No hay producto para editar");
      
      const productData = {
        ...data,
        price: "1", // Precio predeterminado, el precio real se da por WhatsApp
        originalPrice: null,
        discountPercentage: 0,
        images: productImages.filter(img => img.trim() !== ""),
        sizes: productSizes,
        colors: productColors,
      };
      console.log("Actualizando producto:", editingProduct.id, productData);
      return apiRequest("PUT", `/api/products/${editingProduct.id}`, productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
      setIsEditMode(false);
      productForm.reset();
      setProductImages([]);
      setProductSizes([]);
      setProductColors([]);
      toast({ title: "¡Éxito!", description: "Producto actualizado correctamente" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Error al actualizar el producto";
      console.error("Error actualizando producto:", error);
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const createPromotionMutation = useMutation({
    mutationFn: (data: PromotionFormData) => apiRequest("POST", "/api/promotions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      setPromotionDialogOpen(false);
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
      setEventDialogOpen(false);
      eventForm.reset();
      toast({ title: "Éxito", description: "Evento creado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al crear el evento", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/products/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Éxito", description: "Producto eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al eliminar el producto", variant: "destructive" });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/promotions/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Éxito", description: "Promoción eliminada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al eliminar la promoción", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/events/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Éxito", description: "Evento eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al eliminar el evento", variant: "destructive" });
    },
  });

  const createBrandMutation = useMutation({
    mutationFn: (data: BrandFormData) => apiRequest("POST", "/api/brands", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setBrandDialogOpen(false);
      brandForm.reset();
      toast({ title: "Éxito", description: "Marca creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la marca", variant: "destructive" });
    },
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

      <Tabs defaultValue="products" className="space-y-2 sm:space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="products" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-products">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Productos</span>
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
        </TabsList>

        {/* Panel de Productos */}
        <TabsContent value="products" className="space-y-2 sm:space-y-4">
          <div className="flex justify-between items-center mb-2 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-semibold">Gestión de Productos</h2>
            <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-10 text-xs sm:text-sm" data-testid="button-add-product">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Agregar Producto</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Editar Producto" : "Agregar Nuevo Producto"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode 
                      ? "Modifica los detalles del producto que desees actualizar"
                      : "Completa todos los detalles del producto incluyendo imágenes, tallas y colores"
                    }
                  </DialogDescription>
                </DialogHeader>
                <Form {...productForm}>
                  <form onSubmit={productForm.handleSubmit((data) => {
                    if (isEditMode) {
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

                    {/* Stock */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                      <FormField
                        control={productForm.control}
                        name="stock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={field.value || 0} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-product-stock" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Categoría y Marca */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <FormField
                        control={productForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoría *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            >
                              Subir imagen principal
                            </ObjectUploader>
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
                            >
                              <div className="flex flex-col items-center gap-2">
                                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                                <span>Agregar primera imagen adicional</span>
                              </div>
                            </ObjectUploader>
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
                            >
                              <div className="flex items-center justify-center gap-2">
                                <ImagePlus className="h-4 w-4" />
                                <span>Agregar otra imagen ({productImages.length}/9)</span>
                              </div>
                            </ObjectUploader>
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
                      <Button type="button" variant="outline" onClick={isEditMode ? handleCancelEdit : () => setProductDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isEditMode ? updateProductMutation.isPending : createProductMutation.isPending} 
                        data-testid="button-submit-product"
                      >
                        {isEditMode 
                          ? (updateProductMutation.isPending ? "Actualizando..." : "Actualizar Producto")
                          : (createProductMutation.isPending ? "Creando..." : "Crear Producto")
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
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
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                        data-testid={`button-edit-product-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteProductMutation.mutate(product.id)}
                        data-testid={`button-delete-product-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-semibold">{formatCurrency(product.price)}</p>
                    {product.reference && (
                      <p className="text-sm text-muted-foreground">Ref: {product.reference}</p>
                    )}
                    <div className="flex gap-2">
                      {product.isFlashSale && <Badge variant="destructive">Oferta Flash</Badge>}
                      {product.isFeatured && <Badge>Destacado</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Panel de Marcas */}
        <TabsContent value="brands" className="space-y-2 sm:space-y-4">
          <div className="flex justify-between items-center mb-2 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-semibold">Gestión de Marcas</h2>
            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-10 text-xs sm:text-sm" data-testid="button-add-brand">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Agregar Marca</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>Agregar Nueva Marca</DialogTitle>
                  <DialogDescription>
                    Crea una nueva marca para organizar los productos
                  </DialogDescription>
                </DialogHeader>
                <Form {...brandForm}>
                  <form onSubmit={brandForm.handleSubmit((data) => createBrandMutation.mutate(data))} className="space-y-4">
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
                          <FormLabel>Logo de la Marca</FormLabel>
                          <FormControl>
                            <ObjectUploader
                              onComplete={(imageUrl) => field.onChange(imageUrl)}
                              data-testid="uploader-brand-logo"
                            >
                              Subir logo de la marca
                            </ObjectUploader>
                          </FormControl>
                          {field.value && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">Logo subido: {field.value}</p>
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
                            <Input {...field} value={field.value || ""} placeholder="https://ejemplo.com/catalog" data-testid="input-brand-catalog" />
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
                        {createBrandMutation.isPending ? "Creando..." : "Crear Marca"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setBrandDialogOpen(false)}
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
                    <img 
                      src={brand.logo} 
                      alt={brand.name}
                      className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
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
                  {brand.catalogUrl && (
                    <p className="text-xs text-blue-600 truncate">
                      <a href={brand.catalogUrl} target="_blank" rel="noopener noreferrer">
                        Ver catálogo →
                      </a>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Panel de Promociones - Manteniendo el código existente */}
        <TabsContent value="promotions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Promociones</h2>
            <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
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
                                value={field.value || ""}
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
                      <Button type="button" variant="outline" onClick={() => setPromotionDialogOpen(false)}>
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
            <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
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
                            >
                              Subir imagen del evento
                            </ObjectUploader>
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
                      <Button type="button" variant="outline" onClick={() => setEventDialogOpen(false)}>
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
      </Tabs>
    </div>
  );
}