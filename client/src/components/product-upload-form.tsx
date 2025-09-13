import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertProductSchema, type Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Upload, X } from "lucide-react";
import { z } from "zod";

const productFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  imageUrl: z.string().url("Ingresa una URL válida de imagen"),
  price: z.string().min(1, "El precio es requerido"),
  originalPrice: z.string().optional(),
  stock: z.string().min(1, "El stock es requerido"),
  discountPercentage: z.string().optional(),
  isFlashSale: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  rating: z.string().optional(),
  reviewCount: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductUploadFormProps {
  onProductCreated?: () => void;
}

export default function ProductUploadForm({ onProductCreated }: ProductUploadFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      stock: "",
      discountPercentage: "",
      imageUrl: "",
      categoryId: "",
      isFlashSale: false,
      isFeatured: false,
      rating: "0",
      reviewCount: "0",
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const productData = {
        ...data,
        price: data.price,
        originalPrice: data.originalPrice || null,
        stock: parseInt(data.stock),
        discountPercentage: data.discountPercentage ? parseInt(data.discountPercentage) : 0,
        rating: data.rating,
        reviewCount: parseInt(data.reviewCount || "0"),
        sellerId: "default-seller", // In a real app, this would come from auth
      };
      
      const response = await apiRequest("POST", "/api/products", productData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Producto creado!",
        description: "Tu producto se ha subido exitosamente",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      onProductCreated?.();
    },
    onError: async (error) => {
      console.error("Product creation error:", error);
      
      // Handle different types of errors
      let title = "Error";
      let description = "No se pudo crear el producto";
      
      // Check if it's a Response object (from apiRequest)
      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          
          // Handle 409 duplicate errors specifically
          if (error.status === 409) {
            title = "Producto duplicado";
            description = errorData.message || errorData.error || "Ya existe un producto con este nombre";
          } else if (error.status === 400) {
            title = "Datos inválidos";
            description = errorData.message || "Por favor verifica los datos del producto";
          } else {
            description = errorData.message || errorData.error || description;
          }
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
        }
      } else if (error?.message) {
        description = error.message;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(data);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    // In a real app, this would handle file upload
    toast({
      title: "Funcionalidad de subida",
      description: "En una aplicación real, aquí se subirían las imágenes",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Basic Information */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Nike Air Max 270" 
                      {...field} 
                      data-testid="input-product-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe las características de tu producto..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-product-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
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
          </div>

          {/* Image Upload */}
          <div>
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imagen del Producto</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input 
                        placeholder="URL de la imagen" 
                        {...field}
                        data-testid="input-image-url"
                      />
                      <Card 
                        className={`border-2 border-dashed transition-colors ${
                          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                          <Upload className="w-10 h-10 text-muted-foreground mb-4" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Arrastra y suelta tu imagen aquí
                          </p>
                          <p className="text-xs text-muted-foreground">
                            o ingresa la URL arriba
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pricing and Stock */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="99.99" 
                    type="number" 
                    step="0.01"
                    {...field}
                    data-testid="input-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="originalPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Original (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="149.99" 
                    type="number" 
                    step="0.01"
                    {...field}
                    data-testid="input-original-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="50" 
                    type="number"
                    {...field}
                    data-testid="input-stock"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discountPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descuento (%)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="25" 
                    type="number"
                    {...field}
                    data-testid="input-discount"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Product Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="isFlashSale"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Flash Sale</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Incluir en las ofertas flash
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-flash-sale"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Producto Destacado</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Mostrar en la sección de destacados
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-featured"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={createProductMutation.isPending}
          data-testid="button-submit-product"
        >
          {createProductMutation.isPending ? (
            <>
              <i className="fas fa-spinner animate-spin mr-2"></i>
              Subiendo Producto...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Subir Producto
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
