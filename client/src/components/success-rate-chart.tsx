import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SuccessRateChartProps {
  data: { month: string; rate: number }[];
}

export function SuccessRateChart({ data }: SuccessRateChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Taxa de Sucesso de Backups</CardTitle>
        <CardDescription>Percentual de backups bem-sucedidos nos últimos meses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]" data-testid="chart-success-rate">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Taxa de Sucesso"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="rate"
                name="Taxa de Sucesso"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
