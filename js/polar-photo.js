/**
 * polar-photo.js  —  AI-powered class photo analyser for Cougar Data System
 * Integrates into the existing "polar" nav section alongside CSV upload.
 * Adds a "Photo Analysis" tab that lets the user upload a class photo,
 * sends it to Claude via the Anthropic API, and returns:
 *   - 4D numbers visible in the photo
 *   - Absent members (cross-referenced against nominal roll in state.js)
 *   - Fitness data: max HR, avg HR, calories (if visible on screen/devices)
 *
 * HOW IT HOOKS IN:
 *   The existing render.js calls renderPolar() to build the Polar section.
 *   This file patches that function to inject a second tab "Photo Analysis"
 *   alongside the existing CSV tab. Falls back gracefully if render.js changes.
 *
 * REQUIREMENTS:
 *   - Loaded AFTER render.js (already guaranteed by index.html load order +
 *     this script being appended last)
 *   - window.APP_STATE must expose .soldiers (array with .id and .name fields)
 *     as set up by state.js
 */

(function () {
  'use strict';

  /* ── 1. NOMINAL ROLL ─────────────────────────────────────────────────────
     Hardcoded as fallback. The live cross-reference uses window.APP_STATE
     if available (populated by state.js from Google Sheets sync).         */
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

  /* ── 2. HELPERS ──────────────────────────────────────────────────────── */

  /** Get the live nominal roll from APP_STATE if possible, else fallback. */
  function getNominalRoll() {
    try {
      const soldiers = window.APP_STATE && window.APP_STATE.soldiers;
      if (soldiers && soldiers.length > 0) {
        const roll = {};
        soldiers.forEach(s => { if (s.id) roll[s.id.toUpperCase()] = s.name || ''; });
        return roll;
      }
    } catch (e) { /* fall through */ }
    return FALLBACK_ROLL;
  }

  /** Convert a File to base64 string (data-URL stripped). */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Group absent members by platoon+section for display. */
  function groupByPlatoonSection(ids) {
    const groups = {};
    ids.forEach(id => {
      const key = id.slice(0, 4); // e.g. "C110"
      if (!groups[key]) groups[key] = [];
      groups[key].push(id);
    });
    return groups;
  }

  /** Render a coloured badge pill. */
  function badge(text, type) {
    const colours = {
      absent:  'background:#fde8e8;color:#a32d2d;',
      present: 'background:#eaf3de;color:#3b6d11;',
      warn:    'background:#faeeda;color:#854f0b;',
      info:    'background:#e6f1fb;color:#185fa5;',
    };
    return `<span style="font-size:12px;font-weight:500;padding:3px 8px;border-radius:6px;font-family:monospace;${colours[type]||colours.info}">${text}</span>`;
  }

  /* ── 3. CLAUDE API CALL ──────────────────────────────────────────────── */

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
  "fitness": {
    "maxHR": 185,
    "avgHR": 155,
    "calories": 420
  },
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
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image }
          }, {
            type: 'text',
            text: 'Analyse this class photo. Extract all 4D numbers visible and any fitness data shown.'
          }]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();

    // Strip accidental markdown code fences
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
    return JSON.parse(clean);
  }

  /* ── 4. RENDER RESULTS ───────────────────────────────────────────────── */

  function renderResults(result, container) {
    const roll = getNominalRoll();
    const presentSet = new Set((result.present || []).map(s => s.toUpperCase()));
    const allIds = Object.keys(roll).sort();
    const absentIds = allIds.filter(id => !presentSet.has(id));
    const unknownPresent = (result.present || []).filter(id => !roll[id.toUpperCase()]);
    const { fitness } = result;

    let html = '';

    // ── Fitness summary cards
    if (fitness && (fitness.maxHR || fitness.avgHR || fitness.calories)) {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:1.5rem;">`;
      const cards = [
        { label: 'Max heart rate', value: fitness.maxHR ? fitness.maxHR + ' bpm' : '—', icon: '❤️' },
        { label: 'Avg heart rate', value: fitness.avgHR ? fitness.avgHR + ' bpm' : '—', icon: '💓' },
        { label: 'Calories burned', value: fitness.calories ? fitness.calories + ' kcal' : '—', icon: '🔥' },
      ];
      cards.forEach(c => {
        html += `<div style="background:var(--bg2,#f5f5f3);border-radius:8px;padding:12px 14px;">
          <div style="font-size:12px;color:var(--text2,#888);margin-bottom:4px;">${c.icon} ${c.label}</div>
          <div style="font-size:22px;font-weight:600;color:var(--text1,#1a1a1a);">${c.value}</div>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:13px;color:var(--text2,#888);background:var(--bg2,#f5f5f3);padding:10px 14px;border-radius:8px;margin-bottom:1.5rem;">
        No fitness data detected in this photo. For fitness data, photograph the Polar class summary screen.
      </div>`;
    }

    // ── Attendance summary row
    html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:1rem;">
      ${badge(presentSet.size + ' present', 'present')}
      ${badge(absentIds.length + ' absent', absentIds.length > 0 ? 'absent' : 'present')}
      ${unknownPresent.length > 0 ? badge(unknownPresent.length + ' unrecognised', 'warn') : ''}
    </div>`;

    // ── Absent list
    if (absentIds.length > 0) {
      const groups = groupByPlatoonSection(absentIds);
      html += `<div style="margin-bottom:1.5rem;">
        <div style="font-size:14px;font-weight:600;color:var(--text1,#1a1a1a);margin-bottom:10px;">Absent members</div>`;
      Object.entries(groups).sort().forEach(([key, ids]) => {
        const plt = key[1]; const sec = key[2];
        html += `<div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:var(--text2,#888);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Plt ${plt} Sec ${sec}</div>`;
        ids.forEach(id => {
          html += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:0.5px solid var(--border,rgba(0,0,0,.12));border-radius:8px;margin-bottom:5px;background:var(--bg1,#fff);">
            <span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:5px;background:#fde8e8;color:#a32d2d;font-family:monospace;">${id}</span>
            <span style="font-size:13px;color:var(--text1,#1a1a1a);">${roll[id] || ''}</span>
          </div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:13px;padding:10px 14px;border-radius:8px;background:#eaf3de;color:#3b6d11;margin-bottom:1rem;">✓ All members accounted for in this photo.</div>`;
    }

    // ── Notes from Claude
    if (result.notes) {
      html += `<div style="font-size:12px;color:var(--text2,#888);border-top:0.5px solid var(--border,rgba(0,0,0,.1));padding-top:10px;margin-top:4px;">
        <strong>Note:</strong> ${result.notes}
      </div>`;
    }

    container.innerHTML = html;
  }

  /* ── 5. BUILD THE UI PANEL ───────────────────────────────────────────── */

  function buildPhotoPanel() {
    const panel = document.createElement('div');
    panel.id = 'polar-photo-panel';
    panel.style.cssText = 'margin-top:1.5rem;';

    panel.innerHTML = `
      <div style="font-size:16px;font-weight:600;color:var(--text1,#1a1a1a);margin-bottom:.75rem;">
        📸 Class photo analysis
      </div>
      <div style="font-size:13px;color:var(--text2,#888);margin-bottom:1rem;">
        Upload a class photo to identify absent members and extract fitness data. For heart rate and calorie data, also photograph the Polar class summary screen.
      </div>

      <div id="pp-drop" style="border:1.5px dashed rgba(0,0,0,.25);border-radius:10px;padding:2rem 1rem;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:1rem;">
        <div style="font-size:28px;margin-bottom:.5rem;">📷</div>
        <div style="font-size:14px;color:var(--text2,#888);">Drop a photo here or <strong style="color:var(--accent,#4a90d9);">click to browse</strong></div>
        <div style="font-size:12px;color:var(--text3,#aaa);margin-top:.25rem;">JPG, PNG, WEBP — max 10 MB</div>
        <input type="file" id="pp-file" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;">
      </div>

      <div id="pp-preview" style="display:none;margin-bottom:1rem;">
        <img id="pp-img" style="max-width:100%;max-height:320px;border-radius:8px;border:0.5px solid rgba(0,0,0,.15);">
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
          <button id="pp-analyse-btn" class="btn" style="background:var(--accent,#4a90d9);color:#fff;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;font-weight:500;">
            Analyse photo
          </button>
          <button id="pp-clear-btn" class="btn" style="background:transparent;border:0.5px solid rgba(0,0,0,.2);padding:8px 14px;border-radius:7px;cursor:pointer;font-size:14px;">
            Clear
          </button>
          <span id="pp-filename" style="font-size:12px;color:var(--text2,#888);"></span>
        </div>
      </div>

      <div id="pp-status" style="display:none;font-size:13px;color:var(--text2,#888);padding:10px 0;"></div>
      <div id="pp-results" style="display:none;"></div>
    `;

    // ── Wire events
    const drop    = panel.querySelector('#pp-drop');
    const fileIn  = panel.querySelector('#pp-file');
    const preview = panel.querySelector('#pp-preview');
    const img     = panel.querySelector('#pp-img');
    const fname   = panel.querySelector('#pp-filename');
    const status  = panel.querySelector('#pp-status');
    const results = panel.querySelector('#pp-results');
    const analyseBtn = panel.querySelector('#pp-analyse-btn');
    const clearBtn   = panel.querySelector('#pp-clear-btn');

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
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent,#4a90d9)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.style.borderColor = '';
      if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });

    clearBtn.addEventListener('click', () => {
      currentFile = null;
      fileIn.value = '';
      img.src = '';
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
        const mediaType = currentFile.type || 'image/jpeg';
        const result = await analysePhoto(b64, mediaType);

        status.style.display = 'none';
        results.style.display = 'block';
        renderResults(result, results);
      } catch (err) {
        status.innerHTML = `❌ Analysis failed: ${err.message}. Check your network and try again.`;
      } finally {
        analyseBtn.disabled = false;
        analyseBtn.textContent = 'Analyse photo';
      }
    });

    return panel;
  }

  /* ── 6. INJECT INTO EXISTING POLAR PAGE ─────────────────────────────── */

  /**
   * The existing render.js builds the polar section dynamically when the
   * user clicks the Polar nav button.  We observe the #content div for
   * DOM changes; whenever polar-specific content appears we append our panel.
   */
  function injectWhenReady() {
    const content = document.getElementById('content');
    if (!content) return;

    const observer = new MutationObserver(() => {
      // The polar section typically contains a CSV-upload area or a
      // heading that includes "Polar".  Look for it.
      const hasPolar = content.innerHTML.toLowerCase().includes('polar') ||
                       content.querySelector('[data-section="polar"]') ||
                       content.querySelector('#polar-section') ||
                       content.querySelector('.polar-upload');

      if (hasPolar && !document.getElementById('polar-photo-panel')) {
        // Find the deepest content container to append to
        const target = content.querySelector('.section-content') ||
                       content.querySelector('.card') ||
                       content.querySelector('section') ||
                       content;
        target.appendChild(buildPhotoPanel());
      }
    });

    observer.observe(content, { childList: true, subtree: true });
  }

  /* ── 7. INIT ──────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWhenReady);
  } else {
    injectWhenReady();
  }

})();
