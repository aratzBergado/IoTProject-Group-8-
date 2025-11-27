// ==============================
// Config Firebase
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
// Inicializar DataTables
// ==============================
const usersTable = $('#users-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, language:{ search:"Buscar:" } });
const leaderboardTable = $('#leaderboard-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, order:[[2,'desc']], language:{ search:"Buscar:" } });

// ==============================
// Inicializar gráficos
// ==============================
let leaderboardChart;
let sensorsDonutChart;

function initCharts() {
    const lbCtx = document.getElementById("leaderboardChart")?.getContext("2d");
    const sdCtx = document.getElementById("sensorsDonut")?.getContext("2d");
    leaderboardChart = createLeaderboardChart(lbCtx, [], []);
    sensorsDonutChart = createSensorsDonut(sdCtx, [0,0,0], ["Verde","Naranja","Rojo"]);
}
initCharts();

// ==============================
// Tema oscuro
// ==============================
const themeToggle = document.getElementById("theme-toggle");
(function initTheme(){
    const saved = localStorage.getItem("eco_theme");
    if(saved === "dark") document.body.classList.add("dark");
})();
themeToggle?.addEventListener("click",()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("eco_theme", document.body.classList.contains("dark") ? "dark":"light");
});

// ==============================
// Función para cargar datos
// ==============================
async function loadData(){
    let data = null;
    try{
        // Intentar Firebase
        const snapshot = await rootRef.get();
        data = snapshot.val();
    } catch(e){
        console.warn("Firebase no disponible, usando JSON local");
    }

    if(!data){
        // Fallback JSON local
        const res = await fetch("firebaseData.json");
        data = await res.json();
    }

    updateDashboard(data);
}

function updateDashboard(data){
    // KPIs
    const usersCount = data.users ? Object.keys(data.users).length : 0;
    const eventsCount = data.events ? Object.keys(data.events).length : 0;
    const totalPoints = data.leaderboard ? Object.values(data.leaderboard).reduce((a,b)=>a+b.points,0) : 0;
    const alertCount = data.sensors ? Object.values(data.sensors).filter(s=> s.water_needed || s.gas_status==="overflow").length : 0;

    document.getElementById("kpi-users").textContent = usersCount;
    document.getElementById("kpi-events").textContent = eventsCount;
    document.getElementById("kpi-points").textContent = totalPoints;
    document.getElementById("kpi-alerts").textContent = alertCount;

    // Tabla Usuarios
    usersTable.clear();
    if(data.users){
        Object.entries(data.users).forEach(([id,u])=>{
            usersTable.row.add([id, u.name||"-", u.email||"-", u.role||u.department||"-"]);
        });
    }
    usersTable.draw();

    // Tabla Leaderboard
    leaderboardTable.clear();
    const labels = [], scores = [];
    if(data.leaderboard){
        Object.entries(data.leaderboard)
        .sort((a,b)=>b[1].points - a[1].points)
        .forEach(([uid,lb],idx)=>{
            const name = data.users?.[uid]?.name || uid;
            leaderboardTable.row.add([uid, name, lb.points]);
            labels.push(name);
            scores.push(lb.points);
        });
    }
    leaderboardTable.draw();

    // Gráficos
    if(leaderboardChart){
        leaderboardChart.data.labels = labels;
        leaderboardChart.data.datasets[0].data = scores;
        leaderboardChart.update();
    }

    if(sensorsDonutChart){
        const green = Object.values(data.sensors||{}).filter(s=>!(s.water_needed || s.gas_status==="overflow")).length;
        const red = Object.values(data.sensors||{}).filter(s=>s.water_needed || s.gas_status==="overflow").length;
        const orange = 0; // Puedes calcular sensores con estado intermedio si quieres
        sensorsDonutChart.data.datasets[0].data = [green, orange, red];
        sensorsDonutChart.update();
    }
}

// ==============================
// Ejecutar
// ==============================
loadData();
