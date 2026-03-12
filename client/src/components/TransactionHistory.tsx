import { formatCurrency } from '@/lib/format-currency';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertCircle, Repeat, BadgeDollarSign } from 'lucide-react';
import { isLatePayment } from '@/lib/finance';

export type TransactionType = 'payment' | 'amortization' | 'loan' | 'reversal';

export interface TxRow {
  id: number | string;
  type: TransactionType;
  amount: number | string;
  month?: string | null;
  createdAt?: string | Date | null;
  balanceBefore?: number | string;
  balanceAfter?: number | string;
  description?: string | null;
}

interface TransactionHistoryProps {
  transactions?: TxRow[];
}

const TYPE_CONFIG: Record<TransactionType, { label: string; icon: any; color: string; bg: string; category: string }> = {
  payment: { label: 'Pagamento Mensal', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', category: 'Receita recorrente' },
  amortization: { label: 'Amortização', icon: ArrowDownCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', category: 'Redução de dívida' },
  loan: { label: 'Empréstimo', icon: ArrowUpCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', category: 'Saída de caixa' },
  reversal: { label: 'Estorno', icon: Repeat, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', category: 'Ajuste contábil' },
};

export function TransactionHistory({ transactions = [] }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-sm font-bold uppercase">Nenhuma transação registrada</p>
      </div>
    );
  }

  const getTime = (dateValue: string | Date | null | undefined) => (dateValue ? new Date(dateValue).getTime() : 0);
  const sorted = [...transactions].sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

  const toNumber = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <ScrollArea className="h-96 w-full border border-gray-200 rounded-lg">
      <div className="divide-y divide-gray-100">
        {sorted.map((t) => {
          const cfg = TYPE_CONFIG[t.type];
          const Icon = cfg.icon;
          const date = t.createdAt ? new Date(t.createdAt) : new Date(NaN);
          const validDate = !isNaN(date.getTime());
          const parsedAmount = toNumber(t.amount);
          const before = toNumber(t.balanceBefore);
          const after = toNumber(t.balanceAfter);
          const isLate = t.type === 'payment' && t.month && validDate ? isLatePayment(t.month, date) : false;
          const signed = t.type === 'loan' ? '+' : t.type === 'reversal' ? '' : '-';

          return (
            <div key={t.id} className={`p-3 ${cfg.bg} border-l-4`}>
              <div className="flex items-start gap-3">
                <div className={`${cfg.color} shrink-0 mt-0.5`}><Icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-black uppercase">{cfg.label}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-bold inline-flex items-center gap-1">
                      <BadgeDollarSign className="w-3 h-3" /> {cfg.category}
                    </span>
                    {isLate && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 uppercase border border-red-200">
                        <AlertCircle className="w-2.5 h-2.5 stroke-[3]" /> Com Multa
                      </span>
                    )}
                  </div>

                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  {t.month && <p className="text-xs text-gray-500 font-semibold">Competência: {t.month}</p>}
                  <p className="text-xs text-gray-400">{validDate ? format(date, "dd 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR }) : '—'}</p>

                  <div className="mt-2 text-[11px] grid grid-cols-3 gap-2 font-semibold">
                    <span className="text-gray-500">Saldo antes: <strong className="text-gray-700">{formatCurrency(before)}</strong></span>
                    <span className="text-gray-500">Evento: <strong className={cfg.color}>{signed}{formatCurrency(parsedAmount)}</strong></span>
                    <span className="text-gray-500">Saldo depois: <strong className="text-gray-700">{formatCurrency(after)}</strong></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-base font-black ${cfg.color}`}>{signed}{formatCurrency(parsedAmount)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
