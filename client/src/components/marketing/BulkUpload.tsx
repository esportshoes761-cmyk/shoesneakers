import { useState } from 'react';
import { api } from '@/services/mockApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const BulkUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const result = await api.bulkUploadProducts(file);
      setResult(result);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Carga Masiva de Productos</h1>

      <Card>
        <CardHeader>
          <CardTitle>Subir Archivo CSV/Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Seleccionar archivo
                </span>
              </label>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              CSV, XLSX hasta 10MB
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-sm">{file.name}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? 'Subiendo...' : 'Subir y Procesar'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errors === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Resultado de la Carga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-sm text-muted-foreground">Productos creados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                <p className="text-sm text-muted-foreground">Errores</p>
              </div>
            </div>
            {result.errors > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                <p className="text-sm text-yellow-800">
                  Algunos productos no pudieron ser procesados. Revisa el formato del archivo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formato del Archivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>El archivo debe contener las siguientes columnas:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>name</strong>: Nombre del producto</li>
              <li><strong>brand</strong>: Marca</li>
              <li><strong>price</strong>: Precio (número)</li>
              <li><strong>description</strong>: Descripción</li>
              <li><strong>category</strong>: Categoría</li>
              <li><strong>stock</strong>: Cantidad en stock (número)</li>
              <li><strong>images</strong>: URLs de imágenes (separadas por coma)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkUpload;