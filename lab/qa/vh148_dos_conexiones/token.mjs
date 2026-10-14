import crypto from 'node:crypto'; import fs from 'node:fs';
const S = fs.readFileSync(new URL('./jwt_secret', import.meta.url), 'utf8').trim();
const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const [email] = process.argv.slice(2);
const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ role: 'authenticated', email, sub: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 600 });
console.log(`${h}.${p}.${crypto.createHmac('sha256', S).update(`${h}.${p}`).digest('base64url')}`);
