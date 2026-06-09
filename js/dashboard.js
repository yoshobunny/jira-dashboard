// ── Mapeo de nombres a iniciales ──────────────────────────
const NAME_MAP = {
  'Jazz Novelo':       'JN',
  'Juan Manuel Garza': 'JM',
  'Eduardo Rodriguez': 'ER',
};

// ── Helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

function statusBadge(s) {
  const map = {
    'done':        ['badge-done',     'Done'],
    'in progress': ['badge-progress', 'In Progress'],
    'to do':       ['badge-todo',     'To Do'],
  };
  const [cls, label] = map[s.toLowerCase()] || ['badge-todo', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function priorityBadge(p) {
  const map = {
    'highest': ['badge-high',   'Highest'],
    'high':    ['badge-high',   'High'],
    'medium':  ['badge-medium', 'Medium'],
    'low':     ['badge-low',    'Low'],
    'lowest':  ['badge-low',    'Lowest'],
  };
  const [cls, label] = map[p.toLowerCase()] || ['badge-low', p];
  return `<span class="badge ${cls}">${label}</span>`;
}

function count(arr, key) {
  return arr.reduce((acc, i) => {
    acc[i[key]] = (acc[i[key]] || 0) + 1;
    return acc;
  }, {});
}

// ── Chart defaults ────────────────────────────────────────
Chart.defaults.color = '#6b7280';
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.font.size = 11;

const COLORS = ['#00c9ff','#ff86a7','#ffa87c','#36d399','#fbbf24','#c084fc','#f97316','#ec4899'];

const PRIORITY_COLORS = {
  'highest': '#ff6b6b',
  'high':    '#ffa87c',
  'medium':  '#00c9ff',
  'low':     '#36d399',
  'lowest':  '#c084fc',
  'sin prioridad': '#6b7280',
};

function donut(id, labels, data) {
  new Chart($(id), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 14, color: '#9ca3af' }
        }
      }
    }
  });
}

function hbar(id, labels, data, color) {
  new Chart($(id), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: color || '#4f7cff',
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280' } },
        y: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      }
    }
  });
}

function line(id, labels, data) {
  new Chart($(id), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#4f7cff',
        backgroundColor: 'rgba(79,124,255,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#4f7cff',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', stepSize: 1 } }
      }
    }
  });
}

// ── Tabla ─────────────────────────────────────────────────
let allIssues = [];
let tableLimit = 15;

function renderTable(issues) {
  const tbody = $('issues-table');
  const slice = issues.slice(0, tableLimit);
  tbody.innerHTML = slice.map(i => `
    <tr>
      <td><span class="issue-key">${i.key}</span></td>
      <td style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.summary}</td>
      <td>${statusBadge(i.status)}</td>
      <td>${priorityBadge(i.priority)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#6b7280">${i.updated}</td>
    </tr>
  `).join('');
}

$('search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderTable(allIssues.filter(i =>
    i.key.toLowerCase().includes(q) ||
    i.summary.toLowerCase().includes(q) ||
    i.assignee.toLowerCase().includes(q)
  ));
});

// ── Main ──────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`No se pudo cargar data.json (${res.status})`);
    const issues = await res.json();

    allIssues = issues;

    // Filtrar solo Iniciativas para KPIs
    const iniciativas = issues.filter(i => i.type === 'Iniciativa');

    const total = iniciativas.length;
    const byStatus = count(iniciativas, 'status');

    // Normalizar claves
    const done = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() === 'done')
      .reduce((s, [,v]) => s + v, 0);
    const prog = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() === 'in progress')
      .reduce((s, [,v]) => s + v, 0);
    const todo = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() === 'to do')
      .reduce((s, [,v]) => s + v, 0);

    $('kpi-total').textContent = total;
    $('kpi-done').textContent  = done;
    $('kpi-prog').textContent  = prog;
    $('kpi-todo').textContent  = todo;
    $('kpi-done-pct').textContent = `${Math.round(done/total*100)}% del total`;
    $('kpi-prog-pct').textContent = `${Math.round(prog/total*100)}% del total`;
    $('kpi-todo-pct').textContent = `${Math.round(todo/total*100)}% del total`;

    // Progress bar
    const donePct = Math.round(done/total*100);
    const progPct = Math.round(prog/total*100);
    $('bar-done').style.width = donePct + '%';
    $('bar-prog').style.width = progPct + '%';
    $('pct-label').textContent = donePct + '%';
    document.querySelector('.progress-track').setAttribute('data-tooltip',
      `Done: ${done} (${donePct}%)  |  In Progress: ${prog} (${progPct}%)  |  To Do: ${todo} (${Math.round(todo/total*100)}%)`
    );

    // Fecha
    $('update-date').textContent = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // STATUS COLORS
    const STATUS_COLORS = {
      'done':        '#36d399',
      'in progress': '#00c9ff',
      'to do':       '#ffd164',
    };
    function getStatusColor(s) {
      return STATUS_COLORS[s.toLowerCase()] || '#a78bfa';
    }

    // Chart barras verticales — iniciativas por estatus
    const statusLabels = Object.keys(byStatus);
    const statusVals   = Object.values(byStatus);
    const statusColors = statusLabels.map(getStatusColor);

    new Chart($('chartStatusBar'), {
      type: 'bar',
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusVals,
          backgroundColor: statusColors,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} iniciativas` } },
          datalabels: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#6b7280', stepSize: 1 },
            beginAtZero: true,
            max: Math.max(...statusVals) + 2
          }
        }
      },
      plugins: [{
        id: 'topLabels',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          chart.getDatasetMeta(0).data.forEach((bar, i) => {
            const val = data.datasets[0].data[i];
            const pct = Math.round(val / total * 100);
            ctx.save();
            ctx.font = "bold 11px 'DM Mono', monospace";
            ctx.fillStyle = '#e8eaf0';
            ctx.textAlign = 'center';
            ctx.fillText(`${val} (${pct}%)`, bar.x, bar.y - 6);
            ctx.restore();
          });
        }
      }]
    });

    // Chart prioridad
    const byPriority = count(iniciativas, 'priority');
    const prioLabels = Object.keys(byPriority);
    const prioColors = prioLabels.map(p => PRIORITY_COLORS[p.toLowerCase()] || '#6b7280');
    new Chart($('chartPriority'), {
      type: 'doughnut',
      data: {
        labels: prioLabels,
        datasets: [{ data: Object.values(byPriority), backgroundColor: prioColors, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, padding: 14, color: '#9ca3af' } } }
      }
    });

    // Chart issues por iniciativa — top 8
    const issuesByIniciativa = {};
    iniciativas.forEach(i => { issuesByIniciativa[i.summary] = 0; });
    issues.forEach(i => {
      if (i.parent_type === 'Iniciativa' && i.parent_summary) {
        issuesByIniciativa[i.parent_summary] = (issuesByIniciativa[i.parent_summary] || 0) + 1;
      }
    });
    const topIniciativas = Object.entries(issuesByIniciativa)
      .sort((a,b) => b[1]-a[1]).slice(0,8);
    hbar('chartType',
      topIniciativas.map(e => e[0].length > 30 ? e[0].slice(0,30)+'…' : e[0]),
      topIniciativas.map(e => e[1]),
      '#a78bfa');

    // Chart responsable — con NAME_MAP aplicado
    const byAssignee = count(iniciativas, 'assignee');
    const top8 = Object.entries(byAssignee).sort((a,b) => b[1]-a[1]).slice(0,8);
    hbar(
      'chartAssignee',
      top8.map(([assignee]) => NAME_MAP[assignee] || assignee), // ← aquí se aplica el mapeo
      top8.map(([, val]) => val),
      COLORS
    );

    // Charts — actividad últimos 30 días
    const today = new Date();
    const days = Array.from({length: 30}, (_,i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0,10);
    });
    const actMap = {};
    days.forEach(d => actMap[d] = 0);
    issues.forEach(i => { if (actMap[i.updated] !== undefined) actMap[i.updated]++; });
    const actLabels = days.map(d => d.slice(5)); // MM-DD
    line('chartActivity', actLabels, days.map(d => actMap[d]));

    // Tabla de iniciativas
    const epicasByIniciativa = {};
    const issuesCountByIniciativa = {};

    issues.forEach(i => {
      if (i.parent_type === 'Iniciativa' && i.parent_key) {
        if (i.type === 'Epic') {
          epicasByIniciativa[i.parent_key] = (epicasByIniciativa[i.parent_key] || 0) + 1;
        }
        issuesCountByIniciativa[i.parent_key] = (issuesCountByIniciativa[i.parent_key] || 0) + 1;
      }
    });

    const iniciativasSorted = [...iniciativas].sort((a,b) => {
      const numA = parseInt(a.summary) || 99999;
      const numB = parseInt(b.summary) || 99999;
      return numA - numB;
    });

    const tbodyIn = $('iniciativas-table');
    tbodyIn.innerHTML = iniciativasSorted.map((ini, idx) => `
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted)">${idx + 1}</td>
        <td><span class="issue-key">${ini.key}</span></td>
        <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ini.summary}</td>
        <td>${statusBadge(ini.status)}</td>
        <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent)">${epicasByIniciativa[ini.key] || 0}</td>
        <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent3)">${issuesCountByIniciativa[ini.key] || 0}</td>
      </tr>
    `).join('');

    $('search-iniciativas').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = iniciativasSorted.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.assignee.toLowerCase().includes(q)
      );
      tbodyIn.innerHTML = filtered.map((ini, idx) => `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted)">${idx + 1}</td>
          <td><span class="issue-key">${ini.key}</span></td>
          <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ini.summary}</td>
          <td>${statusBadge(ini.status)}</td>
          <td style="color:#9ca3af;font-size:0.78rem">${ini.assignee}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent)">${epicasByIniciativa[ini.key] || 0}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent3)">${issuesCountByIniciativa[ini.key] || 0}</td>
        </tr>
      `).join('');
    });

    // Tabla actividad reciente
    const sorted = [...issues].sort((a,b) => b.updated.localeCompare(a.updated));
    allIssues = sorted;
    renderTable(sorted);

    // Show
    $('loading').style.display  = 'none';
    $('dashboard').style.display = 'block';

  } catch (err) {
    $('loading').style.display = 'none';
    $('error-msg').style.display = 'block';
    $('error-msg').innerHTML = `
      <strong>⚠ No se pudo cargar data.json</strong><br><br>
      ${err.message}<br><br>
      Asegúrate de que:<br>
      • El archivo <code>data.json</code> existe en la misma carpeta que este HTML<br>
      • Estás abriendo el archivo desde un servidor local (no directo desde el Finder)<br>
      • Corre: <code>python3 -m http.server 8000</code> y abre <code>http://localhost:8000</code>
    `;
  }
}

init();
