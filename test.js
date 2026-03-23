
        /*
        ============================================================
        STATE — single source of truth for the entire app.
        All renders are derived from this object.
        ============================================================
        */
        let state = {
            goal: '',
            milestones: [],
            dailyTasks: [],
            customTasks: [],
            dailyGoal: '',
            shortTermSummary: '',
            longTermSummary: '',
            activeDates: [], // store ISO date strings of days when minimum 1 task was completed
            log: []
        };

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
          btn.innerHTML = `<div class="ai-loading" style="padding:0;"><div class="dot-pulse"><span></span><span></span><span></span></div></div>`;

          const endpoint = isAuthRegisterMode ? '/auth/register' : '/auth/login';

          try {
            const res = await fetch(API_URL + endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            btn.disabled = false;
            btn.innerHTML = `<span id="auth-btn-text">${isAuthRegisterMode ? 'Sign Up' : 'Sign In'}</span>`;

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
            btn.innerHTML = `<span id="auth-btn-text">${isAuthRegisterMode ? 'Sign Up' : 'Sign In'}</span>`;
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

        /* =======================
           ONBOARDING HELPERS
        ======================= */
        function setQuickGoal(g) {
            document.getElementById('goal-input').value = g;
        }

        async function startGoal() {
            const inp = document.getElementById('goal-input');
            const goal = inp.value.trim();
            if (!goal) { inp.focus(); return; }

            state.goal = goal;

            // Show loading state
            document.getElementById('onboard-loading').style.display = 'block';
            document.querySelector('.onboard-card')
                .querySelectorAll('button, input')
                .forEach(el => el.disabled = true);

            try {
                await generateRoadmapFromAI(goal);
            } catch (err) {
                console.warn('AI call failed, using fallback data:', err);
                useFallbackData(goal);
            }

            launchApp();
        }

        /* =======================
           CLAUDE API CALL
           Calls /v1/messages and asks Claude to return structured JSON
           describing the full roadmap for the user's goal.
        ======================= */
        async function generateRoadmapFromAI(goal) {
            const prompt = `You are an expert curriculum designer and goal planning AI. Create a highly detailed, extremely specific syllabus roadmap for someone who wants to: "${goal}".

DO NOT use generic milestones like "Learn the Fundamentals" or "Build Projects".
INSTEAD, use exact, concrete technical topics, sub-skills, frameworks, or specific concepts to study. (e.g. If the goal is Prompt Engineering, milestones should be "Core LLM Elements", "Prompt vs Context Engineering", "Prompt Techniques". Tasks should be "Study Temperature & Top-P", "Implement Few-Shot & CoT", "Explore Vector DBs"). 
Every milestone and task MUST be a highly specific, tangible concept or action exactly tailored to mastering "${goal}".

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "shortTermSummary": "2-sentence short-term focus",
  "longTermSummary": "2-sentence long-term vision",
  "milestones": [
    {
      "id": 1,
      "title": "Specific Topic/Concept title",
      "duration": "e.g. Month 1-2",
      "type": "short",
      "description": "1 sentence detail",
      "tasks": [
        {"id": "t1", "title": "Specific sub-topic or implementation task", "due": "Week 1", "priority": "high", "done": false}
      ]
    }
  ],
  "dailyGoal": "Short motivational daily focus sentence",
  "dailyPlan": [
    {"id": "d1", "title": "Specific study/action task", "time": "30 min", "priority": "high", "milestone": "Related milestone", "done": false}
  ]
}

Generate 5-6 milestones (first 2-3 = short, rest = long). Each milestone: 3-4 tasks. Daily plan: 4-5 tasks.
Be very specific to the goal "${goal}". Use "short" or "long" for type. Priority: "high", "medium", or "low".`;

            const response = await fetch(API_URL + '/ai/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);

            // Populate state from AI response
            state.milestones = parsed.milestones || [];
            state.dailyTasks = parsed.dailyPlan || [];
            state.dailyGoal = parsed.dailyGoal || 'Stay consistent.';
            state.shortTermSummary = parsed.shortTermSummary || '';
            state.longTermSummary = parsed.longTermSummary || '';

            initStreak();
        }

        /* =======================
           FALLBACK DATA
           Used when the API call fails (e.g., no API key set up yet)
        ======================= */
        function useFallbackData(goal) {
            state.milestones = [
                {
                    id: 1, title: 'Core Data Structures', duration: 'Month 1', type: 'short',
                    description: 'Understand the building blocks of algorithms.',
                    tasks: [
                        { id: 't1', title: 'Implement Hash Maps & Collision Resolution', due: 'Week 1', priority: 'high', done: false },
                        { id: 't2', title: 'Study Binary Search Trees (BST) & Balancing', due: 'Week 2', priority: 'medium', done: false },
                        { id: 't3', title: 'Graph Traversal (BFS & DFS)', due: 'Week 4', priority: 'high', done: false }
                    ]
                },
                {
                    id: 2, title: 'Advanced React Patterns', duration: 'Month 2–3', type: 'short',
                    description: 'Deep dive into performance and state.',
                    tasks: [
                        { id: 't4', title: 'Master useMemo and useCallback internals', due: 'Week 6', priority: 'high', done: false },
                        { id: 't5', title: 'Implement Custom React Hooks for data fetching', due: 'Week 5', priority: 'low', done: false },
                        { id: 't6', title: 'React Server Components Architecture', due: 'Week 8', priority: 'medium', done: false }
                    ]
                },
                {
                    id: 3, title: 'System Design Fundamentals', duration: 'Month 4–6', type: 'long',
                    description: 'Learn to scale complex applications.',
                    tasks: [
                        { id: 't7', title: 'Horizontal vs Vertical Scaling topologies', due: 'Month 5', priority: 'high', done: false },
                        { id: 't8', title: 'Database Sharding & Partitioning strategies', due: 'Month 4', priority: 'medium', done: false },
                        { id: 't9', title: 'Implement Redis Caching & Cache Invalidation', due: 'Month 6', priority: 'medium', done: false }
                    ]
                }
            ];
            state.dailyTasks = [
                { id: 'd1', title: 'Study Hash Map Collision techniques', time: '60 min', priority: 'high', milestone: 'Core Data Structures', done: false },
                { id: 'd2', title: 'Refactor old component with Custom Hooks', time: '30 min', priority: 'high', milestone: 'Advanced React Patterns', done: false },
                { id: 'd3', title: 'Review System Design Primer chapter 1', time: '15 min', priority: 'medium', milestone: 'System Design Fundamentals', done: false }
            ];
            state.dailyGoal = 'Master technical concepts piece by piece until fluency.';
            state.shortTermSummary = 'Focus heavily on core foundation mechanics and intermediate framework patterns.';
            state.longTermSummary = 'Develop expertise, build a portfolio, and create professional opportunities.';
            initStreak();
        }

        /* =======================
           INIT HELPERS
        ======================= */
        function initStreak() {
            state.activeDates = [];
            state.log = [
                { text: `Roadmap generated for "${state.goal}"`, time: 'Just now', type: 'success' },
                { text: 'Daily plan ready — tasks scheduled', time: 'Just now', type: 'info' }
            ];
            saveState();
        }

        function launchApp() {
            document.getElementById('onboard').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            renderAll();
            notify('🎯 Roadmap Ready!', "Your personalized plan is live. Let's go!", 'success');
            scheduleNotifications();
        }

        /* =======================
           MASTER RENDER FUNCTION
           Renders every section from current state.
        ======================= */
        function renderAll() {
            renderSidebar();
            renderDashboard();
            renderRoadmap();
            renderMilestones();
            renderDailyPlan();
            renderProgress();
        }

        /* =======================
           SIDEBAR
        ======================= */
        function renderSidebar() {
            const total = state.milestones.reduce((a, m) => a + m.tasks.length, 0);
            const done = state.milestones.reduce((a, m) => a + m.tasks.filter(t => t.done).length, 0);
            const pct = total > 0 ? Math.round(done / total * 100) : 0;

            document.getElementById('sidebar-goal-wrap').innerHTML = `
        <div class="goal-pill">
          <div class="goal-pill-label">Active Goal</div>
          <div class="goal-pill-name" title="${state.goal}">${state.goal}</div>
          <div class="goal-pill-prog">
            <div class="goal-pill-bar" style="width:${pct}%"></div>
          </div>
        </div>`;
        }

        /* Calculates overall completion percentage across all milestones */
        function overallPct() {
            const total = state.milestones.reduce((a, m) => a + m.tasks.length, 0);
            const done = state.milestones.reduce((a, m) => a + m.tasks.filter(t => t.done).length, 0);
            return total > 0 ? Math.round(done / total * 100) : 0;
        }

        function getStreakArray() {
            const arr = new Array(30).fill(false);
            const today = new Date();
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - (29 - i));
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                if (state.activeDates && state.activeDates.includes(`${yyyy}-${mm}-${dd}`)) {
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
                const dateStr = `${yyyy}-${mm}-${dd}`;

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

        /* =======================
           DASHBOARD
        ======================= */
        function renderDashboard() {
            document.getElementById('dash-goal-sub').textContent = 'Goal: ' + state.goal;

            const pct = overallPct();
            const mDone = state.milestones.filter(m => m.tasks.every(t => t.done)).length;
            const tDone = state.milestones.reduce((a, m) => a + m.tasks.filter(t => t.done).length, 0);
            const streak = calculateCurrentStreak();

            // Stats row
            document.getElementById('stats-row').innerHTML = `
        <div class="stat-card">
          <div class="stat-val">${pct}%</div>
          <div class="stat-label">Overall Progress</div>
          <div class="prog-bar" style="margin-top:8px">
            <div class="prog-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${mDone}/${state.milestones.length}</div>
          <div class="stat-label">Milestones Done</div>
          <div class="stat-change up">+${mDone} completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${tDone}</div>
          <div class="stat-label">Tasks Completed</div>
          <div class="stat-change up">Keep going!</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${streak}</div>
          <div class="stat-label">Day Streak</div>
          <div class="stat-change up">🔥 On fire!</div>
        </div>`;

            // Today's focus — merge AI tasks + custom tasks
            const allToday = [...state.dailyTasks, ...state.customTasks];
            const todayDone = allToday.filter(t => t.done).length;
            const todayTotal = allToday.length;
            const todayPct = todayTotal > 0 ? Math.round(todayDone / todayTotal * 100) : 0;

            document.getElementById('today-tasks').innerHTML =
                allToday.slice(0, 4).map(t => `
          <div class="task-item" onclick="toggleDailyTask('${t.id}')">
            <div class="task-check ${t.done ? 'done' : ''}">
              ${t.done ? checkIcon() : ''}
            </div>
            <span class="task-text ${t.done ? 'done' : ''}">${t.title}</span>
            <span class="task-due">${t.time || ''}</span>
          </div>`).join('') +
                `<div style="margin-top:8px">
          <div class="prog-bar"><div class="prog-bar-fill" style="width:${todayPct}%"></div></div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">${todayDone}/${todayTotal} done today</div>
        </div>`;

            // Streak section
            const dots = getStreakArray().map((a, i) =>
                `<div class="streak-dot ${a ? 'active' : ''} ${i === 29 ? 'today' : ''}"></div>`
            ).join('');

            document.getElementById('streak-section').innerHTML = `
        <div style="font-size:24px;font-weight:600;color:var(--green)">${streak} days</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Active streak</div>
        <div class="streak-dots">${dots}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px">Last 30 days</div>`;

            // Next milestone preview
            const next = state.milestones.find(m => !m.tasks.every(t => t.done));
            if (next) {
                const mdone = next.tasks.filter(t => t.done).length;
                const mpct = Math.round(mdone / next.tasks.length * 100);
                document.getElementById('next-milestone-content').innerHTML = `
          <div class="flex items-center gap-12">
            <div style="flex:1">
              <div class="fw-500" style="font-size:15px">${next.title}</div>
              <div style="font-size:13px;color:var(--text2);margin-top:4px">${next.description || ''}</div>
              <div class="prog-bar" style="margin-top:10px">
                <div class="prog-bar-fill" style="width:${mpct}%"></div>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:4px">${mdone}/${next.tasks.length} tasks • ${next.duration}</div>
            </div>
            <span class="m-badge ${next.type === 'short' ? 'badge-short' : 'badge-long'}">
              ${next.type === 'short' ? 'Short-term' : 'Long-term'}
            </span>
          </div>`;
            }
        }

        /* =======================
           ROADMAP PAGE
        ======================= */
        function renderRoadmap() {
            const pct = overallPct();
            document.getElementById('rm-goal-title').textContent = state.goal;
            document.getElementById('rm-goal-sub').textContent = state.shortTermSummary || '';
            document.getElementById('rm-overall-prog').innerHTML = progressRingHTML(pct, 80, 'var(--accent)');

            // Timeline nodes
            document.getElementById('roadmap-timeline').innerHTML =
                state.milestones.map((m, i) => {
                    const done = m.tasks.every(t => t.done);
                    const prev = state.milestones[i - 1];
                    const active = !done && (i === 0 || (prev && prev.tasks.some(t => t.done)));
                    const mpct = Math.round(m.tasks.filter(t => t.done).length / m.tasks.length * 100);
                    const dotCls = done ? 'done' : active ? 'active' : 'todo';
                    const cardCls = done ? 'done' : active ? 'active' : '';

                    return `
            <div class="rm-node">
              <div class="rm-dot ${dotCls}"></div>
              <div class="rm-card ${cardCls}"
                   onclick="showPage('milestones',null);scrollToMilestone(${m.id})">
                <div class="rm-title">${m.title}</div>
                <div class="rm-time">${m.duration}</div>
                <div class="rm-prog">
                  <div class="rm-prog-fill" style="width:${mpct}%"></div>
                </div>
                <div style="font-size:10px;color:var(--text3);margin-top:4px">${mpct}% done</div>
              </div>
            </div>`;
                }).join('');

            // Short / long-term plan lists
            const short = state.milestones.filter(m => m.type === 'short');
            const long = state.milestones.filter(m => m.type === 'long');
            document.getElementById('short-term-list').innerHTML = planListHTML(short, state.shortTermSummary);
            document.getElementById('long-term-list').innerHTML = planListHTML(long, state.longTermSummary);
        }

        /* Builds the plan-list HTML for short/long-term sections */
        function planListHTML(milestones, summary) {
            return `<p style="font-size:14px;color:var(--text2);margin-bottom:14px;line-height:1.6">${summary}</p>` +
                milestones.map(m => {
                    const pct = Math.round(m.tasks.filter(t => t.done).length / m.tasks.length * 100);
                    return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="width:8px;height:8px;border-radius:50%;background:${m.type === 'short' ? 'var(--blue)' : 'var(--amber)'};flex-shrink:0"></div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500">${m.title}</div>
                <div style="font-size:11px;color:var(--text3)">${m.duration} • ${m.tasks.length} tasks</div>
              </div>
              <div style="font-size:12px;color:var(--text3);min-width:40px;text-align:right">${pct}%</div>
              <div style="width:60px">
                <div class="prog-bar" style="height:4px">
                  <div class="prog-bar-fill" style="width:${pct}%"></div>
                </div>
              </div>
            </div>`;
                }).join('');
        }

        /* Returns inline SVG for a circular progress ring */
        function progressRingHTML(pct, size, color) {
            const r = (size - 12) / 2;
            const cx = size / 2;
            const cy = size / 2;
            const circ = 2 * Math.PI * r;
            const dash = circ * (pct / 100);
            return `
        <div class="ring-wrap" style="width:${size}px;height:${size}px">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
              stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
          </svg>
          <div class="ring-label">
            <div class="ring-pct">${pct}%</div>
            <div class="ring-sub">done</div>
          </div>
        </div>`;
        }

        /* =======================
           MILESTONES PAGE
        ======================= */
        function renderMilestones() {
            const types = [
                { key: 'all', label: 'All' },
                { key: 'short', label: 'Short-term' },
                { key: 'long', label: 'Long-term' }
            ];
            document.getElementById('milestone-tabs').innerHTML =
                types.map((t, i) =>
                    `<button class="tab ${i === 0 ? 'active' : ''}"
            onclick="filterMilestones('${t.key}',this)">${t.label}</button>`
                ).join('');
            renderMilestoneList('all');
        }

        function renderMilestoneList(filter) {
            const ms = filter === 'all'
                ? state.milestones
                : state.milestones.filter(m => m.type === filter);

            document.getElementById('milestones-list').innerHTML = ms.map((m, i) => {
                const done = m.tasks.every(t => t.done);
                const prevDone = i === 0 || ms[i - 1].tasks.every(t => t.done);
                const activeNode = !done && prevDone;
                const pct = Math.round(m.tasks.filter(t => t.done).length / m.tasks.length * 100);

                return `
          <div class="milestone-item ${done ? 'completed' : ''} ${activeNode ? 'active-node' : ''}" id="m-${m.id}">
            <div class="milestone-header">
              <div class="m-check ${done ? 'done' : ''}" onclick="toggleMilestone(${m.id})">
                ${done ? checkIcon(12) : ''}
              </div>
              <div style="flex:1">
                <div class="m-title">${m.title}</div>
                <div style="font-size:12px;color:var(--text3)">${m.duration} • ${pct}% complete</div>
              </div>
              <span class="m-badge ${m.type === 'short' ? 'badge-short' : 'badge-long'}">
                ${m.type === 'short' ? 'Short' : 'Long'}
              </span>
            </div>
            <div class="prog-bar" style="margin:10px 0 2px">
              <div class="prog-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="m-tasks">
              ${m.tasks.map(t => `
                <div class="task-item" onclick="toggleTask(${m.id},'${t.id}')">
                  <div class="task-check ${t.done ? 'done' : ''}">
                    ${t.done ? checkIcon(10) : ''}
                  </div>
                  <span class="task-text ${t.done ? 'done' : ''}">${t.title}</span>
                  <span class="task-due">${t.due || ''}</span>
                  <span class="m-badge" style="
                    background:${t.priority === 'high' ? 'rgba(255,95,95,.12)'
                        : t.priority === 'medium' ? 'rgba(245,166,35,.12)'
                            : 'rgba(34,211,160,.12)'};
                    color:${t.priority === 'high' ? 'var(--red)'
                        : t.priority === 'medium' ? 'var(--amber)'
                            : 'var(--green)'}">
                    ${t.priority}
                  </span>
                </div>`).join('')}
              <div class="add-task-row">
                <input type="text" class="add-task-input" placeholder="Add a task…"
                  id="new-task-${m.id}"
                  onkeydown="if(event.key==='Enter')addTask(${m.id})">
                <button class="btn btn-ghost btn-sm" onclick="addTask(${m.id})">+ Add</button>
              </div>
            </div>
          </div>`;
            }).join('');
        }

        function filterMilestones(filter, el) {
            document.querySelectorAll('#milestone-tabs .tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderMilestoneList(filter);
        }

        function scrollToMilestone(id) {
            setTimeout(() => {
                const el = document.getElementById('m-' + id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }

        /* =======================
           DAILY PLAN PAGE
        ======================= */
        function renderDailyPlan() {
            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            document.getElementById('day-label').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
            document.getElementById('day-sub').textContent = now.getFullYear();
            document.getElementById('daily-goal-text').textContent = state.dailyGoal || 'Stay consistent!';

            const all = [...state.dailyTasks, ...state.customTasks];
            const done = all.filter(t => t.done).length;
            const pct = all.length > 0 ? Math.round(done / all.length * 100) : 0;
            document.getElementById('daily-completion').innerHTML =
                `${done}/${all.length} tasks <span style="color:var(--accent2)">(${pct}%)</span>`;

            document.getElementById('daily-tasks-list').innerHTML = all.map(t => `
        <div class="daily-task ${t.done ? 'done' : ''}" onclick="toggleDailyTask('${t.id}')">
          <div class="task-priority pri-${t.priority}"></div>
          <div class="task-check ${t.done ? 'done' : ''}">
            ${t.done ? checkIcon(10) : ''}
          </div>
          <div style="flex:1">
            <div class="daily-task-text">${t.title}</div>
            ${t.milestone ? `<div class="daily-task-milestone">↳ ${t.milestone}</div>` : ''}
          </div>
          <span class="time-badge">${t.time || '~'}</span>
        </div>`).join('');
        }

        /* =======================
           PROGRESS PAGE
        ======================= */
        function renderProgress() {
            const pct = overallPct();
            const tDone = state.milestones.reduce((a, m) => a + m.tasks.filter(t => t.done).length, 0);
            const streak = calculateCurrentStreak();
            const mDone = state.milestones.filter(m => m.tasks.every(t => t.done)).length;

            document.getElementById('prog-stats').innerHTML = `
        <div class="stat-card"><div class="stat-val">${pct}%</div><div class="stat-label">Overall</div></div>
        <div class="stat-card"><div class="stat-val">${tDone}</div><div class="stat-label">Tasks Done</div></div>
        <div class="stat-card"><div class="stat-val">${streak}</div><div class="stat-label">Day Streak</div></div>
        <div class="stat-card"><div class="stat-val">${mDone}</div><div class="stat-label">Milestones</div></div>`;

            // Weekly bar chart
            const chartData = [3, 5, 2, 7, 4, 6, state.dailyTasks.filter(t => t.done).length + state.customTasks.filter(t => t.done).length];
            const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const max = Math.max(...chartData, 1);

            document.getElementById('weekly-chart').innerHTML =
                chartData.map((v, i) => {
                    const h = Math.max(6, Math.round((v / max) * 90));
                    const isToday = i === 6;
                    return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:11px;color:var(--text3)">${v}</div>
              <div style="width:100%;height:${h}px;background:${isToday ? 'var(--accent)' : 'var(--border2)'};border-radius:4px 4px 0 0;transition:height .5s"></div>
            </div>`;
                }).join('');

            document.getElementById('weekly-labels').innerHTML =
                dayLabels.map((d, i) =>
                    `<div style="flex:1;text-align:center;font-size:11px;color:${i === 6 ? 'var(--accent2)' : 'var(--text3)'}">${d}</div>`
                ).join('');

            // Per-milestone progress bars
            document.getElementById('milestone-progress-list').innerHTML =
                state.milestones.map(m => {
                    const p = Math.round(m.tasks.filter(t => t.done).length / m.tasks.length * 100);
                    return `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span style="font-size:13px;font-weight:500">${m.title}</span>
                <span style="font-size:12px;color:var(--text3)">${p}%</span>
              </div>
              <div class="prog-bar">
                <div class="prog-bar-fill" style="width:${p}%"></div>
              </div>
            </div>`;
                }).join('');

            // Activity log
            const logEl = document.getElementById('activity-log');
            logEl.innerHTML = state.log.length
                ? state.log.slice().reverse().map(l => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="width:6px;height:6px;border-radius:50%;background:${l.type === 'success' ? 'var(--green)' : l.type === 'warning' ? 'var(--amber)' : 'var(--accent)'};flex-shrink:0"></div>
              <span style="font-size:13px;flex:1">${l.text}</span>
              <span style="font-size:11px;color:var(--text3)">${l.time}</span>
            </div>`).join('')
                : `<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">No activity yet. Complete tasks to see your log.</div>`;
        }

        /* =======================
           INTERACTION HANDLERS
        ======================= */

        function getLocalYMD() {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function markTodayActive() {
            const today = getLocalYMD();
            if (!state.activeDates.includes(today)) {
                state.activeDates.push(today);
                notify('🔥 Streak Increased!', 'You completed a task today!', 'success');
            }
        }

        async function handleDailyLogin() {
            const today = getLocalYMD();
            if (!state.activeDates.includes(today)) {
                // It's a new day! Give them their streak point for logging in and fetch fresh AI tasks.
                state.activeDates.push(today);
                notify('🔥 Daily Streak Maintained!', `You logged in! Let's conquer the day.`, 'success');
                saveState();
                
                // Automatically ask AI for new daily tasks based on goal
                await generateDailyPlan();
            }
        }

        /** Toggle a single task inside a milestone */
        function toggleTask(milestoneId, taskId) {
            const m = state.milestones.find(m => m.id === milestoneId);
            if (!m) return;
            const t = m.tasks.find(t => t.id === taskId);
            if (!t) return;

            t.done = !t.done;
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (t.done) {
                state.log.push({ text: `Completed task: "${t.title}"`, time, type: 'success' });
                notify('Task Complete ✓', t.title, 'success');
                markTodayActive();
                checkMilestoneComplete(m);
            }
            saveState();
            renderAll();
        }

        /** Fire a notification when all tasks in a milestone are done */
        function checkMilestoneComplete(m) {
            if (m.tasks.every(t => t.done)) {
                notify('🏆 Milestone Complete!', m.title + ' is done!', 'success');
                state.log.push({
                    text: `Milestone completed: "${m.title}"`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'success'
                });
            }
        }

        /** Toggle all tasks in a milestone at once */
        function toggleMilestone(id) {
            const m = state.milestones.find(m => m.id === id);
            if (!m) return;
            const allDone = m.tasks.every(t => t.done);
            m.tasks.forEach(t => t.done = !allDone);
            if (!allDone) {
                notify('🏆 Milestone Complete!', m.title, 'success');
                markTodayActive();
            }
            saveState();
            renderAll();
        }

        /** Toggle a daily task (AI-generated or custom) */
        function toggleDailyTask(id) {
            const t = state.dailyTasks.find(t => t.id === id) || state.customTasks.find(t => t.id === id);
            if (!t) return;
            t.done = !t.done;
            if (t.done) {
                notify('Great work! ✓', t.title, 'success');
                state.log.push({
                    text: `Daily task done: "${t.title}"`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'success'
                });
                markTodayActive();
            }
            saveState();
            renderAll();
        }

        /** Add a new task to a milestone */
        function addTask(milestoneId) {
            const inp = document.getElementById('new-task-' + milestoneId);
            if (!inp || !inp.value.trim()) return;
            const m = state.milestones.find(m => m.id === milestoneId);
            if (!m) return;
            m.tasks.push({
                id: 't' + Date.now(),
                title: inp.value.trim(),
                due: 'Soon',
                priority: 'medium',
                done: false
            });
            inp.value = '';
            saveState();
            renderAll();
        }

        /** Add a custom task to the daily plan */
        function addCustomTask() {
            const inp = document.getElementById('custom-task-input');
            if (!inp.value.trim()) return;
            state.customTasks.push({
                id: 'c' + Date.now(),
                title: inp.value.trim(),
                time: 'Custom',
                priority: 'medium',
                milestone: '',
                done: false
            });
            inp.value = '';
            saveState();
            renderAll();
            notify('Task added!', state.customTasks[state.customTasks.length - 1].title);
        }

        /* =======================
           AI DAILY PLAN REFRESH
        ======================= */
        async function generateDailyPlan() {
            notify('Refreshing daily plan...', 'Asking AI for today\'s tasks…');
            try {
                const pending = state.milestones
                    .flatMap(m => m.tasks.filter(t => !t.done))
                    .slice(0, 5)
                    .map(t => t.title)
                    .join(', ');

                const prompt = `Generate a fresh daily plan for someone working on: "${state.goal}". Pending tasks include: ${pending || 'general work'}.
Return ONLY JSON: {"dailyPlan":[{"id":"d1","title":"task","time":"30 min","priority":"high","milestone":"area","done":false}], "dailyGoal": "motivational sentence"}. Make 4-5 specific, actionable tasks.`;

                const resp = await fetch(API_URL + '/ai/generate', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify({
                        model: 'grok-beta',
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content || '';
                const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim());

                state.dailyTasks = parsed.dailyPlan || state.dailyTasks;
                state.dailyGoal = parsed.dailyGoal || state.dailyGoal;
                notify('Daily plan refreshed! ✓', 'New tasks ready for today.', 'success');
            } catch (e) {
                notify('Using current plan', 'AI refresh failed, keeping existing tasks.', 'warning');
            }
            saveState();
            renderAll();
        }

        /* =======================
           PAGE NAVIGATION
        ======================= */
        function showPage(id, el) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('page-' + id).classList.add('active');
            if (el) {
                el.classList.add('active');
            } else {
                document.querySelectorAll('.nav-item').forEach(n => {
                    if (n.textContent.trim().toLowerCase().includes(id)) n.classList.add('active');
                });
            }
        }

        /* =======================
           NOTIFICATION SYSTEM
        ======================= */
        function notify(title, msg, type = 'info') {
            const panel = document.getElementById('notif-panel');
            const n = document.createElement('div');
            n.className = 'notif ' + (type === 'success' ? 'success' : type === 'warning' ? 'warning' : '');
            n.innerHTML = `<div class="notif-title">${title}</div>${msg}`;
            panel.appendChild(n);
            setTimeout(() => {
                n.style.animation = 'notif-out 0.3s ease forwards';
                setTimeout(() => n.remove(), 300);
            }, 3500);
        }

        /* =======================
           SCHEDULED NOTIFICATIONS
        ======================= */
        function scheduleNotifications() {
            const msgs = [
                ['⏰ Daily Check-in', 'Time to work on your tasks!'],
                ['💡 Tip', 'Break big tasks into 25-minute Pomodoro sessions.'],
                ['🎯 Keep Going', 'Every small step counts toward your goal.']
            ];
            let i = 0;
            setInterval(() => {
                if (i < msgs.length) { notify(msgs[i][0], msgs[i][1]); i++; }
            }, 8000);
        }

        function checkIcon(size = 10) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2,5 4,7 8,3"/>
      </svg>`;
        }

        // Auto-load state on boot
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
                handleDailyLogin(); // Tracks daily login streak and updates AI plan!
                scheduleNotifications();
            } else {
                document.getElementById('onboard').style.display = 'flex';
                document.getElementById('auth-screen').style.display = 'none';
            }
        }

        window.onload = checkBootState;

