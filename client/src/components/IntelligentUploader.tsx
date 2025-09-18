import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, FileImage, AlertTriangle, Check, Loader2, Package, Sparkles, Eye, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import type { Brand, Category } from "@shared/schema";
import CryptoJS from 'crypto-js';

// 🚨 CLIENT-SIDE BRAND DETECTION COMPLETELY ELIMINATED
// Server is now 100% authoritative for brand detection using brand-detection.ts
// Client only handles file upload - NO brand detection logic

interface DetectedImage {
  id: string;
  file: File;
  url: string;
  fileName: string;
  detectedBrand?: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  brandId?: string;
  isUploading?: boolean;
  error?: string;
  uploadedUrl?: string;
  isUploaded?: boolean;
}

interface IntelligentUploaderProps {
  onDetectionComplete: (detections: DetectedImage[]) => void;
  maxImages?: number;
}

export function IntelligentUploader({
  onDetectionComplete,
  maxImages = 50
}: IntelligentUploaderProps) {
  const [detectedImages, setDetectedImages] = useState<DetectedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const { toast } = useToast();

  // Fetch brands and categories for mapping
  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["/api/brands/admin"]
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"]
  });

  // 🚨 BRAND DETECTION ELIMINATED - Server handles ALL brand detection
  // Client now only processes files for upload without any brand analysis

  // Convert HEIC to JPEG
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

  // Upload single image to get permanent URL
  const uploadImageFile = async (file: File): Promise<string> => {
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);
      const fileData = `data:${file.type};base64,${base64}`;

      console.log('🔄 Uploading image to permanent storage:', file.name);
      
      const response = await fetch('/api/objects/upload-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: fileData,
          fileName: file.name,
          mimeType: file.type,
          skipDuplicateCheck: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Image uploaded successfully:', result.imageUrl);
      return result.imageUrl;
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      throw error;
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newDetectedImages: DetectedImage[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue;
      if (detectedImages.length + newDetectedImages.length >= maxImages) {
        toast({
          title: "Límite alcanzado",
          description: `Máximo ${maxImages} imágenes permitidas`,
          variant: "destructive"
        });
        break;
      }

      try {
        // Convert HEIC if needed
        let processedFile = file;
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          processedFile = await convertHeicToJpeg(file);
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(processedFile);
        
        // 🚨 NO CLIENT-SIDE BRAND DETECTION - Server will handle this
        
        // Create initial detected image with preview URL
        // 🚨 NO CLIENT-SIDE BRAND DATA - Server will detect brands
        const detectedImage: DetectedImage = {
          id: crypto.randomUUID(),
          file: processedFile,
          url: previewUrl,
          fileName: processedFile.name,
          // detectedBrand: undefined, // Server will handle detection
          confidence: 'none', // Client doesn't detect brands
          // brandId: undefined, // Server will assign brand
          isUploading: true,
          isUploaded: false
        };

        newDetectedImages.push(detectedImage);

        // Upload image immediately to get permanent URL
        try {
          const permanentUrl = await uploadImageFile(processedFile);
          detectedImage.uploadedUrl = permanentUrl;
          detectedImage.isUploaded = true;
          detectedImage.isUploading = false;
          console.log(`✅ Image uploaded for ${processedFile.name}: ${permanentUrl}`);
        } catch (uploadError) {
          console.error(`❌ Failed to upload ${processedFile.name}:`, uploadError);
          detectedImage.error = uploadError instanceof Error ? uploadError.message : 'Upload failed';
          detectedImage.isUploading = false;
          detectedImage.isUploaded = false;
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast({
          title: "Error",
          description: `Error procesando ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          variant: "destructive"
        });
      }
    }

    if (newDetectedImages.length > 0) {
      const updatedImages = [...detectedImages, ...newDetectedImages];
      setDetectedImages(updatedImages);
      onDetectionComplete(updatedImages);
      
      toast({
        title: "¡Detección completada!",
        description: `${newDetectedImages.length} imagen(es) procesadas. ${newDetectedImages.filter(img => img.detectedBrand).length} marca(s) detectadas.`,
      });
    }
  }, [detectedImages, maxImages, toast, onDetectionComplete, brands]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  // Remove image
  const removeImage = (imageId: string) => {
    const updatedImages = detectedImages.filter(img => img.id !== imageId);
    setDetectedImages(updatedImages);
    onDetectionComplete(updatedImages);
  };

  // Clear all images
  const clearAll = () => {
    setDetectedImages([]);
    onDetectionComplete([]);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get confidence icon
  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <Check className="w-3 h-3" />;
      case 'medium': return <Eye className="w-3 h-3" />;
      case 'low': return <AlertTriangle className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  // Upload all remaining images that haven't been uploaded yet
  const uploadRemainingImages = async () => {
    const imagesToUpload = detectedImages.filter(img => !img.isUploaded && !img.isUploading && !img.error);
    if (imagesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < imagesToUpload.length; i++) {
      const image = imagesToUpload[i];
      try {
        setDetectedImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, isUploading: true } : img
        ));

        const permanentUrl = await uploadImageFile(image.file);
        
        setDetectedImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, uploadedUrl: permanentUrl, isUploaded: true, isUploading: false }
            : img
        ));

        console.log(`✅ Image uploaded for ${image.fileName}: ${permanentUrl}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${image.fileName}:`, error);
        setDetectedImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, error: error instanceof Error ? error.message : 'Upload failed', isUploading: false }
            : img
        ));
      }

      setUploadProgress(((i + 1) / imagesToUpload.length) * 100);
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  // Statistics
  const stats = {
    total: detectedImages.length,
    detected: detectedImages.filter(img => img.detectedBrand).length,
    undetected: detectedImages.filter(img => !img.detectedBrand).length,
    highConfidence: detectedImages.filter(img => img.confidence === 'high').length,
    mediumConfidence: detectedImages.filter(img => img.confidence === 'medium').length,
    lowConfidence: detectedImages.filter(img => img.confidence === 'low').length,
    uploaded: detectedImages.filter(img => img.isUploaded).length,
    failed: detectedImages.filter(img => img.error).length,
    pending: detectedImages.filter(img => !img.isUploaded && !img.error).length
  };

  return (
    <div className="space-y-6" data-testid="intelligent-uploader">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold">Detección Inteligente de Marcas</h3>
        <Badge variant="secondary">BETA</Badge>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Categoría por defecto para productos detectados
            </label>
            <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.emoji} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        data-testid="intelligent-drop-zone"
      >
        <FileImage className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Arrastra y suelta imágenes con marcas mixtas
        </h3>
        <p className="text-muted-foreground mb-4">
          Sube hasta {maxImages} imágenes. El sistema detectará automáticamente las marcas desde los nombres de archivo.
        </p>
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          className="hidden"
          id="intelligent-file-input"
          data-testid="intelligent-file-input"
        />
        <Button asChild size="lg">
          <label htmlFor="intelligent-file-input" className="cursor-pointer" data-testid="button-intelligent-upload">
            <Upload className="w-4 h-4 mr-2" />
            Seleccionar imágenes
          </label>
        </Button>
      </div>

      {/* Statistics */}
      {detectedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Estadísticas de Detección
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.uploaded}</div>
                <div className="text-xs text-muted-foreground">Subidas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pendientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Fallidas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.detected}</div>
                <div className="text-xs text-muted-foreground">Marcas detectadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.highConfidence}</div>
                <div className="text-xs text-muted-foreground">Alta confianza</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Subiendo imágenes...</span>
                <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {stats.pending > 0 && !isUploading && (
        <div className="flex gap-2">
          <Button onClick={uploadRemainingImages} data-testid="button-upload-remaining">
            <Upload className="w-4 h-4 mr-2" />
            Subir {stats.pending} imagen(es) pendiente(s)
          </Button>
        </div>
      )}

      {/* Images Grid */}
      {detectedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Imágenes procesadas ({detectedImages.length})</h4>
            <Button variant="outline" size="sm" onClick={clearAll} data-testid="button-clear-all">
              <X className="w-4 h-4 mr-2" />
              Limpiar todo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {detectedImages.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="aspect-square relative">
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className={`w-full h-full object-cover ${image.isUploading ? 'opacity-50' : ''}`}
                  />
                  {image.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  {image.isUploaded && (
                    <div className="absolute top-2 left-2">
                      <div className="bg-green-500 text-white p-1 rounded-full">
                        <Check className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                  {image.error && (
                    <div className="absolute top-2 left-2">
                      <div className="bg-red-500 text-white p-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => removeImage(image.id)}
                    data-testid={`button-remove-${image.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-mono truncate" title={image.fileName}>
                    {image.fileName}
                  </div>
                  
                  {/* Upload Status */}
                  <div className="flex items-center gap-2">
                    {image.isUploading ? (
                      <Badge variant="outline" className="text-xs">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Subiendo...
                      </Badge>
                    ) : image.isUploaded ? (
                      <Badge variant="default" className="text-xs bg-green-600">
                        <Check className="w-3 h-3 mr-1" />
                        Subida
                      </Badge>
                    ) : image.error ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  
                  {/* Brand Detection */}
                  {image.detectedBrand ? (
                    <div className="space-y-1">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getConfidenceColor(image.confidence)}`}>
                        {getConfidenceIcon(image.confidence)}
                        {image.detectedBrand}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Confianza: {image.confidence}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Sin marca detectada
                    </Badge>
                  )}
                  
                  {/* Error Message */}
                  {image.error && (
                    <div className="text-xs text-red-600 break-words">
                      {image.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Validation Alerts */}
      {detectedImages.length > 0 && !defaultCategoryId && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecciona una categoría por defecto antes de proceder con la carga masiva.
          </AlertDescription>
        </Alert>
      )}

      {stats.undetected > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {stats.undetected} imagen(es) no tienen marca detectada. Estas se crearán como productos sin marca específica.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}