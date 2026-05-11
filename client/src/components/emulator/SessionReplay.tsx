import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Play, Pause, SkipForward, SkipBack, Users, Clock, Activity } from 'lucide-react';

// Mock session data
const mockSessions = [
  {
    id: '1',
    userId: 'user1',
    startTime: new Date('2024-11-29T10:00:00'),
    endTime: new Date('2024-11-29T10:30:00'),
    actions: [
      { time: 0, action: 'LOGIN', details: 'Inicio de sesión exitoso' },
      { time: 120, action: 'NAVIGATE', details: 'Acceso a panel de productos' },
      { time: 300, action: 'VIEW_PRODUCT', details: 'Visualización de producto Nike Air Max' },
      { time: 600, action: 'UPDATE_PRODUCT', details: 'Actualización de precio' },
      { time: 900, action: 'LOGOUT', details: 'Cierre de sesión' }
    ],
    status: 'completed'
  },
  {
    id: '2',
    userId: 'user2',
    startTime: new Date('2024-11-29T11:00:00'),
    endTime: null,
    actions: [
      { time: 0, action: 'LOGIN', details: 'Inicio de sesión exitoso' },
      { time: 60, action: 'NAVIGATE', details: 'Acceso a informes' },
      { time: 180, action: 'EXPORT_REPORT', details: 'Exportación de informe de ventas' }
    ],
    status: 'active'
  }
];

const SessionReplay = () => {
  const [selectedSession, setSelectedSession] = useState(mockSessions[0]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentAction = selectedSession.actions.find(
    action => action.time <= currentTime
  );

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, 1800))); // Max 30 minutes
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reproducción de Sesiones</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sesiones Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 border rounded-md cursor-pointer ${
                    selectedSession.id === session.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Usuario {session.userId}</span>
                    <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                      {session.status === 'active' ? 'Activa' : 'Completada'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3" />
                      {session.startTime.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {session.actions.length} acciones
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reproducción de Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => handleSeek(currentTime - 10)}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handlePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSeek(currentTime + 10)}>
                  <SkipForward className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="1800"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="border rounded-lg p-4 min-h-[200px] bg-gray-50">
                <h4 className="font-medium mb-2">Vista de la Sesión</h4>
                {currentAction ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{currentAction.action}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Tiempo: {Math.floor(currentAction.time / 60)}:{(currentAction.time % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-sm">{currentAction.details}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Selecciona una acción para reproducir</p>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Línea de Tiempo de Acciones</h4>
                <div className="space-y-2">
                  {selectedSession.actions.map((action, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                        currentAction === action ? 'bg-blue-100' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setCurrentTime(action.time)}
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{action.action}</span>
                          <span className="text-sm text-muted-foreground">
                            {Math.floor(action.time / 60)}:{(action.time % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{action.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Usuario</p>
              <p className="font-medium">{selectedSession.userId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inicio</p>
              <p className="font-medium">{selectedSession.startTime.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duración</p>
              <p className="font-medium">
                {selectedSession.endTime
                  ? `${Math.floor((selectedSession.endTime.getTime() - selectedSession.startTime.getTime()) / 60000)} min`
                  : 'En curso'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acciones</p>
              <p className="font-medium">{selectedSession.actions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionReplay;