// src/services/raydium.ts
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  ApiClmmPoolsItem,
  ApiPoolInfo,
  ClmmPoolInfo,
  Clmm,
  ClmmPoolUtils,
  DecimalUtils,
  Token,
  TokenAmount,
  Price
} from '@raydium-io/raydium-sdk';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { Config } from '../config';
import { solanaService } from './solana';
import logger from './logger';
import { discordService } from './discord';

export interface PositionInfo {
  positionId: string;
  tokenA: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  tokenB: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  liquidity: string;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  inRange: boolean;
}

class RaydiumService {
  private poolId: PublicKey;
  private poolInfo: ClmmPoolInfo | null = null;
  private tokenA: Token | null = null;
  private tokenB: Token | null = null;

  constructor() {
    this.poolId = new PublicKey(Config.raydium.poolId);
    logger.info(`Raydium service initialized with pool ID: ${this.poolId.toString()}`);
  }

  async initialize(): Promise<void> {
    try {
      await this.fetchPoolInfo();
      logger.info('Raydium service fully initialized');
    } catch (error) {
      logger.error('Failed to initialize Raydium service', { error });
      throw error;
    }
  }

  async fetchPoolInfo(): Promise<ClmmPoolInfo> {
    try {
      const connection = solanaService.getConnection();
      
      // Fetch pool information from Raydium API
      const poolData = await ClmmPoolUtils.fetchPoolInfo({
        connection,
        poolKeys: {
          id: this.poolId
        }
      });

      if (!poolData) {
        throw new Error(`Pool not found: ${this.poolId.toString()}`);
      }

      this.poolInfo = poolData;
      
      // Set token information
      this.tokenA = {
        mint: poolData.mintA,
        symbol: 'SOL', // This would be dynamically fetched in a production environment
        decimals: poolData.mintADecimals,
      };

      this.tokenB = {
        mint: poolData.mintB,
        symbol: 'USDC', // This would be dynamically fetched in a production environment
        decimals: poolData.mintBDecimals,
      };

      logger.info('Pool info fetched', { 
        tokenA: this.tokenA.symbol, 
        tokenB: this.tokenB.symbol,
        currentPrice: this.getCurrentPrice()
      });

      return poolData;
    } catch (error) {
      logger.error('Failed to fetch pool info', { error });
      throw error;
    }
  }

  getCurrentPrice(): number {
    if (!this.poolInfo) {
      throw new Error('Pool info not initialized');
    }

    const sqrtPriceX64 = this.poolInfo.sqrtPriceX64;
    const price = new Decimal(sqrtPriceX64.toString())
      .pow(2)
      .div(new Decimal(2).pow(64 * 2));
    
    // If token order is reversed in the pool, invert the price
    if (this.tokenA?.symbol === 'USDC' && this.tokenB?.symbol === 'SOL') {
      return 1 / price.toNumber();
    }
    
    return price.toNumber();
  }

  calculatePriceRange(currentPrice: number): { lowerPrice: number, upperPrice: number } {
    const priceRangePercent = Config.raydium.priceRangePercent / 100;
    const lowerPrice = currentPrice * (1 - priceRangePercent);
    const upperPrice = currentPrice * (1 + priceRangePercent);
    
    return { lowerPrice, upperPrice };
  }

  async createPosition(amountA: BN, amountB: BN): Promise<string> {
    try {
      if (!this.poolInfo || !this.tokenA || !this.tokenB) {
        await this.fetchPoolInfo();
      }
      
      const connection = solanaService.getConnection();
      const wallet = solanaService.getKeypair();
      
      // Get current price and calculate range
      const currentPrice = this.getCurrentPrice();
      const { lowerPrice, upperPrice } = this.calculatePriceRange(currentPrice);
      
      // Create position transaction
      const transaction = new Transaction();
      
      // Add instructions to create position (this is a simplified version)
      // In a real implementation, you would use the Raydium SDK to build these instructions
      const createPositionInstruction = await Clmm.makeOpenPositionInstructionV2({
        connection,
        poolInfo: this.poolInfo!,
        ownerInfo: {
          feePayer: wallet.publicKey,
          wallet: wallet.publicKey,
        },
        inputInfo: {
          lowerPrice: new Price(lowerPrice),
          upperPrice: new Price(upperPrice),
          tokenA: this.tokenA!,
          tokenB: this.tokenB!,
          amountMaxA: new TokenAmount(this.tokenA!, amountA),
          amountMaxB: new TokenAmount(this.tokenB!, amountB),
        }
      });
      
      transaction.add(...createPositionInstruction.instructions);
      
      // Send transaction
      const signature = await solanaService.signAndSendTransaction(transaction);
      
      // Notify on successful position creation
      await discordService.sendPositionUpdate('Created', {
        PositionID: signature.slice(0, 8) + '...',
        CurrentPrice: currentPrice.toFixed(6),
        PriceRange: `${lowerPrice.toFixed(6)} - ${upperPrice.toFixed(6)}`,
        TokenA: `${DecimalUtils.fromBN(amountA, this.tokenA!.decimals)} ${this.tokenA!.symbol}`,
        TokenB: `${DecimalUtils.fromBN(amountB, this.tokenB!.decimals)} ${this.tokenB!.symbol}`,
      });
      
      logger.info('Position created', { signature, lowerPrice, upperPrice });
      return signature;
    } catch (error) {
      logger.error('Failed to create position', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Creating position' });
      throw error;
    }
  }

  async withdrawPosition(positionId: string): Promise<string> {
    try {
      if (!this.poolInfo) {
        await this.fetchPoolInfo();
      }
      
      const connection = solanaService.getConnection();
      const wallet = solanaService.getKeypair();
      
      // Get position info
      const positionPublicKey = new PublicKey(positionId);
      
      // Create withdraw transaction
      const transaction = new Transaction();
      
      // Add instructions to withdraw position (this is a simplified version)
      // In a real implementation, you would use the Raydium SDK to build these instructions
      const closePositionInstruction = await Clmm.makeClosePositionInstruction({
        connection,
        poolInfo: this.poolInfo!,
        ownerInfo: {
          feePayer: wallet.publicKey,
          wallet: wallet.publicKey,
        },
        positionId: positionPublicKey,
      });
      
      transaction.add(...closePositionInstruction.instructions);
      
      // Send transaction
      const signature = await solanaService.signAndSendTransaction(transaction);
      
      // Notify on successful position withdrawal
      await discordService.sendPositionUpdate('Withdrawn', {
        PositionID: positionId.slice(0, 8) + '...',
        TxSignature: signature.slice(0, 8) + '...',
      });
      
      logger.info('Position withdrawn', { signature, positionId });
      return signature;
    } catch (error) {
      logger.error('Failed to withdraw position', { error, positionId });
      await discordService.sendErrorNotification(error as Error, { action: 'Withdrawing position', positionId });
      throw error;
    }
  }

  async getPositions(): Promise<PositionInfo[]> {
    try {
      if (!this.poolInfo) {
        await this.fetchPoolInfo();
      }
      
      const connection = solanaService.getConnection();
      const wallet = solanaService.wallet;
      
      // Fetch all positions for wallet
      const positions = await Clmm.getPositionsByOwner({
        connection,
        ownerPublicKey: wallet,
      });
      
      // Filter positions for our specific pool
      const poolPositions = positions.filter(p => 
        p.poolId.equals(this.poolId)
      );
      
      // Get current price to determine if positions are in range
      const currentPrice = this.getCurrentPrice();
      
      // Format position info
      return poolPositions.map(position => {
        const lowerPrice = DecimalUtils.fromBN(position.tickLowerPrice, this.tokenB!.decimals).toNumber();
        const upperPrice = DecimalUtils.fromBN(position.tickUpperPrice, this.tokenB!.decimals).toNumber();
        const inRange = currentPrice >= lowerPrice && currentPrice <= upperPrice;
        
        return {
          positionId: position.nftMint.toString(),
          tokenA: {
            mint: position.poolInfo.mintA.toString(),
            symbol: this.tokenA!.symbol,
            decimals: this.tokenA!.decimals,
          },
          tokenB: {
            mint: position.poolInfo.mintB.toString(),
            symbol: this.tokenB!.symbol,
            decimals: this.tokenB!.decimals,
          },
          liquidity: position.liquidity.toString(),
          lowerPrice,
          upperPrice,
          currentPrice,
          inRange,
        };
      });
    } catch (error) {
      logger.error('Failed to get positions', { error });
      throw error;
    }
  }

  async isPoolInitialized(): Promise<boolean> {
    return this.poolInfo !== null;
  }
}

export const raydiumService = new RaydiumService();