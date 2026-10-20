import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=await mkdtemp(join(tmpdir(),'ledgerly-test-'));
const db=join(temp,'integration.sqlite');
const port=19300+Math.floor(Math.random()*500);
const url=`http://127.0.0.1:${port}/api/index.php`;
const server=spawn(process.env.PHP_BINARY||(process.platform==='win32'?'C:\\xampp\\php\\php.exe':'php'),['-S',`127.0.0.1:${port}`,'router.php'],{cwd:root,windowsHide:true,env:{...process.env,LEDGERLY_DB_PATH:db},stdio:['ignore','ignore','pipe']});
let logs='';server.stderr.on('data',d=>logs+=d);server.on('error',e=>{logs+=e.message;});
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
class Client{
 cookie='';csrf='';
 async call(action,data,expected=200,token=this.csrf){const r=await fetch(url+'?action='+action,{method:data===undefined?'GET':'POST',headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':token})},body:data===undefined?undefined:JSON.stringify(data)});const cookie=r.headers.getSetCookie?.()[0]||r.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];const j=await r.json();assert.equal(r.status,expected,action+': '+JSON.stringify(j));checks++;if(j.csrf)this.csrf=j.csrf;return j;}
 async login(username,password='TestPassword123!'){await this.call('session');await this.call('login',{username,password});await this.call('session');}
}
try{
 let ready=false;
 for(let i=0;i<50;i++){try{const r=await fetch(url+'?action=session');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'PHP server did not start: '+logs);
 const owner=new Client(),staff=new Client(),otherStaff=new Client(),supplier=new Client(),otherSupplier=new Client(),anonymous=new Client();
 check((await owner.call('session')).setup,'First-run setup available');
 await anonymous.call('state',undefined,401);
 await owner.call('setup',{name:'Owner',workspace:'Test workspace',username:'owner',password:'short'},400);
 await owner.call('setup',{name:'Owner',workspace:'Test workspace',username:'owner',password:'TestPassword123!'},403,'bad-token');
 await owner.call('setup',{name:'Owner',workspace:'Test workspace',username:'owner',password:'TestPassword123!'});
 await owner.call('session');
 await owner.call('setup',{name:'Second owner',workspace:'Other',username:'second',password:'TestPassword123!'},409);
 for(const [name,role] of [['Staff','Staff'],['OtherStaff','Staff'],['Supplier','Supplier'],['OtherSupplier','Supplier']])await owner.call('user',{name,role,username:name.toLowerCase()+'',password:'TestPassword123!'});
 await owner.call('user',{name:'Duplicate',role:'Staff',username:'staff',password:'TestPassword123!'},409);
 await staff.login('staff');await otherStaff.login('otherstaff');await supplier.login('supplier');await otherSupplier.login('othersupplier');
 await staff.call('settings',{key:'workspace',value:'hijack'},403);
 await supplier.call('transaction',{name:'bad'},403);
 const tx={name:'Sale',date:'2026-10-21',category:'Sales',type:'Income',amount:100.25};
 await staff.call('transaction',{...tx,amount:-1},400);await staff.call('transaction',{...tx,amount:0.001},400);await staff.call('transaction',{...tx,date:'2026-02-30'},400);await staff.call('transaction',{...tx,name:'   '},400);
 await staff.call('transaction',tx);
 let state=await owner.call('state'),t=state.transactions[0];
 check(t.status==='Pending','Staff submissions require approval');
 check((await otherStaff.call('state')).transactions.length===0,'Staff cannot read another staff member’s records');
 await staff.call('review',{id:t.id,status:'Completed'},403);
 await owner.call('review',{id:t.id,status:'Completed'});await owner.call('review',{id:t.id,status:'Completed'},409);
 await staff.call('transaction',{...tx,name:'Reject me'});state=await staff.call('state');const rejected=state.transactions.find(t=>t.name==='Reject me');await owner.call('review',{id:rejected.id,status:'Rejected'});
 await owner.call('settings',{key:'budgets',value:[1000,0,500,10]});await owner.call('settings',{key:'checklist',value:[true,false,true]});
 state=await owner.call('state');const sup=state.team.find(u=>u.username==='supplier');const second=state.team.find(u=>u.username==='othersupplier');
 await owner.call('order',{name:'Office supplies',amount:50.25,date:'2026-10-22',supplier_id:sup.id});
 await owner.call('order',{name:'Private order',amount:80,date:'2026-10-22',supplier_id:second.id});
 state=await supplier.call('state');check(state.orders.length===1,'Suppliers see only their own orders');check(state.transactions.length===0&&state.team.length===0,'Suppliers cannot see finance ledger or accounts');const order=state.orders[0];
 await otherSupplier.call('order_status',{id:order.id,status:'Confirmed'},409);
 await supplier.call('order_status',{id:order.id,status:'Delivered'},409);
 await supplier.call('invoice',{order_id:order.id,ref:'INV-001'},400);
 await supplier.call('order_status',{id:order.id,status:'Confirmed'});await supplier.call('order_status',{id:order.id,status:'Delivered'});
 await supplier.call('invoice',{order_id:order.id,ref:'INV-001',amount:1});
 state=await supplier.call('state');const invoice=state.invoices[0];check(invoice.amount===50.25,'Invoice amount enforced from order');
 await supplier.call('invoice',{order_id:order.id,ref:'INV-002'},409);
 await supplier.call('pay',{id:invoice.id,date:'2026-10-21'},403);
 await owner.call('pay',{id:invoice.id,date:'2026-10-21'});await owner.call('pay',{id:invoice.id,date:'2026-10-21'},409);
 state=await owner.call('state');check(state.transactions.filter(t=>t.name.startsWith('Supplier payment:')).length===1,'Payment expense recorded exactly once');check(state.orders.find(o=>o.id===order.id).status==='Paid','Payment updates order');check(state.invoices[0].paid_date==='2026-10-21','Payment date retained');
 check(!('budgets' in (await supplier.call('state')).settings),'Supplier cannot read workspace financial settings');
 check(state.settings.budgets[0]===1000&&state.settings.checklist[0]===true,'Workspace settings persist');
 const staffId=state.team.find(u=>u.username==='staff').id;
 await owner.call('access',{id:staffId,active:0});await staff.call('state',undefined,401);await owner.call('access',{id:staffId,active:1});
 await staff.call('password',{current:'TestPassword123!',password:'ChangedPassword123!'});await staff.call('logout',{});await staff.call('state',undefined,401);await staff.login('staff','ChangedPassword123!');
 await owner.call('logout',{});await owner.login('owner');state=await owner.call('state');check(state.transactions.length===3,'Records survive logout and sign-in');
 check((await fetch(`http://127.0.0.1:${port}/data/ledgerly.sqlite`)).status===403,'Development router blocks database downloads');
 check((await fetch(`http://127.0.0.1:${port}/tests/integration.mjs`)).status===403,'Test sources not served');
 console.log(`PASS: ${checks} integration checks. Database isolated from workspace data.`);
}catch(e){console.error(e);console.error(logs.slice(-4000));process.exitCode=1;}
finally{server.kill();await new Promise(r=>server.once('exit',r));for(const file of [db,db+'-journal',db+'-wal',db+'-shm']){try{await unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}await rmdir(temp);}


