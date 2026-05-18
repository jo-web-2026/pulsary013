const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

const pinInput = $("#pinInput");
const messageInput = $("#messageInput");
const charCounter = $("#charCounter");
const encodeBtn = $("#encodeBtn");
const codeOutput = $("#codeOutput");
const signalState = $("#signalState");
const copyBtn = $("#copyBtn");
const shareBtn = $("#shareBtn");
const toast = $("#toast");
const decodeCode = $("#decodeCode");
const decodePin = $("#decodePin");
const decodeBtn = $("#decodeBtn");
const decodedMessage = $("#decodedMessage");
const historyList = $("#historyList");
const clearHistory = $("#clearHistory");

const SYMBOLS = ["⊕", "✦", "⊗", "✧", "◉", "⋄", "⊙", "☆", "◈"];
const CORE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STORE_KEY = "pulsary_signals_v2";
let currentCode = "";

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1700);
}

function getStore(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}

function setStore(data){
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

async function hashPin(pin){
  const enc = new TextEncoder().encode(pin + "::pulsary-demo-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomItem(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCode(){
  const core = Array.from({length:3}, () => randomItem(CORE)).join("");
  return `${randomItem(SYMBOLS)} ${randomItem(SYMBOLS)} ${core} ${randomItem(SYMBOLS)} ${randomItem(SYMBOLS)}`;
}

function normalizeCode(code){
  return code.trim().replace(/\s+/g, " ");
}

function updatePinDots(){
  const len = pinInput.value.length;
  $$(".pin-dots span").forEach((dot, i) => dot.classList.toggle("filled", i < len));
}

function updateHistory(){
  const store = getStore();
  const items = Object.values(store).sort((a,b) => b.createdAt - a.createdAt).slice(0, 12);
  if (!historyList) return;
  if (!items.length){
    historyList.innerHTML = `<div class="history-item"><div class="history-code">No local signals yet.</div><div class="history-time">Create one in Encode.</div></div>`;
    return;
  }
  historyList.innerHTML = items.map(item => `
    <button class="history-item" data-code="${item.code}">
      <div class="history-code">${item.code}</div>
      <div class="history-time">${new Date(item.createdAt).toLocaleString()}</div>
    </button>
  `).join("");
  historyList.querySelectorAll(".history-item").forEach(btn => {
    btn.addEventListener("click", () => {
      decodeCode.value = btn.dataset.code;
      showScreen("decode");
    });
  });
}

function showScreen(name){
  $$(".tab-screen").forEach(s => s.classList.toggle("active", s.dataset.screen === name));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.target === name));
  if (name === "decode") updateHistory();
  window.scrollTo({top:0, behavior:"smooth"});
}

pinInput.addEventListener("input", () => {
  pinInput.value = pinInput.value.replace(/\D/g, "").slice(0,4);
  updatePinDots();
});

document.querySelector(".pin-panel").addEventListener("click", () => pinInput.focus());

messageInput.addEventListener("input", () => {
  charCounter.textContent = `${messageInput.value.length} / 160`;
});

encodeBtn.addEventListener("click", async () => {
  const pin = pinInput.value.trim();
  const message = messageInput.value.trim();

  if (!/^\d{4}$/.test(pin)) {
    showToast("PIN musí mať presne 4 číslice.");
    pinInput.focus();
    return;
  }
  if (!message) {
    showToast("Napíš najprv správu.");
    messageInput.focus();
    return;
  }

  let code;
  const store = getStore();
  do { code = generateCode(); } while (store[code]);

  store[code] = {
    code,
    message,
    pinHash: await hashPin(pin),
    createdAt: Date.now()
  };
  setStore(store);

  currentCode = code;
  codeOutput.textContent = code;
  codeOutput.classList.remove("placeholder");
  signalState.textContent = "Signal ready";
  showToast("Signal encoded.");
  updateHistory();
});

copyBtn.addEventListener("click", async () => {
  if (!currentCode) return showToast("Najprv vytvor kód.");
  try {
    await navigator.clipboard.writeText(currentCode);
    showToast("Code copied.");
  } catch {
    showToast("Copy failed.");
  }
});

shareBtn.addEventListener("click", async () => {
  if (!currentCode) return showToast("Najprv vytvor kód.");
  const text = `PULSARY signal: ${currentCode}`;
  if (navigator.share) {
    try { await navigator.share({ title:"PULSARY", text }); }
    catch {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Share not available. Copied instead.");
    } catch {
      showToast("Share not available.");
    }
  }
});

decodeBtn.addEventListener("click", async () => {
  const code = normalizeCode(decodeCode.value);
  const pin = decodePin.value.trim();

  if (!code) return showToast("Vlož symbolický kód.");
  if (!/^\d{4}$/.test(pin)) return showToast("PIN musí mať presne 4 číslice.");

  const store = getStore();
  const item = store[code];
  if (!item) {
    decodedMessage.textContent = "Signal not found on this device.";
    return showToast("Kód nie je v lokálnej histórii.");
  }

  const pinHash = await hashPin(pin);
  if (pinHash !== item.pinHash) {
    decodedMessage.textContent = "Wrong PIN.";
    return showToast("Nesprávny PIN.");
  }

  decodedMessage.textContent = item.message;
  showToast("Message revealed.");
});

clearHistory.addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  updateHistory();
  decodedMessage.textContent = "Message will appear here.";
  showToast("Local history cleared.");
});

$$(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.target));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

codeOutput.classList.add("placeholder");
updatePinDots();
updateHistory();
