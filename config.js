/** Shared CoverCare Africa frontend configuration */
const CC_CONFIG = {
  SUPABASE_URL: "https://ifmpbrpcnnswqlwdytfy.supabase.co",
  SUPABASE_KEY: "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB",
  BACKEND_URL: "https://covercare-backend-production.up.railway.app",
  PAYSTACK_PUBLIC_KEY: "pk_test_866cbb9c537c7780cc05fa3d88c10fcd5e758d02",
  ADMIN_EMAILS: ["sdenyoh-abayateye@st.ug.edu.gh"],
  ARRIVE_BASE_URL: "https://covercare-africa.vercel.app/arrive",
  SUPPORTED_CURRENCIES: [
    { code: "GHS", symbol: "GH\u00a2", name: "Ghana Cedi", locale: "en-GH" },
    { code: "NGN", symbol: "\u20a6", name: "Nigerian Naira", locale: "en-NG" },
    { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
    { code: "UGX", symbol: "USh", name: "Ugandan Shilling", locale: "en-UG" },
    { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", locale: "en-TZ" },
    { code: "RWF", symbol: "FRw", name: "Rwandan Franc", locale: "en-RW" },
    { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc", locale: "fr-CM" },
    { code: "XOF", symbol: "CFA", name: "West African CFA Franc", locale: "fr-SN" },
    { code: "EGP", symbol: "E\u00a3", name: "Egyptian Pound", locale: "ar-EG" },
    { code: "MAD", symbol: "DH", name: "Moroccan Dirham", locale: "ar-MA" },
    { code: "DZD", symbol: "DA", name: "Algerian Dinar", locale: "ar-DZ" },
    { code: "TND", symbol: "DT", name: "Tunisian Dinar", locale: "ar-TN" },
    { code: "SDG", symbol: "SDG", name: "Sudanese Pound", locale: "ar-SD" },
    { code: "ETB", symbol: "Br", name: "Ethiopian Birr", locale: "am-ET" },
    { code: "GNF", symbol: "GFr", name: "Guinean Franc", locale: "fr-GN" },
    { code: "MZN", symbol: "MT", name: "Mozambican Metical", locale: "pt-MZ" },
    { code: "AOA", symbol: "Kz", name: "Angolan Kwanza", locale: "pt-AO" },
    { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha", locale: "en-ZM" },
    { code: "BWP", symbol: "P", name: "Botswana Pula", locale: "en-BW" },
    { code: "MWK", symbol: "MK", name: "Malawian Kwacha", locale: "en-MW" },
    { code: "NAD", symbol: "N$", name: "Namibian Dollar", locale: "en-NA" },
    { code: "ZWL", symbol: "ZW$", name: "Zimbabwean Dollar", locale: "en-ZW" },
    { code: "MUR", symbol: "Rs", name: "Mauritian Rupee", locale: "en-MU" },
    { code: "SCR", symbol: "SR", name: "Seychellois Rupee", locale: "en-SC" },
    { code: "CDF", symbol: "FC", name: "Congolese Franc", locale: "fr-CD" },
    { code: "BIF", symbol: "FBu", name: "Burundian Franc", locale: "fr-BI" },
    { code: "DJF", symbol: "FDj", name: "Djiboutian Franc", locale: "fr-DJ" },
    { code: "ERN", symbol: "Nkf", name: "Eritrean Nakfa", locale: "ti-ER" },
    { code: "SOS", symbol: "SOSh", name: "Somali Shilling", locale: "so-SO" },
    { code: "SLL", symbol: "Le", name: "Sierra Leonean Leone", locale: "en-SL" },
    { code: "LRD", symbol: "L$", name: "Liberian Dollar", locale: "en-LR" },
    { code: "GMD", symbol: "D", name: "Gambian Dalasi", locale: "en-GM" },
    { code: "MRU", symbol: "UM", name: "Mauritanian Ouguiya", locale: "ar-MR" },
    { code: "SSP", symbol: "SS\u00a3", name: "South Sudanese Pound", locale: "en-SS" },
    { code: "KMF", symbol: "CF", name: "Comorian Franc", locale: "fr-KM" },
    { code: "MGA", symbol: "Ar", name: "Malagasy Ariary", locale: "mg-MG" },
    { code: "CVE", symbol: "Esc", name: "Cape Verdean Escudo", locale: "pt-CV" },
    { code: "LSL", symbol: "L", name: "Lesotho Loti", locale: "en-LS" },
    { code: "SZL", symbol: "E", name: "Eswatini Lilangeni", locale: "en-SZ" },
    { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
    { code: "EUR", symbol: "\u20ac", name: "Euro", locale: "en-EU" },
    { code: "GBP", symbol: "\u00a3", name: "British Pound", locale: "en-GB" }
  ]
};

const AFRICAN_COUNTRIES = [
  {
    code: "GH", name: "Ghana", currency: "GHS", phonePrefix: "+233",
    cities: [
      { value: "accra", label: "Accra" }, { value: "kumasi", label: "Kumasi" },
      { value: "tamale", label: "Tamale" }, { value: "cape-coast", label: "Cape Coast" },
      { value: "takoradi", label: "Takoradi" }, { value: "tema", label: "Tema" },
      { value: "obuasi", label: "Obuasi" }, { value: "sunyani", label: "Sunyani" }
    ]
  },
  {
    code: "NG", name: "Nigeria", currency: "NGN", phonePrefix: "+234",
    cities: [
      { value: "lagos", label: "Lagos" }, { value: "abuja", label: "Abuja" },
      { value: "port-harcourt", label: "Port Harcourt" }, { value: "ibadan", label: "Ibadan" },
      { value: "kano", label: "Kano" }, { value: "enugu", label: "Enugu" },
      { value: "benin-city", label: "Benin City" }, { value: "kaduna", label: "Kaduna" }
    ]
  },
  {
    code: "KE", name: "Kenya", currency: "KES", phonePrefix: "+254",
    cities: [
      { value: "nairobi", label: "Nairobi" }, { value: "mombasa", label: "Mombasa" },
      { value: "kisumu", label: "Kisumu" }, { value: "nakuru", label: "Nakuru" },
      { value: "eldoret", label: "Eldoret" }, { value: "thika", label: "Thika" }
    ]
  },
  {
    code: "ZA", name: "South Africa", currency: "ZAR", phonePrefix: "+27",
    cities: [
      { value: "johannesburg", label: "Johannesburg" }, { value: "cape-town", label: "Cape Town" },
      { value: "durban", label: "Durban" }, { value: "pretoria", label: "Pretoria" },
      { value: "port-elizabeth", label: "Port Elizabeth" }, { value: "bloemfontein", label: "Bloemfontein" }
    ]
  },
  {
    code: "UG", name: "Uganda", currency: "UGX", phonePrefix: "+256",
    cities: [
      { value: "kampala", label: "Kampala" }, { value: "gulu", label: "Gulu" },
      { value: "mbarara", label: "Mbarara" }, { value: "jinja", label: "Jinja" },
      { value: "entebbe", label: "Entebbe" }
    ]
  },
  {
    code: "TZ", name: "Tanzania", currency: "TZS", phonePrefix: "+255",
    cities: [
      { value: "dar-es-salaam", label: "Dar es Salaam" }, { value: "mwanza", label: "Mwanza" },
      { value: "arusha", label: "Arusha" }, { value: "mbeya", label: "Mbeya" },
      { value: "zanzibar", label: "Zanzibar" }
    ]
  },
  {
    code: "RW", name: "Rwanda", currency: "RWF", phonePrefix: "+250",
    cities: [
      { value: "kigali", label: "Kigali" }, { value: "butare", label: "Butare" },
      { value: "gisenyi", label: "Gisenyi" }, { value: "ruhengeri", label: "Ruhengeri" }
    ]
  },
  {
    code: "ZM", name: "Zambia", currency: "ZMW", phonePrefix: "+260",
    cities: [
      { value: "lusaka", label: "Lusaka" }, { value: "ndola", label: "Ndola" },
      { value: "kitwe", label: "Kitwe" }, { value: "livingstone", label: "Livingstone" }
    ]
  },
  {
    code: "ET", name: "Ethiopia", currency: "ETB", phonePrefix: "+251",
    cities: [
      { value: "addis-ababa", label: "Addis Ababa" }, { value: "dire-dawa", label: "Dire Dawa" },
      { value: "mekelle", label: "Mekelle" }, { value: "gondar", label: "Gondar" }
    ]
  },
  {
    code: "CI", name: "Côte d'Ivoire", currency: "XOF", phonePrefix: "+225",
    cities: [
      { value: "abidjan", label: "Abidjan" }, { value: "yamoussoukro", label: "Yamoussoukro" },
      { value: "bouake", label: "Bouaké" }, { value: "daloa", label: "Daloa" }
    ]
  },
  {
    code: "SN", name: "Senegal", currency: "XOF", phonePrefix: "+221",
    cities: [
      { value: "dakar", label: "Dakar" }, { value: "thies", label: "Thiès" },
      { value: "saint-louis", label: "Saint-Louis" }, { value: "touba", label: "Touba" }
    ]
  },
  {
    code: "CM", name: "Cameroon", currency: "XAF", phonePrefix: "+237",
    cities: [
      { value: "douala", label: "Douala" }, { value: "yaounde", label: "Yaoundé" },
      { value: "bamenda", label: "Bamenda" }, { value: "garoua", label: "Garoua" }
    ]
  },
  {
    code: "BW", name: "Botswana", currency: "BWP", phonePrefix: "+267",
    cities: [
      { value: "gaborone", label: "Gaborone" }, { value: "francistown", label: "Francistown" },
      { value: "maun", label: "Maun" }, { value: "kasane", label: "Kasane" }
    ]
  },
  {
    code: "NA", name: "Namibia", currency: "NAD", phonePrefix: "+264",
    cities: [
      { value: "windhoek", label: "Windhoek" }, { value: "swakopmund", label: "Swakopmund" },
      { value: "walvis-bay", label: "Walvis Bay" }, { value: "oshakati", label: "Oshakati" }
    ]
  },
  {
    code: "MZ", name: "Mozambique", currency: "MZN", phonePrefix: "+258",
    cities: [
      { value: "maputo", label: "Maputo" }, { value: "beira", label: "Beira" },
      { value: "nampula", label: "Nampula" }, { value: "matola", label: "Matola" }
    ]
  },
  {
    code: "ZW", name: "Zimbabwe", currency: "ZWL", phonePrefix: "+263",
    cities: [
      { value: "harare", label: "Harare" }, { value: "bulawayo", label: "Bulawayo" },
      { value: "chitungwiza", label: "Chitungwiza" }, { value: "mutare", label: "Mutare" }
    ]
  },
  {
    code: "MW", name: "Malawi", currency: "MWK", phonePrefix: "+265",
    cities: [
      { value: "lilongwe", label: "Lilongwe" }, { value: "blantyre", label: "Blantyre" },
      { value: "mzuzu", label: "Mzuzu" }, { value: "zomba", label: "Zomba" }
    ]
  },
  {
    code: "AO", name: "Angola", currency: "AOA", phonePrefix: "+244",
    cities: [
      { value: "luanda", label: "Luanda" }, { value: "huambo", label: "Huambo" },
      { value: "benguela", label: "Benguela" }, { value: "lubango", label: "Lubango" }
    ]
  },
  {
    code: "MA", name: "Morocco", currency: "MAD", phonePrefix: "+212",
    cities: [
      { value: "casablanca", label: "Casablanca" }, { value: "rabat", label: "Rabat" },
      { value: "marrakech", label: "Marrakech" }, { value: "fes", label: "Fes" }
    ]
  },
  {
    code: "EG", name: "Egypt", currency: "EGP", phonePrefix: "+20",
    cities: [
      { value: "cairo", label: "Cairo" }, { value: "alexandria", label: "Alexandria" },
      { value: "giza", label: "Giza" }, { value: "luxor", label: "Luxor" }
    ]
  },
  {
    code: "DZ", name: "Algeria", currency: "DZD", phonePrefix: "+213",
    cities: [
      { value: "algiers", label: "Algiers" }, { value: "oran", label: "Oran" },
      { value: "constantine", label: "Constantine" }, { value: "annaba", label: "Annaba" }
    ]
  },
  {
    code: "TN", name: "Tunisia", currency: "TND", phonePrefix: "+216",
    cities: [
      { value: "tunis", label: "Tunis" }, { value: "sfax", label: "Sfax" },
      { value: "sousse", label: "Sousse" }, { value: "kairouan", label: "Kairouan" }
    ]
  },
  {
    code: "MG", name: "Madagascar", currency: "MGA", phonePrefix: "+261",
    cities: [
      { value: "antananarivo", label: "Antananarivo" }, { value: "toamasina", label: "Toamasina" },
      { value: "antsirabe", label: "Antsirabe" }, { value: "mahajanga", label: "Mahajanga" }
    ]
  },
  {
    code: "SL", name: "Sierra Leone", currency: "SLL", phonePrefix: "+232",
    cities: [
      { value: "freetown", label: "Freetown" }, { value: "bo", label: "Bo" },
      { value: "kenema", label: "Kenema" }, { value: "makeni", label: "Makeni" }
    ]
  },
  {
    code: "LR", name: "Liberia", currency: "LRD", phonePrefix: "+231",
    cities: [
      { value: "monrovia", label: "Monrovia" }, { value: "gbarnga", label: "Gbarnga" },
      { value: "buchanan", label: "Buchanan" }, { value: "zwedru", label: "Zwedru" }
    ]
  },
  {
    code: "GM", name: "Gambia", currency: "GMD", phonePrefix: "+220",
    cities: [
      { value: "banjul", label: "Banjul" }, { value: "serekunda", label: "Serekunda" },
      { value: "brikama", label: "Brikama" }, { value: "bakau", label: "Bakau" }
    ]
  },
  {
    code: "CD", name: "DR Congo", currency: "CDF", phonePrefix: "+243",
    cities: [
      { value: "kinshasa", label: "Kinshasa" }, { value: "lubumbashi", label: "Lubumbashi" },
      { value: "mbuji-mayi", label: "Mbuji-Mayi" }, { value: "goma", label: "Goma" }
    ]
  },
  {
    code: "MU", name: "Mauritius", currency: "MUR", phonePrefix: "+230",
    cities: [
      { value: "port-louis", label: "Port Louis" }, { value: "beau-bassin", label: "Beau Bassin" },
      { value: "curepipe", label: "Curepipe" }, { value: "quatre-bornes", label: "Quatre Bornes" }
    ]
  }
];

const BANKS_BY_COUNTRY = {
  GH: [
    "Access Bank Ghana",
    "ADB Bank",
    "Bank of Africa Ghana",
    "CalBank",
    "Consolidated Bank Ghana",
    "Ecobank Ghana",
    "FBNBank Ghana",
    "Fidelity Bank Ghana",
    "First Atlantic Bank",
    "GCB Bank",
    "GTBank Ghana",
    "National Investment Bank",
    "OmniBank",
    "Prudential Bank",
    "Republic Bank Ghana",
    "Societe Generale Ghana",
    "Stanbic Bank Ghana",
    "Standard Chartered Ghana",
    "Universal Merchant Bank",
    "Zenith Bank Ghana"
  ],
  NG: [
    "Access Bank Nigeria",
    "Citibank Nigeria",
    "Ecobank Nigeria",
    "Fidelity Bank Nigeria",
    "First City Monument Bank",
    "First Bank of Nigeria",
    "Globus Bank",
    "GTBank Nigeria",
    "Heritage Bank",
    "Keystone Bank",
    "Kuda Bank",
    "OPay",
    "PalmPay",
    "Polaris Bank",
    "Providus Bank",
    "Stanbic IBTC Bank",
    "Standard Chartered Nigeria",
    "Sterling Bank",
    "Suntrust Bank",
    "Titan Trust Bank",
    "Union Bank of Nigeria",
    "United Bank for Africa",
    "Unity Bank",
    "Wema Bank",
    "Zenith Bank Nigeria"
  ],
  KE: [
    "Absa Bank Kenya",
    "Bank of Africa Kenya",
    "Bank of Baroda Kenya",
    "Co-operative Bank of Kenya",
    "Citibank Kenya",
    "Diamond Trust Bank",
    "Ecobank Kenya",
    "Equity Bank",
    "Family Bank",
    "Guaranty Trust Bank Kenya",
    "HFC Bank",
    "I&M Bank",
    "KCB Bank",
    "National Bank of Kenya",
    "NCBA Bank",
    "Paramount Bank",
    "Prime Bank",
    "Sidian Bank",
    "Standard Chartered Kenya",
    "Stanbic Bank Kenya"
  ],
  ZA: [
    "Absa Bank",
    "African Bank",
    "Bidvest Bank",
    "Capitec Bank",
    "Discovery Bank",
    "First National Bank",
    "Investec Bank",
    "Nedbank",
    "Standard Bank South Africa",
    "TymeBank"
  ],
  UG: [
    "Absa Bank Uganda",
    "Bank of Africa Uganda",
    "Bank of Baroda Uganda",
    "Centenary Bank",
    "Citibank Uganda",
    "DFCU Bank",
    "Ecobank Uganda",
    "Equity Bank Uganda",
    "KCB Bank Uganda",
    "NCBA Bank Uganda",
    "PostBank Uganda",
    "Stanbic Bank Uganda",
    "Standard Chartered Uganda"
  ],
  TZ: [
    "Absa Bank Tanzania",
    "Bank of Africa Tanzania",
    "CRDB Bank",
    "DCB Commercial Bank",
    "Ecobank Tanzania",
    "Equity Bank Tanzania",
    "Exim Bank Tanzania",
    "KCB Bank Tanzania",
    "NCBA Bank Tanzania",
    "NMB Bank",
    "Stanbic Bank Tanzania",
    "Standard Chartered Tanzania",
    "TIB Corporate Bank"
  ],
  RW: [
    "Bank of Kigali",
    "Banque Populaire du Rwanda",
    "Cogebanque",
    "Ecobank Rwanda",
    "Equity Bank Rwanda",
    "GTBank Rwanda",
    "I&M Bank Rwanda",
    "KCB Bank Rwanda",
    "NCBA Bank Rwanda",
    "Stanbic Bank Rwanda",
    "Zigama Credit & Savings"
  ],
  ZM: [
    "Absa Bank Zambia",
    "Access Bank Zambia",
    "Atlétas Bank",
    "Bank of China Zambia",
    "Citibank Zambia",
    "Ecobank Zambia",
    "FNB Zambia",
    "Indo-Zambia Bank",
    "Investrust Bank",
    "Stanbic Bank Zambia",
    "Standard Chartered Zambia",
    "United Bank for Africa Zambia",
    "Zanaco"
  ],
  ET: [
    "Abyssinia Bank",
    "Awash Bank",
    "Bank of Abyssinia",
    "Birhan Bank",
    "Commercial Bank of Ethiopia",
    "Cooperative Bank of Oromia",
    "Dashen Bank",
    "Enat Bank",
    "Hibret Bank",
    "Nib International Bank",
    "Oromia Bank",
    "Wegagen Bank",
    "Zemen Bank"
  ],
  EG: [
    "Alexandria Bank",
    "Al Ahli Bank of Kuwait Egypt",
    "Arab African International Bank",
    "Arab Banking Corporation Egypt",
    "Banque du Caire",
    "Banque Misr",
    "CIB Egypt (CIB)",
    "Commercial International Bank",
    "Crédit Agricole Egypt",
    "Egyptian Gulf Bank",
    "HSBC Egypt",
    "National Bank of Egypt",
    "NBE Bank",
    "QNB Al Ahli",
    "SAIB Bank",
    "Société Arabe Internationale de Banque"
  ],
  MA: [
    "Al Barid Bank",
    "Attijariwafa Bank",
    "Bank of Africa Morocco",
    "Banque Centrale Populaire",
    "BMCI",
    "BMCE Bank",
    "CFG Bank",
    "CIH Bank",
    "Crédit du Maroc",
    "Société Générale Maroc"
  ],
  CI: [
    "Bank of Africa Côte d'Ivoire",
    "BNP Paribas Côte d'Ivoire",
    "Bridge Bank",
    "Coris Bank International",
    "Ecobank Côte d'Ivoire",
    "NSIA Banque",
    "Orange Bank Côte d'Ivoire",
    "Société Générale Côte d'Ivoire",
    "Standard Chartered Côte d'Ivoire",
    "Vérité Banque"
  ],
  SN: [
    "Bank of Africa Sénégal",
    "Banque Atlantique Sénégal",
    "Banque de Dakar",
    "CBAO",
    "Coris Bank International Sénégal",
    "Ecobank Sénégal",
    "NSIA Banque Sénégal",
    "Orange Bank Sénégal",
    "Société Générale Sénégal"
  ]
};

function getPreferredCurrency() {
  try {
    const saved = JSON.parse(localStorage.getItem("cc_currency") || "null");
    if (saved && CC_CONFIG.SUPPORTED_CURRENCIES.find(c => c.code === saved)) return saved;
  } catch (e) {}
  return "GHS";
}

function formatCurrency(amount) {
  const code = getPreferredCurrency();
  const cur = CC_CONFIG.SUPPORTED_CURRENCIES.find(c => c.code === code) || CC_CONFIG.SUPPORTED_CURRENCIES[0];
  return cur.symbol + " " + Number(amount).toLocaleString(cur.locale || "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadCSV(rows, headers, filename) {
  const csv = [headers.join(","), ...rows.map(r => r.map(cell => {
    const val = String(cell ?? "");
    return val.includes(",") || val.includes('"') || val.includes("\n") ? '"' + val.replace(/"/g, '""') + '"' : val;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getArriveUrl(shiftId, workerId, token) {
  const base = window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? `${window.location.origin}/arrive`
    : CC_CONFIG.ARRIVE_BASE_URL;
  const params = new URLSearchParams({
    shift_id: shiftId,
    worker_id: workerId,
    token
  });
  return `${base}?${params.toString()}`;
}

function getDashboardUrl(userType, email) {
  if (CC_CONFIG.ADMIN_EMAILS.includes(email)) return "admin.html";
  if (userType === "worker") return "dashboard-worker.html";
  if (userType === "client") return "dashboard-client.html";
  return "dashboard-facility.html";
}

let _ccToastTimeout = null;

function ccGetSupabaseClient() {
  if (window._supabase) return window._supabase;
  if (!window.__ccSupabaseClient && window.supabase) {
    window.__ccSupabaseClient = window.supabase.createClient(
      CC_CONFIG.SUPABASE_URL,
      CC_CONFIG.SUPABASE_KEY
    );
  }
  return window.__ccSupabaseClient || null;
}

function ccToast(message, type = "info", duration = 4000) {
  if (_ccToastTimeout) { clearTimeout(_ccToastTimeout); _ccToastTimeout = null; }
  const existing = document.getElementById("cc-toast");
  if (existing) existing.remove();

  const bg = type === "error" ? "#DC2626" : type === "success" ? "#059669" : "#111827";

  const el = document.createElement("div");
  el.id = "cc-toast";
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: bg, color: "#fff", padding: "12px 24px", borderRadius: "10px",
    fontSize: "14px", fontWeight: "500", zIndex: "999999",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: "440px", width: "90%",
    textAlign: "center", lineHeight: "1.5", fontFamily: "'Inter', system-ui, sans-serif",
    transition: "opacity 0.2s"
  });
  document.body.appendChild(el);
  _ccToastTimeout = setTimeout(() => { el.remove(); _ccToastTimeout = null; }, duration);
}

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const INACTIVITY_WARNING = 30 * 1000;
let _inactivityTimer = null;
let _warningTimer = null;
let _supabaseClient = null;

function ccInitInactivityLogout(supabaseClient) {
  _supabaseClient = supabaseClient;
  const events = ["mousemove", "click", "keydown", "scroll", "touchstart"];
  function resetTimer() {
    clearTimeout(_inactivityTimer);
    clearTimeout(_warningTimer);
    ccHideInactivityWarning();
    _inactivityTimer = setTimeout(ccShowInactivityWarning, INACTIVITY_TIMEOUT - INACTIVITY_WARNING);
    _warningTimer = setTimeout(ccForceLogout, INACTIVITY_TIMEOUT);
  }
  events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
  resetTimer();
  window.addEventListener("beforeunload", function() {
    events.forEach(ev => document.removeEventListener(ev, resetTimer));
  });
}

function ccShowInactivityWarning() {
  const existing = document.getElementById("cc-inactivity-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "cc-inactivity-overlay";
  overlay.innerHTML = `
    <div style="position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);">
      <div style="background:#fff; border:1px solid var(--border); border-radius:16px; padding:2.5rem; max-width:400px; width:90%; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.12);">
        <h3 style="color:var(--fg-primary); font-size:18px; margin-bottom:0.75rem;">Session expiring</h3>
        <p style="color:var(--fg-muted); font-size:14px; line-height:1.6; margin-bottom:1.5rem;">You've been inactive for a while. You'll be logged out in 30 seconds to protect your account.</p>
        <button onclick="ccStayLoggedIn()" style="background:#111827; color:var(--fg-primary); border:none; padding:11px 24px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;">Stay logged in</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function ccHideInactivityWarning() {
  const el = document.getElementById("cc-inactivity-overlay");
  if (el) el.remove();
}

function ccStayLoggedIn() {
  clearTimeout(_inactivityTimer);
  clearTimeout(_warningTimer);
  ccHideInactivityWarning();
  _inactivityTimer = setTimeout(ccShowInactivityWarning, INACTIVITY_TIMEOUT - INACTIVITY_WARNING);
  _warningTimer = setTimeout(ccForceLogout, INACTIVITY_TIMEOUT);
}

async function ccForceLogout() {
  ccHideInactivityWarning();
  try {
    if (_supabaseClient) await _supabaseClient.auth.signOut();
  } catch (e) {}
  window.location.href = "login.html?expired=1";
}

async function ccFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const start = Date.now();
  const logId = Math.random().toString(36).slice(2, 8);

  try {
    const client = ccGetSupabaseClient();
    if (client) {
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    }
  } catch (e) {}

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn(`[ccFetch/${logId}] TIMEOUT after ${Date.now() - start}ms: ${options.method || "GET"} ${path}`);
    controller.abort();
  }, 25000);

  try {
    console.log(`[ccFetch/${logId}] => ${options.method || "GET"} ${path}`, options.body || "");
    const response = await fetch(`${CC_CONFIG.BACKEND_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.message) {
      data.message = `Request failed (${response.status})`;
    }
    console.log(`[ccFetch/${logId}] <= ${response.status} in ${elapsed}ms`, data);
    return { response, data };
  } catch (err) {
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    if (err.name === "AbortError") {
      console.warn(`[ccFetch/${logId}] ABORTED after ${elapsed}ms: ${path}`);
      return { response: { ok: false, status: 0 }, data: { message: "Request timed out. Please check your internet connection and try again." } };
    }
    console.error(`[ccFetch/${logId}] ERROR after ${elapsed}ms:`, err);
    return { response: { ok: false, status: 0 }, data: { message: "Network error. Please check your internet connection." } };
  }
}

/* ── Currency combobox ──
   Portals dropdown to body to avoid stacking-context clipping.
   Usage: ccCurrencyCombobox("containerId", "GHS", (code) => { ... })
*/
function ccCurrencyCombobox(containerId, selectedCode, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="cc-combobox-wrap">
      <input class="glass-input cc-combobox-input" type="text" placeholder="Type currency code or name..." autocomplete="off" value="${escapeHtml(selectedCode || "")}" />
      <svg class="cc-combobox-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>`;

  const input = container.querySelector(".cc-combobox-input");
  let open = false, focusedIdx = -1, filtered = [...CC_CONFIG.SUPPORTED_CURRENCIES];
  let dropdownEl = null;

  function close() {
    open = false; focusedIdx = -1;
    if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
  }

  function openDropdown() {
    if (!input.value && !open) { open = true; render(); return; }
    if (!open) { open = true; render(); }
  }

  function position() {
    if (!dropdownEl || !open) return;
    const rect = input.getBoundingClientRect();
    dropdownEl.style.top = (rect.bottom + 4) + "px";
    dropdownEl.style.left = rect.left + "px";
    dropdownEl.style.width = rect.width + "px";
  }

  function render() {
    const val = input.value.toLowerCase();
    filtered = CC_CONFIG.SUPPORTED_CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(val) ||
      c.name.toLowerCase().includes(val)
    );

    if (!open || filtered.length === 0) {
      if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
      return;
    }

    if (!dropdownEl) {
      dropdownEl = document.createElement("div");
      dropdownEl.className = "cc-combobox-dropdown";
      document.body.appendChild(dropdownEl);
    }

    position();
    dropdownEl.innerHTML = filtered.map((c, i) =>
      `<div class="cc-combobox-item${i === focusedIdx ? " focused" : ""}" data-index="${i}">
        <span class="cc-combobox-code">${escapeHtml(c.code)}</span>
        <span class="cc-combobox-name">${escapeHtml(c.name)}</span>
      </div>`
    ).join("");
  }

  function select(idx) {
    if (idx < 0 || idx >= filtered.length) return;
    const c = filtered[idx];
    input.value = c.code;
    close();
    if (onChange) onChange(c.code);
  }

  input.addEventListener("input", () => { focusedIdx = -1; open = true; render(); });
  input.addEventListener("focus", () => { if (input.value) { open = true; render(); } });
  input.addEventListener("click", () => { open = true; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) { open = true; render(); } else { focusedIdx = Math.min(focusedIdx + 1, filtered.length - 1); render(); } }
    if (e.key === "ArrowUp") { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); render(); }
    if (e.key === "Enter") { e.preventDefault(); select(focusedIdx >= 0 ? focusedIdx : 0); }
    if (e.key === "Escape") { e.preventDefault(); close(); input.blur(); }
  });

  document.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);

  document.addEventListener("mousedown", function ccClick(e) {
    if (dropdownEl && !dropdownEl.contains(e.target) && !input.contains(e.target)) { close(); }
  });

  document.addEventListener("mousedown", function ccSelect(e) {
    if (!dropdownEl) return;
    const item = e.target.closest(".cc-combobox-item");
    if (item && dropdownEl.contains(item)) select(parseInt(item.dataset.index));
  });

  return { close, open: openDropdown };
}

function ccGetCurrencyComboboxValue(containerId) {
  const input = document.querySelector("#" + containerId + " .cc-combobox-input");
  return input ? input.value.trim().toUpperCase() : "";
}


