/* Graphiques du back office (Chart.js) */
Chart.defaults.color = 'rgba(226,232,240,.72)';
Chart.defaults.font.family = 'Archivo, sans-serif';
Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
const crFmt = n => new Intl.NumberFormat('fr-FR').format(n);
function crLine(id, d) {
  const el = document.getElementById(id); if (!el) return;
  const ctx = el.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, el.parentNode.clientHeight || 280);
  g.addColorStop(0, 'rgba(228,87,46,.32)'); g.addColorStop(1, 'rgba(228,87,46,0)');
  new Chart(el, {
    type: 'line',
    data: { labels: d.labels, datasets: [
      { label: 'Pages vues', data: d.pv, borderColor: '#F07A55', backgroundColor: g, fill: true, tension: .3, pointRadius: d.labels.length > 40 ? 0 : 2.5, borderWidth: 2 },
      { label: 'Visiteurs', data: d.visitors, borderColor: '#7DB3FF', backgroundColor: 'transparent', tension: .3, pointRadius: 0, borderWidth: 1.6, borderDash: [4, 4] }
    ]},
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + crFmt(c.parsed.y) } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, callback: v => crFmt(v) } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } } }
  });
}
function crDonut(id, labels, values) {
  const el = document.getElementById(id); if (!el) return;
  new Chart(el, { type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: ['#F07A55', '#7DB3FF', '#F2D33A', '#F59E2E', '#C084FC', '#F87171', '#94A3B8'], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: { callbacks: { label: c => ' ' + c.label + ' : ' + crFmt(c.parsed) } } } }
  });
}
