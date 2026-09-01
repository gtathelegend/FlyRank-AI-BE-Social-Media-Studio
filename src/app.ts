import express, { Express, Request, Response, NextFunction } from 'express';
import { postRouter } from './routes/postRoutes.js';

export const app: Express = express();

app.use(express.json());

app.use('/', postRouter);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Social Media Studio API',
    phase: 4,
    timestamp: new Date().toISOString()
  });
});

// JSON Syntax Error Middleware (Catches malformed JSON payloads and returns 400)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload provided in request body.'
      }
    });
    return;
  }
  next(err);
});

// Global Error Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled API Error:', err.message);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Stack traces are suppressed in production.'
    }
  });
});

export default app;
