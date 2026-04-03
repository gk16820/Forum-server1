import 'dotenv/config'; // loads .env
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env.local if it exists (overrides .env; for local development)
// NOTE: app.js must be dynamically imported AFTER this block runs.
// Static `import` statements are hoisted in ESM, meaning they execute before
// any top-level code — so if app.js were a static import, DATABASE_URL from
// .env would already be read by db.js before .env.local could override it.
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  config({ path: localEnv, override: true });
}

// Dynamic import ensures app.js (and db.js) read process.env AFTER overrides.
const { default: app } = await import('./app.js');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
