// Bootstrap: handle invite redemption from ?token=…, wire up nav + search,
// load local cache, render, then auto-sync.

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    STATE.nav = btn.dataset.nav;
    render();
    // On mobile, navigating to a new tab should auto-close the slide-out menu
    // so the user isn't left staring at the sidebar overlay.
    closeMobileSidebar();
  });
});

// ── Mobile sidebar toggle ────────────────────────────────
function openMobileSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-backdrop")?.classList.remove("hidden");
}
function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.classList.add("hidden");
}
document.getElementById("mobile-nav-toggle")?.addEventListener("click", openMobileSidebar);
document.getElementById("sidebar-backdrop")?.addEventListener("click", closeMobileSidebar);

// ── Auto-hide topbar on scroll-down, restore on scroll-up ────────────
// Transform-only: GPU-accelerated, no layout reflow, smooth on iOS.
// Class toggle (not inline style) so the CSS transition handles motion.
(function setupTopbarAutoHide() {
  const content = document.getElementById("content");
  const topbar = document.getElementById("topbar");
  if (!content || !topbar) return;
  // Clear any leftover inline margin-top from previous version of this code
  // so the new transform-based hide isn't fighting an old layout-shift hide.
  topbar.style.marginTop = "";

  let lastY = 0;
  let ticking = false;
  const SCROLL_THRESHOLD = 6;    // ignore micro-scrolls
  const SHOW_BELOW_PX   = 60;    // always show topbar near the very top

  content.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = content.scrollTop;
      const delta = y - lastY;
      if (Math.abs(delta) > SCROLL_THRESHOLD) {
        if (delta > 0 && y > SHOW_BELOW_PX) {
          topbar.classList.add("topbar-hidden");
        } else if (delta < 0) {
          topbar.classList.remove("topbar-hidden");
        }
        lastY = y;
      }
      ticking = false;
    });
  });
})();

document.getElementById("search-input").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const res = document.getElementById("search-results");
  if (!q) { res.innerHTML = ""; return; }
  // Search respects the global scope filter so results don't show recruits the
  // user has explicitly scoped out of view.
  const matches = filteredRoster().filter(r => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)).slice(0, 5);
  res.innerHTML = matches.map(r => `<button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="openPerson('${r.id}')">${r.id}</button>`).join("");
});

// ── Global platoon/section filter ────────────────────────

function refreshFilterUI() {
  const pltSel = document.getElementById("filter-plt");
  const sectSel = document.getElementById("filter-sect");
  const clearBtn = document.getElementById("filter-clear");
  if (!pltSel || !sectSel) return;

  const platoons = [...new Set(STATE.roster.map(getPlt).filter(v => v !== ""))].sort();
  pltSel.innerHTML = `<option value="">All plts</option>` + platoons.map(p => `<option value="${p}" ${p === String(STATE.filterPlt) ? "selected" : ""}>P${p}</option>`).join("");

  // Sections depend on platoon selection — "section 2" is ambiguous across
  // platoons, so the section dropdown is disabled until a platoon is picked.
  if (STATE.filterPlt) {
    const sections = [...new Set(STATE.roster.filter(r => getPlt(r) === String(STATE.filterPlt)).map(getSect).filter(v => v !== ""))].sort();
    sectSel.disabled = false;
    sectSel.innerHTML = `<option value="">All sects</option>` + sections.map(s => `<option value="${s}" ${s === String(STATE.filterSect) ? "selected" : ""}>S${s}</option>`).join("");
  } else {
    sectSel.disabled = true;
    sectSel.innerHTML = `<option value="">All sects</option>`;
  }

  pltSel.classList.toggle("active", !!STATE.filterPlt);
  sectSel.classList.toggle("active", !!STATE.filterSect);
  if (clearBtn) clearBtn.style.display = isFilterActive() ? "" : "none";

  // Mobile filter toggle button reflects the current scope so the user can
  // see at a glance what's active without opening the popover.
  const toggleBtn = document.getElementById("mobile-filter-toggle");
  if (toggleBtn) {
    const label = isFilterActive() ? filterLabel() : "All";
    toggleBtn.textContent = label;
    toggleBtn.classList.toggle("active", isFilterActive());
  }
}

function initFilterControls() {
  const pltSel = document.getElementById("filter-plt");
  const sectSel = document.getElementById("filter-sect");
  const clearBtn = document.getElementById("filter-clear");
  const panel = document.getElementById("topbar-filters");
  const toggleBtn = document.getElementById("mobile-filter-toggle");

  pltSel.addEventListener("change", () => {
    STATE.filterPlt = pltSel.value;
    // Drop section if it doesn't exist in the new platoon (or platoon cleared).
    if (!STATE.filterPlt) STATE.filterSect = "";
    else {
      const valid = STATE.roster.some(r => getPlt(r) === String(STATE.filterPlt) && getSect(r) === String(STATE.filterSect));
      if (!valid) STATE.filterSect = "";
    }
    saveFilter();
    render();
  });

  sectSel.addEventListener("change", () => {
    STATE.filterSect = sectSel.value;
    saveFilter();
    render();
    // On mobile, close the popover after picking a section — the user is
    // done choosing scope.
    panel?.classList.remove("open");
  });

  clearBtn.addEventListener("click", () => {
    STATE.filterPlt = "";
    STATE.filterSect = "";
    saveFilter();
    render();
    panel?.classList.remove("open");
  });

  // Mobile: toggle the scope popover. Outside-tap also closes it.
  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    panel?.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!panel?.classList.contains("open")) return;
    if (panel.contains(e.target) || toggleBtn?.contains(e.target)) return;
    panel.classList.remove("open");
  });
}

// Redeems ?token=… from the URL if present. Returns true if an attempt was
// made (regardless of success); the URL param is scrubbed either way so a
// failed redemption can't sit in the address bar.
async function tryRedeemInviteFromURL() {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("token");
  if (!inviteToken) return false;

  // Scrub immediately so a refresh doesn't retry a doomed redemption.
  history.replaceState({}, document.title, window.location.pathname);

  try {
    const res = await API.redeemInvite(inviteToken);
    if (res && res.ok && res.authToken) {
      setAuthToken(res.authToken);
      return true;
    }
    alert("Invite link rejected: " + (res?.error || "unknown error") + "\n\nAsk your admin for a new link.");
  } catch (e) {
    alert("Failed to redeem invite: " + e.message);
  }
  return true;
}

(async function bootstrap() {
  await tryRedeemInviteFromURL();
  loadLocal();
  loadFilter();
  initFilterControls();
  render();
  autoSyncOnLaunch();
})();
