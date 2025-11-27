document.addEventListener("DOMContentLoaded", () => {

    // Firebase config
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

    // DataTables
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

    // Chart.js - leaderboard
    const lbCtx = document.getElementById("leaderboardChart").getContext("2d");
    let leaderboardChart = new Chart(lbCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label:'Puntos', data: [], backgroundColor: '#2f7a4a', borderRadius: 6 }] },
        options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });

    // Dark mode
    const themeToggle = document.getElementById("theme-toggle");
    if(localStorage.getItem("eco_theme") === "dark") document.body.classList.add("dark");
    themeToggle?.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("eco_theme", document.body.classList.contains("dark") ? "dark" : "light");
    });

    // Firebase listener
    rootRef.on("value", snapshot => {
        const data = snapshot.val();
        if (!data) return;

        // ---------- Users table ----------
        usersTable.clear();
        Object.entries(data.users || {}).forEach(([id, u]) => {
            usersTable.row.add([u.name||'-', u.email||'-', u.major||u.department||'-', u.nationality||u.role||'-']);
        });
        usersTable.draw();
        document.getElementById("kpi-users").textContent = `Usuarios: ${Object.keys(data.users||{}).length}`;

        // ---------- Leaderboard ----------
        leaderboardTable.clear();
        const labels = [];
        const points = [];
        Object.entries(data.leaderboard || {}).forEach(([uid, lb], idx) => {
            const userName = data.users?.[uid]?.name || uid;
            leaderboardTable.row.add([idx+1, userName, lb.points, lb.last_update]);
            labels.push(userName);
            points.push(lb.points);
        });
        leaderboardTable.draw();

        leaderboardChart.data.labels = labels;
        leaderboardChart.data.datasets[0].data = points;
        leaderboardChart.update();

        // ---------- Sensors alerts ----------
        const alertsDiv = document.getElementById("sensors-alerts");
        alertsDiv.innerHTML = "";
        let alertCount = 0;
        Object.entries(data.sensors || {}).forEach(([id, s]) => {
            let text = "";
            if (s.type==='plant_sensor' && s.water_needed) text = `🌱 ${id} necesita agua!`;
            else if (s.type==='smart_bin' && s.gas_status==='overflow') text = `🗑️ ${id} está lleno!`;
            if(text){
                const div = document.createElement("div");
                div.className = "alert-item";
                div.textContent = text;
                alertsDiv.appendChild(div);
                alertCount++;
            }
        });
        document.getElementById("kpi-events").textContent = `Eventos: ${alertCount}`;
    });

});
