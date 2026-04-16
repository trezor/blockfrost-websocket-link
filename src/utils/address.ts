import * as Addresses from '../types/address.js';
import { blockfrostAPI } from '../utils/blockfrost-api.js';
import {
  BlockfrostServerError,
  deriveAddress as sdkDeriveAddress,
  Responses,
} from '@blockfrost/blockfrost-js';
import memoizee from 'memoizee';

export const deriveAddress = (
  publicKey: string,
  type: number,
  addressIndex: number,
  isTestnet: boolean,
): { address: string; path: string } => {
  const { address } = sdkDeriveAddress(
    publicKey,
    type,
    addressIndex,
    isTestnet ? 'preview' : 'mainnet',
  );
  const purpose = 1852;

  return {
    address: address,
    path: `m/${purpose}'/1815'/i'/${type}/${addressIndex}`,
  };
};

export const memoizedDeriveAddress = memoizee(deriveAddress, {
  maxAge: 30 * 60 * 1000, // 30 mins
  primitive: true,
  profileName: '__address derivation__',
});

export const getStakeAddress = (publicKey: string) =>
  memoizedDeriveAddress(publicKey, 2, 0, blockfrostAPI.options.network !== 'mainnet').address;

export const utxosWithBlocks = async (
  utxos: Addresses.UtxosWithBlocksParameters,
): Promise<Addresses.UtxosWithBlockResponse[]> => {
  const promisesBundle: Promise<Addresses.UtxosWithBlockResponse>[] = [];

  for (const utxo of utxos) {
    for (const utxoData of utxo.data) {
      const promise = blockfrostAPI.blocks(utxoData.block).then(blockData => ({
        address: utxo.address,
        path: utxo.path,
        utxoData: utxoData,
        blockInfo: blockData,
      }));

      promisesBundle.push(promise);
    }
  }

  const result = await Promise.all(promisesBundle);

  return result;
};

export const getAddressesData = async (
  addresses: Addresses.DerivedAddress[],
  emptyAccount?: boolean,
): Promise<Addresses.AddressData[]> => {
  const result = emptyAccount
    ? addresses.map(addr => ({ addr, data: undefined }))
    : await Promise.all(
        addresses.map(addr =>
          addr.empty
            ? { addr, data: undefined }
            : blockfrostAPI
                .addressesTotal(addr.address)
                .catch(error => {
                  if (error.status_code !== 404) {
                    throw new Error(error);
                  }
                })
                .then(data => ({ addr, data })),
        ),
      );

  return result.map(({ addr, data }) => ({
    address: addr.address,
    path: addr.path,
    transfers: data?.tx_count ?? 0,
    received: data?.received_sum.find(b => b.unit === 'lovelace')?.quantity ?? '0',
    sent: data?.sent_sum.find(b => b.unit === 'lovelace')?.quantity ?? '0',
  }));
};

export const getStakingData = async (stakeAddress: string): Promise<Addresses.StakingData> => {
  try {
    const stakeAddressData = await blockfrostAPI.accounts(stakeAddress);
    const { drep_id } = stakeAddressData;
    const drepData = drep_id ? await blockfrostAPI.governance.drepsById(drep_id) : null;

    return {
      rewards: stakeAddressData.withdrawable_amount,
      isActive: stakeAddressData.active,
      poolId: stakeAddressData.pool_id,
      drep: drepData,
    };
  } catch (error) {
    if (error instanceof BlockfrostServerError && error.status_code === 404) {
      return {
        rewards: '0',
        isActive: false,

        poolId: null,
        drep: null,
      };
    }
    throw error;
  }
};

export const getStakingAccountTotal = async (
  stakeAddress: string,
): Promise<Responses['account_addresses_total']> => {
  try {
    const total = await blockfrostAPI.accountsAddressesTotal(stakeAddress);

    return total;
  } catch (error) {
    if (error instanceof BlockfrostServerError && error.status_code === 404) {
      return {
        stake_address: stakeAddress,
        received_sum: [],
        sent_sum: [],
        tx_count: 0,
      };
    }
    throw error;
  }
};
