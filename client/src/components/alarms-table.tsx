import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, Info, Bell } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { VeeamAlarm } from "@shared/schema";

interface AlarmsTableProps {
  alarms: VeeamAlarm[];
  isLoading: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'Error':
      return {
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        label: 'Erro',
      };
    case 'Warning':
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        label: 'Aviso',
      };
    case 'Resolved':
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        label: 'Resolvido',
      };
    case 'Information':
    default:
      return {
        icon: Info,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        label: 'Informação',
      };
  }
}

function formatDateTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function AlarmsTable({ alarms, isLoading }: AlarmsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alarmes Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Alarmes Ativos
          {alarms.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {alarms.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alarms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p>Nenhum alarme ativo para este cliente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Computador</TableHead>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[80px] text-center">Repetições</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alarms.map((alarm) => {
                  const statusConfig = getStatusConfig(alarm.lastActivation?.status || 'Information');
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={alarm.instanceUid} data-testid={`row-alarm-${alarm.instanceUid}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${statusConfig.bgColor}`}>
                            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                          </div>
                          <span className={`text-sm font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {alarm.object?.objectName || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {alarm.object?.computerName || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {alarm.lastActivation?.time ? formatDateTime(alarm.lastActivation.time) : '-'}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm truncate" title={alarm.lastActivation?.message || ''}>
                          {alarm.lastActivation?.message?.replace(/\r\n/g, ' ').trim() || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {alarm.repeatCount || 1}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
