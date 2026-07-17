const crypto = require('crypto');
const logger = require('../utils/logger');

const AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000/api';

// Simulated memory store for screenshot hashes (In prod, store in Redis or Postgres)
const processedHashes = new Set();

/**
 * Validates if an image has been submitted before to prevent fraud.
 */
function isImageUnique(imageUrl) {
  const hash = crypto.createHash('md5').update(imageUrl).digest('hex'); 
  if (processedHashes.has(hash)) {
    return false;
  }
  processedHashes.add(hash);
  return true;
}

/**
 * Sends image to FastAPI for LangChain Vision Analysis
 */
async function processVisionTask(imageUrl) {
  logger.info(`Routing Vision task to FastAPI AI Brain...`);
  
  if (!isImageUnique(imageUrl)) {
    return "❌ **Anti-Fraud System:** This screenshot has already been analyzed before. Please upload a fresh screenshot.";
  }

  try {
    const response = await fetch(`${AI_BRAIN_URL}/analyze-battle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl })
    });
    if (!response.ok) throw new Error('Failed to reach AI Brain');
    const data = await response.json();
    return data.analysis;
  } catch (error) {
    logger.error(error, 'AI Brain Vision Error');
    return "❌ Error: The AI Brain is currently offline or unreachable.";
  }
}

/**
 * Sends text prompt to FastAPI for Coaching via RAG
 */
async function generateAdvice(prompt) {
  logger.info(`Routing Coaching task to FastAPI AI Brain...`);
  try {
    const response = await fetch(`${AI_BRAIN_URL}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt })
    });
    if (!response.ok) throw new Error('Failed to reach AI Brain');
    const data = await response.json();
    return data.advice;
  } catch (error) {
    logger.error(error, 'AI Brain Coaching Error');
    return "❌ Error: The AI Brain is currently offline or unreachable.";
  }
}

module.exports = {
  processVisionTask,
  generateAdvice
};
