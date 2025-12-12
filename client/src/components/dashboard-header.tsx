import { useState, useMemo } from "react";
import { Shield, LogOut, Mail, User, Check, ChevronsUpDown, Search } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { VeeamCompany } from "@shared/schema";

interface DashboardHeaderProps {
  companies: VeeamCompany[];
  selectedCompany: string;
  onCompanyChange: (companyId: string) => void;
  userName: string;
  onLogout: () => void;
  onScheduleClick: () => void;
}

export function DashboardHeader({
  companies,
  selectedCompany,
  onCompanyChange,
  userName,
  onLogout,
  onScheduleClick,
}: DashboardHeaderProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Sort companies alphabetically
  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => 
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [companies]);

  const selectedCompanyData = companies.find((c) => c.instanceUid === selectedCompany);

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Veeam VSPC</h1>
              <p className="text-xs text-muted-foreground">Dashboard de Backup</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onScheduleClick}
              className="hidden sm:flex"
              data-testid="button-schedule-report"
            >
              <Mail className="w-4 h-4 mr-2" />
              Agendar Relatório
            </Button>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[220px] justify-between"
                  data-testid="select-company"
                >
                  <span className="truncate">
                    {selectedCompanyData?.name || "Selecione o cliente"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="end">
                <Command>
                  <CommandInput 
                    placeholder="Pesquisar cliente..." 
                    data-testid="input-search-company"
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sortedCompanies.map((company) => (
                        <CommandItem
                          key={company.instanceUid}
                          value={company.name}
                          onSelect={() => {
                            onCompanyChange(company.instanceUid);
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                          data-testid={`select-company-${company.instanceUid}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCompany === company.instanceUid
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {company.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userName}</p>
                    <p className="text-xs text-muted-foreground">login@sistema.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setLocation("/profile")} 
                  data-testid="button-profile"
                  className="cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onLogout} 
                  data-testid="button-logout"
                  className="cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
