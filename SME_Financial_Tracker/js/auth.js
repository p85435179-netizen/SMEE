const apiBase = new URL('../api/index.php', document.currentScript.src).href;
let sessionInfo;
async function api(action,data){
 let response;
 try{response=await fetch(apiBase+'?action='+encodeURIComponent(action),{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':sessionInfo?.csrf||''},body:data===undefined?undefined:JSON.stringify(data)});}catch{throw new Error('Cannot reach the server. Start Apache in XAMPP and reload this page.');}
 let result;try{result=await response.json();}catch{throw new Error('Open the system through XAMPP Apache so PHP can run.');}
 if(!response.ok){if(response.status===401&&document.body?.dataset.role)location.replace(new URL('../login.html',apiBase).href);throw new Error(result.error||'Request failed.');}
 return result;
}
const sessionReady=api('session').then(info=>{sessionInfo=info;return info;});
sessionReady.catch(()=>{});
async function logout(){try{await sessionReady;await api('logout',{});location.replace(new URL('../login.html',apiBase).href);}catch(e){alert(e.message);}}
window.addEventListener('pageshow',async event=>{if(!event.persisted)return;try{sessionInfo=await api('session');const folders={'Store Owner':'store_owner',Staff:'staff',Supplier:'supplier'};if(document.body?.dataset.role){if(!sessionInfo.user){location.replace(new URL('../login.html',apiBase).href);return;}if(document.body.dataset.role!==sessionInfo.user.role){location.replace(new URL('../'+folders[sessionInfo.user.role]+'/overview.html',apiBase).href);return;}await loadState();render();}else if(sessionInfo.user)location.replace(new URL('../'+folders[sessionInfo.user.role]+'/overview.html',apiBase).href);}catch{location.reload();}});
