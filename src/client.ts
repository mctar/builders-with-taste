import { get, set } from 'idb-keyval';
import type { Answers, Participant, Session } from '../server/model';
export const API=(import.meta.env.VITE_API_URL || '').replace(/\/$/,'');
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function request<T>(path:string,token='',body?:unknown,method=body?'POST':'GET'):Promise<T> {
  const response=await fetch(API+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(!response.ok) {const data=await response.json().catch(()=>({}));throw new ApiError(response.status,data.error || 'Unable to connect. Please try again.');}return response.json();
}
export async function live(id:string,token:string,signal:AbortSignal,onChange:()=>void,onConnection:(online:boolean)=>void) {
  while(!signal.aborted) {
    try {
      const res=await fetch(API+`/v1/sessions/${id}/events`,{headers:{Authorization:'Bearer '+token},signal});
      if(!res.ok || !res.body) throw new Error('Live connection unavailable');
      onConnection(true);onChange();const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(!signal.aborted) {const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);if(event.includes('data:')) onChange();}}
    } catch { /* The HTTP snapshot remains the source of truth. */ }
    onConnection(false);if(signal.aborted)break;
    await new Promise<void>(resolve=>{const t=setTimeout(resolve,2500+Math.random()*2000);signal.addEventListener('abort',()=>{clearTimeout(t);resolve();},{once:true});});
  }
}
export type Draft={step:number; decided:string; name:string; what:string; mine:string; pilePhoto:string; buildPhoto:string; conceptPhoto:string; handedOff:boolean; sent:boolean; answers:Answers};
const blank=():Draft=>({step:0,decided:'',name:'',what:'',mine:'',pilePhoto:'',buildPhoto:'',conceptPhoto:'',handedOff:false,sent:false,answers:{}});
type Job={id:string; kind:'patch'|'publish'; patch?:Answers; card?:{kind:'build'|'concept'; title:string; description:string; mine:string; photo:string}; body?:any; assetId?:string; consentVersion?:number};
export type Identity={id:string;token:string;participant:Participant;session:Session};
export class Workshop {
  draft=blank(); jobs:Job[]=[]; message=''; busy=false; blocked=false; onChange=()=>{}; private persisting=Promise.resolve();
  constructor(public identity:Identity){}
  get key(){return `bwt:${this.identity.id}:${this.identity.participant.id}`;}
  async init(){const saved=await get<{draft:Draft;jobs:Job[]}>(this.key);if(saved){this.draft=saved.draft;this.jobs=saved.jobs;}else{this.draft.answers=this.identity.participant.data;this.draft.step=this.identity.participant.data.progress||0;}this.onChange();}
  async persist(){const snapshot=structuredClone({draft:this.draft,jobs:this.jobs});const save=()=>set(this.key,snapshot);this.persisting=this.persisting.then(save,save).catch(()=>{this.message='Phone storage is full. Keep this page open and free some space.';this.onChange();throw new Error(this.message);});await this.persisting;}
  edit(patch:Partial<Draft>){Object.assign(this.draft,patch);this.onChange();void this.persist().catch(()=>{});}
  async patch(patch:Answers){
    Object.assign(this.draft.answers,patch);
    if(patch.share===false){this.jobs=this.jobs.filter(j=>j.kind!=='publish');this.draft.sent=false;}
    this.jobs.push({id:crypto.randomUUID(),kind:'patch',patch});this.onChange();await this.persist();void this.flush();
  }
  async publish(kind:'build'|'concept'){
    if(!this.draft.answers.share)return;
    this.jobs.push({id:crypto.randomUUID(),kind:'publish',card:{kind,title:kind==='concept'?this.draft.name:'First build',description:kind==='concept'?this.draft.what:'',mine:kind==='concept'?this.draft.mine:'',photo:kind==='concept'?(this.draft.conceptPhoto||this.draft.buildPhoto):this.draft.buildPhoto}});
    this.draft.sent=false;this.onChange();await this.persist();void this.flush();
  }
  async flush(){
    if(this.busy || this.blocked || !this.jobs.length)return;
    this.busy=true;this.onChange();
    try {
      while(this.jobs.length){
        const job=this.jobs[0],{id,token}=this.identity;
        if(job.kind==='patch') {
          job.body ||= {operationId:job.id,expectedRevision:this.identity.participant.revision,patch:job.patch};await this.persist();
          this.identity.participant=await request<Participant>(`/v1/sessions/${id}/me`,token,job.body,'PATCH');
        } else {
          if(!this.draft.answers.share){this.jobs.shift();continue;}
          job.consentVersion ??= this.identity.participant.consentVersion;await this.persist();
          if(job.card!.photo && !job.assetId){
            const blob=await(await fetch(job.card!.photo)).blob(),form=new FormData();form.append('photo',blob,'build.jpg');
            const res=await fetch(API+`/v1/sessions/${id}/photos?consentVersion=${job.consentVersion}`,{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
            if(!res.ok){const e=await res.json();throw new ApiError(res.status,e.error);}
            job.assetId=(await res.json()).assetId;await this.persist();
          }
          if(!this.draft.answers.share || !this.jobs.includes(job))continue;
          job.body ||= {operationId:job.id,expectedRevision:this.identity.participant.revision,consentVersion:job.consentVersion,kind:job.card!.kind,title:job.card!.title,description:job.card!.description,mine:job.card!.mine,assetId:job.assetId||null};await this.persist();
          await request(`/v1/sessions/${id}/cards`,token,job.body);if(job.card!.kind==='concept')this.draft.sent=true;
        }
        if(this.jobs[0]===job)this.jobs.shift();this.message='';await this.persist();this.onChange();
      }
    } catch(e){this.message=e instanceof ApiError?e.message:'Saved on this phone. Waiting for a connection to send.';if(e instanceof ApiError && e.status>=400 && e.status<500 && e.status!==429){this.blocked=true;}}finally{this.busy=false;this.onChange();}
  }
  async retry(){if(this.blocked){this.blocked=false;this.jobs=[];this.draft.sent=false;await this.refresh();this.draft.answers={...this.identity.participant.data};await this.persist();this.message='Connected again. Please make your selection or submit your card again.';}else await this.flush();this.onChange();}
  async refresh(){const state=await request<{session:Session;participant:Participant}>(`/v1/sessions/${this.identity.id}`,this.identity.token);this.identity.session=state.session;if(!this.jobs.length && !this.busy){this.identity.participant=state.participant;this.draft.answers={...state.participant.data,...this.draft.answers};}this.onChange();}
}
export async function photograph(file:File):Promise<string>{
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('This photo could not be opened. Try taking a new photo.');});
  const factor=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const image=canvas.toDataURL('image/jpeg',.78);if(image.length>2400000)throw new Error('This photo is too large. Try a simpler photo.');return image;
}
