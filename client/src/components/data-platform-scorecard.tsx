import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Shield, FileText } from "lucide-react";

interface ScorecardMetric {
  percentage: number;
  okCount: number;
  issueCount: number;
  title: string;
}

interface DataPlatformScorecardProps {
  overallScore: number;
  status: 'Well Done' | 'Needs Attention' | 'Critical';
  statusMessage: string;
  rpoOverview: ScorecardMetric;
  jobSessions: ScorecardMetric;
  platformHealth: ScorecardMetric;
}

function MetricDonut({ metric }: { metric: ScorecardMetric }) {
  const data = [
    { name: 'OK', value: metric.okCount },
    { name: 'Issues', value: metric.issueCount },
  ];
  
  const colors = ['#00B336', '#EF4444'];
  
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg" data-testid={`metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="relative w-16 h-16 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={20}
              outerRadius={30}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{metric.percentage}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {metric.okCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {metric.issueCount.toLocaleString()}
          </span>
        </div>
        <p className="text-sm font-medium truncate">{metric.title}</p>
        <button className="mt-1" data-testid={`btn-detail-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
}

export function DataPlatformScorecard({
  overallScore,
  status,
  statusMessage,
  rpoOverview,
  jobSessions,
  platformHealth,
}: DataPlatformScorecardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'Well Done':
        return '#00B336';
      case 'Needs Attention':
        return '#F59E0B';
      case 'Critical':
        return '#EF4444';
    }
  };

  const statusColor = getStatusColor();

  return (
    <Card data-testid="card-scorecard">
      <CardHeader>
        <CardTitle>Data Platform Scorecard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-56">
              <svg
                viewBox="0 0 100 120"
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
              >
                <path
                  d="M50 5 L90 20 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 20 Z"
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 12 L83 24 L83 58 C83 80 66 97 50 106 C34 97 17 80 17 58 L17 24 Z"
                  fill={`${statusColor}15`}
                  stroke="none"
                />
                <path
                  d="M50 5 L90 20 L90 60 C90 85 70 105 50 115"
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d="M50 5 L10 20 L10 60 C10 85 30 105 50 115"
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span 
                  className="text-4xl font-bold"
                  style={{ color: statusColor }}
                  data-testid="text-overall-score"
                >
                  {overallScore}%
                </span>
              </div>
            </div>
            <div className="text-center mt-4">
              <h3 
                className="text-xl font-bold"
                style={{ color: statusColor }}
                data-testid="text-status"
              >
                {status}
              </h3>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-status-message">
                {statusMessage}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <MetricDonut metric={rpoOverview} />
            <MetricDonut metric={jobSessions} />
            <MetricDonut metric={platformHealth} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
