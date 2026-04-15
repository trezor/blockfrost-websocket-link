import { DerivedAddress } from '../types/address.js';
import { Responses } from '@blockfrost/blockfrost-js';
import { addressesToTxIds, getAddressesData } from './address.js';

export const getTxidsFromAccountAddresses = async (addresses: DerivedAddress[]) => {
  const uniqueTxIds: ({
    address: string;
  } & Responses['address_transactions_content'][number])[] = [];

  const transactionsPerAddressList = await addressesToTxIds(addresses);

  // filter only unique txs to prevent counting a transaction that was sent from and to the same account twice
  for (const txsPerAddress of transactionsPerAddressList) {
    for (const addrItem of txsPerAddress.data) {
      if (!uniqueTxIds.some(item => addrItem.tx_hash === item.tx_hash)) {
        uniqueTxIds.push({ address: txsPerAddress.address, ...addrItem });
      }
    }
  }

  const sortedTxIds = uniqueTxIds.sort(
    (first, second) => second.block_height - first.block_height || second.tx_index - first.tx_index,
  );

  return sortedTxIds;
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
