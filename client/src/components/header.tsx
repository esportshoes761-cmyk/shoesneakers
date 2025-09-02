import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, ShoppingCart, Plus, User, Settings, LogOut, Coins } from "lucide-react";
import { useAuth, logout } from "@/hooks/useAuth";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
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
            
            {/* Sistema de autenticación */}
            {!isAuthenticated ? (
              <Link href="/login">
                <Button 
                  variant="default" 
                  size="sm"
                  className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm" 
                  data-testid="button-login"
                >
                  <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Login</span>
                </Button>
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-full h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm"
                    data-testid="button-user-menu"
                  >
                    <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">{user?.firstName || user?.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Coins className="w-3 h-3 mr-1" />
                        {user?.credits || '0'} créditos
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {user?.loyaltyLevel}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {user?.isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="w-full">
                          <Settings className="w-4 h-4 mr-2" />
                          Panel Admin
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
