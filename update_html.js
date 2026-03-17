const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'goal.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add API_URL and isAuthRegisterMode right after state declaration
content = content.replace(/(let state = \{[\s\S]*?log: \[\]\s*\};\r?\n?)/, `$1
    let isAuthRegisterMode = false;
    const API_URL = 'http://localhost:5000/api';

    /* =======================
       AUTHENTICATION LOGIC
    ======================= */
    function toggleAuthMode() {
      isAuthRegisterMode = !isAuthRegisterMode;
      document.getElementById('auth-title').textContent = isAuthRegisterMode ? 'Create Account' : 'Welcome Back';
      document.getElementById('auth-sub').textContent = isAuthRegisterMode ? 'Sign up to start tracking your goals' : 'Sign in to sync your progress to the cloud';
      document.getElementById('auth-btn-text').textContent = isAuthRegisterMode ? 'Sign Up' : 'Sign In';
      document.getElementById('auth-toggle-text').textContent = isAuthRegisterMode ? 'Already have an account? Sign in' : "Don't have an account? Sign up";
      document.getElementById('auth-error').style.display = 'none';
    }

    async function handleAuth() {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value.trim();
      const errEl = document.getElementById('auth-error');
      const btn = document.getElementById('auth-btn');
      
      if (!email || !password) {
        errEl.textContent = 'Please enter both email and password.';
        errEl.style.display = 'block';
        return;
      }

      errEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = \`<div class="ai-loading" style="padding:0;"><div class="dot-pulse"><span></span><span></span><span></span></div></div>\`;

      const endpoint = isAuthRegisterMode ? '/auth/register' : '/auth/login';

      try {
        const res = await fetch(API_URL + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        btn.disabled = false;
        btn.innerHTML = \`<span id="auth-btn-text">\${isAuthRegisterMode ? 'Sign Up' : 'Sign In'}</span>\`;

        if (!res.ok) {
          errEl.textContent = data.message || 'Authentication failed.';
          errEl.style.display = 'block';
          return;
        }

        localStorage.setItem('token', data.token);
        
        if (data.state && Object.keys(data.state).length > 0) {
          state = { ...state, ...data.state };
          if (!state.activeDates) state.activeDates = [];
        }
        
        checkBootState();
        notify('Success', isAuthRegisterMode ? 'Account created!' : 'Logged in successfully.', 'success');
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = \`<span id="auth-btn-text">\${isAuthRegisterMode ? 'Sign Up' : 'Sign In'}</span>\`;
        errEl.textContent = 'Server connection error. Ensure backend is running.';
        errEl.style.display = 'block';
      }
    }

    function logout() {
      localStorage.removeItem('token');
      // Reset state
      state = { goal: '', milestones: [], dailyTasks: [], customTasks: [], dailyGoal: '', shortTermSummary: '', longTermSummary: '', activeDates: [], log: [] };
      document.getElementById('app').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
    }

    function saveState() {
      const token = localStorage.getItem('token');
      if (token) {
        fetch(API_URL + '/state/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(state)
        }).catch(err => console.error('Cloud Sync failed:', err));
      }
    }

    async function loadState() {
      const token = localStorage.getItem('token');
      if (!token) return false;

      try {
        const res = await fetch(API_URL + '/state/load', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && Object.keys(parsed).length > 0) {
            state = { ...state, ...parsed };
            if (!state.activeDates) state.activeDates = [];
            return true;
          }
        } else {
          if (res.status === 401) {
            localStorage.removeItem('token');
            return false;
          }
        }
      } catch(e) { 
        console.error('Initial state load failed', e);
      }
      return true;
    }
`);

// 2. Add activeDates to the state definition if not there
if (content.indexOf('activeDates:') === -1) {
    content = content.replace(/(let state = \{[\s\S]*?log: \[\]\s*)/, `$1,\n            activeDates: []`);
    content = content.replace(/streak: \[[\s\S]*?\],/, '');
}

// 3. Update initStreak (remove fake data)
content = content.replace(/function initStreak\(\) \{[\s\S]*?\}/, `function initStreak() {
            state.activeDates = [];
            state.log = [
                { text: \`Roadmap generated for "\${state.goal}"\`, time: 'Just now', type: 'success' },
                { text: 'Daily plan ready — tasks scheduled', time: 'Just now', type: 'info' }
            ];
            saveState();
        }`);

// 4. Auth screen DOM insertion
if (content.indexOf('id="auth-screen"') === -1) {
    content = content.replace(/(<div id="onboard")/, `<!-- ===================== AUTH SCREEN ===================== -->
    <div id="auth-screen" style="display:none; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:var(--bg); padding:24px;">
      <div class="onboard-card" style="max-width: 400px; padding: 40px;">
        <div class="onboard-icon" style="margin-bottom:10px;">
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c6dfa" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
             <circle cx="12" cy="7" r="4"></circle>
           </svg>
        </div>
        <div class="onboard-title" id="auth-title">Welcome Back</div>
        <div class="onboard-sub" id="auth-sub" style="margin-bottom:20px;">Sign in to sync your progress to the cloud</div>

        <input type="email" class="goal-input-big" id="auth-email" placeholder="Email address" autocomplete="email" style="margin-bottom:12px; font-size:15px; padding:12px 14px; width:100%; text-align:left;">
        <input type="password" class="goal-input-big" id="auth-password" placeholder="Password" autocomplete="current-password" style="margin-bottom:16px; font-size:15px; padding:12px 14px; width:100%; text-align:left;">

        <div id="auth-error" style="color:var(--red); font-size:13px; margin-bottom:12px; display:none;"></div>

        <button class="btn btn-primary" id="auth-btn" style="width:100%;padding:13px" onclick="handleAuth()">
          <span id="auth-btn-text">Sign In</span>
        </button>

        <div style="font-size:13px; color:var(--text2); margin-top:20px; cursor:pointer;" onclick="toggleAuthMode()">
          <span id="auth-toggle-text">Don't have an account? Sign up</span>
        </div>
      </div>
    </div>
    
  $1`);
}

// 5. Hide onboard default
content = content.replace(/<div id="onboard">/, '<div id="onboard" style="display:none;">');

// 6. Real-time streak calculation helpers (insert before overallPct)
if (content.indexOf('function getLocalYMD') === -1) {
    content = content.replace(/\/\* Calculates overall completion percentage across all milestones \*\//, `function getLocalYMD() {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return \`\${yyyy}-\${mm}-\${dd}\`;
        }

        function markTodayActive() {
            const today = getLocalYMD();
            if (!state.activeDates) state.activeDates = [];
            if (!state.activeDates.includes(today)) {
                state.activeDates.push(today);
                notify('🔥 Streak Increased!', 'You completed a task today!', 'success');
            }
        }

        function getStreakArray() {
            const arr = new Array(30).fill(false);
            const today = new Date();
            if (!state.activeDates) state.activeDates = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - (29 - i));
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                if (state.activeDates.includes(\`\${yyyy}-\${mm}-\${dd}\`)) {
                    arr[i] = true;
                }
            }
            return arr;
        }

        function calculateCurrentStreak() {
            if (!state.activeDates || state.activeDates.length === 0) return 0;
            let currentStreak = 0;
            const today = new Date();
            for (let i = 0; i < 3650; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dateStr = \`\${yyyy}-\${mm}-\${dd}\`;
                
                if (state.activeDates.includes(dateStr)) {
                    currentStreak++;
                } else if (i === 0) {
                    continue; // Missing today doesn't break yesterday's streak
                } else {
                    break;
                }
            }
            return currentStreak;
        }

        /* Calculates overall completion percentage across all milestones */`);
}

// 7. Inject saveState & markTodayActive calls
content = content.replace(/(checkMilestoneComplete\(m\);\s*\})/g, `$1\n            saveState();`);
content = content.replace(/(notify\('Task Complete ✓', t\.title, 'success'\);)/g, `$1\n                markTodayActive();`);

content = content.replace(/(notify\('🏆 Milestone Complete!', m\.title, 'success'\);)/g, `$1\n                markTodayActive();`);
// Re-format if togglemilestone doesn't have block around notify:
content = content.replace(/if \(!allDone\) notify\('🏆 Milestone Complete!', m\.title, 'success'\);/, `if (!allDone) { notify('🏆 Milestone Complete!', m.title, 'success'); markTodayActive(); }`);
content = content.replace(/(function toggleMilestone[\s\S]*?)(renderAll\(\);)/, `$1 saveState();\n            $2`);

content = content.replace(/(notify\('Great work! ✓', t\.title, 'success'\);\s*state\.log\.push\([\s\S]*?\);\s*\})/g, `$1 markTodayActive(); }`);
content = content.replace(/(function toggleDailyTask[\s\S]*?)(renderAll\(\);)/, `$1 saveState();\n            $2`);

content = content.replace(/(function addTask[\s\S]*?inp\.value = '';\s*)(renderAll\(\);)/, `$1saveState();\n            $2`);
content = content.replace(/(function addCustomTask[\s\S]*?inp\.value = '';\s*)(renderAll\(\);)/, `$1saveState();\n            $2`);
content = content.replace(/(function generateDailyPlan[\s\S]*?}\s*)(renderAll\(\);)/, `$1saveState();\n            $2`);


// 8. modify renderDashboard streaks
content = content.replace(/const streak = state\.streak[\s\S]*?\.length;/, 'const streak = calculateCurrentStreak();');
content = content.replace(/const dots = state\.streak\.map/g, 'const dots = getStreakArray().map');

content = content.replace(/const streak = state\.streak[\s\S]*?\.length;/, 'const streak = calculateCurrentStreak();'); // there are two instances (in dashboard and progress)

// 9. replace window.onload boot code
content = content.replace(/window\.onload = \(\) => \{[\s\S]*?\};/, `// Auto-load state on boot
        async function checkBootState() {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('onboard').style.display = 'none';
            document.getElementById('app').style.display = 'none';

            const isLoggedIn = await loadState();
            
            if (!isLoggedIn && !localStorage.getItem('token')) {
                document.getElementById('auth-screen').style.display = 'flex';
            } else if (state.goal) {
                document.getElementById('app').style.display = 'flex';
                renderAll();
                scheduleNotifications();
            } else {
                document.getElementById('onboard').style.display = 'flex';
                document.getElementById('auth-screen').style.display = 'none';
            }
        }

        window.onload = checkBootState;`);

// 10. add logout button mapping
if (content.indexOf('logout()') === -1) {
    content = content.replace(/(Progress\s*<\/button>\s*)(<\/nav>)/, `$1
                <button class="nav-item" onclick="logout()" style="margin-top:auto; color:var(--red);">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                </button>
            $2`);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update complete.');
