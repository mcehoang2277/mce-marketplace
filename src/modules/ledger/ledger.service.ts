import { LedgerAccountType, LedgerEntrySide, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type Amount = Prisma.Decimal | number | string;

export interface LedgerLineInput {
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  side: LedgerEntrySide;
  amount: Amount;
}

export interface CreateLedgerPostingInput {
  eventType: string;
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  description: string;
  lines: LedgerLineInput[];
}

/**
 * Append-only double-entry journal. All callers must use the same database
 * transaction as the business-state mutation. No API for editing/deleting lines.
 */
export class LedgerService {
  public static async createPosting(tx: Tx, input: CreateLedgerPostingInput) {
    if (!input.idempotencyKey.trim() || input.lines.length < 2) {
      throw new Error('Ledger posting requires an idempotency key and at least two lines.');
    }

    const normalized = input.lines.map((line) => ({
      ...line,
      amount: new Prisma.Decimal(line.amount)
    }));
    const debit = normalized
      .filter((line) => line.side === LedgerEntrySide.DEBIT)
      .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const credit = normalized
      .filter((line) => line.side === LedgerEntrySide.CREDIT)
      .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

    if (normalized.some((line) => !line.amount.isFinite() || line.amount.lte(0)) || !debit.equals(credit)) {
      throw new Error('Ledger posting is invalid: every amount must be positive and total debits must equal total credits.');
    }

    const existing = await tx.ledgerPosting.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { lines: { include: { account: true } } }
    });
    if (existing) {
      if (
        existing.eventType !== input.eventType ||
        existing.referenceType !== input.referenceType ||
        existing.referenceId !== input.referenceId ||
        !existing.lines.reduce((sum, line) => sum.plus(line.side === LedgerEntrySide.DEBIT ? line.amount : 0), new Prisma.Decimal(0)).equals(debit)
      ) {
        throw new Error('Ledger idempotency key was reused with different posting data.');
      }
      return { posting: existing, created: false };
    }

    const accountIds = new Map<string, string>();
    for (const line of normalized) {
      let accountId = accountIds.get(line.accountCode);
      if (!accountId) {
        const account = await tx.ledgerAccount.upsert({
          where: { code: line.accountCode },
          create: { code: line.accountCode, name: line.accountName, accountType: line.accountType },
          update: {}
        });
        if (account.accountType !== line.accountType) {
          throw new Error(`Ledger account type mismatch for ${line.accountCode}.`);
        }
        accountId = account.id;
        accountIds.set(line.accountCode, accountId);
      }
    }

    const posting = await tx.ledgerPosting.create({
      data: {
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description
      }
    });
    await tx.ledgerLine.createMany({
      data: normalized.map((line) => ({
        postingId: posting.id,
        accountId: accountIds.get(line.accountCode)!,
        side: line.side,
        amount: line.amount
      }))
    });

    return { posting, created: true };
  }
}
