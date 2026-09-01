import express, { Express, Request, Response, NextFunction } from 'express';
import { postRouter } from './routes/postRoutes.js';

export const app: Express = express();

app.use(express.json());

app.use('/', postRouter);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Social Media Studio API',
    phase: 2,
    timestamp: new Date().toISOString()
  });
});

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
