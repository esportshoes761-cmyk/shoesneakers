import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Flame } from "lucide-react";

interface FlashSaleTimerProps {
  endTime: Date;
  className?: string;
}

export function FlashSaleTimer({ endTime, className = "" }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = endTime.getTime();
      const difference = end - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds, total: difference });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, total: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.total <= 0) {
    return null;
  }

  const isUrgent = timeLeft.total < 3600000; // Menos de 1 hora

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        bg-gradient-to-r from-red-600 to-orange-500 text-white 
        px-3 py-2 rounded-lg inline-flex items-center gap-2 
        text-sm font-bold shadow-lg ${className}
      `}
    >
      <motion.div
        animate={{ 
          scale: isUrgent ? [1, 1.2, 1] : 1,
          rotate: isUrgent ? [0, -5, 5, 0] : 0
        }}
        transition={{ 
          duration: isUrgent ? 0.5 : 0,
          repeat: isUrgent ? Infinity : 0,
          repeatType: "reverse"
        }}
      >
        <Flame className="w-4 h-4" />
      </motion.div>

      <div className="flex items-center gap-1">
        <Clock className="w-4 h-4" />
        <span>
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>

      {isUrgent && (
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-yellow-300 font-extrabold"
        >
          ¡ÚLTIMAS HORAS!
        </motion.span>
      )}
    </motion.div>
  );
}

interface ProgressBarProps {
  percentage: number;
  label?: string;
  className?: string;
}

export function DiscountProgressBar({ percentage, label, className = "" }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-xs font-medium mb-1">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="bg-gradient-to-r from-red-500 to-red-600 h-2.5 rounded-full"
        />
      </div>
    </div>
  );
}