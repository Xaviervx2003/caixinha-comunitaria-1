interface DueAlertItem {
  participantId: number;
  name: string;
  level: 'upcoming' | 'due_soon' | 'overdue';
  message: string;
}

interface VencimentoAlertProps {
  alerts?: DueAlertItem[];
  dueDay?: number;
}

export function VencimentoAlert({ alerts = [], dueDay = 5 }: VencimentoAlertProps) {
  if (!alerts.length) return null;

  const overdue = alerts.filter((a) => a.level === 'overdue');
  const dueSoon = alerts.filter((a) => a.level === 'due_soon');
  const upcoming = alerts.filter((a) => a.level === 'upcoming');

  const isOverdue = overdue.length > 0;
  const isUrgent = !isOverdue && dueSoon.length > 0;
  const isWarning = !isOverdue && !isUrgent && upcoming.length > 0;
  if (!isOverdue && !isUrgent && !isWarning) return null;

  const total = alerts.length;
  const sampleNames = alerts.slice(0, 3).map((a) => a.name).join(', ');

  const bgColor = isOverdue ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200';
  const textColor = isOverdue ? 'text-red-700' : isUrgent ? 'text-orange-700' : 'text-yellow-700';
  const dotColor = isOverdue ? 'bg-red-500' : isUrgent ? 'bg-orange-500' : 'bg-yellow-500';

  const message = isOverdue
    ? `${overdue.length} participante(s) em atraso após o dia ${dueDay}.`
    : isUrgent
      ? `${dueSoon.length} participante(s) com vencimento próximo (dia ${dueDay}).`
      : `${upcoming.length} participante(s) com vencimento agendado para dia ${dueDay}.`;

  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${bgColor}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse ${dotColor}`} />
      <div>
        <p className={`text-sm font-bold ${textColor}`}>
          {isOverdue ? '⚠️ Pagamentos em Atraso' : isUrgent ? '🔔 Vencimento Próximo' : '📅 Lembrete de Vencimento'}
        </p>
        <p className={`text-xs mt-0.5 ${textColor} opacity-80`}>{message}</p>
        <p className={`text-xs mt-1 ${textColor} opacity-70`}>
          Total em aberto: {total}. Ex.: {sampleNames}{alerts.length > 3 ? '...' : ''}
        </p>
      </div>
    </div>
  );
}
