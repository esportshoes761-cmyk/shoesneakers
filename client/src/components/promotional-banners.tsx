import { Button } from "@/components/ui/button";

export default function PromotionalBanners() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-8">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg sm:rounded-xl p-3 sm:p-6 text-white">
        <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2" data-testid="text-coupon-title">🎯 Cupón Especial</h3>
        <p className="mb-2 sm:mb-4 text-xs sm:text-base" data-testid="text-coupon-description">Extra 15% OFF en tu primera compra</p>
        <Button 
          size="sm"
          className="bg-white text-purple-600 hover:bg-gray-100 font-bold rounded-full h-7 sm:h-10 text-xs sm:text-sm"
          data-testid="button-use-coupon"
        >
          Usar Cupón
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg sm:rounded-xl p-3 sm:p-6 text-white">
        <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2" data-testid="text-shipping-title">🚚 Envío Gratis</h3>
        <p className="mb-2 sm:mb-4 text-xs sm:text-base" data-testid="text-shipping-description">En compras mayores a $150</p>
        <Button 
          size="sm"
          className="bg-white text-blue-600 hover:bg-gray-100 font-bold rounded-full h-7 sm:h-10 text-xs sm:text-sm"
          data-testid="button-learn-more"
        >
          Ver Más
        </Button>
      </div>
    </div>
  );
}
