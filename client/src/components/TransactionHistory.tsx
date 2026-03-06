import { formatCurrency } from '@/lib/format-currency';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';

interface TransactionHistoryProps {
  transactions?: any[];
  participantId?: number;
  monthlyPayments?: any[];
  onUnmarkPayment?: (paymentId: number) => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  payment:      { label: 'Pagamento Mensal',  icon: Wallet,           color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
  amortization: { label: 'Amortização',       icon: ArrowDownCircle,  color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  loan:         { label: 'Empréstimo',        icon: ArrowUpCircle,    color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
  reversal:     { label: 'Estorno',           icon: ArrowUpCircle,   color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
};

export function TransactionHistory({
  transactions = [],
}: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300">
        <p className="text-sm font-bold uppercase">Nenhuma transação registrada</p>
      </div>
    );
  }

  const sorted = [...transactions].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <ScrollArea className="h-[320px] w-full border-2 border-black">
      <div className="divide-y-2 divide-black">
        {sorted.map((t) => {
          const cfg = TYPE_CONFIG[t.type] ?? {
            label: t.type, icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200',
          };
          const Icon = cfg.icon;
          const date = new Date(t.createdAt);
          const validDate = !isNaN(date.getTime());

          return (
            <div key={t.id} className={`flex items-center gap-3 p-3 ${cfg.bg} border-l-4`}>
              <div className={`${cfg.color} flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase">{cfg.label}</p>
                {t.month && (
                  <p className="text-xs text-gray-500 font-semibold">{t.month}</p>
                )}
                <p className="text-xs text-gray-400">
                  {validDate
                    ? format(date, "dd 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR })
                    : '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-base font-black ${cfg.color}`}>
                  {t.type === 'loan' ? '+' : t.type === 'reversal' ? '' : '-'}{formatCurrency(parseFloat(t.amount))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
