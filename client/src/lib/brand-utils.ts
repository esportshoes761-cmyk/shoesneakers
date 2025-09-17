// Utilidades para manejar logos de marcas

export function isEmoji(text: string): boolean {
  // Detectar si es un emoji simple (no URL) - método más simple
  const trimmed = text.trim();
  
  // Si contiene http o / es probablemente una URL
  if (trimmed.includes('http') || trimmed.includes('/')) {
    return false;
  }
  
  // Si es muy corto y no es alfanumérico, probablemente es emoji
  return trimmed.length <= 4 && !/^[a-zA-Z0-9\s]+$/.test(trimmed);
}

export function getBrandLogoType(logo: string) {
  if (!logo || logo.trim() === '') {
    return 'empty';
  }
  
  if (isEmoji(logo)) {
    return 'emoji';
  }
  
  return 'image';
}