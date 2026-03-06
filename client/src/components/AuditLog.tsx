import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, CheckCircle, XCircle, TrendingDown, UserPlus, Trash2, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditLogEntry {
  id: number;
  participantId: number;
  participantName: string;
  action: string;
  month?: string | null;
  year?: number | null;
  amount?: string | null;
  description?: string | null;
  createdAt: Date;
}

interface AuditLogProps {
  entries?: AuditLogEntry[];
  participantId?: number;
}

const ACTION_CONFIG: Record<string, {
  label: string;
  icon: any;
  borderColor: string;
  badgeColor: string;
}> = {
  payment_marked:      { label: 'Pagamento Registrado',   icon: CheckCircle,  borderColor: 'border-green-500',  badgeColor: 'bg-green-100 text-green-800 border-green-300' },
  payment_unmarked:    { label: 'Pagamento Desmarcado',   icon: XCircle,      borderColor: 'border-yellow-500', badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  amortization_added:  { label: 'Amortização',            icon: TrendingDown, borderColor: 'border-blue-500',   badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' },
  participant_created: { label: 'Participante Criado',    icon: UserPlus,     borderColor: 'border-purple-500', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
  participant_deleted: { label: 'Participante Deletado',  icon: Trash2,       borderColor: 'border-red-500',    badgeColor: 'bg-red-100 text-red-800 border-red-300' },
  loan_added:          { label: 'Empréstimo Adicionado',  icon: DollarSign,   borderColor: 'border-orange-500', badgeColor: 'bg-orange-100 text-orange-800 border-orange-300' },
};

export function AuditLog({ entries = [] }: AuditLogProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-bold uppercase">Nenhuma alteração registrada</p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <ScrollArea className="h-[320px] w-full border-2 border-black">
      <div className="divide-y-2 divide-gray-100">
        {sorted.map((entry) => {
          const cfg = ACTION_CONFIG[entry.action] ?? {
            label: entry.action,
            icon: History,
            borderColor: 'border-gray-400',
            badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
          };
          const Icon = cfg.icon;
          const date = new Date(entry.createdAt);
          const validDate = !isNaN(date.getTime());

          return (
            <div
              key={entry.id}
              className={`flex gap-3 p-3 border-l-4 ${cfg.borderColor} hover:bg-gray-50 transition-colors`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 border rounded-none ${cfg.badgeColor}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {validDate
                      ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </span>
                </div>

                {entry.participantName && (
                  <p className="text-xs font-bold text-gray-700">{entry.participantName}</p>
                )}

                {entry.month && (
                  <p className="text-xs text-gray-500">
                    Referência: <span className="font-semibold">{entry.month}</span>
                  </p>
                )}

                {entry.amount && parseFloat(entry.amount) > 0 && (
                  <p className="text-xs text-gray-600">
                    Valor: <span className="font-bold">{formatCurrency(parseFloat(entry.amount))}</span>
                  </p>
                )}

                {entry.description && (
                  <p className="text-xs text-gray-400 italic">{entry.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
