import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, AlertCircle, XCircle, TrendingDown, Wallet, History, Check, ChevronLeft, ChevronRight } from 'lucide-react';
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

// ✅ Meses no formato correto — value é "YYYY-MM" sem o ano (só "MM")
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
  const [isExpanded, setIsExpanded] = useState(true);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const minYear = 2020;
  const maxYear = currentYear + 2;

  // Modal: desmarcar pagamento
  const [isUnmarkConfirmOpen, setIsUnmarkConfirmOpen] = useState(false);
  const [monthToUnmark, setMonthToUnmark] = useState<{ id: number; monthValue: string; year: number; label: string } | null>(null);

  // Modal: pagar mês
  const [isPayMonthOpen, setIsPayMonthOpen] = useState(false);
  const [monthToPay, setMonthToPay] = useState<{ monthValue: string; year: number; label: string } | null>(null);

  const utils = trpc.useUtils();

  const unmarkPaymentMutation = trpc.caixinha.unmarkPayment.useMutation({
    onSuccess: () => {
      utils.caixinha.listParticipants.invalidate();
      utils.caixinha.getAllTransactions.invalidate();
      utils.caixinha.getMonthlyPayments.invalidate();
      utils.caixinha.getAuditLog.invalidate();
      showSuccessToast('Pagamento desmarcado!');
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
      setIsPayMonthOpen(false);
      if (monthToPay) {
        showSuccessToast(`Pagamento de ${monthToPay.label}/${monthToPay.year} registrado!`);
      }
    },
    onError: (error) => {
      showErrorToast(error.message || 'Erro ao registrar pagamento');
    },
  });

  // ✅ CORRIGIDO: compara "YYYY-MM" com "YYYY-MM"
  const getPaidRecord = (monthValue: string, year: number) => {
    const formatted = `${year}-${monthValue}`; // ex: "2026-03"
    return monthlyPayments.find((p: any) =>
      p.month === formatted && p.year === year && (p.paid === true || p.paid === 1)
    );
  };

  const handleMonthClick = (monthValue: string, year: number, label: string) => {
    const paidRecord = getPaidRecord(monthValue, year);
    if (paidRecord) {
      // Mês pago → oferecer desmarcar
      setMonthToUnmark({ id: paidRecord.id, monthValue, year, label });
      setIsUnmarkConfirmOpen(true);
    } else {
      // Mês não pago → oferecer pagar
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

  const statusColors = {
    green: 'bg-[#00C853] border-[#00C853] text-white',
    yellow: 'bg-[#FFD600] border-[#FFD600] text-black',
    red: 'bg-[#FF3D00] border-[#FF3D00] text-white',
  };
  const statusText = { green: 'EM DIA', yellow: 'JUROS PAGOS', red: 'PENDENTE' };
  const StatusIcon = { green: CheckCircle2, yellow: AlertCircle, red: XCircle }[status];

  return (
    <div className="relative bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="flex justify-between items-start gap-2 cursor-pointer group" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-black uppercase tracking-tight group-hover:text-gray-700 transition-colors">{participant.name}</h3>
          {!isExpanded && (
            <span className="text-sm font-bold text-[#FF3D00]">Dívida: {formatCurrency(participant.currentDebt)}</span>
          )}
          {isExpanded && (
            <span className="text-xs font-mono text-gray-500">ID: {participant.id}</span>
          )}
        </div>
        {isExpanded && (
          <Badge className={cn("rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold px-3 py-1 whitespace-nowrap", statusColors[status])}>
            <StatusIcon className="w-4 h-4 mr-2" />
            {statusText[status]}
          </Badge>
        )}
        {isExpanded && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="text-red-600 hover:text-red-800 font-bold text-lg hover:bg-red-50 rounded p-1 transition-colors flex-shrink-0"
            title="Deletar participante"
          >
            ✕
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Debt Info */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold uppercase text-gray-600">Emprestado</span>
              <span className="text-lg font-black text-black">{formatCurrency(participant.totalLoan)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold uppercase text-gray-600">Saldo Devedor</span>
              <span className="text-lg font-black text-[#FF3D00]">{formatCurrency(participant.currentDebt)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold uppercase text-gray-600">Mensalidade</span>
              <span className="text-sm font-bold text-black">{formatCurrency(monthlyTotal)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          {parseFloat(participant.totalLoan) > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-gray-600">Progresso</span>
                <span className="text-xs font-bold text-gray-600">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 border-2 border-black">
                <div className="h-full bg-[#00C853] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Monthly Payments Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-gray-600">Meses Pagos</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); selectedYear > minYear && setSelectedYear(selectedYear - 1); }}
                  disabled={selectedYear <= minYear}
                  className="h-6 w-6 flex items-center justify-center bg-white border border-black rounded-none hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xs font-black min-w-[40px] text-center">{selectedYear}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); selectedYear < maxYear && setSelectedYear(selectedYear + 1); }}
                  disabled={selectedYear >= maxYear}
                  className="h-6 w-6 flex items-center justify-center bg-white border border-black rounded-none hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {MONTHS.map((month) => {
                const isPaid = !!getPaidRecord(month.value, selectedYear);
                return (
                  <button
                    key={month.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMonthClick(month.value, selectedYear, month.full);
                    }}
                    className={cn(
                      "h-8 flex items-center justify-center text-xs font-bold border-2 border-black transition-all",
                      isPaid
                        ? "bg-[#00C853] text-white hover:bg-[#00a844] cursor-pointer"
                        : "bg-gray-100 text-gray-500 hover:bg-[#e8f5e9] hover:text-[#00C853] cursor-pointer"
                    )}
                    title={isPaid
                      ? `${month.full}/${selectedYear} — Pago ✓ (clique para desmarcar)`
                      : `${month.full}/${selectedYear} — Não pago (clique para pagar)`
                    }
                  >
                    {isPaid ? <Check className="w-3 h-3" /> : month.label.slice(0, 1)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 text-center">
              Verde = pago · Clique para pagar ou desmarcar
            </p>
          </div>

          {/* Unmark Confirmation */}
          <ConfirmationModal
            isOpen={isUnmarkConfirmOpen}
            title="Desmarcar Pagamento"
            description={monthToUnmark
              ? `Desmarcar ${monthToUnmark.label}/${monthToUnmark.year} de ${participant.name}? O mês voltará como não pago.`
              : ''}
            confirmText="Desmarcar"
            cancelText="Cancelar"
            isDangerous={true}
            isLoading={unmarkPaymentMutation.isPending}
            onConfirm={handleConfirmUnmark}
            onCancel={() => { setIsUnmarkConfirmOpen(false); setMonthToUnmark(null); }}
          />

          {/* Pay Month Modal */}
          <Dialog open={isPayMonthOpen} onOpenChange={setIsPayMonthOpen}>
            <DialogContent className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none w-full sm:max-w-[380px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase">Registrar Pagamento</DialogTitle>
                <DialogDescription className="font-medium text-gray-600">
                  {monthToPay
                    ? `Pagar ${monthToPay.label}/${monthToPay.year} para ${participant.name}?`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              {monthToPay && (
                <div className="py-4 space-y-3">
                  <div className="bg-gray-50 border-2 border-black p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase text-gray-600">Participante</span>
                      <span className="text-sm font-black">{participant.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold uppercase text-gray-600">Mês</span>
                      <span className="text-sm font-black">{monthToPay.label}/{monthToPay.year}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-black pt-2">
                      <span className="text-xs font-bold uppercase text-gray-600">Total a pagar</span>
                      <span className="text-lg font-black text-[#00C853]">{formatCurrency(monthlyTotal)}</span>
                    </div>
                    <p className="text-xs text-gray-500">R$ 200,00 cota + {formatCurrency(calculateMonthlyInterest(participant.currentDebt))} juros (10%)</p>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  onClick={() => setIsPayMonthOpen(false)}
                  variant="outline"
                  className="flex-1 border-2 border-black rounded-none font-bold uppercase"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmPay}
                  disabled={paymentMutation.isPending}
                  className="flex-1 bg-[#00C853] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-none font-black uppercase disabled:opacity-50"
                >
                  {paymentMutation.isPending ? 'Pagando...' : 'Confirmar Pagamento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-auto pt-4">
            <Button
              onClick={(e) => { e.stopPropagation(); onPayment?.(); }}
              className="w-full bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none transition-all rounded-none font-bold uppercase text-xs h-12"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Pagar Mensal
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onAmortize?.(); }}
              disabled={participant.currentDebt <= 0}
              variant="outline"
              className="w-full bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none transition-all rounded-none font-bold uppercase text-xs h-12 hover:bg-gray-50"
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Amortizar
            </Button>
          </div>

          <div className="flex gap-2 mt-2">
            <Button
              onClick={(e) => { e.stopPropagation(); onViewHistory?.(); }}
              variant="ghost"
              className="flex-1 text-gray-500 hover:text-black hover:bg-gray-100 font-bold uppercase text-xs h-8"
            >
              <History className="w-3 h-3 mr-2" />
              Histórico
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onViewChart?.(); }}
              variant="ghost"
              className="flex-1 text-gray-500 hover:text-black hover:bg-gray-100 font-bold uppercase text-xs h-8"
            >
              <TrendingDown className="w-3 h-3 mr-2" />
              Gráfico
            </Button>
          </div>

          {/* Edit Actions */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t-2 border-gray-200">
            <Button
              onClick={(e) => { e.stopPropagation(); onEditName?.(); }}
              className="w-full bg-blue-500 text-white border-2 border-blue-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[1px] transition-all rounded-none font-bold uppercase text-xs h-10"
            >
              Editar Nome
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onEditEmail?.(); }}
              className="w-full bg-cyan-500 text-white border-2 border-cyan-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[1px] transition-all rounded-none font-bold uppercase text-xs h-10"
            >
              Editar Email
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onEditLoan?.(); }}
              className="w-full bg-purple-500 text-white border-2 border-purple-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[1px] transition-all rounded-none font-bold uppercase text-xs h-10"
            >
              Editar Empréstimo
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onEditDebt?.(); }}
              className="w-full bg-orange-500 text-white border-2 border-orange-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[1px] transition-all rounded-none font-bold uppercase text-xs h-10"
            >
              Editar Saldo
            </Button>
          </div>
        </>
      )}
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