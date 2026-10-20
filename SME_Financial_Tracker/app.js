(async()=>{
 try {
  const info=await sessionReady;
  if(!info.user){location.replace('../login.html');return;}
  const folder={'Store Owner':'store_owner',Staff:'staff',Supplier:'supplier'}[info.user.role];
  if(document.body.dataset.role!==info.user.role){location.replace('../'+folder+'/overview.html');return;}
  page=document.body.dataset.page||'Overview';await loadState();$('#role').value=role;
  $('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').close();});
  render();document.querySelector('.workspace strong').textContent=settings.workspace||'My business';
  document.querySelector('footer span:last-child').textContent='Secure session · Records saved on server';
  document.querySelector('.fy').textContent='● FY '+new Date().getFullYear();
 }catch(e){$('#main').innerHTML='<section class="card panel"><h1>Unable to load workspace</h1><p>'+esc(e.message)+'</p><button onclick="location.reload()">Try again</button><button onclick="logout()">Sign in again</button></section>';}
})();
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleSidebar(false);});matchMedia('(max-width:700px)').addEventListener('change',()=>toggleSidebar(false));
