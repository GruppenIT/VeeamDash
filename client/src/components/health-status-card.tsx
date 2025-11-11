import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthStatusCardProps {
  status: 'healthy' | 'warning' | 'critical';
  totalBackups: number;
  successRate: number;
  activeJobs: number;
}

export function HealthStatusCard({ status, totalBackups, successRate, activeJobs }: HealthStatusCardProps) {
  const getStatusConfig = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return {
          icon: CheckCircle2,
          label: 'Saudável',
          description: 'Todos os sistemas operando normalmente',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const,
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Atenção',
          description: 'Algumas falhas detectadas',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeVariant: 'secondary' as const,
        };
      case 'critical':
        return {
          icon: XCircle,
          label: 'Crítico',
          description: 'Múltiplas falhas detectadas',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const,
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Saúde Geral do Sistema
        </CardTitle>
        <CardDescription>Status atual da infraestrutura de backup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={cn(
          "flex items-center gap-4 p-6 rounded-lg border-2",
          config.bgColor,
          config.borderColor
        )}>
          <div className={cn("p-3 rounded-full bg-white", config.color)}>
            <Icon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-semibold" data-testid="text-health-status">{config.label}</h3>
              <Badge variant={config.badgeVariant} className="text-xs">
                {successRate.toFixed(1)}% de sucesso
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total de Backups</p>
            <p className="text-2xl font-bold">{totalBackups}</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Taxa de Sucesso</p>
            <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Jobs Ativos</p>
            <p className="text-2xl font-bold">{activeJobs}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
