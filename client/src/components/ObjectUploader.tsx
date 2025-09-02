import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (imageUrl: string) => void;
  buttonClassName?: string;
  children?: ReactNode;
  accept?: string;
  allowDirectUrl?: boolean; // Nueva opción para permitir URLs directas
}

/**
 * Componente para subir archivos que se renderiza como un botón y proporciona una interfaz
 * para la gestión de archivos.
 * 
 * Características:
 * - Se renderiza como un botón personalizable que abre un selector de archivos
 * - Proporciona previsualización de imágenes
 * - Muestra progreso de subida
 * - Maneja subida directa al almacenamiento en la nube
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB por defecto
  onComplete,
  buttonClassName,
  children,
  accept = "image/*",
  allowDirectUrl = true, // Por defecto permitir URLs directas
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamaño del archivo
    if (file.size > maxFileSize) {
      toast({
        title: "Error",
        description: `El archivo es demasiado grande. Máximo ${Math.round(maxFileSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    // Validar tipo de archivo
    if (accept === "image/*" && !file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Crear previsualización
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // 1. Obtener URL de subida del backend
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        throw new Error('Error al obtener URL de subida');
      }

      const { uploadURL } = await uploadResponse.json();

      // 2. Subir archivo directamente al almacenamiento
      const uploadFileResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadFileResponse.ok) {
        throw new Error('Error al subir archivo');
      }

      // 3. Obtener la ruta normalizada del objeto
      const objectPath = uploadURL.replace('https://storage.googleapis.com', '');
      const normalizedPath = `/objects${objectPath.split('/uploads/')[1]}`;

      toast({
        title: "¡Éxito!",
        description: "Imagen subida correctamente",
      });

      if (onComplete) {
        onComplete(normalizedPath);
      }

      // Limpiar estado
      setSelectedFile(null);
      setPreview(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Error al subir la imagen",
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

  const handleUrlSubmit = () => {
    if (!urlValue.trim()) return;
    
    // Validar que sea una URL válida
    try {
      new URL(urlValue);
      onComplete?.(urlValue);
      setUrlValue("");
      setShowUrlInput(false);
      toast({
        title: "¡Éxito!",
        description: "URL de imagen agregada correctamente",
      });
    } catch {
      toast({
        title: "Error",
        description: "Por favor ingresa una URL válida",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {!selectedFile && !showUrlInput ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              data-testid="input-file-upload"
            />
            <Button
              type="button"
              variant="outline"
              className={buttonClassName}
              onClick={() => document.getElementById('file-upload')?.click()}
              data-testid="button-select-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              {children || "Subir archivo"}
            </Button>
            {allowDirectUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUrlInput(true)}
                data-testid="button-url-input"
              >
                URL directa
              </Button>
            )}
          </div>
        </div>
      ) : showUrlInput ? (
        <div className="space-y-2">
          <Input
            type="url"
            placeholder="https://ejemplo.com/imagen.jpg"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            data-testid="input-image-url"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleUrlSubmit}
              data-testid="button-submit-url"
            >
              Agregar URL
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUrlInput(false);
                setUrlValue("");
              }}
              data-testid="button-cancel-url"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Previsualización */}
          {preview ? (
            <div className="relative border rounded-lg p-2">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-32 object-cover rounded"
                data-testid="img-preview"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 p-3 border rounded-lg">
              <FileImage className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium" data-testid="text-filename">{selectedFile?.name}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-filesize">
                  {selectedFile ? Math.round(selectedFile.size / 1024) : 0} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                data-testid="button-clear-file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex space-x-2">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
              data-testid="button-upload"
            >
              {isUploading ? "Subiendo..." : "Subir imagen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearSelection}
              disabled={isUploading}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}