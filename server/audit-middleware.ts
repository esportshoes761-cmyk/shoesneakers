import type { Request, Response, NextFunction } from "express";
import { AuditActionCodes, type InsertAuditEvent } from "@shared/schema";
import { storage } from "./storage";

// Privacy-focused IP truncation
function truncateIp(ip: string): string {
  if (!ip) return '';
  // IPv4 truncation to /24 subnet for privacy
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  // IPv6 truncation to /48 subnet for privacy  
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:${parts[2]}::`;
  }
  return ip;
}

// User agent hashing for privacy
function hashUserAgent(userAgent: string): string {
  if (!userAgent) return '';
  // Simple hash for user agent (could use crypto.createHash for better security)
  return Buffer.from(userAgent).toString('base64').slice(0, 16);
}

// Automatic action code classification
function getActionCodeForRoute(method: string, path: string): number {
  // Map HTTP method + path to audit action codes
  const route = `${method} ${path}`;
  
  // Authentication routes (1xx)
  if (route.includes('/auth/login')) return AuditActionCodes.USER_LOGIN;
  if (route.includes('/auth/register')) return AuditActionCodes.USER_CREATE;
  if (route.includes('/auth/')) return AuditActionCodes.AUTH_FAILURE;
  
  // Product management (3xx)
  if (method === 'POST' && path.includes('/products')) return AuditActionCodes.PRODUCT_CREATE;
  if (method === 'PUT' && path.includes('/products')) return AuditActionCodes.PRODUCT_UPDATE;
  if (method === 'DELETE' && path.includes('/products')) return AuditActionCodes.PRODUCT_DELETE;
  if (method === 'GET' && path.includes('/products')) return AuditActionCodes.PRODUCT_VIEW;
  
  // Brand management (4xx)
  if (method === 'POST' && path.includes('/brands')) return AuditActionCodes.BRAND_CREATE;
  if (method === 'PUT' && path.includes('/brands')) return AuditActionCodes.BRAND_UPDATE;
  if (method === 'DELETE' && path.includes('/brands')) return AuditActionCodes.BRAND_DELETE;
  if (method === 'GET' && path.includes('/brands')) return AuditActionCodes.BRAND_VIEW;
  
  // Cart & Orders (5xx)
  if (method === 'POST' && path.includes('/cart')) return AuditActionCodes.CART_ADD;
  if (method === 'DELETE' && path.includes('/cart')) return AuditActionCodes.CART_REMOVE;
  if (method === 'POST' && path.includes('/orders')) return AuditActionCodes.ORDER_CREATE;
  if (method === 'PUT' && path.includes('/orders')) return AuditActionCodes.ORDER_UPDATE;
  
  // File operations (6xx)
  if (method === 'POST' && (path.includes('/upload') || path.includes('/images'))) {
    return 601; // FILE_UPLOAD
  }
  
  // Default to API_CALL for other API routes
  return 703; // API_CALL
}

// Main audit logging middleware
export async function auditLogger(req: Request, res: Response, next: NextFunction) {
  // Skip non-API routes and static files
  if (!req.path.startsWith('/api') || req.path.includes('/images/')) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Capture original res.json to get response data
  const originalJson = res.json;
  let responseData: any = null;
  
  res.json = function(body: any) {
    responseData = body;
    return originalJson.call(this, body);
  };
  
  res.on('finish', () => {
    // Async logging - don't block the response
    setImmediate(async () => {
      try {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Extract session info if available
        let actorType = 'anonymous';
        let actorId: string | null = null;
        let sessionId = 'no-session';
        
        const userSession = req.headers['x-user-session'] as string;
        if (userSession) {
          try {
            const userData = JSON.parse(userSession);
            actorId = userData.id;
            actorType = userData.isAdmin ? 'admin' : 'client';
            sessionId = `user-${actorId}`;
          } catch {
            actorType = 'anonymous';
          }
        }
        
        // Determine result based on status code
        let result = 'success';
        if (res.statusCode >= 400 && res.statusCode < 500) {
          result = 'denied';
        } else if (res.statusCode >= 500) {
          result = 'error';
        }
        
        // Get action code for this route
        const actionCode = getActionCodeForRoute(req.method, req.path);
        
        // Create audit event
        const auditEvent: InsertAuditEvent = {
          actorType,
          actorId,
          sessionId,
          ipTruncated: truncateIp(req.ip || req.connection.remoteAddress || ''),
          userAgentHash: hashUserAgent(req.get('User-Agent') || ''),
          actionCode,
          resourceType: 'api',
          resourceId: req.path,
          result,
          latencyMs: latency,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode.toString(),
            hasResponse: responseData ? 'true' : 'false',
            timestamp: endTime.toString()
          } as any
        };
        
        // Log asynchronously without blocking
        await storage.createAuditEvent(auditEvent);
      } catch (error) {
        // Silent fail for audit logging - don't affect the application
        console.error('🔴 Audit logging error:', error);
      }
    });
  });
  
  next();
}