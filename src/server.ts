import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Social Media Studio] Server running on port ${PORT} in ${env.NODE_ENV} mode.`);
  console.log(`[Social Media Studio] Active default social adapter: ${env.SOCIAL_ADAPTER}`);
});
