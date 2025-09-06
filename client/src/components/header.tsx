import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import CartButton from "./cart-button";
import CartModal from "./cart-modal";
import logoImage from "@assets/file_00000000693c61f594344a1f92b67023_1757040378682.png";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();

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
            <Link href="/admin-login" data-testid="link-admin-access">
              <img 
                src={logoImage} 
                alt="FastSniker" 
                className="h-8 sm:h-12 w-auto cursor-pointer hover:scale-105 transition-transform"
              />
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
            
            {/* Búsqueda móvil */}
            <div className="lg:hidden">
              <Button variant="ghost" size="sm" className="h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Botón del carrito */}
            <CartButton />
          </div>
        </div>
      </div>
      
      {/* Modal del carrito */}
      <CartModal />
    </header>
  );
}
