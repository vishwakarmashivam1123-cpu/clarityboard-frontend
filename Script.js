const API_URL = "https://clarityboard-backend.onrender.com";

// ---------- TEACHER LOGIN PERSISTENCE ----------
// localStorage alone isn't reliable on some phones (MIUI etc. can wipe WebView
// storage on an aggressive app-kill), so we mirror the login data into native
// SharedPreferences via AndroidBridge as a durable backup, and self-heal
// localStorage from it if it's ever found empty.
function getTeacherData() {
  let raw = localStorage.getItem('teacher');
  if (!raw && window.AndroidBridge && typeof window.AndroidBridge.getTeacherData === 'function') {
    try {
      const nativeData = window.AndroidBridge.getTeacherData();
      if (nativeData) {
        localStorage.setItem('teacher', nativeData);
        raw = nativeData;
      }
    } catch (bridgeErr) {
      console.error('Native teacher data read failed:', bridgeErr);
    }
  }
  return raw ? JSON.parse(raw) : null;
}

function saveTeacherData(teacher) {
  const json = JSON.stringify(teacher);
  localStorage.setItem('teacher', json);
  if (window.AndroidBridge && typeof window.AndroidBridge.saveTeacherData === 'function') {
    try {
      window.AndroidBridge.saveTeacherData(json);
    } catch (bridgeErr) {
      console.error('Native teacher data save failed:', bridgeErr);
    }
  }
}

function clearTeacherData() {
  localStorage.removeItem('teacher');
  if (window.AndroidBridge && typeof window.AndroidBridge.clearTeacherData === 'function') {
    try {
      window.AndroidBridge.clearTeacherData();
    } catch (bridgeErr) {
      console.error('Native teacher data clear failed:', bridgeErr);
    }
  }
}

const studentButton = document.getElementById('student-button');
const teacherButton = document.getElementById('teacher-button');

// ---------- SIDE DRAWER ----------
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const menuBtn = document.getElementById('menuBtn');

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.classList.add('btn-loading');
  } else {
    button.classList.remove('btn-loading');
  }
}

if (drawer && menuBtn) {
  const teacherData = getTeacherData();

  if (teacherData) {
    document.getElementById('drawerName').textContent = teacherData.name;
    document.getElementById('drawerEmail').textContent = teacherData.email;
    const initials = teacherData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('drawerAvatar').textContent = initials;
  }

  menuBtn.addEventListener('click', function() {
    drawer.classList.add('open');
    drawerOverlay.classList.add('open');
  });

  drawerOverlay.addEventListener('click', function() {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
  });

  const drawerLogout = document.getElementById('drawerLogout');
  if (drawerLogout) {
    drawerLogout.addEventListener('click', function() {
      clearTeacherData();
      localStorage.removeItem('currentClassCode');
      localStorage.removeItem('currentLectureId');
      window.location.href = 'teacher-login.html';
    });
  }
}

if (teacherButton) {
    teacherButton.addEventListener('click', () => {
        window.location.href = 'teacher-login.html';
    });
}

if (studentButton) {
    studentButton.addEventListener('click', () => {
        window.location.href = 'student.html';
    });
}

//teacher Register Logic
const registerButton = document.getElementById('register-button');

if (registerButton) {
  registerButton.addEventListener('click', async function() {
    const name = document.getElementById('teachername').value;
    const email = document.getElementById('teacheremail').value;
    const password = document.getElementById('teacherpassword').value;
    const errorMessage = document.getElementById('RegistrationError');

    if (name === '' || email === '' || password === '') {
      errorMessage.textContent = 'Please fill in all fields.';
      return;
    }

    if (password.length < 6) {
      errorMessage.textContent = 'Password must be at least 6 characters long.';
      return;
    }

    setButtonLoading(registerButton, true);

    try {
      const response = await fetch(`${API_URL}/api/teachers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setButtonLoading(registerButton, false);
        errorMessage.textContent = data.error;
        return;
      }

      alert('Registration successful! You can now log in.');
      window.location.href = 'teacher-login.html';

    } catch (err) {
      setButtonLoading(registerButton, false);
      console.error(err);
      errorMessage.textContent = 'Could not connect to server. Is it running?';
    }
  });
}

// Teacher Login Logic
const loginButton = document.getElementById('login-button');

if (loginButton) {
  loginButton.addEventListener('click', async function() {
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('LoginError');

    if (email === '' || password === '') {
      errorMessage.textContent = 'Please fill in both fields.';
      return;
    }

    setButtonLoading(loginButton, true);

    try {
      const response = await fetch(`${API_URL}/api/teachers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setButtonLoading(loginButton, false);
        errorMessage.textContent = data.error;
        return;
      }

      saveTeacherData(data.teacher);

      // Agar Android app ke andar chal rahe hain, FCM token backend ko bhejo
      if (window.AndroidBridge && typeof window.AndroidBridge.getFcmToken === 'function') {
        try {
          const fcmToken = window.AndroidBridge.getFcmToken();
          if (fcmToken) {
            await fetch(`${API_URL}/api/teachers/save-fcm-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, fcmToken })
            });
          }
        } catch (bridgeErr) {
          console.error('FCM token save failed:', bridgeErr);
        }
      }

      window.location.href = 'teacher-dashboard.html';

    } catch (err) {
      setButtonLoading(loginButton, false);
      console.error(err);
      errorMessage.textContent = 'Could not connect to server. Is it running?';
    }
  });
}
// -----STUDENT FLOW LOGIC------
const codestage = document.getElementById('codestage');
const feedbackstage = document.getElementById('feedbackStage');
const thankYouStage = document.getElementById('thankYouStage');
const joinButton = document.getElementById('joinButton');

if (joinButton) {
    let topicRatings = {};
    let currentLectureId = null;
    let currentClassCode = null;

    joinButton.addEventListener('click', async function() {
        const subjectcode = document.getElementById('SubjectCode').value.trim();
        const codeError = document.getElementById('code-error');

        if (subjectcode.length !== 6) {
            codeError.textContent = 'Please enter a valid 6-character subject code.';
            return;
        }

        codeError.textContent = '';
        setButtonLoading(joinButton, true);

        try {
            const classResponse = await fetch(`${API_URL}/api/classes/${subjectcode}`);
            const classData = await classResponse.json();

            if (!classResponse.ok) {
                setButtonLoading(joinButton, false);
                codeError.textContent = classData.error;
                return;
            }

            const lectureResponse = await fetch(`${API_URL}/api/lectures/latest/${subjectcode}`);
            const lectureData = await lectureResponse.json();

            if (!lectureResponse.ok) {
                setButtonLoading(joinButton, false);
                codeError.textContent = lectureData.error;
                return;
            }

            currentLectureId = lectureData._id;
            currentClassCode = subjectcode;

            setButtonLoading(joinButton, false);
            codestage.classList.add('hidden');
            feedbackstage.classList.remove('hidden');

            renderTopics(lectureData.topics);
            renderStars();

        } catch (err) {
            setButtonLoading(joinButton, false);
            console.error(err);
            codeError.textContent = 'Could not connect to server. Is it running?';
        }
    });

    function renderTopics(topics) {
        const topicList = document.getElementById('topiclist');
        topicList.innerHTML = '';

        topics.forEach(function(topic) {
            const topicdiv = document.createElement('div');
            topicdiv.classList.add("topic-item");

            topicdiv.innerHTML = `
                <p>${topic}</p>
                <button class="rate-btn" data-topic="${topic}" data-value="Confused">😕 Confused</button>
                <button class="rate-btn" data-topic="${topic}" data-value="Partial">😐 Partial</button>
                <button class="rate-btn" data-topic="${topic}" data-value="Clear">🙂 Clear</button>
            `;
            topicList.appendChild(topicdiv);
        });

        document.querySelectorAll('.rate-btn').forEach(function(button) {
            button.addEventListener('click', function() {
                const topic = this.getAttribute('data-topic');
                const value = this.getAttribute('data-value');
                topicRatings[topic] = value;

                document.querySelectorAll(`.rate-btn[data-topic="${topic}"]`).forEach(function(b) {
                    b.classList.remove("selected");
                });
                button.classList.add("selected");
            });
        });
    }

    let selectedRating = 0;
    function renderStars() {
        const starRating = document.getElementById('starRating');
        starRating.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.textContent = "★";
            star.classList.add("star");
            star.setAttribute("data-value", i);

            star.addEventListener('click', function() {
                selectedRating = i;
                document.querySelectorAll(".star").forEach(function(s) {
                    s.classList.remove("filled");
                    if (s.getAttribute("data-value") <= i) {
                        s.classList.add("filled");
                    }
                });
            });

            starRating.appendChild(star);
        }
    }

    const submitFeedbackBtn = document.getElementById('submitfeedback');
    submitFeedbackBtn.addEventListener("click", async function(){
        const submitError = document.getElementById('submit-error');

        if (selectedRating === 0) {
            if (submitError) submitError.textContent = 'Please rate the lecture (1-5 stars).';
            return;
        }

        const feedbackData = {
            classCode: currentClassCode,
            lectureId: currentLectureId,
            topicRatings: topicRatings,
            doubt: document.getElementById("overall-doubts").value,
            lectureRating: selectedRating,
            suggestion: document.getElementById("suggestions").value
        };

        setButtonLoading(submitFeedbackBtn, true);

        try {
            const response = await fetch(`${API_URL}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedbackData)
            });

            const data = await response.json();

            if (!response.ok) {
                setButtonLoading(submitFeedbackBtn, false);
                if (submitError) submitError.textContent = data.error;
                else alert(data.error);
                return;
            }

            feedbackstage.classList.add("hidden");
            thankYouStage.classList.remove("hidden");

        } catch (err) {
            setButtonLoading(submitFeedbackBtn, false);
            console.error(err);
            if (submitError) submitError.textContent = 'Could not connect to server. Is it running?';
        }
    });
}

// ---------- TEACHER DASHBOARD ----------
const createSessionBtn = document.getElementById('createSessionBtn');

if (createSessionBtn) {
  const dashboardContent = document.getElementById('dashboardContent');
  const teacherData = getTeacherData();

  if (!teacherData) {
    window.location.href = 'teacher-login.html';
  }

  let myClassCode = null;

  initDashboard();

  async function initDashboard() {
    try {
      const response = await fetch(`${API_URL}/api/classes/get-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: teacherData.name,
          teacherEmail: teacherData.email
        })
      });

      const classData = await response.json();

      if (!response.ok) {
        console.error(classData.error);
        return;
      }

      myClassCode = classData.classCode;
      document.getElementById('displayCode').textContent = myClassCode;

      const existingLectureId = localStorage.getItem('currentLectureId');
      if (existingLectureId) {
        dashboardContent.classList.remove('hidden');
        loadDashboardData(existingLectureId);
      }

    } catch (err) {
      console.error(err);
    }
  }

  createSessionBtn.addEventListener('click', async function() {
    const subject = document.getElementById('sessionSubject').value.trim();
    const topicsRaw = document.getElementById('sessionTopics').value.trim();
    const errorBox = document.getElementById('createSessionError');

    if (subject === '' || topicsRaw === '') {
      errorBox.textContent = 'Please fill both fields.';
      return;
    }

    const topics = topicsRaw.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t !== ''; });

    setButtonLoading(createSessionBtn, true);

    try {
      const lectureResponse = await fetch(`${API_URL}/api/lectures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: myClassCode,
          subject: subject,
          topics: topics
        })
      });

      const lectureData = await lectureResponse.json();

      if (!lectureResponse.ok) {
        setButtonLoading(createSessionBtn, false);
        errorBox.textContent = lectureData.error;
        return;
      }

      localStorage.setItem('currentLectureId', lectureData._id);

      document.getElementById('sessionSubject').value = '';
      document.getElementById('sessionTopics').value = '';
      setButtonLoading(createSessionBtn, false);
      dashboardContent.classList.remove('hidden');

      loadDashboardData(lectureData._id);

    } catch (err) {
      setButtonLoading(createSessionBtn, false);
      console.error(err);
      errorBox.textContent = 'Could not connect to server. Is it running?';
    }
  });

  const newSessionBtn = document.getElementById('newSessionBtn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', function() {
      localStorage.removeItem('currentLectureId');
      dashboardContent.classList.add('hidden');
    });
  }

  async function loadDashboardData(lectureId) {
    showDashboardSkeletons();

    try {
      const response = await fetch(`${API_URL}/api/feedback/${lectureId}`);
      const feedbackList = await response.json();

      if (!response.ok) {
        console.error(feedbackList.error);
        return;
      }

      renderStats(feedbackList);
      renderHeatmap(feedbackList);
      renderDonut(feedbackList);
      renderDoubts(feedbackList);
      renderSuggestions(feedbackList);
      renderChart(feedbackList);

    } catch (err) {
      console.error(err);
    }
  }

  function showDashboardSkeletons() {
    const heatmapDiv = document.getElementById('heatmap');
    if (heatmapDiv) {
      heatmapDiv.innerHTML = `
        <div class="skeleton skeleton-block"></div>
        <div class="skeleton skeleton-block"></div>
        <div class="skeleton skeleton-block"></div>
      `;
    }

    const legend = document.getElementById('donutLegend');
    const canvas = document.getElementById('clarityDonut');
    if (legend && canvas) {
      canvas.style.visibility = 'hidden';
      legend.innerHTML = `
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line short"></div>
      `;
    }

    const doubtsList = document.getElementById('doubtsList');
    if (doubtsList) {
      doubtsList.innerHTML = `<div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>`;
    }

    const suggestionsList = document.getElementById('suggestionsList');
    if (suggestionsList) {
      suggestionsList.innerHTML = `<div class="skeleton skeleton-block"></div>`;
    }
  }

  function renderStats(feedbackList) {
    const statResponses = document.getElementById('statResponses');
    if (!statResponses) return;

    const totalResponses = feedbackList.length;

    const avgRating = totalResponses === 0
      ? 0
      : (feedbackList.reduce((sum, fb) => sum + fb.lectureRating, 0) / totalResponses).toFixed(1);

    const openDoubts = feedbackList.filter(fb => fb.doubt && fb.doubt.trim() !== '' && !fb.resolved).length;

    statResponses.textContent = totalResponses;
    document.getElementById('statAvgRating').textContent = avgRating;
    document.getElementById('statOpenDoubts').textContent = openDoubts;
  }

  function renderHeatmap(feedbackList) {
    const heatmapDiv = document.getElementById('heatmap');
    heatmapDiv.innerHTML = '';

    const topicTally = {};

    feedbackList.forEach(function(fb) {
      for (const topic in fb.topicRatings) {
        const rating = fb.topicRatings[topic];

        if (!topicTally[topic]) {
          topicTally[topic] = { confused: 0, partial: 0, clear: 0 };
        }

        if (rating === "Confused") topicTally[topic].confused++;
        else if (rating === "Partial") topicTally[topic].partial++;
        else if (rating === "Clear") topicTally[topic].clear++;
      }
    });

    if (Object.keys(topicTally).length === 0) {
      heatmapDiv.innerHTML = '<p>No feedback submitted yet.</p>';
      return;
    }

    for (const topic in topicTally) {
      const counts = topicTally[topic];
      const total = counts.confused + counts.partial + counts.clear;
      const confusedPercent = (counts.confused / total) * 100;

      let heatClass = "heat-low";
      if (confusedPercent > 50) heatClass = "heat-high";
      else if (confusedPercent > 25) heatClass = "heat-medium";

      const div = document.createElement("div");
      div.classList.add("heatmap-item", heatClass);
      div.innerHTML = `<span>${topic}</span><span>${Math.round(confusedPercent)}% confused</span>`;
      heatmapDiv.appendChild(div);
    }
  }

  function renderDonut(feedbackList) {
    const canvas = document.getElementById('clarityDonut');
    if (!canvas) return;

    canvas.style.visibility = 'visible';

    let confused = 0, partial = 0, clear = 0;

    feedbackList.forEach(function(fb) {
      for (const topic in fb.topicRatings) {
        const rating = fb.topicRatings[topic];
        if (rating === "Confused") confused++;
        else if (rating === "Partial") partial++;
        else if (rating === "Clear") clear++;
      }
    });

    const total = confused + partial + clear;
    const legend = document.getElementById('donutLegend');

    if (total === 0) {
      legend.innerHTML = '<p style="margin:0;">No ratings yet.</p>';
      return;
    }

    legend.innerHTML = `
      <div class="donut-legend-item"><span class="donut-dot" style="background:#FF6B5B;"></span>Confused — ${confused} (${Math.round(confused / total * 100)}%)</div>
      <div class="donut-legend-item"><span class="donut-dot" style="background:#F5A623;"></span>Partial — ${partial} (${Math.round(partial / total * 100)}%)</div>
      <div class="donut-legend-item"><span class="donut-dot" style="background:#2F6FED;"></span>Clear — ${clear} (${Math.round(clear / total * 100)}%)</div>
    `;

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Confused', 'Partial', 'Clear'],
        datasets: [{
          data: [confused, partial, clear],
          backgroundColor: ['#FF6B5B', '#F5A623', '#2F6FED'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderDoubts(feedbackList) {
    const doubtsList = document.getElementById('doubtsList');
    doubtsList.innerHTML = '';

    const doubtsOnly = feedbackList.filter(function(fb) { return fb.doubt && fb.doubt.trim() !== ''; });

    if (doubtsOnly.length === 0) {
      doubtsList.innerHTML = '<p>No doubts submitted yet.</p>';
      return;
    }

    doubtsOnly.forEach(function(fb) {
      const div = document.createElement("div");
      div.classList.add("doubt-item");
      div.innerHTML = `
        <p>${fb.doubt}</p>
        <button class="resolve-btn ${fb.resolved ? 'resolved' : ''}" data-id="${fb._id}">
          ${fb.resolved ? "Resolved ✅" : "Mark Resolved"}
        </button>
      `;
      doubtsList.appendChild(div);
    });

    document.querySelectorAll('.resolve-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const feedbackId = btn.getAttribute('data-id');

        try {
          const response = await fetch(`${API_URL}/api/feedback/${feedbackId}/resolve`, {
            method: 'PATCH'
          });

          if (response.ok) {
            btn.textContent = "Resolved ✅";
            btn.classList.add("resolved");
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function renderSuggestions(feedbackList) {
    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = '';

    const suggestionsOnly = feedbackList.filter(function(fb) { return fb.suggestion && fb.suggestion.trim() !== ''; });

    if (suggestionsOnly.length === 0) {
      suggestionsList.innerHTML = '<p>No suggestions submitted yet.</p>';
      return;
    }

    suggestionsOnly.forEach(function(fb) {
      const div = document.createElement("div");
      div.classList.add("suggestion-item");
      div.textContent = fb.suggestion;
      suggestionsList.appendChild(div);
    });
  }

  function renderChart(feedbackList) {
    const ctx = document.getElementById('ratingChart');
    const ratings = feedbackList.map(function(fb) { return fb.lectureRating; });

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ratings.map(function(r, i) { return "Submission " + (i + 1); }),
        datasets: [{
          label: 'Lecture Rating',
          data: ratings,
          borderColor: '#4361ee',
          backgroundColor: 'rgba(67, 97, 238, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { scales: { y: { min: 0, max: 5 } } }
    });
  }
}

// ---------- PAST SESSIONS ----------
const sessionsListDiv = document.getElementById('sessionsList');

if (sessionsListDiv) {
  const teacherData = getTeacherData();

  if (!teacherData) {
    window.location.href = 'teacher-login.html';
  }

  let allClasses = [];
  let calendarDate = new Date();
  let selectedDay = null;

  loadPastSessions();

  async function loadPastSessions() {
    try {
      const response = await fetch(`${API_URL}/api/classes/teacher/${teacherData.email}`);
      const classes = await response.json();

      if (!response.ok) {
        sessionsListDiv.innerHTML = '<p>Could not load sessions.</p>';
        return;
      }

      allClasses = classes;
      renderCalendar();
      renderSessionsList(allClasses);

    } catch (err) {
      console.error(err);
      sessionsListDiv.innerHTML = '<p>Could not connect to server.</p>';
    }
  }

  function renderSessionsList(classes) {
    const titleEl = document.getElementById('sessionsListTitle');

    if (classes.length === 0) {
      sessionsListDiv.innerHTML = '<p>No sessions on this day.</p>';
      return;
    }

    sessionsListDiv.innerHTML = '';

    classes.forEach(function(cls) {
      const div = document.createElement('div');
      div.classList.add('doubt-item');

      const dateStr = new Date(cls.createdAt).toLocaleDateString();

      div.innerHTML = `
        <p><strong>${cls.subject}</strong> — Code: ${cls.classCode}</p>
        <p style="font-size:12px; color:#888;">${dateStr}</p>
        <button class="view-session-btn" data-code="${cls.classCode}" data-subject="${cls.subject}">View</button>
      `;

      sessionsListDiv.appendChild(div);
    });

    document.querySelectorAll('.view-session-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const classCode = btn.getAttribute('data-code');
        const subject = btn.getAttribute('data-subject');
        await openSessionDetail(classCode, subject);
      });
    });
  }

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calMonthLabel');
    grid.innerHTML = '';

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    label.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const sessionsByDay = {};
    allClasses.forEach(function(cls) {
      const d = new Date(cls.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!sessionsByDay[day]) sessionsByDay[day] = [];
        sessionsByDay[day].push(cls);
      }
    });

    for (let i = 0; i < firstDayOfWeek; i++) {
      const empty = document.createElement('div');
      empty.classList.add('cal-day', 'empty');
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.classList.add('cal-day');
      cell.textContent = day;

      if (sessionsByDay[day]) {
        cell.classList.add('has-session');
        const dot = document.createElement('div');
        dot.classList.add('cal-dot');
        cell.appendChild(dot);

        cell.addEventListener('click', function() {
          document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
          cell.classList.add('selected');
          document.getElementById('sessionsListTitle').textContent =
            `Sessions on ${calendarDate.toLocaleDateString('en-US', { month: 'short' })} ${day}`;
          renderSessionsList(sessionsByDay[day]);
        });
      }
    }

    document.getElementById('calPrevBtn').addEventListener('click', function() {
      calendarDate.setMonth(calendarDate.getMonth() - 1);
      renderCalendar();
    });

    document.getElementById('calNextBtn').addEventListener('click', function() {
      calendarDate.setMonth(calendarDate.getMonth() + 1);
      document.getElementById('sessionsListTitle').textContent = 'All Sessions';
      renderSessionsList(allClasses);
    });
  }

  async function openSessionDetail(classCode, subject) {
    try {
      const lecResponse = await fetch(`${API_URL}/api/lectures/class/${classCode}`);
      const lectures = await lecResponse.json();

      if (!lecResponse.ok || lectures.length === 0) {
        alert('No lecture data found for this session.');
        return;
      }

      const latestLecture = lectures[0];

      document.getElementById('pastSessionTitle').textContent = `${subject} — Code: ${classCode}`;
      document.getElementById('pastSessionDetail').classList.remove('hidden');

      const fbResponse = await fetch(`${API_URL}/api/feedback/${latestLecture._id}`);
      const feedbackList = await fbResponse.json();

      renderHeatmap(feedbackList);
      renderDonut(feedbackList);
      renderDoubts(feedbackList);
      renderSuggestions(feedbackList);
      renderChart(feedbackList);

    } catch (err) {
      console.error(err);
      alert('Something went wrong loading this session.');
    }
  }

  function renderHeatmap(feedbackList) {
    const heatmapDiv = document.getElementById('heatmap');
    heatmapDiv.innerHTML = '';

    const topicTally = {};

    feedbackList.forEach(function(fb) {
      for (const topic in fb.topicRatings) {
        const rating = fb.topicRatings[topic];
        if (!topicTally[topic]) topicTally[topic] = { confused: 0, partial: 0, clear: 0 };
        if (rating === "Confused") topicTally[topic].confused++;
        else if (rating === "Partial") topicTally[topic].partial++;
        else if (rating === "Clear") topicTally[topic].clear++;
      }
    });

    if (Object.keys(topicTally).length === 0) {
      heatmapDiv.innerHTML = '<p>No feedback submitted yet.</p>';
      return;
    }

    for (const topic in topicTally) {
      const counts = topicTally[topic];
      const total = counts.confused + counts.partial + counts.clear;
      const confusedPercent = (counts.confused / total) * 100;

      let heatClass = "heat-low";
      if (confusedPercent > 50) heatClass = "heat-high";
      else if (confusedPercent > 25) heatClass = "heat-medium";

      const div = document.createElement("div");
      div.classList.add("heatmap-item", heatClass);
      div.innerHTML = `<span>${topic}</span><span>${Math.round(confusedPercent)}% confused</span>`;
      heatmapDiv.appendChild(div);
    }
  }

  function renderDonut(feedbackList) {
    const canvas = document.getElementById('clarityDonut');
    if (!canvas) return;

    canvas.style.visibility = 'visible';

    let confused = 0, partial = 0, clear = 0;

    feedbackList.forEach(function(fb) {
      for (const topic in fb.topicRatings) {
        const rating = fb.topicRatings[topic];
        if (rating === "Confused") confused++;
        else if (rating === "Partial") partial++;
        else if (rating === "Clear") clear++;
      }
    });

    const total = confused + partial + clear;
    const legend = document.getElementById('donutLegend');

    if (total === 0) {
      legend.innerHTML = '<p style="margin:0;">No ratings yet.</p>';
      return;
    }

    legend.innerHTML = `
      <div class="donut-legend-item"><span class="donut-dot" style="background:#FF6B5B;"></span>Confused — ${confused} (${Math.round(confused / total * 100)}%)</div>
      <div class="donut-legend-item"><span class="donut-dot" style="background:#F5A623;"></span>Partial — ${partial} (${Math.round(partial / total * 100)}%)</div>
      <div class="donut-legend-item"><span class="donut-dot" style="background:#2F6FED;"></span>Clear — ${clear} (${Math.round(clear / total * 100)}%)</div>
    `;

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Confused', 'Partial', 'Clear'],
        datasets: [{
          data: [confused, partial, clear],
          backgroundColor: ['#FF6B5B', '#F5A623', '#2F6FED'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderDoubts(feedbackList) {
    const doubtsList = document.getElementById('doubtsList');
    doubtsList.innerHTML = '';

    const doubtsOnly = feedbackList.filter(function(fb) { return fb.doubt && fb.doubt.trim() !== ''; });

    if (doubtsOnly.length === 0) {
      doubtsList.innerHTML = '<p>No doubts submitted yet.</p>';
      return;
    }

    doubtsOnly.forEach(function(fb) {
      const div = document.createElement("div");
      div.classList.add("doubt-item");
      div.innerHTML = `
        <p>${fb.doubt}</p>
        <span>${fb.resolved ? "Resolved ✅" : "Unresolved"}</span>
      `;
      doubtsList.appendChild(div);
    });
  }

  function renderSuggestions(feedbackList) {
    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = '';

    const suggestionsOnly = feedbackList.filter(function(fb) { return fb.suggestion && fb.suggestion.trim() !== ''; });

    if (suggestionsOnly.length === 0) {
      suggestionsList.innerHTML = '<p>No suggestions submitted yet.</p>';
      return;
    }

    suggestionsOnly.forEach(function(fb) {
      const div = document.createElement("div");
      div.classList.add("suggestion-item");
      div.textContent = fb.suggestion;
      suggestionsList.appendChild(div);
    });
  }

  function renderChart(feedbackList) {
    const ctx = document.getElementById('ratingChart');
    const ratings = feedbackList.map(function(fb) { return fb.lectureRating; });

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ratings.map(function(r, i) { return "Submission " + (i + 1); }),
        datasets: [{
          label: 'Lecture Rating',
          data: ratings,
          borderColor: '#4361ee',
          backgroundColor: 'rgba(67, 97, 238, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { scales: { y: { min: 0, max: 5 } } }
    });
  }
}
// ---------- APP LOADER / SPLASH ----------
window.addEventListener('load', function() {
  const minDelay = 700; // minimum time the splash stays visible, in ms
  const startTime = performance.now();

  function hideLoader() {
    const elapsed = performance.now() - startTime;
    const remaining = Math.max(0, minDelay - elapsed);

    setTimeout(function() {
      const loader = document.getElementById('appLoader');
      if (loader) loader.classList.add('fade-out');
      document.body.classList.remove('loading');
    }, remaining);
  }

  hideLoader();
});