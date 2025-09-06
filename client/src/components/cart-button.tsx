import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

export default function CartButton() {
  const { getTotalItems, setIsOpen } = useCartStore();
  const totalItems = getTotalItems();

  return (
    <Button
      variant="outline"
      size="sm"
      className="relative"
      onClick={() => setIsOpen(true)}
      data-testid="button-cart"
    >
      <ShoppingCart className="w-4 h-4" />
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
          {totalItems}
        </span>
      )}
      <span className="hidden sm:inline ml-2">Carrito</span>
    </Button>
  );
}