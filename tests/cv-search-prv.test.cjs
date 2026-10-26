const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const source=fs.readFileSync('backend/worker.js','utf8');
const handler=source.slice(source.indexOf('async function handleCvSearch('),source.indexOf('async function handleCheckout('));
const jsonHelper=source.slice(source.indexOf('function json('),source.indexOf('function html('));
const product=(name='2023 Topps Chrome Sapphire Baseball',sport='baseball')=>({type:'product',code:'CV-CODE',displayName:name,sport});
const entry={Code:'PRV-DIFFERENT-CODE',DisplayName:'2023 Topps Chrome Sapphire Baseball',sport:'baseball',row_count:2};
function fixture({rows=[product()],catalog=[entry],indexed=true,failCatalog=false,failD1=false,stale=false}={}){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE search_sync_state(namespace TEXT,code TEXT,sport TEXT,row_count INTEGER,meta_json TEXT,PRIMARY KEY(namespace,code,sport))');
 if(indexed) db.prepare('INSERT INTO search_sync_state VALUES(?,?,?,?,?)').run('prv',entry.Code,entry.sport,stale?3:2,JSON.stringify({displayName:entry.DisplayName,sport:entry.sport}));
 const calls=[],plans=[],store=new Map(),pending=[];let fetches=0;
 const cache={match:async r=>store.get(r.url)?.clone(),put:async(r,v)=>store.set(r.url,v)};
 const context=vm.createContext({Request,Response,Headers,URL,AbortSignal,caches:{default:cache},fetch:async()=>{fetches++;if(failCatalog)throw Error('offline');return new Response(JSON.stringify({index:catalog}));}});
 vm.runInContext(jsonHelper+handler,context);
 const env={CV_SEARCH:{prepare:sql=>({bind:(...args)=>({all:async()=>{
  calls.push({sql,args});
  if(sql.includes('cards_fts'))return {results:rows};
  if(failD1)throw Error('PRV unavailable');
  plans.push(...db.prepare('EXPLAIN QUERY PLAN '+sql).all(...args));
  return {results:db.prepare(sql).all(...args)};
 }})})}};
 return {calls,plans,get fetches(){return fetches},async request(){const r=new Request('https://api.chasingmajors.com/cv-search?q=sapphire&sport=baseball');const res=await context.handleCvSearch(r,new URL(r.url),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return {status:res.status,cache:res.headers.get('X-CV-Cache'),body:await res.json()};}};
}
test('exact normalized name and sport bridges different codes; cards stay unchanged; one indexed batch',async()=>{
 const card={...product(),type:'card',player:'Player'};
 const f=fixture({rows:[product('2023 TOPPS Chrome--Sapphire Baseball'),product(),card]});
 const {body}=await f.request();
 assert.equal(body.results[0].has_prv,true);assert.equal(body.results[0].prv_row_count,2);
 assert.equal(body.results[0].prv_code,entry.Code);assert.equal(body.results[0].code,'CV-CODE');
 assert.equal('has_prv' in body.results[2],false);assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].args.length,2);assert.ok(f.plans.every(p=>/SEARCH .*INDEX/.test(p.detail)));
 assert.ok(!/\bCOUNT\s*\(|\bSCAN\b/i.test(f.calls[1].sql));
 const hit=await f.request();assert.equal(hit.cache,'HIT');assert.equal(f.calls.length,2);assert.equal(f.fetches,1);
});
test('no match, different sport and ambiguous identities are never linked',async()=>{
 for(const opts of [{rows:[product('Different product')]},{rows:[product(entry.DisplayName,'soccer')]},{catalog:[entry,{...entry,Code:'another'}]}]){
  const f=fixture(opts),{body}=await f.request();assert.equal(body.results[0].has_prv,false);assert.equal(body.results[0].prv_row_count,0);assert.equal(f.calls.length,1);
 }
});
test('published but unsynced or stale counts are explicitly not_indexed, not claimed available',async()=>{
 for(const opts of [{indexed:false},{stale:true}]){const f=fixture(opts),{body}=await f.request();assert.equal(body.results[0].has_prv,false);assert.equal(body.results[0].prv_status,'not_indexed');}
});
test('PRV catalog or query failure preserves successful CV results with unavailable status',async()=>{
 for(const opts of [{failCatalog:true},{failD1:true}]){const f=fixture(opts),r=await f.request();assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.equal(r.body.results[0].prv_status,'unavailable');}
});
test('card-only page performs no PRV fetch or D1 lookup',async()=>{
 const f=fixture({rows:[{...product(),type:'card',player:'Name'}]}),r=await f.request();assert.equal(f.calls.length,1);assert.equal(f.fetches,0);assert.equal('has_prv' in r.body.results[0],false);
});
test('maximum product page uses one query and at most 100 bindings, all primary-key probes',async()=>{
 const catalog=Array.from({length:50},(_,i)=>({...entry,Code:'prv-'+i,DisplayName:'Product '+i}));
 const f=fixture({rows:catalog.map(e=>product(e.DisplayName)),catalog});
 const r=await f.request();assert.equal(r.body.results.length,50);assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].args.length,100);assert.equal(f.plans.filter(p=>/SEARCH .*INDEX/.test(p.detail)).length,50);
 assert.equal(f.plans.some(p=>/SCAN search_sync_state/.test(p.detail)),false);
});
