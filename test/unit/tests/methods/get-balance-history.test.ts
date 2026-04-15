import * as fixtures from '../../fixtures/getBalanceHistory.js';
import { describe, test, expect } from 'vitest';
import { aggregateTransactions } from '../../../../src/methods/get-balance-history.js';

describe('getBalanceHistory', () => {
  for (const fixture of fixtures.aggregateTransactions) {
    test(fixture.description, async () => {
      const result = await aggregateTransactions(
        fixture.transactions,
        fixture.addresses,
        fixture.groupBy,
      );

      expect(result).toMatchObject(fixture.result);
    });
  }
});
