import { addressesToUtxos, utxosWithBlocks, discoverAccountAddresses } from '../utils/address.js';

export default async (publicKey: string) => {
  const { external, internal } = await discoverAccountAddresses(publicKey);
  const addresses = [...external, ...internal];

  const utxosResult = await addressesToUtxos(addresses);

  return utxosWithBlocks(utxosResult);
};
