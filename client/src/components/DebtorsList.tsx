import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format-currency';

interface Debtor {
  id: number;
  name: string;
  totalLoan: number;
  currentDebt: number;
  monthlyInterest: number;
}

interface DebtorsListProps {
  debtors: Debtor[];
}

export function DebtorsList({ debtors }: DebtorsListProps) {
  const sortedDebtors = debtors
    .filter((d) => parseFloat(d.currentDebt.toString()) > 0)
    .sort((a, b) => parseFloat(b.currentDebt.toString()) - parseFloat(a.currentDebt.toString()));

  if (sortedDebtors.length === 0) {
    return (
      <div className="bg-[#00C853] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-white text-center">
        <div className="text-4xl font-black mb-2">✓</div>
        <p className="font-bold uppercase">Ninguém deve dinheiro!</p>
        <p className="text-sm opacity-90 mt-2">Todos os empréstimos foram quitados.</p>
      </div>
    );
  }

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6 border-b-4 border-black pb-4">
        <AlertTriangle className="w-6 h-6 text-[#FF3D00]" />
        <h2 className="text-2xl font-black uppercase">Quem Deve</h2>
        <Badge className="bg-[#FF3D00] text-white border-2 border-black rounded-none font-bold">
          {sortedDebtors.length} devedor{sortedDebtors.length !== 1 ? 'es' : ''}
        </Badge>
      </div>

      <div className="grid gap-3">
        {sortedDebtors.map((debtor) => {
          const debtAmount  = parseFloat(debtor.currentDebt.toString());
          const loanAmount  = parseFloat(debtor.totalLoan.toString());
          const paidAmount  = loanAmount - debtAmount;

          // ✅ Guard: evita NaN / Infinity quando loanAmount = 0
          const progressPercent = loanAmount > 0
            ? Math.min(100, Math.max(0, (paidAmount / loanAmount) * 100))
            : 0;

          const monthlyInterest = debtAmount * 0.1;
          const monthlyTotal    = 200 + monthlyInterest;

          return (
            <div
              key={debtor.id}
              className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-black uppercase text-lg leading-tight">{debtor.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">ID: {debtor.id}</p>
                </div>
                <Badge className="bg-[#FF3D00] text-white border-2 border-black rounded-none font-bold text-xs">
                  DEVENDO
                </Badge>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Emprestado</p>
                  <p className="text-xl font-black text-gray-800">{formatCurrency(loanAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#FF3D00] uppercase">Saldo Devedor</p>
                  <p className="text-xl font-black text-[#FF3D00]">{formatCurrency(debtAmount)}</p>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500">Progresso de Amortização</p>
                  <p className="text-xs font-bold text-gray-500">{progressPercent.toFixed(1)}%</p>
                </div>
                <div className="w-full h-3 bg-gray-200 border-2 border-black">
                  <div
                    className="h-full bg-[#00C853] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formatCurrency(paidAmount)} amortizado de {formatCurrency(loanAmount)}
                </p>
              </div>

              {/* Mensalidade */}
              <div className="bg-gray-50 border-2 border-black p-3">
                <p className="text-xs font-black uppercase text-gray-600 mb-2 capitalize">
                  Mensalidade de {mesAtual}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="border-r border-gray-200">
                    <p className="text-xs text-gray-500 font-bold">Cota</p>
                    <p className="font-black text-sm">{formatCurrency(200)}</p>
                  </div>
                  <div className="border-r border-gray-200">
                    <p className="text-xs text-gray-500 font-bold">Juros 10%</p>
                    <p className="font-black text-sm text-[#FF9800]">{formatCurrency(monthlyInterest)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold">Total</p>
                    <p className="font-black text-sm text-[#FF3D00]">{formatCurrency(monthlyTotal)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
