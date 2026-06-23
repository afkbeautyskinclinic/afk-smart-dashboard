const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxXHnrGL7pFezEXAfa42bqKwVPt5CLKtZXJFPNXg7hrNpdoi27J0lHFCdUGCXK1WqG8/exec",
  GOOGLE_APPS_SCRIPT_TOKEN: ""
};

const STORAGE_KEY = "afkBeautyDashboard.v1";
const SETTINGS_REVISION = "2026-06-24-pic-treatment-update";
const DEFAULT_PIC_LIST = "Ryan CRM, Rizki Digital Marketing & Ads, Nur Hikmah Medis, Ridho Inventory";
const DEFAULT_TREATMENT_LIST = "Vaser Liposuction, Mini Surgery";
const PASSWORDS = {
  Owner: "owner123",
  CRM: "crm123",
  "Digital Marketing": "marketing123",
  "Design Content": "design123",
  Medis: "medis123",
  Inventory: "inventory123"
};

const NAV = [
  { id: "owner", label: "Dashboard Owner", icon: "&#9813;", page: "ownerPage" },
  { id: "crm", label: "CRM", icon: "&#9742;", page: "crmPage" },
  { id: "marketing", label: "Marketing & Ads", icon: "&#9678;", page: "marketingPage" },
  { id: "content", label: "Content Creator", icon: "&#9998;", page: "contentPage" },
  { id: "medis", label: "Tim Medis", icon: "&#10010;", page: "medisPage" },
  { id: "inventory", label: "Inventory", icon: "&#9638;", page: "inventoryPage" },
  { id: "reports", label: "Reports", icon: "&#9635;", page: "reportsPage" },
  { id: "settings", label: "Settings", icon: "&#9881;", page: "settingsPage" }
];

let state = loadState();
let currentRole = state.session.role || "Owner";
let activePage = currentRole === "Owner" ? "owner" : "crm";
let charts = {};
let deferredInstallPrompt = null;

const els = {
  navList: document.getElementById("navList"),
  mobileNav: document.getElementById("mobileNav"),
  roleSelect: document.getElementById("roleSelect"),
  pageTitle: document.getElementById("pageTitle"),
  pageEyebrow: document.getElementById("pageEyebrow"),
  globalSearch: document.getElementById("globalSearch"),
  toast: document.getElementById("toast"),
  loginModal: document.getElementById("loginModal"),
  loginForm: document.getElementById("loginForm"),
  loginRoleName: document.getElementById("loginRoleName"),
  passwordInput: document.getElementById("passwordInput"),
  cancelLogin: document.getElementById("cancelLogin"),
  menuToggle: document.getElementById("menuToggle"),
  sidebar: document.querySelector(".sidebar"),
  installButton: document.getElementById("installApp")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  els.roleSelect.value = currentRole;
  buildNavigation();
  bindGlobalEvents();
  initInstallExperience();
  registerServiceWorker();
  renderAll();
  if (!state.session.authenticated) openLogin(currentRole);
}

function defaultState() {
  return {
    session: { role: "Owner", authenticated: false },
    settings: {
      brandName: "AFK Beauty Clinic Smart Dashboard",
      primaryColor: "#F81894",
      divisions: "CRM, Digital Marketing, Design Content, Medis, Inventory",
      pics: DEFAULT_PIC_LIST,
      treatments: DEFAULT_TREATMENT_LIST,
      sources: "Instagram Ads, TikTok Ads, Database, Referral, Walk In",
      platforms: "Instagram, TikTok, Meta Ads, Google Ads, WhatsApp",
      backendUrl: "",
      backendToken: ""
    },
    crm: [
      lead("2026-06-17", "LD-1001", "NY", "Perempuan", "Jakarta Selatan", "628121110001", "Vaser Liposuction", "Qualified", "Hot", "2026-06-24", "Ingin konsultasi body contour", 2500000, "Butuh follow up cepat", ""),
      lead("2026-06-18", "LD-1002", "MK", "Perempuan", "Depok", "628121110002", "Mini Surgery", "Booking", "Warm", "2026-06-23", "Booking Sabtu sore", 1800000, "Tanya cicilan", ""),
      lead("2026-06-19", "LD-1003", "AR", "Laki-laki", "Bekasi", "628121110003", "Mini Surgery", "Lost", "Cold", "2026-06-25", "Budget belum cocok", 0, "Perlu penawaran entry", ""),
      lead("2026-06-20", "LD-1004", "DN", "Perempuan", "Tangerang", "628121110004", "Vaser Liposuction", "Treatment", "Hot", "2026-06-27", "Datang dengan referral", 18500000, "Closing premium bagus", ""),
      lead("2026-06-21", "LD-1005", "SA", "Perempuan", "Bogor", "628121110005", "Mini Surgery", "Show Up", "Warm", "2026-06-26", "Minta dokter perempuan", 950000, "Slot dokter terbatas", "")
    ],
    marketing: [
      campaign("2026-06-17", "Meta Ads", "Glow Booster June", "Lead Generation", 1800000, 32000, 980, 85, 42, 20, 12, 21500000, "Creative before-after paling kuat", ""),
      campaign("2026-06-18", "TikTok Ads", "Acne Clear Story", "Messages", 1250000, 41000, 1540, 76, 33, 18, 9, 12600000, "Hook dokter perform baik", ""),
      campaign("2026-06-19", "Google Ads", "Vaser Search High Intent", "Search", 2100000, 8200, 440, 38, 29, 16, 8, 78000000, "Keyword mahal tapi ROAS tinggi", ""),
      campaign("2026-06-20", "Meta Ads", "Facial Promo Weekend", "Traffic", 950000, 26000, 760, 64, 24, 14, 7, 7200000, "Perlu landing chat lebih cepat", "")
    ],
    content: [
      content("2026-06-15", "CT-201", "Mitos Acne Laser", "Instagram", "Reels", "Jerawat tidak selalu karena skincare", "Chat admin sekarang", "https://drive.example/acne", "2026-06-18", 21000, 18000, 1200, 84, 95, 211, 18, "Posted"),
      content("2026-06-16", "CT-202", "Before After Glow", "TikTok", "Short Video", "Kulit kusam berubah dalam 45 menit", "Booking facial glow", "https://drive.example/glow", "2026-06-20", 39000, 32000, 2300, 160, 201, 410, 34, "Posted"),
      content("2026-06-19", "CT-203", "Dokter Jawab Vaser", "Instagram", "Carousel", "Takut liposuction sakit?", "Konsultasi gratis", "https://drive.example/vaser", "2026-06-25", 0, 0, 0, 0, 0, 0, 0, "Approved"),
      content("2026-06-21", "CT-204", "Checklist Aftercare", "Instagram", "Story", "Simpan panduan setelah treatment", "Save post ini", "https://drive.example/aftercare", "2026-06-23", 8200, 7100, 360, 44, 25, 188, 7, "Editing")
    ],
    medis: [
      treatment("2026-06-17", "PT-301", "BK-701", "Vaser Liposuction", "dr. Keisha", "Mila", "Ruang 2", "Done", "Cannula set", "Gunakan korset sesuai arahan", 700000, "4 minggu", "", "Antrian padat", ""),
      treatment("2026-06-18", "PT-302", "BK-702", "Mini Surgery", "dr. Nabila", "Tari", "Ruang Tindakan", "Done", "Minor surgery kit", "Kontrol luka sesuai jadwal", 300000, "2 minggu", "Kemerahan ringan", "Edukasi aftercare perlu diperjelas", ""),
      treatment("2026-06-19", "PT-303", "BK-703", "Mini Surgery", "dr. Keisha", "Mila", "Ruang 1", "Done", "Minor surgery kit", "Jaga area tindakan tetap kering", 150000, "1 bulan", "", "Produk masker menipis", ""),
      treatment("2026-06-21", "PT-304", "BK-704", "Vaser Liposuction", "dr. Arya", "Reno", "Ruang Tindakan", "Pending", "Cannula set", "Korset 6 minggu", 2500000, "Kontrol 7 hari", "", "Menunggu hasil lab", "")
    ],
    inventory: [
      stock("PR-401", "Serum HA Skin Booster", "Injectable", "Vial", "GlowMed", 24, 10, 18, 12, "2027-02-10", "Butuh reorder jika campaign naik", ""),
      stock("PR-402", "Masker Collagen Premium", "Consumable", "Pcs", "BeautyLab", 80, 30, 95, 25, "2026-12-12", "Perputaran cepat weekend", ""),
      stock("PR-403", "Laser Tip A", "Medical Device", "Pcs", "MediTech", 14, 0, 10, 6, "2028-01-30", "Sisa mendekati minimum", ""),
      stock("PR-404", "Sunscreen Aftercare", "Retail", "Tube", "DermaCare", 35, 12, 8, 15, "2026-09-08", "Stok aman", "")
    ]
  };
}

function lead(date, id, name, gender, address, wa, interest, status, category, followUp, note, revenue, bottleneck, ownerNote) {
  return { date, id, name, gender, address, wa, interest, status, category, followUp, note, revenue, bottleneck, ownerNote };
}
function campaign(date, platform, name, objective, spend, impressions, clicks, leads, qualified, booking, showUp, treatment, revenue, bottleneck, ownerNote) {
  return { date, platform, name, objective, spend, impressions, clicks, leads, qualified, booking, showUp, treatment, revenue, bottleneck, ownerNote };
}
function content(date, id, title, platform, format, hook, cta, asset, publishDate, views, reach, likes, comments, shares, saves, leads, status) {
  return { date, id, title, platform, format, hook, cta, asset, publishDate, views, reach, likes, comments, shares, saves, leads, status, ownerNote: "" };
}
function treatment(date, patientId, bookingId, treatmentName, doctor, therapist, room, status, products, aftercare, upsales, rebooking, complaint, bottleneck, ownerNote) {
  return { date, patientId, bookingId, treatmentName, doctor, therapist, room, status, products, aftercare, upsales, rebooking, complaint, bottleneck, ownerNote };
}
function stock(id, name, category, unit, supplier, initial, inQty, outQty, minimum, expired, bottleneck, ownerNote) {
  return { id, name, category, unit, supplier, initial, inQty, outQty, minimum, expired, bottleneck, ownerNote };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState();
  try {
    const loadedState = { ...defaultState(), ...JSON.parse(saved) };
    if (loadedState.settingsRevision !== SETTINGS_REVISION) {
      loadedState.settings = {
        ...loadedState.settings,
        pics: DEFAULT_PIC_LIST,
        treatments: DEFAULT_TREATMENT_LIST
      };
      migrateTreatmentNames(loadedState);
      loadedState.settingsRevision = SETTINGS_REVISION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedState));
    }
    return loadedState;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function migrateTreatmentNames(targetState) {
  const normalizeTreatment = value => String(value || "").toLowerCase().includes("vaser") ? "Vaser Liposuction" : "Mini Surgery";
  targetState.crm = targetState.crm.map(row => ({ ...row, interest: normalizeTreatment(row.interest) }));
  targetState.medis = targetState.medis.map(row => ({ ...row, treatmentName: normalizeTreatment(row.treatmentName) }));
}

function bindGlobalEvents() {
  els.roleSelect.addEventListener("change", () => openLogin(els.roleSelect.value));
  els.loginForm.addEventListener("submit", handleLogin);
  els.cancelLogin.addEventListener("click", () => {
    els.roleSelect.value = currentRole;
    els.loginModal.close();
  });
  els.globalSearch.addEventListener("input", renderAll);
  els.menuToggle.addEventListener("click", () => els.sidebar.classList.toggle("open"));
  document.getElementById("notifyButton").addEventListener("click", () => toast("5 alert aktif: follow up, no show, stok, konten, laporan."));
}

function initInstallExperience() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (isStandalone) {
    els.installButton.style.display = "none";
    return;
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.classList.add("ready");
  });

  if (isIos) {
    els.installButton.classList.add("ready");
  }

  els.installButton.addEventListener("click", async () => {
    if (window.location.protocol === "file:") {
      toast("Untuk install, buka via localhost atau hosting HTTPS lalu klik tombol ini lagi.");
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installButton.classList.remove("ready");
      toast("Prompt install aplikasi sudah dibuka.");
      return;
    }

    if (isIos) {
      toast("Di iPhone: tap Share, lalu pilih Add to Home Screen.");
      return;
    }

    toast("Jika tombol install belum muncul, buka dari Chrome/Edge via HTTPS atau localhost.");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => toast("Aplikasi siap dipakai offline setelah install."))
      .catch(() => toast("Service worker belum aktif. Coba buka lewat localhost/HTTPS."));
  });
}

function openLogin(role) {
  els.loginRoleName.textContent = role;
  els.passwordInput.value = "";
  els.loginModal.showModal();
  setTimeout(() => els.passwordInput.focus(), 50);
}

function handleLogin(event) {
  event.preventDefault();
  const role = els.loginRoleName.textContent;
  if (els.passwordInput.value !== PASSWORDS[role]) {
    toast("Password role tidak sesuai.");
    return;
  }
  currentRole = role;
  state.session = { role, authenticated: true };
  if (role !== "Owner" && activePage === "owner") activePage = "crm";
  els.roleSelect.value = role;
  saveState();
  buildNavigation();
  renderAll();
  els.loginModal.close();
  toast(`Berhasil masuk sebagai ${role}.`);
}

function buildNavigation() {
  const navHtml = NAV.map(item => navButton(item)).join("");
  els.navList.innerHTML = navHtml;
  els.mobileNav.innerHTML = NAV.filter(item => ["owner", "crm", "marketing", "reports"].includes(item.id)).map(item => navButton(item)).join("");
  document.querySelectorAll("[data-nav]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.classList.contains("disabled")) return toast("Dashboard Owner hanya untuk role Owner.");
      activePage = button.dataset.nav;
      els.sidebar.classList.remove("open");
      renderAll();
    });
  });
}

function navButton(item) {
  const disabled = currentRole !== "Owner" && item.id === "owner";
  return `<button class="nav-item ${activePage === item.id ? "active" : ""} ${disabled ? "disabled" : ""}" data-nav="${item.id}">
    <span>${item.icon}</span><span>${item.label}</span>
  </button>`;
}

function canEdit(section) {
  const map = { crm: "CRM", marketing: "Digital Marketing", content: "Design Content", medis: "Medis", inventory: "Inventory" };
  return currentRole === map[section];
}

function canOwnerNote() {
  return currentRole === "Owner";
}

function renderAll() {
  applyBrandSettings();
  renderShell();
  renderOwner();
  renderCrm();
  renderMarketing();
  renderContent();
  renderMedis();
  renderInventory();
  renderReports();
  renderSettings();
  renderActivePage();
  renderCharts();
}

function renderShell() {
  const k = getKpis();
  document.getElementById("heroRevenue").textContent = money(k.revenue);
  document.getElementById("heroRoas").textContent = `${safeDiv(k.revenue, k.adSpend).toFixed(1)}x`;
  document.getElementById("heroLeads").textContent = k.totalLeads;
}

function renderActivePage() {
  document.querySelectorAll(".page-panel").forEach(panel => panel.classList.remove("active"));
  const page = NAV.find(item => item.id === activePage) || NAV[0];
  document.getElementById(page.page).classList.add("active");
  els.pageTitle.textContent = page.label;
  els.pageEyebrow.textContent = `${currentRole} access`;
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.nav === activePage));
}

function renderOwner() {
  const k = getKpis();
  const alerts = [
    ["Lead belum difollow up", state.crm.filter(x => new Date(x.followUp) <= new Date() && !["Treatment", "Lost"].includes(x.status)).length],
    ["Booking no show", Math.max(0, k.booking - k.showUp)],
    ["Stok menipis", state.inventory.filter(x => stockStatus(x) !== "Aman").length],
    ["Konten belum publish", state.content.filter(x => x.status !== "Posted").length],
    ["Laporan divisi belum masuk", 1]
  ];
  document.getElementById("ownerPage").innerHTML = `
    ${sectionHead("Executive Overview", "Ringkasan performa klinik dari seluruh divisi.")}
    <div class="kpi-grid">
      ${kpi("Total Leads", k.totalLeads)}
      ${kpi("Qualified Leads", k.qualified)}
      ${kpi("Total Booking", k.booking)}
      ${kpi("Show Up", k.showUp)}
      ${kpi("Total Treatment", k.treatment)}
      ${kpi("Revenue", money(k.revenue))}
      ${kpi("Ad Spend", money(k.adSpend))}
      ${kpi("ROAS", `${safeDiv(k.revenue, k.adSpend).toFixed(1)}x`)}
      ${kpi("CPL", money(safeDiv(k.adSpend, k.totalLeads)))}
      ${kpi("Stock Critical", state.inventory.filter(x => stockStatus(x) !== "Aman").length)}
      ${kpi("Top Campaign", topBy(state.marketing, "revenue", "name"))}
      ${kpi("Top Treatment", topText(state.medis, "treatmentName"))}
    </div>
    <div class="two-col">
      ${chartCard("Funnel Klinik", "funnelChart")}
      ${chartCard("Revenue Mingguan", "revenueChart")}
    </div>
    <div class="two-col">
      ${chartCard("Leads Berdasarkan Source", "sourceChart")}
      <div class="table-card">
        <h3>Tabel Alert</h3>
        <div class="alert-list">
          ${alerts.map(([label, count]) => `<div class="alert-item"><strong>${label}</strong><span class="badge ${count ? "pending" : "done"}">${count}</span></div>`).join("")}
        </div>
      </div>
    </div>`;
}

function renderCrm() {
  const rows = searchRows(state.crm, ["id", "name", "interest", "status", "category"]);
  const k = getCrmKpis();
  document.getElementById("crmPage").innerHTML = `
    ${sectionHead("CRM Dashboard", "Input lead, tracking pipeline, dan evaluasi bottleneck.")}
    <div class="kpi-grid">
      ${kpi("Total Leads", k.total)}
      ${kpi("Qualified Leads", k.qualified)}
      ${kpi("Booking Rate", pct(k.bookingRate))}
      ${kpi("Show Up Rate", pct(k.showUpRate))}
      ${kpi("Treatment Rate", pct(k.treatmentRate))}
      ${kpi("No Show Rate", pct(k.noShowRate))}
      ${kpi("Lost Rate", pct(k.lostRate))}
    </div>
    ${crmForm()}
    ${tableCard("Data Leads", "crm", rows, ["date","id","name","gender","address","wa","interest","status","category","followUp","note","revenue","bottleneck","ownerNote"])}
  `;
  bindForm("crmForm", addCrm);
}

function crmForm() {
  return formCard("crmForm", "Form Input Lead", "crm", [
    input("date", "Tanggal", "date"),
    input("id", "Lead ID", "text", nextId("LD", state.crm.length + 1001)),
    input("name", "Nama/Inisial Pasien"),
    select("gender", "Jenis Kelamin", ["Perempuan", "Laki-laki"]),
    input("address", "Alamat"),
    input("wa", "No WhatsApp"),
    select("interest", "Treatment Interest", splitSetting("treatments")),
    select("status", "Status Lead", ["Iklan", "Data Base", "Qualified", "Booking", "Show Up", "Treatment", "Lost"]),
    select("category", "Kategori Lead", ["Hot", "Warm", "Cold"]),
    input("followUp", "Jadwal Follow Up", "date"),
    input("revenue", "Revenue", "number"),
    textarea("note", "Catatan"),
    textarea("bottleneck", "Catatan Evaluasi/Bottleneck")
  ]);
}

function addCrm(data) {
  state.crm.unshift({ ...data, revenue: num(data.revenue), ownerNote: "" });
  saveState();
  renderAll();
  toast("Lead CRM berhasil ditambahkan.");
}

function renderMarketing() {
  const rows = searchRows(state.marketing, ["platform", "name", "objective"]);
  const k = getMarketingKpis();
  document.getElementById("marketingPage").innerHTML = `
    ${sectionHead("Marketing & Ads", "Laporan iklan harian, performa channel, dan efisiensi biaya.")}
    <div class="kpi-grid">
      ${kpi("Total Spend", money(k.spend))}
      ${kpi("Total Leads", k.leads)}
      ${kpi("Qualified Leads", k.qualified)}
      ${kpi("Impression", k.impressions.toLocaleString("id-ID"))}
      ${kpi("CTR", pct(k.ctr))}
      ${kpi("CPC", money(k.cpc))}
      ${kpi("CPL", money(k.cpl))}
      ${kpi("Chat Result", k.chat)}
    </div>
    ${marketingForm()}
    <div class="three-col">
      ${chartCard("Spend vs Revenue", "spendRevenueChart")}
      ${chartCard("Leads per Platform", "platformChart")}
      ${chartCard("CPL per Campaign", "cplChart")}
    </div>
    ${tableCard("Campaign Report", "marketing", rows, ["date","platform","name","objective","spend","impressions","clicks","leads","qualified","booking","showUp","treatment","revenue","ctr","cpc","cpl","roas","bottleneck","ownerNote"])}
  `;
  bindForm("marketingForm", addMarketing);
}

function marketingForm() {
  return formCard("marketingForm", "Form Input Laporan Iklan Harian", "marketing", [
    input("date", "Tanggal", "date"),
    select("platform", "Platform", splitSetting("platforms")),
    input("name", "Campaign Name"),
    select("objective", "Objective", ["Lead Generation", "Messages", "Traffic", "Search", "Awareness"]),
    input("spend", "Budget/Spend", "number"),
    input("impressions", "Impression", "number"),
    input("clicks", "Link Click", "number"),
    input("leads", "Leads", "number"),
    input("qualified", "Qualified Leads", "number"),
    input("booking", "Booking", "number"),
    input("showUp", "Show Up", "number"),
    input("treatment", "Treatment", "number"),
    input("revenue", "Revenue", "number"),
    textarea("bottleneck", "Catatan Evaluasi/Bottleneck")
  ]);
}

function addMarketing(data) {
  ["spend","impressions","clicks","leads","qualified","booking","showUp","treatment","revenue"].forEach(key => data[key] = num(data[key]));
  state.marketing.unshift({ ...data, ownerNote: "" });
  saveState();
  renderAll();
  toast("Laporan marketing berhasil ditambahkan.");
}

function renderContent() {
  const rows = searchRows(state.content, ["id", "title", "platform", "status"]);
  const k = getContentKpis();
  document.getElementById("contentPage").innerHTML = `
    ${sectionHead("Content Creator", "Kalender, pipeline, dan performa konten.")}
    <div class="kpi-grid">
      ${kpi("Total Konten Dibuat", k.total)}
      ${kpi("Total Konten Publish", k.posted)}
      ${kpi("Konten On-time", pct(k.onTime))}
      ${kpi("Engagement", k.engagement.toLocaleString("id-ID"))}
      ${kpi("Leads dari Konten", k.leads)}
      ${kpi("Top Content", k.top)}
    </div>
    ${contentForm()}
    <div class="table-card"><h3>Pipeline Konten</h3><div class="kanban-board">${kanban()}</div></div>
    ${tableCard("Content Calendar", "content", rows, ["date","id","title","platform","format","hook","cta","asset","publishDate","views","reach","likes","comments","shares","saves","leads","status","ownerNote"])}
  `;
  bindForm("contentForm", addContent);
}

function contentForm() {
  return formCard("contentForm", "Form Input Konten", "content", [
    input("date", "Tanggal", "date"),
    input("id", "Content ID", "text", nextId("CT", state.content.length + 205)),
    input("title", "Judul Konten"),
    select("platform", "Platform", splitSetting("platforms")),
    select("format", "Format Konten", ["Reels", "Short Video", "Carousel", "Story", "Live"]),
    input("hook", "Hook"),
    input("cta", "CTA"),
    input("asset", "Link Asset", "url"),
    input("publishDate", "Publish Date", "date"),
    input("views", "Views", "number"),
    input("reach", "Reach", "number"),
    input("likes", "Likes", "number"),
    input("comments", "Comments", "number"),
    input("shares", "Shares", "number"),
    input("saves", "Saves", "number"),
    input("leads", "Leads Generated", "number"),
    select("status", "Pipeline", ["Idea", "Script", "Design", "Editing", "Revision", "Approved", "Posted"])
  ]);
}

function addContent(data) {
  ["views","reach","likes","comments","shares","saves","leads"].forEach(key => data[key] = num(data[key]));
  state.content.unshift({ ...data, ownerNote: "" });
  saveState();
  renderAll();
  toast("Konten berhasil ditambahkan.");
}

function renderMedis() {
  const rows = searchRows(state.medis, ["patientId", "bookingId", "treatmentName", "doctor", "status"]);
  const k = getMedisKpis();
  document.getElementById("medisPage").innerHTML = `
    ${sectionHead("Tim Medis", "Laporan treatment, jadwal sederhana, aftercare, dan rekomendasi rebooking.")}
    <div class="kpi-grid">
      ${kpi("Total Pasien Datang", k.patients)}
      ${kpi("Treatment Done", k.done)}
      ${kpi("Treatment Populer", k.popular)}
      ${kpi("Rebooking Recommendation", k.rebooking)}
      ${kpi("Komplain/Keluhan", k.complaints)}
    </div>
    ${medisForm()}
    ${tableCard("Jadwal Treatment Sederhana", "medisSchedule", rows.filter(x => x.status !== "Done"), ["date","patientId","bookingId","treatmentName","doctor","therapist","room","status"])}
    ${tableCard("Treatment Report", "medis", rows, ["date","patientId","bookingId","treatmentName","doctor","therapist","room","status","products","aftercare","upsales","rebooking","complaint","bottleneck","ownerNote"])}
  `;
  bindForm("medisForm", addMedis);
}

function medisForm() {
  return formCard("medisForm", "Form Input Laporan Treatment", "medis", [
    input("date", "Tanggal", "date"),
    input("patientId", "Patient ID"),
    input("bookingId", "Booking ID"),
    select("treatmentName", "Treatment", splitSetting("treatments")),
    input("doctor", "Dokter"),
    input("therapist", "Terapis"),
    input("room", "Ruangan"),
    select("status", "Status Treatment", ["Done", "Pending", "No Show"]),
    input("products", "Produk/Alat Terpakai"),
    input("aftercare", "Catatan Aftercare"),
    input("upsales", "Up Sales", "number"),
    input("rebooking", "Rekomendasi Rebooking"),
    input("complaint", "Keluhan Pasien"),
    textarea("bottleneck", "Catatan Evaluasi/Bottleneck")
  ]);
}

function addMedis(data) {
  data.upsales = num(data.upsales);
  state.medis.unshift({ ...data, ownerNote: "" });
  saveState();
  renderAll();
  toast("Laporan medis berhasil ditambahkan.");
}

function renderInventory() {
  const rows = searchRows(state.inventory, ["id", "name", "category", "supplier"]);
  document.getElementById("inventoryPage").innerHTML = `
    ${sectionHead("Inventory", "Master barang, stock movement, alert stok, dan expired date.")}
    <div class="kpi-grid">
      ${kpi("Total Barang", state.inventory.length)}
      ${kpi("Stok Menipis", state.inventory.filter(x => stockStatus(x) === "Menipis").length)}
      ${kpi("Stok Habis", state.inventory.filter(x => stockStatus(x) === "Habis").length)}
      ${kpi("Expired < 120 Hari", state.inventory.filter(expiringSoon).length)}
    </div>
    ${inventoryForm()}
    ${tableCard("Alert Stok Menipis & Expired Date", "inventoryAlerts", rows.filter(x => stockStatus(x) !== "Aman" || expiringSoon(x)), ["id","name","category","finalStock","minimum","expired","stockStatus"])}
    ${tableCard("Current Stock", "inventory", rows, ["id","name","category","unit","supplier","initial","inQty","outQty","finalStock","minimum","expired","stockStatus","bottleneck","ownerNote"])}
  `;
  bindForm("inventoryForm", addInventory);
}

function inventoryForm() {
  return formCard("inventoryForm", "Master Barang / Stock In / Stock Out", "inventory", [
    input("id", "Product ID"),
    input("name", "Nama Barang"),
    input("category", "Kategori"),
    input("unit", "Satuan"),
    input("supplier", "Supplier"),
    input("initial", "Stok Awal", "number"),
    input("inQty", "Stock In", "number"),
    input("outQty", "Stock Out", "number"),
    input("minimum", "Minimum Stock", "number"),
    input("expired", "Expired Date", "date"),
    textarea("bottleneck", "Catatan Evaluasi/Bottleneck")
  ]);
}

function addInventory(data) {
  ["initial","inQty","outQty","minimum"].forEach(key => data[key] = num(data[key]));
  state.inventory.unshift({ ...data, ownerNote: "" });
  saveState();
  renderAll();
  toast("Data inventory berhasil ditambahkan.");
}

function renderReports() {
  document.getElementById("reportsPage").innerHTML = `
    ${sectionHead("Reports", "Rekap harian, mingguan, bulanan, export CSV, print/PDF, dan filter divisi.")}
    <div class="table-card">
      <div class="filter-row">
        <input type="date" id="reportStart">
        <input type="date" id="reportEnd">
        <select id="reportDivision">
          <option value="all">Semua Divisi</option>
          <option value="crm">CRM</option>
          <option value="marketing">Marketing</option>
          <option value="content">Content</option>
          <option value="medis">Medis</option>
          <option value="inventory">Inventory</option>
        </select>
        <button class="primary-button" data-export="all">Export CSV</button>
        <button class="ghost-button" id="printReport">Export PDF / Print</button>
      </div>
      <div class="three-col">
        ${kpi("Rekap Harian", money(getKpis().revenue / 7))}
        ${kpi("Rekap Mingguan", money(getKpis().revenue))}
        ${kpi("Rekap Bulanan", money(getKpis().revenue * 4.1))}
      </div>
    </div>
    ${tableCard("CRM Summary", "crm", state.crm, ["date","id","name","status","category","interest","revenue"])}
    ${tableCard("Marketing Summary", "marketing", state.marketing, ["date","platform","name","spend","leads","revenue","roas"])}
    ${tableCard("Inventory Summary", "inventory", state.inventory, ["id","name","finalStock","minimum","stockStatus","expired"])}
  `;
  bindExports();
  bindDeletes();
  bindOwnerNotes();
  document.getElementById("printReport").addEventListener("click", () => {
    toast("Membuka dialog print. Pilih Save as PDF untuk export PDF.");
    window.print();
  });
}

function renderSettings() {
  document.getElementById("settingsPage").innerHTML = `
    ${sectionHead("Settings", "Konfigurasi brand, divisi, PIC, treatment, source lead, dan platform.")}
    <div class="settings-card install-guide">
      <h2>Install Aplikasi</h2>
      <div class="three-col">
        <div>
          <strong>Android</strong>
          <p>Buka aplikasi via Chrome dari localhost atau HTTPS, lalu tap tombol install atau menu Add to Home screen.</p>
        </div>
        <div>
          <strong>iPhone</strong>
          <p>Buka via Safari, tap Share, lalu pilih Add to Home Screen.</p>
        </div>
        <div>
          <strong>Offline</strong>
          <p>Setelah dibuka via localhost/HTTPS, data demo dan shell aplikasi tersedia offline melalui service worker.</p>
        </div>
      </div>
    </div>
    <form class="settings-card form-card" id="settingsForm">
      <div class="form-grid">
        ${input("brandName", "Brand name", "text", state.settings.brandName)}
        ${input("primaryColor", "Warna utama", "color", state.settings.primaryColor)}
        ${textarea("divisions", "Nama divisi", state.settings.divisions)}
        ${textarea("pics", "PIC list", state.settings.pics)}
        ${textarea("treatments", "Treatment list", state.settings.treatments)}
        ${textarea("sources", "Source lead list", state.settings.sources)}
        ${textarea("platforms", "Platform list", state.settings.platforms)}
        ${input("backendUrl", "Google Apps Script Web App URL", "url", state.settings.backendUrl || "")}
        ${input("backendToken", "Google Apps Script Token", "password", state.settings.backendToken || "")}
      </div>
      <div class="form-actions">
        <button class="primary-button">Simpan Settings</button>
        <button class="ghost-button" type="button" id="resetDemo">Reset Dummy Data</button>
        <button class="ghost-button" type="button" id="syncSheets">Sync Google Sheets</button>
        <button class="ghost-button" type="button" id="fetchSheets">Ambil Data Sheets</button>
      </div>
    </form>
  `;
  document.getElementById("settingsForm").addEventListener("submit", event => {
    event.preventDefault();
    state.settings = Object.fromEntries(new FormData(event.currentTarget).entries());
    saveState();
    renderAll();
    toast("Settings berhasil disimpan.");
  });
  document.getElementById("resetDemo").addEventListener("click", () => {
    state = defaultState();
    currentRole = state.session.role;
    saveState();
    renderAll();
    toast("Dummy data berhasil direset.");
  });
  document.getElementById("syncSheets").addEventListener("click", syncToGoogleSheets);
  document.getElementById("fetchSheets").addEventListener("click", fetchFromGoogleSheets);
}

function formCard(id, title, section, fields) {
  const disabled = canEdit(section) ? "" : "disabled";
  const note = canEdit(section) ? "Role ini bisa input data." : `Mode lihat. Input hanya untuk role ${sectionLabel(section)}.`;
  return `<form class="form-card" id="${id}">
    <div class="section-head"><div><h2>${title}</h2><p>${note}</p></div></div>
    <fieldset ${disabled}>
      <div class="form-grid">${fields.join("")}</div>
      <div class="form-actions"><button class="primary-button">Tambah Data</button></div>
    </fieldset>
  </form>`;
}

function tableCard(title, dataset, rows, columns) {
  const dataRows = rows.map(row => normalizeRow(row));
  return `<div class="table-card">
    <div class="section-head">
      <div><h2>${title}</h2><p>${dataRows.length} data tampil</p></div>
      <button class="ghost-button" data-export="${dataset}">Export CSV</button>
    </div>
    ${dataRows.length ? `<div class="table-wrap"><table><thead><tr>${columns.map(col => `<th>${label(col)}</th>`).join("")}<th>Aksi</th></tr></thead><tbody>
      ${dataRows.map((row, index) => `<tr>${columns.map(col => tableCell(dataset, row, col, index)).join("")}<td><button class="ghost-button" data-delete="${dataset}" data-index="${row.__index}">Hapus</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">Belum ada data untuk filter ini.</div>`}
  </div>`;
}

function normalizeRow(row) {
  return {
    ...row,
    finalStock: row.initial !== undefined ? finalStock(row) : row.finalStock,
    stockStatus: row.initial !== undefined ? stockStatus(row) : row.stockStatus,
    ctr: row.impressions ? safeDiv(row.clicks, row.impressions) : row.ctr,
    cpc: row.clicks ? safeDiv(row.spend, row.clicks) : row.cpc,
    cpl: row.leads ? safeDiv(row.spend, row.leads) : row.cpl,
    roas: row.spend ? safeDiv(row.revenue, row.spend) : row.roas
  };
}

function tableCell(dataset, row, col) {
  const value = row[col] ?? "";
  if (col === "ownerNote") {
    if (canOwnerNote()) return `<td><input class="owner-note-input" data-note-dataset="${dataset}" data-index="${row.__index}" value="${escapeHtml(value)}" placeholder="Catatan Owner"></td>`;
    return `<td>${escapeHtml(value)}</td>`;
  }
  if (["status","category","stockStatus"].includes(col)) return `<td><span class="badge ${badgeClass(value)}">${escapeHtml(value)}</span></td>`;
  if (["revenue","spend","cpc","cpl","upsales"].includes(col)) return `<td>${money(num(value))}</td>`;
  if (["ctr"].includes(col)) return `<td>${pct(num(value))}</td>`;
  if (["roas"].includes(col)) return `<td>${num(value).toFixed(1)}x</td>`;
  return `<td>${escapeHtml(value)}</td>`;
}

function bindForm(id, handler) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (form.querySelector("fieldset").disabled) return;
    handler(Object.fromEntries(new FormData(form).entries()));
  });
  bindExports();
  bindDeletes();
  bindOwnerNotes();
}

function bindExports() {
  document.querySelectorAll("[data-export]").forEach(button => {
    button.addEventListener("click", () => exportCsv(button.dataset.export));
  });
}

function bindDeletes() {
  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      const dataset = button.dataset.delete;
      const index = Number(button.dataset.index);
      if (!canDelete(dataset)) return toast("Role ini tidak punya akses hapus data tersebut.");
      if (state[dataset]) state[dataset].splice(index, 1);
      saveState();
      renderAll();
      toast("Data berhasil dihapus.");
    });
  });
}

function bindOwnerNotes() {
  document.querySelectorAll("[data-note-dataset]").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      const dataset = inputEl.dataset.noteDataset;
      const index = Number(inputEl.dataset.index);
      if (state[dataset] && state[dataset][index]) {
        state[dataset][index].ownerNote = inputEl.value;
        saveState();
        toast("Catatan Owner berhasil disimpan.");
      }
    });
  });
}

function canDelete(dataset) {
  if (currentRole === "Owner") return true;
  return (dataset === "crm" && currentRole === "CRM") ||
    (dataset === "marketing" && currentRole === "Digital Marketing") ||
    (dataset === "content" && currentRole === "Design Content") ||
    (dataset === "medis" && currentRole === "Medis") ||
    (dataset === "inventory" && currentRole === "Inventory");
}

function renderCharts() {
  if (activePage === "owner") {
    makeChart("funnelChart", "bar", ["Lead", "Qualified", "Booking", "Show Up", "Treatment", "Rebooking", "Referral"], [getKpis().totalLeads, getKpis().qualified, getKpis().booking, getKpis().showUp, getKpis().treatment, 16, 9]);
    makeChart("revenueChart", "line", state.crm.map(x => x.date), state.crm.map(x => x.revenue), true);
    makeChart("sourceChart", "doughnut", splitSetting("sources"), [34, 27, 18, 11, 8]);
  }
  if (activePage === "marketing") {
    makeChart("spendRevenueChart", "bar", state.marketing.map(x => x.name), state.marketing.map(x => x.spend), false, state.marketing.map(x => x.revenue));
    makeChart("platformChart", "doughnut", groupLabels(state.marketing, "platform"), groupValues(state.marketing, "platform", "leads"));
    makeChart("cplChart", "bar", state.marketing.map(x => x.name), state.marketing.map(x => safeDiv(x.spend, x.leads)));
  }
}

function makeChart(id, type, labels, values, fill = false, secondValues = null) {
  const ctx = document.getElementById(id);
  if (!ctx || typeof Chart === "undefined") return;
  if (charts[id]) charts[id].destroy();
  const datasets = [{
    label: id.includes("revenue") ? "Revenue" : "Data",
    data: values,
    borderColor: "#F81894",
    backgroundColor: ["#F81894", "#ff77bd", "#d7a72f", "#8fd3ff", "#75d99d", "#ffc857", "#2f2930"],
    tension: .38,
    fill
  }];
  if (secondValues) datasets.push({ label: "Revenue", data: secondValues, backgroundColor: "#d7a72f", borderColor: "#d7a72f" });
  charts[id] = new Chart(ctx, { type, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } } });
}

function sectionHead(title, subtitle) {
  return `<div class="section-head"><div><h2>${title}</h2><p>${subtitle}</p></div></div>`;
}
function kpi(title, value) {
  return `<article class="kpi-card"><span>${title}</span><strong>${value}</strong><small>Near realtime</small></article>`;
}
function chartCard(title, id) {
  return `<div class="chart-card"><h3>${title}</h3><canvas id="${id}"></canvas></div>`;
}
function input(name, text, type = "text", value = "") {
  return `<label>${text}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === "date" ? "" : ""}></label>`;
}
function textarea(name, text, value = "") {
  return `<label>${text}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
}
function select(name, text, options) {
  return `<label>${text}<select name="${name}">${options.map(x => `<option>${escapeHtml(x)}</option>`).join("")}</select></label>`;
}

function getKpis() {
  const totalLeads = state.crm.length + sum(state.marketing, "leads") + sum(state.content, "leads");
  const qualified = state.crm.filter(x => ["Qualified", "Booking", "Show Up", "Treatment"].includes(x.status)).length + sum(state.marketing, "qualified");
  const booking = state.crm.filter(x => ["Booking", "Show Up", "Treatment"].includes(x.status)).length + sum(state.marketing, "booking");
  const showUp = state.crm.filter(x => ["Show Up", "Treatment"].includes(x.status)).length + sum(state.marketing, "showUp");
  const treatmentCount = state.crm.filter(x => x.status === "Treatment").length + sum(state.marketing, "treatment") + state.medis.filter(x => x.status === "Done").length;
  const revenue = sum(state.crm, "revenue") + sum(state.marketing, "revenue") + sum(state.medis, "upsales");
  return { totalLeads, qualified, booking, showUp, treatment: treatmentCount, revenue, adSpend: sum(state.marketing, "spend") };
}
function getCrmKpis() {
  const total = state.crm.length;
  const qualified = state.crm.filter(x => ["Qualified", "Booking", "Show Up", "Treatment"].includes(x.status)).length;
  const booking = state.crm.filter(x => ["Booking", "Show Up", "Treatment"].includes(x.status)).length;
  const showUp = state.crm.filter(x => ["Show Up", "Treatment"].includes(x.status)).length;
  const treatmentRate = safeDiv(state.crm.filter(x => x.status === "Treatment").length, total);
  return { total, qualified, bookingRate: safeDiv(booking, total), showUpRate: safeDiv(showUp, booking), treatmentRate, noShowRate: safeDiv(Math.max(0, booking - showUp), booking), lostRate: safeDiv(state.crm.filter(x => x.status === "Lost").length, total) };
}
function getMarketingKpis() {
  const spend = sum(state.marketing, "spend");
  const leads = sum(state.marketing, "leads");
  const impressions = sum(state.marketing, "impressions");
  const clicks = sum(state.marketing, "clicks");
  return { spend, leads, qualified: sum(state.marketing, "qualified"), impressions, ctr: safeDiv(clicks, impressions), cpc: safeDiv(spend, clicks), cpl: safeDiv(spend, leads), chat: clicks };
}
function getContentKpis() {
  const posted = state.content.filter(x => x.status === "Posted").length;
  return { total: state.content.length, posted, onTime: safeDiv(posted, state.content.length), engagement: sum(state.content, "likes") + sum(state.content, "comments") + sum(state.content, "shares") + sum(state.content, "saves"), leads: sum(state.content, "leads"), top: topBy(state.content, "views", "title") };
}
function getMedisKpis() {
  return { patients: state.medis.length, done: state.medis.filter(x => x.status === "Done").length, popular: topText(state.medis, "treatmentName"), rebooking: state.medis.filter(x => x.rebooking).length, complaints: state.medis.filter(x => x.complaint).length };
}

function kanban() {
  return ["Idea", "Script", "Design", "Editing", "Revision", "Approved", "Posted"].map(status => `
    <div class="kanban-card"><h3>${status}</h3>
      ${state.content.filter(x => x.status === status).map(x => `<div class="kanban-item"><strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.platform)} - ${escapeHtml(x.publishDate)}</small></div>`).join("") || "<small>Kosong</small>"}
    </div>`).join("");
}

function exportCsv(dataset) {
  const keys = dataset === "all" ? ["crm", "marketing", "content", "medis", "inventory"] : [dataset];
  const csv = keys.map(key => {
    const rows = (state[key] || []).map(normalizeRow);
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]).filter(x => x !== "__index");
    const lines = rows.map(row => headers.map(h => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(","));
    return [`# ${key}`, headers.join(","), ...lines].join("\n");
  }).filter(Boolean).join("\n\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `afk-dashboard-${dataset}-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("CSV berhasil diexport.");
}

async function syncToGoogleSheets() {
  const backend = getBackendConfig();
  if (!backend.url) {
    toast("Isi Google Apps Script Web App URL di Settings untuk mengaktifkan sync.");
    return;
  }

  try {
    const response = await fetch(backend.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "sync",
        token: backend.token,
        data: {
          crm: state.crm,
          marketing: state.marketing,
          content: state.content,
          medis: state.medis,
          inventory: state.inventory,
          settings: state.settings
        }
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Sync gagal.");
    toast("Data berhasil disinkronkan ke Google Sheets.");
  } catch (error) {
    toast(`Sync Google Sheets gagal: ${error.message}`);
  }
}

async function fetchFromGoogleSheets() {
  const backend = getBackendConfig();
  if (!backend.url) {
    toast("Isi Google Apps Script Web App URL di Settings untuk mengambil data.");
    return null;
  }

  try {
    const url = new URL(backend.url);
    url.searchParams.set("action", "fetch");
    if (backend.token) url.searchParams.set("token", backend.token);

    const response = await fetch(url.toString());
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Fetch gagal.");

    state = {
      ...state,
      ...result.data,
      session: state.session
    };
    saveState();
    renderAll();
    toast("Data berhasil diambil dari Google Sheets.");
    return result.data;
  } catch (error) {
    toast(`Ambil data Google Sheets gagal: ${error.message}`);
    return null;
  }
}

function getBackendConfig() {
  return {
    url: state.settings.backendUrl || CONFIG.GOOGLE_APPS_SCRIPT_URL,
    token: state.settings.backendToken || CONFIG.GOOGLE_APPS_SCRIPT_TOKEN
  };
}

function searchRows(rows, keys) {
  const query = els.globalSearch.value.trim().toLowerCase();
  return rows.map((row, index) => ({ ...row, __index: index })).filter(row => !query || keys.some(key => String(row[key] || "").toLowerCase().includes(query)));
}
function finalStock(row) { return num(row.initial) + num(row.inQty) - num(row.outQty); }
function stockStatus(row) { const final = finalStock(row); return final <= 0 ? "Habis" : final <= num(row.minimum) ? "Menipis" : "Aman"; }
function expiringSoon(row) { return row.expired && (new Date(row.expired) - new Date()) / 86400000 < 120; }
function splitSetting(key) { return String(state.settings[key] || "").split(",").map(x => x.trim()).filter(Boolean); }
function groupLabels(rows, key) { return [...new Set(rows.map(x => x[key]))]; }
function groupValues(rows, key, valueKey) { return groupLabels(rows, key).map(labelText => sum(rows.filter(x => x[key] === labelText), valueKey)); }
function topBy(rows, valueKey, labelKey) { return [...rows].sort((a, b) => num(b[valueKey]) - num(a[valueKey]))[0]?.[labelKey] || "-"; }
function topText(rows, key) {
  const counts = rows.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] || 0) + 1 }), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}
function safeDiv(a, b) { return b ? num(a) / num(b) : 0; }
function sum(rows, key) { return rows.reduce((total, row) => total + num(row[key]), 0); }
function num(value) { return Number(value) || 0; }
function pct(value) { return `${(num(value) * 100).toFixed(1)}%`; }
function money(value) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num(value)); }
function nextId(prefix, number) { return `${prefix}-${number}`; }
function label(key) {
  const labels = { date: "Tanggal", id: "ID", name: "Nama", wa: "WhatsApp", interest: "Treatment Interest", followUp: "Follow Up", bottleneck: "Evaluasi/Bottleneck", ownerNote: "Catatan Owner", spend: "Spend", impressions: "Impression", clicks: "Click", qualified: "Qualified", finalStock: "Stok Akhir", stockStatus: "Status Stok", inQty: "Stock In", outQty: "Stock Out", treatmentName: "Treatment", patientId: "Patient ID", bookingId: "Booking ID", publishDate: "Publish Date" };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, x => x.toUpperCase());
}
function badgeClass(value) { return String(value).toLowerCase().replace(/\s+/g, "-"); }
function sectionLabel(section) {
  return { crm: "CRM", marketing: "Digital Marketing", content: "Design Content", medis: "Medis", inventory: "Inventory" }[section] || section;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}
function applyBrandSettings() {
  document.documentElement.style.setProperty("--pink", state.settings.primaryColor || "#F81894");
}



