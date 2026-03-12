import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format-currency';
import { Award, AlertTriangle, ArrowRight, CheckCircle2, TrendingUp, PiggyBank, Scale, Users } from 'lucide-react';
import { Participant, Transaction } from './home/types';

interface CycleClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  allTransactions: Transaction[];
}

type ParticipantStats = {
  name: string;
  isExternal: boolean;
  debt: number;
  capital: number;
  generatedInterest: number;
};

export function CycleClosingModal({ isOpen, onClose, participants, allTransactions }: CycleClosingModalProps) {
  // ── 1. MATEMÁTICA DO FECHAMENTO ──
  let totalCapital = 0;
  let totalProfit = 0;

  const statsMap = new Map<number, ParticipantStats>();

  participants.forEach((p) => {
    statsMap.set(p.id, {
      name: p.name,
      isExternal: p.role === 'external',
      debt: parseFloat(p.currentDebt.toString()),
      capital: 0,
      generatedInterest: 0,
    });
  });

  allTransactions.forEach((t) => {
    const p = statsMap.get(t.participantId);
    if (!p) return;

    const amount = parseFloat(t.amount.toString());
    if (!Number.isFinite(amount) || amount <= 0) return;

    // Pagamento normal entra no caixa; estorno precisa remover os mesmos efeitos.
    const signal = t.type === 'reversal' ? -1 : 1;
    if (t.type !== 'payment' && t.type !== 'reversal') return;

    if (p.isExternal) {
      // Tomador externo não paga cota: tudo é rendimento da caixinha.
      p.generatedInterest += amount * signal;
      totalProfit += amount * signal;
      return;
    }

    // Membro: até R$200 vira capital (cota), acima disso vira lucro/juros.
    const quota = Math.min(amount, 200);
    const interest = Math.max(0, amount - quota);

    p.capital += quota * signal;
    p.generatedInterest += interest * signal;

    totalCapital += quota * signal;
    totalProfit += interest * signal;
  });

  const membersCount = Array.from(statsMap.values()).filter((p) => !p.isExternal).length;
  const totalOutstandingDebt = Array.from(statsMap.values()).reduce((acc, p) => acc + Math.max(0, p.debt), 0);

  // ── 2. PROCESSAR RESULTADOS POR MEMBRO ──
  const results = Array.from(statsMap.values())
    .filter((p) => !p.isExternal || p.debt > 0)
    .map((p) => {
      if (p.isExternal) {
        return {
          ...p,
          profitShare: 0,
          sharePercent: 0,
          grossTarget: 0,
          netPayout: -p.debt,
        };
      }

      const normalizedCapital = Math.max(0, p.capital);
      const normalizedTotalCapital = Math.max(0, totalCapital);
      const sharePercent = normalizedTotalCapital > 0 ? normalizedCapital / normalizedTotalCapital : 0;
      const profitShare = Math.max(0, totalProfit) * sharePercent;
      const grossTarget = normalizedCapital + profitShare;
      const netPayout = grossTarget - p.debt;

      return {
        ...p,
        profitShare,
        sharePercent: sharePercent * 100,
        grossTarget,
        netPayout,
      };
    })
    .sort((a, b) => b.netPayout - a.netPayout);

  // ── 3. RENDERIZAÇÃO ──
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0A0A0A] border border-white/10 shadow-2xl rounded-2xl w-full sm:max-w-[760px] max-h-[90vh] overflow-y-auto text-white">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-black flex items-center gap-3 text-white tracking-tight">
            <Award className="w-8 h-8 text-amber-400" /> Fechamento de Ciclo
          </DialogTitle>
          <DialogDescription className="text-gray-400 font-medium">
            Distribuição justa: <strong className="text-white">Cotas pagas por membro</strong> + participação proporcional no lucro de juros.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Capital Base</p>
            <p className="text-xl font-black text-white">{formatCurrency(Math.max(0, totalCapital))}</p>
          </div>
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Lucro Total
            </p>
            <p className="text-xl font-black text-amber-400">{formatCurrency(Math.max(0, totalProfit))}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
              <PiggyBank className="w-3 h-3" /> Patrimônio
            </p>
            <p className="text-xl font-black text-emerald-400">{formatCurrency(Math.max(0, totalCapital) + Math.max(0, totalProfit))}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> Membros
            </p>
            <p className="text-xl font-black text-blue-300">{membersCount}</p>
          </div>
        </div>

        <div className="mb-5 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-300" />
            Regra: lucro é distribuído apenas para membros e proporcional ao capital de cotas acumulado.
          </div>
          <div className="text-gray-400">Dívida ativa total: <span className="text-white font-bold">{formatCurrency(totalOutstandingDebt)}</span></div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">Distribuição por Participante</h3>

          {results.map((r, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <span className="font-black text-lg text-white flex items-center gap-2">
                  {r.name}
                  {r.isExternal && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Externo</span>}
                </span>

                {r.netPayout >= 0 ? (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Recebe</span>
                    <span className="text-xl font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-5 h-5" /> {formatCurrency(r.netPayout)}
                    </span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Saldo devedor</span>
                    <span className="text-xl font-black text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-5 h-5" /> {formatCurrency(Math.abs(r.netPayout))}
                    </span>
                  </div>
                )}
              </div>

              {!r.isExternal && (
                <div className="flex items-center justify-between bg-black/40 rounded-lg p-3 text-xs font-medium text-gray-400 gap-2">
                  <div className="flex flex-col">
                    <span>Cotas pagas: <span className="text-white font-bold">{formatCurrency(Math.max(0, r.capital))}</span></span>
                    <span className="text-amber-400">+ Lucro ({r.sharePercent.toFixed(1)}%): <span className="font-bold">{formatCurrency(r.profitShare)}</span></span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 mx-2" />
                  <div className="flex flex-col text-right">
                    <span>Bruto: <span className="text-white font-bold">{formatCurrency(r.grossTarget)}</span></span>
                    <span className="text-red-400">- Dívida ativa: <span className="font-bold">{formatCurrency(r.debt)}</span></span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
