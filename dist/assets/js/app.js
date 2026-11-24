const stations = [
  { name: "Puerto Princesa", vessels: 634, inspections: 18, users: 12, status: "Online" },
  { name: "El Nido", vessels: 398, inspections: 9, users: 8, status: "Online" },
  { name: "Taytay", vessels: 355, inspections: 6, users: 7, status: "Online" },
  { name: "Coron", vessels: 321, inspections: 8, users: 8, status: "Online" },
  { name: "San Vicente", vessels: 272, inspections: 5, users: 6, status: "Online" },
  { name: "Roxas", vessels: 249, inspections: 4, users: 6, status: "Online" },
  { name: "Brooke's Point", vessels: 237, inspections: 3, users: 5, status: "Online" },
  { name: "Quezon", vessels: 198, inspections: 2, users: 5, status: "Online" },
  { name: "Balabac", vessels: 182, inspections: 2, users: 4, status: "Limited" }
];

const vessels = [
  { id: "VW-PP-01482", name: "M/V Sea Horizon", registration: "PCG-PR-4821", type: "Passenger", station: "Puerto Princesa", status: "Active" },
  { id: "VW-EN-00376", name: "M/V Isla Verde", registration: "PCG-EN-9832", type: "Cargo", station: "El Nido", status: "For review" },
  { id: "VW-CR-00719", name: "M/V Coron Runner", registration: "PCG-CR-0719", type: "RoRo/Cargo", station: "Coron", status: "Active" },
  { id: "VW-SV-00204", name: "M/V San Vicente", registration: "PCG-SV-2204", type: "Passenger", station: "San Vicente", status: "Active" },
  { id: "VW-BL-00182", name: "M/V Balabac Dawn", registration: "PCG-BL-1182", type: "Fishing vessel", station: "Balabac", status: "Inactive" }
];

const inspections = [
  { id: "INSP-2026-184", vessel: "M/V Sea Horizon", station: "Puerto Princesa", inspector: "A. Santos", date: "Nov 24, 2026", status: "Submitted" },
  { id: "INSP-2026-183", vessel: "M/V Coron Runner", station: "Coron", inspector: "J. Rivera", date: "Nov 24, 2026", status: "Draft" },
  { id: "INSP-2026-182", vessel: "M/V Isla Verde", station: "El Nido", inspector: "M. Cruz", date: "Nov 23, 2026", status: "Returned" },
  { id: "INSP-2026-181", vessel: "M/V San Vicente", station: "San Vicente", inspector: "L. Ramos", date: "Nov 23, 2026", status: "Reviewed" }
];

const documents = [
  { vessel: "M/V Isla Verde", type: "Safety Certificate", number: "SC-2025-841", expiry: "Nov 26, 2026", verification: "Verified", status: "Expiring soon" },
  { vessel: "M/V Palawan Star", type: "Certificate of Registry", number: "CVR-39104", expiry: "Dec 1, 2026", verification: "For review", status: "Expiring soon" },
  { vessel: "M/V Kalayaan", type: "Insurance", number: "INS-88219", expiry: "Oct 30, 2026", verification: "For review", status: "Expired" },
  { vessel: "M/V Sea Horizon", type: "Certificate of Registry", number: "CVR-48121", expiry: "Jun 14, 2027", verification: "Verified", status: "Valid" }
];

const operations = [
  { id: "OP-2026-044", vessel: "M/V Sea Horizon", type: "Loading", location: "Puerto Princesa Port", date: "Nov 24, 2026", status: "Draft" },
  { id: "OP-2026-043", vessel: "M/V Coron Runner", type: "Bunkering", location: "Coron Anchorage", date: "Nov 23, 2026", status: "Submitted" },
  { id: "OP-2026-042", vessel: "M/V Isla Verde", type: "Unloading", location: "El Nido Terminal", date: "Nov 22, 2026", status: "Reviewed" }
];

const users = [
  { name: "Maria D. Reyes", username: "mdreyes", role: "Station Admin", station: "Puerto Princesa", status: "Active" },
  { name: "Allan P. Santos", username: "apsantos", role: "Inspector Personnel", station: "Puerto Princesa", status: "Active" },
  { name: "Lea M. Ramos", username: "lmramos", role: "Records Officer", station: "San Vicente", status: "Active" },
  { name: "Jose C. Rivera", username: "jcrivera", role: "Inspector Personnel", station: "Coron", status: "Deactivated" }
];

const roles = {
  regional: { label: "Regional Admin", initials: "RA", allStations: true, views: ["dashboard", "vessels", "inspections", "documents", "operations", "notifications", "stations", "reports", "audit", "users"] },
  station: { label: "Station Admin", initials: "SA", views: ["dashboard", "vessels", "inspections", "documents", "operations", "notifications", "stations", "reports", "users"] },
  inspector: { label: "Inspector Personnel", initials: "IP", views: ["dashboard", "vessels", "inspections", "documents", "operations", "notifications"] },
  records: { label: "Records Officer", initials: "RO", views: ["dashboard", "vessels", "documents", "operations", "notifications", "reports"] },
  technical: { label: "IT System Administrator", initials: "IT", allStations: true, views: ["dashboard", "stations", "audit", "backup", "users"] }
};

const viewNames = {
  dashboard: "Dashboard", vessels: "Vessel Registry", inspections: "Inspection Management", documents: "Document Management",
  operations: "Vessel Operations", notifications: "Notifications", stations: "Station Management", reports: "Reports & Analytics",
  audit: "Audit Trail", backup: "Backup & Recovery", users: "User Management"
};

const statusClass = value => {
  const text = value.toLowerCase();
  if (["active", "valid", "verified", "reviewed", "online", "successful"].some(x => text.includes(x))) return "status-green";
  if (["expired", "returned", "failed", "deactivated"].some(x => text.includes(x))) return "status-red";
  if (["soon", "limited", "pending", "for review", "submitted"].some(x => text.includes(x))) return "status-amber";
  if (["draft", "inactive"].some(x => text.includes(x))) return "status-gray";
  return "status-blue";
};

const badge = value => `<span class="status ${statusClass(value)}">${value}</span>`;
const pageHeader = (label, title, description, actions = "") => `
  <header class="page-header">
    <div><p class="section-label">${label}</p><h1>${title}</h1><p>${description}</p></div>
    <div class="page-actions">${actions}</div>
  </header>`;

const state = { role: "inspector", station: "Puerto Princesa", view: "dashboard" };
const accessPage = document.querySelector("#accessPage");
const appShell = document.querySelector("#appShell");
const viewContainer = document.querySelector("#viewContainer");
const sidebar = document.querySelector("#sidebar");
const dialog = document.querySelector("#systemDialog");
const toast = document.querySelector("#toast");
let currentDialogAction = "";

function authorizedRows(rows, stationKey = "station") {
  return roles[state.role].allStations ? rows : rows.filter(row => row[stationKey] === state.station);
}

function dashboardView() {
  const stationScope = roles[state.role].allStations ? "all participating stations" : `${state.station} Station`;
  const stationRecord = stations.find(station => station.name === state.station) || stations[0];
  const totals = roles[state.role].allStations
    ? { vessels: 2846, inspections: 17, reviews: 12 }
    : { vessels: stationRecord.vessels, inspections: stationRecord.inspections, reviews: Math.max(2, Math.round(stationRecord.inspections / 3)) };
  const activityScope = roles[state.role].allStations ? "Authorized regional activity" : `${state.station} Station`;
  return `${pageHeader("AUTHORIZED WORKSPACE", "Dashboard", `Current overview for ${stationScope}. Figures use sample data in this thesis prototype.`, `<button class="button button-secondary" data-action="refresh">Refresh</button>`)}
    <section class="metric-grid">
      <article class="metric-card"><span class="metric-name">Registered vessels</span><strong>${totals.vessels.toLocaleString()}</strong><small>Authorized record scope</small></article>
      <article class="metric-card warning"><span class="metric-name">Pending reviews</span><strong>${totals.reviews}</strong><small>Inspections and documents</small></article>
      <article class="metric-card"><span class="metric-name">Inspections today</span><strong>${totals.inspections}</strong><small>Draft, submitted, and reviewed</small></article>
      <article class="metric-card alert"><span class="metric-name">Document alerts</span><strong>34</strong><small>Expired or nearing expiration</small></article>
    </section>
    <section class="content-grid">
      <article class="panel"><div class="panel-head"><div><h2>Recent record activity</h2><p>Latest authorized activity in your scope</p></div><button class="panel-link" data-view-link="audit">View audit trail</button></div><div class="panel-body activity-list">
        <div class="activity-item"><span class="activity-icon">IN</span><div><strong>Inspection record submitted for review</strong><p>${activityScope}</p></div><time>09:42</time></div>
        <div class="activity-item"><span class="activity-icon">DC</span><div><strong>Vessel document validity reviewed</strong><p>${activityScope}</p></div><time>09:18</time></div>
        <div class="activity-item"><span class="activity-icon">OP</span><div><strong>Vessel operation draft recorded</strong><p>${activityScope}</p></div><time>08:35</time></div>
        <div class="activity-item"><span class="activity-icon">VR</span><div><strong>Vessel profile information updated</strong><p>${activityScope}</p></div><time>Yesterday</time></div>
      </div></article>
      <article class="panel"><div class="panel-head"><div><h2>Work queue</h2><p>Items requiring authorized action</p></div></div><div class="panel-body queue-list">
        <div class="queue-item"><div><strong>3 inspection submissions</strong><p>Waiting for station review</p></div>${badge("Pending")}</div>
        <div class="queue-item"><div><strong>7 documents expiring soon</strong><p>Within the sample 30-day threshold</p></div>${badge("Expiring soon")}</div>
        <div class="queue-item"><div><strong>2 returned records</strong><p>Require correction and resubmission</p></div>${badge("Returned")}</div>
      </div></article>
    </section>`;
}

function vesselsView() {
  const rows = authorizedRows(vessels).map(v => `<tr><td class="primary-cell">${v.name}<span class="secondary-line">${v.id}</span></td><td>${v.registration}</td><td>${v.type}</td><td>${v.station}</td><td>${badge(v.status)}</td><td><button class="row-action" data-action="view-vessel">Open record</button></td></tr>`).join("");
  const canRegister = ["station", "records"].includes(state.role);
  return `${pageHeader("MODULE 3", "Vessel Registry", "Search, register, and maintain authorized vessel profiles and their complete record history.", canRegister ? `<button class="button button-primary" data-action="new-vessel">Register vessel</button>` : "")}
    <div class="toolbar"><div class="toolbar-group"><input id="tableSearch" placeholder="Search vessel name, registration, or ID" /><select><option>All vessel types</option><option>Passenger</option><option>Cargo</option><option>Tanker</option><option>Fishing vessel</option></select><select><option>All statuses</option><option>Active</option><option>For review</option><option>Inactive</option></select></div><span class="small muted">${authorizedRows(vessels).length} sample records</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Vessel / ID</th><th>Official registration</th><th>Type</th><th>Responsible station</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows || `<tr><td colspan="6"><div class="empty-state"><h3>No authorized vessels</h3><p>No sample records are available for the selected station.</p></div></td></tr>`}</tbody></table></div>`;
}

function inspectionsView() {
  const rows = authorizedRows(inspections).map(i => `<tr><td class="primary-cell">${i.id}</td><td>${i.vessel}</td><td>${i.inspector}</td><td>${i.station}</td><td>${i.date}</td><td>${badge(i.status)}</td><td><button class="row-action" data-action="view-inspection">Review details</button></td></tr>`).join("");
  const canCreate = state.role === "inspector";
  return `${pageHeader("MODULE 4", "Inspection Management", "Inspection records follow the Draft, Submitted, Reviewed, or Returned workflow. Review is internal documentation review only.", canCreate ? `<button class="button button-primary" data-action="new-inspection">New inspection</button>` : "")}
    <div class="toolbar"><div class="toolbar-group"><input placeholder="Search inspection or vessel" /><select><option>All workflow statuses</option><option>Draft</option><option>Submitted</option><option>Reviewed</option><option>Returned</option></select></div><span class="small muted">Workflow-controlled records</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Inspection ID</th><th>Vessel</th><th>Inspector</th><th>Station</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function documentsView() {
  const rows = documents.map(d => `<tr><td class="primary-cell">${d.vessel}<span class="secondary-line">${d.number}</span></td><td>${d.type}</td><td>${d.expiry}</td><td>${badge(d.verification)}</td><td>${badge(d.status)}</td><td><button class="row-action" data-action="view-document">Open document</button></td></tr>`).join("");
  return `${pageHeader("MODULE 5", "Document Management", "Maintain approved vessel documents, validity dates, verification status, file access, and version history.", `<button class="button button-primary" data-action="upload-document">Upload document</button>`)}
    <div class="toolbar"><div class="toolbar-group"><input placeholder="Search vessel, document type, or number" /><select><option>All document types</option><option>Certificate of Registry</option><option>Safety Certificate</option><option>Insurance</option></select><select><option>All validity statuses</option><option>Valid</option><option>Expiring soon</option><option>Expired</option></select></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Vessel / Document no.</th><th>Document type</th><th>Expiration</th><th>Verification</th><th>Validity</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function operationsView() {
  const rows = authorizedRows(operations).map(o => `<tr><td class="primary-cell">${o.id}</td><td>${o.vessel}</td><td>${o.type}</td><td>${o.location}</td><td>${o.date}</td><td>${badge(o.status)}</td><td><button class="row-action" data-action="view-operation">Open record</button></td></tr>`).join("");
  return `${pageHeader("SUPPORTING RECORDS", "Vessel Operations", "Loading, unloading, and bunkering notifications remain attached to the correct vessel profile.", `<button class="button button-secondary" data-action="new-loading">Loading / unloading</button><button class="button button-primary" data-action="new-bunkering">Bunkering</button>`)}
    <section class="module-cards" style="margin-bottom:16px"><article class="module-card"><h3>Loading / Unloading</h3><p>Product, volume, terminal, destination, schedule, representative, and supporting documents.</p><div class="module-card-footer"><span class="status status-blue">Operation record</span><button class="row-action" data-action="new-loading">Create draft</button></div></article><article class="module-card"><h3>Bunkering</h3><p>POL product, volume, location, schedule, representative, CVR, SDS, and bunkering plan.</p><div class="module-card-footer"><span class="status status-blue">Operation record</span><button class="row-action" data-action="new-bunkering">Create draft</button></div></article></section>
    <div class="table-wrap" style="border-top:1px solid var(--gray-200);border-radius:7px"><table class="data-table"><thead><tr><th>Record ID</th><th>Vessel</th><th>Operation</th><th>Location</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function notificationsView() {
  return `${pageHeader("MODULE 6", "Notifications", "Review document validity alerts, pending submissions, and returned records in your authorized scope.", `<button class="button button-secondary" data-action="mark-all-read">Mark all as read</button>`)}
    <article class="panel"><div class="panel-head"><div><h2>Notification inbox</h2><p>5 unread sample notifications</p></div><select><option>All notifications</option><option>Unread</option><option>Document alerts</option><option>Review workflow</option></select></div><div class="panel-body activity-list">
      <div class="activity-item"><span class="activity-icon">DC</span><div><strong>Safety Certificate expires in 2 days</strong><p>M/V Isla Verde · Document validity alert</p></div><time>10 min</time></div>
      <div class="activity-item"><span class="activity-icon">IN</span><div><strong>Inspection submitted for review</strong><p>M/V Sea Horizon · INSP-2026-184</p></div><time>32 min</time></div>
      <div class="activity-item"><span class="activity-icon">RT</span><div><strong>Inspection returned for correction</strong><p>M/V Isla Verde · Add missing evidence</p></div><time>1 hr</time></div>
      <div class="activity-item"><span class="activity-icon">DC</span><div><strong>Insurance document has expired</strong><p>M/V Kalayaan · Verification required</p></div><time>Yesterday</time></div>
      <div class="activity-item"><span class="activity-icon">BK</span><div><strong>Daily backup completed</strong><p>Database and approved file storage</p></div><time>Yesterday</time></div>
    </div></article>`;
}

function stationsView() {
  const scoped = roles[state.role].allStations ? stations : stations.filter(s => s.name === state.station);
  const cards = scoped.map(s => `<article class="station-card"><div class="station-card-head"><div><h3>${s.name}</h3><p>MEPG participating station</p></div>${badge(s.status)}</div><div class="station-stats"><div><strong>${s.vessels}</strong><span>Vessels</span></div><div><strong>${s.users}</strong><span>Personnel</span></div><div><strong>${s.inspections}</strong><span>Inspections this month</span></div><div><strong>Today</strong><span>Latest sync</span></div></div></article>`).join("");
  return `${pageHeader("MODULE 7", "Station Management", "Maintain participating station profiles, personnel assignments, and authorized station statistics.", state.role === "regional" ? `<button class="button button-primary" data-action="new-station">Add station</button>` : "")}
    <section class="station-grid">${cards}</section>`;
}

function reportsView() {
  return `${pageHeader("MODULE 8", "Reports & Analytics", "Generate authorized vessel, inspection, document validity, and consolidated reports using approved filters.", `<button class="button button-secondary" data-action="export-csv">Export CSV</button><button class="button button-primary" data-action="export-pdf">Export PDF</button>`)}
    <section class="module-cards"><article class="module-card"><h3>Vessel Registry Report</h3><p>Active and inactive vessel records by station, vessel type, and registration status.</p><div class="module-card-footer"><span class="small muted">Updated today</span><button class="row-action" data-action="run-report">Generate</button></div></article><article class="module-card"><h3>Inspection Summary</h3><p>Inspection totals and workflow status by date, responsible station, and assigned personnel.</p><div class="module-card-footer"><span class="small muted">Updated today</span><button class="row-action" data-action="run-report">Generate</button></div></article><article class="module-card"><h3>Document Validity Report</h3><p>Valid, expiring, and expired documents by approved type and responsible station.</p><div class="module-card-footer"><span class="small muted">34 alerts</span><button class="row-action" data-action="run-report">Generate</button></div></article><article class="module-card"><h3>Consolidated Regional Report</h3><p>Authorized summary across all participating stations. Regional access is required.</p><div class="module-card-footer"><span class="small muted">Regional scope</span><button class="row-action" data-action="run-report">Generate</button></div></article></section>`;
}

function auditView() {
  const rows = [
    ["Nov 24, 2026 09:42", "A. Santos", "INSPECTION_SUBMIT", "INSP-2026-184", "Puerto Princesa"],
    ["Nov 24, 2026 09:18", "M. Cruz", "DOCUMENT_REVIEW", "SC-2025-841", "El Nido"],
    ["Nov 24, 2026 08:35", "J. Rivera", "OPERATION_CREATE", "OP-2026-043", "Coron"],
    ["Nov 23, 2026 16:12", "System", "BACKUP_SUCCESS", "BACKUP-1123", "Technical"],
    ["Nov 23, 2026 15:44", "L. Ramos", "VESSEL_UPDATE", "VW-SV-00204", "San Vicente"]
  ].map(r => `<tr><td>${r[0]}</td><td class="primary-cell">${r[1]}</td><td><code>${r[2]}</code></td><td>${r[3]}</td><td>${r[4]}</td><td><button class="row-action" data-action="view-audit">Details</button></td></tr>`).join("");
  return `${pageHeader("MODULE 9", "Audit Trail", "Protected history of material record access, creation, modification, uploads, and system events.")}
    <div class="toolbar"><div class="toolbar-group"><input placeholder="Search user, action, or resource" /><select><option>All actions</option><option>Login and logout</option><option>Record changes</option><option>Document access</option><option>Backup events</option></select></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Resource</th><th>Station context</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function backupView() {
  return `${pageHeader("MODULE 10", "Backup & Recovery", "Monitor protected database and file backups and document restoration-test results.", `<button class="button button-primary" data-action="run-backup">Run test backup</button>`)}
    <section class="metric-grid"><article class="metric-card success"><span class="metric-name">Latest database backup</span><strong>Successful</strong><small>Nov 24, 2026 · 02:00</small></article><article class="metric-card success"><span class="metric-name">Latest file backup</span><strong>Successful</strong><small>Nov 24, 2026 · 02:25</small></article><article class="metric-card"><span class="metric-name">Proposed RPO</span><strong>24 hrs</strong><small>Pending stakeholder confirmation</small></article><article class="metric-card"><span class="metric-name">Proposed RTO</span><strong>4 hrs</strong><small>Must be measured in a restore test</small></article></section>
    <article class="panel"><div class="panel-head"><div><h2>Backup history</h2><p>Sample technical records</p></div></div><div class="table-wrap" style="border:0"><table class="data-table"><thead><tr><th>Backup ID</th><th>Type</th><th>Started</th><th>Size</th><th>Location</th><th>Status</th></tr></thead><tbody><tr><td class="primary-cell">BACKUP-1124-DB</td><td>PostgreSQL</td><td>Nov 24, 02:00</td><td>1.8 GB</td><td>Encrypted off-site</td><td>${badge("Successful")}</td></tr><tr><td class="primary-cell">BACKUP-1124-FS</td><td>Documents & evidence</td><td>Nov 24, 02:25</td><td>18.4 GB</td><td>Encrypted off-site</td><td>${badge("Successful")}</td></tr><tr><td class="primary-cell">RESTORE-1101</td><td>Restoration test</td><td>Nov 1, 09:00</td><td>Test dataset</td><td>Isolated test environment</td><td>${badge("Reviewed")}</td></tr></tbody></table></div></article>`;
}

function usersView() {
  const scoped = roles[state.role].allStations ? users : users.filter(u => u.station === state.station);
  const rows = scoped.map(u => `<tr><td class="primary-cell">${u.name}<span class="secondary-line">${u.username}</span></td><td>${u.role}</td><td>${u.station}</td><td>${badge(u.status)}</td><td><button class="row-action" data-action="edit-user">Manage account</button></td></tr>`).join("");
  return `${pageHeader("MODULE 1", "User Management", "Create, update, deactivate, and assign authorized personnel accounts to roles and stations.", `<button class="button button-primary" data-action="new-user">Add account</button>`)}
    <div class="toolbar"><div class="toolbar-group"><input placeholder="Search name or username" /><select><option>All roles</option><option>Station Admin</option><option>Inspector Personnel</option><option>Records Officer</option></select></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Personnel / Username</th><th>Role</th><th>Station</th><th>Account status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const renderers = { dashboard: dashboardView, vessels: vesselsView, inspections: inspectionsView, documents: documentsView, operations: operationsView, notifications: notificationsView, stations: stationsView, reports: reportsView, audit: auditView, backup: backupView, users: usersView };

function renderView(view) {
  if (!roles[state.role].views.includes(view)) view = "dashboard";
  state.view = view;
  document.querySelector("#currentViewLabel").textContent = viewNames[view];
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("is-active", item.dataset.view === view));
  viewContainer.innerHTML = renderers[view]();
  viewContainer.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  sidebar.classList.remove("is-open");
}

function applyRole() {
  const role = roles[state.role];
  document.querySelector("#accountInitials").textContent = role.initials;
  document.querySelector("#accountRole").textContent = role.label;
  document.querySelector("#accountStation").textContent = role.allStations ? "All authorized stations" : `${state.station} Station`;
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("is-hidden", !role.views.includes(item.dataset.view)));
  renderView("dashboard");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function formField(label, control, full = false) {
  return `<label class="field${full ? " full" : ""}">${label}${control}</label>`;
}

const stationOptions = stations.map(s => `<option>${s.name}</option>`).join("");
const vesselOptions = vessels.map(v => `<option>${v.name} · ${v.id}</option>`).join("");

function openDialog(action) {
  const forms = {
    "new-vessel": { kicker: "VESSEL REGISTRY", title: "Register vessel record", save: "Save vessel draft", body: `<div class="form-grid">${formField("Vessel name", `<input required placeholder="Official vessel name" />`)}${formField("Official registration number", `<input required placeholder="Registration number" />`)}${formField("Vessel type", `<select><option>Passenger</option><option>Cargo</option><option>Tanker</option><option>Fishing vessel</option><option>Other</option></select>`)}${formField("Responsible station", `<select>${stationOptions}</select>`)}${formField("Owner / operator", `<input placeholder="Approved owner or operator" />`)}${formField("Home port", `<input placeholder="Home port" />`)}</div>` },
    "new-inspection": { kicker: "INSPECTION MANAGEMENT", title: "Create inspection draft", save: "Save inspection draft", body: `<div class="form-grid">${formField("Registered vessel", `<select>${vesselOptions}</select>`, true)}${formField("Inspection date", `<input type="date" />`)}${formField("Inspection type", `<select><option>Routine</option><option>Document verification</option><option>Follow-up</option></select>`)}${formField("Findings and observations", `<textarea placeholder="Record factual observations"></textarea>`, true)}${formField("Approved evidence", `<input type="file" multiple /><small>Prototype only. Production must validate file type, size, and access.</small>`, true)}</div>` },
    "upload-document": { kicker: "DOCUMENT MANAGEMENT", title: "Upload vessel document", save: "Save document draft", body: `<div class="form-grid">${formField("Registered vessel", `<select>${vesselOptions}</select>`, true)}${formField("Document type", `<select><option>Certificate of Vessel Registry</option><option>Safety Certificate</option><option>Insurance</option><option>Other approved type</option></select>`)}${formField("Document number", `<input placeholder="Document number" />`)}${formField("Issue date", `<input type="date" />`)}${formField("Expiration date", `<input type="date" />`)}${formField("Private file", `<input type="file" /><small>Version history is required when renewed.</small>`, true)}</div>` },
    "new-loading": { kicker: "VESSEL OPERATIONS", title: "Loading / unloading notification", save: "Save operation draft", body: operationForm("loading") },
    "new-bunkering": { kicker: "VESSEL OPERATIONS", title: "Bunkering notification", save: "Save operation draft", body: operationForm("bunkering") },
    "new-user": { kicker: "USER MANAGEMENT", title: "Create personnel account", save: "Save account", body: `<div class="form-grid">${formField("Full name", `<input placeholder="Personnel full name" />`)}${formField("Username", `<input placeholder="Unique username" />`)}${formField("Role", `<select><option>Station Admin</option><option>Inspector Personnel</option><option>Records Officer</option></select>`)}${formField("Assigned station", `<select>${stationOptions}</select>`)}${formField("Account status", `<select><option>Active</option><option>Deactivated</option></select>`)}${formField("Temporary password", `<input type="password" placeholder="Set securely in backend" />`)}</div>` },
    "new-station": { kicker: "STATION MANAGEMENT", title: "Add participating station", save: "Save station", body: `<div class="form-grid">${formField("Station name", `<input placeholder="Official station name" />`)}${formField("Station status", `<select><option>Active</option><option>Inactive</option></select>`)}${formField("Station location", `<input placeholder="Approved location" />`, true)}</div>` }
  };
  const config = forms[action];
  if (!config) return;
  currentDialogAction = action;
  document.querySelector("#dialogKicker").textContent = config.kicker;
  document.querySelector("#dialogTitle").textContent = config.title;
  document.querySelector("#dialogBody").innerHTML = config.body;
  document.querySelector("#dialogSaveButton").textContent = config.save;
  dialog.showModal();
}

function operationForm(type) {
  const isBunkering = type === "bunkering";
  const docs = isBunkering
    ? ["Certificate of Vessel Registry", "POL purchase order or bunkering plan", "Product Safety Data Sheet", "Notification form"]
    : ["Certificate of Vessel Registry", "Product Safety Data Sheet", "Bill of Lading / Cargo Manifest", "Notification form"];
  return `<div class="form-grid">${formField("Registered vessel", `<select>${vesselOptions}</select>`, true)}${formField("Operation location", `<input placeholder="Port, depot, terminal, or anchorage" />`)}${formField("Operation date", `<input type="date" />`)}${formField(isBunkering ? "POL product" : "Product name", `<input placeholder="Approved product name" />`)}${formField("Volume in liters", `<input type="number" min="0" placeholder="0" />`)}${formField("Vessel master / authorized representative", `<input placeholder="Full name" />`, true)}<div class="field full">Required document checklist<div class="checklist">${docs.map(d => `<label><input type="checkbox" /> ${d}</label>`).join("")}</div></div></div>`;
}

document.querySelector("#accessRole").addEventListener("change", event => {
  document.querySelector("#accessStation").disabled = roles[event.target.value].allStations;
});

document.querySelector("#accessForm").addEventListener("submit", event => {
  event.preventDefault();
  state.role = document.querySelector("#accessRole").value;
  state.station = document.querySelector("#accessStation").value;
  accessPage.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
  applyRole();
  showToast(`Signed in as ${roles[state.role].label}.`);
});

document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", () => renderView(item.dataset.view)));
document.querySelector("#menuButton").addEventListener("click", () => sidebar.classList.toggle("is-open"));
document.querySelector("#signOutButton").addEventListener("click", () => {
  appShell.classList.add("is-hidden");
  accessPage.classList.remove("is-hidden");
  sidebar.classList.remove("is-open");
});

document.querySelector("[data-open-view='notifications']").addEventListener("click", () => renderView("notifications"));
document.querySelector("#globalSearch").addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.value.trim()) {
    renderView("vessels");
    showToast(`Showing vessel records matching “${event.target.value.trim()}”.`);
  }
});

viewContainer.addEventListener("click", event => {
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) return renderView(viewLink.dataset.viewLink);
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (["new-vessel", "new-inspection", "upload-document", "new-loading", "new-bunkering", "new-user", "new-station"].includes(action)) return openDialog(action);
  const messages = {
    refresh: "Dashboard data refreshed.", "mark-all-read": "All sample notifications marked as read.", "export-csv": "CSV export will be generated by the backend.", "export-pdf": "PDF export will be generated by the backend.", "run-report": "Sample report prepared for review.", "run-backup": "Test backup request recorded for the technical administrator.", "view-vessel": "Vessel profile detail view is queued for the next build.", "view-inspection": "Inspection workflow detail opened in the full implementation.", "view-document": "Authorized document preview requires private backend storage.", "view-operation": "Operation detail opened in the full implementation.", "view-audit": "Protected audit detail is read-only.", "edit-user": "Account management requires backend authentication."
  };
  showToast(messages[action] || "Action recorded in the prototype.");
});

dialog.addEventListener("close", () => {
  if (dialog.returnValue === "save") showToast(`${document.querySelector("#dialogTitle").textContent} saved as a local prototype draft.`);
  currentDialogAction = "";
});
