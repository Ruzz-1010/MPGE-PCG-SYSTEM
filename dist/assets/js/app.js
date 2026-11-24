const vessels = [
  { name: "M/V Sea Horizon", id: "VW-PP-01482", reg: "PCG-PR-4821", station: "Puerto Princesa", status: "Verified" },
  { name: "M/V Isla Verde", id: "VW-EN-00376", reg: "PCG-EN-9832", station: "El Nido", status: "Review needed" },
  { name: "M/V Coron Runner", id: "VW-CR-00719", reg: "PCG-CR-0719", station: "Coron", status: "Verified" }
];

const roleData = {
  regional: { title: "Regional Admin", greeting: "Good morning, Regional Admin.", summary: "Review authorized activity, reports, and user access across all nine MEPG stations.", scope: "All 9 MEPG Stations", station: null, inspection: false, reports: true, access: true, manage: "Manage all accounts" },
  station: { title: "Station Admin", greeting: "Good morning, Station Admin.", summary: "Review submissions and manage authorized accounts for Puerto Princesa Station.", scope: "Puerto Princesa Station", station: "Puerto Princesa", inspection: true, reports: true, access: true, manage: "Manage station accounts" },
  inspector: { title: "Inspector Personnel", greeting: "Good morning, Inspector.", summary: "Create inspection drafts and upload evidence for Puerto Princesa Station.", scope: "Puerto Princesa Station", station: "Puerto Princesa", inspection: true, reports: false, access: false, manage: "" },
  records: { title: "Records Officer", greeting: "Good morning, Records Officer.", summary: "Verify vessel documents and maintain record completeness for Puerto Princesa Station.", scope: "Puerto Princesa Station", station: "Puerto Princesa", inspection: false, reports: false, access: false, manage: "" }
};

const search = document.querySelector('#vesselSearch');
const results = document.querySelector('#searchResults');
const toast = document.querySelector('#toast');
const roleSelector = document.querySelector('#roleSelector');
const gateRole = document.querySelector('#gateRole');
const gateStation = document.querySelector('#gateStation');
let activeRole = roleSelector.value;
let activeStation = gateStation.value;

function message(text) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }

function applyRole() {
  const role = roleData[activeRole];
  const isRegional = activeRole === 'regional';
  document.querySelector('#signedInAs').textContent = role.title;
  document.querySelector('#stationScope').textContent = isRegional ? role.scope : `${activeStation} Station`;
  document.querySelector('#dashboard').textContent = role.greeting;
  document.querySelector('#roleSummary').textContent = isRegional ? role.summary : role.summary.replaceAll('Puerto Princesa', activeStation);
  document.querySelector('#newInspection').classList.toggle('role-hidden', !role.inspection);
  document.querySelector('#reports').classList.toggle('role-hidden', !role.reports);
  document.querySelector('#accessPanel').classList.toggle('role-hidden', !role.access);
  const manage = document.querySelector('#manageUsers');
  manage.classList.toggle('role-hidden', !role.manage);
  manage.textContent = role.manage;
  search.value = '';
  renderResults('');
}

function renderResults(value) {
  const term = value.trim().toLowerCase();
  if (!term) { results.classList.remove('show'); results.innerHTML = ''; return; }
  const role = roleData[activeRole];
  const matches = vessels.filter(v => (!role.station || v.station === activeStation) && Object.values(v).some(x => x.toLowerCase().includes(term)));
  results.classList.add('show');
  results.innerHTML = matches.length
    ? matches.map(v => `<div class="result"><div><strong>${v.name}</strong><p>${v.id} · ${v.reg} · ${v.station} · ${v.status}</p></div><button data-vessel="${v.name}">Open record</button></div>`).join('')
    : '<div class="result"><div><strong>No authorized record found</strong><p>Your current role only displays records within its permitted station scope.</p></div></div>';
}

search.addEventListener('input', e => renderResults(e.target.value));
roleSelector.addEventListener('change', e => { activeRole = e.target.value; applyRole(); message(`Demo role changed to ${roleData[activeRole].title}.`); });
gateRole.addEventListener('change', () => { gateStation.disabled = gateRole.value === 'regional'; });
document.querySelector('#enterDashboard').addEventListener('click', () => {
  activeRole = gateRole.value;
  activeStation = gateStation.value;
  roleSelector.value = activeRole;
  applyRole();
  document.querySelector('#loginGate').classList.add('role-hidden');
  document.querySelector('#appShell').classList.remove('role-hidden');
  message(`Signed in as ${roleData[activeRole].title}.`);
});
document.querySelector('#changeAccount').addEventListener('click', () => {
  gateRole.value = activeRole;
  gateStation.value = activeStation;
  gateStation.disabled = activeRole === 'regional';
  document.querySelector('#appShell').classList.add('role-hidden');
  document.querySelector('#loginGate').classList.remove('role-hidden');
});
results.addEventListener('click', e => { if (e.target.dataset.vessel) message(`${e.target.dataset.vessel} record opened in the full system.`); });
document.querySelector('#newInspection').addEventListener('click', () => document.querySelector('#inspectionModal').showModal());
document.querySelector('#scanButton').addEventListener('click', () => message('QR scanning will be available in the inspector mobile app.'));
document.querySelector('#helpButton').addEventListener('click', () => message('Draft system: all displayed information is sample data.'));
document.querySelector('#manageUsers').addEventListener('click', () => message('User management will let an authorized admin create and deactivate personnel accounts.'));
document.querySelector('#inspectionModal').addEventListener('close', () => { if (document.querySelector('#inspectionModal').returnValue === 'default') message('Inspection saved as a local draft.'); });
applyRole();
