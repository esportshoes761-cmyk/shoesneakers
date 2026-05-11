import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { LogOut, BarChart3, Shield, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const menuItems = [
    {
      title: 'Panel Marketing',
      url: '/marketing',
      icon: BarChart3,
      roles: ['marketing', 'admin']
    },
    {
      title: 'Panel Emulador',
      url: '/emulator',
      icon: Shield,
      roles: ['emulator', 'admin']
    },
    {
      title: 'Configuración',
      url: '/settings',
      icon: Settings,
      roles: ['admin']
    }
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="p-4">
            <h2 className="text-lg font-semibold">Panel Admin</h2>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems
                .filter(item => item.roles.some(role => hasPermission(role as any)))
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
            <div className="mt-auto p-4">
              <Button onClick={logout} variant="outline" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto">
          <div className="p-4">
            <SidebarTrigger className="mb-4" />
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;