import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  CAIXINHA_CONFIG,
  calcMonthlyPayment,
  calcLatePaymentFee,
  calcLateMonthlyPayment,
  calcDueDate,
  isLatePayment,
  calcNextMonthEstimate,
  splitPaymentByRole,
  calculateCollectionsFromTransactions,
  safeNumber,
  calculateProgress,
  calculateMonthlyInterest,
  calculateMonthlyTotal,
} from '../shared/finance';

// ─────────────────────────────────────────────────────
// calcMonthlyPayment
// ─────────────────────────────────────────────────────
describe('calcMonthlyPayment', () => {
  it('calcula corretamente para membro com dívida', () => {
    const result = calcMonthlyPayment(new Decimal('1000.00'), 'member', 1);
    expect(result.quota.toNumber()).toBe(200);
    expect(result.interest.toNumber()).toBe(100); // 10% de 1000
    expect(result.total.toNumber()).toBe(300);
    expect(result.quotaMultiplier).toBe(1);
  });

  it('calcula corretamente para membro sem dívida', () => {
    const result = calcMonthlyPayment(new Decimal('0'), 'member', 1);
    expect(result.quota.toNumber()).toBe(200);
    expect(result.interest.toNumber()).toBe(0);
    expect(result.total.toNumber()).toBe(200);
  });

  it('externo não paga cota, apenas juros', () => {
    const result = calcMonthlyPayment(new Decimal('1000.00'), 'external', 1);
    expect(result.quota.toNumber()).toBe(0);
    expect(result.interest.toNumber()).toBe(100);
    expect(result.total.toNumber()).toBe(100);
  });

  it('externo sem dívida paga R$ 0', () => {
    const result = calcMonthlyPayment(new Decimal('0'), 'external', 1);
    expect(result.total.toNumber()).toBe(0);
  });

  it('multiplica cota corretamente (3x)', () => {
    const result = calcMonthlyPayment(new Decimal('500.00'), 'member', 3);
    expect(result.quota.toNumber()).toBe(600); // 200 * 3
    expect(result.interest.toNumber()).toBe(50); // 10% de 500
    expect(result.total.toNumber()).toBe(650);
    expect(result.quotaMultiplier).toBe(3);
  });

  it('multiplicador não afeta externo', () => {
    const result = calcMonthlyPayment(new Decimal('500.00'), 'external', 3);
    expect(result.quota.toNumber()).toBe(0);
    expect(result.interest.toNumber()).toBe(50);
    expect(result.total.toNumber()).toBe(50);
  });

  it('arredonda juros corretamente (centavos)', () => {
    const result = calcMonthlyPayment(new Decimal('333.33'), 'member', 1);
    expect(result.interest.toNumber()).toBe(33.33); // 10% de 333.33 = 33.333 → 33.33
    expect(result.total.toNumber()).toBe(233.33);
  });
});

// ─────────────────────────────────────────────────────
// calcLatePaymentFee
// ─────────────────────────────────────────────────────
describe('calcLatePaymentFee', () => {
  it('calcula multa e mora para membro', () => {
    const result = calcLatePaymentFee('member');
    expect(result.lateFee.toNumber()).toBe(4); // 2% de R$ 200
    expect(result.lateInterest.toNumber()).toBe(2); // 1% de R$ 200
    expect(result.totalLateCharge.toNumber()).toBe(6);
  });

  it('externo não paga multa/mora (base é 0)', () => {
    const result = calcLatePaymentFee('external');
    expect(result.lateFee.toNumber()).toBe(0);
    expect(result.lateInterest.toNumber()).toBe(0);
    expect(result.totalLateCharge.toNumber()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
// calcLateMonthlyPayment
// ─────────────────────────────────────────────────────
describe('calcLateMonthlyPayment', () => {
  it('soma multa + mora ao total', () => {
    const result = calcLateMonthlyPayment(new Decimal('1000.00'), 'member', 1);
    // Normal: 200 + 100 = 300
    // Late: 300 + 4 (multa) + 2 (mora) = 306
    expect(result.total.toNumber()).toBe(306);
    expect(result.isLate).toBe(true);
    expect(result.lateFee.toNumber()).toBe(4);
    expect(result.lateInterest.toNumber()).toBe(2);
  });

  it('externo com atraso não tem multa (base 0)', () => {
    const result = calcLateMonthlyPayment(new Decimal('1000.00'), 'external', 1);
    expect(result.total.toNumber()).toBe(100); // apenas juros
    expect(result.totalLateCharge.toNumber()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
// calcDueDate e isLatePayment
// ─────────────────────────────────────────────────────
describe('calcDueDate', () => {
  it('vencimento do mês 2025-03 cai em abril', () => {
    const due = calcDueDate('2025-03', 5);
    expect(due.getFullYear()).toBe(2025);
    expect(due.getMonth()).toBe(3); // abril (0-indexed)
    expect(due.getDate()).toBe(5);
  });

  it('vencimento do mês 2025-12 cai em janeiro do ano seguinte', () => {
    const due = calcDueDate('2025-12', 5);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(0); // janeiro
    expect(due.getDate()).toBe(5);
  });
});

describe('isLatePayment', () => {
  it('pagamento antes do vencimento não é atraso', () => {
    const paymentDate = new Date(2025, 3, 3); // 3 abril
    expect(isLatePayment('2025-03', paymentDate, 5)).toBe(false);
  });

  it('pagamento depois do vencimento é atraso', () => {
    const paymentDate = new Date(2025, 3, 10); // 10 abril
    expect(isLatePayment('2025-03', paymentDate, 5)).toBe(true);
  });

  it('pagamento no dia do vencimento (antes de 23:59) não é atraso', () => {
    const paymentDate = new Date(2025, 3, 5, 12, 0, 0); // 5 abril, meio-dia
    expect(isLatePayment('2025-03', paymentDate, 5)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// splitPaymentByRole
// ─────────────────────────────────────────────────────
describe('splitPaymentByRole', () => {
  it('membro: divide valor entre cota e juros', () => {
    const result = splitPaymentByRole(300, 'member', 1);
    expect(result.quota).toBe(200);
    expect(result.interest).toBe(100);
  });

  it('membro com valor menor que a cota: tudo vai para cota', () => {
    const result = splitPaymentByRole(150, 'member', 1);
    expect(result.quota).toBe(150);
    expect(result.interest).toBe(0);
  });

  it('externo: tudo vai para juros', () => {
    const result = splitPaymentByRole(300, 'external', 1);
    expect(result.quota).toBe(0);
    expect(result.interest).toBe(300);
  });

  it('valor 0 retorna zeros', () => {
    const result = splitPaymentByRole(0, 'member', 1);
    expect(result.quota).toBe(0);
    expect(result.interest).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
// calculateCollectionsFromTransactions
// ─────────────────────────────────────────────────────
describe('calculateCollectionsFromTransactions', () => {
  it('calcula cotas e juros de pagamentos', () => {
    const rows = [
      { participantId: 1, type: 'payment', amount: '300' },
      { participantId: 2, type: 'payment', amount: '100' },
    ];
    const roles = { 1: 'member' as const, 2: 'external' as const };
    const result = calculateCollectionsFromTransactions(rows, roles);
    expect(result.totalQuotas).toBe(200); // membro paga R$200 cota
    expect(result.totalInterest).toBe(200); // 100 (membro juros) + 100 (externo tudo)
  });

  it('reversals subtraem', () => {
    const rows = [
      { participantId: 1, type: 'payment', amount: '300' },
      { participantId: 1, type: 'reversal', amount: '300' },
    ];
    const roles = { 1: 'member' as const };
    const result = calculateCollectionsFromTransactions(rows, roles);
    expect(result.totalQuotas).toBe(0);
    expect(result.totalInterest).toBe(0);
  });

  it('amortizações somam em totalFees', () => {
    const rows = [
      { participantId: 1, type: 'amortization', amount: '500' },
    ];
    const roles = { 1: 'member' as const };
    const result = calculateCollectionsFromTransactions(rows, roles);
    expect(result.totalFees).toBe(500); // amortization goes to totalFees
    expect(result.totalInterest).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────
describe('safeNumber', () => {
  it('converte string para number', () => {
    expect(safeNumber('123.45')).toBe(123.45);
  });

  it('null/undefined retorna 0', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
  });

  it('string vazia retorna 0', () => {
    expect(safeNumber('')).toBe(0);
  });

  it('aceita number direto', () => {
    expect(safeNumber(42)).toBe(42);
  });
});

describe('calculateProgress', () => {
  it('100% quando dívida é 0', () => {
    expect(calculateProgress('1000', '0')).toBe(100);
  });

  it('0% quando nada foi pago', () => {
    expect(calculateProgress('1000', '1000')).toBe(0);
  });

  it('50% quando metade foi paga', () => {
    expect(calculateProgress('1000', '500')).toBe(50);
  });

  it('empréstimo 0 retorna 0%', () => {
    expect(calculateProgress('0', '0')).toBe(0);
  });
});

describe('calculateMonthlyInterest', () => {
  it('calcula 10% da dívida', () => {
    expect(calculateMonthlyInterest('1000')).toBe(100);
  });

  it('dívida 0 retorna 0', () => {
    expect(calculateMonthlyInterest('0')).toBe(0);
  });

  it('dívida negativa retorna 0', () => {
    expect(calculateMonthlyInterest('-100')).toBe(0);
  });
});

describe('calculateMonthlyTotal', () => {
  it('membro: cota + juros', () => {
    expect(calculateMonthlyTotal('1000', 'member', 1)).toBe(300);
  });

  it('membro sem dívida paga só a cota', () => {
    expect(calculateMonthlyTotal('0', 'member', 1)).toBe(200);
  });

  it('externo sem dívida paga R$ 0', () => {
    expect(calculateMonthlyTotal('0', 'external', 1)).toBe(0);
  });

  it('multiplicador funciona', () => {
    expect(calculateMonthlyTotal('1000', 'member', 2)).toBe(500); // 400 + 100
  });
});

// ─────────────────────────────────────────────────────
// calcNextMonthEstimate
// ─────────────────────────────────────────────────────
describe('calcNextMonthEstimate', () => {
  it('estima arrecadação de múltiplos participantes', () => {
    const participants = [
      { id: 1, name: 'Alice', currentDebt: '1000.00', role: 'member' },
      { id: 2, name: 'Bob', currentDebt: '500.00', role: 'member' },
      { id: 3, name: 'Carlos', currentDebt: '2000.00', role: 'external' },
    ];
    const result = calcNextMonthEstimate(participants);
    expect(result.participantCount).toBe(3);
    // Alice: 200 cota + 100 juros = 300
    // Bob: 200 cota + 50 juros = 250
    // Carlos: 0 cota + 200 juros = 200
    expect(result.estimatedQuotas).toBe('400.00');
    expect(result.estimatedInterest).toBe('350.00');
    expect(result.estimatedTotal).toBe('750.00');
    expect(result.perParticipant).toHaveLength(3);
  });

  it('lista vazia retorna zeros', () => {
    const result = calcNextMonthEstimate([]);
    expect(result.estimatedTotal).toBe('0.00');
    expect(result.participantCount).toBe(0);
  });
});
