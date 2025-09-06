import { Client } from '@neondatabase/serverless';

const cs = process.env.DIRECT_DATABASE_URL || '';
if (!cs) { console.log('no DIRECT_DATABASE_URL'); process.exit(0); }

const client = new Client(cs);
(async () => {
  try {
    await client.connect();
    const r = await client.query('SELECT 1 as x');
    console.log('ok', r.rows);
  } catch (e) {
    console.error('err', e);
  } finally {
    await client.end();
  }
})();
