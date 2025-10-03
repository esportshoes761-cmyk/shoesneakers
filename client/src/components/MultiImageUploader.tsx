import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileImage, AlertTriangle, Check, Loader2, Plus, Clock, AlertCircle, Hash, Package, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CryptoJS from 'crypto-js';

interface UploadedImage {
  id: string;
  url: string;
  fileName: string;
  isUploading?: boolean;
  error?: string;
  isDuplicate?: boolean;
  retryAttempt?: number; // Número de intento actual (0 = primer intento)
  maxRetries?: number; // Máximo de reintentos permitidos
  lastErrorType?: 'permission' | 'network' | 'server' | 'validation' | 'unknown'; // Tipo de error
  duplicateInfo?: {
    type: 'hash' | 'name_and_size' | 'name_only';
    reason: string;
    message: string;
    productsUsingImage?: Array<{
      productId: string;
      productName: string;
      productReference: string;
      brandId: string;
      brandName: string;
      brandLogo: string;
    }>;
  };
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  isExactDuplicate: boolean;
  isLikelyDuplicate: boolean;
  duplicateCount: number;
  duplicates: Array<{
    type: 'hash' | 'name_and_size' | 'name_only';
    match: any;
    reason: string;
    productsUsingImage?: Array<{
      productId: string;
      productName: string;
      productReference: string;
      brandId: string;
      brandName: string;
      brandLogo: string;
    }>;
  }>;
  recommendation: string;
  message: string;
  duplicateReport?: {
    totalDuplicates: number;
    totalProductsAffected: number;
    brandsSummary: Record<string, { count: number; products: string[] }>;
    detailedReport: string;
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

interface DuplicateAlert {
  id: string;
  fileName: string;
  severity: 'high' | 'medium' | 'low';
  duplicateCount: number;
  message: string;
  affectedProducts: Array<{
    productId: string;
    productName: string;
    productReference: string;
    brandId: string;
    brandName: string;
    brandLogo: string;
  }>;
  timestamp: number;
}

interface MultiImageUploaderProps {
  onImagesChange: (imageUrls: string[]) => void;
  minImages?: number;
  maxImages?: number;
  initialImages?: string[];
}

export function MultiImageUploader({
  onImagesChange,
  minImages = 10,
  maxImages = 50,
  initialImages = []
}: MultiImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>(
    initialImages.map((url, index) => ({
      id: `initial-${index}`,
      url,
      fileName: `Image ${index + 1}`,
    }))
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateAlert[]>([]);
  const { toast } = useToast();

  // Función para convertir HEIC a JPEG
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      const heic2any = await import('heic2any');
      const convertedBlob = await heic2any.default({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85
      }) as Blob;
      
      const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      return new File([convertedBlob], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
    } catch (error) {
      throw new Error('Error al convertir imagen HEIC. Guarda la imagen como JPG.');
    }
  };

  // Función para calcular SHA-256 hash de una imagen
  const calculateImageHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
          const hash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
          resolve(hash);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error reading file for hash calculation'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Función para verificar duplicados usando la API con informes detallados
  const checkForDuplicates = async (file: File): Promise<DuplicateCheckResult> => {
    try {
      // 🔐 Calculate SHA-256 hash BEFORE uploading (fast & secure)
      const hash = await calculateImageHash(file);
      
      // 🚀 NEW: Send only hash to check duplicates (much faster)
      const response = await fetch('/api/images/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash: hash,
          fileName: file.name,
          fileSize: file.size
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result: DuplicateCheckResult = await response.json();
      
      // 🚨 CREAR ALERTA PROMINENTE si se detectan duplicados
      if (result.isDuplicate && result.duplicateReport) {
        const report = result.duplicateReport;
        
        // Obtener productos afectados con referencias
        const affectedProducts: DuplicateAlert['affectedProducts'] = [];
        if (result.duplicates.length > 0 && result.duplicates[0].productsUsingImage) {
          affectedProducts.push(...result.duplicates[0].productsUsingImage);
        }
        
        // Determinar severidad basada en el número de productos afectados
        let severity: 'high' | 'medium' | 'low' = 'low';
        if (report.totalProductsAffected >= 5) severity = 'high';
        else if (report.totalProductsAffected >= 2) severity = 'medium';
        
        // Crear alerta prominente
        const duplicateAlert: DuplicateAlert = {
          id: `alert-${Date.now()}-${Math.random()}`,
          fileName: file.name,
          severity,
          duplicateCount: report.totalProductsAffected,
          message: `📸 Esta imagen ya existe en ${report.totalProductsAffected} productos de ${Object.keys(report.brandsSummary).length} marca(s)`,
          affectedProducts,
          timestamp: Date.now()
        };
        
        // Añadir alerta al estado (será muy visible en la UI)
        setDuplicateAlerts(prev => [duplicateAlert, ...prev.slice(0, 9)]); // Máximo 10 alertas
        
        // Toast breve para notificación inmediata
        toast({
          title: `🚨 ${result.isExactDuplicate ? 'DUPLICADO EXACTO' : 'POSIBLE DUPLICADO'}`,
          description: `${file.name} - Ver alerta detallada arriba ↑`,
          variant: result.isExactDuplicate ? "destructive" : "default",
          duration: 5000
        });
        
        // Log en consola para debugging
        console.log('🚨 DUPLICADO DETECTADO:', {
          archivo: file.name,
          productosAfectados: report.totalProductsAffected,
          marcas: Object.keys(report.brandsSummary),
          severidad: severity
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      // Return a safe default - allow upload but warn user
      return {
        isDuplicate: false,
        isExactDuplicate: false,
        isLikelyDuplicate: false,
        duplicateCount: 0,
        duplicates: [],
        recommendation: 'No se pudo verificar duplicados, pero se puede subir',
        message: '⚠️ No se pudo verificar duplicados - continuar con cuidado'
      };
    }
  };

  // 🛡️ FUNCIÓN PROBLEMÁTICA ELIMINADA: validateFileReference
  // Esta función causaba que TODOS los archivos fallaran
  // Se procede directamente sin esta validación como hace el sistema que funciona

  // Función para convertir archivo a base64 inmediatamente (EVITA EXPIRACION DE REFERENCIAS)
  const convertFileToBase64 = async (file: File): Promise<{ base64: string, processedFile: File }> => {
    let processedFile = file;

    // Detectar y convertir HEIC
    const isHeic = file.type?.toLowerCase() === 'image/heic' || 
                   file.type?.toLowerCase() === 'image/heif' || 
                   /\.(heic|heif)$/i.test(file.name);
    
    if (isHeic) {
      processedFile = await convertHeicToJpeg(file);
    }

    // Validar tipo de imagen
    if (!processedFile.type.startsWith('image/')) {
      throw new Error('Solo se permiten archivos de imagen');
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10485760;
    if (processedFile.size > maxSize) {
      throw new Error('El archivo es demasiado grande. Máximo 10MB');
    }

    // Convertir a base64 INMEDIATAMENTE
    const arrayBuffer = await processedFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    
    return { base64, processedFile };
  };

  // Función para subir una imagen individual usando base64 pre-convertido
  const uploadSingleImage = async (base64: string, processedFile: File, originalFileName: string, retryCount = 0): Promise<string> => {
    const fileData = `data:${processedFile.type};base64,${base64}`;

    // Subir al servidor con mejor logging para debug
    console.log('📤 Uploading image:', originalFileName, 'Size:', processedFile.size);
    
    const response = await fetch('/api/objects/upload-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: fileData,
        fileName: processedFile.name,
        mimeType: processedFile.type,
        skipDuplicateCheck: false // Activar alertas de duplicados (informativo, no bloqueante)
      }),
    });

    console.log('📡 Response status:', response.status, 'OK:', response.ok);

    if (!response.ok) {
      let errorData;
      let errorMessage;
      
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || `Error HTTP ${response.status}: ${response.statusText}`;
        console.error('❌ Server error response:', errorData);
      } catch (parseError) {
        errorMessage = `Error HTTP ${response.status}: ${response.statusText} (No se pudo parsear respuesta del servidor)`;
        console.error('❌ Failed to parse error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }

    let result;
    try {
      result = await response.json();
      console.log('✅ Upload success:', result);
    } catch (parseError) {
      console.error('❌ Failed to parse success response:', parseError);
      throw new Error('Error al procesar respuesta del servidor');
    }
    
    if (!result.imageUrl) {
      throw new Error('El servidor no devolvió una URL de imagen válida');
    }
    
    return result.imageUrl;
  };

  // Manejar selección de múltiples archivos con verificación de duplicados
  const handleFilesSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Verificar límite máximo
    if (images.length + files.length > maxImages) {
      toast({
        title: "Demasiadas imágenes",
        description: `Máximo ${maxImages} imágenes permitidas. Tienes ${images.length}, intentas agregar ${files.length}.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // 🔍 PASO 1: Verificar duplicados antes de subir (RÁPIDO)
    console.log('🔍 Verificando duplicados para', files.length, 'imágenes...');
    
    const duplicateResults: { file: File; result: DuplicateCheckResult; index: number }[] = [];
    let duplicateCheckProgress = 0;

    // Verificar duplicados en paralelo
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const duplicateResult = await checkForDuplicates(file);
        duplicateResults.push({ file, result: duplicateResult, index: i });
        
        duplicateCheckProgress++;
        setUploadProgress((duplicateCheckProgress / files.length) * 30); // 30% del progreso total
        
        // Log de verificación de duplicados
        if (duplicateResult.isDuplicate) {
          console.log(`⚠️ Duplicado detectado: ${file.name} - ${duplicateResult.message}`);
        } else {
          console.log(`✅ Imagen nueva: ${file.name}`);
        }
      } catch (error) {
        console.error(`❌ Error verificando duplicados para ${file.name}:`, error);
        // Continuar con imagen si falla la verificación
        duplicateResults.push({
          file,
          result: {
            isDuplicate: false,
            isExactDuplicate: false,
            isLikelyDuplicate: false,
            duplicateCount: 0,
            duplicates: [],
            recommendation: 'Error en verificación - continuar',
            message: '⚠️ No se pudo verificar duplicados'
          },
          index: i
        });
        duplicateCheckProgress++;
        setUploadProgress((duplicateCheckProgress / files.length) * 30);
      }
    }

    // 🔍 PASO 2: Mostrar resultados de verificación y proceder según configuración
    const exactDuplicates = duplicateResults.filter(dr => dr.result.isExactDuplicate);
    const likelyDuplicates = duplicateResults.filter(dr => dr.result.isLikelyDuplicate && !dr.result.isExactDuplicate);
    const newImages = duplicateResults.filter(dr => !dr.result.isDuplicate);

    // Mostrar resumen de verificación
    if (exactDuplicates.length > 0) {
      toast({
        title: "🚨 Duplicados Exactos Detectados",
        description: `${exactDuplicates.length} imagen(es) ya existen en el sistema. Se saltarán automáticamente.`,
        duration: 5000,
        variant: "destructive"
      });
    }

    if (likelyDuplicates.length > 0) {
      toast({
        title: "⚠️ Posibles Duplicados Detectados",
        description: `${likelyDuplicates.length} imagen(es) probablemente ya existen. Se subirán con advertencia.`,
        duration: 4000,
      });
    }

    if (newImages.length > 0) {
      toast({
        title: "✅ Imágenes Nuevas",
        description: `${newImages.length} imagen(es) son nuevas y se subirán normalmente.`,
        duration: 3000,
      });
    }

    // 🔍 PASO 3: Crear entradas temporales incluyendo información de duplicados
    const tempImages = duplicateResults.map((dr, index) => ({
      id: `temp-${Date.now()}-${index}`,
      url: '',
      fileName: dr.file.name,
      isUploading: !dr.result.isExactDuplicate, // No subir duplicados exactos
      isDuplicate: dr.result.isDuplicate,
      retryAttempt: 0,
      maxRetries: 3,
      lastErrorType: undefined,
      duplicateInfo: dr.result.isDuplicate ? {
        type: dr.result.isExactDuplicate ? 'hash' as const : 
              dr.result.isLikelyDuplicate ? 'name_and_size' as const : 'name_only' as const,
        reason: dr.result.recommendation,
        message: dr.result.message,
        productsUsingImage: dr.result.duplicates?.[0]?.productsUsingImage || []
      } : undefined,
      error: dr.result.isExactDuplicate ? 'Duplicado exacto - saltado' : undefined
    }));

    setImages(prev => [...prev, ...tempImages]);

    // 🔍 PASO 4: Subir solo las imágenes que no son duplicados exactos
    const filesToUpload = duplicateResults.filter(dr => !dr.result.isExactDuplicate);
    let completedUploads = 0;
    const newImageUrls: string[] = [];

    if (filesToUpload.length > 0) {
      // 🚀 NUEVA ESTRATEGIA: CONVERTIR TODOS LOS ARCHIVOS A BASE64 PRIMERO
      // Esto evita completamente la expiración de file references
      
      const maxRetries = 3;
      const retryDelay = 1000;
      const failedUploads: Array<{ dr: any, attempts: number, lastError?: string }> = [];
      
      // Función auxiliar para esperar
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // PASO 0: CONVERTIR TODOS LOS ARCHIVOS A BASE64 INMEDIATAMENTE
      console.log('🔄 Convirtiendo archivos a base64 para evitar expiracion de referencias...');
      const convertedFiles: Array<{ base64: string, processedFile: File, originalName: string, index: number, result: any }> = [];
      
      for (let i = 0; i < filesToUpload.length; i++) {
        const dr = filesToUpload[i];
        try {
          const { base64, processedFile } = await convertFileToBase64(dr.file);
          convertedFiles.push({
            base64,
            processedFile,
            originalName: dr.file.name,
            index: dr.index,
            result: dr.result
          });
          console.log(`✅ Convertido ${dr.file.name} (${i + 1}/${filesToUpload.length})`);
        } catch (error) {
          console.error(`❌ Error convirtiendo ${dr.file.name}:`, error);
          failedUploads.push({ 
            dr, 
            attempts: 0, 
            lastError: error instanceof Error ? error.message : String(error) 
          });
        }
        
        // Actualizar progreso de conversión
        setUploadProgress(10 + (i / filesToUpload.length) * 20); // 10-30%
      }
      
      console.log(`🎯 Archivos convertidos exitosamente: ${convertedFiles.length}/${filesToUpload.length}`);
      
      // PASO 1: Subir archivos usando base64 pre-convertido
      for (let i = 0; i < convertedFiles.length; i++) {
        const cf = convertedFiles[i];
        let uploadSuccess = false;
        let lastError: string = '';
        
        // Intentar subir con retry logic normal (ya no necesitamos reducir retries)
        for (let attempt = 0; attempt < maxRetries && !uploadSuccess; attempt++) {
          try {
            console.log(`📤 Subiendo ${cf.originalName} (${i + 1}/${convertedFiles.length}) - Intento ${attempt + 1}/${maxRetries}`);
            
            // Actualizar UI para mostrar intento actual (solo si es necesario)
            if (attempt === 0) {
              setImages(prev => prev.map(img => 
                img.id === tempImages[cf.index].id 
                  ? { ...img, retryAttempt: attempt, isUploading: true, error: undefined }
                  : img
              ));
            }
            
            // 🎯 USAR BASE64 PRE-CONVERTIDO - SIN PROBLEMAS DE FILE REFERENCE
            const imageUrl = await uploadSingleImage(cf.base64, cf.processedFile, cf.originalName, attempt);
            newImageUrls.push(imageUrl);
            
            // Actualizar el estado de la imagen como exitosa
            setImages(prev => prev.map(img => 
              img.id === tempImages[cf.index].id 
                ? { ...img, url: imageUrl, isUploading: false, error: undefined, retryAttempt: 0 }
                : img
            ));
            
            uploadSuccess = true;
            
            // Log de éxito
            const duplicateStatus = cf.result.isDuplicate ? 
              (cf.result.isLikelyDuplicate ? ' (⚠️ posible duplicado)' : ' (⚠️ nombre duplicado)') : 
              '';
            console.log(`✅ Imagen subida exitosamente: ${cf.originalName}${duplicateStatus} (intento ${attempt + 1})`);
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            lastError = errorMsg;
            
            // Categorizar tipo de error
            let errorType: 'permission' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
            if (errorMsg.includes('permission') || errorMsg.includes('could not be read')) {
              errorType = 'permission';
            } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
              errorType = 'network';
            } else if (errorMsg.includes('server') || errorMsg.includes('HTTP')) {
              errorType = 'server';
            } else if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
              errorType = 'validation';
            }
            
            // Actualizar UI con error temporal si no es el último intento
            if (attempt < maxRetries - 1) {
              setImages(prev => prev.map(img => 
                img.id === tempImages[cf.index].id 
                  ? { ...img, retryAttempt: attempt + 1, lastErrorType: errorType, isUploading: false }
                  : img
              ));
            }
            
            console.warn(`⚠️ Intento ${attempt + 1} falló para ${cf.originalName}: ${errorMsg}`);
            
            // Si no es el último intento, esperar antes del siguiente
            if (attempt < maxRetries - 1) {
              await delay(retryDelay * (attempt + 1)); // Delay progresivo normal
            }
          }
        }
        
        // Si falló todos los intentos, marcar como error
        if (!uploadSuccess) {
          const drForError = { 
            file: { name: cf.originalName, size: cf.processedFile.size, type: cf.processedFile.type },
            index: cf.index,
            result: cf.result
          };
          failedUploads.push({ dr: drForError, attempts: maxRetries, lastError });
          
          // Categorizar tipo de error final
          let finalErrorType: 'permission' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
          if (lastError.includes('permission') || lastError.includes('could not be read')) {
            finalErrorType = 'permission';
          } else if (lastError.includes('network') || lastError.includes('fetch')) {
            finalErrorType = 'network';
          } else if (lastError.includes('server') || lastError.includes('HTTP')) {
            finalErrorType = 'server';
          } else if (lastError.includes('validation') || lastError.includes('invalid')) {
            finalErrorType = 'validation';
          }
          
          setImages(prev => prev.map(img => 
            img.id === tempImages[cf.index].id 
              ? { 
                  ...img, 
                  error: `Error después de ${maxRetries} intentos: ${lastError}`, 
                  isUploading: false,
                  retryAttempt: maxRetries,
                  lastErrorType: finalErrorType
                }
              : img
          ));
          
          console.error(`❌ FALLO DEFINITIVO para ${cf.originalName} después de ${maxRetries} intentos:`, {
            error: lastError,
            fileName: cf.originalName,
            fileSize: cf.processedFile.size,
            fileType: cf.processedFile.type,
            wasDuplicate: cf.result.isDuplicate
          });
        }
        
        // Actualizar progreso
        completedUploads++;
        setUploadProgress(30 + (completedUploads / convertedFiles.length) * 70);
        
        // Pausa mínima entre archivos
        if (i < convertedFiles.length - 1) {
          await delay(50); // 50ms entre archivos
        }
      }
        
      // PASO 2: Mostrar resultados finales
      const successfulUploads = newImageUrls.filter(Boolean);
      const skippedDuplicates = exactDuplicates.length;
      
      // Mostrar notificación final detallada
      if (successfulUploads.length > 0 || skippedDuplicates > 0 || failedUploads.length > 0) {
        const title = failedUploads.length === 0 ? "🎯 Proceso Completado" : "⚠️ Proceso Completado con Errores";
        
        let description = `✅ ${successfulUploads.length} exitosas`;
        if (skippedDuplicates > 0) description += ` • 🔄 ${skippedDuplicates} duplicados saltados`;
        if (likelyDuplicates.length > 0) description += ` • ⚠️ ${likelyDuplicates.length} con advertencias`;
        if (failedUploads.length > 0) description += ` • ❌ ${failedUploads.length} fallaron`;
        
        toast({
          title,
          description,
          duration: 8000,
          variant: failedUploads.length > 0 ? "destructive" : "default"
        });
      }
      
      // Log resumen para debugging
      console.log('📊 RESUMEN DE SUBIDA:', {
        exitosas: successfulUploads.length,
        duplicadosSaltados: skippedDuplicates,
        conAdvertencias: likelyDuplicates.length,
        fallidas: failedUploads.length,
        detallesFallas: failedUploads.map(f => ({ 
          archivo: f.dr.file.name, 
          intentos: f.attempts, 
          ultimoError: f.lastError 
        }))
      });
      
      // Notificar cambios - solo URLs exitosas
      const allUrls = images
        .filter(img => img.url && !img.error)
        .map(img => img.url)
        .concat(successfulUploads);
      onImagesChange(allUrls);
    } else {
      // Todas las imágenes son duplicados exactos
      toast({
        title: "🚫 Todas las Imágenes son Duplicados",
        description: "Todas las imágenes seleccionadas ya existen en el sistema.",
        variant: "destructive",
        duration: 6000,
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
    // Limpiar el input
    event.target.value = '';
  }, [images, maxImages, onImagesChange, toast]);

  // Eliminar imagen
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      const validUrls = newImages.filter(img => img.url && !img.error).map(img => img.url);
      onImagesChange(validUrls);
      return newImages;
    });
  }, [onImagesChange]);

  // Limpiar todas las imágenes
  const clearAll = useCallback(() => {
    setImages([]);
    onImagesChange([]);
  }, [onImagesChange]);

  const validImages = images.filter(img => img.url && !img.error);
  const hasErrors = images.some(img => img.error);
  const isMinimumMet = validImages.length >= minImages;

  return (
    <div className="space-y-4">
      {/* Header con información */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Imágenes del paquete ({validImages.length}/{maxImages})
          </p>
          <p className="text-xs text-gray-500">
            Mínimo {minImages} imágenes requeridas
          </p>
        </div>
        {images.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar Todo
          </Button>
        )}
      </div>

      {/* 🚨 SECCIÓN PROMINENTE DE ALERTAS DE DUPLICADOS */}
      {duplicateAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-red-700">
              🚨 DUPLICADOS DETECTADOS ({duplicateAlerts.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDuplicateAlerts([])}
              className="ml-auto text-xs"
            >
              Limpiar Alertas
            </Button>
          </div>
          
          {duplicateAlerts.map((alert) => (
            <Card key={alert.id} className={`border-2 ${
              alert.severity === 'high' ? 'border-red-500 bg-red-50' :
              alert.severity === 'medium' ? 'border-orange-500 bg-orange-50' :
              'border-yellow-500 bg-yellow-50'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className={`h-4 w-4 ${
                      alert.severity === 'high' ? 'text-red-600' :
                      alert.severity === 'medium' ? 'text-orange-600' :
                      'text-yellow-600'
                    }`} />
                    <CardTitle className="text-sm font-semibold">
                      📁 {alert.fileName}
                    </CardTitle>
                    <Badge variant={
                      alert.severity === 'high' ? "destructive" :
                      alert.severity === 'medium' ? "default" : "secondary"
                    }>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDuplicateAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Mensaje principal */}
                  <p className={`text-sm font-medium ${
                    alert.severity === 'high' ? 'text-red-700' :
                    alert.severity === 'medium' ? 'text-orange-700' :
                    'text-yellow-700'
                  }`}>
                    {alert.message}
                  </p>
                  
                  {/* Productos afectados con información específica */}
                  {alert.affectedProducts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        📋 PRODUCTOS CON ESTA IMAGEN:
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {alert.affectedProducts.map((product, index) => (
                          <div key={product.productId} className="flex items-center gap-2 p-2 bg-white border rounded-lg">
                            {product.brandLogo && (
                              <img 
                                src={product.brandLogo} 
                                alt={product.brandName}
                                className="w-6 h-6 object-contain rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-700">
                                  {product.brandName}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 truncate">
                                {product.productName}
                              </p>
                              {product.productReference && (
                                <p className="text-xs font-mono bg-yellow-100 px-1 rounded">
                                  🔖 REF: {product.productReference}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Información adicional */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                    <span>🕒 {new Date(alert.timestamp).toLocaleTimeString()}</span>
                    <span className="font-semibold">
                      ❗ NO BLOQUEA LA CARGA - Solo informativo
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Botón de subida */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => document.getElementById('multi-file-input')?.click()}
          disabled={isUploading || images.length >= maxImages}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isUploading ? "Subiendo..." : "Agregar Imágenes"}
        </Button>
        
        <input
          id="multi-file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelect}
          className="hidden"
        />
      </div>

      {/* Barra de progreso */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-xs text-center text-gray-500">
            Subiendo imágenes... {Math.round(uploadProgress)}%
          </p>
        </div>
      )}

      {/* Indicador de estado mejorado */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {isMinimumMet ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">✅ Suficientes imágenes para crear paquete</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-orange-600">
                ⚠️ Necesitas al menos {minImages - validImages.length} imágenes más
              </span>
            </>
          )}
        </div>
        
        {/* Contador detallado de estado con información de duplicados */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                Válidas: <strong className="text-green-600">{validImages.length}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 text-blue-500" />
                Cargando: <strong className="text-blue-600">{images.filter(img => img.isUploading).length}</strong>
                {images.some(img => img.retryAttempt && img.retryAttempt > 0) && (
                  <span className="text-xs text-orange-600 ml-1">
                    ({images.filter(img => img.retryAttempt && img.retryAttempt > 0).length} reintentando)
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                Errores: <strong className="text-red-600">{images.filter(img => img.error).length}</strong>
              </span>
              {images.some(img => img.isDuplicate) && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  Duplicados: <strong className="text-orange-600">{images.filter(img => img.isDuplicate).length}</strong>
                </span>
              )}
            </div>
            <span className="text-gray-400">
              Total: {images.length}/{maxImages}
            </span>
          </div>

          {/* Leyenda de colores para duplicados */}
          {images.some(img => img.isDuplicate) && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">🎨 Leyenda de Estados:</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-400 rounded border border-gray-300"></div>
                  <span className="text-gray-600 dark:text-gray-300">✅ Nueva</span>
                </div>
                {images.some(img => img.duplicateInfo?.type === 'hash') && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded border border-gray-300"></div>
                    <span className="text-gray-600 dark:text-gray-300">🚫 Exacta</span>
                  </div>
                )}
                {images.some(img => img.duplicateInfo?.type === 'name_and_size') && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded border border-gray-300"></div>
                    <span className="text-gray-600 dark:text-gray-300">⚠️ Probable</span>
                  </div>
                )}
                {images.some(img => img.duplicateInfo?.type === 'name_only') && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded border border-gray-300"></div>
                    <span className="text-gray-600 dark:text-gray-300">⚠️ Nombre</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 Pasa el cursor sobre las imágenes con borde de color para ver detalles del duplicado
              </p>
            </div>
          )}
          
          {/* Sección de errores detallada */}
          {images.some(img => img.error) && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-300 mb-2">🚨 Errores Detallados:</p>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {images.filter(img => img.error).map((img, index) => (
                  <div key={img.id} className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-red-700 dark:text-red-300 truncate">{img.fileName}</p>
                      <p className="text-red-600 dark:text-red-400 break-words text-xs leading-tight">
                        {img.error}
                      </p>
                      {img.retryAttempt && img.retryAttempt > 0 && (
                        <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                          💢 Falló después de {img.retryAttempt} intento(s)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 Los errores de "permission problems" se resuelven automáticamente con el procesamiento secuencial
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => {
            // Determinar estilos y íconos basados en el estado de duplicado
            const getBorderColor = () => {
              if (image.isDuplicate && image.duplicateInfo) {
                switch (image.duplicateInfo.type) {
                  case 'hash': return 'border-red-500 border-2'; // Duplicado exacto
                  case 'name_and_size': return 'border-orange-400 border-2'; // Probable duplicado
                  case 'name_only': return 'border-yellow-400 border-2'; // Mismo nombre
                  default: return 'border-gray-300';
                }
              }
              return image.url && !image.error ? 'border-green-400' : 'border-gray-300';
            };

            const getStatusIcon = () => {
              if (image.isUploading) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
              if (image.error) return <AlertTriangle className="h-4 w-4 text-red-500" />;
              if (image.isDuplicate && image.duplicateInfo) {
                switch (image.duplicateInfo.type) {
                  case 'hash': return <AlertCircle className="h-4 w-4 text-red-500" />; // Duplicado exacto
                  case 'name_and_size': return <AlertTriangle className="h-4 w-4 text-orange-500" />; // Probable duplicado
                  case 'name_only': return <Clock className="h-4 w-4 text-yellow-500" />; // Mismo nombre
                  default: return <Check className="h-4 w-4 text-green-500" />;
                }
              }
              if (image.url) return <Check className="h-4 w-4 text-green-500" />;
              return <FileImage className="h-4 w-4 text-gray-400" />;
            };

            const getBackgroundColor = () => {
              if (image.isDuplicate && image.duplicateInfo) {
                switch (image.duplicateInfo.type) {
                  case 'hash': return 'bg-red-50 dark:bg-red-900/10'; // Duplicado exacto
                  case 'name_and_size': return 'bg-orange-50 dark:bg-orange-900/10'; // Probable duplicado  
                  case 'name_only': return 'bg-yellow-50 dark:bg-yellow-900/10'; // Mismo nombre
                  default: return 'bg-gray-100 dark:bg-gray-800';
                }
              }
              return 'bg-gray-100 dark:bg-gray-800';
            };

            return (
              <div
                key={image.id}
                className={`relative aspect-square border rounded-lg overflow-hidden ${getBorderColor()} ${getBackgroundColor()}`}
                data-testid={`image-card-${image.id}`}
              >
                {image.isUploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-800/90 p-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <p className="text-xs text-blue-600 text-center font-medium">
                      {image.retryAttempt && image.retryAttempt > 0 ? 
                        `Reintentando (${image.retryAttempt}/${image.maxRetries || 3})` : 
                        'Subiendo...'}
                    </p>
                    {image.retryAttempt && image.retryAttempt > 0 && (
                      <p className="text-xs text-orange-600 text-center mt-1">
                        🔄 Procesamiento secuencial
                      </p>
                    )}
                  </div>
                ) : image.error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/95 dark:bg-red-900/40 p-2">
                    <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
                    <p className="text-xs text-red-600 text-center font-medium">
                      {image.retryAttempt && image.retryAttempt > 0 ? 
                        `Error (${image.retryAttempt}/${image.maxRetries || 3} intentos)` : 
                        'Error'}
                    </p>
                    <p className="text-xs text-red-500 text-center line-clamp-3 max-w-full break-words">
                      {image.error}
                    </p>
                    {image.lastErrorType && (
                      <div className="mt-1 px-2 py-1 bg-red-100 dark:bg-red-800/50 rounded text-xs">
                        {image.lastErrorType === 'permission' ? '🔒 Permisos' :
                         image.lastErrorType === 'network' ? '🌐 Red' :
                         image.lastErrorType === 'server' ? '🖥️ Servidor' :
                         image.lastErrorType === 'validation' ? '✓ Validación' : '❓ Desconocido'}
                      </div>
                    )}
                  </div>
                ) : image.isDuplicate && image.duplicateInfo ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    {/* Mostrar imagen si existe, sino fondo informativo */}
                    {image.url ? (
                      <img
                        src={image.url}
                        alt={image.fileName}
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        {getStatusIcon()}
                        <p className="text-xs text-center font-medium mt-2">
                          {image.duplicateInfo.type === 'hash' ? '🚫 Duplicado Exacto' : 
                           image.duplicateInfo.type === 'name_and_size' ? '⚠️ Probable Duplicado' : 
                           '⚠️ Nombre Duplicado'}
                        </p>
                      </div>
                    )}
                    
                    {/* Overlay con información de duplicado */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                      image.duplicateInfo.type === 'hash' ? 'bg-red-500/80' :
                      image.duplicateInfo.type === 'name_and_size' ? 'bg-orange-500/70' :
                      'bg-yellow-500/60'
                    } text-white text-xs p-2 opacity-0 hover:opacity-100 transition-opacity overflow-y-auto`}>
                      <div className="text-center max-w-full">
                        <p className="font-semibold mb-1">{image.duplicateInfo.message}</p>
                        <p className="text-xs mb-2">{image.duplicateInfo.reason}</p>
                        
                        {/* Información de marca */}
                        {image.duplicateInfo.productsUsingImage && image.duplicateInfo.productsUsingImage.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="font-semibold text-xs">🏷️ Se repite en:</p>
                            {image.duplicateInfo.productsUsingImage.map((product, index) => (
                              <div key={product.productId} className="bg-black/30 rounded px-2 py-1 text-xs">
                                <p className="font-medium">Marca: {product.brandName}</p>
                                <p className="truncate">Producto: {product.productName}</p>
                                {product.productReference && (
                                  <p className="text-xs opacity-90">REF: {product.productReference}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : image.url ? (
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className="w-full h-full object-cover"
                    data-testid={`uploaded-image-${image.id}`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileImage className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                
                {/* Indicador de estado en la esquina superior izquierda */}
                <div className={`absolute top-1 left-1 p-1 rounded-full ${
                  image.isDuplicate && image.duplicateInfo 
                    ? image.duplicateInfo.type === 'hash' ? 'bg-red-500' :
                      image.duplicateInfo.type === 'name_and_size' ? 'bg-orange-500' :
                      'bg-yellow-500'
                    : image.url && !image.error ? 'bg-green-500' : 'bg-gray-400'
                }`}>
                  {getStatusIcon()}
                </div>
                
                {/* Botón de eliminar */}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0"
                  onClick={() => removeImage(image.id)}
                  disabled={image.isUploading}
                  data-testid={`remove-image-${image.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>

                {/* Nombre del archivo con indicador de estado */}
                <div className={`absolute bottom-0 left-0 right-0 text-white text-xs p-1 truncate ${
                  image.isDuplicate && image.duplicateInfo 
                    ? image.duplicateInfo.type === 'hash' ? 'bg-red-600/90' :
                      image.duplicateInfo.type === 'name_and_size' ? 'bg-orange-600/90' :
                      'bg-yellow-600/90'
                    : 'bg-black/50'
                }`}>
                  {image.fileName}
                  {image.isDuplicate && image.duplicateInfo && (
                    <span className="ml-1">
                      {image.duplicateInfo.type === 'hash' ? '🚫' : 
                       image.duplicateInfo.type === 'name_and_size' ? '⚠️' : '⚠️'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mensaje de ayuda */}
      {hasErrors && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          Algunas imágenes tuvieron errores. Puedes eliminarlas y volver a intentar.
        </div>
      )}
    </div>
  );
}