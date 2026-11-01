import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const api=process.env.API_URL||'http://127.0.0.1:4181',admin=process.env.ADMIN_TOKEN||(await readFile('.runtime/admin-token','utf8')).trim(),count=Number(process.env.USERS||400);
const latencies:number[]=[],errors:string[]=[];
async function call(path:string,token='',body?:unknown,method=body?'POST':'GET') {const start=performance.now();const res=await fetch(api+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});latencies.push(performance.now()-start);const data=await res.json();if(!res.ok){errors.push(res.status+': '+data.error);throw new Error(data.error);}return data;}
const session=await call('/v1/sessions',admin,{title:'LOAD TEST — '+new Date().toISOString()}),root='/v1/sessions/'+session.id;
const clients=await Promise.all(Array.from({length:count},()=>call('/v1/join','',{code:session.code,joinKey:randomUUID()})));
const abort=new AbortController();let liveConnections=0;
const streams=clients.map(async c=>{const r=await fetch(api+root+'/events',{headers:{Authorization:'Bearer '+c.token},signal:abort.signal});if(!r.ok)throw new Error('SSE '+r.status);liveConnections++;const reader=r.body!.getReader();try{while(!(await reader.read()).done){}}catch{}});
await call(root+'/control',session.hostToken,{expectedRevision:0,phase:0},'PATCH');
await Promise.all(clients.map((c,i)=>call(root+'/me',c.token,{operationId:randomUUID(),expectedRevision:0,patch:{before:i%3,share:true}},'PATCH')));
await call(root+'/control',session.hostToken,{expectedRevision:1,phase:5},'PATCH');
await Promise.all(clients.map((c,i)=>call(root+'/me',c.token,{operationId:randomUUID(),expectedRevision:1,patch:{after:(i+1)%3}},'PATCH')));
const snapshot=await call(root+'/snapshot',session.stageToken);
abort.abort();await Promise.allSettled(streams);
await call(root+'/control',session.hostToken,{expectedRevision:2,closed:true},'PATCH');
latencies.sort((a,b)=>a-b);const report={at:new Date().toISOString(),api,users:count,liveConnections,requests:latencies.length,errors,total:snapshot.total,paired:snapshot.paired,p50Ms:Math.round(latencies[Math.floor(latencies.length*.5)]),p95Ms:Math.round(latencies[Math.floor(latencies.length*.95)]),maxMs:Math.round(latencies.at(-1)!)};
await mkdir('.runtime',{recursive:true});await writeFile('.runtime/load-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length||snapshot.total!==count||snapshot.paired!==count||liveConnections!==count)process.exitCode=1;
