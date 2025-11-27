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
const usersTable = $('#users-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, language:{ search:'Buscar:' } });
const leaderboardTable = $('#leaderboard-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, order:[[2,'desc']], language:{ search:'Buscar:' } });

// Charts
let leaderboardChart, sensorsDonutChart;
function initCharts(){
    const lbCtx = document.getElementById('leaderboardChart')?.getContext('2d');
    const sdCtx = document.getElementById('sensorsDonut')?.getContext('2d');

    if(lbCtx) leaderboardChart = new Chart(lbCtx,{type:'bar',data:{labels:[],datasets:[{label:'Puntos',data:[],backgroundColor:'#2f7a4a'}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
    if(sdCtx) sensorsDonutChart = new Chart(sdCtx,{type:'doughnut',data:{labels:['OK','Casi lleno','Lleno/Planta seca'],datasets:[{data:[0,0,0],backgroundColor:['#2f7a4a','#f3b46b','#e05757']}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}});
}
initCharts();

// Theme toggle
const themeToggle = document.getElementById("theme-toggle");
(function(){ if(localStorage.getItem("eco_theme")==="dark") document.body.classList.add("dark");})();
if(themeToggle) themeToggle.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("eco_theme", document.body.classList.contains("dark")?"dark":"light");
});

// Firebase listener
rootRef.on("value", snapshot=>{
    const data = snapshot.val();
    if(!data) return;

    // KPIs
    document.getElementById('kpi-users').textContent = Object.keys(data.users||{}).length;
    document.getElementById('kpi-events').textContent = Object.keys(data.events||{}).length;
    const totalPoints = Object.values(data.leaderboard||{}).reduce((a,b)=>a+(b.points||0),0);
    document.getElementById('kpi-points').textContent = totalPoints;

    // Alerts
    const alertsDiv = document.getElementById('sensors-alerts');
    alertsDiv.innerHTML = '';
    let alertCount = 0;
    if(data.sensors){
        Object.entries(data.sensors).forEach(([id,s])=>{
            let text='';
            if(s.type==='plant_sensor' && s.water_needed) text=`🌱 ${id} necesita agua!`;
            else if(s.type==='smart_bin' && s.gas_status==='overflow') text=`🗑️ ${id} está lleno!`;
            if(text){
                const d = document.createElement('div'); d.className='alert'; d.textContent=text;
                alertsDiv.appendChild(d);
                alertCount++;
            }
        });
    }
    document.getElementById('kpi-sensors').textContent = alertCount;

    // Users Table
    usersTable.clear();
    if(data.users){
        Object.values(data.users).forEach(u=>usersTable.row.add([u.name||'-', u.email||'-', u.major||u.department||'-', u.role||u.nationality||'-']));
    }
    usersTable.draw();

    // Leaderboard Table
    leaderboardTable.clear();
    const lbNames=[], lbPoints=[];
    if(data.leaderboard){
        Object.entries(data.leaderboard).sort((a,b)=>b[1].points-a[1].points).forEach(([uid,lb],idx)=>{
            const userName = (data.users && data.users[uid] && data.users[uid].name) || uid;
            leaderboardTable.row.add([idx+1, userName, lb.points, lb.last_update]);
            lbNames.push(userName); lbPoints.push(lb.points);
        });
    }
    leaderboardTable.draw();
    if(leaderboardChart){
        leaderboardChart.data.labels = lbNames;
        leaderboardChart.data.datasets[0].data = lbPoints;
        leaderboardChart.update();
    }

    // Sensors Doughnut
    if(sensorsDonutChart && data.sensors){
        let green=0, orange=0, red=0;
        Object.values(data.sensors).forEach(s=>{
            if(s.type==='smart_bin'){
                if(s.gas_status==='ok') green++;
                else if(s.gas_status==='overflow') red++;
                else orange++;
            } else if(s.type==='plant_sensor'){
                if(s.water_needed) red++;
                else green++;
            }
        });
        sensorsDonutChart.data.datasets[0].data = [green, orange, red];
        sensorsDonutChart.update();
    }

    // Events list
    const eventsDiv = document.getElementById('events-list');
    eventsDiv.innerHTML='';
    if(data.events){
        Object.values(data.events).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).forEach(ev=>{
            const div = document.createElement('div'); div.className='alert';
            div.textContent=`${ev.type} — ${ev.user} — +${ev.points_awarded} pts — ${ev.location} — ${new Date(ev.timestamp).toLocaleString()}`;
            eventsDiv.appendChild(div);
        });
    }
});
