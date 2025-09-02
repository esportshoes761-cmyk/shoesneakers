import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, ShoppingCart } from "lucide-react";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();
  const cartItemCount = useCartStore(state => state.getItemCount());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-16">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/" data-testid="link-home">
              <h1 className="text-lg sm:text-2xl font-bold text-primary cursor-pointer">👟 ZapaShop</h1>
            </Link>
            <div className="hidden lg:block">
              <form onSubmit={handleSearch} className="relative">
                <Input 
                  type="text" 
                  placeholder="Buscar zapatos..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 lg:w-96 pl-8 pr-4 py-1 rounded-full text-sm"
                  data-testid="input-search"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </form>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
            
            {/* Botón de carrito */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative h-8 w-8 sm:h-10 sm:w-10"
              data-testid="button-cart"
            >
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold text-[10px] sm:text-xs" data-testid="text-cart-count">
                  {cartItemCount}
                </span>
              )}
            </Button>
            
            {/* Botón para ir al checkout directamente */}
            <Link href="/checkout">
              <Button 
                variant="default" 
                size="sm"
                className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm bg-green-600 hover:bg-green-700" 
                data-testid="button-checkout"
              >
                <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Comprar</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
