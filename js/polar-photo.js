/**
 * polar-photo.js  —  AI-powered class photo analyser for Cougar Data System
 *
 * HOW IT WORKS:
 *   renderPolar() in render.js uses el.innerHTML = `...` which wipes any
 *   injected DOM every time the tab re-renders. So instead of injecting DOM,
 *   we patch window.renderPolar to append the photo panel HTML as part of the
 *   original render, then wire up events afterwards. This survives re-renders.
 */
(function () {
  'use strict';

  /* ── NOMINAL ROLL ────────────────────────────────────────────────────── */
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
      const soldiers = window.STATE && window.STATE.roster;
      if (soldiers && soldiers.length > 0) {
        const roll = {};
        soldiers.forEach(s => { if (s.id) roll[s.id.toUpperCase()] = s.name || ''; });
        return roll;
      }
    } catch (e) {}
    return FALLBACK_ROLL;
  }

  /* ── HELPERS ─────────────────────────────────────────────────────────── */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── CLAUDE API ──────────────────────────────────────────────────────── */
  async function analysePhoto(base64Image, mediaType) {
    const roll = getNominalRoll();
    const allIds = Object.keys(roll).sort();

    const systemPrompt = `You are an assistant helping a Singapore Army company analyse fitness class photos.
The company uses 4D numbers in the format C followed by 4 digits (e.g. C1101, C4213).
The nominal roll of valid 4D numbers is: ${allIds.join(', ')}.

When given a photo:
1. Read ALL 4D numbers visible (on bibs, Polar watch screens, boards, name tags etc.), left to right, top to bottom.
2. Only report numbers that exist in the nominal roll — ignore unrecognised ones.
3. If a Polar/fitness summary screen is visible, extract: max heart rate (bpm), average heart rate (bpm), calories burned (kcal). Set to null if not visible.

Respond ONLY with valid JSON, no markdown fences, no explanation:
{"present":["C1101","C1205"],"fitness":{"maxHR":185,"avgHR":155,"calories":420},"notes":"optional"}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: 'Analyse this class photo. Extract all 4D numbers and any fitness data shown.' }
        ]}]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }
    const data = await resp.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim()
      .replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    return JSON.parse(raw);
  }

  /* ── RENDER RESULTS ──────────────────────────────────────────────────── */
  function renderResults(result, container) {
    const roll = getNominalRoll();
    const presentSet = new Set((result.present || []).map(s => s.toUpperCase()));
    const allIds = Object.keys(roll).sort();
    const absentIds = allIds.filter(id => !presentSet.has(id));
    const { fitness } = result;

    let html = '';

    // Fitness cards
    if (fitness && (fitness.maxHR || fitness.avgHR || fitness.calories)) {
      html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.2rem;">`;
      [
        { label: 'Max HR',    value: fitness.maxHR    ? fitness.maxHR    + ' bpm'  : '—', icon: '❤️' },
        { label: 'Avg HR',    value: fitness.avgHR    ? fitness.avgHR    + ' bpm'  : '—', icon: '💓' },
        { label: 'Calories',  value: fitness.calories ? fitness.calories + ' kcal' : '—', icon: '🔥' },
      ].forEach(c => {
        html += `<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;border:1px solid var(--border);">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${c.icon} ${c.label}</div>
          <div style="font-size:20px;font-weight:700;color:var(--text);">${c.value}</div>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:12px;color:var(--muted);background:var(--surface2);padding:10px 14px;border-radius:8px;margin-bottom:1rem;">
        No fitness data detected. For HR &amp; calories, also photograph the Polar class summary screen.
      </div>`;
    }

    // Attendance summary
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
      <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:#1a3d1a;color:#6fcf6f;">${presentSet.size} present</span>
      <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${absentIds.length ? '#3d1a1a' : '#1a3d1a'};color:${absentIds.length ? '#f28b82' : '#6fcf6f'};">${absentIds.length} absent</span>
    </div>`;

    // Absent list grouped by plt/sec
    if (absentIds.length > 0) {
      const groups = {};
      absentIds.forEach(id => {
        const key = 'Plt ' + id[1] + ' Sec ' + id[2];
        (groups[key] = groups[key] || []).push(id);
      });
      html += `<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">Absent members</div>`;
      Object.entries(groups).sort().forEach(([key, ids]) => {
        html += `<div style="margin-bottom:12px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${key}</div>`;
        ids.forEach(id => {
          html += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--surface2);border-radius:7px;margin-bottom:4px;border:1px solid var(--border);">
            <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:5px;background:#3d1a1a;color:#f28b82;font-family:monospace;">${id}</span>
            <span style="font-size:13px;color:var(--text);">${roll[id] || ''}</span>
          </div>`;
        });
        html += `</div>`;
      });
    } else {
      html += `<div style="font-size:13px;padding:10px 14px;border-radius:8px;background:#1a3d1a;color:#6fcf6f;">✓ All members accounted for.</div>`;
    }

    if (result.notes) {
      html += `<div style="font-size:12px;color:var(--muted);margin-top:10px;border-top:1px solid var(--border);padding-top:8px;"><strong>Note:</strong> ${result.notes}</div>`;
    }

    container.innerHTML = html;
  }

  /* ── PANEL HTML ──────────────────────────────────────────────────────── */
  function panelHTML() {
    return `
    <div id="polar-photo-panel" style="margin-top:1.5rem;">
      <div class="card">
        <h3>📸 Class Photo Analysis</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:1rem;">
          Upload a class photo to identify absent members. For heart rate &amp; calorie data, also photograph the Polar class summary screen.
        </p>

        <div id="pp-drop" style="border:1.5px dashed var(--border);border-radius:8px;padding:1.75rem 1rem;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:1rem;">
          <div style="font-size:26px;margin-bottom:.4rem;">📷</div>
          <div style="font-size:14px;color:var(--muted);">Drop photo here or <strong style="color:var(--accent);">click to browse</strong></div>
          <div style="font-size:12px;color:var(--dim);margin-top:.2rem;">JPG, PNG, WEBP — max 10 MB</div>
          <input type="file" id="pp-file" accept="image/jpeg,image/png,image/webp" style="display:none;">
        </div>

        <div id="pp-preview" style="display:none;margin-bottom:1rem;">
          <img id="pp-img" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid var(--border);">
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button id="pp-analyse-btn" class="btn btn-primary">Analyse photo</button>
            <button id="pp-clear-btn" class="btn">Clear</button>
            <span id="pp-filename" style="font-size:12px;color:var(--muted);"></span>
          </div>
        </div>

        <div id="pp-status" style="display:none;font-size:13px;color:var(--muted);padding:8px 0;"></div>
        <div id="pp-results" style="display:none;margin-top:.5rem;"></div>
      </div>
    </div>`;
  }

  /* ── WIRE UP EVENTS ──────────────────────────────────────────────────── */
  function wirePanel() {
    const drop       = document.getElementById('pp-drop');
    const fileIn     = document.getElementById('pp-file');
    const preview    = document.getElementById('pp-preview');
    const img        = document.getElementById('pp-img');
    const fname      = document.getElementById('pp-filename');
    const status     = document.getElementById('pp-status');
    const results    = document.getElementById('pp-results');
    const analyseBtn = document.getElementById('pp-analyse-btn');
    const clearBtn   = document.getElementById('pp-clear-btn');
    if (!drop) return;

    let currentFile = null;

    function loadFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) { alert('File too large — max 10 MB.'); return; }
      currentFile = file;
      img.src = URL.createObjectURL(file);
      fname.textContent = file.name;
      preview.style.display = 'block';
      status.style.display = 'none';
      results.style.display = 'none';
    }

    drop.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) loadFile(fileIn.files[0]); });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.style.borderColor = '';
      if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });

    clearBtn.addEventListener('click', () => {
      currentFile = null; fileIn.value = ''; img.src = '';
      preview.style.display = 'none';
      status.style.display = 'none';
      results.style.display = 'none';
    });

    analyseBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      analyseBtn.disabled = true;
      analyseBtn.textContent = 'Analysing…';
      status.style.display = 'block';
      status.textContent = '⏳ Sending to Claude for analysis…';
      results.style.display = 'none';
      try {
        const b64 = await fileToBase64(currentFile);
        const result = await analysePhoto(b64, currentFile.type || 'image/jpeg');
        status.style.display = 'none';
        results.style.display = 'block';
        renderResults(result, results);
      } catch (err) {
        status.textContent = '❌ Analysis failed: ' + err.message;
      } finally {
        analyseBtn.disabled = false;
        analyseBtn.textContent = 'Analyse photo';
      }
    });
  }

  /* ── PATCH renderPolar ───────────────────────────────────────────────── */
  // Wait until render.js has defined renderPolar, then wrap it so our panel
  // is always appended after the original content is written.
  function patchRenderPolar() {
    if (typeof window.renderPolar !== 'function') {
      // render.js not loaded yet — try again shortly
      setTimeout(patchRenderPolar, 50);
      return;
    }

    const original = window.renderPolar;
    window.renderPolar = function (el) {
      // Run the original — this sets el.innerHTML
      original.call(this, el);
      // Append our panel HTML
      el.insertAdjacentHTML('beforeend', panelHTML());
      // Wire up button/drag events now that the DOM exists
      wirePanel();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchRenderPolar);
  } else {
    patchRenderPolar();
  }

})();