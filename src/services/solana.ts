// src/services/solana.ts
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { Config } from '../config';
import logger from './logger';
import { bs58 } from 'bs58';

export interface TokenBalance {
  mint: string;
  amount: bigint;
  decimals: number;
  uiAmount: number;
}

class SolanaService {
  private connection: Connection;
  private keypair: Keypair;
  public wallet: PublicKey;

  constructor() {
    this.connection = new Connection(Config.solana.rpcUrl, 'confirmed');
    this.keypair = Keypair.fromSecretKey(bs58.decode(Config.solana.privateKey));
    this.wallet = this.keypair.publicKey;
    logger.info(`Solana wallet initialized: ${this.wallet.toString()}`);
  }

  async getSolBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.wallet);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      logger.error('Failed to get SOL balance', { error });
      throw error;
    }
  }

  async getTokenBalances(): Promise<Map<string, TokenBalance>> {
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.wallet,
        { programId: TOKEN_PROGRAM_ID }
      );

      const balances = new Map<string, TokenBalance>();
      
      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const amount = BigInt(parsedInfo.tokenAmount.amount);
        const decimals = parsedInfo.tokenAmount.decimals;
        const uiAmount = parseFloat(parsedInfo.tokenAmount.uiAmount);
        
        balances.set(mint, { mint, amount, decimals, uiAmount });
      }
      
      return balances;
    } catch (error) {
      logger.error('Failed to get token balances', { error });
      throw error;
    }
  }

  async signAndSendTransaction(transaction: Transaction): Promise<string> {
    try {
      transaction.feePayer = this.wallet;
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair]
      );
      
      logger.info('Transaction sent', { signature });
      return signature;
    } catch (error) {
      logger.error('Failed to send transaction', { error });
      throw error;
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }
}

export const solanaService = new SolanaService();