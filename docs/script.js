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

  // -----------------------
  // RENDER USUARIOS
  // -----------------------
  usersTable.clear();
  if(data.users){
    Object.values(data.users).forEach(u => {
      usersTable.row.add([
        u.name || '-',
        u.email || '-',
        u.major || u.department || '-',
        u.nationality || u.role || '-'
      ]);
    });
    document.getElementById('kpi-users').textContent = 'Usuarios: ' + Object.keys(data.users).length;
  }
  usersTable.draw();


  // -----------------------
  // RENDER LEADERBOARD
  // -----------------------
  leaderboardTable.clear();
  if(data.leaderboard){
    Object.entries(data.leaderboard)
      .sort((a,b) => b[1].points - a[1].points)
      .forEach(([uid, lb], idx) => {
        const userName = (data.users?.[uid]?.name) || uid;
        leaderboardTable.row.add([
          idx+1,
          userName,
          lb.points,
          lb.last_update
        ]);
      });
  }
  leaderboardTable.draw();


  // -----------------------
  // RENDER SENSORES
  // -----------------------
  const sensorsDiv = document.getElementById('sensors-alerts');
  sensorsDiv.innerHTML = '';

  if(data.sensors){
    Object.entries(data.sensors).forEach(([id, s]) => {
      let text = '';

      if(s.type === 'plant_sensor' && s.water_needed)
        text = `🌱 ${id} necesita agua!`;

      else if(s.type === 'smart_bin' && s.gas_status === 'overflow')
        text = `🗑️ ${id} está lleno!`;

      if(text){
        const div = document.createElement('div');
        div.className = 'alert';
        div.textContent = text;
        sensorsDiv.appendChild(div);
      }
    });
  } else {
    sensorsDiv.textContent = 'Sin sensores activos';
  }


  // -----------------------
  // RENDER EVENTOS
  // -----------------------
  const eventsDiv = document.getElementById('events-list');
  eventsDiv.innerHTML = '';

  if(data.events){
    Object.values(data.events)
      .sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp))
      .forEach(ev => {
        const div = document.createElement('div');
        div.className = 'alert';
        div.textContent = `${ev.type} — ${ev.user} — +${ev.points_awarded} pts — ${ev.location} — ${new Date(ev.timestamp).toLocaleString()}`;
        eventsDiv.appendChild(div);
      });

    document.getElementById('kpi-events').textContent = 'Eventos: ' + Object.keys(data.events).length;
  } else {
    eventsDiv.textContent = 'Sin eventos';
  }


  // -----------------------
  // RENDER GRÁFICO CHART.JS
  // -----------------------
  try {
    const canvas = document.getElementById('leaderboardChart');
    if(!canvas){
      console.error("Canvas del gráfico NO encontrado");
      return;
    }

    const ctx = canvas.getContext('2d');

    // Datos del leaderboard
    const leaderboard = data.leaderboard || {};
    const users = data.users || {};

    const labels = Object.keys(leaderboard).map(uid =>
      users[uid]?.name || uid
    );

    const points = Object.keys(leaderboard).map(uid =>
      leaderboard[uid]?.points || 0
    );

    // 💥 EVITAR ERROR destroy()
    if (window.leaderboardChart && typeof window.leaderboardChart.destroy === "function") {
      window.leaderboardChart.destroy();
    }

    // Crear nuevo gráfico
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
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    console.log("Gráfico creado correctamente");

  } catch (err) {
    console.error("Error creando el gráfico:", err);
  }

});
