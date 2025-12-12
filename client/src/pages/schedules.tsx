import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Shield, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Clock, 
  Mail,
  Calendar,
  AlertTriangle,
  X,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VeeamCompany, ReportSchedule, ScheduleRecipient, ScheduleRun } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i.toString().padStart(2, "0") + ":00",
}));

const scheduleFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  companyId: z.string().min(1, "Selecione um cliente"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.string().optional(),
  dayOfMonth: z.string().optional(),
  hour: z.string(),
  recipients: z.string().min(1, "Adicione pelo menos um destinatário"),
});

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;

interface ScheduleWithRecipients extends ReportSchedule {
  recipients: ScheduleRecipient[];
}

export default function Schedules() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [historyScheduleId, setHistoryScheduleId] = useState<string | null>(null);

  const { data: companies, isLoading: companiesLoading } = useQuery<VeeamCompany[]>({
    queryKey: ["/api/companies"],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery<ScheduleWithRecipients[]>({
    queryKey: ["/api/report-schedules"],
  });

  const { data: scheduleRuns, isLoading: runsLoading } = useQuery<ScheduleRun[]>({
    queryKey: ["/api/report-schedules", historyScheduleId, "runs"],
    enabled: !!historyScheduleId,
  });

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      name: "",
      companyId: "",
      frequency: "weekly",
      dayOfWeek: "1",
      dayOfMonth: "1",
      hour: "8",
      recipients: "",
    },
  });

  const frequency = form.watch("frequency");

  const createMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const emails = data.recipients
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const company = companies?.find((c) => c.instanceUid === data.companyId);

      return apiRequest("POST", "/api/report-schedules", {
        name: data.name,
        companyId: data.companyId,
        companyName: company?.name || "Cliente",
        frequency: data.frequency,
        dayOfWeek: data.frequency === "weekly" ? parseInt(data.dayOfWeek || "1") : null,
        dayOfMonth: data.frequency === "monthly" ? parseInt(data.dayOfMonth || "1") : null,
        hour: parseInt(data.hour),
        minute: 0,
        recipients: emails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      setIsFormOpen(false);
      form.reset();
      toast({
        title: "Agendamento criado",
        description: "O agendamento de relatório foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar agendamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/report-schedules/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      toast({
        title: "Status alterado",
        description: "O status do agendamento foi alterado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/report-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      setDeleteScheduleId(null);
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ScheduleFormData) => {
    createMutation.mutate(data);
  };

  const formatFrequency = (schedule: ScheduleWithRecipients) => {
    switch (schedule.frequency) {
      case "daily":
        return `Diário às ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
      case "weekly":
        const day = DAYS_OF_WEEK.find((d) => d.value === String(schedule.dayOfWeek));
        return `${day?.label || "Dia"} às ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
      case "monthly":
        return `Dia ${schedule.dayOfMonth} às ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
      default:
        return "Não configurado";
    }
  };

  const historySchedule = schedules?.find((s) => s.id === historyScheduleId);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Agendamentos</h1>
                <p className="text-xs text-muted-foreground">Relatórios automáticos por e-mail</p>
              </div>
            </div>

            <Button
              onClick={() => setIsFormOpen(true)}
              data-testid="button-new-schedule"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {schedulesLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : schedules && schedules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meus Agendamentos</CardTitle>
              <CardDescription>
                Gerencie os relatórios automáticos configurados para envio por e-mail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Destinatários</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id} data-testid={`row-schedule-${schedule.id}`}>
                      <TableCell className="font-medium">{schedule.name}</TableCell>
                      <TableCell>{schedule.companyName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{formatFrequency(schedule)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {schedule.recipients.slice(0, 2).map((r) => (
                            <Badge key={r.id} variant="secondary" className="text-xs">
                              {r.email}
                            </Badge>
                          ))}
                          {schedule.recipients.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{schedule.recipients.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={schedule.isActive ? "default" : "secondary"}
                          className={schedule.isActive ? "bg-green-600" : ""}
                        >
                          {schedule.isActive ? "Ativo" : "Pausado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryScheduleId(schedule.id)}
                            title="Ver histórico"
                            data-testid={`button-history-${schedule.id}`}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMutation.mutate(schedule.id)}
                            title={schedule.isActive ? "Pausar" : "Ativar"}
                            data-testid={`button-toggle-${schedule.id}`}
                          >
                            {schedule.isActive ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteScheduleId(schedule.id)}
                            className="text-destructive hover:text-destructive"
                            title="Excluir"
                            data-testid={`button-delete-${schedule.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nenhum agendamento</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Você ainda não possui agendamentos de relatórios. Crie um novo agendamento para receber relatórios automáticos por e-mail.
              </p>
              <Button onClick={() => setIsFormOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Agendamento
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Agendamento de Relatório</DialogTitle>
            <DialogDescription>
              Configure o envio automático de relatórios de backup por e-mail
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="border-amber-500 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Atenção com os destinatários</AlertTitle>
            <AlertDescription className="text-amber-700">
              Os relatórios contêm informações sensíveis sobre a infraestrutura de backup. 
              Certifique-se de que todos os destinatários são autorizados a receber esses dados.
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Agendamento</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Relatório Semanal - Cliente X"
                        data-testid="input-schedule-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-schedule-company">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companiesLoading ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : (
                          companies?.map((company) => (
                            <SelectItem
                              key={company.instanceUid}
                              value={company.instanceUid}
                            >
                              {company.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-frequency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {frequency === "weekly" && (
                <FormField
                  control={form.control}
                  name="dayOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia da Semana</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-day-of-week">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {frequency === "monthly" && (
                <FormField
                  control={form.control}
                  name="dayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do Mês</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-day-of-month">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DAYS_OF_MONTH.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="hour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-hour">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem key={hour.value} value={hour.value}>
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinatários</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="email1@exemplo.com, email2@exemplo.com"
                        data-testid="input-recipients"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Separe múltiplos e-mails por vírgula
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-save-schedule"
                >
                  {createMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteScheduleId}
        onOpenChange={() => setDeleteScheduleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será excluído permanentemente
              junto com todo o histórico de execuções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteScheduleId && deleteMutation.mutate(deleteScheduleId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!historyScheduleId}
        onOpenChange={() => setHistoryScheduleId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Execuções</DialogTitle>
            <DialogDescription>
              {historySchedule?.name} - {historySchedule?.companyName}
            </DialogDescription>
          </DialogHeader>

          {runsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : scheduleRuns && scheduleRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(run.startedAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={run.status === "success" ? "default" : "destructive"}
                        className={run.status === "success" ? "bg-green-600" : ""}
                      >
                        {run.status === "success" ? "Sucesso" : run.status === "pending" ? "Pendente" : "Erro"}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.recipientCount}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {run.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma execução registrada ainda
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryScheduleId(null)}
              data-testid="button-close-history"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
