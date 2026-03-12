import Decimal from "decimal.js";

// ─────────────────────────────────────────────────────
// 1. CONFIGURAÇÃO GLOBAL (Única Fonte da Verdade)
// ─────────────────────────────────────────────────────
export const CAIXINHA_CONFIG = {
  MONTHLY_QUOTA: new Decimal("200.00"),
  INTEREST_RATE: new Decimal("0.10"),       // 10% juros sobre dívida ativa
  LATE_FEE_RATE: new Decimal("0.02"),       // 2% de multa por atraso sobre a cota
  LATE_INTEREST_RATE: new Decimal("0.01"),  // 1% de juros de mora por mês sobre a cota
  DEFAULT_DUE_DAY: 5,                       // dia 5 do mês seguinte
  MAX_LOAN_AMOUNT: new Decimal("999999.99"),
} as const;

// Constantes de retrocompatibilidade para o Frontend
export const MONTHLY_FEE = 200;
export const INTEREST_RATE = 0.10;

// ─────────────────────────────────────────────────────
// 2. LÓGICA CORE (Usada pelo Backend e Frontend)
// ─────────────────────────────────────────────────────

// 🟢 ATUALIZADO: Aceita o "role" para isentar a cota se for externo
export function calcMonthlyPayment(currentDebt: Decimal, role: 'member' | 'external' = 'member') {
  const interest = currentDebt
    .mul(CAIXINHA_CONFIG.INTEREST_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const quota = role === 'external' ? new Decimal(0) : CAIXINHA_CONFIG.MONTHLY_QUOTA;

  const total = quota
    .add(interest)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { quota, interest, total };
}

// 🟢 ATUALIZADO: A multa é sobre a cota. Externo não paga cota, logo não tem multa fixa.
export function calcLatePaymentFee(role: 'member' | 'external' = 'member'): {
  lateFee: Decimal;
  lateInterest: Decimal;
  totalLateCharge: Decimal;
} {
  const baseValue = role === 'external' ? new Decimal(0) : CAIXINHA_CONFIG.MONTHLY_QUOTA;

  const lateFee = baseValue
    .mul(CAIXINHA_CONFIG.LATE_FEE_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const lateInterest = baseValue
    .mul(CAIXINHA_CONFIG.LATE_INTEREST_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const totalLateCharge = lateFee
    .add(lateInterest)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { lateFee, lateInterest, totalLateCharge };
}

export function calcLateMonthlyPayment(currentDebt: Decimal, role: 'member' | 'external' = 'member') {
  const { quota, interest, total: normalTotal } = calcMonthlyPayment(currentDebt, role);
  const { lateFee, lateInterest, totalLateCharge } = calcLatePaymentFee(role);

  const total = normalTotal
    .add(totalLateCharge)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    quota,
    interest,
    lateFee,
    lateInterest,
    totalLateCharge,
    total,
    isLate: true,
  };
}

export function calcDueDate(
  paymentMonth: string,   // "YYYY-MM"
  dueDay: number = CAIXINHA_CONFIG.DEFAULT_DUE_DAY
): Date {
  const [year, month] = paymentMonth.split("-").map(Number);
  const dueYear  = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  return new Date(dueYear, dueMonth - 1, dueDay, 23, 59, 59);
}

export function isLatePayment(
  paymentMonth: string,
  paymentDate: Date,
  dueDay: number = CAIXINHA_CONFIG.DEFAULT_DUE_DAY
): boolean {
  const dueDate = calcDueDate(paymentMonth, dueDay);
  return paymentDate > dueDate;
}

// 🟢 ATUALIZADO: A estimativa do Dashboard agora lê o "role" de cada participante
export function calcNextMonthEstimate(
  activeParticipants: Array<{ id: number; name: string; currentDebt: string; role?: string }>
) {
  let estimatedQuotas   = new Decimal(0);
  let estimatedInterest = new Decimal(0);

  const perParticipant = activeParticipants.map((p) => {
    const debt = new Decimal(p.currentDebt);
    const role = (p.role as 'member' | 'external') || 'member';
    
    const { quota, interest, total } = calcMonthlyPayment(debt, role);

    estimatedQuotas   = estimatedQuotas.add(quota);
    estimatedInterest = estimatedInterest.add(interest);

    return {
      id: p.id,
      name: p.name,
      currentDebt: debt.toFixed(2),
      quota: quota.toFixed(2),
      interest: interest.toFixed(2),
      total: total.toFixed(2),
    };
  });

  const estimatedTotal = estimatedQuotas.add(estimatedInterest);

  return {
    estimatedQuotas:   estimatedQuotas.toFixed(2),
    estimatedInterest: estimatedInterest.toFixed(2),
    estimatedTotal:    estimatedTotal.toFixed(2),
    participantCount:  activeParticipants.length,
    perParticipant,
  };
}



export function splitPaymentByRole(
  amountValue: string | number,
  role: 'member' | 'external' = 'member'
): { quota: number; interest: number } {
  const amount = safeNumber(amountValue);
  if (amount <= 0) return { quota: 0, interest: 0 };

  if (role === 'external') {
    return { quota: 0, interest: amount };
  }

  const quota = Math.min(amount, CAIXINHA_CONFIG.MONTHLY_QUOTA.toNumber());
  return {
    quota,
    interest: Math.max(0, amount - quota),
  };
}

export function calculateCollectionsFromTransactions(
  rows: Array<{ participantId: number; type: string; amount: string | number }>,
  participantRoles: Record<number, 'member' | 'external'>
): { totalQuotas: number; totalInterest: number; totalFees: number } {
  let totalQuotas = 0;
  let totalInterest = 0;
  let totalAmortization = 0;

  for (const row of rows) {
    const amount = safeNumber(row.amount);
    if (amount <= 0) continue;

    if (row.type === 'amortization') {
      totalAmortization += amount;
      continue;
    }

    if (row.type !== 'payment' && row.type !== 'reversal') continue;

    const role = participantRoles[row.participantId] ?? 'member';
    const signal = row.type === 'reversal' ? -1 : 1;
    const split = splitPaymentByRole(amount, role);

    totalQuotas += split.quota * signal;
    totalInterest += split.interest * signal;
  }

  return {
    totalQuotas,
    totalInterest,
    totalFees: totalQuotas + totalAmortization,
  };
}

// ─────────────────────────────────────────────────────
// 3. ADAPTADORES FRONTEND (Evita quebrar telas do React)
// ─────────────────────────────────────────────────────
export function safeNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = new Decimal(value);
  return n.isNaN() ? 0 : n.toNumber();
}

export function calculateProgress(totalLoan: string | number, currentDebt: string | number): number {
  const total = new Decimal(totalLoan ?? 0);
  const current = new Decimal(currentDebt ?? 0);
  if (total.lte(0)) return 0;
  const paid = total.sub(current);
  const pct = paid.div(total).mul(100).toDecimalPlaces(1).toNumber();
  return Math.min(100, Math.max(0, pct));
}

export function calculateMonthlyInterest(currentDebt: string | number, role: 'member' | 'external' = 'member'): number {
  const debt = new Decimal(currentDebt ?? 0);
  if (debt.isNaN() || debt.lte(0)) return 0;
  const { interest } = calcMonthlyPayment(debt, role);
  return interest.toNumber();
}

export function calculateMonthlyTotal(currentDebt: string | number, role: 'member' | 'external' = 'member'): number {
  const debt = new Decimal(currentDebt ?? 0);
  if (debt.isNaN() || debt.lte(0)) return role === 'external' ? 0 : CAIXINHA_CONFIG.MONTHLY_QUOTA.toNumber();
  const { total } = calcMonthlyPayment(debt, role);
  return total.toNumber();
}