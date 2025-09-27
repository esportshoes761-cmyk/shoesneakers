import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Hash, ImagePlus, Package, Briefcase, Check, Copy, ChevronDown, ChevronRight, FileImage } from "lucide-react";

export function DuplicatesDetailedReport() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  
  // Query para obtener el reporte detallado
  const { data: duplicatesReport, isLoading, error } = useQuery({
    queryKey: ['/api/admin/duplicates-report'],
    queryFn: () => fetch('/api/admin/duplicates-report').then(res => res.json()),
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Generando reporte de duplicados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Error al cargar el reporte</span>
          </div>
          <p className="text-sm text-red-600">
            No se pudo cargar el reporte de duplicados. Intenta actualizar la página.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!duplicatesReport?.success) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="font-semibold mb-2">Sin datos disponibles</h3>
          <p className="text-sm text-gray-600">
            No se pudo generar el reporte de duplicados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, duplicateGroups, duplicatesByBrand } = duplicatesReport;

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grupos Duplicados</p>
                <p className="text-2xl font-bold text-red-600">{summary.totalDuplicateGroups}</p>
              </div>
              <Hash className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Imágenes Involucradas</p>
                <p className="text-2xl font-bold text-orange-600">{summary.totalImagesInvolved}</p>
              </div>
              <ImagePlus className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Productos Afectados</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.totalProductsAffected}</p>
              </div>
              <Package className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Marcas Afectadas</p>
                <p className="text-2xl font-bold text-blue-600">{summary.brandsAffected}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Detallada de Grupos Duplicados */}
      {duplicateGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              🚨 Grupos de Duplicados Detallados ({duplicateGroups.length} grupos encontrados)
            </CardTitle>
            <CardDescription>
              Haz clic en un grupo para ver los productos específicos con sus referencias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {duplicateGroups.slice(0, 15).map((group: any, index: number) => (
                <div key={group.duplicateHash} className="border rounded-lg">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedGroup(expandedGroup === group.duplicateHash ? null : group.duplicateHash)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        group.severity === 'high' ? 'bg-red-100 text-red-600' :
                        group.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        <Hash className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold">🚨 Grupo #{index + 1}</h4>
                        <p className="text-sm text-muted-foreground">
                          {group.duplicateCount} imágenes idénticas | {group.affectedProducts.length} productos afectados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        group.severity === 'high' ? "destructive" :
                        group.severity === 'medium' ? "default" : "secondary"
                      }>
                        {group.severity.toUpperCase()}
                      </Badge>
                      {expandedGroup === group.duplicateHash ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                  
                  {expandedGroup === group.duplicateHash && (
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="mt-4 space-y-4">
                        <div>
                          <h5 className="font-medium mb-2 flex items-center gap-2">
                            <FileImage className="h-4 w-4" />
                            Imágenes Duplicadas:
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {group.images.map((img: any, imgIndex: number) => (
                              <div key={imgIndex} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                <FileImage className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-xs">{img.originalName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium mb-2 flex items-center gap-2">
                            <Package className="h-4 w-4 text-red-600" />
                            📋 Productos Afectados - CON REFERENCIAS:
                          </h5>
                          <div className="space-y-2">
                            {group.affectedProducts.map((product: any, prodIndex: number) => (
                              <div key={prodIndex} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 border-red-200">
                                <div className="flex items-center gap-3">
                                  {product.brandLogo && (
                                    <img 
                                      src={product.brandLogo} 
                                      alt={product.brandName}
                                      className="w-8 h-8 object-contain rounded border"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">{product.productName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-mono bg-yellow-100 px-1 rounded font-bold">REF: {product.productReference}</span> | 
                                      <span className="ml-1 font-semibold">{product.brandName}</span>
                                    </p>
                                    <p className="text-xs text-blue-600">
                                      📷 Imagen: {product.imageOriginalName}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {product.brandName}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {duplicateGroups.length > 15 && (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/30">
                  🔍 Mostrando los primeros 15 grupos. <strong>{duplicateGroups.length - 15} grupos adicionales</strong> encontrados.
                  <br />
                  Usa las herramientas de limpieza para gestionar todos los duplicados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado Sin Duplicados */}
      {duplicateGroups.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="font-semibold mb-2 text-green-700">¡Sistema Limpio!</h3>
            <p className="text-sm text-green-600">
              No se detectaron imágenes duplicadas en el sistema. Todas las imágenes son únicas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}