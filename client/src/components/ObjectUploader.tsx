import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileImage, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  onComplete?: (imageUrl: string) => void;
  buttonClassName?: string;
}

export function ObjectUploader({
  onComplete,
  buttonClassName,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateImageUrl, setDuplicateImageUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Función para calcular hash SHA-256 del archivo
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  // Función para verificar si la imagen ya existe
  const checkImageDuplicate = async (hash: string): Promise<{ exists: boolean; imageUrl?: string; message?: string }> => {
    try {
      const response = await fetch('/api/images/check-hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash }),
      });

      if (response.status === 409) {
        // Imagen duplicada
        const data = await response.json();
        return {
          exists: true,
          imageUrl: data.imageUrl,
          message: data.message || 'La imagen ya existe'
        };
      } else if (response.ok) {
        // Imagen no existe, puede proceder
        return { exists: false };
      } else {
        throw new Error(`Error ${response.status}`);
      }
    } catch (error) {
      console.error('Error checking image duplicate:', error);
      throw error;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10485760; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "El archivo es demasiado grande. Máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsDuplicate(false);
    setDuplicateImageUrl(null);

    // Crear preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Calcular hash SHA-256 y verificar duplicados
    try {
      setIsCheckingDuplicate(true);
      const hash = await calculateFileHash(file);
      setFileHash(hash);
      
      console.log('🔍 Verificando duplicado para hash:', hash);
      const duplicateCheck = await checkImageDuplicate(hash);
      
      if (duplicateCheck.exists) {
        console.log('⚠️ Imagen duplicada detectada');
        setIsDuplicate(true);
        setDuplicateImageUrl(duplicateCheck.imageUrl || null);
        
        toast({
          title: "Imagen Duplicada",
          description: duplicateCheck.message || "Esta imagen ya fue subida anteriormente",
          variant: "destructive",
        });
      } else {
        console.log('✅ Imagen no duplicada, puede proceder');
      }
    } catch (error) {
      console.error('Error al verificar duplicado:', error);
      toast({
        title: "Error",
        description: "Error al verificar la imagen. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fileHash) {
      toast({
        title: "Error",
        description: "No hay archivo seleccionado o hash no calculado",
        variant: "destructive",
      });
      return;
    }

    // No proceder si es duplicado
    if (isDuplicate) {
      toast({
        title: "No se puede subir",
        description: "Esta imagen ya existe. Selecciona una imagen diferente.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      console.log("🚀 Iniciando subida directa de archivo:", selectedFile.name, "con hash:", fileHash);

      // Convertir archivo a base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Error al leer archivo'));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer archivo'));
        reader.readAsDataURL(selectedFile);
      });

      const fileData = await fileDataPromise;
      
      // Subir directamente al servidor con hash calculado
      const uploadResponse = await fetch('/api/objects/upload-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: fileData,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          hash: fileHash // Enviar hash calculado en cliente
        }),
      });

      if (uploadResponse.status === 409) {
        // Imagen duplicada detectada en servidor
        const errorData = await uploadResponse.json();
        setIsDuplicate(true);
        setDuplicateImageUrl(errorData.imageUrl || null);
        
        toast({
          title: "Imagen Duplicada",
          description: errorData.message || "Esta imagen ya existe",
          variant: "destructive",
        });
        return;
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("❌ Error en subida directa:", errorText);
        throw new Error(`Error del servidor: ${uploadResponse.status}`);
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
      setFileHash(null);
      setIsDuplicate(false);
      setDuplicateImageUrl(null);
      
    } catch (error) {
      console.error('❌ Error en la subida:', error);
      
      let errorMessage = "Error al subir la imagen";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error al subir imagen",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setFileHash(null);
    setIsDuplicate(false);
    setDuplicateImageUrl(null);
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
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Seleccionar Imagen
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
                
                {/* Estado de verificación de duplicado */}
                {isCheckingDuplicate && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                    <span className="text-xs text-blue-500">Verificando duplicados...</span>
                  </div>
                )}
                
                {fileHash && !isCheckingDuplicate && (
                  <div className="flex items-center gap-1 mt-1">
                    {isDuplicate ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span className="text-xs text-red-500">Imagen duplicada detectada</span>
                      </>
                    ) : (
                      <>
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="text-xs text-green-500">Imagen única, lista para subir</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={isUploading || isCheckingDuplicate}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Mensaje de imagen duplicada */}
            {isDuplicate && duplicateImageUrl && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                    Esta imagen ya existe en el sistema
                  </span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Selecciona una imagen diferente para continuar.
                </p>
              </div>
            )}
            
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || isCheckingDuplicate || isDuplicate || !fileHash}
                className="flex-1"
                variant={isDuplicate ? "secondary" : "default"}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Subiendo...
                  </>
                ) : isCheckingDuplicate ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verificando...
                  </>
                ) : isDuplicate ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Imagen Duplicada
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