// src/bot/monitor.ts
import { Config } from '../config';
import { solanaService } from '../services/solana';
import { raydiumService } from '../services/raydium';
import { discordService } from '../services/discord';
import logger from '../services/logger';

export class PoolMonitor {
  private lastCheckedPrice: number | null = null;
  private priceChangeThreshold: number;

  constructor() {
    // Set price change threshold to rebalance threshold from config
    this.priceChangeThreshold = Config.raydium.rebalanceThresholdPercent / 100;
    logger.info(`Pool monitor initialized with ${Config.raydium.rebalanceThresholdPercent}% price change threshold`);
  }

  async checkPrice(): Promise<{ 
    currentPrice: number, 
    significantChange: boolean,
    percentChange: number | null 
  }> {
    try {
      // Ensure pool info is initialized
      if (!await raydiumService.isPoolInitialized()) {
        await raydiumService.initialize();
      }
      
      const currentPrice = raydiumService.getCurrentPrice();
      let significantChange = false;
      let percentChange: number | null = null;
      
      // Check if price has changed significantly since last check
      if (this.lastCheckedPrice !== null) {
        percentChange = Math.abs(currentPrice - this.lastCheckedPrice) / this.lastCheckedPrice;
        significantChange = percentChange > this.priceChangeThreshold;
        
        if (significantChange) {
          logger.info('Significant price change detected', {
            currentPrice,
            previousPrice: this.lastCheckedPrice,
            percentChange: (percentChange * 100).toFixed(2) + '%',
            threshold: (this.priceChangeThreshold * 100).toFixed(2) + '%'
          });
        }
      }
      
      // Update last checked price
      this.lastCheckedPrice = currentPrice;
      
      return {
        currentPrice,
        significantChange,
        percentChange
      };
    } catch (error) {
      logger.error('Failed to check price', { error });
      throw error;
    }
  }

  async checkPositions(): Promise<{
    positionsCount: number,
    outOfRangeCount: number
  }> {
    try {
      const positions = await raydiumService.getPositions();
      const outOfRangePositions = positions.filter(position => !position.inRange);
      
      logger.info('Position status', {
        total: positions.length,
        inRange: positions.length - outOfRangePositions.length,
        outOfRange: outOfRangePositions.length
      });
      
      return {
        positionsCount: positions.length,
        outOfRangeCount: outOfRangePositions.length
      };
    } catch (error) {
      logger.error('Failed to check positions', { error });
      throw error;
    }
  }

  async checkWalletBalances(): Promise<{
    solBalance: number,
    tokenBalances: { symbol: string, amount: number }[]
  }> {
    try {
      // Get SOL balance
      const solBalance = await solanaService.getSolBalance();
      
      // Get token balances
      const tokenBalances = await solanaService.getTokenBalances();
      const formattedBalances: { symbol: string, amount: number }[] = [];
      
      // Format token balances
      for (const [mint, balance] of tokenBalances.entries()) {
        let symbol = 'Unknown';
        
        // Try to identify common tokens by mint address
        // This would be expanded in a production version
        if (mint === raydiumService.getTokenAMint()) {
          symbol = 'SOL';
        } else if (mint === raydiumService.getTokenBMint()) {
          symbol = 'USDC';
        }
        
        formattedBalances.push({
          symbol,
          amount: balance.uiAmount
        });
      }
      
      logger.info('Wallet balances', {
        solBalance,
        tokens: formattedBalances
      });
      
      // Check if SOL balance is below minimum threshold
      if (solBalance < Config.solana.minSolBalance) {
        logger.warn('SOL balance below minimum threshold', {
          balance: solBalance,
          threshold: Config.solana.minSolBalance
        });
        
        await discordService.sendNotification(
          'Low SOL Balance',
          `Wallet SOL balance (${solBalance.toFixed(4)} SOL) is below minimum threshold (${Config.solana.minSolBalance} SOL).`,
          0xffaa00 // Orange
        );
      }
      
      return {
        solBalance,
        tokenBalances: formattedBalances
      };
    } catch (error) {
      logger.error('Failed to check wallet balances', { error });
      throw error;
    }
  }
}

export const poolMonitor = new PoolMonitor();