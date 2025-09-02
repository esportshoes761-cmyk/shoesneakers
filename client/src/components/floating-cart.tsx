import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";

export default function FloatingCart() {
  const cartItemCount = useCartStore(state => state.getItemCount());
  const [location, setLocation] = useLocation();

  const handleCartClick = () => {
    setLocation("/checkout");
  };

  if (cartItemCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        size="icon"
        className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bounce-animation"
        onClick={handleCartClick}
        data-testid="button-floating-cart"
      >
        <ShoppingCart className="w-6 h-6" />
        <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold" data-testid="text-floating-cart-count">
          {cartItemCount}
        </span>
      </Button>
    </div>
  );
}
