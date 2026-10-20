const $=s=>document.querySelector(s),money=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let role='Store Owner',page='Overview',query='',kind='All',period='Last 6 months';
let tx=[],budgets=[0,0,0,0],orders=[],invoices=[],team=[],settings={},currentUser;
const names={'Store Owner':['Owner','O','Business owner'],'Staff':['Staff','S','Staff member'],'Supplier':['Supplier','S','Supplier']};
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
async function loadState(){const s=await api('state');currentUser=s.user;role=s.user.role;tx=s.transactions;orders=s.orders;invoices=s.invoices;team=s.team;settings=s.settings;budgets=settings.budgets||[0,0,0,0];names[role]=[s.user.name,s.user.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''),s.user.role];}
async function mutate(action,data){await api(action,data);await loadState();render();}
