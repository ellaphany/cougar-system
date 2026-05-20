/**
 * polar-photo.js  —  AI-powered class photo analyser for Cougar Data System
 * Adds a "📸 Photo Analysis" button to the Polar Flow page header, and
 * injects a collapsible panel below the existing CSV table when clicked.
 */
(function () {
  'use strict';

  /* ── 1. NOMINAL ROLL ──────────────────────────────────────────────────── */
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

  /* ── 2. HELPERS ───────────────────────────────────────────────────────── */
  function getNominalRoll() {
    try {
      const soldiers = window.APP_STATE && window.APP_STATE.soldiers;
      if (soldiers && soldiers.length > 0) {
        const roll = {};
        soldiers.forEach(s => { if (s.id) roll[s.id.toUpperCase()] = s.name || ''; });
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

  /* ── 3. CLAUDE API CALL ───────────────────────────────────────────────── */
  async function analysePhoto(base64Image, mediaType) {
    const roll = getNominalRoll();
    const allIds = Object.keys(roll).sort();

    const systemPrompt = `You are an assistant helping a Singapore Army company analyse fitness class photos.
The company uses 4D numbers in the format C followed by 4 digits (e.g. C1101, C4213).
The nominal roll of valid 4D numbers is: ${allIds.join(', ')}.

When given a photo, you must:
1. Read all 4D numbers visible (on bibs, Polar watch screens, display boards, name tags, etc.), left to right, top to bottom.
2. Only report numbers that exist in the nominal roll above — ignore any unrecognised numbers.
3. If the photo shows a Polar or fitness device screen (or a class summary board), extract:
   - Max heart rate (bpm)
   - Average heart rate (bpm)
   - Calories burned (kcal)
   If a value is not visible, set it to null.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "present": ["C1101","C1205",...],
  "fitness": { "maxHR": 185, "avgHR": 155, "calories": 420 },
  "notes": "optional short observation"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: 'Analyse this class photo. Extract all 4D numbers visible and any fitness data shown.' }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }
    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    return JSON.parse(clean);
  }

  /* ── 4. RENDER RESULTS ────────────────────────────────────────────────── */
  function renderResults(result, container) {
    const roll = getNominalRoll();
    const presentSet = new Set((result.present || []).map(s => s.toUpperCase()));
    const allIds = Object.keys(roll).sort();
    const absentIds = allIds.filter(id => !presentSet.has(id));
    const { fitness } = result;

    const pill = (text, bg, color) =>
      `<span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${bg};color:${color};font-family:monospace;">${text}</span>`;

    let html = '';

    /* Fitness cards */
    if (fitness && (fitness.maxHR || fitness.avgHR || fitness.calories)) {
      html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.2rem;">`;
      [
        { label: 'Max HR', value: fitness.maxHR ? fitness.maxHR + ' bpm' : '—', icon: '❤️' },
        { label: 'Avg HR', value: fitness.avgHR ? fitness.avgHR + ' bpm' : '—', icon: '💓' },
        { label: 'Calories', value: fitness.calories ? fitness.calories + ' kcal' : '—', icon: '🔥' },
      ].forEach(c => {
        html += `<div style="background:rgba(255,255,255,0.07);border-radius:8px;padding:12px 14px;border:0.5px solid rgba(255,255,255,0.12);">
          <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${c.icon} ${c.label}</div>
          <div style="font-size:20px;font-weight:700;color:#fff;">${c.value}</div>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:13px;color:#aaa;background:rgba(255,255,255,0.05);padding:10px 14px;border-radius:8px;margin-bottom:1rem;">
        No fitness data detected. For HR &amp; calories, photograph the Polar class summary screen too.
      </div>`;
    }

    /* Attendance summary */
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
      ${pill(presentSet.size + ' present', '#1a3d1a', '#6fcf6f')}
      ${pill(absentIds.length + ' absent', '#3d1a1a', '#f28b82')}
    </div>`;

    /* Absent list */
    if (absentIds.length > 0) {
      /* Group by plt+section key */
      const groups = {};
      absentIds.forEach(id => {
        const key = 'Plt ' + id[1] + ' Sec ' + id[2];
        if (!groups[key]) groups[key] = [];
        groups[key].push(id);
      });

      html += `<div style="font-size:13px;font-weight:600;color:#ccc;margin-bottom:8px;">Absent members</div>`;
      Object.entries(groups).sort().forEach(([key, ids]) => {
        html += `<div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${key}</div>`;
        ids.forEach(id => {
          html += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,255,255,0.04);border-radius:7px;margin-bottom:4px;border:0.5px solid rgba(255,255,255,0.08);">
            <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:5px;background:#3d1a1a;color:#f28b82;font-family:monospace;">${id}</span>
            <span style="font-size:13px;color:#ddd;">${roll[id] || ''}</span>
          </div>`;
        });
        html += `</div>`;
      });
    } else {
      html += `<div style="font-size:13px;padding:10px 14px;border-radius:8px;background:#1a3d1a;color:#6fcf6f;">✓ All members accounted for.</div>`;
    }

    if (result.notes) {
      html += `<div style="font-size:12px;color:#888;margin-top:10px;border-top:0.5px solid rgba(255,255,255,0.1);padding-top:8px;"><strong>Note:</strong> ${result.notes}</div>`;
    }

    container.innerHTML = html;
  }

  /* ── 5. BUILD PANEL ───────────────────────────────────────────────────── */
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'polar-photo-panel';
    panel.style.cssText = 'margin-top:1.5rem;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;padding:1.25rem;';

    panel.innerHTML = `
      <div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:.5rem;">📸 Class photo analysis</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:1rem;">
        Upload a class photo to detect absent members. Add a Polar summary screen photo to also extract fitness data.
      </div>

      <div id="pp-drop" style="border:1.5px dashed rgba(255,255,255,0.2);border-radius:8px;padding:1.75rem 1rem;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:1rem;">
        <div style="font-size:26px;margin-bottom:.4rem;">📷</div>
        <div style="font-size:14px;color:#aaa;">Drop photo here or <strong style="color:#4a90d9;">click to browse</strong></div>
        <div style="font-size:12px;color:#666;margin-top:.2rem;">JPG, PNG, WEBP — max 10 MB</div>
        <input type="file" id="pp-file" accept="image/jpeg,image/png,image/webp" style="display:none;">
      </div>

      <div id="pp-preview" style="display:none;margin-bottom:1rem;">
        <img id="pp-img" style="max-width:100%;max-height:280px;border-radius:8px;border:0.5px solid rgba(255,255,255,0.15);">
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button id="pp-analyse-btn" style="background:#4a90d9;color:#fff;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;font-weight:600;">Analyse photo</button>
          <button id="pp-clear-btn" style="background:transparent;border:0.5px solid rgba(255,255,255,0.2);color:#ccc;padding:8px 14px;border-radius:7px;cursor:pointer;font-size:14px;">Clear</button>
          <span id="pp-filename" style="font-size:12px;color:#888;"></span>
        </div>
      </div>

      <div id="pp-status" style="display:none;font-size:13px;color:#aaa;padding:8px 0;"></div>
      <div id="pp-results" style="display:none;margin-top:.5rem;"></div>
    `;

    /* Wire up events */
    const drop    = panel.querySelector('#pp-drop');
    const fileIn  = panel.querySelector('#pp-file');
    const preview = panel.querySelector('#pp-preview');
    const img     = panel.querySelector('#pp-img');
    const fname   = panel.querySelector('#pp-filename');
    const status  = panel.querySelector('#pp-status');
    const results = panel.querySelector('#pp-results');
    const analyseBtn = panel.querySelector('#pp-analyse-btn');
    const clearBtn   = panel.querySelector('#pp-clear-btn');
    let currentFile  = null;

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
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = '#4a90d9'; });
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
      status.innerHTML = '⏳ Sending to Claude for analysis…';
      results.style.display = 'none';
      try {
        const b64 = await fileToBase64(currentFile);
        const result = await analysePhoto(b64, currentFile.type || 'image/jpeg');
        status.style.display = 'none';
        results.style.display = 'block';
        renderResults(result, results);
      } catch (err) {
        status.innerHTML = `❌ Analysis failed: ${err.message}`;
      } finally {
        analyseBtn.disabled = false;
        analyseBtn.textContent = 'Analyse photo';
      }
    });

    return panel;
  }

  /* ── 6. INJECT — watches for the Polar Flow page to appear ───────────── */
  function tryInject() {
    /* Already injected? Skip. */
    if (document.getElementById('polar-photo-panel')) return;

    const content = document.getElementById('content');
    if (!content) return;

    /* Look for the "Polar Flow Data" heading or the Import Polar CSV button */
    const heading = Array.from(content.querySelectorAll('h1,h2,h3,h4'))
      .find(el => el.textContent.includes('Polar'));
    const importBtn = content.querySelector('button[onclick*="polar"], .btn-polar, #polar-import-btn') ||
      Array.from(content.querySelectorAll('button')).find(b => b.textContent.includes('Import Polar'));

    if (!heading && !importBtn) return; /* Not on Polar page yet */

    /* Find best container to append to — the direct child div of #content */
    const target = content.firstElementChild || content;
    target.appendChild(buildPanel());
  }

  function startObserver() {
    const content = document.getElementById('content');
    if (!content) { setTimeout(startObserver, 300); return; }

    const observer = new MutationObserver(() => tryInject());
    observer.observe(content, { childList: true, subtree: true });

    /* Also try immediately in case Polar is already active */
    tryInject();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

})();