import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ParticipantCard } from '@/components/ParticipantCard';
import { TransactionHistory } from '@/components/TransactionHistory';
import { AuditLog } from '@/components/AuditLog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus, PiggyBank, AlertTriangle, LayoutDashboard, Users,
  ArrowLeftRight, Settings, X, LogOut, RotateCcw, Download, Upload,
} from 'lucide-react';
import { getLoginUrl } from '@/const';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useLocalCache } from '@/hooks/use-local-cache';
import { exportToCSV } from '@/lib/csv-export';
import { ImportCSVModal } from '@/components/ImportCSVModal';
import { ImportedParticipant, ImportedTransaction } from '@/lib/csv-import';
import { DebtEvolutionChart } from '@/components/DebtEvolutionChart';
import { DebtorsList } from '@/components/DebtorsList';
import { formatCurrency } from '@/lib/format-currency';
import { HomeSidebar } from '@/components/home/HomeSidebar';
import { HomeTopbar } from '@/components/home/HomeTopbar';
import { DashboardSection } from '@/components/home/DashboardSection';
import { MONTHS, NavSection, Participant, Transaction, AuditEntry } from '@/components/home/types';
import { showSuccessToast, showErrorToast } from '@/lib/toast-utils';
import { ConfirmationModal } from '@/components/ConfirmationModal';

const NAV_ITEMS: { id: NavSection; label: string; icon: any; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'participantes', label: 'Participantes', icon: Users },
  { id: 'devedores', label: 'Devedores', icon: AlertTriangle },
  { id: 'transacoes', label: 'Transações', icon: ArrowLeftRight },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { saveToCache, CACHE_KEYS } = useLocalCache();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: participants = [], isLoading } = trpc.caixinha.listParticipants.useQuery(undefined, { enabled: isAuthenticated }) as { data: Participant[]; isLoading: boolean };
  const { data: allTransactions = [] } = trpc.caixinha.getAllTransactions.useQuery(undefined, { enabled: isAuthenticated }) as { data: Transaction[] };
  const { data: auditLogEntries = [] } = trpc.caixinha.getAuditLog.useQuery({ limit: 50 }, { enabled: isAuthenticated }) as { data: AuditEntry[] };
  const { data: nextMonthEstimate } = trpc.caixinha.getNextMonthEstimate.useQuery(undefined, { enabled: isAuthenticated });

  const getOrCreateCaixinhaMutation = trpc.caixinha.getOrCreateCaixinha.useMutation({
    onSuccess: (data) => console.log('✅ Caixinha pronta:', data),
    onError: (error) => console.error('❌ Erro:', error.message),
  });

  useEffect(() => { if (isAuthenticated) getOrCreateCaixinhaMutation.mutate(); }, [isAuthenticated]);
  useEffect(() => { if (participants.length > 0) saveToCache(CACHE_KEYS.PARTICIPANTS, participants); }, [participants]);
  useEffect(() => { if (allTransactions.length > 0) saveToCache(CACHE_KEYS.TRANSACTIONS, allTransactions); }, [allTransactions]);

  const invalidateAll = () => {
    utils.caixinha.listParticipants.invalidate();
    utils.caixinha.getAllTransactions.invalidate();
    utils.caixinha.getMonthlyPayments.invalidate();
    utils.caixinha.getAuditLog.invalidate();
    utils.caixinha.getNextMonthEstimate.invalidate();
  };

  const addParticipantMutation = trpc.caixinha.addParticipant.useMutation({ onSuccess: invalidateAll });
  const addLoanMutation = trpc.caixinha.addLoan.useMutation({ onSuccess: invalidateAll });
  const paymentMutation = trpc.caixinha.registerPayment.useMutation({ onSuccess: invalidateAll, onError: (e) => showErrorToast(e.message) });
  const amortizeMutation = trpc.caixinha.registerAmortization.useMutation({ onSuccess: invalidateAll });
  const resetMonthMutation = trpc.caixinha.resetMonth.useMutation({ onSuccess: invalidateAll });
  const updateLoanMutation = trpc.caixinha.updateParticipantLoan.useMutation({ onSuccess: invalidateAll });
  const updateDebtMutation = trpc.caixinha.updateParticipantDebt.useMutation({ onSuccess: invalidateAll });
  const updateNameMutation = trpc.caixinha.updateParticipantName.useMutation({ onSuccess: () => utils.caixinha.listParticipants.invalidate() });
  const updateEmailMutation = trpc.caixinha.updateParticipantEmail.useMutation({ onSuccess: () => utils.caixinha.listParticipants.invalidate() });
  const deleteParticipantMutation = trpc.caixinha.deleteParticipant.useMutation({ onSuccess: invalidateAll });
  const updateSettingsMutation = trpc.caixinha.updateCaixinhaSettings.useMutation({ onSuccess: () => showSuccessToast('Configurações salvas!') });

  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isAmortizeOpen, setIsAmortizeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [isEditDebtOpen, setIsEditDebtOpen] = useState(false);
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [isEditEmailOpen, setIsEditEmailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isEstimateExpanded, setIsEstimateExpanded] = useState(false);
  const [chartParticipantId, setChartParticipantId] = useState<number | null>(null);

  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantLoan, setNewParticipantLoan] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [amortizeAmount, setAmortizeAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [editLoanAmount, setEditLoanAmount] = useState('');
  const [editDebtAmount, setEditDebtAmount] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  const [editEmailValue, setEditEmailValue] = useState('');
  const [paymentMonth, setPaymentMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [paymentYear, setPaymentYear] = useState(new Date().getFullYear().toString());
  const [settingsDueDay, setSettingsDueDay] = useState('5');
  const [settingsName, setSettingsName] = useState('');

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const totalPaymentAmount = allTransactions.filter((t) => t.type === 'payment').reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);
  const totalAmortizationAmount = allTransactions.filter((t) => t.type === 'amortization').reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0);
  const paymentCount = allTransactions.filter((t) => t.type === 'payment').length;
  const MONTHLY_FEE = 200;
  const totalFees = paymentCount * MONTHLY_FEE + totalAmortizationAmount;
  const totalInterest = totalPaymentAmount - paymentCount * MONTHLY_FEE;
  const totalDebts = participants.reduce((acc, p) => acc + parseFloat(p.currentDebt.toString()), 0);

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) { showErrorToast('Nome obrigatório'); return; }
    try { await getOrCreateCaixinhaMutation.mutateAsync(); } catch { showErrorToast('Erro ao inicializar caixinha'); return; }
    try {
      await addParticipantMutation.mutateAsync({ name: newParticipantName.trim(), email: newParticipantEmail.trim() || undefined, totalLoan: newParticipantLoan ? parseFloat(newParticipantLoan) : 0 });
      setIsAddParticipantOpen(false); setNewParticipantName(''); setNewParticipantEmail(''); setNewParticipantLoan('');
      showSuccessToast(`${newParticipantName} adicionado!`);
    } catch { showErrorToast('Erro ao adicionar participante'); }
  };
  const handleAddLoan = async () => {
    if (!selectedParticipantId || !loanAmount) return;
    const amount = parseFloat(loanAmount);
    if (isNaN(amount) || amount <= 0) { showErrorToast('Valor inválido'); return; }
    try { await addLoanMutation.mutateAsync({ participantId: selectedParticipantId, amount }); setIsAddLoanOpen(false); setLoanAmount(''); showSuccessToast(`Empréstimo de ${formatCurrency(amount)} registrado!`); } catch { showErrorToast('Erro'); }
  };
  const handlePayment = async () => {
    if (!selectedParticipantId) return;
    try {
      await paymentMutation.mutateAsync({ participantId: selectedParticipantId, month: `${paymentYear}-${paymentMonth}`, year: parseInt(paymentYear) });
      setIsPaymentOpen(false);
      showSuccessToast(`Pagamento registrado!`);
    } catch { showErrorToast('Erro ao registrar pagamento'); }
  };
  const handleAmortize = async () => {
    if (!selectedParticipantId || !amortizeAmount) return;
    const amount = parseFloat(amortizeAmount);
    if (isNaN(amount) || amount <= 0) { showErrorToast('Valor inválido'); return; }
    const currentDebt = selectedParticipant?.currentDebt ? parseFloat(selectedParticipant.currentDebt.toString()) : 0;
    if (amount > currentDebt) { showErrorToast('Valor maior que a dívida atual.'); return; }
    try { await amortizeMutation.mutateAsync({ participantId: selectedParticipantId, amount }); setIsAmortizeOpen(false); setAmortizeAmount(''); showSuccessToast(`Amortização registrada!`); } catch { showErrorToast('Erro'); }
  };
  const handleResetMonth = async () => {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await resetMonthMutation.mutateAsync({ month, year: now.getFullYear() });
      setIsResetConfirmOpen(false); showSuccessToast('Mês resetado!');
    } catch { showErrorToast('Erro ao resetar mês'); }
  };
  const handleEditLoan = async () => {
    if (!selectedParticipantId || !editLoanAmount) return;
    const amount = parseFloat(editLoanAmount);
    if (isNaN(amount) || amount < 0) { showErrorToast('Valor inválido'); return; }
    try { await updateLoanMutation.mutateAsync({ participantId: selectedParticipantId, newTotalLoan: amount }); setIsEditLoanOpen(false); setEditLoanAmount(''); showSuccessToast('Atualizado!'); } catch { showErrorToast('Erro'); }
  };
  const handleEditDebt = async () => {
    if (!selectedParticipantId || !editDebtAmount) return;
    const amount = parseFloat(editDebtAmount);
    if (isNaN(amount) || amount < 0) { showErrorToast('Valor inválido'); return; }
    try { await updateDebtMutation.mutateAsync({ participantId: selectedParticipantId, newCurrentDebt: amount }); setIsEditDebtOpen(false); setEditDebtAmount(''); showSuccessToast('Atualizado!'); } catch { showErrorToast('Erro'); }
  };
  const handleEditName = async () => {
    if (!selectedParticipantId || !editNameValue) return;
    try { await updateNameMutation.mutateAsync({ participantId: selectedParticipantId, newName: editNameValue }); setIsEditNameOpen(false); setEditNameValue(''); showSuccessToast('Nome atualizado!'); } catch { showErrorToast('Erro'); }
  };
  const handleEditEmail = async () => {
    if (!selectedParticipantId) return;
    try { await updateEmailMutation.mutateAsync({ participantId: selectedParticipantId, email: editEmailValue || undefined }); setIsEditEmailOpen(false); setEditEmailValue(''); showSuccessToast('Email atualizado!'); } catch { showErrorToast('Erro'); }
  };
  const handleDeleteParticipant = async () => {
    if (!selectedParticipantId) return;
    try { await deleteParticipantMutation.mutateAsync({ participantId: selectedParticipantId }); setIsDeleteConfirmOpen(false); setSelectedParticipantId(null); showSuccessToast('Participante deletado!'); } catch { showErrorToast('Erro'); }
  };
  const handleImportCSV = async (importedParticipants: ImportedParticipant[], _: ImportedTransaction[]) => {
    try { for (const p of importedParticipants) await addParticipantMutation.mutateAsync({ name: p.name, totalLoan: p.totalLoan }); }
    catch { showErrorToast('Erro ao importar'); throw new Error('Import failed'); }
  };
  const handleSaveSettings = async () => {
    const day = parseInt(settingsDueDay);
    if (isNaN(day) || day < 1 || day > 28) { showErrorToast('Dia inválido (1-28)'); return; }
    try {
      await updateSettingsMutation.mutateAsync({
        paymentDueDay: day,
        ...(settingsName.trim() ? { name: settingsName.trim() } : {}),
      });
    } catch { showErrorToast('Erro ao salvar configurações'); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-[#00C853] p-3 rounded-xl">
              <PiggyBank className="w-10 h-10 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-white tracking-tight">Caixinha</h1>
              <p className="text-[#00C853] text-sm font-bold uppercase tracking-widest">Comunitária</p>
            </div>
          </div>
          <p className="text-gray-400 mb-8">Faça login para acessar sua caixinha</p>
          <button onClick={() => window.location.href = getLoginUrl()}
            className="bg-[#00C853] text-white px-8 py-3 font-bold rounded-lg hover:bg-[#00a844] transition-colors">
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  const debtors = participants.filter(p => parseFloat(p.currentDebt.toString()) > 0).length;

  return (
    <div className="flex h-screen bg-[#F4F5F7] overflow-hidden">
      <OfflineIndicator />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <HomeSidebar
        sidebarOpen={sidebarOpen}
        activeSection={activeSection}
        navItems={NAV_ITEMS}
        debtors={debtors}
        userName={user?.name}
        onSelectSection={(section) => {
          setActiveSection(section);
          setSidebarOpen(false);
        }}
      />

      {/* ── CONTEÚDO PRINCIPAL ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <HomeTopbar
          activeSection={activeSection}
          activeSectionLabel={NAV_ITEMS.find((n) => n.id === activeSection)?.label || 'Dashboard'}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenAddParticipant={() => setIsAddParticipantOpen(true)}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeSection === 'dashboard' && (
            <DashboardSection
              totalFees={totalFees}
              totalInterest={totalInterest}
              totalDebts={totalDebts}
              nextMonthEstimate={nextMonthEstimate as any}
              isEstimateExpanded={isEstimateExpanded}
              participants={participants}
              allTransactions={allTransactions}
              onToggleEstimate={() => setIsEstimateExpanded(!isEstimateExpanded)}
              onResetMonth={() => setIsResetConfirmOpen(true)}
              onImportCSV={() => setIsImportOpen(true)}
              onViewAllParticipants={() => setActiveSection('participantes')}
            />
          )}

          {/* ── PARTICIPANTES ──────────────────────────────────────── */}
          {activeSection === 'participantes' && (
            <div className="max-w-7xl mx-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Carregando participantes...</p>
                  </div>
                </div>
              ) : participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-gray-100 rounded-full p-6 mb-4">
                    <Users className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">Nenhum participante ainda</h3>
                  <p className="text-gray-500 text-sm mb-6">Adicione o primeiro membro da caixinha</p>
                  <button onClick={() => setIsAddParticipantOpen(true)}
                    className="flex items-center gap-2 bg-[#00C853] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#00a844] transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar Primeiro Membro
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {participants.map((participant) => (
                    <ParticipantCard
                      key={participant.id}
                      participant={participant}
                      onPayment={() => { setSelectedParticipantId(participant.id); setIsPaymentOpen(true); }}
                      onAmortize={() => { setSelectedParticipantId(participant.id); setAmortizeAmount(''); setIsAmortizeOpen(true); }}
                      onAddLoan={() => { setSelectedParticipantId(participant.id); setLoanAmount(''); setIsAddLoanOpen(true); }}
                      onViewHistory={() => { setSelectedParticipantId(participant.id); setIsHistoryOpen(true); }}
                      onEditLoan={() => { setSelectedParticipantId(participant.id); setEditLoanAmount(parseFloat(participant.totalLoan.toString()).toString()); setIsEditLoanOpen(true); }}
                      onEditDebt={() => { setSelectedParticipantId(participant.id); setEditDebtAmount(parseFloat(participant.currentDebt.toString()).toString()); setIsEditDebtOpen(true); }}
                      onEditName={() => { setSelectedParticipantId(participant.id); setEditNameValue(participant.name); setIsEditNameOpen(true); }}
                      onEditEmail={() => { setSelectedParticipantId(participant.id); setEditEmailValue(participant.email || ''); setIsEditEmailOpen(true); }}
                      onDelete={() => { setSelectedParticipantId(participant.id); setIsDeleteConfirmOpen(true); }}
                      onViewChart={() => { setChartParticipantId(participant.id); setIsChartOpen(true); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DEVEDORES ──────────────────────────────────────────── */}
          {activeSection === 'devedores' && (
            <div className="max-w-4xl mx-auto">
              <DebtorsList debtors={participants.map((p) => ({
                id: p.id, name: p.name,
                totalLoan: parseFloat(p.totalLoan.toString()),
                currentDebt: parseFloat(p.currentDebt.toString()),
                monthlyInterest: parseFloat(p.currentDebt.toString()) * 0.1,
              }))} />
            </div>
          )}

          {/* ── TRANSAÇÕES ─────────────────────────────────────────── */}
          {activeSection === 'transacoes' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800">Todas as Transações</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{allTransactions.length} registros</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {allTransactions.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">Nenhuma transação registrada.</div>
                  ) : (
                    allTransactions.slice().reverse().map((t) => {
                      const p = participants.find(p => p.id === t.participantId);
                      const isPayment = t.type === 'payment';
                      const isAmort = t.type === 'amortization';
                      const isLoan = t.type === 'loan';
                      const color = isPayment ? 'text-[#00C853]' : isAmort ? 'text-blue-500' : isLoan ? 'text-orange-500' : 'text-red-500';
                      const sign = isPayment || isAmort ? '+' : '-';
                      const label = isPayment ? 'Pagamento' : isAmort ? 'Amortização' : isLoan ? 'Empréstimo' : 'Estorno';
                      const bgBadge = isPayment ? 'bg-green-50 text-green-700' : isAmort ? 'bg-blue-50 text-blue-700' : isLoan ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700';
                      return (
                        <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-gray-500">{p?.name?.charAt(0) ?? '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{p?.name ?? 'Desconhecido'}</p>
                            <p className="text-xs text-gray-400 truncate">{t.description || (t.month ? `Ref: ${t.month}` : '')}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${bgBadge} flex-shrink-0 hidden sm:inline`}>{label}</span>
                          <span className={`text-sm font-black flex-shrink-0 ${color}`}>
                            {sign}{formatCurrency(parseFloat(t.amount.toString()))}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800">Log de Auditoria</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {auditLogEntries.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">Nenhum registro de auditoria.</div>
                  ) : (
                    auditLogEntries.slice(0, 30).map((e) => (
                      <div key={e.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50">
                        <div className="w-2 h-2 rounded-full bg-[#00C853] mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800">{e.participantName}</p>
                          <p className="text-xs text-gray-500 truncate">{e.description || e.action}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {e.createdAt ? new Date(e.createdAt.toString()).toLocaleDateString('pt-BR') : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── CONFIGURAÇÕES ──────────────────────────────────────── */}
          {activeSection === 'configuracoes' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-black text-gray-900 mb-1">Configurações da Caixinha</h2>
                <p className="text-sm text-gray-500 mb-6">Personalize as regras da sua caixinha</p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Caixinha</label>
                    <input
                      type="text"
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      placeholder="Ex: Caixinha do Trabalho"
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00C853] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Dia de Vencimento</label>
                    <input
                      type="number"
                      value={settingsDueDay}
                      onChange={(e) => setSettingsDueDay(e.target.value)}
                      min={1} max={28}
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00C853] transition-colors"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">Dia do mês seguinte em que o pagamento vence. Padrão: 5.</p>
                  </div>

                  <div className="pt-2">
                    <button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}
                      className="w-full bg-[#00C853] text-white py-3 rounded-lg font-bold hover:bg-[#00a844] transition-colors disabled:opacity-50">
                      {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-black text-gray-900 mb-1">Zona de Perigo</h2>
                <p className="text-sm text-gray-500 mb-4">Ações irreversíveis</p>
                <button onClick={() => setIsResetConfirmOpen(true)}
                  className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors">
                  <RotateCcw className="w-4 h-4" /> Resetar Mês Atual
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-black text-gray-900 mb-1">Backup de Dados</h2>
                <p className="text-sm text-gray-500 mb-4">Exporte ou importe seus dados</p>
                <div className="flex gap-3">
                  <button onClick={() => {
                    try {
                      exportToCSV(
                        participants.map(p => ({ id: p.id, name: p.name, totalLoan: p.totalLoan.toString(), currentDebt: p.currentDebt.toString(), createdAt: p.createdAt?.toString() })),
                        allTransactions.map(t => ({ id: t.id, participantId: t.participantId, participantName: participants.find(p => p.id === t.participantId)?.name || '', type: t.type, amount: t.amount.toString(), createdAt: t.createdAt?.toString() || new Date().toISOString() })),
                        []
                      );
                      showSuccessToast('Backup exportado!');
                    } catch { showErrorToast('Erro'); }
                  }}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors">
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                  <button onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-2 bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors">
                    <Upload className="w-4 h-4" /> Importar CSV
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Novo Participante</DialogTitle>
            <DialogDescription className="text-gray-500">Adicione um novo membro à Caixinha.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Nome</Label>
              <Input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} className="border-2 rounded-lg h-11" placeholder="João Silva" />
            </div>
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Email (opcional)</Label>
              <Input type="email" value={newParticipantEmail} onChange={(e) => setNewParticipantEmail(e.target.value)} className="border-2 rounded-lg h-11" placeholder="joao@email.com" />
            </div>
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Valor do Empréstimo</Label>
              <Input type="number" value={newParticipantLoan} onChange={(e) => setNewParticipantLoan(e.target.value)} className="border-2 rounded-lg h-11" placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddParticipant} disabled={addParticipantMutation.isPending}
              className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] disabled:opacity-50 border-0">
              Adicionar Participante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Empréstimo Adicional</DialogTitle>
            <DialogDescription>Para {selectedParticipant?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Valor (R$)</Label>
              <Input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="border-2 rounded-lg h-11" placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddLoan} disabled={addLoanMutation.isPending} className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] disabled:opacity-50 border-0">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Registrar Pagamento</DialogTitle>
            <DialogDescription>Pagamento de {selectedParticipant?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Mês</Label>
              <select value={paymentMonth} onChange={(e) => setPaymentMonth(e.target.value)} className="border-2 border-gray-200 rounded-lg h-11 px-3 font-medium text-sm focus:outline-none focus:border-[#00C853]">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Ano</Label>
              <select value={paymentYear} onChange={(e) => setPaymentYear(e.target.value)} className="border-2 border-gray-200 rounded-lg h-11 px-3 font-medium text-sm focus:outline-none focus:border-[#00C853]">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePayment} disabled={paymentMutation.isPending} className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] disabled:opacity-50 border-0">Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAmortizeOpen} onOpenChange={setIsAmortizeOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Amortizar Dívida</DialogTitle>
            <DialogDescription>Abater valor da dívida de {selectedParticipant?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="font-bold text-sm">Valor (R$)</Label>
              <Input type="number" value={amortizeAmount} onChange={(e) => setAmortizeAmount(e.target.value)} className="border-2 rounded-lg h-11" placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAmortize} disabled={amortizeMutation.isPending} className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] disabled:opacity-50 border-0">Confirmar Amortização</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Histórico: {selectedParticipant?.name}</DialogTitle>
            <DialogDescription>Extrato completo</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {selectedParticipant && (
              <>
                <TransactionHistory participantId={selectedParticipant.id} transactions={allTransactions.filter(t => t.participantId === selectedParticipant.id)} monthlyPayments={selectedParticipant.monthlyPayments || []} onUnmarkPayment={() => {}} />
                <AuditLog entries={auditLogEntries.filter(e => e.participantId === selectedParticipant.id)} participantId={selectedParticipant.id} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryOpen(false)} className="w-full bg-gray-900 text-white rounded-lg h-11 font-bold border-0">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl font-black">Editar Empréstimo</DialogTitle><DialogDescription>{selectedParticipant?.name}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid gap-2"><Label className="font-bold text-sm">Valor Total (R$)</Label><Input type="number" value={editLoanAmount} onChange={(e) => setEditLoanAmount(e.target.value)} className="border-2 rounded-lg h-11" /></div></div>
          <DialogFooter><Button onClick={handleEditLoan} disabled={updateLoanMutation.isPending} className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] border-0 disabled:opacity-50">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDebtOpen} onOpenChange={setIsEditDebtOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl font-black">Editar Saldo Devedor</DialogTitle><DialogDescription>{selectedParticipant?.name}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid gap-2"><Label className="font-bold text-sm">Saldo Devedor (R$)</Label><Input type="number" value={editDebtAmount} onChange={(e) => setEditDebtAmount(e.target.value)} className="border-2 rounded-lg h-11" /></div></div>
          <DialogFooter><Button onClick={handleEditDebt} disabled={updateDebtMutation.isPending} className="w-full bg-[#00C853] text-white rounded-lg h-11 font-bold hover:bg-[#00a844] border-0 disabled:opacity-50">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl font-black">Editar Nome</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid gap-2"><Label className="font-bold text-sm">Nome</Label><Input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="border-2 rounded-lg h-11" /></div></div>
          <DialogFooter><Button onClick={handleEditName} disabled={updateNameMutation.isPending} className="w-full bg-blue-500 text-white rounded-lg h-11 font-bold hover:bg-blue-600 border-0 disabled:opacity-50">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditEmailOpen} onOpenChange={setIsEditEmailOpen}>
        <DialogContent className="bg-white rounded-xl border-0 shadow-2xl w-full sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl font-black">Editar Email</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid gap-2"><Label className="font-bold text-sm">Email</Label><Input type="email" value={editEmailValue} onChange={(e) => setEditEmailValue(e.target.value)} className="border-2 rounded-lg h-11" /></div></div>
          <DialogFooter><Button onClick={handleEditEmail} disabled={updateEmailMutation.isPending} className="w-full bg-cyan-500 text-white rounded-lg h-11 font-bold hover:bg-cyan-600 border-0 disabled:opacity-50">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal isOpen={isDeleteConfirmOpen} title="Deletar Participante"
        description={selectedParticipant ? `Deletar ${selectedParticipant.name}? Ação irreversível.` : ''}
        confirmText="Deletar" cancelText="Cancelar" isDangerous={true}
        isLoading={deleteParticipantMutation.isPending}
        onConfirm={handleDeleteParticipant} onCancel={() => setIsDeleteConfirmOpen(false)} />

      <ConfirmationModal isOpen={isResetConfirmOpen} title="Resetar Mês"
        description="Todos os pagamentos do mês atual serão zerados. Irreversível."
        confirmText="Resetar" cancelText="Cancelar" isDangerous={true}
        isLoading={resetMonthMutation.isPending}
        onConfirm={handleResetMonth} onCancel={() => setIsResetConfirmOpen(false)} />

      <ImportCSVModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImportCSV} />

      {chartParticipantId && (() => {
        const p = participants.find(p => p.id === chartParticipantId);
        if (!p) return null;
        return (
          <DebtEvolutionChart isOpen={isChartOpen} onClose={() => { setIsChartOpen(false); setChartParticipantId(null); }}
            participantName={p.name || 'Desconhecido'}
            initialDebt={parseFloat(p.totalLoan?.toString() || '0')}
            currentDebt={parseFloat(p.currentDebt?.toString() || '0')}
            transactions={allTransactions.filter(t => t.participantId === chartParticipantId)} />
        );
      })()}
    </div>
  );
}
