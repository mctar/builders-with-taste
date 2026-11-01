import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Workshop,type Identity} from '../src/client';

const identity=():Identity=>({id:'room',token:'old-token',session:{id:'room',code:'ABCDEF',title:'Rehearsal',run:0,phase:5,revision:0,closed:false,galleryPaused:false,stageView:'overview',endsAt:null,remainingMs:null,serverTime:new Date().toISOString()},participant:{id:'old-builder',revision:0,consentVersion:0,data:{}}});
function memory(){const items=new Map<string,any>();return {items,get:async<T>(key:string)=>items.get(key) as T|undefined,set:async(key:string,value:unknown)=>{items.set(key,structuredClone(value));},del:async(key:string)=>{items.delete(key);}};}
const resetResponse=()=>new Response(JSON.stringify({error:'Your facilitator reset the session.'}),{status:410});

test('reconnecting after reset discards private drafts and the offline outbox before sending anything',async()=>{
  const fetch=globalThis.fetch,store=memory(),w=new Workshop(identity(),store);let resets=0,writes=0;w.onReset=()=>resets++;
  store.items.set(w.key,{draft:{step:7,pilePhoto:'private-photo',name:'Old concept',answers:{share:true,aiTool:'Gemini'}},jobs:[{id:crypto.randomUUID(),kind:'patch',patch:{before:2}}]});
  globalThis.fetch=async(_url,options)=>{if(options?.method==='PATCH')writes++;return resetResponse();};
  try{await w.init();await w.flush();await w.refresh();assert.equal(w.reset,true);assert.equal(resets,1);assert.equal(writes,0);assert.equal(store.items.has(w.key),false);assert.equal(w.draft.pilePhoto,'');assert.equal(w.draft.name,'');assert.equal(w.jobs.length,0);assert.deepEqual(w.draft.answers,{});}finally{globalThis.fetch=fetch;}
});

test('a late save response cannot restore an old draft after a reset',async()=>{
  const fetch=globalThis.fetch,store=memory(),w=new Workshop(identity(),store);let release!:(response:Response)=>void,entered!:()=>void;
  const pending=new Promise<Response>(r=>release=r),started=new Promise<void>(r=>entered=r);let resets=0;w.onReset=()=>resets++;
  globalThis.fetch=async(_url,options)=>{if(options?.method==='PATCH'){entered();return pending;}return resetResponse();};
  try{
    w.edit({step:7,name:'Old title',buildPhoto:'old-photo'});await w.patch({before:1});await started;
    await w.refresh();release(new Response(JSON.stringify({...w.identity.participant,revision:1,data:{before:1}})));
    await new Promise<void>(resolve=>{const timer=setInterval(()=>{if(!w.busy){clearInterval(timer);resolve();}},1);});
    assert.equal(resets,1);assert.equal(w.draft.step,0);assert.equal(w.draft.buildPhoto,'');assert.equal(w.jobs.length,0);assert.equal(store.items.has(w.key),false);assert.equal(w.identity.participant.revision,0);
  }finally{globalThis.fetch=fetch;}
});

test('ordinary expired access does not erase a private draft',async()=>{
  const fetch=globalThis.fetch,store=memory(),w=new Workshop(identity(),store);store.items.set(w.key,{draft:{step:4,pilePhoto:'keep-photo',answers:{}},jobs:[]});
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Expired access'}),{status:401});
  try{await w.init();assert.equal(w.reset,false);assert.equal(w.draft.pilePhoto,'keep-photo');assert.equal(store.items.has(w.key),true);}finally{globalThis.fetch=fetch;}
});

test('retrying a blocked save after reset does not copy old answers back into the cleared draft',async()=>{
  const fetch=globalThis.fetch,store=memory(),w=new Workshop(identity(),store);w.blocked=true;w.identity.participant.data={before:2,share:true};w.edit({pilePhoto:'old-photo',answers:{before:2}});
  globalThis.fetch=async()=>resetResponse();
  try{await w.retry();assert.equal(w.reset,true);assert.deepEqual(w.draft.answers,{});assert.equal(w.draft.pilePhoto,'');assert.equal(store.items.has(w.key),false);}finally{globalThis.fetch=fetch;}
});
