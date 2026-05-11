import { useEffect, useState } from 'react';
import { SaleReport } from '@/types';
import { api } from '@/services/mockApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [reports, setReports] = useState<SaleReport[]>([]);

  useEffect(() => {
    api.getSaleReports().then(setReports);
  }, []);

  const totalSales = reports.reduce((sum, report) => sum + report.totalSales, 0);
  const totalOrders = reports.reduce((sum, report) => sum + report.totalOrders, 0);

  const chartData = reports.map(report => ({
    date: report.date,
    ventas: report.totalSales,
    pedidos: report.totalOrders
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel de Administración Marketing</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Últimos 7 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Últimos 7 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">569</div>
            <p className="text-xs text-muted-foreground">En inventario</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marcas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">Activas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas y Pedidos por Día</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ventas" fill="#8884d8" name="Ventas ($)" />
              <Bar dataKey="pedidos" fill="#82ca9d" name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Productos por Marca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>ADIDAS</span>
                <span>154</span>
              </div>
              <div className="flex justify-between">
                <span>NIKE</span>
                <span>134</span>
              </div>
              <div className="flex justify-between">
                <span>CATÁLOGO COMPLETO</span>
                <span>104</span>
              </div>
              <div className="flex justify-between">
                <span>NEW BALANCE</span>
                <span>45</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Inicios de sesión</span>
                <span>5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Productos visualizados</span>
                <span>99</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Marcas consultadas</span>
                <span>38</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;