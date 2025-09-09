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
import logoImage from "@assets/file_000000000f14622fbf39449e51c8a12e (1)_1757302271494.png";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-white via-blue-50 to-white shadow-xl border-b-2 border-primary/20">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin-login" data-testid="link-admin-access">
              <img 
                src={logoImage} 
                alt="FastSneaker" 
                className="h-10 sm:h-16 w-auto cursor-pointer hover:scale-110 transition-all duration-300 drop-shadow-lg"
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
            
            {/* Enlace de seguimiento */}
            <Link href="/seguimiento">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                📦 Seguimiento
              </Button>
              <Button variant="ghost" size="sm" className="sm:hidden h-8 w-8">
                📦
              </Button>
            </Link>
            
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
