import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { processChat } from './src/api/chatService.ts';

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';
dotenv.config();

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

// Global process error handlers to prevent unexpected termination during pre-warming probes
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

async function startServer() {
  const app = express();

  // Parse command-line args if passed (e.g., tsx server.ts --port 3000 --host 0.0.0.0)
  const args = process.argv.slice(2);
  let cliPort: number | undefined;
  let cliHost: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      cliPort = Number(args[i + 1]);
    } else if (args[i].startsWith('--port=')) {
      cliPort = Number(args[i].split('=')[1]);
    }
    if (args[i] === '--host' && args[i + 1]) {
      cliHost = args[i + 1];
    } else if (args[i].startsWith('--host=')) {
      cliHost = args[i].split('=')[1];
    }
  }

  const PORT = cliPort || Number(process.env.PORT) || 3000;
  const HOST = cliHost || process.env.HOST || '0.0.0.0';

  app.use(express.json({ limit: '10mb' }));

  // Immediate health check for platform pre-warmers
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Concierge API endpoint
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, currentTrip } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message manquant' });
        return;
      }

      const response = await processChat({ message, history, currentTrip });
      res.json(response);
    } catch (error) {
      console.error('Chat endpoint error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erreur serveur',
      });
    }
  });

  const server = http.createServer(app);

  // Set timeouts to handle reverse proxies and container keep-alives cleanly
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(rootDir, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(rootDir, 'dist', 'index.html'));
    });
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[server] Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.warn(`[server] Port ${PORT} in use, waiting for recovery...`);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Aura Voyage server ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM signal received. Gracefully closing HTTP server...');
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT signal received. Gracefully closing HTTP server...');
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  console.error('[server] Fatal error while starting server:', err);
});
