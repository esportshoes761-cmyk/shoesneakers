import { Button } from "@/components/ui/button";

export default function PromotionalBanners() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-xl font-bold mb-2" data-testid="text-coupon-title">🎯 Cupón Especial</h3>
        <p className="mb-4" data-testid="text-coupon-description">Extra 15% OFF en tu primera compra</p>
        <Button 
          className="bg-white text-purple-600 hover:bg-gray-100 font-bold rounded-full"
          data-testid="button-use-coupon"
        >
          Usar Cupón
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-xl p-6 text-white">
        <h3 className="text-xl font-bold mb-2" data-testid="text-shipping-title">🚚 Envío Gratis</h3>
        <p className="mb-4" data-testid="text-shipping-description">En compras mayores a $150</p>
        <Button 
          className="bg-white text-blue-600 hover:bg-gray-100 font-bold rounded-full"
          data-testid="button-learn-more"
        >
          Ver Más
        </Button>
      </div>
    </div>
  );
}
