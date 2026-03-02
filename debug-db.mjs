import { getDb } from './server/db.ts';
import { monthlyPayments, transactions, participants } from './drizzle/schema.ts';

async function debugDb() {
  try {
    const db = await getDb();
    if (!db) {
      console.log('Database not available');
      return;
    }

    console.log('\n=== PARTICIPANTS ===');
    const allParticipants = await db.select().from(participants);
    console.log(JSON.stringify(allParticipants, null, 2));

    console.log('\n=== MONTHLY PAYMENTS ===');
    const allPayments = await db.select().from(monthlyPayments);
    console.log(JSON.stringify(allPayments, null, 2));

    console.log('\n=== TRANSACTIONS ===');
    const allTransactions = await db.select().from(transactions);
    console.log(JSON.stringify(allTransactions, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

debugDb();
