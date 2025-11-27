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
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    if (sdCtx && !sensorsDonutChart) {
        sensorsDonutChart = new Chart(sdCtx, {
            type: "doughnut",
            data: {
                labels: ["Verde", "Naranja", "Rojo"],
                datasets: [{
                    data: [0, 0, 0],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
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
        localStorage.setItem("eco_theme", 
            document.body.classList.contains("dark") ? "dark" : "light"
        );
    });
}


// ==============================
// Firebase data listener
// ==============================
rootRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // Actualizar tablas
    updateUsersTable(data.usuarios || {});
    updateLeaderboard(data.usuarios || {});

    // Actualizar gráficos de sensores
    updateSensorsDonut(data.sensores || {});
});


// ==============================
// Functions
// ==============================
function updateUsersTable(users) {
    usersTable.clear();
    Object.entries(users).forEach(([id, user]) => {
        usersTable.row.add([
            id,
            user.nombre || "N/A",
            user.rol || "N/A"
        ]);
    });
    usersTable.draw();
}

function updateLeaderboard(users) {
    leaderboardTable.clear();

    const names = [];
    const scores = [];

    Object.entries(users).forEach(([id, user]) => {
        const puntos = user.puntos || 0;
        leaderboardTable.row.add([id, user.nombre || "N/A", puntos]);

        names.push(user.nombre || "N/A");
        scores.push(puntos);
    });

    leaderboardTable.draw();

    if (leaderboardChart) {
        leaderboardChart.data.labels = names;
        leaderboardChart.data.datasets[0].data = scores;
        leaderboardChart.update();
    }
}

function updateSensorsDonut(sensors) {
    const green = sensors.verde || 0;
    const orange = sensors.naranja || 0;
    const red = sensors.rojo || 0;

    if (sensorsDonutChart) {
        sensorsDonutChart.data.datasets[0].data = [green, orange, red];
        sensorsDonutChart.update();
    }
}
