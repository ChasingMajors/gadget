const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('backend/worker.js','utf8');
const handler=source.slice(source.indexOf('async function handleCvSearch('),source.indexOf('async function handleCheckout('));
const jsonHelper=source.slice(source.indexOf('function json('),source.indexOf('function html('));
function fixture({fails=false,limited=false,missing=false,cached=null}={}){
 let reads=0,puts=0;
 const store=new Map(),pending=[];
 const cache={match:async key=>cached?.clone()||store.get(key.url)?.clone(),put:async(key,response)=>{puts++;store.set(key.url,response);}};
 const ctx=vm.createContext({Request,Response,Headers,URL,caches:{default:cache}});
 vm.runInContext(jsonHelper+handler,ctx);
 const env={CV_SEARCH:missing?undefined:{prepare:()=>({bind:()=>({all:async()=>{reads++;if(fails)throw Error('D1 failed');return {results:[{type:'card',sport:'basketball',player:'Jordan',code:'p'}]};}})})},CV_SEARCH_RL:{limit:async()=>({success:!limited})}};
 return {get reads(){return reads},get puts(){return puts},async request(){const req=new Request('https://api.chasingmajors.com/cv-search?q=jordan&sport=basketball');const res=await ctx.handleCvSearch(req,new URL(req.url),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return res;}};
}
test('cache miss and hit both have public TTL; second hit avoids D1',async()=>{
 const f=fixture(),first=await f.request(),second=await f.request();
 for(const r of [first,second]){assert.equal(r.headers.get('Cache-Control'),'public, max-age=300');assert.equal((await r.json()).ok,true);}
 assert.equal(first.headers.get('X-CV-Cache'),'MISS');assert.equal(second.headers.get('X-CV-Cache'),'HIT');
 assert.equal(f.reads,1);assert.equal(f.puts,1);
});
test('legacy successful cache entries get normalized headers',async()=>{
 const f=fixture({cached:new Response(JSON.stringify({ok:true,results:[]}),{headers:{'Cache-Control':'no-store'}})});
 const r=await f.request();assert.equal(r.headers.get('Cache-Control'),'public, max-age=300');assert.equal(r.headers.get('X-CV-Cache'),'HIT');assert.equal(f.reads,0);
});
for(const [name,options,status] of [['rate limit',{limited:true},429],['missing binding',{missing:true},503],['D1 failure',{fails:true},503]]){
 test(name+' stays no-store and is never cached',async()=>{
  const f=fixture(options),r=await f.request();assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).ok,false);assert.equal(f.puts,0);
 });
}
test('a stale cached error is ignored',async()=>{
 const f=fixture({cached:new Response(JSON.stringify({ok:false,error:'old'}),{status:200})});
 const r=await f.request();assert.equal((await r.json()).ok,true);assert.equal(r.headers.get('X-CV-Cache'),'MISS');assert.equal(f.reads,1);
});
