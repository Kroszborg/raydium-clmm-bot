import type { NextApiRequest, NextApiResponse } from 'next';
import { liquidityBot } from '../../bot';
import logger from '../../services/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    if (liquidityBot.isActive()) {
      return res.status(200).json({ message: 'Bot is already running' });
    }
    
    await liquidityBot.start();
    logger.info('Bot started via API');
    
    return res.status(200).json({ message: 'Bot started successfully' });
  } catch (error) {
    logger.error('Failed to start bot via API', { error });
    return res.status(500).json({ error: 'Failed to start bot' });
  }
}