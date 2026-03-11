import { env } from './config/env.js';
import { connectDb } from './db/connect.js';
import { createApp } from './server.js';

async function main() {
  await connectDb(env.MONGODB_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🚀  API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
