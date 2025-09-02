import { type ProductWithCategory } from "@shared/schema";
import ProductCard from "./product-card";
import { useState, useEffect } from "react";

interface FlashSaleSectionProps {
  products: ProductWithCategory[];
}

export default function FlashSaleSection({ products }: FlashSaleSectionProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 2,
    minutes: 15,
    seconds: 33
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              // Reset timer
              return { hours: 2, minutes: 15, seconds: 33 };
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (time: number) => String(time).padStart(2, '0');

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-primary" data-testid="text-flash-sale-title">
          🔥 Flash Sale - Termina pronto!
        </h3>
        <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-full font-bold" data-testid="text-countdown">
          ⏰ {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
        </div>
      </div>
      
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-flash-sale">
          No hay productos en oferta flash en este momento.
        </div>
      )}
    </section>
  );
}
