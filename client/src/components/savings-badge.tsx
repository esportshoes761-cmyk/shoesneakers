import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingDown } from "lucide-react";

interface SavingsBadgeProps {
  savingsAmount: number;
  discountPercentage?: number;
  className?: string;
  showAnimation?: boolean;
}

export function SavingsBadge({ 
  savingsAmount, 
  discountPercentage, 
  className = "",
  showAnimation = false 
}: SavingsBadgeProps) {
  if (savingsAmount <= 0) return null;

  return (
    <div className={`relative ${className}`}>
      <Badge 
        variant="destructive" 
        className={`
          bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700
          text-white font-bold shadow-lg border-none
          ${showAnimation ? 'animate-bounce' : ''}
        `}
      >
        <TrendingDown className="w-3 h-3 mr-1" />
        ¡Ahorra {formatCurrency(savingsAmount)}!
        {discountPercentage && discountPercentage > 0 && (
          <span className="ml-1">(-{discountPercentage}%)</span>
        )}
      </Badge>
      
      {showAnimation && (
        <div className="absolute -top-1 -right-1 animate-pulse">
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </div>
      )}
    </div>
  );
}