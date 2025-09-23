import { Scale, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComparisonStore } from '@/lib/comparison-store';
import { useToast } from '@/hooks/use-toast';
import type { ProductWithCategory } from '@shared/schema';

interface ComparisonButtonProps {
  product: ProductWithCategory;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'outline' | 'ghost' | 'secondary';
}

export function ComparisonButton({ product, size = 'sm', variant = 'ghost' }: ComparisonButtonProps) {
  const { addProduct, removeProduct, isProductInComparison, products } = useComparisonStore();
  const { toast } = useToast();
  
  const isInComparison = isProductInComparison(product.id);
  
  const handleClick = () => {
    if (isInComparison) {
      removeProduct(product.id);
      toast({
        title: "Producto eliminado de comparación",
        description: `${product.name} ya no está en tu lista de comparación`,
      });
    } else {
      if (products.length >= 4) {
        toast({
          title: "Límite alcanzado",
          description: "Máximo 4 productos. Se reemplazará el más antiguo.",
        });
      }
      
      addProduct(product);
      toast({
        title: "Producto agregado a comparación",
        description: `${product.name} está listo para comparar`,
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`flex items-center gap-1 ${isInComparison ? 'text-green-600' : ''}`}
      data-testid={`button-compare-${product.id}`}
    >
      {isInComparison ? (
        <Check className="h-3 w-3" />
      ) : (
        <Scale className="h-3 w-3" />
      )}
      <span className="text-xs">
        {isInComparison ? 'En comparación' : 'Comparar'}
      </span>
    </Button>
  );
}