// ==============================
// Funciones para crear gráficos
// ==============================
(function(){
window.createLeaderboardChart = function(ctx, labels, points){
    if(!ctx) return null;
    if(window.leaderboardChart?.destroy) window.leaderboardChart.destroy();
    return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets:[{ label:'Puntos', data: points, backgroundColor:'#2f7a4a', borderRadius:8 }]},
        options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
};

window.createSensorsDonut = function(ctx, dataArr, labels){
    if(!ctx) return null;
    if(window.sensorsDonutChart?.destroy) window.sensorsDonutChart.destroy();
    return new Chart(ctx, {
        type:'doughnut',
        data:{ labels, datasets:[{ data:dataArr, backgroundColor:['#2f7a4a','#89c47b','#e05757'] }] },
        options:{ responsive:true, plugins:{legend:{position:'bottom'}} }
    });
};
})();
