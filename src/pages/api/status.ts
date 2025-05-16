import type { NextApiRequest, NextApiResponse } from 'next';
import { liquidityBot } from '../../bot';
import { raydiumService } from '../../services/raydium';
import { poolMonitor } from '../../bot/monitor';
import logger from '../../services/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const isRunning = liquidityBot.isActive();
    
    let priceInfo = null;
    let positionInfo = null;
    let balanceInfo = null;
    
    if (isRunning) {
      // Get current status information
      priceInfo = await poolMonitor.checkPrice();
      positionInfo = await poolMonitor.checkPositions();
      balanceInfo = await poolMonitor.checkWalletBalances();
    }
    
    return res.status(200).json({
      isRunning,
      priceInfo,
      positionInfo,
      balanceInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get bot status via API', { error });
    return res.status(500).json({ error: 'Failed to get bot status' });
  }
}