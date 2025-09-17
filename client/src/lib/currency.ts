// Utilidades para manejo de moneda colombiana (COP)

export function formatCurrency(amount: string | number): string {
  // Handle null, undefined, or empty values
  if (!amount || amount === '' || amount === '0' || amount === 0) {
    return '$0';
  }
  
  // Convert to number safely
  const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
  
  // Check for invalid numbers
  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    console.warn('formatCurrency: Invalid amount received:', amount);
    return '$0';
  }
  
  // Formatear con separadores de miles usando punto
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(numericAmount);
  
  return `$${formatted}`;
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