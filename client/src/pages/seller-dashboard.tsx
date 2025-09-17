import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import ProductUploadForm from "@/components/product-upload-form";
import ProductCard from "@/components/product-card";
import { type ProductWithCategory } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SellerDashboard() {
  const { data: products = [], isLoading, refetch } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const handleProductCreated = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-dashboard-title">
            Panel de Vendedor
          </h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
            Gestiona tus productos y promociones
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" data-testid="tab-upload">Subir Producto</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Mis Productos</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-upload-title">Subir Nuevo Producto</CardTitle>
                <CardDescription data-testid="text-upload-description">
                  Completa la información de tu producto para empezar a vender
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductUploadForm onProductCreated={handleProductCreated} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-products-title">Mis Productos ({products.length})</CardTitle>
                <CardDescription data-testid="text-products-description">
                  Gestiona tu inventario y precios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                        <div className="w-full h-36 bg-muted rounded-lg mb-3"></div>
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-1/2 mb-3"></div>
                        <div className="h-8 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((product) => (
                      <ProductCard key={product.id} product={product} showManageButton />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products-seller">
                    <div className="text-6xl mb-4">📦</div>
                    <h3 className="text-xl font-semibold mb-2">No tienes productos aún</h3>
                    <p className="mb-4">¡Sube tu primer producto para empezar a vender!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-products">{products.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Disponibles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-available-products">
                    {products.length}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Promedio Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-avg-rating">
                    {products.length > 0 
                      ? (products.reduce((acc, p) => acc + Number(p.rating || 0), 0) / products.length).toFixed(1)
                      : "0.0"
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
