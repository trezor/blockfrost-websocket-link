import { DerivedAddress, TransformedUtxo, Type } from '../types/address.js';
import { BlockfrostServerError } from '@blockfrost/blockfrost-js';
import { getAddressesData, getStakeAddress, memoizedDeriveAddress } from './address.js';
import { blockfrostAPI } from './blockfrost-api.js';
import { getAssetData, transformAsset } from './asset.js';
import { ADDRESS_GAP_LIMIT } from '../constants/config.js';

export const getAccountTxids = async (
  stakeAddress: string,
  { external, internal }: { external: DerivedAddress[]; internal: DerivedAddress[] },
) => {
  const txs = await blockfrostAPI.accountsTransactionsAll(stakeAddress, { batchSize: 1 });
  const uniqueTxs = new Map<string, (typeof txs)[number]>();
  const addressOrder = new Map<string, number>(
    [...external, ...internal].map((addr, i) => [addr.address, i]),
  );
  const prioritizeTx = (oldTx: (typeof txs)[number], newTx: (typeof txs)[number]) =>
    (addressOrder.get(newTx.address) ?? Infinity) < (addressOrder.get(oldTx.address) ?? -Infinity);

  for (const tx of txs) {
    const oldTx = uniqueTxs.get(tx.tx_hash);

    if (!oldTx || prioritizeTx(oldTx, tx)) {
      uniqueTxs.set(tx.tx_hash, tx);
    }
  }

  const sortedTxs = [...uniqueTxs.values()].sort(
    (first, second) => second.block_height - first.block_height || second.tx_index - first.tx_index,
  );

  return sortedTxs;
};

export const getAccountAddressesData = async (
  externalAddresses: DerivedAddress[],
  internalAddresses: DerivedAddress[],
  accountEmpty: boolean,
) => {
  const usedExternalAddresses = externalAddresses.filter(a => !a.empty);
  const unusedExternalAddresses = externalAddresses.filter(a => a.empty);
  const change = await getAddressesData(internalAddresses, accountEmpty);
  const used = await getAddressesData(usedExternalAddresses, accountEmpty);

  const unused = unusedExternalAddresses.map(addressData => ({
    address: addressData.address,
    path: addressData.path,
    transfers: 0,
    received: '0',
    sent: '0',
  }));

  return { change, used, unused };
};

export const deriveAccountAddresses = async (publicKey: string, accountEmpty = false) => {
  const stakeAddress = getStakeAddress(publicKey);
  const addresses = !accountEmpty
    ? await blockfrostAPI.accountsAddressesAll(stakeAddress, { batchSize: 1 })
    : [];
  const used = new Set(addresses.map(({ address }) => address));

  const derive = (type: Type): DerivedAddress[] => {
    let lastEmptyCount = 0;
    let addressCount = 0;

    const result: DerivedAddress[] = [];

    while (lastEmptyCount < ADDRESS_GAP_LIMIT) {
      const { address, path } = memoizedDeriveAddress(
        publicKey,
        type,
        addressCount,
        blockfrostAPI.options.network !== 'mainnet',
      );
      const empty = !used.has(address);

      addressCount++;
      lastEmptyCount = empty ? lastEmptyCount + 1 : 0;

      result.push({ address, path, empty });
    }

    return result;
  };

  const external = derive(0);
  const internal = derive(1);

  return { external, internal };
};

export const getAccountUtxos = async (stakeAddress: string) => {
  const allUtxos = await blockfrostAPI
    .accountsUtxosAll(stakeAddress, { batchSize: 1 })
    .catch(error => {
      if (error instanceof BlockfrostServerError && error.status_code === 404) {
        return [];
      } else {
        throw error;
      }
    });

  const assets = new Set<string>(allUtxos.flatMap(utxo => utxo.amount.map(a => a.unit)));

  assets.delete('lovelace');

  const tokenMetadata = await Promise.all([...assets].map(a => getAssetData(a)));

  return (
    allUtxos
      .map(utxo => ({
        ...utxo,
        amount: utxo.amount.map(asset =>
          transformAsset(
            asset,
            tokenMetadata.find(m => m?.asset),
          ),
        ),
      }))
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce<{ [address: string]: TransformedUtxo[] }>(
        (acc, utxo) => ({ ...acc, [utxo.address]: [...(acc[utxo.address] ?? []), utxo] }),
        {},
      )
  );
};
