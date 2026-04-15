import { deriveAccountAddresses, getAccountUtxos } from '../utils/account.js';
import { utxosWithBlocks, getStakeAddress } from '../utils/address.js';
import { UtxosWithBlocksParameters } from '../types/address.js';

export default async (publicKey: string) => {
  const { external, internal } = await deriveAccountAddresses(publicKey);
  const stakeAddress = getStakeAddress(publicKey);
  const utxoMap = await getAccountUtxos(stakeAddress);
  const utxosResult: UtxosWithBlocksParameters = [...external, ...internal].map(a => ({
    address: a.address,
    data: utxoMap[a.address] ?? [],
    path: a.path,
  }));

  return utxosWithBlocks(utxosResult);
};
