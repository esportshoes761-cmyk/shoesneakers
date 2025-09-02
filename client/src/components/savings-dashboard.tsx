import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useSavingsStore } from "@/lib/savings-store";
import { formatCurrency } from "@/lib/currency";
import { PiggyBank, Trophy, Sparkles, TrendingUp, X, ShoppingCart, Gift } from "lucide-react";
import { useLocation } from "wouter";

interface SavingsDashboardProps {
  className?: string;
}

export function SavingsDashboard({ className = "" }: SavingsDashboardProps) {
  const { 
    totalSaved, 
    sessionSaved, 
    showSavingAnimation, 
    lastSavingAmount, 
    hideSavingAnimation, 
    getAchievements,
    getMaxUsableDiscount,
    loadFromServer,
    isLoaded,
    isSyncing
  } = useSavingsStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const achievements = getAchievements();
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const nextAchievement = achievements.find(a => !a.unlocked);
  const maxUsableDiscount = getMaxUsableDiscount();

  // Cargar datos del servidor al montar el componente
  useEffect(() => {
    if (!isLoaded) {
      loadFromServer();
    }
  }, [isLoaded, loadFromServer]);

  if (totalSaved === 0 && sessionSaved === 0 && !showSavingAnimation) {
    return null;
  }

  return (
    <>
      {/* Floating Savings Widget */}
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              className={`
                relative bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700
                text-white font-bold shadow-lg border-none rounded-full p-3 sm:p-4
                transition-all duration-300 hover:scale-105 active:scale-95
                ${showSavingAnimation ? 'animate-bounce' : ''}
              `}
              data-testid="button-savings-dashboard"
            >
              <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
              <div className="flex flex-col items-start">
                <span className="text-xs sm:text-sm">Total Ahorrado</span>
                <span className="text-sm sm:text-lg font-extrabold">
                  {formatCurrency(totalSaved)}
                </span>
              </div>
              
              {/* Animation Effect */}
              {showSavingAnimation && (
                <div className="absolute -top-2 -right-2 animate-ping">
                  <div className="bg-yellow-400 rounded-full p-1">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}

              {/* New Achievement Badge */}
              {unlockedAchievements.length > 0 && (
                <div className="absolute -top-1 -left-1">
                  <Badge variant="secondary" className="bg-yellow-400 text-black font-bold text-xs">
                    {unlockedAchievements.length}
                  </Badge>
                </div>
              )}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-green-600" />
                ¡Panel de Ahorros! 💰
              </DialogTitle>
              <DialogDescription>
                Revisa cuánto dinero has ahorrado con nuestras ofertas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Total Savings */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Ahorro Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(totalSaved)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    En esta sesión: {formatCurrency(sessionSaved)}
                  </div>
                </CardContent>
              </Card>

              {/* Progress to Next Achievement */}
              {nextAchievement && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-600" />
                      Próximo Logro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{nextAchievement.emoji} {nextAchievement.title}</span>
                        <span>{formatCurrency(nextAchievement.threshold)}</span>
                      </div>
                      <Progress 
                        value={(totalSaved / nextAchievement.threshold) * 100} 
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground">
                        Te faltan {formatCurrency(nextAchievement.threshold - totalSaved)} para desbloquear
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Achievements */}
              {unlockedAchievements.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-600" />
                      Logros Desbloqueados ({unlockedAchievements.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {unlockedAchievements.map((achievement) => (
                        <div
                          key={achievement.id}
                          className="flex items-center gap-3 p-2 bg-yellow-50 rounded-lg border"
                        >
                          <div className="text-2xl">{achievement.emoji}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{achievement.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {achievement.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Usar Ahorros */}
              {maxUsableDiscount > 0 && (
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gift className="w-4 h-4 text-green-600" />
                      ¡Usa tus Ahorros!
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">
                          Puedes usar hasta:
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(maxUsableDiscount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Como descuento en tu próxima compra
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                        onClick={() => {
                          setIsOpen(false);
                          setLocation('/checkout');
                        }}
                        data-testid="button-use-savings"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Usar en mi Compra
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Motivational Message */}
              <Card className="bg-gradient-to-r from-green-50 to-blue-50">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <Sparkles className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-green-700">
                      ¡Sigue comprando inteligentemente!
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Cada compra con descuento suma a tus ahorros
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Savings Animation Popup */}
      {showSavingAnimation && lastSavingAmount > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-full shadow-lg transform animate-bounce">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="w-5 h-5" />
              ¡Ahorraste {formatCurrency(lastSavingAmount)}!
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20 pointer-events-auto"
            onClick={hideSavingAnimation}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </>
  );
}