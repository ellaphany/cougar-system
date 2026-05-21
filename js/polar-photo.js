/**
 * polar-photo.js  —  AI photo analyser for Cougar Data System
 * - Patches renderPolar() to append a photo panel below the CSV table
 * - Single "Analyse Photo" button in header removed; panel has its own upload
 * - Results show in the existing modal
 * - Multi-page accumulation + CSV export
 */
(function () {
  'use strict';

  const WORKER_URL = 'cougar-photo-proxy.isaaclj007.workers.dev';

  /* ── NOMINAL ROLL ──────────────────────────────────────────────────── */
  const FALLBACK_ROLL = {
    "C1101":"SIDDIQ MUSTAQIM BIN KAMALLUDIN","C1102":"NEO HUAN REN DAREN","C1104":"FOO HONG LIANG","C1105":"LAU ZHI JIE","C1106":"NUR IMAN SHAFIQ BIN MUHAMAD RHAIMEI","C1107":"TAN YOU JIE","C1108":"TAN JUNN SIANG, JAMES","C1109":"DANIAL IBRAHIM BIN MOHAMMAD FIRDAUS","C1110":"TAN JUAN TIN, JIREH","C1111":"LIM RUI SIANG DARREN","C1112":"LIM JOO KAI, ANSON","C1113":"SHIVAIN SHORY S/O SAWINDER KUMAR SHORY","C1114":"DYLAN CHIN YU RONG","C1115":"ISAAC HOO YU KAI","C1116":"CHOW JUN MING",
    "C1201":"CHIU KE LUN REYES","C1202":"IAN FOONG YIN HNG","C1203":"NG WEI JIE, DALSON","C1205":"KAN XIEU YONG, SHAUN","C1206":"SHAIK MUHAMMAD HAZIQ S/O ABDUL RASHID","C1207":"LEE WEN JIE","C1208":"CHOO ZI JUN JONAS","C1209":"IRFAN NUR HAQIMI BIN ZAZALI","C1210":"CEDRIC HO HONG HUNG","C1211":"RYAN NG RUI YANG","C1212":"CHIN JUN EE","C1213":"AUSTON YONG",
    "C1301":"ADAM NAUFAL BIN MOHAMMAD NAZRI","C1302":"YANG WEN KAI JOVAN","C1303":"SHAUN AARON TAN YONG SHENG","C1304":"LIM YI JIE KEITH","C1305":"CHOO JUN HAO, EDWIN","C1306":"MATTHEW NOEL ARUL","C1307":"HO MUN HOI, ZAVIER","C1308":"MUHAMMAD NORHAFIZ BIN MUHAMMAD ABDUL AZIZ","C1309":"AMOS ANG JUN LONG","C1310":"FONG QI JUN","C1311":"JUSTIN NG TIAN YU","C1312":"TAN CHIN SIANG, RYAN","C1313":"WONG WEI YIK","C1314":"DASHAN KANNA S/O VIJAYEN",
    "C1401":"ISAAC CHAU","C1402":"THAM JUN CAI","C1403":"AURELIUS POH RUI MING","C1404":"JAYDEN SIM SHENG HUAT","C1405":"LIM JIAN JIE","C1406":"BRYAN GOH","C1407":"ADEN LUCAS TAN","C1408":"KE EE JIE","C1409":"HARIS BIN HIRWAN","C1410":"MUHAMMAD ZHENG XIAN BIN ZAKARIAH","C1411":"MUHAMMAD SYABIL BIN ABDUL WAHID","C1412":"TAN HUI KAI","C1413":"ILYASAK BIN AFFANDI","C1414":"MUHAMMAD ZAFRAN BIN MOHD ZAILAN",
    "C4101":"ONG YEE HEN","C4102":"ADIL RAYYAN BIN MOHAMMAD NAZRI","C4103":"CHIA ZHENG KOON","C4104":"ALFIE STEPHEN","C4105":"GAN JIN YU","C4106":"CHAN WEN HUI","C4107":"JIAO RONGYU","C4108":"LATRELL LEE JUN YAN","C4109":"CHEW KAI XIANG, JOHN","C4110":"SEAH JIA HONG, BENJAMIN","C4111":"MUHAMMAD AKIQ BIN AZHAR","C4112":"ANG JIE EN JERON","C4114":"BRYAN TEO ZU YAO","C4115":"PRAVIN RAJENTHIRAN","C4116":"HENG JUN HAO RYAN",
    "C4201":"ANG HAN WEI","C4202":"TEDDY LIM YAN HUNG","C4203":"MERWYN FOO HE JUN","C4204":"LIM JUN YI GAVIN","C4205":"KOEN TAN DING XUN","C4206":"ETHAN POH YANG EN","C4207":"ZENG GUOZHAO LUCAS","C4208":"TORRENCE CHAN HONG KAI","C4209":"SIVARAAM SITA NAIDU","C4210":"NEO HUAN WEN ALVAN","C4211":"HAZIQ IRFAN BIN HALIM","C4212":"MUHAMMAD ZAIDAN IDRAKI BIN ROSLI","C4213":"STA MARIA KENDRICK OLIVER","C4214":"NATHANIEL CHEONG SAMAD","C4215":"LIM JIAN FENG","C4216":"DAARIS BIN NORMAN",
    "C4301":"RODERICK NEO HONG EIK","C4302":"LAU JUN JIE","C4303":"TRIVEDI PRAKHAR NILESH","C4304":"NING YI HENG, DYLAN","C4305":"MARCEL P'NG GIN","C4306":"HUI YAM HO","C4307":"TAY JIA YU BERKLY","C4308":"LIM YU HENG","C4310":"HEYRAM REDDIAR S/O RAMAMOORTHY REDDIAR","C4311":"EADRIC CHEW ZI HAO","C4312":"TAN SEE KIAT","C4313":"AXUS TAN","C4314":"SIM KAI RUI",
    "C4401":"MUHAMMAD RAYYAN ANIQ BIN ABUZAR","C4402":"WU SI YUAN JAYDEN","C4403":"TAN WON SHENG","C4405":"JOEL CHONG ZI JIAN","C4406":"MOHAMMAD RIFFAE ALFYAN BIN RAHMAT","C4407":"LIM YONG JUN","C4408":"MUHAMMAD ADYL BIN SANUSI","C4409":"ZULFADHLI BIN IDHAM","C4410":"MUHAMMAD SHAFIQ MUSTAQIM BIN MUHAMMAD","C4411":"TAI WEI DONG","C4412":"TAN ZI JIAN KENDRICK","C4413":"SHAWN KWAN WEI XIAN"
  };

  function getNominalRoll() {
    try {
      const roster = window.STATE && window.STATE.roster;
      if (roster && roster.length > 0) {
        const roll = {};
        roster.forEach(s => { if (s.id) roll[s.id.toUpperCase()] = s.name || ''; });
        return roll;
      }
    } catch (e) {}
    return FALLBACK_ROLL;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── ACCUMULATED RESULTS across multiple photo uploads ───────────── */
  let accumulated = {};

  /* ── CLAUDE API ────────────────────────────────────────────────────── */
  async function analysePhoto(base64Image, mediaType) {
    const roll = getNominalRoll();
    const allIds = Object.keys(roll).sort();

    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `You are reading a Polar fitness class summary screen photo from a Singapore Army unit.

Each card on the screen shows one participant. The card header contains a 4D number like "C1101", "C4205" — always starts with C followed by 4 digits. It may show as lowercase "c1101" — normalise to uppercase. The rest of the header (e.g. "S", "Daren N") is a name fragment, ignore it.

For EACH card visible extract:
- id: the 4D number (uppercase)
- avgHR: average heart rate in bpm (smaller heart icon)
- maxHR: maximum heart rate in bpm (larger heart icon)
- calories: calorie value shown

Valid 4D numbers: ${allIds.join(', ')}
Only return entries whose id is in this list.

Respond ONLY with valid JSON, no markdown:
{"participants":[{"id":"C1101","avgHR":118,"maxHR":146,"calories":204}],"pageNote":""}`,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: 'Extract all participant cards from this Polar summary screen.' }
        ]}]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Proxy error ${resp.status}`);
    }
    const data = await resp.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim()
      .replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    return JSON.parse(raw);
  }

  /* ── EXPORT TO CSV ─────────────────────────────────────────────────── */
  function exportToCSV(roll) {
    const rows = [['4D', 'Name', 'Avg HR (bpm)', 'Max HR (bpm)', 'Calories', 'Status']];
    Object.keys(roll).sort().forEach(id => {
      const d = accumulated[id];
      rows.push(d
        ? [id, roll[id], d.avgHR || '', d.maxHR || '', d.calories || '', 'Present']
        : [id, roll[id], '', '', '', 'Absent']
      );
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polar-class-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── RENDER MODAL RESULTS ──────────────────────────────────────────── */
  function renderModal() {
    const roll = getNominalRoll();
    const allIds = Object.keys(roll).sort();
    const presentIds = Object.keys(accumulated).sort();
    const absentIds = allIds.filter(id => !accumulated[id]);

    let html = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
        <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:#1a3d1a;color:#6fcf6f;">${presentIds.length} present</span>
        <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${absentIds.length ? '#3d1a1a' : '#1a3d1a'};color:${absentIds.length ? '#f28b82' : '#6fcf6f'};">${absentIds.length} absent</span>
        <button id="pp-export-btn" class="btn" style="margin-left:auto;font-size:12px;">⬇ Export to Excel</button>
        <button id="pp-reset-btn" class="btn" style="font-size:12px;color:var(--red);">✕ Clear all</button>
      </div>`;

    // Present table
    if (presentIds.length > 0) {
      html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--green);">Present (${presentIds.length})</div>
        <div style="overflow-x:auto;margin-bottom:1.25rem;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:6px 8px;color:var(--muted);">4D</th>
            <th style="text-align:left;padding:6px 8px;color:var(--muted);">Name</th>
            <th style="padding:6px 8px;color:var(--muted);">💓 Avg HR</th>
            <th style="padding:6px 8px;color:var(--muted);">❤️ Max HR</th>
            <th style="padding:6px 8px;color:var(--muted);">🔥 Cal</th>
          </tr></thead><tbody>`;
      presentIds.forEach(id => {
        const d = accumulated[id];
        const avgColor = d.avgHR > 160 ? 'var(--red)' : d.avgHR > 140 ? 'var(--orange)' : 'var(--green)';
        html += `<tr style="border-bottom:0.5px solid var(--border);">
          <td style="padding:5px 8px;font-family:monospace;font-weight:700;color:var(--accent);">${id}</td>
          <td style="padding:5px 8px;">${roll[id] || ''}</td>
          <td style="padding:5px 8px;text-align:center;font-weight:600;color:${avgColor};">${d.avgHR || '—'}</td>
          <td style="padding:5px 8px;text-align:center;font-weight:600;">${d.maxHR || '—'}</td>
          <td style="padding:5px 8px;text-align:center;">${d.calories || '—'}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // Absent list
    if (absentIds.length > 0) {
      const groups = {};
      absentIds.forEach(id => {
        const key = 'Plt ' + id[1] + ' Sec ' + id[2];
        (groups[key] = groups[key] || []).push(id);
      });
      html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--red);">Absent (${absentIds.length})</div>`;
      Object.entries(groups).sort().forEach(([key, ids]) => {
        html += `<div style="margin-bottom:10px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">${key}</div>`;
        ids.forEach(id => {
          html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border-radius:6px;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:#3d1a1a;color:#f28b82;font-family:monospace;">${id}</span>
            <span style="font-size:12px;">${roll[id] || ''}</span>
          </div>`;
        });
        html += `</div>`;
      });
    }

    document.getElementById('modal-title').textContent =
      `📸 Class Analysis — ${presentIds.length} present · ${absentIds.length} absent`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');

    document.getElementById('pp-export-btn').addEventListener('click', () => exportToCSV(roll));
    document.getElementById('pp-reset-btn').addEventListener('click', () => {
      accumulated = {};
      document.getElementById('modal-overlay').classList.add('hidden');
      updatePanelCounter();
    });
  }

  /* ── UPDATE COUNTER BADGE ON PANEL ────────────────────────────────── */
  function updatePanelCounter() {
    const badge = document.getElementById('pp-counter');
    if (!badge) return;
    const n = Object.keys(accumulated).length;
    badge.textContent = n > 0 ? `${n} participants loaded across uploaded pages` : 'No pages analysed yet';
    badge.style.color = n > 0 ? 'var(--green)' : 'var(--muted)';
  }

  /* ── ANALYSE A FILE ────────────────────────────────────────────────── */
  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large — max 10 MB.'); return; }

    // Show preview
    const img = document.getElementById('pp-img');
    const preview = document.getElementById('pp-preview');
    const fname = document.getElementById('pp-fname');
    const analyseBtn = document.getElementById('pp-analyse-btn');
    if (img) img.src = URL.createObjectURL(file);
    if (fname) fname.textContent = file.name;
    if (preview) preview.style.display = 'block';
    if (analyseBtn) analyseBtn.dataset.pending = '1';

    // Store file for when Analyse is clicked
    window._ppPendingFile = file;
  }

  /* ── PANEL HTML ────────────────────────────────────────────────────── */
  function buildPanel() {
    const div = document.createElement('div');
    div.id = 'polar-photo-panel';
    div.innerHTML = `
      <div class="card" style="margin-top:1.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;flex-wrap:wrap;gap:8px;">
          <h3 style="margin:0;">📸 Class Photo Analysis</h3>
          <span id="pp-counter" style="font-size:12px;color:var(--muted);">No pages analysed yet</span>
        </div>
        <p style="font-size:13px;color:var(--muted);margin-bottom:1rem;">
          Upload each page of the Polar summary screen one at a time. Results accumulate across pages automatically.
        </p>

        <div id="pp-drop" style="border:1.5px dashed var(--border);border-radius:8px;padding:1.5rem 1rem;text-align:center;cursor:pointer;margin-bottom:1rem;">
          <div style="font-size:24px;margin-bottom:.3rem;">📷</div>
          <div style="font-size:14px;color:var(--muted);">Drop photo here or <strong style="color:var(--accent);">click to browse</strong></div>
          <div style="font-size:11px;color:var(--dim);margin-top:.2rem;">JPG, PNG, WEBP — max 10 MB</div>
          <input type="file" id="pp-file" accept="image/jpeg,image/png,image/webp" style="display:none;">
        </div>

        <div id="pp-preview" style="display:none;margin-bottom:1rem;">
          <img id="pp-img" style="max-width:100%;max-height:320px;border-radius:8px;border:1px solid var(--border);display:block;">
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button id="pp-analyse-btn" class="btn btn-primary">Analyse this page</button>
            <button id="pp-discard-btn" class="btn">Discard</button>
            <span id="pp-fname" style="font-size:12px;color:var(--muted);"></span>
          </div>
        </div>

        <div id="pp-status" style="display:none;font-size:13px;color:var(--muted);padding:6px 0;"></div>

        <div style="display:flex;gap:8px;margin-top:.5rem;">
          <button id="pp-view-btn" class="btn" style="display:none;">View results</button>
        </div>
      </div>`;
    return div;
  }

  /* ── WIRE PANEL EVENTS ─────────────────────────────────────────────── */
  function wirePanel() {
    const drop       = document.getElementById('pp-drop');
    const fileIn     = document.getElementById('pp-file');
    const preview    = document.getElementById('pp-preview');
    const analyseBtn = document.getElementById('pp-analyse-btn');
    const discardBtn = document.getElementById('pp-discard-btn');
    const status     = document.getElementById('pp-status');
    const viewBtn    = document.getElementById('pp-view-btn');
    if (!drop) return;

    drop.addEventListener('click', () => fileIn.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.style.borderColor = '';
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });

    discardBtn.addEventListener('click', () => {
      preview.style.display = 'none';
      window._ppPendingFile = null;
      fileIn.value = '';
    });

    analyseBtn.addEventListener('click', async () => {
      const file = window._ppPendingFile;
      if (!file) return;

      analyseBtn.disabled = true;
      analyseBtn.textContent = 'Analysing…';
      status.style.display = 'block';
      status.textContent = '⏳ Sending to Claude…';

      try {
        const b64 = await fileToBase64(file);
        const result = await analysePhoto(b64, file.type);

        (result.participants || []).forEach(p => {
          if (p.id) accumulated[p.id.toUpperCase()] = {
            avgHR: p.avgHR, maxHR: p.maxHR, calories: p.calories
          };
        });

        const n = result.participants ? result.participants.length : 0;
        status.textContent = `✓ ${n} participants read from this page. ${Object.keys(accumulated).length} total loaded.`;
        preview.style.display = 'none';
        window._ppPendingFile = null;
        fileIn.value = '';
        viewBtn.style.display = 'inline-block';
        updatePanelCounter();

      } catch (err) {
        status.textContent = '❌ Failed: ' + err.message;
      } finally {
        analyseBtn.disabled = false;
        analyseBtn.textContent = 'Analyse this page';
      }
    });

    viewBtn.addEventListener('click', () => renderModal());
  }

  /* ── PATCH renderPolar ─────────────────────────────────────────────── */
  function patchRenderPolar() {
    if (typeof window.renderPolar !== 'function') {
      setTimeout(patchRenderPolar, 50);
      return;
    }
    const original = window.renderPolar;
    window.renderPolar = function (el) {
      original.call(this, el);
      // Only add panel if not already there
      if (!document.getElementById('polar-photo-panel')) {
        el.appendChild(buildPanel());
        wirePanel();
      }
    };
  }

  /* ── ALSO expose ppHandleFile for the header button ─────────────────
     Keep this so the header button (if still in render.js) still works  */
  window.ppHandleFile = function (input) {
    const file = input.files[0];
    if (file) handleFile(file);
    input.value = '';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchRenderPolar);
  } else {
    patchRenderPolar();
  }

})();