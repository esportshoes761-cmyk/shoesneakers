import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, TrendingDown, DollarSign } from "lucide-react";

interface SavingsAnimationProps {
  savings: number;
  originalPrice: number;
  showAnimation?: boolean;
  className?: string;
}

export function SavingsAnimation({ 
  savings, 
  originalPrice, 
  showAnimation = true,
  className = "" 
}: SavingsAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const discountPercentage = Math.round((savings / originalPrice) * 100);

  useEffect(() => {
    if (showAnimation && savings > 0) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [savings, showAnimation]);

  if (savings <= 0) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Badge principal de ahorro */}
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: -12 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 10
        }}
        className="bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg"
      >
        <div className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          <span>-{discountPercentage}%</span>
        </div>
      </motion.div>

      {/* Efecto de partículas brillantes */}
      <AnimatePresence>
        {isVisible && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  scale: 0,
                  x: 0,
                  y: 0,
                  opacity: 1
                }}
                animate={{ 
                  scale: [0, 1, 0],
                  x: Math.cos(i * 60 * Math.PI / 180) * 40,
                  y: Math.sin(i * 60 * Math.PI / 180) * 40,
                  opacity: [1, 1, 0]
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 2,
                  delay: i * 0.1,
                  ease: "easeOut"
                }}
                className="absolute top-1/2 left-1/2 pointer-events-none"
                style={{ transform: 'translate(-50%, -50%)' }}
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Pulso de ahorro */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 bg-red-400 rounded-lg opacity-20 pointer-events-none"
      />
    </div>
  );
}

interface SavingsCounterProps {
  totalSavings: number;
  animated?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SavingsCounter({ 
  totalSavings, 
  animated = true,
  size = "md" 
}: SavingsCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (animated && totalSavings > 0) {
      const duration = 1000; // 1 segundo
      const steps = 30;
      const increment = totalSavings / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= totalSavings) {
          setDisplayValue(totalSavings);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(totalSavings);
    }
  }, [totalSavings, animated]);

  if (totalSavings <= 0) return null;

  const sizeClasses = {
    sm: "text-sm px-2 py-1",
    md: "text-base px-3 py-2",
    lg: "text-lg px-4 py-3"
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 200,
        damping: 15
      }}
      className={`
        bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full 
        font-bold shadow-lg inline-flex items-center gap-2 ${sizeClasses[size]}
      `}
    >
      <DollarSign className="w-4 h-4" />
      <span>
        ¡Ahorras ${Math.round(displayValue).toLocaleString('es-CO')} COP!
      </span>
      {animated && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-4 h-4" />
        </motion.div>
      )}
    </motion.div>
  );
}

interface PulsingDiscountProps {
  discountPercentage: number;
  className?: string;
}

export function PulsingDiscount({ discountPercentage, className = "" }: PulsingDiscountProps) {
  if (discountPercentage <= 0) return null;

  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        boxShadow: [
          "0 0 0 0 rgba(239, 68, 68, 0.7)",
          "0 0 0 10px rgba(239, 68, 68, 0)",
          "0 0 0 0 rgba(239, 68, 68, 0)"
        ]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`
        bg-gradient-to-r from-red-500 to-pink-500 text-white 
        px-3 py-1 rounded-full text-xs font-bold
        inline-flex items-center gap-1 ${className}
      `}
    >
      <Sparkles className="w-3 h-3" />
      <span>¡OFERTA {discountPercentage}%!</span>
    </motion.div>
  );
}