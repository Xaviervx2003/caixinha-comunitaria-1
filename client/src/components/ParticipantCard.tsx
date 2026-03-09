import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, AlertCircle, XCircle, TrendingDown, Wallet, History, Check, ChevronLeft, ChevronRight, Edit2, AtSign, DollarSign, User, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/format-currency';
import { useState } from 'react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { showSuccessToast, showErrorToast } from '@/lib/toast-utils';

interface ParticipantCardProps {
  participant: any;
  onPayment?: () => void;
  onAmortize?: () => void;
  onAddLoan?: () => void;
  onViewHistory?: () => void;
  onRegisterPayment?: (id: string) => void;
  onEditLoan?: () => void;
  onEditDebt?: () => void;
  onEditName?: () => void;
  onEditEmail?: () => void;
  onDelete?: () => void;
  onViewChart?: () => void;
}

const MONTHS = [
  { value: '01', label: 'Jan', full: 'Janeiro' },
  { value: '02', label: 'Fev', full: 'Fevereiro' },
  { value: '03', label: 'Mar', full: 'Março' },
  { value: '04', label: 'Abr', full: 'Abril' },
  { value: '05', label: 'Mai', full: 'Maio' },
  { value: '06', label: 'Jun', full: 'Junho' },
  { value: '07', label: 'Jul', full: 'Julho' },
  { value: '08', label: 'Ago', full: 'Agosto' },
  { value: '09', label: 'Set', full: 'Setembro' },
  { value: '10', label: 'Out', full: 'Outubro' },
  { value: '11', label: 'Nov', full: 'Novembro' },
  { value: '12', label: 'Dez', full: 'Dezembro' },
];

export function ParticipantCard({
  participant, onPayment, onAmortize, onAddLoan, onViewHistory,
  onRegisterPayment, onEditLoan, onEditDebt, onEditName, onEditEmail,
  onDelete, onViewChart
}: ParticipantCardProps) {
  const status = getParticipantStatus(participant);
  const progress = calculateProgress(participant.totalLoan, participant.currentDebt);
  const monthlyTotal = calculateMonthlyTotal(participant.currentDebt);

  const monthlyPayments = participant.monthlyPayments || [];
  const [isExpanded, setIsExpanded] = useState(false);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const minYear = 2020;
  const maxYear = currentYear + 2;

  const [isUnmarkConfirmOpen, setIsUnmarkConfirmOpen] = useState(false);
  const [monthToUnmark, setMonthToUnmark] = useState<{ id: number; monthValue: string; year: number; label: string } | null>(null);

  const [isPayMonthOpen, setIsPayMonthOpen] = useState(false);
  const [monthToPay, setMonthToPay] = useState<{ monthValue: string; year: number; label: string } | null>(null);

  const utils = trpc.useUtils();

  const unmarkPaymentMutation = trpc.caixinha.unmarkPayment.useMutation({
    onSuccess: () => {
      utils.caixinha.listParticipants.invalidate();
      utils.caixinha.getAllTransactions.invalidate();
      utils.caixinha.getMonthlyPayments.invalidate();
      utils.caixinha.getAuditLog.invalidate();
      utils.caixinha.getBalancete.invalidate();
      showSuccessToast('Pagamento desmarcado com sucesso!');
    },
    onError: (error) => {
      showErrorToast(error.message || 'Erro ao desmarcar pagamento');
    },
  });

  const paymentMutation = trpc.caixinha.registerPayment.useMutation({
    onSuccess: () => {
      utils.caixinha.listParticipants.invalidate();
      utils.caixinha.getAllTransactions.invalidate();
      utils.caixinha.getMonthlyPayments.invalidate();
      utils.caixinha.getAuditLog.invalidate();
      utils.caixinha.getBalancete.invalidate();
      setIsPayMonthOpen(false);
      if (monthToPay) {
        showSuccessToast(`Pagamento de ${monthToPay.label}/${monthToPay.year} registado!`);
      }
    },
    onError: (error) => {
      showErrorToast(error.message || 'Erro ao registar pagamento');
    },
  });

  const getPaidRecord = (monthValue: string, year: number) => {
    const formatted = `${year}-${monthValue}`;
    return monthlyPayments.find((p: any) =>
      p.month === formatted && p.year === year && (p.paid === true || p.paid === 1)
    );
  };

  const handleMonthClick = (monthValue: string, year: number, label: string) => {
    const paidRecord = getPaidRecord(monthValue, year);
    if (paidRecord) {
      setMonthToUnmark({ id: paidRecord.id, monthValue, year, label });
      setIsUnmarkConfirmOpen(true);
    } else {
      setMonthToPay({ monthValue, year, label });
      setIsPayMonthOpen(true);
    }
  };

  const handleConfirmUnmark = async () => {
    if (!monthToUnmark) return;
    await unmarkPaymentMutation.mutateAsync({
      paymentId: monthToUnmark.id,
      participantId: participant.id,
    });
    setIsUnmarkConfirmOpen(false);
    setMonthToUnmark(null);
  };

  const handleConfirmPay = async () => {
    if (!monthToPay) return;
    await paymentMutation.mutateAsync({
      participantId: participant.id,
      month: `${monthToPay.year}-${monthToPay.monthValue}`,
      year: monthToPay.year,
    });
  };

  // Cores fortes e nítidas para os crachás de estado
  const statusColors = {
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    yellow: 'bg-amber-100 text-amber-800 border-amber-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };
  const statusText = { green: 'Em Dia', yellow: 'Juros Pagos', red: 'Pendente' };
  const StatusIcon = { green: CheckCircle2, yellow: AlertCircle, red: XCircle }[status];

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex flex-col gap-5 hover:border-slate-300 transition-colors">
      
      {/* CABEÇALHO NÍTIDO */}
      <div 
        className="flex justify-between items-start gap-3 cursor-pointer group" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-slate-200 transition-colors">
            <User className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {participant.name}
            </h3>
            <span className="text-xs font-medium text-slate-500">Membro ID: {participant.id}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={cn("rounded-md font-bold px-2.5 py-0.5 border", statusColors[status])}>
            <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
            {statusText[status]}
          </Badge>
        </div>
      </div>

      {/* RESUMO DE DÍVIDA (Bloco claro) */}
      <div 
        className="bg-slate-50 border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition-colors" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Saldo Devedor</span>
          <span className="text-xl font-black text-slate-900">{formatCurrency(participant.currentDebt)}</span>
        </div>
        
        {parseFloat(participant.totalLoan) > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-slate-500">Progresso de Quitação</span>
              <span className="text-[11px] font-bold text-slate-700">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ÁREA EXPANDIDA COM ESTRUTURA FORTE */}
      {isExpanded && (
        <div className="space-y-6 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
          
          {/* Info Secundária */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Empréstimo Inicial</span>
              <span className="text-sm font-bold text-slate-800">{formatCurrency(participant.totalLoan)}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Cota + Juros Mensal</span>
              <span className="text-sm font-bold text-emerald-700">{formatCurrency(monthlyTotal)}</span>
            </div>
          </div>

          {/* GRID DE MESES (Estilo Caixa de Seleção) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Mensalidades</span>
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); selectedYear > minYear && setSelectedYear(selectedYear - 1); }}
                  disabled={selectedYear <= minYear}
                  className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold w-10 text-center text-slate-800">{selectedYear}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); selectedYear < maxYear && setSelectedYear(selectedYear + 1); }}
                  disabled={selectedYear >= maxYear}
                  className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {MONTHS.map((month) => {
                const isPaid = !!getPaidRecord(month.value, selectedYear);
                return (
                  <button
                    key={month.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMonthClick(month.value, selectedYear, month.label);
                    }}
                    className={cn(
                      "h-10 flex items-center justify-center text-xs font-bold rounded-lg border transition-all",
                      isPaid
                        ? "bg-emerald-600 border-emerald-700 text-white shadow-sm"
                        : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    {isPaid ? <Check className="w-4 h-4" /> : month.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTÕES DE AÇÃO NÍTIDOS */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button 
              onClick={(e) => { e.stopPropagation(); onPayment?.(); }} 
              className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-lg h-11 shadow-sm font-bold"
            >
              <Wallet className="w-4 h-4 mr-2" /> Pagar Mês
            </Button>
            <Button 
              onClick={(e) => { e.stopPropagation(); onAmortize?.(); }} 
              disabled={participant.currentDebt <= 0} 
              variant="outline" 
              className="w-full rounded-lg h-11 border-slate-300 text-slate-800 hover:bg-slate-50 font-bold"
            >
              <TrendingDown className="w-4 h-4 mr-2" /> Amortizar
            </Button>
          </div>

          <div className="flex gap-3">
            <Button onClick={(e) => { e.stopPropagation(); onViewHistory?.(); }} variant="secondary" className="flex-1 rounded-lg h-10 font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              <History className="w-4 h-4 mr-2" /> Histórico
            </Button>
            <Button onClick={(e) => { e.stopPropagation(); onViewChart?.(); }} variant="secondary" className="flex-1 rounded-lg h-10 font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              <TrendingDown className="w-4 h-4 mr-2" /> Gráfico
            </Button>
          </div>

          {/* CONFIGURAÇÕES E DELEÇÃO (Área Inferior) */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Opções do Registo</span>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold flex items-center transition-colors"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Apagar
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={(e) => { e.stopPropagation(); onEditName?.(); }} variant="outline" className="h-9 rounded-md border-slate-200 text-slate-700 text-xs justify-start px-3 shadow-none hover:bg-slate-50">
                <Edit2 className="w-3 h-3 mr-2 text-slate-400" /> Nome
              </Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditEmail?.(); }} variant="outline" className="h-9 rounded-md border-slate-200 text-slate-700 text-xs justify-start px-3 shadow-none hover:bg-slate-50">
                <AtSign className="w-3 h-3 mr-2 text-slate-400" /> Email
              </Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditLoan?.(); }} variant="outline" className="h-9 rounded-md border-slate-200 text-slate-700 text-xs justify-start px-3 shadow-none hover:bg-slate-50">
                <DollarSign className="w-3 h-3 mr-2 text-slate-400" /> Empréstimo
              </Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditDebt?.(); }} variant="outline" className="h-9 rounded-md border-slate-200 text-slate-700 text-xs justify-start px-3 shadow-none hover:bg-slate-50">
                <Edit2 className="w-3 h-3 mr-2 text-slate-400" /> Saldo
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE ESTORNO */}
      <ConfirmationModal
        isOpen={isUnmarkConfirmOpen}
        title="Estornar Pagamento"
        description={monthToUnmark ? `Tem a certeza que deseja desmarcar o mês de ${monthToUnmark.label}/${monthToUnmark.year}? O valor será retirado do balancete principal.` : ''}
        confirmText="Sim, Estornar"
        cancelText="Cancelar"
        isDangerous={true}
        isLoading={unmarkPaymentMutation.isPending}
        onConfirm={handleConfirmUnmark}
        onCancel={() => { setIsUnmarkConfirmOpen(false); setMonthToUnmark(null); }}
      />

      {/* MODAL DE PAGAMENTO LIMPO E NÍTIDO */}
      <Dialog open={isPayMonthOpen} onOpenChange={setIsPayMonthOpen}>
        <DialogContent className="bg-white rounded-xl shadow-lg sm:max-w-[400px] p-6 border-slate-200">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Confirmar Pagamento
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Verifique os valores antes de registar.
            </DialogDescription>
          </DialogHeader>

          {monthToPay && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mês</span>
                <span className="text-sm font-bold text-slate-900">
                  {monthToPay.label}/{monthToPay.year}
                </span>
              </div>
              <div className="h-px bg-slate-200 w-full my-2"></div>
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">A Pagar</span>
                  <span className="text-xs text-slate-500 font-medium">R$ 200,00 + {formatCurrency(calculateMonthlyInterest(participant.currentDebt))} juros</span>
                </div>
                <span className="text-2xl font-black text-emerald-600">{formatCurrency(monthlyTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 mt-6">
            <Button onClick={() => setIsPayMonthOpen(false)} variant="outline" className="flex-1 rounded-lg h-11 border-slate-300 font-bold text-slate-700">Cancelar</Button>
            <Button onClick={handleConfirmPay} disabled={paymentMutation.isPending} className="flex-1 rounded-lg h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {paymentMutation.isPending ? 'A processar...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getParticipantStatus(participant: any): 'green' | 'yellow' | 'red' {
  const debt = parseFloat(participant.currentDebt);
  if (debt === 0) return 'green';
  if (participant.interestPaid) return 'yellow';
  return 'red';
}

function calculateProgress(totalLoan: any, currentDebt: any): number {
  const total = parseFloat(totalLoan);
  const current = parseFloat(currentDebt);
  if (total === 0) return 0;
  return Math.round(((total - current) / total) * 100);
}

function calculateMonthlyInterest(currentDebt: any): number {
  return parseFloat(currentDebt) * 0.10;
}

function calculateMonthlyTotal(currentDebt: any): number {
  return 200 + calculateMonthlyInterest(currentDebt);
}