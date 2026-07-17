/**
 * Global Error Logger
 * Ensures bot does not crash on unhandled errors and logs them.
 */

const logger = {
  info: (message) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  },
  warn: (message) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  },
  error: (error, context = '') => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${context}`, error);
    // Future: Send critical errors to a designated developer Discord channel
  }
};

// Global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error(reason, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error(error, 'Uncaught Exception');
});

module.exports = logger;
