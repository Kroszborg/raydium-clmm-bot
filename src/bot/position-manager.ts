import BN from 'bn.js';
import { DecimalUtils } from '@raydium-io/raydium-sdk';
import { TokenBalance } from '../services/solana';
import { raydiumService } from '../services/raydium';
import { solanaService } from '../services/solana';
import { discordService } from '../services/discord';
import logger from '../services/logger';
import { Config } from '../config';

export class PositionManager {
  async createOptimalPosition(): Promise<string | null> {
    try {
      // Ensure pool info is initialized
      if (!await raydiumService.isPoolInitialized()) {
        await raydiumService.initialize();
      }
      
      // Get wallet token balances
      const tokenBalances = await solanaService.getTokenBalances();
      const positions = await raydiumService.getPositions();
      
      // If we already have positions, don't create a new one
      if (positions.length > 0) {
        logger.info('Active positions exist, skipping position creation', { count: positions.length });
        return null;
      }
      
      // Get token information
      const poolInfo = await raydiumService.fetchPoolInfo();
      const mintA = poolInfo.mintA.toString();
      const mintB = poolInfo.mintB.toString();
      
      // Get balances of pool tokens
      const tokenABalance = tokenBalances.get(mintA);
      const tokenBBalance = tokenBalances.get(mintB);
      
      if (!tokenABalance || !tokenBBalance) {
        logger.warn('Missing token balances needed for position', { 
          hasTokenA: !!tokenABalance, 
          hasTokenB: !!tokenBBalance 
        });
        return null;
      }
      
      // Check if balances are sufficient
      const minAmount = new BN(1000); // Minimum amount to create a position
      if (tokenABalance.amount < minAmount || tokenBBalance.amount < minAmount) {
        logger.warn('Insufficient token balances for creating position', {
          tokenA: tokenABalance.uiAmount,
          tokenB: tokenBBalance.uiAmount
        });
        return null;
      }
      
      // Create position with available tokens
      // Use 95% of available balance to leave room for fees
      const amountA = tokenABalance.amount * BigInt(95) / BigInt(100);
      const amountB = tokenBBalance.amount * BigInt(95) / BigInt(100);
      
      logger.info('Creating position', {
        tokenA: DecimalUtils.fromBN(new BN(amountA.toString()), tokenABalance.decimals),
        tokenB: DecimalUtils.fromBN(new BN(amountB.toString()), tokenBBalance.decimals)
      });
      
      const signature = await raydiumService.createPosition(
        new BN(amountA.toString()), 
        new BN(amountB.toString())
      );
      
      return signature;
    } catch (error) {
      logger.error('Failed to create position', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Creating optimal position' });
      return null;
    }
  }

  async withdrawOutOfRangePositions(): Promise<string[]> {
    try {
      const positions = await raydiumService.getPositions();
      const signatures: string[] = [];
      
      // Find out-of-range positions
      const outOfRangePositions = positions.filter(position => !position.inRange);
      
      if (outOfRangePositions.length === 0) {
        logger.info('No out-of-range positions to withdraw');
        return signatures;
      }
      
      // Withdraw each out-of-range position
      for (const position of outOfRangePositions) {
        logger.info('Withdrawing out-of-range position', { 
          positionId: position.positionId,
          currentPrice: position.currentPrice,
          range: `${position.lowerPrice} - ${position.upperPrice}`
        });
        
        const signature = await raydiumService.withdrawPosition(position.positionId);
        signatures.push(signature);
      }
      
      return signatures;
    } catch (error) {
      logger.error('Failed to withdraw out-of-range positions', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Withdrawing out-of-range positions' });
      return [];
    }
  }

  async rebalanceIfNeeded(): Promise<boolean> {
    try {
      // Get current positions
      const positions = await raydiumService.getPositions();
      
      // If we have no positions, try to create one
      if (positions.length === 0) {
        const signature = await this.createOptimalPosition();
        return !!signature;
      }
      
      // Check if any positions are out of range
      const outOfRangePositions = positions.filter(position => !position.inRange);
      
      if (outOfRangePositions.length > 0) {
        // Withdraw out-of-range positions
        const withdrawSignatures = await this.withdrawOutOfRangePositions();
        
        if (withdrawSignatures.length > 0) {
          // Create a new position with the withdrawn funds
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for transactions to settle
          const createSignature = await this.createOptimalPosition();
          return !!createSignature;
        }
      }
      
      // No rebalancing needed
      return false;
    } catch (error) {
      logger.error('Failed to rebalance positions', { error });
      await discordService.sendErrorNotification(error as Error, { action: 'Rebalancing positions' });
      return false;
    }
  }
}

export const positionManager = new PositionManager();