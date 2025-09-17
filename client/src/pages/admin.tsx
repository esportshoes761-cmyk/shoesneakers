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
import type { Product, Promotion, Event, Category, Brand, BrandWithProducts } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Package, Gift, Calendar as CalendarIcon, Trash2, Edit, X, ImagePlus, LogOut, Users, Briefcase, Lightbulb, ZoomIn, Star, Truck, Eye, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useAuth, logout } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { MultiImageUploader } from "@/components/MultiImageUploader";
import { formatCurrency } from "@/lib/currency";
import { getBrandLogoType } from "@/lib/brand-utils";
import AdminOrders from "@/components/admin-orders";
import { parseApiError } from "@/lib/parse-api-error";

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

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // All state declarations first to prevent initialization order issues
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [imageZoomData, setImageZoomData] = useState<{product: Product; isOpen: boolean} | null>(null);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandProductsDialogOpen, setBrandProductsDialogOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandWithProducts | null>(null);
  const [isBrandEditMode, setIsBrandEditMode] = useState(false);
  const [pendingProductToEdit, setPendingProductToEdit] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [searchReference, setSearchReference] = useState("");
  
  // Brand package states
  const [brandPackageDialogOpen, setBrandPackageDialogOpen] = useState(false);
  const [bulkUploadImages, setBulkUploadImages] = useState<string[]>([]);
  const [bulkCreationProgress, setBulkCreationProgress] = useState<{
    isProcessing: boolean;
    currentIndex: number;
    total: number;
    results: { success: number; failed: number; errors: string[] };
  }>({ isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } });

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
      logo: "",
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

  // Check de autenticación
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
      setLocation("/admin-login");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  // Efecto para manejar secuenciado de diálogos de edición de productos
  useEffect(() => {
    if (!brandProductsDialogOpen && pendingProductToEdit) {
      // Configurar edición
      setEditingProduct(pendingProductToEdit);
      setIsEditMode(true);
      
      // Poblar el formulario con los datos del producto
      productForm.reset({
        name: pendingProductToEdit.name,
        description: pendingProductToEdit.description,
        price: pendingProductToEdit.price.toString(),
        originalPrice: pendingProductToEdit.originalPrice?.toString() || undefined,
        imageUrl: pendingProductToEdit.imageUrl || undefined,
        reference: pendingProductToEdit.reference || "",
        categoryId: pendingProductToEdit.categoryId || undefined,
        brandId: pendingProductToEdit.brandId || undefined,
        isFlashSale: pendingProductToEdit.isFlashSale || false,
        isFeatured: pendingProductToEdit.isFeatured || false,
        images: pendingProductToEdit.images || [],
        sizes: pendingProductToEdit.sizes || [],
        colors: pendingProductToEdit.colors || [],
      });
      
      // Poblar estados auxiliares
      setProductImages(pendingProductToEdit.images || []);
      setProductSizes(pendingProductToEdit.sizes || []);
      setProductColors(pendingProductToEdit.colors || []);
      
      // Usar requestAnimationFrame para diferir la apertura del diálogo
      requestAnimationFrame(() => {
        setProductDialogOpen(true);
      });
      
      // Limpiar el estado pendiente
      setPendingProductToEdit(null);
    }
  }, [brandProductsDialogOpen, pendingProductToEdit, productForm]);

  // Bulk product creation mutation - SECURE SESSION-BASED AUTH 🔒
  const bulkCreateProductsMutation = useMutation({
    mutationFn: async (data: BrandPackageFormData) => {
      // 🔒 SECURE: Use authenticated session instead of hardcoded credentials
      console.log('🔑 Sending bulk request with session-based authentication');
      const response = await apiRequest('POST', '/api/products/bulk', data);
      return response.json();
    },
    onMutate: () => {
      setBulkCreationProgress({ isProcessing: true, currentIndex: 0, total: bulkUploadImages.length, results: { success: 0, failed: 0, errors: [] } });
    },
    onSuccess: (data: { success: number; failed: number; errors: string[] }) => {
      setBulkCreationProgress(prev => ({ ...prev, isProcessing: false, results: data }));
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "¡Paquete creado exitosamente! 🎉",
        description: `Se crearon ${data.success} productos destacados. ${data.failed > 0 ? `${data.failed} fallaron.` : 'Todos aparecerán en la página principal.'}`,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      brandPackageForm.reset();
      setBulkUploadImages([]);
      setBrandPackageDialogOpen(false); // ✅ Close dialog
    },
    onError: async (error: Error) => {
      setBulkCreationProgress(prev => ({ ...prev, isProcessing: false }));
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
  const { data: brands = [] } = useQuery<BrandWithProducts[]>({ queryKey: ["/api/brands/with-products"] });
  
  // Query para productos de una marca específica
  const { data: brandProducts = [], isLoading: brandProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", "brands", selectedBrandId],
    queryFn: () => fetch(`/api/products?brands=${selectedBrandId}`).then(res => res.json()),
    enabled: !!selectedBrandId && brandProductsDialogOpen,
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
    console.log("🔥 INICIANDO EDICIÓN DE PRODUCTO:", product.name, product.id);
    
    // Cambiar a la pestaña de productos para mejor UX
    setActiveTab("products");
    
    // SIEMPRE configurar el producto a editar primero
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
    
    // Si el diálogo de productos de marca está abierto, usar secuenciado
    if (brandProductsDialogOpen) {
      console.log("🔥 CERRANDO DIÁLOGO DE MARCA Y PREPARANDO EDICIÓN");
      // Guardar el producto a editar para procesarlo cuando se cierre el diálogo
      setPendingProductToEdit(product);
      
      // Cerrar diálogo de productos de marca
      setBrandProductsDialogOpen(false);
      
      // Usar setTimeout para asegurar que el diálogo se abra después del cierre
      setTimeout(() => {
        console.log("🔥 ABRIENDO DIÁLOGO DE EDICIÓN DESPUÉS DEL TIMEOUT");
        setProductDialogOpen(true);
      }, 100);
    } else {
      console.log("🔥 ABRIENDO DIÁLOGO DE EDICIÓN DIRECTAMENTE");
      // Abrir diálogo directamente
      setProductDialogOpen(true);
    }
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

  // Función para manejar edición de marca
  const handleEditBrand = (brand: BrandWithProducts) => {
    setEditingBrand(brand);
    setIsBrandEditMode(true);
    
    // Poblar el formulario con los datos de la marca
    brandForm.reset({
      name: brand.name,
      logo: brand.logo,
      description: brand.description || "",
      catalogUrl: brand.catalogUrl || "",
      isActive: brand.isActive ?? true,
    });
    
    setBrandDialogOpen(true);
  };

  const handleCancelBrandEdit = () => {
    setEditingBrand(null);
    setIsBrandEditMode(false);
    brandForm.reset();
    setBrandDialogOpen(false);
  };

  // Mutaciones
  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => {
      // Calcular descuento si hay precio original
      const discountPercentage = data.originalPrice && data.price 
        ? calculateDiscount(data.originalPrice.toString(), data.price)
        : 0;
      
      // Asegurar que las imágenes adicionales se incluyan en los datos
      const productData = {
        ...data,
        price: data.price || "1", // Usar precio del formulario, fallback a "1"
        originalPrice: data.originalPrice || null,
        discountPercentage,
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
    onError: async (error: any) => {
      console.error("Error creando producto:", error);
      
      const { title, description } = await parseApiError(error, "Error al crear el producto");
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => {
      if (!editingProduct) throw new Error("No hay producto para editar");
      
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
      if (isBrandEditMode && editingBrand) {
        return apiRequest("PUT", `/api/brands/${editingBrand.id}`, data);
      }
      return apiRequest("POST", "/api/brands", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands/with-products"] });
      setBrandDialogOpen(false);
      setEditingBrand(null);
      setIsBrandEditMode(false);
      brandForm.reset();
      toast({ 
        title: "Éxito", 
        description: isBrandEditMode ? "Marca actualizada exitosamente" : "Marca creada exitosamente" 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: isBrandEditMode ? "No se pudo actualizar la marca" : "No se pudo crear la marca", 
        variant: "destructive" 
      });
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 sm:space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="products" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-products">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-brands">
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Marcas</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-orders">
            <Truck className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Pedidos</span>
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-promotions">
            <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Promociones</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-events">
            <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Eventos</span>
          </TabsTrigger>
          <TabsTrigger value="brand-packages" className="flex-col sm:flex-row py-2 sm:py-3 text-xs sm:text-sm" data-testid="tab-brand-packages">
            <Layers className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="mt-1 sm:mt-0">Paquetes</span>
          </TabsTrigger>
        </TabsList>

        {/* Panel de Productos */}
        <TabsContent value="products" className="space-y-2 sm:space-y-4">
          <div className="flex justify-between items-center mb-2 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-semibold">Gestión de Productos</h2>
            <Button 
              size="sm" 
              className="h-8 sm:h-10 text-xs sm:text-sm" 
              data-testid="button-add-product"
              onClick={() => setProductDialogOpen(true)}
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Agregar Producto</span>
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
                          src={(() => {
                            let imageUrl = product.imageUrl || product.images?.[0];
                            if (imageUrl && !imageUrl.startsWith('http')) {
                              imageUrl = `${window.location.origin}${imageUrl}`;
                            }
                            return imageUrl;
                          })()} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                          onClick={() => setImageZoomData({product, isOpen: true})}
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
                  <DialogTitle>{isBrandEditMode ? "Editar Marca" : "Agregar Nueva Marca"}</DialogTitle>
                  <DialogDescription>
                    {isBrandEditMode ? "Modifica la información de la marca" : "Crea una nueva marca para organizar los productos"}
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
                            />
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
                        {createBrandMutation.isPending 
                          ? (isBrandEditMode ? "Actualizando..." : "Creando...") 
                          : (isBrandEditMode ? "Actualizar Marca" : "Crear Marca")
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
                    {(brand.productCount || 0) > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBrandId(brand.id);
                          setBrandProductsDialogOpen(true);
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

        {/* Modal para ver productos de una marca */}
        <Dialog open={brandProductsDialogOpen} onOpenChange={setBrandProductsDialogOpen}>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {brandProducts.map((product) => (
                  <Card key={product.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-3">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
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
                              onClick={() => setImageZoomData({ product, isOpen: true })}
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
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setBrandProductsDialogOpen(false)}
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

        {/* Brand Packages Tab - Bulk Product Creation */}
        <TabsContent value="brand-packages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes por Marca</h2>
            <Dialog open={brandPackageDialogOpen} onOpenChange={setBrandPackageDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-brand-package">
                  <Layers className="h-4 w-4 mr-2" />
                  Crear Paquete
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>⚡ Paquete Ultra-Rápido por Marca</DialogTitle>
                  <DialogDescription>
                    Publicación ultra-simplificada: solo elige marca, categoría y fotos. Todo lo demás se auto-genera (precio, talla, descripción). ¡Cada foto = 1 producto destacado!
                  </DialogDescription>
                </DialogHeader>
                <Form {...brandPackageForm}>
                  <form onSubmit={brandPackageForm.handleSubmit((data) => {
                    console.log('🚀 Enviando paquete:', data);
                    bulkCreateProductsMutation.mutate(data);
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
                            <MultiImageUploader
                              onImagesChange={(imageUrls) => {
                                field.onChange(imageUrls);
                                setBulkUploadImages(imageUrls);
                              }}
                              minImages={1}
                              maxImages={50}
                              initialImages={field.value || []}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                    {/* Progress indicator */}
                    {bulkCreationProgress.isProcessing && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-900">Creando productos...</span>
                          <span className="text-sm text-blue-700">
                            {bulkCreationProgress.currentIndex} / {bulkCreationProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(bulkCreationProgress.currentIndex / bulkCreationProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Results */}
                    {!bulkCreationProgress.isProcessing && (bulkCreationProgress.results.success > 0 || bulkCreationProgress.results.failed > 0) && (
                      <div className={`border rounded-lg p-4 ${
                        bulkCreationProgress.results.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                      }`}>
                        <h4 className="font-medium mb-2">Resultados:</h4>
                        <div className="text-sm space-y-1">
                          <p className="text-green-700">✅ Exitosos: {bulkCreationProgress.results.success}</p>
                          {bulkCreationProgress.results.failed > 0 && (
                            <p className="text-red-700">❌ Fallidos: {bulkCreationProgress.results.failed}</p>
                          )}
                          {bulkCreationProgress.results.errors.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-red-700">Errores:</p>
                              <ul className="list-disc list-inside text-red-600 text-xs space-y-1">
                                {bulkCreationProgress.results.errors.map((error, index) => (
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
                          setBrandPackageDialogOpen(false);
                          brandPackageForm.reset();
                          setBulkUploadImages([]);
                          setBulkCreationProgress({ isProcessing: false, currentIndex: 0, total: 0, results: { success: 0, failed: 0, errors: [] } });
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={bulkCreateProductsMutation.isPending || (brandPackageForm.watch('images')?.length || 0) < 1}
                        data-testid="button-submit-brand-package"
                      >
                        {bulkCreateProductsMutation.isPending 
                          ? "Creando productos destacados..." 
                          : `Crear ${(brandPackageForm.watch('images')?.length || 0)} Productos Destacados`
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
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
      </Tabs>

      {/* Diálogo de productos movido fuera de TabsContent para resolver problemas de z-index */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
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

      {/* Modal de zoom para imágenes de productos en admin */}
      {imageZoomData && (
        <Dialog open={imageZoomData.isOpen} onOpenChange={(open) => setImageZoomData(open ? imageZoomData : null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-2">
            <DialogHeader>
              <DialogTitle>{imageZoomData.product.name}</DialogTitle>
              <DialogDescription>
                Imagen en detalle del producto - Panel Admin
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex justify-center">
              <img 
                src={(() => {
                  let imageUrl = imageZoomData.product.imageUrl || imageZoomData.product.images?.[0];
                  if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = `${window.location.origin}${imageUrl}`;
                  }
                  return imageUrl;
                })()} 
                alt={imageZoomData.product.name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                data-testid={`img-admin-zoom-${imageZoomData.product.id}`}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}