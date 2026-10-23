/**
 * OmniClock - Multi-Timezone & Granular Time Engine
 * Full independent control for Hours, Minutes, and Seconds
 */

// --- Global State ---
const state = {
  isRunning: true,
  is24Hour: true,
  handMovement: 'smooth', // 'smooth' or 'step'
  soundEnabled: false,
  displayMode: 'both', // 'both', 'digital', 'analog'
  theme: 'dark',
  filterQuery: '',

  // Global Granular Offsets (in respective units)
  globalOffsetHours: 0,
  globalOffsetMinutes: 0,
  globalOffsetSeconds: 0,

  // Reference for time tracking when paused/running
  lastTimestamp: performance.now(),
  simulatedTimeMs: Date.now(),

  // Active Clocks List
  clocks: [],

  // Currently inspected clock for modal
  editingClockId: null
};

// Comprehensive Global Cities Directory
const WORLD_CITIES = [
  { city: 'Local Time (System)', country: 'Your Location', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, isHome: true },
  { city: 'New York', country: 'United States', timeZone: 'America/New_York' },
  { city: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
  { city: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
  { city: 'Paris', country: 'France', timeZone: 'Europe/Paris' },
  { city: 'Dubai', country: 'United Arab Emirates', timeZone: 'Asia/Dubai' },
  { city: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore' },
  { city: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
  { city: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles' },
  { city: 'Mumbai', country: 'India', timeZone: 'Asia/Kolkata' },
  { city: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin' },
  { city: 'Hong Kong', country: 'China', timeZone: 'Asia/Hong_Kong' },
  { city: 'Zurich', country: 'Switzerland', timeZone: 'Europe/Zurich' },
  { city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto' },
  { city: 'Seoul', country: 'South Korea', timeZone: 'Asia/Seoul' },
  { city: 'São Paulo', country: 'Brazil', timeZone: 'America/Sao_Paulo' },
  { city: 'Cairo', country: 'Egypt', timeZone: 'Africa/Cairo' },
  { city: 'Bangkok', country: 'Thailand', timeZone: 'Asia/Bangkok' },
  { city: 'Auckland', country: 'New Zealand', timeZone: 'Pacific/Auckland' },
  { city: 'UTC / GMT', country: 'Universal Time', timeZone: 'UTC' }
];

// Presets
const PRESETS = {
  financial: ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Europe/Zurich'],
  tech: ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore'],
  global: ['Pacific/Auckland', 'Asia/Tokyo', 'Asia/Dubai', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles'],
  default: [
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'Asia/Dubai',
    'Australia/Sydney'
  ]
};

// Web Audio API Tick Synthesizer
let audioCtx = null;
function playTickSound() {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);
  } catch (e) {
    // AudioContext blocked until interaction
  }
}

// --- Initialization ---
function init() {
  loadSavedState();
  setupEventListeners();
  renderClocksGrid();
  updateGlobalTweakDisplays();
  renderPlanner();
  startClockEngine();
}

// Load saved settings or fall back to defaults
function loadSavedState() {
  const saved = localStorage.getItem('omniclock_state_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.is24Hour = parsed.is24Hour ?? true;
      state.handMovement = parsed.handMovement ?? 'smooth';
      state.displayMode = parsed.displayMode ?? 'both';
      state.theme = parsed.theme ?? 'dark';
      state.globalOffsetHours = parsed.globalOffsetHours ?? 0;
      state.globalOffsetMinutes = parsed.globalOffsetMinutes ?? 0;
      state.globalOffsetSeconds = parsed.globalOffsetSeconds ?? 0;

      if (parsed.clocks && parsed.clocks.length > 0) {
        state.clocks = parsed.clocks;
      } else {
        loadDefaultClocks();
      }
    } catch (e) {
      loadDefaultClocks();
    }
  } else {
    loadDefaultClocks();
  }

  // Apply Theme
  document.body.setAttribute('data-theme', state.theme);
  updateThemeIcon();
  updateFormatBadge();
  updateHandChips();
  updateViewChips();
}

function loadDefaultClocks() {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  state.clocks = [
    {
      id: 'clock_local',
      city: 'Local Time',
      country: 'Your System',
      timeZone: localTz,
      isHome: true,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    },
    {
      id: 'clock_ny',
      city: 'New York',
      country: 'United States',
      timeZone: 'America/New_York',
      isHome: false,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    },
    {
      id: 'clock_london',
      city: 'London',
      country: 'United Kingdom',
      timeZone: 'Europe/London',
      isHome: false,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    },
    {
      id: 'clock_tokyo',
      city: 'Tokyo',
      country: 'Japan',
      timeZone: 'Asia/Tokyo',
      isHome: false,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    },
    {
      id: 'clock_dubai',
      city: 'Dubai',
      country: 'United Arab Emirates',
      timeZone: 'Asia/Dubai',
      isHome: false,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    },
    {
      id: 'clock_sydney',
      city: 'Sydney',
      country: 'Australia',
      timeZone: 'Australia/Sydney',
      isHome: false,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    }
  ];
}

function saveState() {
  try {
    const dataToSave = {
      is24Hour: state.is24Hour,
      handMovement: state.handMovement,
      displayMode: state.displayMode,
      theme: state.theme,
      globalOffsetHours: state.globalOffsetHours,
      globalOffsetMinutes: state.globalOffsetMinutes,
      globalOffsetSeconds: state.globalOffsetSeconds,
      clocks: state.clocks
    };
    localStorage.setItem('omniclock_state_v2', JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

// --- Time Calculations & Granular Offset Math ---

/**
 * Computes exact Date object for a given clock card accounting for:
 * 1. Live base simulated time
 * 2. Individual pause state and pause duration
 * 3. Master Global offset (Hours, Minutes, Seconds separately)
 * 4. Individual Clock offset (Hours, Minutes, Seconds separately)
 * 5. Specific IANA timezone
 */
function getClockTime(clock) {
  let nowMs;
  if (clock.isPaused) {
    nowMs = clock.pausedAtMs || state.simulatedTimeMs;
  } else {
    const pausedDuration = clock.totalPausedDurationMs || 0;
    nowMs = (state.isRunning ? state.simulatedTimeMs : (state.pausedAtMs || state.simulatedTimeMs)) - pausedDuration;
  }

  // Calculate total offset in milliseconds:
  // Global partial offsets + Individual partial offsets
  const totalOffsetHours = (state.globalOffsetHours || 0) + (clock.offsetHours || 0);
  const totalOffsetMinutes = (state.globalOffsetMinutes || 0) + (clock.offsetMinutes || 0);
  const totalOffsetSeconds = (state.globalOffsetSeconds || 0) + (clock.offsetSeconds || 0);

  const totalOffsetMs =
    totalOffsetHours * 3600000 +
    totalOffsetMinutes * 60000 +
    totalOffsetSeconds * 1000;

  const targetDate = new Date(nowMs + totalOffsetMs);

  // Convert to specific Timezone parts using Intl.DateTimeFormat
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: clock.timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });

    const parts = formatter.formatToParts(targetDate);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const year = parseInt(map.year, 10);
    const month = parseInt(map.month, 10) - 1;
    const day = parseInt(map.day, 10);
    let hour = parseInt(map.hour, 10);
    // Note: in 24h format, hour can sometimes be 24 in some browsers
    if (hour === 24) hour = 0;
    const minute = parseInt(map.minute, 10);
    const second = parseInt(map.second, 10);
    const millisecond = parseInt(map.fractionalSecond || 0, 10);

    return {
      date: new Date(year, month, day, hour, minute, second, millisecond),
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      rawTargetDate: targetDate
    };
  } catch (err) {
    // Fallback if timezone not supported
    return {
      date: targetDate,
      year: targetDate.getFullYear(),
      month: targetDate.getMonth(),
      day: targetDate.getDate(),
      hour: targetDate.getHours(),
      minute: targetDate.getMinutes(),
      second: targetDate.getSeconds(),
      millisecond: targetDate.getMilliseconds(),
      rawTargetDate: targetDate
    };
  }
}

// Relative hours difference from local time
function getRelativeDifferenceString(clock) {
  if (clock.isHome) return 'Local Base';
  try {
    const now = new Date();
    const localFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: clock.timeZone
    });

    const lHour = parseInt(localFormatter.format(now), 10);
    const tHour = parseInt(targetFormatter.format(now), 10);

    let diff = tHour - lHour;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;

    if (diff === 0) return 'Same as local';
    return diff > 0 ? `+${diff} hrs ahead` : `${diff} hrs behind`;
  } catch (e) {
    return '';
  }
}

// --- Main Engine Animation Loop ---
let lastSecondTicked = -1;

function startClockEngine() {
  function tick(timestamp) {
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    if (state.isRunning) {
      state.simulatedTimeMs += delta;
    }

    // Check second tick for optional audio click
    const currentSec = Math.floor(state.simulatedTimeMs / 1000);
    if (currentSec !== lastSecondTicked) {
      lastSecondTicked = currentSec;
      if (state.isRunning && state.soundEnabled) {
        playTickSound();
      }
    }

    // Update active clock UI components
    updateAllClocksUI();

    requestAnimationFrame(tick);
  }

  state.lastTimestamp = performance.now();
  requestAnimationFrame(tick);
}

// Update cards on screen
function updateAllClocksUI() {
  const cards = document.querySelectorAll('.clock-card');
  cards.forEach(card => {
    const clockId = card.getAttribute('data-id');
    const clock = state.clocks.find(c => c.id === clockId);
    if (!clock) return;

    const timeData = getClockTime(clock);
    const { hour, minute, second, millisecond } = timeData;

    // 1. Digital Display Text
    const digitalEl = card.querySelector('.digital-time');
    const ampmEl = card.querySelector('.digital-ampm');
    const dateRowEl = card.querySelector('.date-row');

    if (digitalEl) {
      let displayHour = hour;
      let ampm = '';

      if (!state.is24Hour) {
        ampm = displayHour >= 12 ? 'PM' : 'AM';
        displayHour = displayHour % 12 || 12;
      }

      const hStr = String(displayHour).padStart(2, '0');
      const mStr = String(minute).padStart(2, '0');
      const sStr = String(second).padStart(2, '0');

      digitalEl.textContent = `${hStr}:${mStr}:${sStr}`;
      if (ampmEl) ampmEl.textContent = ampm;
    }

    if (dateRowEl) {
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      dateRowEl.textContent = timeData.date.toLocaleDateString('en-US', options);
    }

    // Day / Night indicator
    const phaseEl = card.querySelector('.day-phase-chip');
    if (phaseEl) {
      const isDay = hour >= 6 && hour < 18;
      phaseEl.className = `day-phase-chip ${isDay ? 'day' : 'night'}`;
      phaseEl.innerHTML = isDay ? '☀️ Daytime' : '🌙 Nighttime';
    }

    // 2. Analog Clock Hands
    const hourHand = card.querySelector('.hand-hour');
    const minHand = card.querySelector('.hand-minute');
    const secHand = card.querySelector('.hand-second');

    if (hourHand && minHand && secHand) {
      let secValue = second;
      let minValue = minute;
      let hourValue = hour % 12;

      if (state.handMovement === 'smooth') {
        secValue += millisecond / 1000;
        minValue += secValue / 60;
        hourValue += minValue / 60;
      } else {
        minValue += second / 60;
        hourValue += minute / 60;
      }

      const secDeg = secValue * 6;
      const minDeg = minValue * 6;
      const hourDeg = hourValue * 30;

      hourHand.setAttribute('transform', `rotate(${hourDeg} 50 50)`);
      minHand.setAttribute('transform', `rotate(${minDeg} 50 50)`);
      secHand.setAttribute('transform', `rotate(${secDeg} 50 50)`);
    }

    // Active partial offset pill on card
    const pill = card.querySelector('.active-offset-pill');
    if (pill) {
      const h = clock.offsetHours || 0;
      const m = clock.offsetMinutes || 0;
      const s = clock.offsetSeconds || 0;
      if (h === 0 && m === 0 && s === 0) {
        pill.textContent = 'Normal';
        pill.style.background = 'rgba(255,255,255,0.06)';
        pill.style.color = 'var(--text-muted)';
      } else {
        const signH = h >= 0 ? `+${h}` : `${h}`;
        const signM = m >= 0 ? `+${m}` : `${m}`;
        const signS = s >= 0 ? `+${s}` : `${s}`;
        pill.textContent = `Offset: ${signH}h ${signM}m ${signS}s`;
        pill.style.background = 'rgba(6, 182, 212, 0.2)';
        pill.style.color = 'var(--accent-cyan)';
      }
    }
  });

  // If individual edit modal is open, update its preview
  if (state.editingClockId) {
    updateIndividualModalPreview();
  }
}

// --- Render Functions ---

function renderClocksGrid() {
  const grid = document.getElementById('clocksGrid');
  const emptyState = document.getElementById('emptyGridState');
  grid.innerHTML = '';

  const filtered = state.clocks.filter(clock => {
    if (!state.filterQuery) return true;
    const q = state.filterQuery.toLowerCase();
    return (
      clock.city.toLowerCase().includes(q) ||
      clock.country.toLowerCase().includes(q) ||
      clock.timeZone.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filtered.forEach(clock => {
    const card = document.createElement('div');
    card.className = `clock-card ${clock.isHome ? 'pinned' : ''} ${clock.isPaused ? 'paused-card' : ''}`;
    card.setAttribute('data-id', clock.id);

    // Visibility toggles based on display mode
    const hideAnalog = state.displayMode === 'digital' ? 'style="display:none;"' : '';
    const hideDigital = state.displayMode === 'analog' ? 'style="display:none;"' : '';

    const relDiff = getRelativeDifferenceString(clock);

    card.innerHTML = `
      <div class="clock-card-top">
        <div class="city-meta">
          <div class="city-name-row">
            <span class="city-name">${clock.city}</span>
            ${clock.isHome ? '<span class="home-badge">HOME</span>' : ''}
          </div>
          <span class="country-timezone">${clock.country} • ${clock.timeZone}</span>
        </div>
        <div class="clock-actions">
          <button class="card-action-btn pause-single-btn" title="${clock.isPaused ? 'Resume Clock' : 'Pause Clock'}" data-id="${clock.id}">
            ${clock.isPaused ? '▶' : '⏸'}
          </button>
          <button class="card-action-btn config-btn" title="Granular Hour, Minute, Second Adjustments" data-id="${clock.id}">
            ⚙
          </button>
          ${!clock.isHome ? `
            <button class="card-action-btn delete-btn" title="Remove Clock" data-id="${clock.id}">
              ✕
            </button>
          ` : ''}
        </div>
      </div>

      <div class="clock-visual-wrap">
        <!-- SVG Analog Clock Dial -->
        <div class="analog-clock-container" ${hideAnalog}>
          <svg class="analog-svg" viewBox="0 0 100 100">
            <circle class="dial-face" cx="50" cy="50" r="46"></circle>
            <!-- Hour Ticks -->
            ${generateAnalogTicks()}
            <!-- Hands -->
            <line class="hand-hour" x1="50" y1="50" x2="50" y2="24" transform="rotate(0 50 50)"></line>
            <line class="hand-minute" x1="50" y1="50" x2="50" y2="15" transform="rotate(0 50 50)"></line>
            <line class="hand-second" x1="50" y1="58" x2="50" y2="10" transform="rotate(0 50 50)"></line>
            <circle class="hand-pin" cx="50" cy="50" r="2.8"></circle>
          </svg>
        </div>

        <!-- Digital Readout -->
        <div class="digital-display" ${hideDigital}>
          <div class="time-row">
            <span class="digital-time">--:--:--</span>
            <span class="digital-ampm"></span>
          </div>
          <div class="date-row">---, --- --</div>
          <span class="relative-diff">${relDiff}</span>
          <span class="day-phase-chip day">☀️ Daytime</span>
        </div>
      </div>

      <!-- Granular Stepper Settings for Hour, Minute, Second Separately -->
      <div class="card-granular-strip">
        <div class="strip-label-row">
          <span>Granular Steppers (H / M / S):</span>
          <span class="active-offset-pill">Normal</span>
        </div>
        <div class="card-stepper-grid">
          <div class="stepper-column hour-col">
            <span class="stepper-label">Hour</span>
            <div class="stepper-controls">
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="hour" data-val="-1" title="Subtract 1 Hour">−</button>
              <span class="step-val-display" id="step_val_hour_${clock.id}">${(clock.offsetHours || 0) >= 0 ? '+' : ''}${clock.offsetHours || 0}h</span>
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="hour" data-val="1" title="Add 1 Hour">+</button>
            </div>
          </div>
          <div class="stepper-column min-col">
            <span class="stepper-label">Min</span>
            <div class="stepper-controls">
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="minute" data-val="-1" title="Subtract 1 Minute">−</button>
              <span class="step-val-display" id="step_val_min_${clock.id}">${(clock.offsetMinutes || 0) >= 0 ? '+' : ''}${clock.offsetMinutes || 0}m</span>
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="minute" data-val="1" title="Add 1 Minute">+</button>
            </div>
          </div>
          <div class="stepper-column sec-col">
            <span class="stepper-label">Sec</span>
            <div class="stepper-controls">
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="second" data-val="-1" title="Subtract 1 Second">−</button>
              <span class="step-val-display" id="step_val_sec_${clock.id}">${(clock.offsetSeconds || 0) >= 0 ? '+' : ''}${clock.offsetSeconds || 0}s</span>
              <button class="step-btn card-step-btn" data-id="${clock.id}" data-type="second" data-val="1" title="Add 1 Second">+</button>
            </div>
          </div>
        </div>
        <div class="card-strip-bottom">
          <button class="reset-single-btn card-reset-offset-btn" data-id="${clock.id}">Reset Offsets</button>
          <button class="detailed-config-link open-single-modal-btn" data-id="${clock.id}">Detailed Settings ⚙</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach card specific event listeners
  attachCardEvents();
}

function updateCardStepperDisplays(clockId) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;
  const hEl = document.getElementById(`step_val_hour_${clockId}`);
  const mEl = document.getElementById(`step_val_min_${clockId}`);
  const sEl = document.getElementById(`step_val_sec_${clockId}`);

  if (hEl) hEl.textContent = `${(clock.offsetHours || 0) >= 0 ? '+' : ''}${clock.offsetHours || 0}h`;
  if (mEl) mEl.textContent = `${(clock.offsetMinutes || 0) >= 0 ? '+' : ''}${clock.offsetMinutes || 0}m`;
  if (sEl) sEl.textContent = `${(clock.offsetSeconds || 0) >= 0 ? '+' : ''}${clock.offsetSeconds || 0}s`;
}

// Generate ticks for analog face
function generateAnalogTicks() {
  let lines = '';
  for (let i = 0; i < 12; i++) {
    const angle = i * 30;
    const isMajor = i % 3 === 0;
    const y2 = isMajor ? 12 : 10;
    lines += `<line class="${isMajor ? 'tick-major' : 'tick-minor'}" x1="50" y1="6" x2="50" y2="${y2}" transform="rotate(${angle} 50 50)" />`;
  }
  return lines;
}

// Attach event listeners to card interactive controls
function attachCardEvents() {
  // Stepper buttons on card
  document.querySelectorAll('.card-step-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');
      const val = parseInt(btn.getAttribute('data-val'), 10);
      nudgeSingleClockOffset(id, type, val);
    });
  });

  // Reset offset button directly on card
  document.querySelectorAll('.card-reset-offset-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      resetSingleClockOffset(id);
    });
  });

  // Open individual modal
  document.querySelectorAll('.open-single-modal-btn, .config-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openIndividualModal(id);
    });
  });

  // Toggle single clock pause
  document.querySelectorAll('.pause-single-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      toggleSingleClockPause(id);
    });
  });

  // Delete single clock
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      removeClock(id);
    });
  });
}

// --- Granular Adjustment Engine (Hour / Minute / Second separate) ---

// Global Granular Nudge
function nudgeGlobalOffset(type, amount) {
  if (type === 'hour') {
    state.globalOffsetHours += amount;
  } else if (type === 'minute') {
    state.globalOffsetMinutes += amount;
  } else if (type === 'second') {
    state.globalOffsetSeconds += amount;
  }
  updateGlobalTweakDisplays();
  renderPlanner();
  saveState();
}

function setGlobalOffset(type, exactVal) {
  const num = parseInt(exactVal, 10) || 0;
  if (type === 'hour') state.globalOffsetHours = num;
  if (type === 'minute') state.globalOffsetMinutes = num;
  if (type === 'second') state.globalOffsetSeconds = num;
  updateGlobalTweakDisplays();
  renderPlanner();
  saveState();
}

function resetGlobalOffsets() {
  state.globalOffsetHours = 0;
  state.globalOffsetMinutes = 0;
  state.globalOffsetSeconds = 0;
  updateGlobalTweakDisplays();
  renderPlanner();
  saveState();
}

function updateGlobalTweakDisplays() {
  const hDisplay = document.getElementById('globalHourOffsetDisplay');
  const mDisplay = document.getElementById('globalMinuteOffsetDisplay');
  const sDisplay = document.getElementById('globalSecondOffsetDisplay');

  const hSlider = document.getElementById('globalHourSlider');
  const mSlider = document.getElementById('globalMinuteSlider');
  const sSlider = document.getElementById('globalSecondSlider');

  const hInput = document.getElementById('globalHourInput');
  const mInput = document.getElementById('globalMinuteInput');
  const sInput = document.getElementById('globalSecondInput');

  if (hDisplay) hDisplay.textContent = (state.globalOffsetHours >= 0 ? `+${state.globalOffsetHours}` : `${state.globalOffsetHours}`) + ' hrs';
  if (mDisplay) mDisplay.textContent = (state.globalOffsetMinutes >= 0 ? `+${state.globalOffsetMinutes}` : `${state.globalOffsetMinutes}`) + ' mins';
  if (sDisplay) sDisplay.textContent = (state.globalOffsetSeconds >= 0 ? `+${state.globalOffsetSeconds}` : `${state.globalOffsetSeconds}`) + ' secs';

  if (hSlider) hSlider.value = state.globalOffsetHours;
  if (mSlider) mSlider.value = state.globalOffsetMinutes;
  if (sSlider) sSlider.value = state.globalOffsetSeconds;

  if (hInput) hInput.value = state.globalOffsetHours;
  if (mInput) mInput.value = state.globalOffsetMinutes;
  if (sInput) sInput.value = state.globalOffsetSeconds;
}

// Single Clock Granular Adjustments
function nudgeSingleClockOffset(clockId, type, amount) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;

  if (type === 'hour') clock.offsetHours = (clock.offsetHours || 0) + amount;
  if (type === 'minute') clock.offsetMinutes = (clock.offsetMinutes || 0) + amount;
  if (type === 'second') clock.offsetSeconds = (clock.offsetSeconds || 0) + amount;

  updateCardStepperDisplays(clockId);

  if (state.editingClockId === clockId) {
    updateIndividualModalFields();
  }
  renderPlanner();
  saveState();
}

function setSingleClockOffset(clockId, type, val) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;
  const num = parseInt(val, 10) || 0;

  if (type === 'hour') clock.offsetHours = num;
  if (type === 'minute') clock.offsetMinutes = num;
  if (type === 'second') clock.offsetSeconds = num;

  updateCardStepperDisplays(clockId);

  if (state.editingClockId === clockId) {
    updateIndividualModalFields();
  }
  renderPlanner();
  saveState();
}

function resetSingleClockOffset(clockId) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;
  clock.offsetHours = 0;
  clock.offsetMinutes = 0;
  clock.offsetSeconds = 0;
  clock.totalPausedDurationMs = 0;
  clock.pausedAtMs = null;

  updateCardStepperDisplays(clockId);
  if (state.editingClockId === clockId) {
    updateIndividualModalFields();
  }
  renderPlanner();
  saveState();
}

function toggleSingleClockPause(clockId) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;

  if (!clock.isPaused) {
    // Pausing this clock
    clock.isPaused = true;
    clock.pausedAtMs = state.simulatedTimeMs;
  } else {
    // Resuming this clock
    if (clock.pausedAtMs) {
      clock.totalPausedDurationMs = (clock.totalPausedDurationMs || 0) + (state.simulatedTimeMs - clock.pausedAtMs);
    }
    clock.isPaused = false;
    clock.pausedAtMs = null;
  }

  renderClocksGrid();
  saveState();
}

function removeClock(clockId) {
  state.clocks = state.clocks.filter(c => c.id !== clockId);
  renderClocksGrid();
  renderPlanner();
  saveState();
}

// --- Individual Modal Control ---
function openIndividualModal(clockId) {
  const clock = state.clocks.find(c => c.id === clockId);
  if (!clock) return;

  state.editingClockId = clockId;
  const modal = document.getElementById('individualAdjustModal');
  const title = document.getElementById('modalClockTitle');
  const sub = document.getElementById('modalClockSub');
  const pauseBtn = document.getElementById('modalTogglePauseBtn');

  if (title) title.textContent = `${clock.city} (${clock.country})`;
  if (sub) sub.textContent = `Timezone: ${clock.timeZone}. Modify hours, minutes, and seconds independently.`;

  if (pauseBtn) {
    pauseBtn.textContent = clock.isPaused ? '▶ Resume Clock' : '⏸ Pause Clock';
  }

  updateIndividualModalFields();
  modal.classList.remove('hidden');
}

function closeIndividualModal() {
  state.editingClockId = null;
  const modal = document.getElementById('individualAdjustModal');
  modal.classList.add('hidden');
  renderClocksGrid();
}

function updateIndividualModalFields() {
  const clock = state.clocks.find(c => c.id === state.editingClockId);
  if (!clock) return;

  const h = clock.offsetHours || 0;
  const m = clock.offsetMinutes || 0;
  const s = clock.offsetSeconds || 0;

  document.getElementById('singleHourOffsetDisplay').textContent = (h >= 0 ? `+${h}` : `${h}`) + ' hrs';
  document.getElementById('singleMinuteOffsetDisplay').textContent = (m >= 0 ? `+${m}` : `${m}`) + ' mins';
  document.getElementById('singleSecondOffsetDisplay').textContent = (s >= 0 ? `+${s}` : `${s}`) + ' secs';

  document.getElementById('singleHourSlider').value = h;
  document.getElementById('singleMinuteSlider').value = m;
  document.getElementById('singleSecondSlider').value = s;

  document.getElementById('singleHourInput').value = h;
  document.getElementById('singleMinuteInput').value = m;
  document.getElementById('singleSecondInput').value = s;
}

function updateIndividualModalPreview() {
  const clock = state.clocks.find(c => c.id === state.editingClockId);
  if (!clock) return;

  const timeData = getClockTime(clock);
  let h = timeData.hour;
  let ampm = '';

  if (!state.is24Hour) {
    ampm = ' ' + (h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;
  }

  const hStr = String(h).padStart(2, '0');
  const mStr = String(timeData.minute).padStart(2, '0');
  const sStr = String(timeData.second).padStart(2, '0');

  const preview = document.getElementById('modalClockPreview');
  if (preview) {
    preview.textContent = `${hStr}:${mStr}:${sStr}${ampm}`;
  }
}

// --- 24-Hour Meeting Planner Matrix ---
function renderPlanner() {
  const table = document.getElementById('plannerTable');
  if (!table) return;
  table.innerHTML = '';

  // Header row with 00:00 to 23:00
  const headerRow = document.createElement('div');
  headerRow.className = 'planner-row';
  let headerCells = '<div class="planner-city-cell" style="font-weight:800;">Location / Hour</div>';

  for (let i = 0; i < 24; i++) {
    const hrStr = String(i).padStart(2, '0');
    headerCells += `<div class="planner-hour-cell header-cell">${hrStr}</div>`;
  }
  headerRow.innerHTML = headerCells;
  table.appendChild(headerRow);

  // Each city row
  state.clocks.forEach(clock => {
    const timeData = getClockTime(clock);
    const currentHour = timeData.hour;

    const row = document.createElement('div');
    row.className = 'planner-row';

    let cells = `<div class="planner-city-cell" title="${clock.city}">${clock.city}</div>`;

    for (let h = 0; h < 24; h++) {
      // Classify hour category:
      // Business: 9 to 17 (9am to 5pm)
      // Awake: 7 to 9 or 17 to 22
      // Sleep: 22 to 7
      let phaseClass = 'is-night';
      if (h >= 9 && h <= 17) {
        phaseClass = 'is-work';
      } else if ((h >= 7 && h < 9) || (h > 17 && h < 22)) {
        phaseClass = 'is-wake';
      }

      const isCurrent = h === currentHour ? 'is-current' : '';
      const displayH = state.is24Hour ? String(h).padStart(2, '0') : (h % 12 || 12) + (h >= 12 ? 'p' : 'a');

      cells += `<div class="planner-hour-cell ${phaseClass} ${isCurrent}">${displayH}</div>`;
    }

    row.innerHTML = cells;
    table.appendChild(row);
  });
}

// --- Add Clock Modal & City Search ---
function openAddClockModal() {
  const modal = document.getElementById('addClockModal');
  const input = document.getElementById('timezoneSearchInput');
  modal.classList.remove('hidden');
  input.value = '';
  populateSuggestions('');
  input.focus();
}

function closeAddClockModal() {
  document.getElementById('addClockModal').classList.add('hidden');
}

function populateSuggestions(query) {
  const container = document.getElementById('timezoneSuggestionsList');
  container.innerHTML = '';

  const q = query.toLowerCase().trim();
  const matches = WORLD_CITIES.filter(item => {
    if (!q) return true;
    return (
      item.city.toLowerCase().includes(q) ||
      item.country.toLowerCase().includes(q) ||
      item.timeZone.toLowerCase().includes(q)
    );
  });

  if (matches.length === 0) {
    container.innerHTML = `<div style="padding:1rem;color:var(--text-muted);text-align:center;">No cities match "${query}". You can also enter a standard IANA timezone name.</div>`;
    return;
  }

  matches.forEach(item => {
    // Check if already in active list
    const isAlreadyAdded = state.clocks.some(c => c.timeZone === item.timeZone && c.city === item.city);

    const div = document.createElement('div');
    div.className = 'city-select-item';
    div.innerHTML = `
      <div>
        <div class="city-select-name">${item.city}</div>
        <div class="city-select-region">${item.country} • ${item.timeZone}</div>
      </div>
      <div>
        <button class="mini-btn ${isAlreadyAdded ? '' : 'primary-btn'}">
          ${isAlreadyAdded ? 'Added' : '＋ Add'}
        </button>
      </div>
    `;

    if (!isAlreadyAdded) {
      div.addEventListener('click', () => {
        addNewClock(item);
        closeAddClockModal();
      });
    }

    container.appendChild(div);
  });
}

function addNewClock(cityItem) {
  const newClock = {
    id: 'clock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    city: cityItem.city,
    country: cityItem.country,
    timeZone: cityItem.timeZone,
    isHome: false,
    isPaused: false,
    offsetHours: 0,
    offsetMinutes: 0,
    offsetSeconds: 0
  };

  state.clocks.push(newClock);
  renderClocksGrid();
  renderPlanner();
  saveState();
}

// --- Setup All Event Listeners ---
function setupEventListeners() {
  // Master Play / Pause
  const masterPlayPauseBtn = document.getElementById('masterPlayPauseBtn');
  masterPlayPauseBtn.addEventListener('click', () => {
    state.isRunning = !state.isRunning;
    const icon = document.getElementById('playPauseIcon');
    const label = document.getElementById('playPauseLabel');
    const liveIndicator = document.getElementById('liveIndicator');
    const liveText = document.getElementById('liveStatusText');

    if (state.isRunning) {
      icon.textContent = '⏸';
      label.textContent = 'Pause All';
      liveIndicator.classList.remove('paused');
      liveText.textContent = 'Live Sync Active';
    } else {
      icon.textContent = '▶';
      label.textContent = 'Start All';
      liveIndicator.classList.add('paused');
      liveText.textContent = 'All Clocks Paused';
    }
  });

  // Master Sync to Real Time
  document.getElementById('masterSyncRealtimeBtn').addEventListener('click', () => {
    state.simulatedTimeMs = Date.now();
    state.isRunning = true;
    state.globalOffsetHours = 0;
    state.globalOffsetMinutes = 0;
    state.globalOffsetSeconds = 0;

    // Unpause individual clocks
    state.clocks.forEach(c => {
      c.isPaused = false;
      c.offsetHours = 0;
      c.offsetMinutes = 0;
      c.offsetSeconds = 0;
    });

    document.getElementById('playPauseIcon').textContent = '⏸';
    document.getElementById('playPauseLabel').textContent = 'Pause All';
    document.getElementById('liveIndicator').classList.remove('paused');
    document.getElementById('liveStatusText').textContent = 'Live Sync Active';

    updateGlobalTweakDisplays();
    renderClocksGrid();
    renderPlanner();
    saveState();
  });

  // Global Granular Panel Toggle
  const openGlobalTweakBtn = document.getElementById('openGlobalTweakBtn');
  const globalAdjustPanel = document.getElementById('globalAdjustPanel');
  const closeGlobalAdjustBtn = document.getElementById('closeGlobalAdjustBtn');

  openGlobalTweakBtn.addEventListener('click', () => {
    globalAdjustPanel.classList.toggle('hidden');
    if (!globalAdjustPanel.classList.contains('hidden')) {
      globalAdjustPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  closeGlobalAdjustBtn.addEventListener('click', () => {
    globalAdjustPanel.classList.add('hidden');
  });

  // Global Nudge Buttons
  document.querySelectorAll('.granular-panel .nudge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const val = parseInt(btn.getAttribute('data-val'), 10);
      nudgeGlobalOffset(type, val);
    });
  });

  // Global Sliders
  document.getElementById('globalHourSlider').addEventListener('input', e => {
    setGlobalOffset('hour', e.target.value);
  });
  document.getElementById('globalMinuteSlider').addEventListener('input', e => {
    setGlobalOffset('minute', e.target.value);
  });
  document.getElementById('globalSecondSlider').addEventListener('input', e => {
    setGlobalOffset('second', e.target.value);
  });

  // Global Numeric Inputs
  document.getElementById('applyGlobalHourInput').addEventListener('click', () => {
    setGlobalOffset('hour', document.getElementById('globalHourInput').value);
  });
  document.getElementById('applyGlobalMinuteInput').addEventListener('click', () => {
    setGlobalOffset('minute', document.getElementById('globalMinuteInput').value);
  });
  document.getElementById('applyGlobalSecondInput').addEventListener('click', () => {
    setGlobalOffset('second', document.getElementById('globalSecondInput').value);
  });

  document.getElementById('resetGlobalOffsetsBtn').addEventListener('click', () => {
    resetGlobalOffsets();
  });

  // Add Clock Modal Triggers
  document.getElementById('addClockModalBtn').addEventListener('click', openAddClockModal);
  document.getElementById('emptyAddBtn').addEventListener('click', openAddClockModal);
  document.getElementById('closeAddClockModalBtn').addEventListener('click', closeAddClockModal);
  document.getElementById('addClockModal').addEventListener('click', e => {
    if (e.target.id === 'addClockModal') closeAddClockModal();
  });

  // Timezone search input
  document.getElementById('timezoneSearchInput').addEventListener('input', e => {
    populateSuggestions(e.target.value);
  });

  // Sound Toggle
  const soundBtn = document.getElementById('soundToggleBtn');
  soundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundBtn.querySelector('.icon').textContent = state.soundEnabled ? '🔊' : '🔇';
    soundBtn.title = state.soundEnabled ? 'Audio Ticking: ON' : 'Audio Ticking: OFF';
    if (state.soundEnabled) playTickSound();
  });

  // 12H / 24H toggle
  const displayFormatBtn = document.getElementById('displayFormatBtn');
  displayFormatBtn.addEventListener('click', () => {
    state.is24Hour = !state.is24Hour;
    updateFormatBadge();
    renderPlanner();
    saveState();
  });

  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', state.theme);
    updateThemeIcon();
    saveState();
  });

  // Fullscreen toggle
  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Presets
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pKey = chip.getAttribute('data-preset');
      applyPreset(pKey);
    });
  });

  // Filter clocks on cards
  document.getElementById('filterCardsInput').addEventListener('input', e => {
    state.filterQuery = e.target.value;
    renderClocksGrid();
  });

  // Display Mode Chips
  document.getElementById('viewBothBtn').addEventListener('click', () => setDisplayMode('both'));
  document.getElementById('viewDigitalBtn').addEventListener('click', () => setDisplayMode('digital'));
  document.getElementById('viewAnalogBtn').addEventListener('click', () => setDisplayMode('analog'));

  // Clock Hand Mode Chips
  document.getElementById('handSmoothBtn').addEventListener('click', () => setHandMovement('smooth'));
  document.getElementById('handStepBtn').addEventListener('click', () => setHandMovement('step'));

  // Reset all individual clocks
  document.getElementById('masterResetAllBtn').addEventListener('click', () => {
    state.clocks.forEach(c => {
      c.offsetHours = 0;
      c.offsetMinutes = 0;
      c.offsetSeconds = 0;
      c.isPaused = false;
    });
    renderClocksGrid();
    renderPlanner();
    saveState();
  });

  // Individual Clock Modal Listeners
  document.getElementById('closeIndividualModalBtn').addEventListener('click', closeIndividualModal);
  document.getElementById('saveAndCloseSingleModalBtn').addEventListener('click', closeIndividualModal);
  document.getElementById('individualAdjustModal').addEventListener('click', e => {
    if (e.target.id === 'individualAdjustModal') closeIndividualModal();
  });

  // Individual Nudge buttons
  document.querySelectorAll('.single-nudge').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.editingClockId) return;
      const type = btn.getAttribute('data-type');
      const val = parseInt(btn.getAttribute('data-val'), 10);
      nudgeSingleClockOffset(state.editingClockId, type, val);
    });
  });

  // Individual Sliders
  document.getElementById('singleHourSlider').addEventListener('input', e => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'hour', e.target.value);
  });
  document.getElementById('singleMinuteSlider').addEventListener('input', e => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'minute', e.target.value);
  });
  document.getElementById('singleSecondSlider').addEventListener('input', e => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'second', e.target.value);
  });

  // Individual Set Inputs
  document.getElementById('applySingleHourInput').addEventListener('click', () => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'hour', document.getElementById('singleHourInput').value);
  });
  document.getElementById('applySingleMinuteInput').addEventListener('click', () => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'minute', document.getElementById('singleMinuteInput').value);
  });
  document.getElementById('applySingleSecondInput').addEventListener('click', () => {
    if (state.editingClockId) setSingleClockOffset(state.editingClockId, 'second', document.getElementById('singleSecondInput').value);
  });

  // Individual Pause toggle
  document.getElementById('modalTogglePauseBtn').addEventListener('click', () => {
    if (!state.editingClockId) return;
    const clock = state.clocks.find(c => c.id === state.editingClockId);
    if (clock) {
      clock.isPaused = !clock.isPaused;
      document.getElementById('modalTogglePauseBtn').textContent = clock.isPaused ? '▶ Resume Clock' : '⏸ Pause This Clock';
      saveState();
    }
  });

  // Individual Reset offset
  document.getElementById('modalResetOffsetBtn').addEventListener('click', () => {
    if (!state.editingClockId) return;
    resetSingleClockOffset(state.editingClockId);
  });
}

// UI Helpers
function updateFormatBadge() {
  const badge = document.getElementById('formatBadge');
  if (badge) badge.textContent = state.is24Hour ? '24H' : '12H';
}

function updateThemeIcon() {
  const icon = document.querySelector('#themeToggleBtn .icon');
  if (icon) icon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

function setDisplayMode(mode) {
  state.displayMode = mode;
  updateViewChips();
  renderClocksGrid();
  saveState();
}

function updateViewChips() {
  document.getElementById('viewBothBtn').classList.toggle('active', state.displayMode === 'both');
  document.getElementById('viewDigitalBtn').classList.toggle('active', state.displayMode === 'digital');
  document.getElementById('viewAnalogBtn').classList.toggle('active', state.displayMode === 'analog');
}

function setHandMovement(movement) {
  state.handMovement = movement;
  updateHandChips();
  saveState();
}

function updateHandChips() {
  document.getElementById('handSmoothBtn').classList.toggle('active', state.handMovement === 'smooth');
  document.getElementById('handStepBtn').classList.toggle('active', state.handMovement === 'step');
}

function applyPreset(key) {
  if (key === 'clear') {
    loadDefaultClocks();
  } else if (PRESETS[key]) {
    const tzList = PRESETS[key];
    const newClocks = [];

    // Keep home / local clock first
    const homeClock = state.clocks.find(c => c.isHome) || {
      id: 'clock_local',
      city: 'Local Time',
      country: 'Your System',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isHome: true,
      isPaused: false,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0
    };
    newClocks.push(homeClock);

    tzList.forEach((tz, idx) => {
      const match = WORLD_CITIES.find(w => w.timeZone === tz);
      if (match && match.timeZone !== homeClock.timeZone) {
        newClocks.push({
          id: `preset_${key}_${idx}`,
          city: match.city,
          country: match.country,
          timeZone: match.timeZone,
          isHome: false,
          isPaused: false,
          offsetHours: 0,
          offsetMinutes: 0,
          offsetSeconds: 0
        });
      }
    });

    state.clocks = newClocks;
  }

  renderClocksGrid();
  renderPlanner();
  saveState();
}

// Start everything when DOM is ready
window.addEventListener('DOMContentLoaded', init);
