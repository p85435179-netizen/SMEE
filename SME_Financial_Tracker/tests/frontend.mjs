import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const code=name=>readFileSync(resolve(root,name),'utf8');
const context=vm.createContext({console,Date,Number,String,Math,JSON,Object,Array,Set,setTimeout:()=>{},document:{querySelector:()=>({}),querySelectorAll:()=>[]}});
const scripts=['state','ui','sidebar','overview','transactions','budgets','reports','tax-compliance','purchase-orders','invoices','payments','team','settings','router'];
for(const name of scripts)vm.runInContext(code('js/'+name+'.js'),context,{filename:name+'.js'});
vm.runInContext(`settings={workspace:'Test <business>',budgets:[100,200,300,400],checklist:[true,false,false]};budgets=settings.budgets;team=[{id:1,name:'Owner',username:'owner@example.test',role:'Store Owner',active:1},{id:2,name:'Supplier',username:'supplier@example.test',role:'Supplier',active:1}];tx=[{id:1,name:'Approved sale',date:today(),category:'Sales',type:'Income',amount:100.25,status:'Completed',by:'Staff'},{id:2,name:'Pending sale',date:today(),category:'Sales',type:'Income',amount:800,status:'Pending',by:'Staff'},{id:3,name:'Approved expense',date:today(),category:'Operations',type:'Expense',amount:25.25,status:'Completed',by:'Store Owner'},{id:4,name:'Rejected sale',date:today(),category:'Sales',type:'Income',amount:900,status:'Rejected',by:'Staff'}];orders=[{id:1,name:'Paper <bundle>',date:today(),supplier:'Supply & Co.',amount:50,status:'Delivered'}];invoices=[{id:1,ref:'INV-01',order_id:1,order_name:'Paper <bundle>',amount:50,status:'Paid',paid_date:today()}];`,context);
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
check(vm.runInContext('totals().income===100.25&&totals().expense===25.25',context),'Totals exclude pending and rejected records');
check(vm.runInContext(`input('Label','name','text','"><img src=x>')`,context).includes('&lt;img'),'Input values escaped');
check(vm.runInContext('settingsPage()',context).includes('Test &lt;business&gt;'),'Business name escaped');
check(vm.runInContext('orderTable()',context).includes('Paper &lt;bundle&gt;'),'Order names escaped');
check(vm.runInContext('invoiceTable()',context).includes('Paper &lt;bundle&gt;'),'Invoice order names escaped');
for(const role of ['Store Owner','Staff','Supplier']){
 vm.runInContext(`role=${JSON.stringify(role)};`,context);
 const pages=vm.runInContext('menus()',context);
 if(role==='Store Owner')pages.push('Team & access','Settings');
 for(const page of pages){
  const file=vm.runInContext(`roleFolders[role]+'/'+pageFiles[${JSON.stringify(page)}]+'.html'`,context);
  check(existsSync(resolve(root,file)),`Navigation target exists: ${file}`);
  const html=code(file);
  for(const match of html.matchAll(/(?:src|href)="(\.\.\/[^"#]+)"/g))check(existsSync(resolve(root,dirname(file),match[1])),`Asset exists: ${match[1]}`);
  const fn=page==='Overview'?'overview':page==='Transactions'||page==='My submissions'?'transactionsPage':page==='Team & access'?'teamPage':page==='Tax & compliance'?'tax_compliancePage':page==='Purchase orders'?'purchaseOrdersPage':page.toLowerCase()+'Page';
  const rendered=vm.runInContext(`page=${JSON.stringify(page)};${fn}()`,context);
  check(rendered.includes('<h1>'),`${page} renders a heading`);
  check(!/NaN|Infinity|undefined/.test(rendered),`${role} ${page} has valid values`);
 }
}
vm.runInContext(`role='Store Owner';tx=[];budgets=[0,0,0,0];orders=[];invoices=[];`,context);
for(const fn of ['overview','budgetPanel','reportsPage','orderTable','invoiceTable','paymentsPage'])check(!/NaN|Infinity|undefined/.test(vm.runInContext(fn+'()',context)),`Empty ${fn} renders safely`);
check(!scripts.map(n=>code('js/'+n+'.js')).join('').includes('localStorage'),'Application data uses backend persistence');
console.log(`PASS: ${checks} frontend checks.`);

