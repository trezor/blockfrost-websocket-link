import memoizee from 'memoizee';
import { statistics } from 'memoizee/profile.js';
import { BlockfrostServerError } from '@blockfrost/blockfrost-js';

import { events } from '../events.js';
import { blockfrostAPI } from '../utils/blockfrost-api.js';

const log = () => {
  const initial = Object.values(statistics).reduce((sum, data) => sum + data.initial, 0);
  const cached = Object.values(statistics).reduce((sum, data) => sum + data.cached, 0);

  const aLength = Math.max(String(initial).length, 'Init'.length);
  const bLength = Math.max(String(cached).length, 'Cache'.length);
  const cLength = '%Cache'.length;

  const line = (a: string, b: string, c: string, d: string) =>
    `${a.padStart(aLength, ' ')}  ${b.padStart(bLength, ' ')}  ${c.padStart(cLength, ' ')}  ${d}`;

  const numline = (name: string, init: number, cache: number) =>
    line(
      String(init),
      String(cache),
      !init && !cache ? '0.00' : ((cache / (init + cache)) * 100).toFixed(2),
      name.split(',')[0],
    );

  return `${'-'.repeat(60)}
Memoize statistics:

${line('Init', 'Cache', '%Cache', 'Source location')}
${numline('(all)', initial, cached)}
${Object.entries(statistics)
  .sort(([, a], [, b]) => b.initial + b.cached - (a.initial + a.cached))
  .map(([name, data]) => numline(name, data.initial, data.cached))
  .join('\n')}
${'-'.repeat(60)}
`;
};

const defaultOptions = {
  length: 1, // consider only the first arg
  primitive: true, // first argument should always be string
  maxAge: 30 * 60 * 1000, // 30 mins
};

const withMemoAddress = <Response>(func: (address: string) => Promise<Response>) => {
  const cache = memoizee(
    (address: string) =>
      func.call(blockfrostAPI, address).catch(error => {
        if (!(error instanceof BlockfrostServerError && error.status_code === 404)) {
          // cache only 404 rejections
          cache.delete(address);
        }
        throw error;
      }),
    { ...defaultOptions, profileName: func.name },
  );

  events.on('newBlock', (_, addresses) => {
    for (const { address } of addresses) {
      cache.delete(address);
    }
  });

  events.on('reorgBlock', (_, addresses) => {
    for (const { address } of addresses) {
      cache.delete(address);
    }
  });

  events.on('reorgAll', () => cache.clear());

  return cache;
};

const withMemoAccount = <Response>(func: (stakeAddress: string) => Promise<Response>) => {
  const cache = memoizee(
    (stakeAddress: string) =>
      func.call(blockfrostAPI, stakeAddress).catch(error => {
        if (!(error instanceof BlockfrostServerError && error.status_code === 404)) {
          // cache only 404 rejections
          cache.delete(stakeAddress);
        }
        throw error;
      }),
    { ...defaultOptions, profileName: func.name },
  );

  events.on('newBlock', () => cache.clear());
  events.on('reorgBlock', () => cache.clear());
  events.on('reorgAll', () => cache.clear());

  return cache;
};

const withMemoEpoch = <Response>(func: () => Promise<Response>) => {
  const cache = memoizee(func, {
    ...defaultOptions,
    promise: true, // don't cache rejections
    profileName: func.name,
  });

  events.on('newBlock', () => cache.clear());
  events.on('reorgBlock', () => cache.clear());
  events.on('reorgAll', () => cache.clear());

  return cache;
};

const withMemo = <Response, Param>(func: (param: Param) => Promise<Response>) =>
  memoizee(func, {
    ...defaultOptions,
    promise: true, // don't cache rejections
    profileName: func.name,
  });

blockfrostAPI.accounts = withMemoAccount(blockfrostAPI.accounts);
blockfrostAPI.accountsAddressesAll = withMemoAccount(blockfrostAPI.accountsAddressesAll);
blockfrostAPI.accountsAddressesTotal = withMemoAccount(blockfrostAPI.accountsAddressesTotal);
blockfrostAPI.accountsTransactionsAll = withMemoAccount(blockfrostAPI.accountsTransactionsAll);
blockfrostAPI.accountsUtxosAll = withMemoAccount(blockfrostAPI.accountsUtxosAll);
blockfrostAPI.addresses = withMemoAddress(blockfrostAPI.addresses);
blockfrostAPI.addressesTotal = withMemoAddress(blockfrostAPI.addressesTotal);
blockfrostAPI.addressesTransactionsAll = withMemoAddress(blockfrostAPI.addressesTransactionsAll);
blockfrostAPI.addressesUtxosAll = withMemoAddress(blockfrostAPI.addressesUtxosAll);
blockfrostAPI.assetsById = withMemo(blockfrostAPI.assetsById);
blockfrostAPI.epochsLatest = withMemoEpoch(blockfrostAPI.epochsLatest);
blockfrostAPI.epochsLatestParameters = withMemoEpoch(blockfrostAPI.epochsLatestParameters);
blockfrostAPI.epochsParameters = withMemo(blockfrostAPI.epochsParameters);
blockfrostAPI.txs = withMemo(blockfrostAPI.txs);
blockfrostAPI.txsCbor = withMemo(blockfrostAPI.txsCbor);
blockfrostAPI.txsUtxos = withMemo(blockfrostAPI.txsUtxos);

export default { log };
