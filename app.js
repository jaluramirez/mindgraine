// ============================================================
// MindGraine — Mind your migraine
// Firebase Auth + Firestore powered
// ============================================================

import firebaseConfig from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const SYMPTOMS = ["Nausea", "Vomiting", "Dizziness", "Light sensitivity", "Sound sensitivity", "Confusion", "Tinnitus", "Eye pain"];
const TRIGGERS = ["Stress", "Poor sleep", "Skipped meal", "Weather change", "Screen time", "Bright light", "Certain food", "Alcohol", "Hormonal", "Dehydration", "Exercise", "Noise"];
const PAIN_COLORS = { mild: "#8FA888", moderate: "#D3A64F", severe: "#C1666B" };

let currentUser = null;
let entries = [];
let unsubscribeEntries = null;
let selectedPain = null;
let selectedSymptoms = new Set();
let selectedTriggers = new Set();
let trendChart = null;
let editingEntryId = null;
let chartView = "month";
let selectedSkyMonth = null; // "YYYY-MM", set once entries are known
const expandedMonths = new Set();
let entriesGroupsInitialized = false;

// ------------------------------------------------------------
// DOM refs
// ------------------------------------------------------------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authError = document.getElementById("auth-error");
const authSuccess = document.getElementById("auth-success");
const forgotPasswordBtn = document.getElementById("forgot-password-btn");
const googleSigninBtn = document.getElementById("google-signin-btn");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const switchToSignup = document.getElementById("switch-to-signup");
const switchToLogin = document.getElementById("switch-to-login");
const switchToSignupWrap = document.getElementById("switch-to-signup-wrap");
const switchToLoginWrap = document.getElementById("switch-to-login-wrap");

const userGreetingEl = document.getElementById("greeting-line");
const userEmailEl = document.getElementById("user-email");
const avatarInitialEl = document.getElementById("avatar-initial");
const userMenuBtn = document.getElementById("user-menu-btn");
const userMenuDropdown = document.getElementById("user-menu-dropdown");
const signoutBtn = document.getElementById("signout-btn");

// Witty, migraine-flavored greetings — one is picked at random each visit
const GREETINGS = [
  "let's outsmart that headache today",
  "your head called, let's see what it's been up to",
  "mission: track the migraine, one entry at a time",
  "no pounding today, we hope",
  "let's stay one step ahead of that migraine",
  "time to keep tabs on that head of yours",
  "here to make sense of the chaos upstairs",
  "let's turn head pain into a pattern we can beat",
];

function renderUserGreeting(user) {
  if (!user) return;
  const rawName = user.displayName || (user.email ? user.email.split("@")[0] : "there");
  const firstName = rawName.split(" ")[0];
  const displayFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const line = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  userGreetingEl.textContent = `Hey ${displayFirst} — ${line}`;
  userEmailEl.textContent = `Signed in as ${user.email || "—"}`;
  avatarInitialEl.textContent = displayFirst.charAt(0).toUpperCase();
}

userMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  userMenuDropdown.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!userMenuDropdown.classList.contains("hidden") && !userMenuDropdown.contains(e.target) && e.target !== userMenuBtn) {
    userMenuDropdown.classList.add("hidden");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") userMenuDropdown.classList.add("hidden");
});

const entryForm = document.getElementById("entry-form");
const painScaleEl = document.getElementById("pain-scale");
const symptomChipsEl = document.getElementById("symptom-chips");
const customSymptomsInput = document.getElementById("entry-custom-symptoms");
const triggerChipsEl = document.getElementById("trigger-chips");
const entriesListEl = document.getElementById("entries-list");
const skyGridEl = document.getElementById("sky-grid");
const skyMonthSelect = document.getElementById("sky-month-select");
const skyTitleEl = document.getElementById("sky-title");
const triggerListEl = document.getElementById("trigger-list");
const toastEl = document.getElementById("toast");
const logFormCard = document.getElementById("log-form-card");
const logFormTitle = document.getElementById("log-form-title");
const logFormSub = document.getElementById("log-form-sub");
const saveEntryBtn = document.getElementById("save-entry-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const chartToggle = document.getElementById("chart-toggle");
const chartSub = document.getElementById("chart-sub");
const editNameBtn = document.getElementById("edit-name-btn");
const editNameOverlay = document.getElementById("edit-name-overlay");
const editNameForm = document.getElementById("edit-name-form");
const editNameInput = document.getElementById("edit-name-input");
const editNameCancel = document.getElementById("edit-name-cancel");
const editNameError = document.getElementById("edit-name-error");
const jumpToMonthSelect = document.getElementById("jump-to-month");
const viewNavBtns = document.querySelectorAll(".view-nav-btn");
const dashboardView = document.getElementById("dashboard-view");
const tipsView = document.getElementById("tips-view");

viewNavBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    viewNavBtns.forEach(b => b.classList.toggle("active", b === btn));
    const showTips = btn.dataset.view === "tips";
    dashboardView.classList.toggle("hidden", showTips);
    tipsView.classList.toggle("hidden", !showTips);
  });
});

// ------------------------------------------------------------
// Toast
// ------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

// ------------------------------------------------------------
// Auth screen: login / signup toggle
// ------------------------------------------------------------
switchToSignup.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  switchToSignupWrap.classList.add("hidden");
  switchToLoginWrap.classList.remove("hidden");
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
});
switchToLogin.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  switchToLoginWrap.classList.add("hidden");
  switchToSignupWrap.classList.remove("hidden");
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
});

function showAuthError(err) {
  const friendly = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/api-key-not-valid": "Firebase isn't configured yet — add your project credentials to firebase-config.js.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in popup — allow popups for this site and try again.",
    "auth/operation-not-allowed": "This sign-in method isn't turned on yet in Firebase — enable it under Authentication → Sign-in method.",
    "auth/account-exists-with-different-credential": "An account with this email already exists using a different sign-in method.",
  };
  authSuccess.classList.add("hidden");
  authError.textContent = friendly[err.code] || err.message || "Something went wrong. Please try again.";
  authError.classList.remove("hidden");
}

function showAuthSuccess(msg) {
  authError.classList.add("hidden");
  authSuccess.textContent = msg;
  authSuccess.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAuthError(err);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    renderUserGreeting(cred.user);
  } catch (err) {
    showAuthError(err);
  }
});

signoutBtn.addEventListener("click", () => {
  userMenuDropdown.classList.add("hidden");
  signOut(auth);
});

forgotPasswordBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    showAuthError({ message: "Enter your email above first, then click 'Forgot password?'" });
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthSuccess(`Password reset email sent to ${email}. Check your inbox (and spam folder).`);
  } catch (err) {
    showAuthError(err);
  }
});

googleSigninBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    showAuthError(err);
  }
});

// ------------------------------------------------------------
// Auth state
// ------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    renderUserGreeting(user);
    subscribeToEntries();
  } else {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    if (unsubscribeEntries) { unsubscribeEntries(); unsubscribeEntries = null; }
    entries = [];
  }
});

// ------------------------------------------------------------
// Build the log form's interactive controls
// ------------------------------------------------------------
function buildPainScale() {
  painScaleEl.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pain-dot";
    btn.textContent = i;
    btn.addEventListener("click", () => {
      selectedPain = (selectedPain === i) ? null : i;
      renderPainScale();
    });
    painScaleEl.appendChild(btn);
  }
}
function renderPainScale() {
  [...painScaleEl.children].forEach((btn, idx) => {
    const val = idx + 1;
    const active = selectedPain === val;
    btn.classList.toggle("active", active);
    btn.style.background = active ? painColorFor(val) : "";
  });
}
function painColorFor(level) {
  if (level >= 8) return PAIN_COLORS.severe;
  if (level >= 4) return PAIN_COLORS.moderate;
  return PAIN_COLORS.mild;
}

// A simple, hand-drawn-style smiley (no emoji) whose face reflects pain severity.
function smileySvgFor(level) {
  let mouthPath = "M7,17 Q12,12.5 17,17"; // frown — used for both moderate and severe
  let eyes;

  if (level >= 8) {
    // Severe: frown + X eyes
    eyes = `
      <path d="M7,8 L10,11 M10,8 L7,11" stroke="#1B1826" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M14,8 L17,11 M17,8 L14,11" stroke="#1B1826" stroke-width="1.6" stroke-linecap="round"/>
    `;
  } else if (level >= 4) {
    // Moderate: frown + normal dot eyes
    eyes = `
      <circle cx="8.5" cy="9.5" r="1.4" fill="#1B1826"/>
      <circle cx="15.5" cy="9.5" r="1.4" fill="#1B1826"/>
    `;
  } else {
    // Mild: flat mouth + normal dot eyes
    mouthPath = "M7.5,15.5 L16.5,15.5";
    eyes = `
      <circle cx="8.5" cy="9.5" r="1.4" fill="#1B1826"/>
      <circle cx="15.5" cy="9.5" r="1.4" fill="#1B1826"/>
    `;
  }

  return `
    <svg class="day-smiley" viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${eyes}
      <path d="${mouthPath}" stroke="#1B1826" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

function buildChipGroup(container, options, selectedSet) {
  container.innerHTML = "";
  options.forEach(opt => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = opt;
    chip.addEventListener("click", () => {
      if (selectedSet.has(opt)) { selectedSet.delete(opt); chip.classList.remove("active"); }
      else { selectedSet.add(opt); chip.classList.add("active"); }
    });
    container.appendChild(chip);
  });
}

buildPainScale();
buildChipGroup(symptomChipsEl, SYMPTOMS, selectedSymptoms);
buildChipGroup(triggerChipsEl, TRIGGERS, selectedTriggers);

// default date = today
document.getElementById("entry-date").valueAsDate = new Date();

// ------------------------------------------------------------
// Save entry
// ------------------------------------------------------------
function parseCustomTags(str) {
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const date = document.getElementById("entry-date").value;
  if (!date) { showToast("Please pick a date."); return; }

  const customSymptoms = parseCustomTags(customSymptomsInput.value);
  const allSymptoms = [...selectedSymptoms];
  customSymptoms.forEach(s => {
    if (!allSymptoms.some(existing => existing.toLowerCase() === s.toLowerCase())) allSymptoms.push(s);
  });

  const payload = {
    date,
    startTime: document.getElementById("entry-start").value || null,
    duration: parseFloat(document.getElementById("entry-duration").value) || null,
    pain: selectedPain,
    symptoms: allSymptoms,
    triggers: [...selectedTriggers],
    sleepHours: parseFloat(document.getElementById("entry-sleep").value) || null,
    stress: document.getElementById("entry-stress").value ? parseInt(document.getElementById("entry-stress").value) : null,
    relief: document.getElementById("entry-relief").value.trim() || null,
    notes: document.getElementById("entry-notes").value.trim() || null,
    createdAt: serverTimestamp(),
  };

  try {
    if (editingEntryId) {
      // Updating an existing entry — don't touch createdAt
      delete payload.createdAt;
      await updateDoc(doc(db, "users", currentUser.uid, "entries", editingEntryId), payload);
      showToast("Entry updated.");
      cancelEdit();
    } else {
      const entriesRef = collection(db, "users", currentUser.uid, "entries");
      await addDoc(entriesRef, payload);
      showToast("Entry saved.");
      resetForm();
    }
  } catch (err) {
    console.error(err);
    showToast(editingEntryId ? "Couldn't update — check your Firebase setup." : "Couldn't save — check your Firebase setup.");
  }
});

function resetForm() {
  entryForm.reset();
  document.getElementById("entry-date").valueAsDate = new Date();
  selectedPain = null;
  selectedSymptoms.clear();
  selectedTriggers.clear();
  renderPainScale();
  [...symptomChipsEl.children].forEach(c => c.classList.remove("active"));
  [...triggerChipsEl.children].forEach(c => c.classList.remove("active"));
  customSymptomsInput.value = "";
}

function startEdit(entry) {
  editingEntryId = entry.id;

  document.getElementById("entry-date").value = entry.date || "";
  document.getElementById("entry-start").value = entry.startTime || "";
  document.getElementById("entry-duration").value = entry.duration ?? "";
  document.getElementById("entry-sleep").value = entry.sleepHours ?? "";
  document.getElementById("entry-stress").value = entry.stress ?? "";
  document.getElementById("entry-relief").value = entry.relief || "";
  document.getElementById("entry-notes").value = entry.notes || "";

  selectedPain = entry.pain ?? null;
  renderPainScale();

  const savedSymptoms = entry.symptoms || [];
  selectedSymptoms = new Set(savedSymptoms.filter(s => SYMPTOMS.includes(s)));
  const customSaved = savedSymptoms.filter(s => !SYMPTOMS.includes(s));
  customSymptomsInput.value = customSaved.join(", ");

  selectedTriggers = new Set(entry.triggers || []);
  [...symptomChipsEl.children].forEach(chip => chip.classList.toggle("active", selectedSymptoms.has(chip.textContent)));
  [...triggerChipsEl.children].forEach(chip => chip.classList.toggle("active", selectedTriggers.has(chip.textContent)));

  logFormTitle.textContent = "Edit migraine entry";
  logFormSub.textContent = `Editing ${entry.date} — change what you need, then update`;
  saveEntryBtn.textContent = "Update entry";
  cancelEditBtn.classList.remove("hidden");

  logFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  editingEntryId = null;
  resetForm();
  logFormTitle.textContent = "Log a migraine";
  logFormSub.textContent = "Fill in what you can — nothing here is required except the date";
  saveEntryBtn.textContent = "Save entry";
  cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", cancelEdit);

chartToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-btn");
  if (!btn) return;
  chartView = btn.dataset.view;
  [...chartToggle.children].forEach(b => b.classList.toggle("active", b === btn));
  renderTrendChart();
});

// ------------------------------------------------------------
// Edit name modal
// ------------------------------------------------------------
editNameBtn.addEventListener("click", () => {
  if (!currentUser) return;
  userMenuDropdown.classList.add("hidden");
  editNameError.classList.add("hidden");
  editNameInput.value = currentUser.displayName || "";
  editNameOverlay.classList.remove("hidden");
  editNameInput.focus();
});

editNameCancel.addEventListener("click", () => editNameOverlay.classList.add("hidden"));

editNameOverlay.addEventListener("click", (e) => {
  if (e.target === editNameOverlay) editNameOverlay.classList.add("hidden");
});

editNameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const newName = editNameInput.value.trim();
  if (!newName) return;
  try {
    await updateProfile(currentUser, { displayName: newName });
    renderUserGreeting(currentUser);
    editNameOverlay.classList.add("hidden");
    showToast("Name updated.");
  } catch (err) {
    console.error(err);
    editNameError.textContent = "Couldn't update your name. Please try again.";
    editNameError.classList.remove("hidden");
  }
});

// ------------------------------------------------------------
// Subscribe to entries (live updates)
// ------------------------------------------------------------
function subscribeToEntries() {
  const entriesRef = collection(db, "users", currentUser.uid, "entries");
  const q = query(entriesRef, orderBy("date", "desc"));
  unsubscribeEntries = onSnapshot(q, (snap) => {
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => {
    console.error(err);
    entriesListEl.innerHTML = `<div class="empty-state"><div class="em-title">Couldn't load entries</div><div class="em-sub">Check your Firebase config and Firestore rules.</div></div>`;
  });
}

async function deleteEntry(id) {
  if (!currentUser) return;
  if (!confirm("Delete this entry?")) return;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "entries", id));
    showToast("Entry deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete entry.");
  }
}

// ------------------------------------------------------------
// Render: everything downstream of `entries`
// ------------------------------------------------------------
function renderAll() {
  renderStats();
  renderSkyDiary();
  renderTriggers();
  renderTrendChart();
  renderEntriesList();
}

function renderStats() {
  const total = entries.length;
  document.getElementById("stat-total").textContent = total;

  const painVals = entries.map(e => e.pain).filter(p => typeof p === "number");
  const avgPain = painVals.length ? (painVals.reduce((a, b) => a + b, 0) / painVals.length).toFixed(1) : "—";
  document.getElementById("stat-avg-pain").textContent = avgPain;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = entries.filter(e => new Date(e.date) >= thirtyDaysAgo).length;
  document.getElementById("stat-this-month").textContent = recentCount;

  const triggerCounts = {};
  entries.forEach(e => (e.triggers || []).forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; }));
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("stat-top-trigger").textContent = topTrigger ? topTrigger[0] : "—";
}

skyMonthSelect.addEventListener("change", () => {
  selectedSkyMonth = skyMonthSelect.value;
  renderSkyDiary();
});

function monthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function populateSkyMonthSelect() {
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Collect every month that has at least one entry, plus the current month
  const monthSet = new Set([todayKey]);
  entries.forEach(e => {
    if (!e.date) return;
    monthSet.add(e.date.slice(0, 7));
  });

  const months = [...monthSet].sort().reverse(); // newest first

  // Preserve the user's current selection if it still exists; otherwise default to the newest month
  if (!selectedSkyMonth || !months.includes(selectedSkyMonth)) {
    selectedSkyMonth = months[0];
  }

  skyMonthSelect.innerHTML = months.map(key =>
    `<option value="${key}" ${key === selectedSkyMonth ? "selected" : ""}>${monthLabel(key)}${key === todayKey ? " (this month)" : ""}</option>`
  ).join("");
}

function renderSkyDiary() {
  populateSkyMonthSelect();
  skyGridEl.innerHTML = "";

  const [year, month] = selectedSkyMonth.split("-").map(Number);
  skyTitleEl.textContent = monthLabel(selectedSkyMonth);

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay(); // 0 = Sunday

  for (let i = 0; i < leadingBlanks; i++) {
    const blank = document.createElement("div");
    blank.className = "sky-day sky-day-blank";
    skyGridEl.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEntries = entries.filter(e => e.date === dateStr);

    const dot = document.createElement("div");
    dot.className = "sky-day";
    dot.dataset.has = dayEntries.length ? "1" : "0";

    if (dayEntries.length) {
      const maxPain = Math.max(...dayEntries.map(e => e.pain || 0));
      const color = painColorFor(maxPain || 1);
      dot.style.background = color;
      dot.style.boxShadow = `0 0 ${6 + maxPain * 1.5}px ${color}`;
      dot.insertAdjacentHTML("afterbegin", smileySvgFor(maxPain || 1));
      const tip = document.createElement("span");
      tip.className = "tip";
      tip.textContent = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · pain ${maxPain || "—"}`;
      dot.appendChild(tip);
    } else {
      const numEl = document.createElement("span");
      numEl.className = "day-num";
      numEl.textContent = day;
      dot.appendChild(numEl);

      dot.style.background = "#2E2A40";
      const tip = document.createElement("span");
      tip.className = "tip";
      tip.textContent = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      dot.appendChild(tip);
    }
    skyGridEl.appendChild(dot);
  }
}

function renderTriggers() {
  const triggerCounts = {};
  entries.forEach(e => (e.triggers || []).forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; }));
  const sorted = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]);

  if (!sorted.length) {
    triggerListEl.innerHTML = `<div class="empty-state"><div class="em-sub">Log a few episodes to see patterns here.</div></div>`;
    return;
  }

  const max = sorted[0][1];
  triggerListEl.innerHTML = "";
  sorted.slice(0, 8).forEach(([name, count]) => {
    const row = document.createElement("div");
    row.className = "trigger-row";
    row.innerHTML = `
      <span class="trigger-name">${name}</span>
      <span class="trigger-bar-track"><span class="trigger-bar-fill" style="width:${(count / max) * 100}%"></span></span>
      <span class="trigger-count">${count}</span>
    `;
    triggerListEl.appendChild(row);
  });
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderTrendChart() {
  const ctx = document.getElementById("trend-chart");

  // Count episodes per month or per year, regardless of whether pain was recorded
  const counts = {};
  entries.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date + "T00:00:00");
    const key = chartView === "year"
      ? String(d.getFullYear())
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const sortedKeys = Object.keys(counts).sort();
  const labels = sortedKeys.map(key => {
    if (chartView === "year") return key;
    const [year, month] = key.split("-");
    return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
  });
  const data = sortedKeys.map(k => counts[k]);
  const maxCount = data.length ? Math.max(...data) : 1;

  chartSub.textContent = chartView === "year" ? "Episodes per year" : "Episodes per month";

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "#9B8AC4",
        hoverBackgroundColor: "#B6A6DD",
        borderRadius: 4,
        maxBarThickness: 40,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0,
          max: Math.max(4, maxCount + 1),
          ticks: { color: "#A9A2C2", stepSize: 1, font: { family: "IBM Plex Mono", size: 11 } },
          grid: { color: "#37324A" }
        },
        x: {
          ticks: { color: "#A9A2C2", font: { family: "IBM Plex Mono", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false }
        }
      }
    }
  });
}

function renderEntriesList() {
  if (!entries.length) {
    jumpToMonthSelect.innerHTML = `<option value="">Jump to month…</option>`;
    entriesListEl.innerHTML = `<div class="empty-state"><div class="em-title">Nothing logged yet</div><div class="em-sub">Your first entry will show up here.</div></div>`;
    return;
  }

  // Group entries by month, newest first (entries already sorted desc by date from the query)
  const groups = new Map(); // "YYYY-MM" -> [entries]
  entries.forEach(e => {
    if (!e.date) return;
    const key = e.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  const monthKeys = [...groups.keys()].sort().reverse();

  // Default: only the most recent month starts expanded, the first time we ever render
  if (!entriesGroupsInitialized && monthKeys.length) {
    expandedMonths.add(monthKeys[0]);
    entriesGroupsInitialized = true;
  }

  // Populate "jump to month" dropdown
  jumpToMonthSelect.innerHTML = `<option value="">Jump to month…</option>` +
    monthKeys.map(key => `<option value="${key}">${monthLabel(key)} (${groups.get(key).length})</option>`).join("");

  entriesListEl.innerHTML = "";
  monthKeys.forEach(key => {
    const monthEntries = groups.get(key);
    const isExpanded = expandedMonths.has(key);

    const groupEl = document.createElement("div");
    groupEl.className = `month-group${isExpanded ? " expanded" : ""}`;
    groupEl.id = `month-group-${key}`;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "month-group-header";
    header.innerHTML = `
      <span class="month-group-name">${monthLabel(key)}</span>
      <span class="month-group-meta">
        <span class="month-group-count">${monthEntries.length} ${monthEntries.length === 1 ? "entry" : "entries"}</span>
        <span class="month-group-chevron"></span>
      </span>
    `;
    header.addEventListener("click", () => {
      if (expandedMonths.has(key)) expandedMonths.delete(key);
      else expandedMonths.add(key);
      renderEntriesList();
    });
    groupEl.appendChild(header);

    const body = document.createElement("div");
    body.className = "month-group-body";
    if (isExpanded) {
      monthEntries.forEach(e => body.appendChild(buildEntryRow(e)));
    }
    groupEl.appendChild(body);

    entriesListEl.appendChild(groupEl);
  });
}

jumpToMonthSelect.addEventListener("change", () => {
  const key = jumpToMonthSelect.value;
  if (!key) return;
  expandedMonths.add(key);
  renderEntriesList();
  requestAnimationFrame(() => {
    document.getElementById(`month-group-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  jumpToMonthSelect.value = "";
});

function buildEntryRow(e) {
  const row = document.createElement("div");
  row.className = "entry-row";
  const painColor = typeof e.pain === "number" ? painColorFor(e.pain) : "#4A4560";
  const dateLabel = new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const metaParts = [];
  if (e.duration) metaParts.push(`${e.duration}h duration`);
  if (e.sleepHours != null) metaParts.push(`${e.sleepHours}h sleep`);
  if (e.stress) metaParts.push(`stress ${e.stress}/5`);

  const tags = [...(e.symptoms || []), ...(e.triggers || [])];

  row.innerHTML = `
    <div class="entry-pain" style="background:${painColor}">${e.pain ?? "—"}</div>
    <div class="entry-body">
      <div class="entry-date">${dateLabel}</div>
      <div class="entry-meta">${metaParts.join(" · ") || "&nbsp;"}</div>
      ${tags.length ? `<div class="entry-triggers">${tags.map(t => `<span class="entry-tag">${t}</span>`).join("")}</div>` : ""}
      ${e.notes ? `<div class="entry-meta" style="margin-top:6px;">${escapeHtml(e.notes)}</div>` : ""}
    </div>
    <div class="entry-actions">
      <button class="entry-edit" title="Edit entry" data-id="${e.id}">✎</button>
      <button class="entry-delete" title="Delete entry" data-id="${e.id}">×</button>
    </div>
  `;
  row.querySelector(".entry-edit").addEventListener("click", () => startEdit(e));
  row.querySelector(".entry-delete").addEventListener("click", () => deleteEntry(e.id));
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}