import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileImage, AlertTriangle, Check, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface UploadedImage {
  id: string;
  url: string;
  fileName: string;
  isUploading?: boolean;
  error?: string;
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

  // Función para subir una imagen individual
  const uploadSingleImage = async (file: File): Promise<string> => {
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

    // Convertir a base64
    const arrayBuffer = await processedFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    const fileData = `data:${processedFile.type};base64,${base64}`;

    // Subir al servidor con mejor logging para debug
    console.log('📤 Uploading image:', processedFile.name, 'Size:', processedFile.size);
    
    const response = await fetch('/api/objects/upload-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: fileData,
        fileName: processedFile.name,
        mimeType: processedFile.type,
        skipDuplicateCheck: true // Permitir "duplicados" en packages
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

  // Manejar selección de múltiples archivos
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

    // Crear entradas temporales para mostrar el progreso
    const tempImages = files.map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      url: '',
      fileName: file.name,
      isUploading: true,
    }));

    setImages(prev => [...prev, ...tempImages]);

    let completedUploads = 0;
    const newImageUrls: string[] = [];

    // Subir imágenes en paralelo (máximo 3 simultáneas)
    const uploadPromises = files.map(async (file, index) => {
      try {
        const imageUrl = await uploadSingleImage(file);
        newImageUrls.push(imageUrl);
        
        // Actualizar el estado de la imagen
        setImages(prev => prev.map(img => 
          img.id === tempImages[index].id 
            ? { ...img, url: imageUrl, isUploading: false }
            : img
        ));

        completedUploads++;
        setUploadProgress((completedUploads / files.length) * 100);

        return imageUrl;
      } catch (error) {
        // Marcar como error
        setImages(prev => prev.map(img => 
          img.id === tempImages[index].id 
            ? { ...img, error: error instanceof Error ? error.message : 'Error desconocido', isUploading: false }
            : img
        ));
        
        completedUploads++;
        setUploadProgress((completedUploads / files.length) * 100);
        
        // Log detallado del error para debugging
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error uploading ${file.name}:`, {
          error: errorMsg,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        return null;
      }
    });

    try {
      await Promise.all(uploadPromises);
      
      const successfulUploads = newImageUrls.filter(Boolean);
      if (successfulUploads.length > 0) {
        toast({
          title: "¡Imágenes subidas!",
          description: `${successfulUploads.length} de ${files.length} imágenes subidas correctamente`,
        });
      }

      // Notificar cambios
      const allUrls = images
        .filter(img => img.url && !img.error)
        .map(img => img.url)
        .concat(successfulUploads);
      onImagesChange(allUrls);

    } catch (error) {
      toast({
        title: "Error en la subida",
        description: "Algunas imágenes no se pudieron subir",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Limpiar el input
      event.target.value = '';
    }
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

      {/* Indicador de estado */}
      <div className="flex items-center gap-2 text-sm">
        {isMinimumMet ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-green-600">Suficientes imágenes para crear paquete</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-orange-600">
              Necesitas al menos {minImages - validImages.length} imágenes más
            </span>
          </>
        )}
      </div>

      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative aspect-square border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
            >
              {image.isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : image.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 p-2">
                  <AlertTriangle className="h-6 w-6 text-red-500 mb-1" />
                  <p className="text-xs text-red-600 text-center">{image.error}</p>
                </div>
              ) : image.url ? (
                <img
                  src={image.url}
                  alt={image.fileName}
                  className="w-full h-full object-cover"
                />
              ) : null}
              
              {/* Botón de eliminar */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => removeImage(image.id)}
                disabled={image.isUploading}
              >
                <X className="h-3 w-3" />
              </Button>

              {/* Nombre del archivo */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                {image.fileName}
              </div>
            </div>
          ))}
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