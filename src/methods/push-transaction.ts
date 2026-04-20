import axios from 'axios';
import { BlockfrostClientError, BlockfrostServerError } from '@blockfrost/blockfrost-js';
import { txClient } from '../utils/blockfrost-api.js';
import { SUBMIT_API_URL } from '../constants/config.js';

const submitCustom = async (transaction: Uint8Array | string, url: string) => {
  // Convert transaction to Buffer if it's a string
  const txBuffer =
    typeof transaction === 'string' ? Buffer.from(transaction, 'hex') : Buffer.from(transaction);

  try {
    // Submit directly to cardano-submit-api
    const response = await axios.post(url, txBuffer, {
      headers: { 'Content-Type': 'application/cbor' },
      timeout: 5000,
    });

    return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      // Request timed out. Most likely mempool is full
      throw new Error('Mempool is full, please try resubmitting again later.');
    }
    throw error;
  }
};

export default async (transaction: Uint8Array | string): Promise<string> => {
  try {
    return await (SUBMIT_API_URL
      ? submitCustom(transaction, SUBMIT_API_URL)
      : txClient.txSubmit(transaction));
  } catch (error) {
    if (error instanceof BlockfrostClientError && error.code === 'ETIMEDOUT') {
      // Request timed out. Most likely mempool is full since that's the only reason why submit api should get stuck
      throw new Error('Mempool is full, please try resubmitting again later.');
    } else if (error instanceof BlockfrostServerError && error.status_code === 400) {
      // 400 Bad Request could be directly from the Cardano Submit API due to invalid tx, forward a body which includes the error as a message
      throw new BlockfrostServerError({
        ...error,
        body: undefined,
        // error.body containing error msg from cardano submit api will be passed as a message in error object
        // resulting in easier to use reports
        message: typeof error.body === 'string' ? error.body : error.message,
      });
    } else {
      throw error;
    }
  }
};
