import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

function createLogger(): pino.Logger {
  if (isDev && typeof window === 'undefined') {
    try {
      return pino({
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'HH:MM:ss Z',
          },
        },
      });
    } catch {
      // Fallback if Turbopack / Next.js bundling does not support pino worker thread transports
    }
  }

  return pino({
    level: isDev ? 'debug' : 'info',
  });
}

const logger = createLogger();

export default logger;
