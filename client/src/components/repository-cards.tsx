import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive } from "lucide-react";
import type { VeeamRepository } from "@shared/schema";

interface RepositoryCardsProps {
  repositories: VeeamRepository[];
}

export function RepositoryCards({ repositories }: RepositoryCardsProps) {
  const formatBytes = (bytes: number): string => {
    const tb = bytes / (1024 ** 4);
    return `${tb.toFixed(2)} TB`;
  };

  const getUsagePercentage = (repo: VeeamRepository): number => {
    return ((repo.usedSpace / repo.capacity) * 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 75) return "text-yellow-600";
    return "text-primary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Repositórios de Backup
        </CardTitle>
        <CardDescription>Uso de armazenamento por repositório</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {repositories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum repositório encontrado</p>
          </div>
        ) : (
          repositories.map((repo, index) => {
            const usagePercentage = getUsagePercentage(repo);
            return (
              <div key={index} className="space-y-2" data-testid={`repository-${index}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{repo.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{repo.path}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${getUsageColor(usagePercentage)}`}>
                      {usagePercentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(repo.usedSpace)} / {formatBytes(repo.capacity)}
                    </p>
                  </div>
                </div>
                <Progress
                  value={usagePercentage}
                  className="h-2"
                  data-testid={`progress-repository-${index}`}
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
