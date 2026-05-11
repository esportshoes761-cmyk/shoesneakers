import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { api } from '@/services/mockApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts);
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await api.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestión de Productos</h1>
        <Button asChild>
          <Link to="/marketing/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{product.brand}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">${product.price}</p>
                <p className="text-sm">Stock: {product.stock}</p>
                <p className="text-sm">Categoría: {product.category}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link to="/marketing/bulk-upload">
            Carga Masiva de Productos
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default ProductManagement;