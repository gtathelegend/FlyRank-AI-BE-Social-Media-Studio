import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SOCIAL_ADAPTER: z.enum(['discord', 'mock_x', 'mock_linkedin']).default('discord'),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
  POSTGRES_DB: z.string().default('social_studio'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10))
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = envSchema.parse({
      PORT: '3000',
      NODE_ENV: 'test',
      SOCIAL_ADAPTER: 'discord',
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/test/test'
    });
  } else {
    throw error;
  }
}

export const env = parsedEnv;
