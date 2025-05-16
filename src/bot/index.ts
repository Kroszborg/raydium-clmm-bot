// src/bot/index.ts
import cron from 'node-cron';
import { Config } from '../config';
import { raydiumService } from '../services/raydium';
import { discordService } from '../services/discord';
import { poolMonitor } from './monitor';
import { positionManager } from './position-manager';
import logger from '../services/logger';

export class LiquidityBot {
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing bot...');
      
      // Initialize Raydium service
      await raydiumService.initialize();
      
      // Send startup notification to Discord
      await discordService.sendNotification(
        'Bot Started',
        `Raydium CLMM Liquidity Bot has been started.`,
        0x0099ff, // Blue
        [
          { name: 'Pool ID', value: Config.raydium.poolId, inline: true },
          { name: 'Price Range', value: `${Config.raydium.priceRangePercent}%`, inline: true },
          { name: 'Check Interval', value: `${Config.bot.checkIntervalMinutes} minutes`, inline: true }
        ]
      );
      
      logger.info('Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bot', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Initializing bot' });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }
    
    try {
      await this.initialize();
      
      // Set up cron job to run bot operations
      const cronSchedule = `*/${Config.bot.checkIntervalMinutes} * * * *`; // Run every X minutes
      
      this.cronJob = cron.schedule(cronSchedule, async () => {
        try {
          await this.runIteration();
        } catch (error) {
          logger.error('Error during bot iteration', { error });
        }
      });
      
      this.isRunning = true;
      logger.info('Bot started', { cronSchedule });
      
      // Run initial iteration
      await this.runIteration();
    } catch (error) {
      logger.error('Failed to start bot', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Starting bot' });
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.cronJob) {
      logger.warn('Bot is not running');
      return;
    }
    
    this.cronJob.stop();
    this.cronJob = null;
    this.isRunning = false;
    
    logger.info('Bot stopped');
    
    await discordService.sendNotification(
      'Bot Stopped',
      'Raydium CLMM Liquidity Bot has been stopped.',
      0xff0000 // Red
    );
  }

  async runIteration(): Promise<void> {
    logger.info('Running bot iteration');
    
    try {
      // Step 1: Check price
      const priceInfo = await poolMonitor.checkPrice();
      
      // Step 2: Check positions
      const positionInfo = await poolMonitor.checkPositions();
      
      // Step 3: Check wallet balances
      const balanceInfo = await poolMonitor.checkWalletBalances();
      
      // Step 4: Decide if rebalancing is needed
      let shouldRebalance = false;
      
      // Rebalance if significant price change detected
      if (priceInfo.significantChange) {
        logger.info('Rebalancing due to significant price change');
        shouldRebalance = true;
      }
      
      // Rebalance if positions are out of range
      if (positionInfo.outOfRangeCount > 0) {
        logger.info('Rebalancing due to out-of-range positions');
        shouldRebalance = true;
      }
      
      // Rebalance if no positions exist
      if (positionInfo.positionsCount === 0) {
        logger.info('Creating initial position');
        shouldRebalance = true;
      }
      
      // Step 5: Rebalance if needed
      if (shouldRebalance) {
        const rebalanced = await positionManager.rebalanceIfNeeded();
        
        if (rebalanced) {
          logger.info('Rebalancing completed successfully');
        } else {
          logger.info('No rebalancing performed');
        }
      } else {
        logger.info('No rebalancing needed');
      }
      
      logger.info('Bot iteration completed successfully');
    } catch (error) {
      logger.error('Error in bot iteration', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Bot iteration' });
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const liquidityBot = new LiquidityBot();

// Graceful shutdown handler
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  if (liquidityBot.isActive()) {
    await liquidityBot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  if (liquidityBot.isActive()) {
    await liquidityBot.stop();
  }
  process.exit(0);
});