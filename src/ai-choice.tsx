import React,{useId} from 'react';
import {AI_TOOLS,type Answers} from '../server/model';

export function AIChoice({value,onChange,disabled=false}:{value:Answers['aiTool'];onChange:(value:NonNullable<Answers['aiTool']>)=>void;disabled?:boolean}){
  const name=useId();
  return <fieldset className="ai-choice" disabled={disabled}>
    <legend>Which AI will you use?</legend>
    <div>{AI_TOOLS.map(tool=><label key={tool}>
      <input type="radio" name={name} value={tool} checked={value===tool} onChange={()=>onChange(tool)}/>
      <span>{tool}</span>
    </label>)}</div>
    <p>Use your own app. You can change your choice in the session menu.</p>
  </fieldset>;
}
