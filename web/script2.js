import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDnQdG73VcbksdwvYVyXCsqi_6Ib0Dc-6s",
    authDomain: "iot-project-42d28.firebaseapp.com",
    projectId: "iot-project-42d28",
    storageBucket: "iot-project-42d28.firebasestorage.app",
    messagingSenderId: "851453299312",
    appId: "1:851453299312:web:d11e43cea1212a836042b5",
    measurementId: "G-SPP9G3GS8S"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase app:", firebase.apps.length > 0 ? "✅ Inicializado" : "❌ NO inicializado");

const testQuery = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    console.log(`✅ Conexión OK. Usuarios encontrados: ${usersSnapshot.size}`);
    console.log("📋 Primer usuario:", usersSnapshot.docs[0]?.data());
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};
testQuery();
// ===== FUNCIONES PARA KPIs =====
async function updateKPIs() {
    try {
        // 1. Usuarios Activos (colección "users")
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersCount = usersSnapshot.size;
        document.getElementById('kpi-users').textContent = usersCount;
        
        // 2. Eventos Recientes (número de documentos en "distance")
        const distanceSnapshot = await getDocs(collection(db, "distance"));
        const eventsCount = distanceSnapshot.size;
        document.getElementById('kpi-events').textContent = eventsCount;
        
        // 3. Puntos Totales (suma de puntos de todos los usuarios)
        let totalPoints = 0;
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            totalPoints += userData.points || 0;
        });
        document.getElementById('kpi-points').textContent = totalPoints;
        
        // 4. Alertas Activas (puedes ajustar esto según necesites)
        document.getElementById('kpi-sensors').textContent = "0";
        
        console.log("KPIs actualizados correctamente");
    } catch (error) {
        console.error("Error actualizando KPIs:", error);
    }
}

// ===== FUNCIÓN PARA CARGAR TABLA DE USUARIOS =====
async function loadUsersTable() {
    try {
        const usersTable = $('#users-table').DataTable({
            destroy: true, // Para poder recargar
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
            }
        });
        
        const usersSnapshot = await getDocs(collection(db, "users"));
        usersTable.clear();
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            usersTable.row.add([
                user.nombre || "N/A",
                user.email || "N/A",
                user.department || "N/A",
                user.nationality || "N/A",
                `<span class="badge bg-success">Activo</span>`
            ]);
        });
        
        usersTable.draw();
    } catch (error) {
        console.error("Error cargando tabla de usuarios:", error);
    }
}

// ===== FUNCIÓN PARA CARGAR LEADERBOARD =====
async function loadLeaderboard() {
    try {
        const leaderboardTable = $('#leaderboard-table').DataTable({
            destroy: true,
            order: [[2, 'desc']], // Ordenar por puntos descendente
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
            }
        });
        
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersArray = [];
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            usersArray.push({
                nombre: user.nombre || "Usuario",
                points: user.points || 0,
                id: doc.id
            });
        });
        
        // Ordenar por puntos
        usersArray.sort((a, b) => b.points - a.points);
        
        leaderboardTable.clear();
        
        usersArray.forEach((user, index) => {
            leaderboardTable.row.add([
                `#${index + 1}`,
                user.nombre,
                user.points,
                `<div class="progress" style="height: 10px;">
                    <div class="progress-bar bg-success" style="width: ${Math.min(user.points / 10, 100)}%"></div>
                </div>`
            ]);
        });
        
        leaderboardTable.draw();
    } catch (error) {
        console.error("Error cargando leaderboard:", error);
    }
}

// ===== FUNCIÓN PARA CARGAR ALERTAS DE SENSORES =====
async function loadSensorAlerts() {
    try {
        const alertsContainer = document.getElementById('sensors-alerts');
        alertsContainer.innerHTML = '';
        
        // Obtener últimos datos de sensores para mostrar alertas
        const collectionsToCheck = ['distance', 'gas', 'button', 'moisture'];
        
        for (const collectionName of collectionsToCheck) {
            try {
                const q = query(collection(db, collectionName), orderBy("timestamp", "desc"), limit(1));
                const snapshot = await getDocs(q);
                
                if (!snapshot.empty) {
                    const latestData = snapshot.docs[0].data();
                    createAlertCard(collectionName, latestData, alertsContainer);
                }
            } catch (error) {
                console.warn(`No se pudo cargar ${collectionName}:`, error);
            }
        }
        
        // Actualizar contador de alertas
        const alertsCount = document.querySelectorAll('.alert').length;
        document.getElementById('alerts-count').textContent = alertsCount;
        
    } catch (error) {
        console.error("Error cargando alertas:", error);
    }
}

function createAlertCard(sensorType, data, container) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert';
    
    let message = '';
    let alertClass = 'alert-info';
    
    switch(sensorType) {
        case 'distance':
            const distance = data.distance_cm || data.value || 0;
            message = `Distancia: ${distance} cm`;
            if (distance < 10) {
                alertClass = 'alert-danger';
                message += ' - ¡MUY CERCA!';
            } else if (distance < 30) {
                alertClass = 'alert-warning';
                message += ' - Cerca';
            }
            break;
            
        case 'gas':
            const gasValue = data.gas_value || data.value || 0;
            message = `Gas: ${gasValue}`;
            if (gasValue > 500) {
                alertClass = 'alert-danger';
                message += ' - ¡ALTA CONCENTRACIÓN!';
            }
            break;
            
        case 'button':
            const isPressed = data.button_pressed || data.pressed || (data.button_state === 1);
            message = `Botón: ${isPressed ? 'PRESIONADO' : 'NO PRESIONADO'}`;
            if (isPressed) alertClass = 'alert-warning';
            break;
            
        case 'moisture':
            const moisture = data.moisture_value || data.value || 0;
            const status = data.moisture_status || data.status || '';
            message = `Humedad: ${moisture} (${status})`;
            if (status.includes('Dry')) alertClass = 'alert-danger';
            break;
    }
    
    alertDiv.className = `alert ${alertClass}`;
    alertDiv.innerHTML = `
        <strong>${sensorType.toUpperCase()}</strong>
        <span class="float-end text-muted">${new Date().toLocaleTimeString()}</span>
        <div>${message}</div>
    `;
    
    container.appendChild(alertDiv);
}

// ===== FUNCIÓN PARA CARGAR EVENTOS RECIENTES =====
async function loadRecentEvents() {
    try {
        const eventsContainer = document.getElementById('events-list');
        eventsContainer.innerHTML = '';
        
        // Obtener últimos eventos de todos los sensores
        const allEvents = [];
        const collections = ['distance', 'gas', 'button', 'moisture'];
        
        for (const collectionName of collections) {
            try {
                const q = query(collection(db, collectionName), orderBy("timestamp", "desc"), limit(3));
                const snapshot = await getDocs(q);
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    allEvents.push({
                        type: collectionName,
                        timestamp: data.timestamp || new Date().toISOString(),
                        value: getEventValue(collectionName, data),
                        id: doc.id
                    });
                });
            } catch (error) {
                console.warn(`Error cargando eventos de ${collectionName}:`, error);
            }
        }
        
        // Ordenar por timestamp (más reciente primero)
        allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Mostrar solo los 5 más recientes
        const recentEvents = allEvents.slice(0, 5);
        
        recentEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event-item';
            
            const icon = getEventIcon(event.type);
            const time = formatEventTime(event.timestamp);
            
            eventDiv.innerHTML = `
                <div class="event-icon">${icon}</div>
                <div class="event-content">
                    <div class="event-title">${event.type.toUpperCase()}: ${event.value}</div>
                    <div class="event-meta">
                        <span>${time}</span>
                        <span>ID: ${event.id.substring(0, 8)}...</span>
                    </div>
                </div>
            `;
            
            eventsContainer.appendChild(eventDiv);
        });
        
    } catch (error) {
        console.error("Error cargando eventos:", error);
    }
}

function getEventValue(sensorType, data) {
    switch(sensorType) {
        case 'distance': return `${data.distance_cm || data.value || 0} cm`;
        case 'gas': return data.gas_value || data.value || 0;
        case 'button': return (data.button_pressed || data.pressed || data.button_state === 1) ? 'Pressed' : 'Not pressed';
        case 'moisture': return `${data.moisture_value || data.value || 0} (${data.moisture_status || data.status || ''})`;
        default: return 'N/A';
    }
}

function getEventIcon(sensorType) {
    const icons = {
        'distance': '📏',
        'gas': '⚗️',
        'button': '🔘',
        'moisture': '💧'
    };
    return icons[sensorType] || '📊';
}

function formatEventTime(timestamp) {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Justo ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)} h`;
        return date.toLocaleDateString();
    } catch (e) {
        return 'Reciente';
    }
}

// ===== FUNCIONES PARA GRÁFICOS =====
async function createCharts() {
    try {
        // 1. Gráfico de Leaderboard (Puntos por Usuario)
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersData = [];
        const usersLabels = [];
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            usersData.push(user.points || 0);
            usersLabels.push(user.nombre || `Usuario ${doc.id.substring(0, 4)}`);
        });
        
        const leaderboardCtx = document.getElementById('leaderboardChart').getContext('2d');
        new Chart(leaderboardCtx, {
            type: 'bar',
            data: {
                labels: usersLabels,
                datasets: [{
                    label: 'Puntos',
                    data: usersData,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        
        // 2. Gráfico de Estado de Sensores
        const sensorData = [0, 0, 0, 0]; // [distance, gas, button, moisture]
        const sensorColors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'];
        
        // Contar documentos por colección de sensores
        const sensorCollections = ['distance', 'gas', 'button', 'moisture'];
        for (let i = 0; i < sensorCollections.length; i++) {
            try {
                const snapshot = await getDocs(collection(db, sensorCollections[i]));
                sensorData[i] = snapshot.size;
            } catch (error) {
                console.warn(`Error contando ${sensorCollections[i]}:`, error);
            }
        }
        
        const sensorsCtx = document.getElementById('sensorsDonut').getContext('2d');
        new Chart(sensorsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Distancia', 'Gas', 'Botón', 'Humedad'],
                datasets: [{
                    data: sensorData,
                    backgroundColor: sensorColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
        
    } catch (error) {
        console.error("Error creando gráficos:", error);
    }
}

// FUNCIÓN PARA REFRESCAR TODO
async function refreshAllData() {
    try {
        console.log("Refrescando datos...");
        await updateKPIs();
        await loadUsersTable();
        await loadLeaderboard();
        await loadSensorAlerts();
        await loadRecentEvents();
        await createCharts();
        console.log("Datos refrescados correctamente");
    } catch (error) {
        console.error("Error refrescando datos:", error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Cargar todos los datos al inicio
    refreshAllData();
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAllData);
    }
    
    const refreshEventsBtn = document.getElementById('refresh-events');
    if (refreshEventsBtn) {
        refreshEventsBtn.addEventListener('click', loadRecentEvents);
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark');
            this.innerHTML = document.body.classList.contains('dark') ? 
                '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
        });
    }
    
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', function() {
            document.querySelector('.notification-badge').style.display = 'none';
            alert('Notificaciones marcadas como leídas');
        });
    }
});

window.refreshDashboard = refreshAllData;
window.firebaseDB = db;