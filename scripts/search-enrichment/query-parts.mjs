// Diagnostic query splitting: no generated terms, no model, at most two searches.
export function splitSearchQuestion(query){
 if(/["«»]|\d/u.test(query))return [];
 const words=s=>s.trim().split(/\s+/u).filter(Boolean);
 if(words(query).length<8)return [];
 const boundaries=[...query.matchAll(/\s+и\s+|[?;.]\s+(?=(?:как|почему|что|зачем)(?=\s|$))/giu)];
 const candidates=boundaries.map(m=>[query.slice(0,m.index).trim(),query.slice(m.index+m[0].length).trim()])
  .filter(parts=>parts.every(p=>words(p).length>=3));
 if(!candidates.length)return [];
 candidates.sort((a,b)=>Math.abs(words(a[0]).length-words(a[1]).length)-Math.abs(words(b[0]).length-words(b[1]).length));
 return candidates[0];
}
export function mergeQuestionParts(baseline,parts,mode){
 if(!parts.length)return baseline;
 const unique=xs=>[...new Set(xs)];
 if(mode==='interleave'){
  const result=baseline.slice(0,2);
  for(let i=0;i<Math.max(baseline.length,...parts.map(p=>p.length));i++){
   for(const part of parts)if(part[i])result.push(part[i]);
   if(baseline[i+2])result.push(baseline[i+2]);
  }
  return unique(result);
 }
 // Rank scores deliberately fixed before evaluation; no raw score comparison
 // between different queries. Exact/prefix responses bypass this in the caller.
 const scores=new Map();
 for(const [xs,weight]of [[baseline,2],...parts.map(p=>[p,1])])
  unique(xs).forEach((key,i)=>scores.set(key,(scores.get(key)??0)+weight/(10+i+1)));
 return [...scores.keys()].sort((a,b)=>scores.get(b)-scores.get(a));
}
