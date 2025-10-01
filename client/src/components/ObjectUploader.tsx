import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileImage, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  onComplete?: (imageUrl: string) => void;
  buttonClassName?: string;
  value?: string;
}

export function ObjectUploader({
  onComplete,
  buttonClassName,
  value,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  // DUPLICATE CHECKING FUNCTIONS REMOVED - NO DUPLICATE DETECTION (user request)

  // Función para convertir HEIC a JPEG
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      console.log('🔄 Iniciando conversión HEIC a JPEG para:', file.name);
      
      // Lazy import de heic2any
      const heic2any = await import('heic2any');
      
      // Convertir HEIC a JPEG con calidad 0.85
      const convertedBlob = await heic2any.default({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85
      }) as Blob;
      
      // Crear nuevo File a partir del Blob convertido
      const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      const convertedFile = new File([convertedBlob], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      console.log('✅ HEIC convertido exitosamente:', fileName);
      return convertedFile;
      
    } catch (error) {
      console.error('❌ Error al convertir HEIC:', error);
      throw new Error('Error al convertir imagen HEIC. Intenta guardar la imagen como JPG.');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let processedFile = file;
    let mimeType = file.type;

    // CRÍTICO: Detectar HEIC tanto por tipo MIME como por extensión
    const isHeic = file.type?.toLowerCase() === 'image/heic' || 
                   file.type?.toLowerCase() === 'image/heif' || 
                   /\.(heic|heif)$/i.test(file.name);
    
    if (isHeic) {
      // Convertir HEIC a JPEG automáticamente
      try {
        setIsConvertingHeic(true);
        toast({
          title: "Convirtiendo HEIC...",
          description: "Convirtiendo imagen de iPhone a formato compatible",
        });
        
        processedFile = await convertHeicToJpeg(file);
        mimeType = 'image/jpeg';
        
        toast({
          title: "¡Conversión exitosa!",
          description: "Imagen HEIC convertida a JPEG correctamente",
        });
      } catch (error) {
        console.error('Error al convertir HEIC:', error);
        toast({
          title: "Error de conversión",
          description: error instanceof Error ? error.message : "No se pudo convertir el archivo HEIC",
          variant: "destructive",
        });
        return;
      } finally {
        setIsConvertingHeic(false);
      }
    } else if (!mimeType) {
      // Solo inferir tipo desde extensión si NO es HEIC y el tipo está vacío
      const extension = file.name.toLowerCase().split('.').pop();
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        default:
          toast({
            title: "Error",
            description: "Solo se permiten archivos de imagen (JPG, PNG, WEBP, GIF, HEIC)",
            variant: "destructive",
          });
          return;
      }
    }

    // Validar que sea una imagen
    if (!mimeType.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño del archivo
    if (processedFile.size === 0) {
      toast({
        title: "Error al seleccionar imagen",
        description: "El archivo seleccionado está vacío o no se puede leer. Intenta con otra imagen.",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (máximo 10MB) - usar el archivo procesado
    const maxSize = 10485760; // 10MB
    if (processedFile.size > maxSize) {
      toast({
        title: "Error",
        description: "El archivo es demasiado grande. Máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(processedFile);

    // Crear preview usando el archivo procesado con manejo de errores
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.onerror = () => {
      toast({
        title: "Error al leer la imagen",
        description: "No se puede acceder al archivo. Intenta seleccionar otra imagen o reinicia la aplicación.",
        variant: "destructive",
      });
      setSelectedFile(null);
      setPreview(null);
    };
    reader.readAsDataURL(processedFile);

    // NO DUPLICATE CHECKING - Ready to upload immediately
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "No hay archivo seleccionado",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      console.log("🚀 Iniciando subida directa de archivo:", selectedFile.name);

      // Verificar tamaño antes de procesar
      if (selectedFile.size === 0) {
        throw new Error("El archivo está vacío o no se puede leer");
      }

      // Convertir archivo a base64 con manejo de errores
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await selectedFile.arrayBuffer();
      } catch (readError) {
        console.error("❌ Error al leer el archivo:", readError);
        throw new Error("No se puede leer el archivo. Intenta con otra imagen.");
      }

      if (arrayBuffer.byteLength === 0) {
        throw new Error("El archivo está vacío");
      }

      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);
      
      // Determinar tipo MIME con fallback
      let mimeType = selectedFile.type;
      if (!mimeType) {
        const extension = selectedFile.name.toLowerCase().split('.').pop();
        switch (extension) {
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            break;
          case 'png':
            mimeType = 'image/png';
            break;
          case 'webp':
            mimeType = 'image/webp';
            break;
          case 'gif':
            mimeType = 'image/gif';
            break;
          default:
            mimeType = 'application/octet-stream';
        }
      }
      
      const fileData = `data:${mimeType};base64,${base64}`;
      
      // Subir directamente al servidor con hash calculado
      const uploadResponse = await fetch('/api/objects/upload-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: fileData,
          fileName: selectedFile.name,
          mimeType: mimeType,
          skipDuplicateCheck: true // No duplicate checking
        }),
      });

      // NO DUPLICATE CHECKING - Continue with upload regardless of status

      if (!uploadResponse.ok) {
        let errorText;
        try {
          const errorData = await uploadResponse.json();
          errorText = errorData.message || errorData.error || `Error ${uploadResponse.status}`;
        } catch {
          errorText = await uploadResponse.text() || `Error del servidor: ${uploadResponse.status}`;
        }
        console.error("❌ Error en subida directa:", errorText);
        throw new Error(errorText);
      }

      const { imageUrl } = await uploadResponse.json();
      console.log("✅ Imagen subida exitosamente:", imageUrl);

      toast({
        title: "¡Éxito!",
        description: "Imagen subida correctamente",
      });

      if (onComplete) {
        onComplete(imageUrl);
      }

      // Limpiar estado
      setSelectedFile(null);
      setPreview(null);
      
    } catch (error) {
      console.error('❌ Error en la subida:', error);
      
      let errorMessage = "Error al subir la imagen";
      let errorDetail = "Inténtalo de nuevo";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
          errorDetail = "Problema de conexión. Verifica tu internet.";
        } else if (error.message.includes('413')) {
          errorDetail = "El archivo es demasiado grande.";
        } else if (error.message.includes('415')) {
          errorDetail = "Formato de imagen no soportado.";
        }
      }
      
      toast({
        title: "Error al subir imagen",
        description: `${errorMessage}. ${errorDetail}`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setIsConvertingHeic(false);
  };

  return (
    <div className="space-y-4">
      {/* Selector de archivo */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={buttonClassName}
            onClick={() => document.getElementById('file-input')?.click()}
            disabled={isUploading || isConvertingHeic}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isConvertingHeic ? "Convirtiendo..." : "Seleccionar Imagen"}
          </Button>
          
          <input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Preview de la imagen seleccionada */}
        {preview && (
          <div className="relative">
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <img
                src={preview}
                alt="Preview"
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile?.name}</p>
                <p className="text-xs text-gray-500">
                  {selectedFile?.size && (selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
                
                {/* Estado de conversión HEIC */}
                {isConvertingHeic && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500"></div>
                    <span className="text-xs text-orange-500">Convirtiendo HEIC a JPEG...</span>
                  </div>
                )}
                
                {/* Ready to upload after HEIC conversion (if needed) */}
                {!isConvertingHeic && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-500">Listo para subir</span>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || isConvertingHeic}
                className="flex-1"
variant="default"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Subiendo...
                  </>
                ) : isConvertingHeic ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Convirtiendo...
                  </>
                ) : (
                  <>
                    <FileImage className="h-4 w-4 mr-2" />
                    Subir Imagen
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}