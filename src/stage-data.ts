/** Paired movement uses the transition matrix, never unmatched before/after totals. */
export function pairedMovement(transitions:number[][]){
  const before=[0,0,0],after=[0,0,0];let total=0,moved=0;
  for(let from=0;from<3;from++)for(let to=0;to<3;to++){
    const count=transitions[from]?.[to]||0;
    before[from]+=count;after[to]+=count;total+=count;if(from!==to)moved+=count;
  }
  return {before,after,total,moved,stayed:total-moved};
}

export function stageHeading(view:string,phase:number,paired:number){
  if(phase<0)return 'Ready. Set. Build.';
  if(view==='gallery')return 'Look what we made.';
  if(view==='reflections')return 'Hands have opinions.';
  if(view==='results')return paired?'Same room. New moves.':'Where are we starting?';
  return ['Every builder counts.','Small bricks. Big ideas.','Built by this room.','Make a little magic.','Look what we made.','Our next move.'][phase]||'Built by this room.';
}
