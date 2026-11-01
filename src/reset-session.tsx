import React,{useRef,useState} from 'react';
import type {Session} from '../server/model';
import {request} from './client';

export function ResetSession({session,participants,cards,token,onReset}:{session:Session;participants:number;cards:number;token:string;onReset:()=>Promise<unknown>}){
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
  const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [target,setTarget]=useState({session,participants,cards,operationId:''});
  function open(){setTarget({session,participants,cards,operationId:crypto.randomUUID()});setConfirmation('');setError('');dialog.current?.showModal();cancel.current?.focus({preventScroll:true});}
  function close(){if(!busy)dialog.current?.close();}
  async function reset(e:React.FormEvent){
    e.preventDefault();if(busy||confirmation!==target.session.code)return;setBusy(true);setError('');
    try{await request(`/v1/sessions/${target.session.id}/reset`,token,{operationId:target.operationId,expectedRevision:target.session.revision,confirmation});await onReset();dialog.current?.close();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="session-reset-panel">
    <div><h2>Start over</h2><p>Empty this session and return everyone to the start.</p></div>
    <button className="reset-open" onClick={open}>Reset all…</button>
    <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={e=>{if(busy)e.preventDefault();}}>
      <form onSubmit={e=>void reset(e)}>
        <p className="eyebrow">RESET SESSION · {target.session.code}</p>
        <h2 id="reset-title">Are you sure?</h2>
        <p id="reset-description">Restart <strong>{target.session.title}</strong> from zero?</p>
        <ul><li>Clear {target.participants} participant registrations, all answers and AI choices, and {target.cards} shared builds and cards.</li><li>Stop the timers and return the big screen to the welcome lobby.</li><li>Send phones back to Join and clear their drafts and pending uploads when they reconnect.</li></ul>
        <p>The QR code and facilitator / big-screen links stay the same. A private copy of the previous server run is kept for recovery; private phone drafts cannot be restored.</p>
        <label>Type <strong>{target.session.code}</strong> to confirm<input value={confirmation} onChange={e=>setConfirmation(e.target.value.toUpperCase())} disabled={busy} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12}/></label>
        {error&&<p className="error" role="alert">{error}</p>}
        <div className="reset-actions"><button ref={cancel} type="button" onClick={close} disabled={busy}>Cancel</button><button className="reset-confirm" disabled={busy||confirmation!==target.session.code}>{busy?'Resetting…':'Reset all and restart'}</button></div>
      </form>
    </dialog>
  </section>;
}
