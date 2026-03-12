import { useMemo, useState } from 'react';
import {
  Activity, Banknote, Calendar, Download, Percent,
  RotateCcw, TrendingDown, TrendingUp, Upload, History, FileText,
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  Wallet, HandCoins, FlaskConical // Adicionados para o Cofre
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/format-currency';
import { exportToCSV } from '@/lib/csv-export';
import { showErrorToast, showSuccessToast } from '@/lib/toast-utils';
import { Participant, Transaction } from './types';
import { VencimentoAlert } from '@/components/VencimentoAlert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CycleClosingModal } from '../CycleClosingModal';
import { Award } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
// ── Tipos ────────────────────────────────────────────────────
type NextMonthEstimate = {
  nextMonth: string;
  estimatedTotal: string;
  dueDay: number;
  estimatedQuotas: string;
  estimatedInterest: string;
  perParticipant: Array<{ id: number; name: string; total: string; interest: string }>;
};

type DashboardSectionProps = {
  totalFees: number;
  totalInterest: number;
  totalDebts: number;
  balancete?: any;
  isCurrentMonthClosed?: boolean;
  nextMonthEstimate?: NextMonthEstimate;
  isEstimateExpanded: boolean;
  participants: Participant[];
  allTransactions: Transaction[];
  onToggleEstimate: () => void;
  onResetMonth: () => void;
  onImportCSV: () => void;
  onViewAllParticipants: () => void;
  onCloseCycle: () => void;
  monthlyHistory?: Array<{ month: string; totalFeesCollected: string; totalInterestCollected: string }>;
  dueAlerts?: { month: string; dueDay: number; alerts: Array<{ participantId: number; name: string; level: 'upcoming' | 'due_soon' | 'overdue'; message: string }> };
};

// ── Constantes ───────────────────────────────────────────────
const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ── Modal de Snapshot Histórico ──────────────────────────────
function MonthSnapshotModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  const { data: snapshot, isLoading } = trpc.caixinha.getMonthSnapshot.useQuery(
    { month: monthStr },
    { enabled: isOpen }
  );

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const paidRate = snapshot && snapshot.totalParticipants > 0
    ? Math.round((snapshot.paidCount / snapshot.totalParticipants) * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-0 shadow-2xl rounded-2xl w-full sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gray-900">Snapshot Histórico</DialogTitle>
        </DialogHeader>

        {/* Seletor de mês */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 mb-2">
          <button onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-lg font-black text-gray-900">{MONTH_NAMES[selectedMonth - 1]}</p>
            <p className="text-sm text-gray-500 font-medium">{selectedYear}</p>
          </div>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : snapshot ? (
          <div className="space-y-4">
            {/* Cards resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#00C853]/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[#00C853]">{snapshot.paidCount}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Pagos</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-500">{snapshot.unpaidCount}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Pendentes</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-orange-500">{snapshot.lateCount}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Com Multa</p>
              </div>
            </div>

            {/* Total arrecadado */}
            <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
              <span className="text-white font-bold text-sm">Total Arrecadado</span>
              <span className="text-[#00C853] font-black text-xl">{formatCurrency(snapshot.totalCollected)}</span>
            </div>

            {/* Barra adimplência */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-gray-500">
                <span>Taxa de adimplência</span>
                <span>{paidRate}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${paidRate}%`,
                    backgroundColor: paidRate >= 80 ? '#00C853' : paidRate >= 50 ? '#F59E0B' : '#EF4444',
                  }} />
              </div>
            </div>

            {/* Pagos */}
            {snapshot.paidParticipants.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#00C853]" /> Pagos ({snapshot.paidParticipants.length})
                </p>
                <div className="space-y-1">
                  {snapshot.paidParticipants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-bold text-gray-800">{p.name}</span>
                      {(p.paidLate === true || (p.paidLate as any) === 1) && (
                        <span className="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Multa
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Não pagos */}
            {snapshot.unpaidParticipants.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-500" /> Pendentes ({snapshot.unpaidParticipants.length})
                </p>
                <div className="space-y-1">
                  {snapshot.unpaidParticipants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-bold text-gray-800">{p.name}</span>
                      <span className="text-xs font-bold text-red-500">
                        {formatCurrency(parseFloat(p.currentDebt?.toString() || '0'))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot.totalParticipants === 0 && (
              <p className="text-center text-gray-400 py-8 font-bold">Nenhum dado para este mês</p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-12 font-bold">Nenhum dado para este mês</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Gerador de PDF ───────────────────────────────────────────
function generatePDF(participants: Participant[], allTransactions: Transaction[], dueDay: number) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, monthNum] = month.split('-');
  const monthName = MONTH_NAMES[parseInt(monthNum) - 1];

  const monthTx = allTransactions.filter(t => t.month === month);
  const payments = monthTx.filter(t => t.type === 'payment');
  const amortizations = monthTx.filter(t => t.type === 'amortization');
  const paidIds = new Set(payments.map(p => p.participantId));

  const totalCollected = payments.reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);
  const totalAmortized = amortizations.reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);
  const totalDebts = participants.reduce((acc, p) => acc + parseFloat(p.currentDebt.toString()), 0);
  const paidRate = participants.length > 0 ? Math.round((paidIds.size / participants.length) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório ${monthName}/${year}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#111; padding:32px; font-size:13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #000; }
    .header h1 { font-size:22px; font-weight:900; text-transform:uppercase; }
    .header .sub { font-size:11px; color:#666; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
    .header .date { text-align:right; font-size:11px; color:#666; }
    .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
    .card { border:2px solid #000; padding:12px; }
    .card .label { font-size:9px; font-weight:bold; text-transform:uppercase; color:#666; }
    .card .value { font-size:18px; font-weight:900; margin-top:4px; }
    .card.green .value { color:#00a844; }
    .card.red .value { color:#cc2200; }
    .card.blue .value { color:#1a56db; }
    h2 { font-size:11px; font-weight:900; text-transform:uppercase; padding:6px 10px; background:#000; color:#fff; margin-bottom:0; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { background:#f0f0f0; font-size:10px; font-weight:bold; text-transform:uppercase; padding:7px 10px; text-align:left; border:1px solid #ddd; }
    td { padding:7px 10px; border:1px solid #eee; font-size:12px; }
    tr:nth-child(even) td { background:#f9f9f9; }
    .paid { color:#00a844; font-weight:bold; }
    .unpaid { color:#cc2200; font-weight:bold; }
    .footer { margin-top:24px; padding-top:12px; border-top:1px solid #ddd; display:flex; justify-content:space-between; font-size:10px; color:#999; }
    @media print { body { padding:20px; } @page { margin:1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Caixinha Comunitária</h1>
      <div class="sub">Relatório Mensal — ${monthName} de ${year}</div>
    </div>
    <div class="date">Gerado em: ${now.toLocaleDateString('pt-BR')}<br/>Vencimento: dia ${dueDay}</div>
  </div>

  <div class="cards">
    <div class="card green"><div class="label">Arrecadado</div><div class="value">${formatCurrency(totalCollected)}</div></div>
    <div class="card blue"><div class="label">Amortizações</div><div class="value">${formatCurrency(totalAmortized)}</div></div>
    <div class="card red"><div class="label">Dívida Total</div><div class="value">${formatCurrency(totalDebts)}</div></div>
    <div class="card"><div class="label">Adimplência</div><div class="value">${paidRate}%</div></div>
  </div>

  <h2>Status dos Participantes</h2>
  <table>
    <thead><tr><th>#</th><th>Nome</th><th>Saldo Devedor</th><th>Empréstimo Total</th><th>Status</th></tr></thead>
    <tbody>
      ${participants.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td>${formatCurrency(parseFloat(p.currentDebt.toString()))}</td>
          <td>${formatCurrency(parseFloat(p.totalLoan.toString()))}</td>
          <td class="${paidIds.has(p.id) ? 'paid' : 'unpaid'}">${paidIds.has(p.id) ? '✓ PAGO' : '✗ PENDENTE'}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  ${monthTx.length > 0 ? `
  <h2>Transações do Mês</h2>
  <table>
    <thead><tr><th>Participante</th><th>Tipo</th><th>Valor</th><th>Descrição</th></tr></thead>
    <tbody>
      ${monthTx.map(t => {
        const p = participants.find(p => p.id === t.participantId);
        const labels: Record<string, string> = { payment: 'Pagamento', amortization: 'Amortização', loan: 'Empréstimo', reversal: 'Estorno' };
        return `<tr>
          <td>${p?.name || '—'}</td>
          <td>${labels[t.type] || t.type}</td>
          <td><strong>${formatCurrency(parseFloat(t.amount.toString()))}</strong></td>
          <td>${(t as any).description || '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">
    <span>Caixinha Comunitária — Sistema de Gestão</span>
    <span>Gerado em ${now.toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ── Componente Principal ─────────────────────────────────────
export function DashboardSection({
  totalFees,
  totalInterest,
  totalDebts,
  nextMonthEstimate,
  isEstimateExpanded,
  balancete,
  isCurrentMonthClosed = false,
  participants,
  allTransactions,
  onToggleEstimate,
  onResetMonth,
  onImportCSV,
  onViewAllParticipants,
  onCloseCycle,
  monthlyHistory = [],
  dueAlerts,
}: DashboardSectionProps) {
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const [scenarioInterestRate, setScenarioInterestRate] = useState('10');
  const [scenarioAdherence, setScenarioAdherence] = useState('100');
  // ─── MATEMÁTICA DO "DINHEIRO PARADO" (LIQUIDEZ) ──────────────
  // 1. Tudo o que entrou na conta (Mensalidades pagas + Amortizações)
  const totalEntradas = allTransactions
    .filter(t => t.type === 'payment' || t.type === 'amortization')
    .reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);

  // 2. Tudo o que saiu da conta (Empréstimos concedidos + Estornos)
  const totalSaidas = allTransactions
    .filter(t => t.type === 'loan' || t.type === 'reversal')
    .reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);

  // 3. O Dinheiro que está literalmente parado na conta bancária pronto a emprestar
  const caixaDisponivel = totalEntradas - totalSaidas;

  const inadSeg = balancete?.inadimplenciaSegmentada || { membros: 0, externosComDivida: 0, total: 0 };
  const parsedInterestRate = Math.min(100, Math.max(0, Number(scenarioInterestRate) || 0)) / 100;
  const parsedAdherence = Math.min(100, Math.max(0, Number(scenarioAdherence) || 0)) / 100;

  const { data: scenarioResult, isFetching: isScenarioLoading } = trpc.caixinha.simulateScenario.useQuery(
    { interestRate: parsedInterestRate, expectedAdherence: parsedAdherence },
    { enabled: isScenarioOpen }
  );

  const trendData = useMemo(() => {
    return [...monthlyHistory]
      .slice()
      .reverse()
      .map((row) => {
        const fees = parseFloat(row.totalFeesCollected || '0');
        const interest = parseFloat(row.totalInterestCollected || '0');
        return {
          month: row.month,
          arrecadacao: fees + interest,
          patrimonio: fees,
        };
      });
  }, [monthlyHistory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Alerta de Vencimento ── */}
      <VencimentoAlert
        alerts={dueAlerts?.alerts || []}
        dueDay={dueAlerts?.dueDay ?? nextMonthEstimate?.dueDay ?? 5}
      />

      {/* ── O COFRE GIGANTE (CAIXA DISPONÍVEL) ── */}
      <div className="bg-gray-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border-4 border-gray-800">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Wallet className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 text-[#00C853] mb-2">
              <HandCoins className="w-5 h-5" />
              <span className="font-black uppercase tracking-widest text-xs">Caixa Disponível (Dinheiro Parado)</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
              {formatCurrency(caixaDisponivel)}
            </h1>
            <p className="text-gray-400 font-medium text-sm mt-2 max-w-md">
              Este é o valor real que vocês têm em mãos hoje para aprovar novos empréstimos.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 bg-black/40 p-4 rounded-xl backdrop-blur-sm border border-white/10 min-w-[250px]">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase">Total Entradas</span>
              <span className="text-sm font-black text-emerald-400">+{formatCurrency(totalEntradas)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Total Emprestado</span>
              <span className="text-sm font-black text-red-400">-{formatCurrency(totalSaidas)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs font-bold text-gray-400 uppercase">Saldo em Conta</span>
              <span className="text-base font-black text-white">{formatCurrency(caixaDisponivel)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Cotas Arrecadadas', value: formatCurrency(totalFees), icon: Banknote, color: '#00C853', iconBg: '#dcfce7' },
          { label: 'Juros Arrecadados', value: formatCurrency(totalInterest), icon: Percent, color: '#F59E0B', iconBg: '#fef3c7' },
          { label: 'Total em Dívidas', value: formatCurrency(totalDebts), icon: TrendingDown, color: '#EF4444', iconBg: '#fee2e2' },
          { label: 'Total Arrecadado', value: formatCurrency(totalFees + totalInterest), icon: Activity, color: '#8B5CF6', iconBg: '#ede9fe' },
          { label: 'Inadimplência', value: String(inadSeg.total), icon: Clock, color: '#EF4444', iconBg: '#fee2e2' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <div className="p-2 rounded-lg" style={{ backgroundColor: stat.iconBg }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Estimativa Próximo Mês ── */}
      {nextMonthEstimate && (
        <div className="bg-[#0F1117] rounded-xl border border-white/10 overflow-hidden shadow-lg">
          <button onClick={onToggleEstimate} className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-[#00C853]/10 border border-[#00C853]/30 p-3 rounded-xl">
                <TrendingUp className="w-5 h-5 text-[#00C853]" />
              </div>
              <div className="text-left">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Potencial de Arrecadação — {nextMonthEstimate.nextMonth}</p>
                <p className="text-3xl font-black text-[#00C853]">{formatCurrency(parseFloat(nextMonthEstimate.estimatedTotal))}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 text-gray-400 text-xs justify-end mb-1">
                <Calendar className="w-3 h-3" />
                <span>Vence dia <span className="text-white font-bold">{nextMonthEstimate.dueDay}</span></span>
              </div>
              <p className="text-xs text-gray-500">
                Cotas: <span className="text-white">{formatCurrency(parseFloat(nextMonthEstimate.estimatedQuotas))}</span>
                {' + '}Juros: <span className="text-[#F59E0B]">{formatCurrency(parseFloat(nextMonthEstimate.estimatedInterest))}</span>
              </p>
              <p className="text-xs text-[#00C853] mt-1">{isEstimateExpanded ? 'Ocultar ▲' : 'Ver detalhes ▼'}</p>
            </div>
          </button>

          {isEstimateExpanded && (
            <div className="border-t border-white/10 p-6">
              <p className="text-xs font-bold text-gray-500 uppercase mb-4">Por participante</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nextMonthEstimate.perParticipant.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/5">
                    <span className="text-sm font-bold text-gray-300 truncate flex-1">{p.name}</span>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-black text-white">{formatCurrency(parseFloat(p.total))}</p>
                      <p className="text-xs text-gray-500">+{formatCurrency(parseFloat(p.interest))} juros</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── Tendência Mensal (MoM) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-700">Tendência Mensal (MoM)</p>
          <span className="text-xs text-gray-400">Arrecadação e patrimônio por mês</span>
        </div>
        {trendData.length === 0 ? (
          <p className="text-sm text-gray-400">Sem snapshots suficientes para exibir a tendência.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v || 0))} />
                <Legend />
                <Line type="monotone" dataKey="arrecadacao" stroke="#8B5CF6" strokeWidth={2.5} dot={false} name="Arrecadação" />
                <Line type="monotone" dataKey="patrimonio" stroke="#00C853" strokeWidth={2.5} dot={false} name="Patrimônio" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Ações Rápidas ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-700 mb-4">Ações Rápidas</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={onResetMonth}
            className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors">
            <RotateCcw className="w-4 h-4" /> Resetar Mês
          </button>
          <button
            onClick={() => {
              try {
                exportToCSV(
                  participants.map((p) => ({
                    id: p.id, name: p.name,
                    totalLoan: p.totalLoan.toString(),
                    currentDebt: p.currentDebt.toString(),
                    createdAt: p.createdAt?.toString(),
                  })),
                  allTransactions.map((t) => ({
                    id: t.id, participantId: t.participantId,
                    participantName: participants.find((p) => p.id === t.participantId)?.name || '',
                    type: t.type, amount: t.amount.toString(),
                    createdAt: t.createdAt?.toString() || new Date().toISOString(),
                  })),
                  []
                );
                showSuccessToast('Backup exportado!');
              } catch { showErrorToast('Erro ao exportar'); }
            }}
            className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={onImportCSV}
            className="flex items-center gap-2 bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors">
            <Upload className="w-4 h-4" /> Importar CSV
          </button>
          <button onClick={() => setIsSnapshotOpen(true)}
            className="flex items-center gap-2 bg-purple-50 text-purple-600 border border-purple-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-100 transition-colors">
            <History className="w-4 h-4" /> Histórico por Mês
          </button>
          <button onClick={() => setIsClosingOpen(true)}
            className="flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-100 transition-colors">
            <Award className="w-4 h-4" /> Distribuição de Lucros
          </button>
          <button onClick={onCloseCycle} disabled={isCurrentMonthClosed}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-0 shadow-lg px-4 py-2 rounded-lg font-black text-sm hover:from-amber-600 hover:to-yellow-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            <Award className="w-4 h-4" /> {isCurrentMonthClosed ? 'Ciclo Fechado' : 'Fechar Ciclo'}
          </button>
          <button onClick={() => setIsScenarioOpen(true)}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors">
            <FlaskConical className="w-4 h-4" /> Simular Cenário
          </button>
          {/* BOTÃO DO PDF PRESERVADO E FUNCIONAL! */}
          <button onClick={() => generatePDF(participants, allTransactions, nextMonthEstimate?.dueDay ?? 5)}
            className="flex items-center gap-2 bg-gray-800 text-white border border-gray-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-900 transition-colors">
            <FileText className="w-4 h-4" /> Relatório PDF
          </button>
        </div>
      </div>
      {/* ── Resumo dos Membros ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-700">Resumo dos Membros</p>
          <span className="text-xs text-gray-400">{participants.length} participantes</span>
        </div>
        <div className="space-y-3">
          {participants.slice(0, 5).map((p) => {
            const debt = parseFloat(p.currentDebt.toString());
            const loan = parseFloat(p.totalLoan.toString());
            const progress = loan > 0 ? Math.min(100, ((loan - debt) / loan) * 100) : 100;
            return (
              <div key={p.id} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-gray-600">{p.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800 truncate">{p.name}</span>
                    <span className="text-xs font-bold text-red-500 flex-shrink-0 ml-2">{formatCurrency(debt)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full rounded-full bg-[#00C853]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          {participants.length > 5 && (
            <button onClick={onViewAllParticipants} className="text-xs text-[#00C853] font-bold hover:underline">
              Ver todos ({participants.length}) →
            </button>
          )}
        </div>
      </div>


      <Dialog open={isScenarioOpen} onOpenChange={setIsScenarioOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Simulador de Cenários</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">Taxa de juros mensal (%)</p>
              <input value={scenarioInterestRate} onChange={(e) => setScenarioInterestRate(e.target.value)} type="number" min={0} max={100} className="w-full border-2 border-gray-200 rounded-lg px-3 h-10" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">Aderência esperada (%)</p>
              <input value={scenarioAdherence} onChange={(e) => setScenarioAdherence(e.target.value)} type="number" min={0} max={100} className="w-full border-2 border-gray-200 rounded-lg px-3 h-10" />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p><strong>Cenário atual (dashboard):</strong> {formatCurrency(totalFees + totalInterest)}</p>
            <p><strong>Simulado:</strong> {formatCurrency(parseFloat(scenarioResult?.estimatedTotal || '0'))}</p>
            <p><strong>Cotas simuladas:</strong> {formatCurrency(parseFloat(scenarioResult?.estimatedQuotas || '0'))}</p>
            <p><strong>Juros simulados:</strong> {formatCurrency(parseFloat(scenarioResult?.estimatedInterest || '0'))}</p>
            {isScenarioLoading && <p className="text-xs text-gray-500 mt-1">Calculando cenário...</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Snapshot ── */}
      <MonthSnapshotModal isOpen={isSnapshotOpen} onClose={() => setIsSnapshotOpen(false)} />
{/* ── Modal de Fechamento de Ciclo (Dividendos) ── */}
      <CycleClosingModal 
        isOpen={isClosingOpen} 
        onClose={() => setIsClosingOpen(false)} 
        participants={participants} 
        allTransactions={allTransactions} 
      />
    </div>
  );
}