import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, CheckCircle, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FailedJob } from "@shared/schema";

interface FailedJobsTableProps {
  jobs: FailedJob[];
  isLoading: boolean;
}

function getStatusConfig(status: string) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'failed' || statusLower === 'error') {
    return {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: 'Falha',
    };
  }
  if (statusLower === 'warning') {
    return {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      label: 'Aviso',
    };
  }
  return {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    label: status,
  };
}

function formatDateTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateString || '-';
  }
}

export function FailedJobsTable({ jobs, isLoading }: FailedJobsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Jobs com Falha
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
          <Briefcase className="w-5 h-5" />
          Jobs com Falha
          {jobs.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {jobs.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p>Todos os jobs foram concluídos com sucesso</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Nome do Job</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-[140px]">Última Execução</TableHead>
                  <TableHead>Erro da Última Sessão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const statusConfig = getStatusConfig(job.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={job.instanceUid} data-testid={`row-failed-job-${job.instanceUid}`}>
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
                        {job.name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.type || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.lastRun ? formatDateTime(job.lastRun) : '-'}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm whitespace-pre-wrap">
                          {job.lastSessionMessage || '-'}
                        </p>
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
