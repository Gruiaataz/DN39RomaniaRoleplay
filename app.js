const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const discordUrl = "https://discord.gg/ZsZ9QDxuMx";
let siteData = { apps: [], announcements: [], staffUrl: discordUrl };
let isOwner = false;
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
async function api(url, options={}) {
  const res=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok)throw new Error(data.error||"A apărut o eroare.");
  return data;
}
function dateLabel(raw){try{return new Intl.DateTimeFormat("ro-RO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Bucharest"}).format(new Date(raw.replace(" ","T")+"Z"))}catch{return raw}}
async function refresh(){
  try{siteData=await api("/api/public");renderAnnouncements();renderApplications();if(isOwner)renderAdminApps();}catch(e){console.error(e)}
}
function renderAnnouncements(){
  const host=$("#announcements");
  if(!siteData.announcements.length){host.innerHTML='<div class="empty-state"><span class="empty-icon">◷</span><h3>Urmează noutăți.</h3><p>Anunțurile oficiale vor apărea aici.</p></div>';return}
  host.innerHTML=siteData.announcements.map(a=>`<article class="announcement"><time>${esc(dateLabel(a.created_at))}</time><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></article>`).join("");
  $("#adminAnnouncementList").innerHTML=siteData.announcements.map(a=>`<div class="admin-announcement"><div><strong>${esc(a.title)}</strong><div class="admin-hint">${esc(dateLabel(a.created_at))}</div></div><button data-delete-news="${a.id}">Șterge</button></div>`).join("");
}
const appMeta={IPJ:{symbol:"✦",button:"Aplică la IPJ",link:discordUrl},ISU:{symbol:"✚",button:"Aplică la ISU",link:discordUrl},Staff:{symbol:"⚙",button:"Accesează Aplicație Staff",link:siteData.staffUrl}};
function renderApplications(){
  const host=$("#applicationGrid");
  host.innerHTML=siteData.apps.map(a=>{
    const meta=appMeta[a.kind],available=!!a.available;
    const link=a.kind==="Staff"?siteData.staffUrl:discordUrl;
    return `<article class="application-card"><div class="app-symbol">${meta.symbol}</div><h3>${esc(a.kind)}</h3><p class="desc">${esc(a.description)}</p><span class="status ${available?"open":"closed"}">${available?"APLICAȚII DESCHISE":"APLICAȚII ÎNCHISE"}</span><div class="slots"><strong>${Number(a.slots)}</strong> ${a.slots===1?"loc disponibil":"locuri disponibile"}</div><a class="btn btn-primary app-button ${available?"":"disabled-link"}" ${available?`href="${esc(link)}" target="_blank" rel="noopener"`:'aria-disabled="true" tabindex="-1"'}>${esc(meta.button)} ↗</a></article>`;
  }).join("");
  $$(".disabled-link").forEach(el=>{el.style.opacity=".4";el.style.pointerEvents="none"});
}
function showModal(id){$("#"+id).hidden=false;document.body.style.overflow="hidden"}
function hideModal(id){$("#"+id).hidden=true;if(!$$(".modal-backdrop").some(el=>!el.hidden))document.body.style.overflow=""}
$("#ownerOpen").addEventListener("click",async()=>{
  if(isOwner){showModal("adminModal");return}
  $("#loginError").textContent="";$("#loginForm").reset();showModal("loginModal");
});
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>hideModal(b.dataset.close)));
$$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hideModal(m.id)}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop").forEach(m=>{if(!m.hidden)hideModal(m.id)})});
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget);
  try{await api("/api/login",{method:"POST",body:JSON.stringify({username:fd.get("username"),password:fd.get("password")})});isOwner=true;hideModal("loginModal");showModal("adminModal");$("#ownerOpen").textContent="♙ Panou Owner";await refresh();$("#staffUrlForm").elements.url.value=siteData.staffUrl;toast("Autentificare reușită.");}
  catch(err){$("#loginError").textContent=err.message}
});
function renderAdminApps(){
  $("#adminApps").innerHTML=siteData.apps.map(a=>`<form class="admin-app-row" data-app-form="${esc(a.kind)}"><div class="row-top"><h3>${esc(a.kind)}</h3><label class="toggle-line"><input type="checkbox" name="available" ${a.available?"checked":""}> Disponibile</label></div><div class="fields"><label>Descriere<input name="description" maxlength="300" value="${esc(a.description)}"></label><label>Număr locuri<input name="slots" type="number" min="0" max="999" value="${Number(a.slots)}" required></label></div><div class="save-row"><button class="btn btn-primary" type="submit">Salvează ${esc(a.kind)}</button></div></form>`).join("");
  $$("[data-app-form]").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form);try{await api("/api/applications/"+encodeURIComponent(form.dataset.appForm),{method:"PUT",body:JSON.stringify({available:fd.get("available")==="on",slots:Number(fd.get("slots")),description:fd.get("description")})});await refresh();toast("Setările aplicației au fost salvate.");}catch(err){toast(err.message)}}));
}
$$(".admin-tab").forEach(tab=>tab.addEventListener("click",()=>{
  $$(".admin-tab").forEach(t=>t.classList.toggle("active",t===tab));
  ["apps","news","settings"].forEach(k=>$("#admin"+k[0].toUpperCase()+k.slice(1)).hidden=k!==tab.dataset.tab);
}));
$("#announcementForm").addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget);$("#newsError").textContent="";
  try{await api("/api/announcements",{method:"POST",body:JSON.stringify({title:fd.get("title"),body:fd.get("body")})});e.currentTarget.reset();await refresh();toast("Anunț publicat.");}
  catch(err){$("#newsError").textContent=err.message}
});
$("#adminAnnouncementList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-delete-news]");if(!b)return;
  if(!confirm("Sigur vrei să ștergi acest anunț?"))return;
  try{await api("/api/announcements/"+b.dataset.deleteNews,{method:"DELETE"});await refresh();toast("Anunț șters.");}catch(err){toast(err.message)}
});
$("#staffUrlForm").addEventListener("submit",async e=>{
  e.preventDefault();const url=new FormData(e.currentTarget).get("url");
  try{await api("/api/settings/staff-url",{method:"PUT",body:JSON.stringify({url})});await refresh();$("#settingsMessage").textContent="Link salvat.";$("#settingsMessage").style.color="var(--green)";toast("Linkul Staff a fost actualizat.");}
  catch(err){$("#settingsMessage").textContent=err.message;$("#settingsMessage").style.color="var(--red)"}
});
$("#logoutBtn").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});}catch{}isOwner=false;$("#ownerOpen").textContent="♙ Owner";hideModal("adminModal");toast("Deconectat.");});
(async()=>{try{const s=await api("/api/session");isOwner=s.authenticated;if(isOwner){$("#ownerOpen").textContent="♙ Panou Owner";$("#staffUrlForm").elements.url.value=siteData.staffUrl;}}catch{}await refresh();setInterval(refresh,20000)})();
