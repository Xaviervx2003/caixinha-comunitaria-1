import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format-currency';

interface Transaction {
  id: number;
  participantId: number;
  type: string;
  amount: number | string;
  month?: string | null;
  year?: number | null;
  createdAt?: string | Date | null;
}

interface DebtEvolutionChartProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
  initialDebt: number;
  currentDebt: number;
  // passa as transações reais do participante
  transactions?: Transaction[];
}

// Monta evolução mês a mês a partir das transações reais
function buildChartData(initialDebt: number, transactions: Transaction[]) {
  if (!transactions || transactions.length === 0) {
    return [
      { label: 'Inicial', saldoDevedor: initialDebt, amortizado: 0, pagamentos: 0 },
      { label: 'Atual',   saldoDevedor: initialDebt, amortizado: 0, pagamentos: 0 },
    ];
  }

  // Agrupa por mês (YYYY-MM) ou por data se não tiver mês
  const byMonth: Record<string, { amortization: number; payment: number; loan: number }> = {};

  // Ordena por data
  const sorted = [...transactions].sort((a, b) =>
    new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
  );

  for (const t of sorted) {
    const key = t.month
      ? t.month // "YYYY-MM"
      : t.createdAt
        ? new Date(t.createdAt as string).toISOString().slice(0, 7)
        : 'indefinido';

    if (!byMonth[key]) byMonth[key] = { amortization: 0, payment: 0, loan: 0 };

    const amt = parseFloat(t.amount.toString());
    if (t.type === 'amortization') byMonth[key].amortization += amt;
    if (t.type === 'payment')      byMonth[key].payment += amt;
    if (t.type === 'loan')         byMonth[key].loan += amt;
  }

  // Constrói a linha do tempo
  const months = Object.keys(byMonth).sort();
  const data: { label: string; saldoDevedor: number; amortizado: number; pagamentos: number }[] = [];

  // Ponto inicial
  data.push({ label: 'Início', saldoDevedor: initialDebt, amortizado: 0, pagamentos: 0 });

  let saldo = initialDebt;
  let totalAmortizado = 0;
  let totalPagamentos = 0;

  for (const month of months) {
    const { amortization, payment, loan } = byMonth[month];
    saldo = saldo + loan - amortization;
    totalAmortizado += amortization;
    totalPagamentos += payment;

    // Formata o label: "2026-03" → "Mar/26"
    const [year, mon] = month.split('-');
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const label = `${monthNames[parseInt(mon) - 1]}/${year?.slice(2)}`;

    data.push({
      label,
      saldoDevedor: Math.max(0, saldo),
      amortizado: totalAmortizado,
      pagamentos: totalPagamentos,
    });
  }

  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs font-bold space-y-1">
      <p className="font-black uppercase border-b border-black pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export function DebtEvolutionChart({
  isOpen,
  onClose,
  participantName,
  initialDebt,
  currentDebt,
  transactions = [],
}: DebtEvolutionChartProps) {
  const chartData = buildChartData(initialDebt, transactions);
  const amortized = initialDebt - currentDebt;
  const percentagePaid = initialDebt > 0 ? ((amortized / initialDebt) * 100).toFixed(1) : '0.0';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase">Evolução da Dívida</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-gray-600">
            {participantName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3">
              <p className="text-xs font-black uppercase text-gray-500">Empréstimo Inicial</p>
              <p className="text-lg font-black">{formatCurrency(initialDebt)}</p>
            </div>
            <div className="bg-[#00C853] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 text-white">
              <p className="text-xs font-black uppercase opacity-80">Amortizado</p>
              <p className="text-lg font-black">{formatCurrency(amortized)}</p>
              <p className="text-xs font-bold opacity-90">{percentagePaid}% quitado</p>
            </div>
            <div className="bg-[#FF3D00] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 text-white">
              <p className="text-xs font-black uppercase opacity-80">Saldo Devedor</p>
              <p className="text-lg font-black">{formatCurrency(currentDebt)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-500">Progresso de quitação</span>
              <span className="text-[#00C853]">{percentagePaid}%</span>
            </div>
            <div className="w-full h-4 bg-gray-200 border-2 border-black">
              <div
                className="h-full bg-[#00C853] transition-all duration-500"
                style={{ width: `${Math.min(100, parseFloat(percentagePaid))}%` }}
              />
            </div>
          </div>

          {/* Chart */}
          <div className="border-2 border-black p-3 bg-white">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF3D00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF3D00" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradAmort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00C853" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#000" />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 'bold' }}
                  stroke="#000"
                  tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontWeight: 'bold' }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="saldoDevedor"
                  stroke="#FF3D00"
                  strokeWidth={3}
                  fill="url(#gradDebt)"
                  dot={{ fill: '#FF3D00', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  name="Saldo Devedor"
                />
                <Area
                  type="monotone"
                  dataKey="amortizado"
                  stroke="#00C853"
                  strokeWidth={3}
                  fill="url(#gradAmort)"
                  dot={{ fill: '#00C853', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  name="Total Amortizado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend info */}
          <div className="flex gap-4 text-xs font-semibold text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#FF3D00] inline-block" />
              Saldo devedor ao longo do tempo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#00C853] inline-block" />
              Total amortizado acumulado
            </span>
          </div>
        </div>

        <Button
          onClick={onClose}
          className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-none font-bold uppercase"
        >
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
