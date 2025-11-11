import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { BackupFailure } from "@shared/schema";

interface FailuresTableProps {
  failures: BackupFailure[];
}

export function FailuresTable({ failures }: FailuresTableProps) {
  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          Falhas de Backup - Últimos 7 Dias
        </CardTitle>
        <CardDescription>
          Relação de jobs de backup que falharam recentemente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {failures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma falha registrada</p>
            <p className="text-sm mt-1">Todos os backups foram executados com sucesso</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Data</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Job</TableHead>
                  <TableHead className="font-semibold">VM</TableHead>
                  <TableHead className="font-semibold">Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((failure) => (
                  <TableRow key={failure.id} className="hover:bg-muted/30" data-testid={`failure-row-${failure.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(failure.date)}
                    </TableCell>
                    <TableCell className="font-medium">{failure.clientName}</TableCell>
                    <TableCell>{failure.jobName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {failure.vmName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="font-normal">
                        {failure.errorMessage}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
