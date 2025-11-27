// Visualizaciones con Chart.js separadas para claridad
(function(){
window.createLeaderboardChart = function(ctx, labels, points){
if(!ctx) return null;
if(window.leaderboardChart && typeof window.leaderboardChart.destroy === 'function') window.leaderboardChart.destroy();
return new Chart(ctx, {
type: 'bar',
data: { labels: labels, datasets: [{ label:'Puntos', data: points, backgroundColor: '#2f7a4a', borderRadius:8 }]},
options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
});
};


window.createSensorsDonut = function(ctx, dataArr, labels){
if(!ctx) return null;
if(window.sensorsDonut && typeof window.sensorsDonut.destroy === 'function') window.sensorsDonut.destroy();
return new Chart(ctx, {
type: 'doughnut',
data: { labels: labels, datasets:[{ data: dataArr, backgroundColor:['#2f7a4a','#89c47b','#cfead7','#e05757','#f3b46b'] }]},
options: { responsive:true, plugins:{legend:{position:'bottom'}} }
});
};
})();
