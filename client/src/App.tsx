import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import SellerDashboard from "@/pages/seller-dashboard";
import AdminPanel from "@/pages/admin";
import LoginPage from "@/pages/login";
import CheckoutPage from "@/pages/checkout";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/seller" component={SellerDashboard} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/login" component={() => <LoginPage />} />
      <Route path="/admin-login" component={() => <LoginPage isAdmin={true} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
