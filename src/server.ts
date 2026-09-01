import app from './app.js';
import { env } from './config/env.js';
import { initDatabase } from './db/db.js';

const PORT = env.PORT || 3000;

async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`[Social Media Studio] Server running on port ${PORT} in ${env.NODE_ENV} mode.`);
    console.log(`[Social Media Studio] Active default social adapter: ${env.SOCIAL_ADAPTER}`);
  });
}

startServer().catch((err) => {
  console.error('[Social Media Studio] Server startup error:', err);
});
