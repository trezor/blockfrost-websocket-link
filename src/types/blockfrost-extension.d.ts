export * from '@blockfrost/blockfrost-js';

import type { accountsUtxos, accountsUtxosAll } from '../wrappers/extension.js';

declare module '@blockfrost/blockfrost-js' {
  declare class BlockFrostAPI {
    accountsUtxos: typeof accountsUtxos;
    accountsUtxosAll: typeof accountsUtxosAll;
  }
}
