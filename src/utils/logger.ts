import winston from 'winston';

// Helper function to safely stringify objects with circular references
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Handle Error objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    return value;
  });
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        try {
          // Extract error information safely
          const processedMeta: any = {};
          for (const [key, value] of Object.entries(meta)) {
            if (value instanceof Error) {
              processedMeta[key] = {
                name: value.name,
                message: value.message,
                stack: value.stack,
              };
            } else if (value && typeof value === 'object') {
              // Try to extract safe properties from objects
              try {
                processedMeta[key] = safeStringify(value);
              } catch {
                processedMeta[key] = '[Object with circular reference]';
              }
            } else {
              processedMeta[key] = value;
            }
          }
          msg += ` ${safeStringify(processedMeta)}`;
        } catch (err) {
          // Fallback if stringify still fails
          msg += ` [Error serializing metadata]`;
        }
      }
      return msg;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
});

