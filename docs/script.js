// ----- script.js (lógica principal) -----


// Firebase config (tuya)
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


// DataTables init
const usersTable = $('#users-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, language:{ search:'Buscar:' } });
const leaderboardTable = $('#leaderboard-table').DataTable({ paging:true, searching:true, info:false, pageLength:6, lengthChange:false, order:[[2,'desc']], language:{ search:'Buscar:' } });


// Charts contexts
const lbCtx = document.getElementById('leaderboardChart')?.getContext('2d');
const sdCtx = document.getElementById('sensorsDonut')?.getContext('2d');


// Theme toggler
const themeToggle = document.getElementById('theme-toggle');
(function initTheme(){
const saved = localStorage.getItem('eco_theme');
if(saved === 'dark') document.body.classList.add('dark');
})();
if(themeToggle) themeToggle.addEventListener('click', ()=>{
document.body.classList.toggle('dark');
localStorage.setItem('eco_theme', document.body.classList.contains('dark') ? 'd
