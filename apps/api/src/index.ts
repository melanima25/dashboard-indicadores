import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { parseEnv } from './env';

const env = parseEnv();
const { db } = createDb(env.DATABASE_URL);
const app = createApp(db, { adminKey: env.ADMIN_KEY });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API em http://localhost:${info.port}`);
});
