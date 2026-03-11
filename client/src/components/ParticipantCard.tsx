import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, AlertCircle, XCircle, TrendingDown, Wallet, History, Check, ChevronLeft, ChevronRight, Edit2, AtSign, DollarSign, User, Trash2, CalendarDays } from 'lucide-react';
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
  { value: '01', label: 'JAN', full: 'Janeiro' }, { value: '02', label: 'FEV', full: 'Fevereiro' },
  { value: '03', label: 'MAR', full: 'Março' }, { value: '04', label: 'ABR', full: 'Abril' },
  { value: '05', label: 'MAI', full: 'Maio' }, { value: '06', label: 'JUN', full: 'Junho' },
  { value: '07', label: 'JUL', full: 'Julho' }, { value: '08', label: 'AGO', full: 'Agosto' },
  { value: '09', label: 'SET', full: 'Setembro' }, { value: '10', label: 'OUT', full: 'Outubro' },
  { value: '11', label: 'NOV', full: 'Novembro' }, { value: '12', label: 'DEZ', full: 'Dezembro' },
];

export function ParticipantCard({
  participant, onPayment, onAmortize, onAddLoan, onViewHistory,
  onRegisterPayment, onEditLoan, onEditDebt, onEditName, onEditEmail,
  onDelete, onViewChart
}: ParticipantCardProps) {
  const status = getParticipantStatus(participant);
  const progress = calculateProgress(participant.totalLoan, participant.currentDebt);
  
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
  
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

  const utils = trpc.useUtils();

  const unmarkPaymentMutation = trpc.caixinha.unmarkPayment.useMutation({
    onSuccess: () => {
      utils.caixinha.listParticipants.invalidate();
      utils.caixinha.getAllTransactions.invalidate();
      utils.caixinha.getBalancete.invalidate();
      showSuccessToast('PAGAMENTO DESMARCADO!');
    },
    onError: (error) => showErrorToast(error.message),
  });

  const paymentMutation = trpc.caixinha.registerPayment.useMutation({
    onSuccess: () => {
      utils.caixinha.listParticipants.invalidate();
      utils.caixinha.getAllTransactions.invalidate();
      utils.caixinha.getBalancete.invalidate();
      setIsPayMonthOpen(false);
      showSuccessToast('PAGAMENTO REGISTRADO!');
    },
    onError: (error) => showErrorToast(error.message),
  });

  const getPaidRecord = (monthValue: string, year: number) => {
    return monthlyPayments.find((p: any) => p.month === `${year}-${monthValue}` && p.year === year && (p.paid === true || p.paid === 1));
  };

  const handleMonthClick = (monthValue: string, year: number, label: string) => {
    const paidRecord = getPaidRecord(monthValue, year);
    if (paidRecord) {
      setMonthToUnmark({ id: paidRecord.id, monthValue, year, label });
      setIsUnmarkConfirmOpen(true);
    } else {
      setMonthToPay({ monthValue, year, label });
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setIsPayMonthOpen(true);
    }
  };

  const handleConfirmUnmark = async () => {
    if (!monthToUnmark) return;
    await unmarkPaymentMutation.mutateAsync({ paymentId: monthToUnmark.id, participantId: participant.id });
    setIsUnmarkConfirmOpen(false);
    setMonthToUnmark(null);
  };

  const handleConfirmPay = async () => {
    if (!monthToPay) return;
    await paymentMutation.mutateAsync({
      participantId: participant.id,
      month: `${monthToPay.year}-${monthToPay.monthValue}`,
      year: monthToPay.year,
      paymentDate: paymentDate,
    });
  };

  const statusColors = {
    green: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    yellow: 'bg-amber-100 text-amber-900 border-amber-400',
    red: 'bg-red-100 text-red-900 border-red-400',
  };
  const statusText = { green: 'EM DIA', yellow: 'JUROS PAGOS', red: 'PENDENTE' };
  const StatusIcon = { green: CheckCircle2, yellow: AlertCircle, red: XCircle }[status];

  const baseMonthlyTotal = calculateMonthlyTotal(participant.currentDebt);
  const modalPenalty = calculatePenalty(paymentDate);
  const modalTotal = baseMonthlyTotal + modalPenalty;

  return (
    <div className="bg-white border-2 border-slate-200 shadow-sm rounded-xl p-5 flex flex-col gap-5 hover:border-slate-300 transition-colors">
      
      {/* HEADER - FONTES FORTES E MAIÚSCULAS */}
      <div className="flex justify-between items-start gap-3 cursor-pointer group" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border-2 border-slate-200">
            <User className="w-6 h-6 text-black" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xl font-black text-black uppercase tracking-tight truncate group-hover:text-primary transition-colors">
              {participant.name}
            </h3>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">ID: {participant.id}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn("rounded-md font-black uppercase tracking-wider px-2.5 py-1 border-2 shrink-0 text-[10px]", statusColors[status])}>
          <StatusIcon className="w-3.5 h-3.5 mr-1.5 stroke-[3]" /> {statusText[status]}
        </Badge>
      </div>

      {/* DÍVIDA - NÚMEROS GIGANTES E PESADOS */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Saldo Devedor</span>
          <span className="text-2xl font-black text-black tracking-tighter">{formatCurrency(participant.currentDebt)}</span>
        </div>
        {parseFloat(participant.totalLoan) > 0 && (
          <div className="space-y-1.5 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Progresso</span>
              <span className="text-[11px] font-black text-black">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
              <div className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* EXPANDIDO */}
      {isExpanded && (
        <div className="space-y-6 pt-2 border-t-2 border-slate-100 animate-in fade-in duration-200">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Empréstimo Inicial</span>
              <span className="text-base font-black text-black">{formatCurrency(participant.totalLoan)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Mensalidade</span>
              <span className="text-base font-black text-emerald-700">{formatCurrency(baseMonthlyTotal)}</span>
            </div>
          </div>

          {/* MESES - ESTILO BLOCO FORTE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-black uppercase tracking-tight">Mensalidades</span>
              <div className="flex items-center gap-1 bg-slate-100 border-2 border-slate-200 rounded-md p-0.5">
                <button onClick={(e) => { e.stopPropagation(); setSelectedYear(selectedYear - 1); }} disabled={selectedYear <= minYear} className="h-6 w-6 flex items-center justify-center rounded text-black hover:bg-white disabled:opacity-30"><ChevronLeft className="w-4 h-4 stroke-[3]" /></button>
                <span className="text-xs font-black w-10 text-center text-black">{selectedYear}</span>
                <button onClick={(e) => { e.stopPropagation(); setSelectedYear(selectedYear + 1); }} disabled={selectedYear >= maxYear} className="h-6 w-6 flex items-center justify-center rounded text-black hover:bg-white disabled:opacity-30"><ChevronRight className="w-4 h-4 stroke-[3]" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {MONTHS.map((month) => {
                const isPaid = !!getPaidRecord(month.value, selectedYear);
                return (
                  <button
                    key={month.value}
                    onClick={(e) => { e.stopPropagation(); handleMonthClick(month.value, selectedYear, month.label); }}
                    className={cn(
                      "h-10 flex items-center justify-center text-xs font-black uppercase tracking-wider rounded-lg border-2 transition-all",
                      isPaid 
                        ? "bg-emerald-500 border-emerald-600 text-white" 
                        : "bg-white border-slate-300 text-gray-500 hover:border-black hover:text-black"
                    )}
                  >
                    {isPaid ? <Check className="w-5 h-5 stroke-[3]" /> : month.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTÕES PESADOS */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button onClick={(e) => { e.stopPropagation(); onPayment?.(); }} className="bg-black text-white hover:bg-gray-800 rounded-lg h-12 font-black uppercase tracking-wider text-xs">
              <Wallet className="w-4 h-4 mr-2 stroke-[2.5]" /> Pagar
            </Button>
            <Button onClick={(e) => { e.stopPropagation(); onAmortize?.(); }} disabled={participant.currentDebt <= 0} variant="outline" className="rounded-lg h-12 border-2 border-slate-300 text-black font-black uppercase tracking-wider text-xs hover:bg-slate-50">
              <TrendingDown className="w-4 h-4 mr-2 stroke-[2.5]" /> Amortizar
            </Button>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={(e) => { e.stopPropagation(); onViewHistory?.(); }} variant="secondary" className="flex-1 rounded-lg h-10 font-bold uppercase tracking-widest text-[10px] bg-slate-100 text-black hover:bg-slate-200">
              <History className="w-3.5 h-3.5 mr-2 stroke-[2.5]" /> Histórico
            </Button>
            <Button onClick={(e) => { e.stopPropagation(); onViewChart?.(); }} variant="secondary" className="flex-1 rounded-lg h-10 font-bold uppercase tracking-widest text-[10px] bg-slate-100 text-black hover:bg-slate-200">
              <TrendingDown className="w-3.5 h-3.5 mr-2 stroke-[2.5]" /> Gráfico
            </Button>
          </div>

          {/* CONFIGURAÇÕES E APAGAR */}
          <div className="pt-4 border-t-2 border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Opções</span>
              <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center">
                <Trash2 className="w-3 h-3 mr-1 stroke-[2.5]" /> Apagar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={(e) => { e.stopPropagation(); onEditName?.(); }} variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-widest justify-start px-3 border-2"><Edit2 className="w-3 h-3 mr-2 stroke-[2.5]" /> Nome</Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditEmail?.(); }} variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-widest justify-start px-3 border-2"><AtSign className="w-3 h-3 mr-2 stroke-[2.5]" /> Email</Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditLoan?.(); }} variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-widest justify-start px-3 border-2"><DollarSign className="w-3 h-3 mr-2 stroke-[2.5]" /> Empréstimo</Button>
              <Button onClick={(e) => { e.stopPropagation(); onEditDebt?.(); }} variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-widest justify-start px-3 border-2"><Edit2 className="w-3 h-3 mr-2 stroke-[2.5]" /> Saldo</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESMARCAR */}
      <ConfirmationModal
        isOpen={isUnmarkConfirmOpen}
        title="ESTORNAR PAGAMENTO"
        description={monthToUnmark ? `Deseja desmarcar o mês de ${monthToUnmark.label}/${monthToUnmark.year}?` : ''}
        confirmText="SIM, ESTORNAR"
        cancelText="CANCELAR"
        isDangerous={true}
        isLoading={unmarkPaymentMutation.isPending}
        onConfirm={handleConfirmUnmark}
        onCancel={() => { setIsUnmarkConfirmOpen(false); setMonthToUnmark(null); }}
      />

      {/* MODAL DE PAGAR */}
      <Dialog open={isPayMonthOpen} onOpenChange={setIsPayMonthOpen}>
        <DialogContent className="bg-white rounded-xl shadow-2xl sm:max-w-[400px] p-6 border-2 border-black">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-black uppercase tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-600 stroke-[2.5]" /> CONFIRMAR PAGAMENTO
            </DialogTitle>
          </DialogHeader>

          {monthToPay && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mês Referência</span>
                <span className="text-sm font-black text-black uppercase bg-white px-2 py-1 rounded border-2 border-slate-200 tracking-wider">
                  {monthToPay.label}/{monthToPay.year}
                </span>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 stroke-[2.5]" /> Data Real do Pagamento
                </label>
                <input 
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-11 px-3 rounded-md border-2 border-slate-300 text-sm font-bold text-black outline-none focus:border-black focus:ring-0 transition-all w-full uppercase"
                />
              </div>

              <div className="h-0.5 bg-slate-200 w-full my-1"></div>
              
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total a Pagar</span>
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">R$ 200,00 + {formatCurrency(calculateMonthlyInterest(participant.currentDebt))} (juros)</span>
                  {modalPenalty > 0 && (
                    <span className="text-xs font-black text-red-600 mt-1 uppercase tracking-tight animate-in fade-in">+ R$ 20,00 (Multa)</span>
                  )}
                </div>
                <span className="text-3xl font-black text-emerald-600 tracking-tighter">{formatCurrency(modalTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 mt-6">
            <Button onClick={() => setIsPayMonthOpen(false)} variant="outline" className="flex-1 rounded-lg h-12 border-2 border-slate-300 font-black uppercase tracking-wider text-xs text-black">Cancelar</Button>
            <Button onClick={handleConfirmPay} disabled={paymentMutation.isPending} className="flex-1 rounded-lg h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs">
              {paymentMutation.isPending ? 'PROCESSANDO...' : 'CONFIRMAR'}
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
function calculatePenalty(paymentDateStr?: string): number {
  if (!paymentDateStr) return 0;
  const parts = paymentDateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    if (day > 5) return 20;
  }
  return 0;
}