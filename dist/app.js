const vessels = [
  { name: "M/V Sea Horizon", id: "VW-PP-01482", reg: "PCG-PR-4821", station: "Puerto Princesa", status: "Verified" },
  { name: "M/V Isla Verde", id: "VW-EN-00376", reg: "PCG-EN-9832", station: "El Nido", status: "Review needed" },
  { name: "M/V Coron Runner", id: "VW-CR-00719", reg: "PCG-CR-0719", station: "Coron", status: "Verified" }
];
const search = document.querySelector('#vesselSearch');
const results = document.querySelector('#searchResults');
const toast = document.querySelector('#toast');
function message(text){ toast.textContent=text; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2800); }
function renderResults(value){
  const term=value.trim().toLowerCase();
  if(!term){ results.classList.remove('show'); results.innerHTML=''; return; }
  const matches=vessels.filter(v=>Object.values(v).some(x=>x.toLowerCase().includes(term)));
  results.classList.add('show');
  results.innerHTML=matches.length ? matches.map(v=>`<div class="result"><div><strong>${v.name}</strong><p>${v.id} · ${v.reg} · ${v.station} · ${v.status}</p></div><button data-vessel="${v.name}">Open record</button></div>`).join('') : '<div class="result"><div><strong>No draft record found</strong><p>Try vessel name, registration number, or VesselWatch ID.</p></div></div>';
}
search.addEventListener('input',e=>renderResults(e.target.value));
results.addEventListener('click',e=>{if(e.target.dataset.vessel)message(`${e.target.dataset.vessel} record opened in the full system.`)});
document.querySelector('#newInspection').addEventListener('click',()=>document.querySelector('#inspectionModal').showModal());
document.querySelector('#scanButton').addEventListener('click',()=>message('QR scanning will be available in the inspector mobile app.'));
document.querySelector('#helpButton').addEventListener('click',()=>message('Draft system: all displayed information is sample data.'));
document.querySelector('#inspectionModal').addEventListener('close',()=>{if(document.querySelector('#inspectionModal').returnValue==='default')message('Inspection saved as a local draft.');});
