const loginError=document.getElementById('login-error'),form=document.getElementById('login-form');
const loginButton=form.querySelector('[type=submit]');
loginButton.disabled=true;
function openWorkspace(user){location.replace(({'Store Owner':'store_owner',Staff:'staff',Supplier:'supplier'})[user.role]+'/overview.html');}
sessionReady.then(info=>{if(info.user){openWorkspace(info.user);return;}document.getElementById('register-link').hidden=!info.setup;loginButton.disabled=false;}).catch(e=>{loginError.textContent=e.message;loginError.hidden=false;});
form.addEventListener('submit',async event=>{event.preventDefault();if(loginButton.disabled)return;loginButton.disabled=true;loginError.hidden=true;try{const values=Object.fromEntries(new FormData(form));values.username=values.username.trim();await api('login',values);sessionInfo=await api('session');openWorkspace(sessionInfo.user);}catch(e){loginError.textContent=e.message;loginError.hidden=false;}finally{loginButton.disabled=false;}});
