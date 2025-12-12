import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProtectedWorkload {
  name: string;
  quantity: number;
  sizeGB: number;
  color: string;
}

interface ProtectedDataOverviewProps {
  workloads: ProtectedWorkload[];
}

export function ProtectedDataOverview({ workloads }: ProtectedDataOverviewProps) {
  const total = workloads.reduce((sum, w) => sum + w.quantity, 0);
  const totalSizeTB = workloads.reduce((sum, w) => sum + w.sizeGB, 0) / 1024;

  const chartData = workloads.map(w => ({
    name: w.name,
    value: w.quantity,
  }));

  const formatSize = (sizeGB: number, showNA: boolean = false): string => {
    if (sizeGB === 0 && showNA) {
      return 'N/A';
    }
    if (sizeGB >= 1024) {
      return `${(sizeGB / 1024).toFixed(1)} TB`;
    }
    return `${sizeGB.toFixed(1)} GB`;
  };

  // Workloads that may not have size data from the API
  const workloadsWithoutSizeData = ['Microsoft 365 Objects', 'Computers', 'Cloud Instances'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão Geral de Dados Protegidos</CardTitle>
        <CardDescription>Distribuição de workloads protegidos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico Donut */}
          <div className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {workloads.map((workload, index) => (
                    <Cell key={`cell-${index}`} fill={workload.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-4">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Workloads</p>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {workloads.map((workload) => (
                <div key={workload.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: workload.color }}
                  />
                  <span className="text-xs text-muted-foreground">{workload.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-right py-3 font-medium text-muted-foreground">Quantidade</th>
                  <th className="text-right py-3 font-medium text-muted-foreground">Tamanho</th>
                </tr>
              </thead>
              <tbody>
                {workloads.map((workload) => (
                  <tr
                    key={workload.name}
                    className="border-b last:border-0"
                    data-testid={`row-workload-${workload.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <td className="py-3 flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: workload.color }}
                      />
                      <span className="font-medium">{workload.name}</span>
                    </td>
                    <td className="text-right py-3" data-testid={`quantity-${workload.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      {workload.quantity.toLocaleString()}
                    </td>
                    <td className="text-right py-3" data-testid={`size-${workload.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      {formatSize(workload.sizeGB, workloadsWithoutSizeData.includes(workload.name))}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted/30">
                  <td className="py-3">Total</td>
                  <td className="text-right py-3" data-testid="total-quantity">{total.toLocaleString()}</td>
                  <td className="text-right py-3" data-testid="total-size">{totalSizeTB.toFixed(1)} TB</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
