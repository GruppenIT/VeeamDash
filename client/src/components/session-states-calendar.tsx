import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Info } from "lucide-react";
import type { SessionStatesData, DaySessionState } from "@shared/schema";

interface SessionStatesCalendarProps {
  data: SessionStatesData;
  isLoading?: boolean;
}

export function SessionStatesCalendar({ data, isLoading }: SessionStatesCalendarProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Estados das Sessões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.hasData) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Estados das Sessões
          </CardTitle>
          <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground max-w-md">
              {data.message || "Dados históricos estão sendo coletados. O calendário será preenchido automaticamente ao longo do tempo."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  const getFirstDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDay();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDate();
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const weeks: (DaySessionState | null)[][] = [];
  let currentWeek: (DaySessionState | null)[] = [];
  
  if (data.days.length > 0) {
    const firstDayOffset = getFirstDayOfWeek(data.days[0].date);
    for (let i = 0; i < firstDayOffset; i++) {
      currentWeek.push(null);
    }
  }

  for (const day of data.days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Session States
        </CardTitle>
        <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="session-states-calendar">
            <thead>
              <tr>
                {weekDays.map((day) => (
                  <th key={day} className="text-xs text-muted-foreground font-medium p-2 text-center border-b">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) => (
                    <td key={dayIndex} className="p-1 border align-top h-24 min-w-[80px]">
                      {day ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-full flex flex-col cursor-pointer hover:bg-muted/50 rounded p-1">
                                <span className="text-xs text-muted-foreground mb-1">
                                  {formatDate(day.date)}
                                </span>
                                {day.totalCount > 0 ? (
                                  <div className="flex-1 flex flex-col justify-end gap-0.5">
                                    {day.failedPercent > 0 && (
                                      <div 
                                        className="bg-red-400 rounded-sm flex items-center justify-center text-xs text-white font-medium"
                                        style={{ height: `${Math.max(day.failedPercent * 0.6, 16)}px` }}
                                      >
                                        {day.failedPercent}%
                                      </div>
                                    )}
                                    {day.warningPercent > 0 && (
                                      <div 
                                        className="bg-amber-400 rounded-sm flex items-center justify-center text-xs text-amber-900 font-medium"
                                        style={{ height: `${Math.max(day.warningPercent * 0.6, 16)}px` }}
                                      >
                                        {day.warningPercent}%
                                      </div>
                                    )}
                                    {day.successPercent > 0 && (
                                      <div 
                                        className="bg-emerald-400 rounded-sm flex items-center justify-center text-xs text-emerald-900 font-medium"
                                        style={{ height: `${Math.max(day.successPercent * 0.6, 16)}px` }}
                                      >
                                        {day.successPercent}%
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex-1 flex items-center justify-center bg-muted/20 rounded">
                                    <span className="text-[10px] text-muted-foreground">Sem dados</span>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium">{formatFullDate(day.date)}</p>
                                {day.totalCount > 0 ? (
                                  <>
                                    <p className="text-sm">Sessões de Jobs ({day.totalCount})</p>
                                    <div className="flex items-center gap-4 text-xs">
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                        {day.failedCount}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                        {day.warningCount}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                        {day.successCount}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Dados não coletados</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="h-full bg-muted/30 rounded"></div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-400"></span>
            Sucesso
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-400"></span>
            Aviso
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-400"></span>
            Falha
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
