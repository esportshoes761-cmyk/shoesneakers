// Utility para manejar ID único por cliente sin necesidad de login
// El ID se guarda en localStorage para persistir entre sesiones

import { nanoid } from "nanoid";

const CUSTOMER_ID_KEY = "zapashop-customer-id";

/**
 * Obtiene o crea un ID único para el cliente actual
 * Este ID persiste en localStorage y identifica al cliente de manera única
 */
export function getCustomerId(): string {
  try {
    let customerId = localStorage.getItem(CUSTOMER_ID_KEY);
    
    if (!customerId) {
      // Generar nuevo ID único para el cliente
      customerId = nanoid(21); // ID de 21 caracteres (más corto que UUID pero igual de único)
      localStorage.setItem(CUSTOMER_ID_KEY, customerId);
    }
    
    return customerId;
  } catch (error) {
    // Fallback en caso de que localStorage no esté disponible
    console.warn("localStorage no disponible, usando ID temporal");
    return "temp-" + nanoid(21);
  }
}

/**
 * Regenera el ID del cliente (útil para testing o reset)
 */
export function regenerateCustomerId(): string {
  try {
    const newCustomerId = nanoid(21);
    localStorage.setItem(CUSTOMER_ID_KEY, newCustomerId);
    return newCustomerId;
  } catch (error) {
    console.warn("localStorage no disponible, usando ID temporal");
    return "temp-" + nanoid(21);
  }
}

/**
 * Limpia el ID del cliente (útil para testing)
 */
export function clearCustomerId(): void {
  try {
    localStorage.removeItem(CUSTOMER_ID_KEY);
  } catch (error) {
    console.warn("localStorage no disponible");
  }
}