import { createApp } from './app.js';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dir=resolve(process.env.DATA_DIR || '.runtime');await mkdir(dir,{recursive:true});
let admin=process.env.ADMIN_TOKEN;
if(!admin && process.env.NODE_ENV==='production') throw new Error('ADMIN_TOKEN is required in production.');
if(!admin) {const path=join(dir,'admin-token');try{admin=(await readFile(path,'utf8')).trim();}catch{admin=randomBytes(32).toString('base64url');await writeFile(path,admin,{mode:0o600});}}
const app=await createApp({dataDir:dir,databaseUrl:process.env.DATABASE_URL,adminToken:admin,origins:(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173').split(','),logger:true});
await app.listen({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4181)});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{app.close().then(()=>process.exit(0));});
