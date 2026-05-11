import { useEffect, useState } from 'react';
import { AuditEvent, Alert } from '@/types';
import { api } from '@/services/mockApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Shield, Users, Clock } from 'lucide-react';

const RealTimeMonitoring = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeUsers, setActiveUsers] = useState(4);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsData, alertsData] = await Promise.all([
          api.getAuditEvents(),
          api.getAlerts()
        ]);
        setEvents(eventsData);
        setAlerts(alertsData);
      } catch (error) {
        console.error('Error cargando datos:', error);
        // En producción, mostrar notificación de error al usuario
      }
    };

    loadData();
  }, []);

  const recentEvents = events.slice(-5);
  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel de Administración Emulador</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">En tiempo real</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Hoy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">211</div>
            <p className="text-xs text-muted-foreground">Total de acciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-green-600">Operativo</Badge>
            <p className="text-xs text-muted-foreground">Sin problemas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Eventos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{event.action}</p>
                      <p className="text-sm text-muted-foreground">
                        Usuario {event.userId} • {event.resource}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {event.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" className="w-full">
                Ver Todos los Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-4 w-4 ${
                      alert.type === 'error' ? 'text-red-500' :
                      alert.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                    }`} />
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-muted-foreground">
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    alert.type === 'error' ? 'destructive' :
                    alert.type === 'warning' ? 'secondary' : 'default'
                  }>
                    {alert.type}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" className="w-full">
                Gestionar Alertas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controles de Monitoreo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Iniciar Sesión de Prueba
            </Button>
            <Button variant="outline">
              <Activity className="h-4 w-4 mr-2" />
              Generar Reporte de Auditoría
            </Button>
            <Button variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Configurar Alertas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeMonitoring;