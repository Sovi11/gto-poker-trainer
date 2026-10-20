import { ArenaBot } from '../src/arena/bot';
import { parseGameState } from '@chipzen-ai/bot';
import { parseCard } from '../src/engine/cards';
import { equity } from '../src/arena/equity';
import { sampleRange } from '../src/arena/ranges';
import { riverTree } from '../src/arena/river';
import { solve, BLOCKED } from '../src/solver/cfr';
import type { DecisionNode } from '../src/solver/tree';

// Isolated hand reconstruction; preceding 16 hands' adaptation is unavailable.
const b = new ArenaBot({variant:'hybrid',rng:()=>.5});
b.onMatchStart({match_id:'audit-hand17',seats:[{seat:1,is_self:true}],game_config:{big_blind:100}});
b.onRoundStart({state:{hand_number:17,dealer_seat:0,stacks:[11250,8750],post_blind_stacks:[11200,8650],pot:150}});
const act = (seat:number,action:string,amount:number,pot:number) => b.onTurnResult({seat,details:{action,amount,pot}});
const phase = (phase:string,board:string[])=> b.onPhaseChange({state:{phase,board}});
act(0,'raise',250,350); act(1,'raise',900,1150); act(0,'call',650,1800);
phase('flop',['Ac','4d','Ah']); act(1,'raise',1170,2970); act(0,'call',1170,4140);
phase('turn',['Ac','4d','Ah','5h']); act(1,'check',0,4140); act(0,'raise',3105,7245); act(1,'call',3105,10350);
phase('river',['Ac','4d','Ah','5h','8d']); act(1,'check',0,10350); act(0,'raise',3450,13800);
const hole=['9c','9d'].map(parseCard), board=['Ac','4d','Ah','5h','8d'].map(parseCard);
const s=parseGameState({valid_actions:['fold','call','raise'],state:{hand_number:17,phase:'river',your_hole_cards:['9c','9d'],board:['Ac','4d','Ah','5h','8d'],pot:13800,your_stack:3575,opponent_stacks:[2625],to_call:3450,min_raise:3575,max_raise:3575}});
const full=b.opponent.combos();
const own=sampleRange(b.own.combos(),36,hole), opp=sampleRange(full,36);
const idx=own.findIndex(c=>c.cards.includes(hole[0])&&c.cards.includes(hole[1]));
const out=new Int8Array(own.length*opp.length);
for(let i=0;i<own.length;i++)for(let j=0;j<opp.length;j++) out[i*opp.length+j]=own[i].cards.some(c=>opp[j].cards.includes(c))?BLOCKED:Math.sign(own[i].strength-opp[j].strength);
const tree=riverTree(s,0), root=tree.root as DecisionNode;
for(const iterations of [100,1000]){
 const r=solve({tree,pot:10350,n0:own.length,n1:opp.length,prior0:Float64Array.from(own.map(c=>c.weight)),prior1:Float64Array.from(opp.map(c=>c.weight)),outcome:out,iterations});
 console.log(JSON.stringify({iterations,actions:root.actions.map((a,i)=>({action:a.kind,to:a.to,probability:r.strategy[root.id][idx*root.actions.length+i]})),exploitability:r.exploitability,ms:r.ms}));
}
console.log(JSON.stringify({fullRiverEquity:equity(hole,board,full,()=>.5),sampledRiverEquity:equity(hole,board,opp,()=>.5),price:3450/17250,ownSample:own.length,opponentSample:opp.length,decision:b.decide(s).action,telemetry:b.lastDecision}));
