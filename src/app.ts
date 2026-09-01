import express, { Express, Request, Response } from 'express';

export const app: Express = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Social Media Studio API',
    phase: 1,
    timestamp: new Date().toISOString()
  });
});

app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err.message);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Stack traces are suppressed in production.'
    }
  });
});

export default app;
