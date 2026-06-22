import { chunkText } from './src/lib/rag/chunking.ts';
import pg from 'pg';
const c = new pg.Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
await c.connect();
const r = await c.query("SELECT id, conteudo_texto FROM fonte LIMIT 1");
if (!r.rows[0]) { console.log('SEM FONTES'); await c.end(); process.exit(0); }
const texto = r.rows[0].conteudo_texto ?? '';
console.log('fonte:', r.rows[0].id);
console.log('tam:', texto.length, '| trim:', texto.trim().length);
console.log('amostra:', JSON.stringify(texto.slice(0, 300)));
const chunks = chunkText({ texto, metadados: { fonte_id: 'x' } });
console.log('CHUNKS GERADOS:', chunks.length);
await c.end();
