// Modal infrastructure, person-detail view, form openers/submitters, and CSV importers.

function openModal(title, html) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function openPerson(d4) {
  const p = STATE.roster.find(r => r.id === d4); if (!p) return;
  const med = STATE.medical.filter(m => m.d4 === d4);
  const ippts = STATE.ippt.filter(i => i.d4 === d4).sort((a, b) => a.attempt - b.attempt);
  const rms = STATE.rm.filter(r => r.d4 === d4).sort((a, b) => a.rmNum - b.rmNum);
  const socs = STATE.soc.filter(s => s.d4 === d4).sort((a, b) => a.socNum - b.socNum);

  let html = `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">${p.id} — P${p.plt}S${p.sect} — ${statusBadge(p.status)}</div>`;
  if (p.conditions) html += `<div style="background:#F8514922;border:1px solid #F8514944;border-radius:6px;padding:8px;margin-bottom:12px;font-size:12px;color:var(--red)">Pre-existing: ${p.conditions}</div>`;

  html += `<div class="stats-row"><div class="stat"><label>RSIs</label><div class="val" style="color:${med.length > 1 ? 'var(--red)' : 'var(--muted)'}">${med.length}</div></div>`;
  html += `<div class="stat"><label>IPPT Best</label><div class="val" style="color:var(--orange)">${ippts.length ? Math.max(...ippts.map(i => +i.score)) : "—"}</div></div>`;
  html += `<div class="stat"><label>RMs</label><div class="val" style="color:var(--teal)">${rms.length}</div></div>`;
  html += `<div class="stat"><label>SOCs</label><div class="val" style="color:var(--purple)">${socs.length}</div></div></div>`;

  if (ippts.length) {
    html += `<h4 style="font-size:12px;color:var(--muted);margin:12px 0 8px">IPPT Progression</h4>`;
    html += `<canvas id="person-ippt-chart" height="140"></canvas>`;
    html += ippts.map(i => `<span class="badge badge-accent" style="margin:2px">#${i.attempt}: ${i.score} ${awardBadge(i.score)}</span>`).join("");
  }
  if (rms.length) {
    html += `<h4 style="font-size:12px;color:var(--muted);margin:12px 0 8px">Route March</h4><div style="display:flex;gap:8px;flex-wrap:wrap">`;
    html += rms.map(r => `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;border:1px solid var(--border);text-align:center"><div style="font-size:10px;color:var(--muted)">RM ${r.rmNum}</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--teal)">${r.time}</div></div>`).join("");
    html += `</div>`;
  }
  if (socs.length) {
    html += `<h4 style="font-size:12px;color:var(--muted);margin:12px 0 8px">SOC</h4><div style="display:flex;gap:8px;flex-wrap:wrap">`;
    html += socs.map(s => `<div style="background:var(--surface2);border-radius:6px;padding:8px 12px;border:1px solid var(--border);text-align:center"><div style="font-size:10px;color:var(--muted)">SOC ${s.socNum}</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--purple)">${s.time}</div></div>`).join("");
    html += `</div>`;
  }
  if (med.length) {
    html += `<h4 style="font-size:12px;color:var(--muted);margin:12px 0 8px">Medical History</h4>`;
    html += med.map(m => `<div style="background:var(--surface2);border-radius:6px;padding:6px 10px;margin-bottom:4px;border:1px solid var(--border);font-size:12px"><span style="color:var(--muted)">${m.date}</span> ${typeBadge(m.type)} ${m.reason} ${m.status ? `<span style="color:var(--muted)">— ${m.status}</span>` : ""}</div>`).join("");
  }

  openModal(p.name, html);

  // Chart needs to be created after modal contents are in the DOM
  setTimeout(() => {
    const canvas = document.getElementById("person-ippt-chart");
    if (canvas && ippts.length) {
      new Chart(canvas, {
        type: "line",
        data: { labels: ippts.map(i => "#" + i.attempt), datasets: [{ data: ippts.map(i => +i.score), borderColor: "#D29922", backgroundColor: "#D2992233", fill: true, tension: .3, pointRadius: 5 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: "#30363D" } }, x: { grid: { color: "#30363D" } } } }
      });
    }
  }, 100);
}

// ─── FORM OPENERS + SUBMITTERS ─────────────────────────

// Validation strategy: every form is wrapped in <form onsubmit> so HTML5
// constraint validation (required, min, max, type=date/time) runs before our
// JS. Cross-field rules (e.g. participating ≤ total) are checked in submit*.
//
// Edit mode: open*Form(id) pre-fills the form from the existing entry. A hidden
// f-entry-id input carries the id through to submit*, which then replaces the
// row instead of pushing a new one. Edits stay local — sheet sync only auto-
// appends new rows; edited rows wait for a manual "Push to Sheet" to avoid
// duplicating rows in the sheet.

// Small banner shown in edit mode to remind users that edits don't auto-sync.
const editHint = `<div style="font-size:11px;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-bottom:4px">Edits save locally. Use the tab's <strong>Push to Sheet</strong> button to sync.</div>`;

function openMedicalForm(id) {
  const e = id ? STATE.medical.find(x => x.id === id) : null;
  const dateVal = e ? displayDateToISO(e.date) || todayISO() : todayISO();
  openModal(e ? "Edit Medical/RSI" : "Report Medical/RSI", `
    <form onsubmit="event.preventDefault(); submitMedical(); return false">
      <input type="hidden" id="f-entry-id" value="${e ? e.id : ""}">
      <div style="display:flex;flex-direction:column;gap:10px">
        ${e ? editHint : ""}
        <div class="form-group"><label>Recruit</label>${rosterSelect("f-d4", true, e?.d4 || "")}</div>
        ${formField("f-date", "Date", "date", "", `required value="${dateVal}" min="2020-01-01" max="2099-12-31"`)}
        ${formSelect("f-type", "Type", ["RSI", "Injury", "Fallout", "MC", "LD"], true, e?.type || "")}
        ${formField("f-reason", "Reason", "text", "Fever, sore throat...", `required maxlength="200" value="${escapeAttr(e?.reason)}"`)}
        ${formSelect("f-status", "Status", ["", "RSI", "MC", "LD", "RMJ", "Warded", "Pending", "Active"], false, e?.status || "")}
        ${formField("f-missed", "Conducts Missed", "text", "Oregon Circuit...", `maxlength="200" value="${escapeAttr(e?.conductMissed)}"`)}
        <button type="submit" class="btn btn-primary">${e ? "Save" : "Submit"}</button>
      </div>
    </form>`);
}
function submitMedical() {
  const editId = +gv("f-entry-id");
  const entry = {
    id: editId || nextId(),
    d4: gv("f-d4"),
    date: isoToDisplayDate(gv("f-date")),
    type: gv("f-type"),
    reason: gv("f-reason"),
    status: gv("f-status"),
    conductMissed: gv("f-missed")
  };
  if (editId) {
    const idx = STATE.medical.findIndex(m => m.id === editId);
    if (idx >= 0) STATE.medical[idx] = entry;
  } else {
    STATE.medical.push(entry);
  }
  if (entry.d4 && entry.status) { const r = STATE.roster.find(x => x.id === entry.d4); if (r) r.status = entry.status; }
  saveLocal(); closeModal(); render();
  if (!editId && STATE.apiUrl) API.appendRow("Medical", entry).catch(() => {});
}

function openAttendanceForm(id) {
  const e = id ? STATE.attendance.find(x => x.id === id) : null;
  const dateVal = e ? displayDateToISO(e.date) || todayISO() : todayISO();
  const numVal = v => v !== undefined && v !== null ? ` value="${v}"` : "";
  openModal(e ? "Edit Conduct Attendance" : "Log Conduct Attendance", `
    <form onsubmit="event.preventDefault(); submitAttendance(); return false">
      <input type="hidden" id="f-entry-id" value="${e ? e.id : ""}">
      <div style="display:flex;flex-direction:column;gap:10px">
        ${e ? editHint : ""}
        ${formField("f-date", "Date", "date", "", `required value="${dateVal}" min="2020-01-01" max="2099-12-31"`)}
        ${formField("f-conduct", "Conduct", "text", "Metabolic Circuit 2", `required maxlength="100" value="${escapeAttr(e?.conduct)}"`)}
        <div class="form-row">
          ${formField("f-total", "Total Str", "number", "", `required min="0" max="999" step="1"${numVal(e?.total)}`)}
          ${formField("f-part", "Participating", "number", "", `required min="0" max="999" step="1"${numVal(e?.participating)}`)}
          ${formField("f-px", "PX", "number", "", `required min="0" max="999" step="1" value="${e?.px ?? 0}"`)}
          ${formField("f-rsi", "RSI", "number", "", `required min="0" max="999" step="1" value="${e?.rsi ?? 0}"`)}
          ${formField("f-fallout", "Fallout", "number", "", `required min="0" max="999" step="1" value="${e?.fallout ?? 0}"`)}
          ${formField("f-by", "Submitted By", "text", "", `required maxlength="50" value="${escapeAttr(e?.by)}"`)}
        </div>
        <button type="submit" class="btn btn-primary">${e ? "Save" : "Submit"}</button>
      </div>
    </form>`);
}
function submitAttendance() {
  const editId = +gv("f-entry-id");
  const total = +gv("f-total"), part = +gv("f-part"), px = +gv("f-px"), rsi = +gv("f-rsi"), fallout = +gv("f-fallout");
  if (part > total) { alert("Participating cannot exceed total."); return; }
  if (px + rsi + fallout > total) { alert("PX + RSI + Fallout cannot exceed total."); return; }
  const entry = {
    id: editId || nextId(),
    date: isoToDisplayDate(gv("f-date")),
    conduct: gv("f-conduct"),
    total, participating: part, px, rsi, fallout,
    by: gv("f-by")
  };
  if (editId) {
    const idx = STATE.attendance.findIndex(a => a.id === editId);
    if (idx >= 0) STATE.attendance[idx] = entry;
  } else {
    STATE.attendance.push(entry);
  }
  saveLocal(); closeModal(); render();
  if (!editId && STATE.apiUrl) API.appendRow("Attendance", entry).catch(() => {});
}

function openIPPTForm(id) {
  // 2.4km run is a duration in mm:ss, not a time of day. Native <input type=time>
  // can't do MM:SS-only, so use two number inputs and combine at submit.
  const e = id ? STATE.ippt.find(x => x.id === id) : null;
  const dateVal = e ? displayDateToISO(e.date) || todayISO() : todayISO();
  const [runMinPrefill, runSecPrefill] = (e?.runTime || "").split(":");
  const numVal = v => v !== undefined && v !== null && v !== "" ? ` value="${v}"` : "";
  openModal(e ? "Edit IPPT Result" : "Add IPPT Result", `
    <form onsubmit="event.preventDefault(); submitIPPT(); return false">
      <input type="hidden" id="f-entry-id" value="${e ? e.id : ""}">
      <div style="display:flex;flex-direction:column;gap:10px">
        ${e ? editHint : ""}
        <div class="form-group"><label>Recruit</label>${rosterSelect("f-d4", true, e?.d4 || "")}</div>
        ${formSelect("f-attempt", "Attempt", ["1", "2", "3", "4"], true, e?.attempt ? String(e.attempt) : "")}
        ${formField("f-date", "Date", "date", "", `required value="${dateVal}" min="2020-01-01" max="2099-12-31"`)}
        <div class="form-row">
          ${formField("f-pu", "Push-ups", "number", "", `required min="0" max="99" step="1"${numVal(e?.pushups)}`)}
          ${formField("f-su", "Sit-ups", "number", "", `required min="0" max="99" step="1"${numVal(e?.situps)}`)}
          <div class="form-group">
            <label>2.4km Run (min:sec)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="f-run-min" type="number" required min="8" max="30" step="1" placeholder="min"${runMinPrefill ? ` value="${+runMinPrefill}"` : ""}>
              <span style="color:var(--muted)">:</span>
              <input id="f-run-sec" type="number" required min="0" max="59" step="1" placeholder="sec"${runSecPrefill ? ` value="${+runSecPrefill}"` : ""}>
            </div>
          </div>
          ${formField("f-score", "Total Score", "number", "", `required min="0" max="100" step="1"${numVal(e?.score)}`)}
        </div>
        <button type="submit" class="btn btn-primary">${e ? "Save" : "Submit"}</button>
      </div>
    </form>`);
}
function submitIPPT() {
  const editId = +gv("f-entry-id");
  const runMin = +gv("f-run-min"), runSec = +gv("f-run-sec");
  const runTime = `${String(runMin).padStart(2, "0")}:${String(runSec).padStart(2, "0")}`;
  const entry = {
    id: editId || nextId(), d4: gv("f-d4"),
    attempt: +gv("f-attempt"),
    date: isoToDisplayDate(gv("f-date")),
    pushups: +gv("f-pu"), situps: +gv("f-su"),
    runTime,
    score: +gv("f-score")
  };
  if (editId) {
    const idx = STATE.ippt.findIndex(i => i.id === editId);
    if (idx >= 0) STATE.ippt[idx] = entry;
  } else {
    STATE.ippt.push(entry);
  }
  saveLocal(); closeModal(); render();
  if (!editId && STATE.apiUrl) API.appendRow("IPPT", entry).catch(() => {});
}

function openRMForm(id) {
  // f-time is the wall-clock time the march was completed (e.g. 13:45), not a duration.
  const e = id ? STATE.rm.find(x => x.id === id) : null;
  const dateVal = e ? displayDateToISO(e.date) || todayISO() : todayISO();
  const numVal = v => v !== undefined && v !== null && v !== "" ? ` value="${v}"` : "";
  openModal(e ? "Edit Route March Result" : "Add Route March Result", `
    <form onsubmit="event.preventDefault(); submitRM(); return false">
      <input type="hidden" id="f-entry-id" value="${e ? e.id : ""}">
      <div style="display:flex;flex-direction:column;gap:10px">
        ${e ? editHint : ""}
        <div class="form-group"><label>Recruit</label>${rosterSelect("f-d4", true, e?.d4 || "")}</div>
        ${formSelect("f-rm", "RM #", ["1", "2", "3", "4", "5", "6"], true, e?.rmNum ? String(e.rmNum) : "")}
        ${formField("f-date", "Date", "date", "", `required value="${dateVal}" min="2020-01-01" max="2099-12-31"`)}
        ${formField("f-time", "Finish Time (hh:mm)", "time", "", `required value="${escapeAttr(e?.time)}"`)}
        <div class="form-row">
          ${formField("f-avghr", "Avg HR", "number", "", `required min="30" max="220" step="1"${numVal(e?.avgHr)}`)}
          ${formField("f-maxhr", "Max HR", "number", "", `required min="30" max="220" step="1"${numVal(e?.maxHr)}`)}
        </div>
        ${formSelect("f-pass", "Pass", [["Y", "Pass"], ["N", "Fail"]], true, e?.pass || "")}
        <button type="submit" class="btn btn-primary">${e ? "Save" : "Submit"}</button>
      </div>
    </form>`);
}
function submitRM() {
  const editId = +gv("f-entry-id");
  const avgHr = +gv("f-avghr"), maxHr = +gv("f-maxhr");
  if (maxHr < avgHr) { alert("Max HR cannot be lower than Avg HR."); return; }
  const entry = {
    id: editId || nextId(), d4: gv("f-d4"), rmNum: +gv("f-rm"),
    date: isoToDisplayDate(gv("f-date")),
    time: gv("f-time"),
    avgHr, maxHr, pass: gv("f-pass")
  };
  if (editId) {
    const idx = STATE.rm.findIndex(r => r.id === editId);
    if (idx >= 0) STATE.rm[idx] = entry;
  } else {
    STATE.rm.push(entry);
  }
  saveLocal(); closeModal(); render();
  if (!editId && STATE.apiUrl) API.appendRow("RouteMarch", entry).catch(() => {});
}

function openSOCForm(id) {
  const e = id ? STATE.soc.find(x => x.id === id) : null;
  const dateVal = e ? displayDateToISO(e.date) || todayISO() : todayISO();
  const numVal = v => v !== undefined && v !== null && v !== "" ? ` value="${v}"` : "";
  openModal(e ? "Edit SOC Result" : "Add SOC Result", `
    <form onsubmit="event.preventDefault(); submitSOC(); return false">
      <input type="hidden" id="f-entry-id" value="${e ? e.id : ""}">
      <div style="display:flex;flex-direction:column;gap:10px">
        ${e ? editHint : ""}
        <div class="form-group"><label>Recruit</label>${rosterSelect("f-d4", true, e?.d4 || "")}</div>
        ${formSelect("f-soc", "SOC #", ["1", "2", "3", "4", "5"], true, e?.socNum ? String(e.socNum) : "")}
        ${formField("f-date", "Date", "date", "", `required value="${dateVal}" min="2020-01-01" max="2099-12-31"`)}
        ${formField("f-time", "Completion Time (hh:mm:ss)", "time", "", `required step="1" min="00:04:00" max="00:30:00" value="${escapeAttr(e?.time)}"`)}
        ${formField("f-avghr", "Avg HR", "number", "", `required min="30" max="220" step="1"${numVal(e?.avgHr)}`)}
        ${formSelect("f-pass", "Pass", [["Y", "Pass"], ["N", "Fail"]], true, e?.pass || "")}
        <button type="submit" class="btn btn-primary">${e ? "Save" : "Submit"}</button>
      </div>
    </form>`);
}
function submitSOC() {
  const editId = +gv("f-entry-id");
  const entry = {
    id: editId || nextId(), d4: gv("f-d4"), socNum: +gv("f-soc"),
    date: isoToDisplayDate(gv("f-date")),
    time: gv("f-time"),
    avgHr: +gv("f-avghr"),
    pass: gv("f-pass")
  };
  if (editId) {
    const idx = STATE.soc.findIndex(s => s.id === editId);
    if (idx >= 0) STATE.soc[idx] = entry;
  } else {
    STATE.soc.push(entry);
  }
  saveLocal(); closeModal(); render();
  if (!editId && STATE.apiUrl) API.appendRow("SOC", entry).catch(() => {});
}

// ─── CSV IMPORTERS ─────────────────────────────────────

function importIPPT(input) {
  Papa.parse(input.files[0], { header: true, skipEmptyLines: true, complete: r => {
    const missing = checkCols(r.meta.fields, ["4D", "Score"]);
    if (missing.length) { alert("CSV missing required columns: " + missing.join(", ") + "\n\nExpected: 4D, Attempt, Date, Push-ups, Sit-ups, 2.4km, Score"); return; }
    r.data.forEach(row => STATE.ippt.push({
      id: nextId(), d4: col(row, "4D", "id"), attempt: colNum(row, "Attempt", "#", "attempt"),
      date: col(row, "Date", "date"), pushups: colNum(row, "Push-ups", "Pushups", "PU", "push-ups"),
      situps: colNum(row, "Sit-ups", "Situps", "SU", "sit-ups"), runTime: col(row, "2.4km", "Run", "RunTime", "run time", "2.4"),
      score: colNum(row, "Score", "Total", "Total Score", "score")
    }));
    saveLocal(); render(); alert(`Imported ${r.data.length} IPPT rows`);
  } }); input.value = "";
}
function importRM(input) {
  Papa.parse(input.files[0], { header: true, skipEmptyLines: true, complete: r => {
    const missing = checkCols(r.meta.fields, ["4D"]);
    if (missing.length) { alert("CSV missing required column: 4D\n\nExpected: 4D, RM, Date, Time, Avg HR, Max HR, Pass"); return; }
    r.data.forEach(row => STATE.rm.push({
      id: nextId(), d4: col(row, "4D", "id"), rmNum: colNum(row, "RM", "RM #", "RM#", "rmNum", "Route March"),
      date: col(row, "Date", "date"), time: col(row, "Time", "Completion Time", "time", "Duration"),
      avgHr: colNum(row, "Avg HR", "AvgHR", "avg_hr", "Average HR", "Heart Rate"),
      maxHr: colNum(row, "Max HR", "MaxHR", "max_hr", "Maximum HR"),
      pass: col(row, "Pass", "pass", "Result", "Status") || "Y"
    }));
    saveLocal(); render(); alert(`Imported ${r.data.length} Route March rows`);
  } }); input.value = "";
}
function importPolar(input) {
  Papa.parse(input.files[0], { header: true, skipEmptyLines: true, complete: r => {
    const missing = checkCols(r.meta.fields, ["4D"]);
    if (missing.length) { alert("CSV missing required column: 4D"); return; }
    r.data.forEach(row => STATE.polar.push({
      id: nextId(), d4: col(row, "4D", "id"), conduct: col(row, "Conduct", "Activity", "conduct", "Exercise"),
      date: col(row, "Date", "date"), avgHr: colNum(row, "Avg HR", "AvgHR", "avg_hr", "Average HR"),
      maxHr: colNum(row, "Max HR", "MaxHR", "max_hr"), minHr: colNum(row, "Min HR", "MinHR", "min_hr"),
      calories: colNum(row, "Calories", "Cal", "calories", "Energy"),
      trainingLoad: colNum(row, "Training Load", "TrainingLoad", "training_load", "Load"),
      duration: colNum(row, "Duration", "duration", "Time", "Dur"),
      distance: colNum(row, "Distance", "distance", "Dist")
    }));
    saveLocal(); render(); alert(`Imported ${r.data.length} Polar rows`);
  } }); input.value = "";
}
function importBackup(input) {
  const reader = new FileReader();
  reader.onload = e => { try {
    const d = JSON.parse(e.target.result);
    if (d.roster) STATE.roster = d.roster;
    if (d.medical) STATE.medical = d.medical;
    if (d.attendance) STATE.attendance = d.attendance;
    if (d.ippt) STATE.ippt = d.ippt;
    if (d.rm) STATE.rm = d.rm;
    if (d.soc) STATE.soc = d.soc;
    if (d.polar) STATE.polar = d.polar;
    saveLocal(); render();
  } catch (err) { alert("Import failed: " + err.message); } };
  reader.readAsText(input.files[0]); input.value = "";
}
