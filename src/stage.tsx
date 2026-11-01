import React,{useEffect,useRef,useState,type CSSProperties} from 'react';
import {PHASES,SCALE,type Card,type Snapshot,type Session} from '../server/model';
import {media} from './media';
import {pairedMovement,stageHeading} from './stage-data';
import './stage.css';

const COLORS=['#f48bce','#83c9ff','#b4ee6b'];
const PALE=['#f9c8e7','#c9e7ff','#d5f7ad'];
type StageProps={snapshot:Snapshot;connected:boolean;error:string;qr:React.ReactNode;joinUrl:string;photo:(card:Card,full?:boolean)=>React.ReactNode};
const styleVars=(values:Record<string,string|number>)=>values as CSSProperties;

function Brick({className='',color,style}:{className?:string;color?:string;style?:CSSProperties}){
  return <span aria-hidden="true" className={'toy-brick '+className} style={{...style,...color?styleVars({'--brick-color':color}):{}}}><i/><i/><i/><i/></span>;
}
function useMotion(){
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[paused,setPaused]=useState(false);
  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  return {enabled:!reduced&&!paused,paused:reduced||paused,forced:reduced,toggle:()=>setPaused(v=>!v)};
}
function StageClock({session}:{session:Session}){
  const [now,setNow]=useState(Date.now());const anchor=useRef({server:session.serverTime,at:Date.now()});
  if(anchor.current.server!==session.serverTime)anchor.current={server:session.serverTime,at:Date.now()};
  useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[]);
  const serverNow=Date.parse(anchor.current.server)+Math.max(0,now-anchor.current.at);
  const remaining=session.endsAt?Math.max(0,Date.parse(session.endsAt)-serverNow):session.remainingMs;
  if(remaining===null)return null;
  const seconds=Math.ceil(remaining/1000),maximum=session.phase===1?420000:480000;
  return <div className={'play-clock'+(remaining<=60000?' almost':'')} style={styleVars({'--clock-fill':`${100*Math.min(1,remaining/maximum)}%`})}>
    <span className="play-clock-label">{session.remainingMs!==null?'PAUSED':seconds===0?'WRAP IT UP':'TIME TO MAKE'}</span>
    <strong>{Math.floor(seconds/60)}<span>:</span>{String(seconds%60).padStart(2,'0')}</strong>
    <div className="play-clock-track"><i/></div>
  </div>;
}
function Count({value}:{value:number}){return <span className="play-count" key={value}>{value}</span>;}

function VoteBoard({counts,total,label,compact=false}:{counts:number[];total:number;label:string;compact?:boolean}){
  const answers=counts.reduce((a,b)=>a+b,0);
  const maximum=Math.max(0,...counts),columns=maximum>120?20:maximum>40?12:maximum>12?8:4;
  const rows=Math.max(1,Math.ceil(maximum/columns)),step=`min(${compact?32:42}px, calc((100% - 16px) / ${rows}))`;
  return <section className={'vote-board'+(compact?' compact':'')} aria-label={`${label}: ${answers} of ${total} answers`}>
    <div className="play-section-heading"><h2>{label}</h2><span><b>{answers}</b> / {total} answered</span></div>
    <div className="vote-stacks">{counts.map((n,category)=>{
      return <div className="vote-category" key={category} style={styleVars({'--vote-color':COLORS[category],'--vote-pale':PALE[category]})}>
        <div className="vote-stack-field" aria-hidden="true"><div className="vote-base"/>
          {Array.from({length:n},(_,i)=><Brick key={i} className="vote-unit" color={COLORS[category]} style={{left:`${i%columns/columns*100}%`,bottom:`calc(${step} * ${Math.floor(i/columns)} + 10px)`,width:`calc(${100/columns}% - 3px)`,height:`calc(${step} - 3px)`,animationDelay:`${Math.min(i,16)*.035}s`,...styleVars({'--tilt':`${((i*7+category)%5-2)*1.2}deg`})}}/>)}
          {n===0&&<div className="empty-stack"><span>your<br/>move</span></div>}
        </div>
        <div className="vote-label"><strong><Count value={n}/></strong><h3>{SCALE[category][0]}</h3><p>{SCALE[category][1]}</p></div>
      </div>;
    })}</div>
    <p className="vote-key"><span/>Each brick in a stack is one answer.</p>
  </section>;
}

function Movement({snapshot,motion}:{snapshot:Snapshot;motion:boolean}){
  const {before,after,total,moved,stayed}=pairedMovement(snapshot.transitions);
  if(!total)return <div className="unpaired-results"><VoteBoard counts={snapshot.before} total={snapshot.total} label="At the start"/><div className="waiting-reveal"><Brick color={COLORS[2]}/><h2>The next move<br/>is still being made.</h2><p>Before-and-after paths appear when people answer both questions.</p></div></div>;
  const ys=[75,235,395];
  return <section className="movement-view" aria-label={`${total} paired answers; ${moved} changed category and ${stayed} stayed in the same category`}>
    <div className="movement-top"><span>AT THE START</span><div><b>{moved}</b> moved <span>·</span> <b>{stayed}</b> stayed</div><span>JUST NOW</span></div>
    <svg viewBox="0 0 1400 470" className="movement-map" role="img" aria-label="Ribbons connect the categories people chose before and after. Ribbon width represents the number of paired answers.">
      <defs>{COLORS.map((color,i)=>COLORS.map((target,j)=><linearGradient id={`ribbon-${i}-${j}`} key={`${i}-${j}`} gradientUnits="userSpaceOnUse" x1="340" y1="0" x2="1060" y2="0"><stop offset="0%" stopColor={color}/><stop offset="100%" stopColor={target}/></linearGradient>))}</defs>
      {snapshot.transitions.map((row,from)=>row.map((n,to)=>{
        if(!n)return null;const path=`M 340 ${ys[from]} C 570 ${ys[from]}, 830 ${ys[to]}, 1060 ${ys[to]}`;
        return <g key={`${from}-${to}`}><path className="ribbon-glow" d={path} stroke={`url(#ribbon-${from}-${to})`} strokeWidth={9+70*n/total}/><path d={path} fill="none" stroke={`url(#ribbon-${from}-${to})`} strokeWidth={4+45*n/total} opacity=".65"/>
          {motion&&Array.from({length:Math.min(4,Math.max(1,Math.ceil(n/total*8)))},(_,i)=><g className="ribbon-traveller" key={i}><rect x="-15" y="-9" width="30" height="18" rx="4" fill={PALE[to]}/><circle cx="-6" cy="-5" r="4" fill={COLORS[to]}/><circle cx="6" cy="-5" r="4" fill={COLORS[to]}/><animateMotion dur={`${5+from+to}s`} repeatCount="indefinite" begin={`${-i*2.2}s`} path={path}/></g>)}
        </g>;
      }))}
      {COLORS.map((color,i)=><React.Fragment key={color}><g className="movement-node"><rect x="0" y={ys[i]-61} width="330" height="122" rx="14" fill={color}/><text x="24" y={ys[i]-7} className="movement-category">{SCALE[i][0]}</text><text x="24" y={ys[i]+34} className="movement-caption">{SCALE[i][1]}</text><text x="302" y={ys[i]+13} textAnchor="end" className="movement-number">{before[i]}</text></g><g className="movement-node"><rect x="1070" y={ys[i]-61} width="330" height="122" rx="14" fill={color}/><text x="1094" y={ys[i]-7} className="movement-category">{SCALE[i][0]}</text><text x="1094" y={ys[i]+34} className="movement-caption">{SCALE[i][1]}</text><text x="1372" y={ys[i]+13} textAnchor="end" className="movement-number">{after[i]}</text></g></React.Fragment>)}
    </svg>
    <div className="movement-key"><b>{total} people answered both questions.</b><span>Ribbon widths show how many took each path.</span></div>
  </section>;
}

function Spotlight({cards,paused,photo,large=false}:{cards:Card[];paused:boolean;photo:StageProps['photo'];large?:boolean}){
  const [index,setIndex]=useState(0),[arrival,setArrival]=useState<string|null>(null),seen=useRef<Set<string>|null>(null),arrivalTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const timer=setInterval(()=>setIndex(i=>i+1),11000);return()=>clearInterval(timer);},[cards.length]);
  useEffect(()=>{
    const next=new Set(cards.map(c=>c.id));
    if(seen.current){const incoming=cards.find(c=>!seen.current!.has(c.id));if(incoming){setIndex(cards.indexOf(incoming));setArrival(incoming.id);clearTimeout(arrivalTimer.current);arrivalTimer.current=setTimeout(()=>setArrival(null),6000);}}
    seen.current=new Set([...(seen.current||[]),...next]);
  },[cards]);
  useEffect(()=>()=>clearTimeout(arrivalTimer.current),[]);
  const ordered=cards.filter(c=>!c.hidden),card=ordered.length?ordered[index%ordered.length]:null;
  if(paused||!card)return <section className="empty-spotlight"><div className="empty-bricks" aria-hidden="true"><Brick color={COLORS[0]}/><Brick color={COLORS[1]}/><Brick color={COLORS[2]}/></div><p className="play-eyebrow">{paused?'GALLERY PAUSED':'THIS SPACE HAS YOUR NAME ON IT'}</p><h2>{paused?<>Eyes up.<br/>A moment together.</>:<>Something good<br/>is taking shape.</>}</h2><p>{paused?'The facilitator will bring the builds back.':'Share your build from your phone. It’ll land right here.'}</p></section>;
  const selected=arrival===card.id;
  return <section className={'spotlight'+(large?' spotlight-large':'')}>
    <div className="play-section-heading"><h2>{selected?'Just landed!':'Fresh off the table'}</h2><span>{index%ordered.length+1} / {ordered.length}</span></div>
    <article className={'spotlight-card'+(selected?' just-landed':'')} key={card.id+card.updatedAt}>
      <div className="spotlight-photo">{card.assetId?photo(card,true):<div className="idea-without-photo"><Brick color={COLORS[0]}/><Brick color={COLORS[1]}/><Brick color={COLORS[2]}/><span>AN IDEA WORTH<br/>BUILDING ON.</span></div>}<span className="photo-sticker">{card.kind==='build'?'FIRST BUILD':'MADE IT MINE'}</span></div>
      <div className="spotlight-copy"><h3>{card.kind==='build'?'A little build. A big beginning.':card.title}</h3>{card.description&&<p>{card.description}</p>}{card.mine&&<div className="spotlight-mine"><span>THE HUMAN TOUCH</span><p>{card.mine}</p></div>}</div>
    </article>
    <div className="spotlight-progress" aria-hidden="true" key={card.id}><i/></div>
  </section>;
}

function Gallery({snapshot,photo}:{snapshot:Snapshot;photo:StageProps['photo']}){
  const cards=snapshot.gallery;
  return <div className="play-gallery"><Spotlight cards={cards} paused={snapshot.session.galleryPaused} photo={photo} large/>{!snapshot.session.galleryPaused&&cards.length>1&&<aside className="gallery-shelf"><p className="play-eyebrow">MORE FROM THIS ROOM</p><div>{cards.slice(0,4).map((card,i)=><article key={card.id} className="shelf-card" style={styleVars({'--shelf-angle':`${i%2===0?-3:3}deg`,'--shelf-color':COLORS[i%3]})}>{card.assetId?photo(card):<Brick color={COLORS[i%3]}/>}<span>{card.kind==='build'?'First build':card.title}</span></article>)}</div><p className="shelf-count"><b>{cards.length}</b> shared builds & ideas.<br/>All from this room.</p></aside>}</div>;
}

function Reflections({snapshot}:{snapshot:Snapshot}){
  const groups=[{title:'Did the plan work?',counts:snapshot.works,labels:['Yes','Partly','No']},{title:'How did following it feel?',counts:snapshot.feel,labels:['Easy','Mixed','Uncomfortable']}];
  return <div className="play-reflections">{groups.map((group,g)=><section key={group.title}><p className="play-eyebrow">{g===0?'THE PLAN MET THE BRICKS':'THE HUMAN PART'}</p><h2>{group.title}</h2><div className="reflection-stacks">{group.labels.map((label,i)=>{const n=group.counts[label]||0,maximum=Math.max(1,...Object.values(group.counts));return <div className="reflection-choice" key={label} style={styleVars({'--reflection-color':COLORS[i]})}><div className="reflection-bar"><i style={{height:`${n/maximum*100}%`}}>{Array.from({length:4},(_,j)=><span key={j}/>)}</i><strong><Count value={n}/></strong></div><h3>{label}</h3></div>;})}</div><p className="reflection-total">{Object.values(group.counts).reduce((a,b)=>a+b,0)} / {snapshot.total} answered</p></section>)}</div>;
}

export function StageScreen({snapshot,connected,error,qr,joinUrl,photo}:StageProps){
  const s=snapshot.session,view=s.stageView,lobby=s.phase<0,{enabled:motion,paused:motionPaused,forced:reducedMotion,toggle}=useMotion(),[joinOpen,setJoinOpen]=useState(false);
  const previousTotal=useRef(snapshot.total),[joinBurst,setJoinBurst]=useState(false);
  useEffect(()=>{if(snapshot.total>previousTotal.current){setJoinBurst(true);const timer=setTimeout(()=>setJoinBurst(false),4000);previousTotal.current=snapshot.total;return()=>clearTimeout(timer);}previousTotal.current=snapshot.total;},[snapshot.total]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(e.key.toLowerCase()==='m')toggle();if(e.key.toLowerCase()==='j')setJoinOpen(v=>!v);if(e.key==='Escape')setJoinOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const answeredAfter=snapshot.after.reduce((a,b)=>a+b,0),showAfter=s.phase===5&&answeredAfter>0,headline=stageHeading(view,s.phase,snapshot.paired),rehearsal=/dry run|rehearsal|visual qa|load test/i.test(s.title);
  return <div className={`play-stage stage-scene-${lobby?'lobby':view}`} data-motion={motion?'on':'off'}>
    <div className="play-background" aria-hidden="true"><Brick color={COLORS[0]}/><Brick color={COLORS[1]}/><Brick color={COLORS[2]}/></div>
    <header className="play-header"><div className="play-brand"><span className="brand-brick"><i/><i/></span><b>BUILDERS WITH TASTE</b><span className="brand-divider"/><span>GERVI LABS</span>{rehearsal&&<span className="rehearsal-tag">DRY RUN</span>}</div><div className={'play-live'+(!connected||error?' reconnecting':'')} role="status"><i/>{connected&&!error?'LIVE':'RECONNECTING'}</div></header>
    <div className="play-title-row"><h1>{headline}</h1><div className={'room-counter'+(joinBurst?' new-builder':'')}><strong><Count value={snapshot.total}/></strong><span>{joinBurst?'JUST GOT BIGGER':'BUILDERS IN THE ROOM'}</span></div></div>
    <main className="play-content">
      {lobby?<div className="play-welcome"><div className="welcome-words"><p className="play-eyebrow">BRING YOUR CURIOSITY. WE’LL BRING THE TWIST.</p><h2>Your bricks.<br/>Your AI.<br/><em>Your call.</em></h2><img src={media.welcomeDark} alt="Colourful LEGO bricks spilling from a bag"/></div><div className="welcome-join"><div className="join-code-label">SCAN YOUR WAY IN</div><a href={joinUrl} className="large-join-qr">{qr}</a><p>or enter the code</p><strong>{s.code}</strong><span>No sign-up. Just jump in.</span></div></div>:
        view==='results'?<Movement snapshot={snapshot} motion={motion}/>:
        view==='gallery'?<Gallery snapshot={snapshot} photo={photo}/>:
        view==='reflections'?<Reflections snapshot={snapshot}/>:
        <div className="play-overview"><div className="overview-left"><VoteBoard counts={showAfter?snapshot.after:snapshot.before} total={snapshot.total} label={showAfter?'Just now':'At the start'} compact/><StageClock session={s}/>{s.phase===5&&snapshot.paired>0&&<div className="paired-note"><b>{pairedMovement(snapshot.transitions).moved}</b><span>of {snapshot.paired} paired answers<br/>landed in a different category.</span></div>}</div><Spotlight cards={snapshot.gallery} paused={s.galleryPaused} photo={photo}/></div>}
    </main>
    <footer className="play-footer"><div className="phase-trail" aria-label="Session progress">{PHASES.map((label,i)=><span key={i} className={s.phase===i?'current':s.phase>i?'past':''}><i>{i+1}</i><b>{label}</b></span>)}</div><div className="play-footer-actions"><button onClick={toggle} aria-pressed={motionPaused} disabled={reducedMotion}>{reducedMotion?'Reduced motion':motionPaused?'▶ Motion':'Ⅱ Motion'}</button><button onClick={()=>document.documentElement.requestFullscreen?.()}>⛶ Full screen</button><span className="stage-updated">Updated {new Date(snapshot.capturedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div></footer>
    {!lobby&&<button className="play-join-tab" onClick={()=>setJoinOpen(true)} aria-label="Show the join QR code">{qr}<span>JUMP IN<strong>{s.code}</strong></span></button>}
    {error&&<p className="play-connection-note" role="status">{error} · Showing the last saved room picture.</p>}
    {joinOpen&&<div className="play-join-overlay" role="dialog" aria-modal="true" aria-label="Join the session"><button className="join-overlay-close" onClick={()=>setJoinOpen(false)} aria-label="Close join code">×</button><p className="play-eyebrow">THERE’S ROOM FOR YOUR IDEA.</p><h2>Come build with us.</h2><a href={joinUrl}>{qr}</a><strong>{s.code}</strong><span>Scan the code or enter it on your phone.</span></div>}
  </div>;
}
