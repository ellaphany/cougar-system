/**
 * polar-photo.js  —  AI photo analyser for Cougar Data System
 * Calls the Cloudflare Worker proxy instead of Anthropic directly.
 * Replace WORKER_URL below with your actual Worker URL after deploying.
 */
(function () {
  'use strict';

  // !! REPLACE THIS with your Cloudflare Worker URL after deploying !!
  const WORKER_URL = 'https://cougar-photo-proxy.isaaclj007.workers.dev/';

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

  /* ── CLAUDE API via Worker proxy ───────────────────────────────────── */
  async function analysePhoto(base64Image, mediaType) {
    const roll = getNominalRoll();
    const allIds = Object.keys(roll).sort();

    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are an assistant helping a Singapore Army company analyse fitness class photos.
4D numbers are in the format C followed by 4 digits (e.g. C1101).
Valid nominal roll: ${allIds.join(', ')}.
1. Read all 4D numbers visible left to right, top to bottom.
2. Only include numbers from the nominal roll above.
3. If a Polar/fitness summary screen is visible extract maxHR, avgHR, calories — else set null.
Reply ONLY with valid JSON, no markdown:
{"present":["C1101"],"fitness":{"maxHR":185,"avgHR":155,"calories":420},"notes":""}`,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: 'Analyse this photo.' }
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

  /* ── MODAL ─────────────────────────────────────────────────────────── */
  function showModal(result) {
    const roll = getNominalRoll();
    const presentSet = new Set((result.present || []).map(s => s.toUpperCase()));
    const absentIds = Object.keys(roll).sort().filter(id => !presentSet.has(id));
    const { fitness } = result;

    let fitnessHTML = '';
    if (fitness && (fitness.maxHR || fitness.avgHR || fitness.calories)) {
      fitnessHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.25rem;">
        ${[
          { label: 'Max HR',   value: fitness.maxHR    ? fitness.maxHR    + ' bpm'  : '—', icon: '❤️' },
          { label: 'Avg HR',   value: fitness.avgHR    ? fitness.avgHR    + ' bpm'  : '—', icon: '💓' },
          { label: 'Calories', value: fitness.calories ? fitness.calories + ' kcal' : '—', icon: '🔥' },
        ].map(c => `<div style="background:var(--surface2);border-radius:8px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${c.icon} ${c.label}</div>
          <div style="font-size:20px;font-weight:700;">${c.value}</div>
        </div>`).join('')}
      </div>`;
    } else {
      fitnessHTML = `<div style="font-size:12px;color:var(--muted);background:var(--surface2);padding:10px 14px;border-radius:8px;margin-bottom:1.25rem;">
        No fitness data detected. Photograph the Polar summary screen too for HR &amp; calories.
      </div>`;
    }

    let absentHTML = '';
    if (absentIds.length === 0) {
      absentHTML = `<div style="padding:10px 14px;border-radius:8px;background:#1a3d1a;color:#6fcf6f;font-size:13px;">✓ All members accounted for.</div>`;
    } else {
      const groups = {};
      absentIds.forEach(id => {
        const key = 'Plt ' + id[1] + ' Sec ' + id[2];
        (groups[key] = groups[key] || []).push(id);
      });
      absentHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:8px;">${absentIds.length} absent</div>`;
      Object.entries(groups).sort().forEach(([key, ids]) => {
        absentHTML += `<div style="margin-bottom:10px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">${key}</div>`;
        ids.forEach(id => {
          absentHTML += `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface2);border-radius:6px;margin-bottom:3px;border:1px solid var(--border);">
            <span style="font-size:12px;font-weight:700;padding:2px 7px;border-radius:4px;background:#3d1a1a;color:#f28b82;font-family:monospace;">${id}</span>
            <span style="font-size:13px;">${roll[id] || ''}</span>
          </div>`;
        });
        absentHTML += `</div>`;
      });
    }

    const summaryHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem;">
      <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:#1a3d1a;color:#6fcf6f;">${presentSet.size} present</span>
      <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${absentIds.length ? '#3d1a1a' : '#1a3d1a'};color:${absentIds.length ? '#f28b82' : '#6fcf6f'};">${absentIds.length} absent</span>
    </div>`;

    const notesHTML = result.notes
      ? `<div style="font-size:12px;color:var(--muted);margin-top:12px;padding-top:10px;border-top:1px solid var(--border);"><strong>Note:</strong> ${result.notes}</div>`
      : '';

    document.getElementById('modal-title').textContent = '📸 Photo Analysis Results';
    document.getElementById('modal-body').innerHTML = fitnessHTML + summaryHTML + absentHTML + notesHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  /* ── GLOBAL ENTRY POINT ────────────────────────────────────────────── */
  window.ppHandleFile = async function (input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    if (!file.type.startsWith('image/')) { alert('Please select an image file (JPG, PNG, or WEBP).'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large — max 10 MB.'); return; }

    document.getElementById('modal-title').textContent = '📸 Analysing photo…';
    document.getElementById('modal-body').innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted);">⏳ Sending to Claude, please wait…</div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');

    try {
      const b64 = await fileToBase64(file);
      const result = await analysePhoto(b64, file.type);
      showModal(result);
    } catch (err) {
      document.getElementById('modal-title').textContent = '❌ Analysis failed';
      document.getElementById('modal-body').innerHTML = `<div style="color:var(--red);padding:1rem;">${err.message}</div>`;
    }
  };

})();