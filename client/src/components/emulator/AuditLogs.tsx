import { useEffect, useState } from 'react';
import { AuditEvent } from '@/types';
import { api } from '@/services/mockApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Filter, Clock, User, Activity } from 'lucide-react';

const AuditLogs = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<AuditEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    api.getAuditEvents().then((data) => {
      setEvents(data);
      setFilteredEvents(data);
    });
  }, []);

  useEffect(() => {
    let filtered = events;

    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.resource.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(event => event.action === actionFilter);
    }

    setFilteredEvents(filtered);
  }, [searchTerm, actionFilter, events]);

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-green-100 text-green-800';
      case 'LOGOUT': return 'bg-gray-100 text-gray-800';
      case 'PRODUCT_UPDATE': return 'bg-blue-100 text-blue-800';
      case 'BULK_UPLOAD': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Logs de Auditoría</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filtros y Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por acción, usuario o recurso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="LOGIN">Inicios de sesión</SelectItem>
                <SelectItem value="PRODUCT_UPDATE">Actualizaciones</SelectItem>
                <SelectItem value="BULK_UPLOAD">Cargas masivas</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos de Auditoría ({filteredEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div key={event.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getActionColor(event.action)}>
                        {event.action}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {event.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span><strong>Usuario:</strong> {event.userId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span><strong>Recurso:</strong> {event.resource}</span>
                      </div>
                      <div>
                        <span><strong>IP:</strong> {event.ipAddress}</span>
                      </div>
                    </div>
                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <strong>Detalles:</strong>
                        <pre className="mt-1 text-xs">{JSON.stringify(event.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;