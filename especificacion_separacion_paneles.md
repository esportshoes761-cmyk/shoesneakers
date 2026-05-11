# Especificación Técnica para Separación de Paneles de Administración

## 1. Resumen Ejecutivo

Esta especificación propone la separación del panel de administración actual en dos paneles especializados: el **Administrador Marketing** (versión mejorada del panel existente, preservando diseño y UX) y el **Administrador Emulador** (nuevo panel para auditoría y control en tiempo real). Esta división mejora la seguridad, permite una gestión más granular de permisos y facilita el cumplimiento normativo, sin alterar la experiencia actual del usuario en el panel Marketing. Los beneficios incluyen mejor control de accesos, auditoría completa y reducción de riesgos operativos.

## 2. Definición de Roles y Permisos

### Administrador Marketing
- Crear, editar y eliminar productos
- Gestionar paquetes y marcas
- Ajustar precios y lotes
- Subir imágenes por lote
- Asignar premios
- Ver solicitudes de clientes
- Consultar informes de ventas e inventario
- Exportar datos (CSV/XLS/PDF)
- Configurar promociones
- Ver logs de cambios en productos

### Administrador Emulador
- Ver accesos en tiempo real por IP, usuario y dispositivo
- Reproducir sesiones de usuarios (clickstream)
- Banear o suspender usuarios
- Cambiar contraseñas y credenciales
- Emitir alertas con hasta 3 botones accionables (ej. forzar actualización, descargar paquete, redirigir)
- Configurar reglas de retención de logs
- Gestionar accesos por IP/país
- Visualizar auditoría histórica con filtros

### Roles Secundarios
- **Editor de Marketing**: Permisos de lectura y edición limitada en productos y precios (sin eliminación)
- **Auditor de Seguridad**: Solo lectura en logs y auditoría, sin acciones de control

## 3. Mapeo de Funciones del Panel Admin Actual

| Función Actual | Asignado a | Estado | Notas |
|---------------|------------|--------|-------|
| CRUD productos | Marketing | Mantener y mejorar | Agregar bulk uploads |
| Gestión marcas | Marketing | Mantener | |
| Control precios | Marketing | Mantener | |
| Subida imágenes | Marketing | Mantener | |
| Ver solicitudes clientes | Marketing | Mantener | |
| Informes ventas | Marketing | Mantener | |
| Inventario | Marketing | Mantener | |
| Exportaciones | Marketing | Mantener | |
| Promociones | Marketing | Mantener | |
| Logs cambios | Ambos | Mejorar en Marketing, nuevo en Emulador | Marketing: logs de productos; Emulador: auditoría usuarios |
| Accesos IP | Emulador | Nuevo | |
| Control usuarios | Emulador | Nuevo | |
| Alertas | Emulador | Nuevo | |

## 4. Funcionalidades Detalladas por Panel

### Panel Marketing (Prioridad: MV)
- **CRUD Productos**: Crear/editar/eliminar productos con campos como nombre, marca, precio, lote, imágenes. Bulk upload de lotes completos.
- **Gestión Marcas y Paquetes**: CRUD para marcas, asignación de productos a paquetes promocionales.
- **Control Precios y Promociones**: Ajustes de precios por lote, configuración de descuentos.
- **Dashboards de Ventas**: Filtros por fecha/lote/marca, gráficos de ventas e inventario.
- **Informes Exportables**: Generación de reportes en múltiples formatos.
- **Gestión Solicitudes**: Ver y responder solicitudes de clientes.
- **Logs de Cambios**: Registro de quién modificó qué producto y cuándo.

### Panel Emulador (Prioridad: MV para auditoría, F2 para controles avanzados)
- **Auditoría en Tiempo Real**: Visualización live de eventos con WebSockets.
- **Reproducción de Sesiones**: Trace completo desde primer toque, incluso sin login.
- **Alertas con Botones**: Notificaciones push con hasta 3 acciones (ej. botón 1: descargar APK, botón 2: forzar actualización, botón 3: banear usuario).
- **Control de Credenciales**: Cambio de passwords, revocación de accesos.
- **Gestión de Retención**: Configuración de cuánto tiempo almacenar logs.

## 5. Requisitos de Auditoría y Almacenamiento

### Esquema de Eventos (JSON Ejemplo)
```json
{
  "timestamp": "2026-05-11T00:51:35Z",
  "user_id": "user123", // null para anónimos
  "ip": "192.168.1.1",
  "device": "iPhone 12",
  "geolocation": "Madrid, ES",
  "screen": "/products",
  "element": "button_add_to_cart",
  "payload": {"product_id": 456, "quantity": 1},
  "action_code": 304
}
```

### Retención
- Por defecto: 90 días para eventos normales, 1 año para críticos (logins, bans).
- Configurable por Emulador.

### Índices Recomendados
- Por timestamp (particionado diario), user_id, IP, action_code.

### Privacidad
- Anonimización de IPs sensibles, enmascarado de datos PII. Cumplimiento GDPR/CCPA.

## 6. API/Endpoints y Arquitectura

### Nuevos Endpoints
- **GET /api/audit/logs**: Consulta logs filtrados.
  - Parámetros: from_date, to_date, user_id, ip
  - Respuesta: Array de eventos JSON

- **POST /api/alerts/create**: Crear alerta.
  - Body: {title, message, buttons: [{label, action}]}
  - Respuesta: {alert_id}

- **WebSocket /ws/audit/live**: Stream de eventos en tiempo real.

### Arquitectura
- Uso de Kafka para buffering de logs, ClickHouse para almacenamiento.

## 7. Requisitos de UI/UX

### Panel Marketing
- Conservar interfaz actual: didáctica, funcional, sin cambios disruptivos.

### Panel Emulador
- **Dashboard Tiempo Real**: Lista de eventos live, filtros.
- **Visor de Sesión**: Replay con cursor.
- **Gestión Alertas**: Formulario para crear alertas con botones.

## 8. Seguridad y Control de Acceso

- 2FA obligatorio para ambos roles.
- Logging de todas las acciones críticas.
- Rate limiting en endpoints de auditoría.
- Cifrado TLS 1.3, AES-256 en reposo.

## 9. Flujo de Despliegue

- Feature flags para activar Emulador.
- Migración incremental: primero permisos, luego datos.
- Rollback: Desactivar flags y restaurar DB backup.

## 10. Métricas y Monitoreo

- Latencia logs: <100ms
- Almacenamiento: GB/día basado en volumen
- Eventos/seg: promedio y picos
- Uso alertas: tasa de clicks en botones

## 11. Casos de Uso

1. Crear promoción en Marketing: Usuario edita producto, aplica descuento, ve impacto en dashboard.
2. Detectar bot en Emulador: Filtro por IP sospechosa, banear usuario.
3. Alerta de actualización: Emulador envía notificación con botón para descargar nueva versión.
4. Auditar disputa: Reproducción de sesión para verificar acciones del cliente.

## 12. Recomendaciones Técnicas

- BD: Elasticsearch para búsqueda rápida, ClickHouse para analytics.
- Message Brokers: Kafka para logs.
- Tiempo Real: WebSockets.
- Costes: Estimar basado en volumen (ej. $X/mes por TB almacenado).

## 13. Checklist de Pruebas

- Funcionales: CRUD productos, auditoría en tiempo real.
- Seguridad: Inyección SQL, rate limiting.
- Integridad: Datos no corruptos en migración.
- Rendimiento: 1000 eventos/seg sin lag.

## 14. Datos Mínimos a Confirmar

- Lista de endpoints actuales del admin.
- Esquema BD (productos, usuarios, logs existentes).
- Volumen: usuarios/día, eventos/día.
- Retención deseada.
- Regulaciones aplicables (GDPR, etc.).