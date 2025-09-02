// Utilidades para manejo de moneda colombiana (COP)

export function formatCurrency(amount: string | number): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericAmount);
}

export function formatPrice(amount: string | number): string {
  return formatCurrency(amount);
}

export function calculateDiscount(originalPrice: string | number, discountPercentage: number): number {
  const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice;
  return original - (original * discountPercentage / 100);
}

export function formatDiscountedPrice(originalPrice: string | number, discountPercentage: number) {
  const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice;
  const discounted = calculateDiscount(original, discountPercentage);
  
  return {
    original: formatCurrency(original),
    discounted: formatCurrency(discounted),
    savings: formatCurrency(original - discounted),
    discountPercentage
  };
}