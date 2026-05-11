import { useEffect, useState } from 'react';
import { SaleReport } from '@/types';
import { api } from '@/services/mockApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

const Reports = () => {
  const [reports, setReports] = useState<SaleReport[]>([]);

  useEffect(() => {
    api.getSaleReports().then(setReports);
  }, []);

  const handleExport = (report: SaleReport) => {
    // Mock export functionality
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `report_${report.date}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Informes de Ventas</h1>

      <div className="grid grid-cols-1 gap-4">
        {reports.map((report) => (
          <Card key={report.date}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Reporte del {report.date}</CardTitle>
              <Button variant="outline" onClick={() => handleExport(report)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ventas Totales</p>
                  <p className="text-2xl font-bold">${report.totalSales.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{report.totalOrders}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Promedio por Pedido</p>
                  <p className="text-2xl font-bold">
                    ${(report.totalSales / report.totalOrders).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productos Vendidos</p>
                  <p className="text-2xl font-bold">
                    {report.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold mb-2">Productos Más Vendidos</h4>
                <div className="space-y-1">
                  {report.products.slice(0, 3).map((product, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>Producto {product.productId}</span>
                      <span>{product.quantity} unidades - ${product.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Generar Informe Personalizado
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Todos los Informes
        </Button>
      </div>
    </div>
  );
};

export default Reports;