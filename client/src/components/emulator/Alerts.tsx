import { useEffect, useState } from 'react';
import { Alert } from '@/types';
import { api } from '@/services/mockApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Info, Bell } from 'lucide-react';

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    api.getAlerts().then(setAlerts);
  }, []);

  const handleResolve = async (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, resolved: true } : alert
    ));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sistema de Alertas</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Resueltas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Resolución</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.length > 0 ? Math.round((resolvedAlerts.length / alerts.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className={`border rounded-lg p-4 ${getAlertColor(alert.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{alert.message}</h4>
                        <Badge variant="outline">{alert.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve(alert.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Resolver
                  </Button>
                </div>
              </div>
            ))}
            {activeAlerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No hay alertas activas en este momento.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resolvedAlerts.map((alert) => (
              <div key={alert.id} className="border rounded-lg p-4 opacity-75">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium line-through">{alert.message}</h4>
                      <Badge variant="secondary">Resuelta</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Resuelta el {alert.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Alertas de Stock Bajo</h4>
                <p className="text-sm text-muted-foreground">Notificar cuando el stock esté por debajo del mínimo</p>
              </div>
              <Button variant="outline" size="sm">Configurar</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Alertas de Seguridad</h4>
                <p className="text-sm text-muted-foreground">Intentos de acceso no autorizados</p>
              </div>
              <Button variant="outline" size="sm">Configurar</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Alertas de Rendimiento</h4>
                <p className="text-sm text-muted-foreground">Latencia alta o errores del sistema</p>
              </div>
              <Button variant="outline" size="sm">Configurar</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Alerts;