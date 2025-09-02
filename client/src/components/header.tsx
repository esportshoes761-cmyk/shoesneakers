import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Plus, User, Settings } from "lucide-react";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false); // Sistema básico de administrador
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
            <Link href="/seller">
              <Button 
                variant={location === '/seller' ? 'default' : 'secondary'}
                size="sm"
                className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm"
                data-testid="button-seller"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Vender</span>
              </Button>
            </Link>
            
            {/* Botón de administrador - se muestra solo para administradores */}
            {isAdmin && (
              <Link href="/admin">
                <Button 
                  variant={location === '/admin' ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm"
                  data-testid="button-admin"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            
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
            
            {!isAdmin ? (
              <Button 
                variant="default" 
                size="sm"
                className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm" 
                onClick={() => {
                  // Sistema simple de credenciales: hacer clic activa modo admin
                  const password = prompt("Ingresa la contraseña de administrador:");
                  if (password === "admin123") {
                    setIsAdmin(true);
                    alert("¡Bienvenido administrador!");
                  } else if (password !== null) {
                    alert("Contraseña incorrecta");
                  }
                }}
                data-testid="button-login"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm" 
                onClick={() => setIsAdmin(false)}
                data-testid="button-logout"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
