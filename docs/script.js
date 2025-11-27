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

    if (lbCtx) {
        leaderboardChart = new Chart(lbCtx, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Puntos", data: [], backgroundColor: "#2f7a4a", borderRadius: 6 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    if (sdCtx) {
        sensorsDonutChart = new Chart(sdCtx, {
            type: "doughnut",
            data: { labels: ["OK", "Alerta", "Crítico"], datasets: [{ data: [0, 0, 0], backgroundColor: ["#2f7a4a","#f3b46b","#e05757"] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}
initCharts();

// ==============================
// Theme toggle (modo oscuro)
// ==============================
const themeToggle = document.getElementById("theme-toggle");
(function initTheme() {
    const saved = localStorage.getItem("eco_theme");
    if (saved === "dark") document.body.classList.add("dark");
})();
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("eco_theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
}

// ==============================
// Firebase listener
// ==============================
rootRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    updateUsersTable(data.users || {});
    updateLeaderboard(data.users || {}, data.leaderboard || {});
    updateSensorsAlerts(data.sensors || {});
});

// ==============================
// Functions
// ==============================
function updateUsersTable(users) {
    usersTable.clear();
    Object.entries(users).forEach(([id, user]) => {
        usersTable.row.add([
            user.name || "N/A",
            user.email || "N/A",
            user.major || user.department || "-",
            user.nationality || user.role || "-"
        ]);
    });
    usersTable.draw();
    document.getElementById("kpi-users").textContent = `Usuarios: ${Object.keys(users).length}`;
}

function updateLeaderboard(users, leaderboard) {
    leaderboardTable.clear();
    const labels = [];
    const points = [];

    Object.entries(leaderboard).forEach(([uid, lb], idx) => {
        const userName = users[uid]?.name || uid;
        leaderboardTable.row.add([idx+1, userName, lb.points, lb.last_update]);
        labels.push(userName);
        points.push(lb.points);
    });

    leaderboardTable.draw();

    if (leaderboardChart) {
        leaderboardChart.data.labels = labels;
        leaderboardChart.data.datasets[0].data = points;
        leaderboardChart.update();
    }
}

function updateSensorsAlerts(sensors) {
    const alertsDiv = document.getElementById("sensors-alerts");
    alertsDiv.innerHTML = "";

    let ok = 0, warning = 0, critical = 0;

    Object.entries(sensors).forEach(([id, s]) => {
        let alertText = "";
        if (s.type === "plant_sensor") {
            if (s.water_needed) { alertText = `🌱 ${id} necesita agua!`; critical++; }
            else ok++;
        } else if (s.type === "smart_bin") {
            if (s.gas_status === "overflow") { alertText = `🗑️ ${id} está lleno!`; warning++; }
            else ok++;
        } else {
            ok++;
        }

        if (alertText) {
            const div = document.createElement("div");
            div.className = "alert-item";
            div.textContent = alertText;
            alertsDiv.appendChild(div);
        }
    });

    // Actualizar donut
    if (sensorsDonutChart) {
        sensorsDonutChart.data.datasets[0].data = [ok, warning, critical];
        sensorsDonutChart.update();
    }
}
