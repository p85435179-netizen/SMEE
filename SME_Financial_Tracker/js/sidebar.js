const menus=()=>role==='Store Owner'?['Overview','Transactions','Budgets','Reports','Tax & compliance','Purchase orders','Invoices','Payments']:role==='Staff'?['Overview','Transactions','My submissions']:['Overview','Purchase orders','Invoices','Payments'];
const icons=['▦','⇄','◫','▤','▧','▤','▣','↗'];
function go(p){if((p==='Team & access'||p==='Settings')&&role!=='Store Owner'){toast('Owner access required.');return;}location.href=pageUrl(role,p);}
function toggleSidebar(open){const shown=open===undefined?!document.body.classList.contains('sidebar-open'):open;document.body.classList.toggle('sidebar-open',shown);$('.menu-toggle').setAttribute('aria-expanded',String(shown));if(!shown&&$('#sidebar').contains(document.activeElement)&&matchMedia('(max-width:700px)').matches)$('.menu-toggle').focus();}
const roleFolders={'Store Owner':'store_owner',Staff:'staff',Supplier:'supplier'};
const pageFiles={Overview:'overview',Transactions:'transactions','My submissions':'my_submissions',Budgets:'budgets',Reports:'reports','Tax & compliance':'tax_compliance','Purchase orders':'purchase_orders',Invoices:'invoices',Payments:'payments','Team & access':'team_access',Settings:'settings'};
function pageUrl(targetRole,targetPage){return '../'+roleFolders[targetRole]+'/'+pageFiles[targetPage]+'.html';}
