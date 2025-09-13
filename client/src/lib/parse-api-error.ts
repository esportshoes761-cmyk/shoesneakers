/**
 * Parses API error responses and returns appropriate error messages
 */
export interface ParsedError {
  title: string;
  description: string;
}

export async function parseApiError(error: any, defaultMessage = "Ha ocurrido un error"): Promise<ParsedError> {
  let title = "Error";
  let description = defaultMessage;
  
  try {
    // Check if it's a Response object (from apiRequest)
    if (error instanceof Response) {
      try {
        const errorData = await error.json();
        
        // Handle specific status codes
        switch (error.status) {
          case 409: // Conflict - Duplicate
            title = "Producto duplicado";
            description = errorData.message || errorData.error || "Ya existe un producto con este nombre";
            break;
          case 400: // Bad Request
            title = "Datos inválidos";
            description = errorData.message || errorData.error || "Por favor verifica los datos ingresados";
            break;
          case 401: // Unauthorized
            title = "No autorizado";
            description = errorData.message || errorData.error || "No tienes permisos para realizar esta acción";
            break;
          case 403: // Forbidden
            title = "Acceso denegado";
            description = errorData.message || errorData.error || "No tienes suficientes permisos";
            break;
          case 404: // Not Found
            title = "No encontrado";
            description = errorData.message || errorData.error || "El recurso solicitado no existe";
            break;
          case 422: // Unprocessable Entity
            title = "Error de validación";
            description = errorData.message || errorData.error || "Los datos no son válidos";
            break;
          case 500: // Internal Server Error
            title = "Error del servidor";
            description = errorData.message || errorData.error || "Error interno del servidor";
            break;
          default:
            description = errorData.message || errorData.error || description;
            break;
        }
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
        // Fallback to status-based error message
        if (error.status === 409) {
          title = "Producto duplicado";
          description = "Ya existe un producto con este nombre";
        }
      }
    } else if (error?.message) {
      // Handle regular Error objects
      description = error.message;
    }
  } catch (e) {
    console.error("Error parsing API error:", e);
  }

  return { title, description };
}