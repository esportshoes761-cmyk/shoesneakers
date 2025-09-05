import { Button } from "@/components/ui/button";

export default function PromotionalBanners() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg sm:rounded-xl p-3 sm:p-6 text-white">
        <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2" data-testid="text-catalog-title">👟 Catálogo Premium</h3>
        <p className="mb-2 sm:mb-4 text-xs sm:text-base" data-testid="text-catalog-description">Las mejores marcas al mejor precio</p>
        <Button 
          size="sm"
          className="bg-white text-blue-600 hover:bg-gray-100 font-bold rounded-full h-7 sm:h-10 text-xs sm:text-sm"
          data-testid="button-browse-catalog"
        >
          Explorar
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-lg sm:rounded-xl p-3 sm:p-6 text-white">
        <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2" data-testid="text-quality-title">⭐ Calidad Garantizada</h3>
        <p className="mb-2 sm:mb-4 text-xs sm:text-base" data-testid="text-quality-description">Productos originales y auténticos</p>
        <Button 
          size="sm"
          className="bg-white text-red-600 hover:bg-gray-100 font-bold rounded-full h-7 sm:h-10 text-xs sm:text-sm"
          data-testid="button-learn-quality"
        >
          Conocer Más
        </Button>
      </div>
    </div>
  );
}
