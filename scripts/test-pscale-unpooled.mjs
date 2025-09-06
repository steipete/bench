import postgres from 'postgres';

const url = process.env.PLANETSCALE_DATABASE_URL_UNPOOLED || '';
if (!url) {
  console.log('no PLANETSCALE_DATABASE_URL_UNPOOLED');
  process.exit(0);
}

const sql = postgres(url, { max: 1, ssl: 'require', idle_timeout: 20, connect_timeout: 10 });

(async () => {
  try {
    const res = await sql`SELECT 1 as x`;
    console.log('ok', res);
  } catch (e) {
    console.error('err', e);
  } finally {
    await sql.end();
  }
})();
