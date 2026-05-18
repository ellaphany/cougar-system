// View layer. render() dispatches to a per-tab function which fills #content.
// Each tab function may also (re)create charts; old chart instances are
// destroyed at the top of render() to avoid Chart.js canvas reuse errors.

function render() {
  Object.values(STATE.charts).forEach(c => c.destroy());
  STATE.charts = {};

  // Keep filter dropdown options in sync with the current roster — cheap to
  // rebuild a few <option>s and means we don't have to remember to call this
  // from every site that mutates STATE.roster (pull, import, edit).
  if (typeof refreshFilterUI === "function") refreshFilterUI();

  const el = document.getElementById("content");
  const scoped = filteredRoster();
  const active = scoped.filter(r => r.status === "Active").length;
  const scopeLabel = isFilterActive() ? ` [${filterLabel()}]` : "";
  document.getElementById("str-counter").textContent = `Str: ${scoped.length} | Active: ${active}${scopeLabel}`;

  switch (STATE.nav) {
    case "dashboard": renderDashboard(el); break;
    case "roster": renderRoster(el); break;
    case "attendance": renderAttendance(el); break;
    case "medical": renderMedical(el); break;
    case "ippt": renderIPPT(el); break;
    case "rm": renderRM(el); break;
    case "soc": renderSOC(el); break;
    case "polar": renderPolar(el); break;
    case "sync": renderSync(el); break;
    default: el.innerHTML = "";
  }
}

function renderDashboard(el) {
  // Empty-state guard: until the user pulls from the sheet, the dashboard
  // has nothing meaningful to show.
  if (!STATE.roster.length) {
    el.innerHTML = `
      <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Company Strength Board</h2>
      <div class="card empty-state">
        <p style="margin-bottom:12px">No roster data loaded yet.</p>
        <p>Open <strong>Sync &amp; I/O</strong> in the sidebar to configure your Google Sheet connection and pull the roster.</p>
      </div>`;
    return;
  }

  const scoped = filteredRoster();
  const visible = visibleD4Set();
  const active = scoped.filter(r => r.status === "Active").length;
  const scopedMedical = STATE.medical.filter(m => passesFilter(m.d4, visible));
  // Attendance is a per-conduct aggregate (no recruit linkage), so Avg Part.
  // stays company-wide even when scoped.
  const avgPart = STATE.attendance.length ? Math.round(STATE.attendance.reduce((a, c) => a + (c.participating / c.total * 100), 0) / STATE.attendance.length) : 0;
  const scopeBanner = isFilterActive() ? `<div style="font-size:11px;color:var(--accent);margin-bottom:8px">Scope: <strong>${filterLabel()}</strong> — Attendance figures remain company-wide.</div>` : "";

  el.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">Company Strength Board</h2>
    ${scopeBanner}
    <div class="stats-row" style="margin-top:12px">
      <div class="stat"><label>Total Str</label><div class="val">${scoped.length}</div></div>
      <div class="stat"><label>Active</label><div class="val" style="color:var(--green)">${active}</div></div>
      <div class="stat"><label>MC/LD/RSI</label><div class="val" style="color:var(--red)">${scoped.length - active}</div></div>
      <div class="stat"><label>Med Events</label><div class="val" style="color:var(--orange)">${scopedMedical.length}</div></div>
      <div class="stat"><label>Avg Part.</label><div class="val" style="color:var(--accent)">${avgPart}%</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>Status Breakdown</h3><canvas id="chart-status" height="200"></canvas></div>
      <div class="card"><h3>Participation Trend</h3><canvas id="chart-participation" height="200"></canvas></div>
    </div>
    <h3 style="font-size:13px;color:var(--muted);margin-bottom:8px">Non-Active Personnel</h3>
    <div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>Status</th><th>Conditions</th><th>Notes</th></tr></thead><tbody>
    ${scoped.filter(r => r.status !== "Active").map(r => `<tr onclick="openPerson('${r.id}')" style="cursor:pointer"><td class="mono" style="font-weight:700;color:var(--accent)">${r.id}</td><td style="text-align:left">${r.name}</td><td>${statusBadge(r.status)}</td><td style="text-align:left">${r.conditions || ""}</td><td style="text-align:left">${r.notes || ""}</td></tr>`).join("")}
    </tbody></table></div>`;

  const statusCounts = {};
  scoped.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  STATE.charts.status = new Chart(document.getElementById("chart-status"), {
    type: "doughnut",
    data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: Object.keys(statusCounts).map(s => s === "Active" ? "#3FB950" : s === "Warded" ? "#F85149" : s === "RMJ" ? "#E3B341" : "#D29922") }] },
    options: { plugins: { legend: { position: "right", labels: { color: "#8B949E", font: { size: 11 } } } } }
  });

  STATE.charts.participation = new Chart(document.getElementById("chart-participation"), {
    type: "bar",
    data: { labels: STATE.attendance.map(a => a.conduct?.slice(0, 12)), datasets: [{ data: STATE.attendance.map(a => pct(a.participating, a.total)), backgroundColor: "#58A6FF44", borderColor: "#58A6FF", borderWidth: 1 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { min: 80, max: 100, grid: { color: "#30363D" }, ticks: { color: "#8B949E" } }, x: { grid: { display: false }, ticks: { color: "#8B949E", font: { size: 9 } } } } }
  });
}

function renderRoster(el) {
  const rsiCount = {};
  STATE.medical.forEach(m => { rsiCount[m.d4] = (rsiCount[m.d4] || 0) + 1; });
  const scoped = filteredRoster();
  // Push/Export operate on the FULL roster — scoping is a view concern; we
  // don't want the user to silently overwrite the sheet with only their slice.
  const titleSuffix = isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.roster.length}]</span>` : ` (${STATE.roster.length})`;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">Master Roster${titleSuffix}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="exportCSV(STATE.roster,'roster.csv')">Export CSV</button>
        <button class="btn btn-success" onclick="pushTab('Roster',STATE.roster)">Push to Sheet</button>
      </div>
    </div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>Status</th><th>Conditions</th><th>RSIs</th></tr></thead><tbody>
    ${scoped.map(r => `<tr onclick="openPerson('${r.id}')" style="cursor:pointer"><td class="mono" style="font-weight:700;color:var(--accent)">${r.id}</td><td style="text-align:left">${r.name}</td><td>${statusBadge(r.status)}</td><td style="text-align:left">${r.conditions || ""}</td><td style="color:${(rsiCount[r.id] || 0) > 1 ? 'var(--red)' : 'var(--muted)'}">${rsiCount[r.id] || 0}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">${STATE.roster.length ? `No recruits in ${filterLabel()}.` : "No roster loaded. Pull from sheet in Sync &amp; I/O."}</div>`}`;
}

function renderAttendance(el) {
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">Conduct Attendance</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" onclick="pushTab('Attendance',STATE.attendance)">Push to Sheet</button>
        <button class="btn btn-primary" onclick="openAttendanceForm()">+ Log</button>
      </div>
    </div>
    ${STATE.attendance.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Conduct</th><th>Total</th><th>Part.</th><th>LMS</th><th>PX</th><th>RSI</th><th>Fallout</th><th>Rate</th><th>LMS Rate</th><th style="text-align:left">Remarks</th><th>By</th><th></th></tr></thead><tbody>
    ${STATE.attendance.map(a => {
      const r = pct(a.participating, a.total);
      const lms = +a.lms || 0;
      // LMS rate = LMS participation / total participating (per user spec).
      // Falls back to 0 when no one participated to avoid div-by-zero.
      const lmsRate = pct(lms, a.participating);
      // Color thresholds: green ≥95% (excellent), orange 70-94% (watch), red <70% (concern).
      const rateColor = r >= 95 ? 'var(--green)' : r >= 70 ? 'var(--orange)' : 'var(--red)';
      const lmsRateColor = a.participating ? (lmsRate >= 95 ? 'var(--green)' : lmsRate >= 70 ? 'var(--orange)' : 'var(--red)') : 'var(--muted)';
      return `<tr><td>${a.date}</td><td style="text-align:left">${a.conduct}</td><td>${a.total}</td><td>${a.participating}</td><td style="color:${lms > 0 ? 'var(--accent)' : 'var(--muted)'}">${lms}</td><td style="color:${a.px > 0 ? 'var(--orange)' : 'var(--muted)'}">${a.px}</td><td style="color:${a.rsi > 0 ? 'var(--red)' : 'var(--muted)'}">${a.rsi}</td><td style="color:${a.fallout > 0 ? 'var(--red)' : 'var(--muted)'}">${a.fallout}</td><td style="font-weight:700;color:${rateColor}">${r}%</td><td style="font-weight:700;color:${lmsRateColor}">${a.participating ? lmsRate + '%' : '—'}</td><td style="text-align:left;color:${a.remarks ? 'var(--yellow)' : 'var(--muted)'};max-width:200px;white-space:normal;font-size:11px">${a.remarks || ''}</td><td>${a.by || ""}</td><td><button class="btn btn-icon" onclick="openAttendanceForm(${a.id})" title="Edit">✎</button></td></tr>`;
    }).join("")}
    </tbody></table></div>` : `<div class="empty-state">No attendance records yet.</div>`}`;
}

function renderMedical(el) {
  const visible = visibleD4Set();
  const scoped = STATE.medical.filter(m => passesFilter(m.d4, visible));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">Medical &amp; Injury Log${isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.medical.length}]</span>` : ""}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" onclick="pushTab('Medical',STATE.medical)">Push to Sheet</button>
        <button class="btn btn-primary" onclick="openMedicalForm()">+ Report</button>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat"><label>Total</label><div class="val" style="color:var(--red)">${scoped.length}</div></div>
      <div class="stat"><label>RSI</label><div class="val" style="color:var(--orange)">${scoped.filter(m => m.type === "RSI").length}</div></div>
      <div class="stat"><label>Injury</label><div class="val" style="color:var(--red)">${scoped.filter(m => m.type === "Injury").length}</div></div>
      <div class="stat"><label>Pending</label><div class="val" style="color:var(--purple)">${scoped.filter(m => m.status === "Pending").length}</div></div>
    </div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>4D</th><th>Name</th><th>Type</th><th>Reason</th><th>Status</th><th>Missed</th><th></th></tr></thead><tbody>
    ${scoped.map(m => `<tr onclick="openPerson('${m.d4}')" style="cursor:pointer"><td>${m.date}</td><td class="mono" style="font-weight:700;color:var(--accent)">${m.d4}</td><td style="text-align:left">${getName(m.d4)}</td><td>${typeBadge(m.type)}</td><td style="text-align:left">${m.reason}</td><td>${badge(m.status || "-", m.status === "Pending" ? "purple" : "orange")}</td><td style="text-align:left">${m.conductMissed || ""}</td><td><button class="btn btn-icon" onclick="event.stopPropagation(); openMedicalForm(${m.id})" title="Edit">✎</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">${STATE.medical.length ? `No medical records in ${filterLabel()}.` : "No medical records yet."}</div>`}`;
}

function renderIPPT(el) {
  const visible = visibleD4Set();
  const scoped = STATE.ippt.filter(i => passesFilter(i.d4, visible));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">IPPT Tracker${isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.ippt.length}]</span>` : ""}</h2>
      <div style="display:flex;gap:8px">
        <label class="btn" style="cursor:pointer">Import CSV<input type="file" accept=".csv" onchange="importIPPT(this)" style="display:none"></label>
        <button class="btn btn-success" onclick="pushTab('IPPT',STATE.ippt)">Push to Sheet</button>
        <button class="btn btn-primary" onclick="openIPPTForm()">+ Add</button>
      </div>
    </div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>#</th><th>Date</th><th>PU</th><th>SU</th><th>2.4km</th><th>Score</th><th>Award</th><th></th></tr></thead><tbody>
    ${scoped.map(i => `<tr><td class="mono" style="font-weight:700">${i.d4}</td><td style="text-align:left">${getName(i.d4)}</td><td>${i.attempt}</td><td>${i.date}</td><td>${i.pushups}</td><td>${i.situps}</td><td>${i.runTime}</td><td style="font-weight:700;font-size:15px">${i.score}</td><td>${awardBadge(i.score)}</td><td><button class="btn btn-icon" onclick="openIPPTForm(${i.id})" title="Edit">✎</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">${STATE.ippt.length ? `No IPPT entries in ${filterLabel()}.` : "No IPPT data yet. Add results or import CSV."}</div>`}`;
}

function renderRM(el) {
  const visible = visibleD4Set();
  const scoped = STATE.rm.filter(r => passesFilter(r.d4, visible));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">Route March Tracker${isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.rm.length}]</span>` : ""}</h2>
      <div style="display:flex;gap:8px">
        <label class="btn" style="cursor:pointer">Import CSV<input type="file" accept=".csv" onchange="importRM(this)" style="display:none"></label>
        <button class="btn btn-success" onclick="pushTab('RouteMarch',STATE.rm)">Push to Sheet</button>
        <button class="btn btn-primary" onclick="openRMForm()">+ Add</button>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    ${[{ n: 1, d: "3KM" }, { n: 2, d: "3KM" }, { n: 3, d: "3KM" }, { n: 4, d: "4KM" }, { n: 5, d: "8KM" }, { n: 6, d: "12KM" }].map(rm => `<div style="flex:1;min-width:90px;background:var(--surface2);border-radius:8px;padding:10px 12px;border:1px solid ${scoped.some(r => r.rmNum == rm.n) ? 'var(--green)' : 'var(--border)'};text-align:center"><div style="font-size:16px;font-weight:700;color:${scoped.some(r => r.rmNum == rm.n) ? 'var(--green)' : 'var(--muted)'}">RM ${rm.n}</div><div style="font-size:10px;color:var(--muted)">${rm.d}</div><div style="font-size:10px;color:var(--dim)">${scoped.filter(r => r.rmNum == rm.n).length} entries</div></div>`).join("")}
    </div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>RM</th><th>Date</th><th>Finish Time</th><th>Avg HR</th><th>Max HR</th><th>Pass</th><th></th></tr></thead><tbody>
    ${scoped.map(r => `<tr><td class="mono" style="font-weight:700">${r.d4}</td><td style="text-align:left">${getName(r.d4)}</td><td>${r.rmNum}</td><td>${r.date}</td><td class="mono" style="font-weight:700">${r.time}</td><td>${r.avgHr}</td><td>${r.maxHr}</td><td>${badge(r.pass === "Y" ? "PASS" : "FAIL", r.pass === "Y" ? "green" : "red")}</td><td><button class="btn btn-icon" onclick="openRMForm(${r.id})" title="Edit">✎</button></td></tr>`).join("")}
    </tbody></table></div>` : ""}`;
}

function renderSOC(el) {
  const visible = visibleD4Set();
  const scoped = STATE.soc.filter(s => passesFilter(s.d4, visible));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">SOC Tracker${isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.soc.length}]</span>` : ""}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" onclick="pushTab('SOC',STATE.soc)">Push to Sheet</button>
        <button class="btn btn-primary" onclick="openSOCForm()">+ Add</button>
      </div>
    </div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>SOC#</th><th>Date</th><th>Time</th><th>Avg HR</th><th>Pass</th><th></th></tr></thead><tbody>
    ${scoped.map(s => `<tr><td class="mono">${s.d4}</td><td style="text-align:left">${getName(s.d4)}</td><td>${s.socNum}</td><td>${s.date}</td><td class="mono" style="font-weight:700">${s.time}</td><td>${s.avgHr}</td><td>${badge(s.pass === "Y" ? "PASS" : "FAIL", s.pass === "Y" ? "green" : "red")}</td><td><button class="btn btn-icon" onclick="openSOCForm(${s.id})" title="Edit">✎</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">${STATE.soc.length ? `No SOC entries in ${filterLabel()}.` : "No SOC data yet."}</div>`}`;
}

function renderPolar(el) {
  const visible = visibleD4Set();
  const scoped = STATE.polar.filter(p => passesFilter(p.d4, visible));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:700">Polar Flow Data${isFilterActive() ? ` <span style="color:var(--accent);font-size:13px">[${filterLabel()}: ${scoped.length}/${STATE.polar.length}]</span>` : ""}</h2>
      <div style="display:flex;gap:8px">
        <label class="btn btn-primary" style="cursor:pointer">Import Polar CSV<input type="file" accept=".csv" onchange="importPolar(this)" style="display:none"></label>
        <button class="btn btn-success" onclick="pushTab('PolarFlow',STATE.polar)">Push to Sheet</button>
      </div>
    </div>
    <div class="card"><h3>Expected CSV Columns</h3><code class="mono" style="font-size:11px;color:var(--accent)">4D, Conduct, Date, Avg HR, Max HR, Min HR, Calories, Training Load, Recovery, Duration, Distance</code></div>
    ${scoped.length ? `<div class="table-wrap"><table><thead><tr><th>4D</th><th>Name</th><th>Conduct</th><th>Date</th><th>Avg HR</th><th>Max HR</th><th>Cal</th><th>Load</th><th>Dur</th></tr></thead><tbody>
    ${scoped.map(p => `<tr><td class="mono">${p.d4}</td><td style="text-align:left">${getName(p.d4)}</td><td style="text-align:left">${p.conduct}</td><td>${p.date}</td><td style="color:${+p.avgHr > 160 ? 'var(--red)' : +p.avgHr > 140 ? 'var(--orange)' : 'var(--green)'}">${p.avgHr}</td><td>${p.maxHr}</td><td>${p.calories}</td><td>${p.trainingLoad}</td><td>${p.duration}m</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">${STATE.polar.length ? `No Polar sessions in ${filterLabel()}.` : "No Polar data. Import a CSV."}</div>`}`;
}
