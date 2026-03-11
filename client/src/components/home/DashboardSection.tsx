import {
  Activity,
  Banknote,
  Calendar,
  Download,
  Percent,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import { exportToCSV } from '@/lib/csv-export';
import { showErrorToast, showSuccessToast } from '@/lib/toast-utils';
import { Participant, Transaction } from './types';

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
  nextMonthEstimate?: NextMonthEstimate;
  isEstimateExpanded: boolean;
  participants: Participant[];
  allTransactions: Transaction[];
  onToggleEstimate: () => void;
  onResetMonth: () => void;
  onImportCSV: () => void;
  onViewAllParticipants: () => void;
};

export function DashboardSection({
  totalFees,
  totalInterest,
  totalDebts,
  nextMonthEstimate,
  isEstimateExpanded,
  participants,
  allTransactions,
  onToggleEstimate,
  onResetMonth,
  onImportCSV,
  onViewAllParticipants,
}: DashboardSectionProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cotas Arrecadadas', value: formatCurrency(totalFees), icon: Banknote, color: '#00C853', iconBg: '#dcfce7' },
          { label: 'Juros Arrecadados', value: formatCurrency(totalInterest), icon: Percent, color: '#F59E0B', iconBg: '#fef3c7' },
          { label: 'Total em Dívidas', value: formatCurrency(totalDebts), icon: TrendingDown, color: '#EF4444', iconBg: '#fee2e2' },
          { label: 'Total Arrecadado', value: formatCurrency(totalFees + totalInterest), icon: Activity, color: '#8B5CF6', iconBg: '#ede9fe' },
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

      {nextMonthEstimate && (
        <div className="bg-[#0F1117] rounded-xl border border-white/10 overflow-hidden shadow-lg">
          <button onClick={onToggleEstimate} className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-[#00C853]/10 border border-[#00C853]/30 p-3 rounded-xl">
                <TrendingUp className="w-5 h-5 text-[#00C853]" />
              </div>
              <div className="text-left">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Estimativa — {nextMonthEstimate.nextMonth}</p>
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

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-700 mb-4">Ações Rápidas</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onResetMonth}
            className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Resetar Mês
          </button>
          <button
            onClick={() => {
              try {
                exportToCSV(
                  participants.map((p) => ({
                    id: p.id,
                    name: p.name,
                    totalLoan: p.totalLoan.toString(),
                    currentDebt: p.currentDebt.toString(),
                    createdAt: p.createdAt?.toString(),
                  })),
                  allTransactions.map((t) => ({
                    id: t.id,
                    participantId: t.participantId,
                    participantName: participants.find((p) => p.id === t.participantId)?.name || '',
                    type: t.type,
                    amount: t.amount.toString(),
                    createdAt: t.createdAt?.toString() || new Date().toISOString(),
                  })),
                  []
                );
                showSuccessToast('Backup exportado!');
              } catch {
                showErrorToast('Erro ao exportar');
              }
            }}
            className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={onImportCSV}
            className="flex items-center gap-2 bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors"
          >
            <Upload className="w-4 h-4" /> Importar CSV
          </button>
        </div>
      </div>

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
    </div>
  );
}
