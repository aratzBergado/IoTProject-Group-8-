// --- Firebase config ---
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

// --- Inicializar DataTables vacío ---
let usersTable = $('#users-table').DataTable({
  paging: true, searching: true, info: false, pageLength: 5, lengthChange: false,
  language: { search: "Buscar:", zeroRecords: "No se encontraron resultados" }
});
let leaderboardTable = $('#leaderboard-table').DataTable({
  paging: true, searching: true, info: false, pageLength: 5, lengthChange: false, order: [[2,'desc']],
  language: { search: "Buscar:", zeroRecords: "No se encontraron resultados" }
});

// --- Función para renderizar datos ---
rootRef.on('value', snapshot => {
  const data = snapshot.val() || {};

  // Render Usuarios
  usersTable.clear();
  if(data.users){
    Object.values(data.users).forEach(u => {
      usersTable.row.add([u.name||'-', u.email||'-', u.major||u.department||'-', u.nationality||u.role||'-']);
    });
    document.getElementById('kpi-users').textContent = 'Usuarios: ' + Object.keys(data.users).length;
  }
  usersTable.draw();

  // Render Leaderboard
  leaderboardTable.clear();
  if(data.leaderboard){
    Object.entries(data.leaderboard)
      .sort((a,b)=> b[1].points - a[1].points)
      .forEach(([uid, lb], idx) => {
        const userName = (data.users && data.users[uid] && data.users[uid].name) || uid;
        leaderboardTable.row.add([idx+1, userName, lb.points, lb.last_update]);
      });
  }
  leaderboardTable.draw();

  // Render Sensores
  const sensorsDiv = document.getElementById('sensors-alerts');
  sensorsDiv.innerHTML = '';
  if(data.sensors){
    Object.entries(data.sensors).forEach(([id,s])=>{
      let text='';
      if(s.type==='plant_sensor' && s.water_needed) text=`🌱 ${id} necesita agua!`;
      else if(s.type==='smart_bin' && s.gas_status==='overflow') text=`🗑️ ${id} está lleno!`;
      if(text){
        const div=document.createElement('div'); div.className='alert'; div.textContent=text; sensorsDiv.appendChild(div);
      }
    });
  } else sensorsDiv.textContent='Sin sensores activos';

  // Render Eventos
  const eventsDiv = document.getElementById('events-list');
  eventsDiv.innerHTML='';
  if(data.events){
    Object.values(data.events)
      .sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp))
      .forEach(ev=>{
        const div=document.createElement('div'); div.className='alert';
        div.textContent=`${ev.type} — ${ev.user} — +${ev.points_awarded} pts — ${ev.location} — ${new Date(ev.timestamp).toLocaleString()}`;
        eventsDiv.appendChild(div);
      });
    document.getElementById('kpi-events').textContent='Eventos: '+Object.keys(data.events).length;
  } else eventsDiv.textContent='Sin eventos';

  // --- Render gráfico Leaderboard ---
  const ctx = document.getElementById('leaderboardChart').getContext('2d');
  const labels = data.leaderboard ? Object.entries(data.leaderboard).map(([uid, lb]) => (data.users[uid]?.name || uid)) : [];
  const points = data.leaderboard ? Object.values(data.leaderboard).map(lb => lb.points) : [];

  if(window.leaderboardChart) window.leaderboardChart.destroy();
  window.leaderboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Puntos',
        data: points,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
});
