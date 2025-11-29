import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type ProductWithCategory } from "@shared/schema";
import ProductCard from "./product-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Sparkles } from "lucide-react";

interface RecommendationsSectionProps {
  customerId: string;
}

export function RecommendationsSection({ customerId }: RecommendationsSectionProps) {
  const [isLocalStorageCustomer, setIsLocalStorageCustomer] = useState(false);

  useEffect(() => {
    // Check if customerId is from localStorage (anonymous customer)
    setIsLocalStorageCustomer(true);
  }, [customerId]);

  const { data: recommendations = [], isLoading } = useQuery<ProductWithCategory[]>({
    queryKey: [`/api/recommendations/${customerId}`],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations/${customerId}`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!customerId,
  });

  if (!isLocalStorageCustomer || recommendations.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="mb-8">
        <h3 className="text-xl sm:text-2xl font-bold mb-4 flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
          Recomendado para ti
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="w-full aspect-square bg-muted rounded mb-3"></div>
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-2xl font-bold flex items-center" data-testid="text-recommendations-title">
          <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
          ✨ Recomendado para ti
        </h3>
        <span className="text-sm text-muted-foreground" data-testid="text-recommendations-count">
          {recommendations.length} sugerencia{recommendations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {recommendations.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {recommendations.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Explora más productos para ver recomendaciones personalizadas</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
