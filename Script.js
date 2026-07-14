const API_URL = "https://clarityboard-backend.onrender.com";

const studentButton = document.getElementById('student-button');
const teacherButton = document.getElementById('teacher-button');

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

    try {
      const response = await fetch(`${API_URL}/api/teachers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        errorMessage.textContent = data.error;
        return;
      }

      alert('Registration successful! You can now log in.');
      window.location.href = 'teacher-login.html';

    } catch (err) {
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

    try {
      const response = await fetch(`${API_URL}/api/teachers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        errorMessage.textContent = data.error;
        return;
      }

      localStorage.setItem('teacher', JSON.stringify(data.teacher));
      window.location.href = 'teacher-dashboard.html';

    } catch (err) {
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

        try {
            const classResponse = await fetch(`${API_URL}/api/classes/${subjectcode}`);
            const classData = await classResponse.json();

            if (!classResponse.ok) {
                codeError.textContent = classData.error;
                return;
            }

            const lectureResponse = await fetch(`${API_URL}/api/lectures/latest/${subjectcode}`);
            const lectureData = await lectureResponse.json();

            if (!lectureResponse.ok) {
                codeError.textContent = lectureData.error;
                return;
            }

            currentLectureId = lectureData._id;
            currentClassCode = subjectcode;

            codestage.classList.add('hidden');
            feedbackstage.classList.remove('hidden');

            renderTopics(lectureData.topics);
            renderStars();

        } catch (err) {
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

    document.getElementById('submitfeedback').addEventListener("click", async function(){
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

        try {
            const response = await fetch(`${API_URL}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedbackData)
            });

            const data = await response.json();

            if (!response.ok) {
                if (submitError) submitError.textContent = data.error;
                else alert(data.error);
                return;
            }

            feedbackstage.classList.add("hidden");
            thankYouStage.classList.remove("hidden");

        } catch (err) {
            console.error(err);
            if (submitError) submitError.textContent = 'Could not connect to server. Is it running?';
        }
    });
}

// ---------- TEACHER DASHBOARD ----------
const createSessionBtn = document.getElementById('createSessionBtn');

if (createSessionBtn) {
  const dashboardContent = document.getElementById('dashboardContent');
  const teacherData = JSON.parse(localStorage.getItem('teacher'));

  if (!teacherData) {
    window.location.href = 'teacher-login.html';
  }

  const existingClassCode = localStorage.getItem('currentClassCode');
  const existingLectureId = localStorage.getItem('currentLectureId');

  if (existingClassCode && existingLectureId) {
    document.getElementById('displayCode').textContent = existingClassCode;
    document.getElementById('createSessionBox').classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    loadDashboardData(existingLectureId);
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

    try {
      const classResponse = await fetch(`${API_URL}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject,
          teacherName: teacherData.name,
          teacherEmail: teacherData.email
        })
      });

      const classData = await classResponse.json();

      if (!classResponse.ok) {
        errorBox.textContent = classData.error;
        return;
      }

      const lectureResponse = await fetch(`${API_URL}/api/lectures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: classData.classCode,
          topics: topics
        })
      });

      const lectureData = await lectureResponse.json();

      if (!lectureResponse.ok) {
        errorBox.textContent = lectureData.error;
        return;
      }

      localStorage.setItem('currentClassCode', classData.classCode);
      localStorage.setItem('currentLectureId', lectureData._id);

      document.getElementById('displayCode').textContent = classData.classCode;
      document.getElementById('createSessionBox').classList.add('hidden');
      dashboardContent.classList.remove('hidden');

      loadDashboardData(lectureData._id);

    } catch (err) {
      console.error(err);
      errorBox.textContent = 'Could not connect to server. Is it running?';
    }
  });

  const newSessionBtn = document.getElementById('newSessionBtn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', function() {
      localStorage.removeItem('currentClassCode');
      localStorage.removeItem('currentLectureId');
      location.reload();
    });
  }

  async function loadDashboardData(lectureId) {
    try {
      const response = await fetch(`${API_URL}/api/feedback/${lectureId}`);
      const feedbackList = await response.json();

      if (!response.ok) {
        console.error(feedbackList.error);
        return;
      }

      renderHeatmap(feedbackList);
      renderDoubts(feedbackList);
      renderSuggestions(feedbackList);
      renderChart(feedbackList);

    } catch (err) {
      console.error(err);
    }
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
      options: {
        scales: { y: { min: 0, max: 5 } }
      }
    });
  }
}

// ---------- PAST SESSIONS ----------
const sessionsListDiv = document.getElementById('sessionsList');

if (sessionsListDiv) {
  const teacherData = JSON.parse(localStorage.getItem('teacher'));

  if (!teacherData) {
    window.location.href = 'teacher-login.html';
  }

  loadPastSessions();

  async function loadPastSessions() {
    try {
      const response = await fetch(`${API_URL}/api/classes/teacher/${teacherData.email}`);
      const classes = await response.json();

      if (!response.ok) {
        sessionsListDiv.innerHTML = '<p>Could not load sessions.</p>';
        return;
      }

      if (classes.length === 0) {
        sessionsListDiv.innerHTML = '<p>No past sessions yet.</p>';
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

    } catch (err) {
      console.error(err);
      sessionsListDiv.innerHTML = '<p>Could not connect to server.</p>';
    }
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