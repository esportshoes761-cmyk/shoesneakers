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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" data-testid="link-home">
              <h1 className="text-2xl font-bold text-primary cursor-pointer">👟 ZapaShop</h1>
            </Link>
            <div className="hidden md:block">
              <form onSubmit={handleSearch} className="relative">
                <Input 
                  type="text" 
                  placeholder="Buscar zapatos..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-96 pl-10 pr-4 py-2 rounded-full"
                  data-testid="input-search"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </form>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link href="/seller">
              <Button 
                variant={location === '/seller' ? 'default' : 'secondary'}
                className="rounded-full"
                data-testid="button-seller"
              >
                <Plus className="w-4 h-4 mr-2" />
                Vender
              </Button>
            </Link>
            
            {/* Botón de administrador - se muestra solo para administradores */}
            {isAdmin && (
              <Link href="/admin">
                <Button 
                  variant={location === '/admin' ? 'default' : 'outline'}
                  className="rounded-full"
                  data-testid="button-admin"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" data-testid="text-cart-count">
                  {cartItemCount}
                </span>
              )}
            </Button>
            
            {!isAdmin ? (
              <Button 
                variant="default" 
                className="rounded-full" 
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
                <User className="w-4 h-4 mr-2" />
                Login Admin
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="rounded-full" 
                onClick={() => setIsAdmin(false)}
                data-testid="button-logout"
              >
                <User className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
