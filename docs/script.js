// ==============================
// Firebase config
// ==============================
const firebaseConfig = {
    apiKey: "AIzaSyDrlSuQYTDcSD6JTEQ-kOVo4yATvZ2zO7I",
    authDomain: "proyecto-iot---grupo-8.firebaseapp.com",
    databaseURL: "https://proyecto-iot---grupo-8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "proyecto-iot---grupo-8",
    storageBucket: "proyecto-iot---grupo-8.firebasestorage.app",
    messagingSenderId: "739127706120",
    appId: "1:739127706120:web:29fd24907c541e311607bd"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const rootRef = db.ref('/');

// ==============================
// DataTables init
// ==============================
const usersTable = $('#users-table').DataTable({
    paging: true,
    searching: true,
    info: false,
    pageLength: 6,
    lengthChange: false,
    language: { search: "Buscar:" }
});

const leaderboardTable = $('#leaderboard-table').DataTable({
    paging: true,
    searching: true,
    info: false,
    pageLength: 6,
    lengthChange: false,
    order: [[2, "desc"]],
    language: { search: "Buscar:" }
});

// ==============================
// Charts init
// ==============================
let leaderboardChart;
let sensorsDonutChart;

function initCharts() {
    const lbCtx = document.getElementById("leaderboardChart")?.getContext("2d");
    const sdCtx = document.getElementById("sensorsDonut")?.getContext("2d");

    if (lbCtx && !leaderboardChart) {
        leaderboardChart = new Chart(lbCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{
                    label: "Puntos",
                    data: [],
                    backgroundColor: "#2f7a4a",
                    borderRadius: 6
                }]
            },
            options: { responsive: true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true} } }
        });
    }

    if (sdCtx && !sensorsDonutChart) {
        sensorsDonutChart = new Chart(sdCtx, {
            type: "doughnut",
            data: {
                labels: ["Verde", "Naranja", "Rojo"],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ["#2f7a4a", "#f3b46b", "#e05757"]
                }]
            },
            options: { responsive:true, plugins:{legend:{position:'bottom'}} }
        });
    }
}
document.addEventListener("DOMContentLoaded", initCharts);

// ==============================
// Theme toggle
// ==============================
const themeToggle = document.getElementById("theme-toggle");
(function initTheme() {
    const saved = localStorage.getItem("eco_theme");
    if (saved === "dark") document.body.classList.add("dark");
})();
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("eco_theme", 
            document.body.classList.contains("dark") ? "dark" : "light"
        );
    });
}

// ==============================
// Firebase data listener
// ==============================
rootRef.on("value", snapshot => {
    const data = snapshot.val() || {};

    updateUsersTable(data.users || {});
    updateLeaderboard(data.users || {}, data.leaderboard || {});
    updateSensors(data.sensors || {});
    updateEvents(data.events || {});
});

// ==============================
// Functions
// ==============================
function updateUsersTable(users) {
    usersTable.clear();
    Object.values(users).forEach(u => {
        usersTable.row.add([
            u.name || "N/A",
            u.email || "N/A",
            u.major || u.department || "N/A",
            u.nationality || u.role || "N/A"
        ]);
    });
    usersTable.draw();
    document.getElementById("kpi-users").textContent = Object.keys(users).length;
}

function updateLeaderboard(users, leaderboard) {
    leaderboardTable.clear();
    const labels = [];
    const pointsArr = [];
    Object.entries(leaderboard).forEach(([uid, lb], idx) => {
        const name = (users[uid] && users[uid].name) || uid;
        leaderboardTable.row.add([idx + 1, name, lb.points, lb.last_update]);
        labels.push(name);
        pointsArr.push(lb.points);
    });
    leaderboardTable.draw();

    if (leaderboardChart) {
        leaderboardChart.data.labels = labels;
        leaderboardChart.data.datasets[0].data = pointsArr;
        leaderboardChart.update();
    }

    // KPI puntos totales
    const totalPoints = Object.values(leaderboard).reduce((sum, lb) => sum + lb.points, 0);
    document.getElementById("kpi-points").textContent = totalPoints;
}

function updateSensors(sensors) {
    const alertsDiv = document.getElementById("sensors-alerts");
    alertsDiv.innerHTML = "";
    let alertCount = 0;

    let green = 0, orange = 0, red = 0;

    Object.entries(sensors).forEach(([id, s]) => {
        let text = "";
        if (s.type === "plant_sensor" && s.water_needed) {
            text = `🌱 ${id} necesita agua!`;
            red++;
        } else if (s.type === "plant_sensor") {
            green++;
        } else if (s.type === "smart_bin") {
            if (s.gas_status === "overflow") {
                text = `🗑️ ${id} está lleno!`;
                red++;
            } else green++;
        } else {
            green++;
        }

        if (text) {
            alertCount++;
            const div = document.createElement("div");
            div.className = "alert alert-item";
            div.textContent = text;
            alertsDiv.appendChild(div);
        }
    });

    document.getElementById("kpi-sensors").textContent = alertCount;

    if (sensorsDonutChart) {
        sensorsDonutChart.data.datasets[0].data = [green, orange, red];
        sensorsDonutChart.update();
    }
}

function updateEvents(events) {
    const eventsDiv = document.getElementById("events-list");
    eventsDiv.innerHTML = "";

    const sorted = Object.values(events).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sorted.forEach(ev => {
        const div = document.createElement("div");
        div.className = "alert alert-item";
        div.textContent = `${ev.type} — ${ev.user} — +${ev.points_awarded} pts — ${ev.location} — ${new Date(ev.timestamp).toLocaleString()}`;
        eventsDiv.appendChild(div);
    });

    document.getElementById("kpi-events").textContent = sorted.length;
}
