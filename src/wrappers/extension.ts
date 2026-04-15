import { BlockFrostAPI, Responses } from '@blockfrost/blockfrost-js';
import { AllMethodOptions, PaginationOptions } from '@blockfrost/blockfrost-js/lib/types/index.js';
import { getPaginationOptions, paginateMethod } from '@blockfrost/blockfrost-js/lib/utils/index.js';
import { handleError } from '@blockfrost/blockfrost-js/lib/utils/errors.js';
import { blockfrostAPI } from '../utils/blockfrost-api.js';

export async function accountsUtxos(
  this: BlockFrostAPI,
  stakeAddress: string,
  pagination?: PaginationOptions,
): Promise<Responses['account_utxo_content']> {
  const paginationOptions = getPaginationOptions(pagination);

  try {
    const res = await this.instance<Responses['account_utxo_content']>(
      `accounts/${stakeAddress}/utxos`,
      {
        searchParams: {
          page: paginationOptions.page,
          count: paginationOptions.count,
          order: paginationOptions.order,
        },
      },
    );

    return res.body;
  } catch (error) {
    throw handleError(error);
  }
}

export async function accountsUtxosAll(
  this: BlockFrostAPI,
  stakeAddress: string,
  allMethodOptions?: AllMethodOptions,
): Promise<Responses['account_utxo_content']> {
  return paginateMethod(
    pagination => this.accountsUtxos(stakeAddress, pagination),
    allMethodOptions,
  );
}

blockfrostAPI.accountsUtxos = accountsUtxos;
blockfrostAPI.accountsUtxosAll = accountsUtxosAll;
