import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileImage } from "lucide-react";
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
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    // Crear preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      console.log("🚀 Iniciando subida directa de archivo:", selectedFile.name);

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
      
      // Subir directamente al servidor
      const uploadResponse = await fetch('/api/objects/upload-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: fileData,
          fileName: selectedFile.name,
          mimeType: selectedFile.type
        }),
      });

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
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Subiendo...
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