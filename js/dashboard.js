//  Mapeo de nombres a iniciales 
const NAME_MAP = {
  'Jazz Novelo':       'JN',
  'Juan Manuel Garza': 'JM',
  'Eduardo Rodriguez': 'ER',
};

// Color fijo por persona
const ASSIGNEE_COLORS = {
  'JN': '#c084fc',
  'ER': '#00c9ff',
  'JM': '#ffa87c',
};

// Helpers
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

function dueBadge(dueDate, status) {
  if (!dueDate) return '<span style="color:#4b5563;font-size:0.72rem">—</span>';
  const short = dueDate.slice(2); // 2026-06-30 → 26-06-30
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  // Done: solo fecha en gris, sin semaforo
  if (status && status.toLowerCase() === 'done') {
    return `<span style="font-family:'DM Mono',monospace;font-size:0.72rem;color:#6b7280">${short}</span>`;
  }

  // Activas: semaforo por dias restantes
  if (diffDays < 0) {
    return `<span title="Vencida hace ${Math.abs(diffDays)} dia(s)">🔴 ${short}</span>`;
  } else if (diffDays <= 1) {
    return `<span title="Vence en ${diffDays} dia(s)">🔴 ${short}</span>`;
  } else if (diffDays <= 8) {
    return `<span title="Vence en ${diffDays} dia(s)">🟡 ${short}</span>`;
  } else {
    return `<span title="Vence en ${diffDays} dia(s)">🟢 ${short}</span>`;
  }
}

function count(arr, key) {
  return arr.reduce((acc, i) => {
    acc[i[key]] = (acc[i[key]] || 0) + 1;
    return acc;
  }, {});
}

//  Chart defaults
Chart.defaults.color = '#6b7280';
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.font.size = 11;

const COLORS = ['#00c9ff','#ff86a7','#ffa87c','#36d399','#fbbf24','#c084fc','#f97316','#ec4899'];
const MONTH_COLORS = ['#a7c264','#36d399','#00ead7','#00dbf4','#00c9ff','#6c91ea','#c084fc','#ff7bd7','#ff86a7','#ffa87c','#ff9f43','#ffd164',];
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

// Tabla
let allIssues = [];
let tableLimit = 10;

function renderTable(issues) {
  const tbody = $('issues-table');
  const slice = issues.slice(0, tableLimit);
  tbody.innerHTML = slice.map(i => `
    <tr>
      <td><span class="issue-key">${i.key}</span></td>
      <td style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.summary}</td>
      <td>${statusBadge(i.status)}</td>
      <td>${priorityBadge(i.priority)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#6b7280">${i.updated.slice(2)}</td>
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

//  Main 
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

    // Chart prioridad — leyenda HTML a la izquierda
    const byPriority = count(iniciativas, 'priority');
    const prioLabels = Object.keys(byPriority);
    const prioColors = prioLabels.map(p => PRIORITY_COLORS[p.toLowerCase()] || '#6b7280');

    // Inyectar leyenda en el div #prio-legend
    const prioTotal = Object.values(byPriority).reduce((a, b) => a + b, 0);
    $('prio-legend').innerHTML = prioLabels.map((label, i) => {
      const val = byPriority[label];
      const pct = prioTotal ? Math.round((val / prioTotal) * 100) : 0;
      return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <div style="width:14px;height:14px;border-radius:50%;background:${prioColors[i]};flex-shrink:0"></div>
        <span style="font-family:'DM Mono',monospace;font-size:0.85rem;color:#9ca3af;white-space:nowrap">${label} · ${val} (${pct}%)</span>
      </div>
    `;
    }).join('');

    new Chart($('chartPriority'), {
      type: 'doughnut',
      data: {
        labels: prioLabels,
        datasets: [{ data: Object.values(byPriority), backgroundColor: prioColors, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false } }
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

    // Chart responsable — activas (excluye Done)
    const iniciativasActivas = iniciativas.filter(i => i.status.toLowerCase() !== 'done');
    const byAssigneeActivas = count(iniciativasActivas, 'assignee');
    const top8activas = Object.entries(byAssigneeActivas).sort((a,b) => b[1]-a[1]).slice(0,8);
    const labelsActivas = top8activas.map(([a]) => NAME_MAP[a] || a);
    hbar(
      'chartAssignee',
      labelsActivas,
      top8activas.map(([, val]) => val),
      labelsActivas.map(k => ASSIGNEE_COLORS[k] || '#6b7280')
    );

    // Chart responsable — total histórico (incluye Done)
    const byAssigneeTotal = count(iniciativas, 'assignee');
    const top8total = Object.entries(byAssigneeTotal).sort((a,b) => b[1]-a[1]).slice(0,8);
    const labelsTotal = top8total.map(([a]) => NAME_MAP[a] || a);
    hbar(
      'chartAssigneeTotal',
      labelsTotal,
      top8total.map(([, val]) => val),
      labelsTotal.map(k => ASSIGNEE_COLORS[k] || '#6b7280')
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
    const epicsByIniciativaList = {};
    const storiesByEpicList = {};

    issues.forEach(i => {
      if (i.parent_type === 'Iniciativa' && i.parent_key) {
        if (i.type === 'Epic') {
          epicasByIniciativa[i.parent_key] = (epicasByIniciativa[i.parent_key] || 0) + 1;
          epicsByIniciativaList[i.parent_key] = epicsByIniciativaList[i.parent_key] || [];
          epicsByIniciativaList[i.parent_key].push(i);
        }
        issuesCountByIniciativa[i.parent_key] = (issuesCountByIniciativa[i.parent_key] || 0) + 1;
      }
      if (i.type === 'Story' && i.parent_type === 'Epic' && i.parent_key) {
        storiesByEpicList[i.parent_key] = storiesByEpicList[i.parent_key] || [];
        storiesByEpicList[i.parent_key].push(i);
      }
    });

    function calidadDot(hasIt, label) {
      const cls = hasIt ? 'ok' : 'bad';
      const symbol = hasIt ? '✓' : '✗';
      return `<span class="calidad-dot ${cls}">${symbol} ${label}</span>`;
    }

function ordenarPorClave(arr) {
      return arr.slice().sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    }

    function renderIniciativaDetail(ini) {
      const epics = ordenarPorClave(epicsByIniciativaList[ini.key] || []);
      if (epics.length === 0) {
        return `<div class="detail-empty">Esta iniciativa no tiene épicas.</div>`;
      }
      return epics.map(epic => {
        const stories = ordenarPorClave(storiesByEpicList[epic.key] || []);
        const storiesHtml = stories.map(st => `
          <div class="detail-row-story">
            <span class="issue-key">${st.key}</span>
            <span class="detail-summary">${st.summary}</span>
            ${calidadDot(st.has_description, 'Description')}
            ${calidadDot(st.has_acceptance_criteria, 'CriterioAcep')}
          </div>
        `).join('');
        return `
          <div class="detail-epic-block">
            <div class="detail-row-epic">
              <span class="expand-chevron-sm">▸</span>
              <span class="issue-key">${epic.key}</span>
              <span class="detail-summary">${epic.summary}</span>
              ${calidadDot(epic.has_description, 'Description')}
              ${calidadDot(epic.has_acceptance_criteria, 'CriterioAcep')}
            </div>
            <div class="detail-stories" style="display:none">
              ${storiesHtml || '<div class="detail-empty">Sin storys</div>'}
            </div>
          </div>
        `;
      }).join('');
    }

    const STATUS_ORDER = { 'in progress': 0, 'to do': 1, 'done': 2 };
    const iniciativasSorted = [...iniciativas].sort((a,b) => {
      const orderA = STATUS_ORDER[a.status.toLowerCase()] ?? 1;
      const orderB = STATUS_ORDER[b.status.toLowerCase()] ?? 1;
      if (orderA !== orderB) return orderA - orderB;
      const numA = parseInt(a.summary) || 99999;
      const numB = parseInt(b.summary) || 99999;
      return numA - numB;
    });

    const tbodyIn = $('iniciativas-table');
    tbodyIn.addEventListener('click', (e) => {
      const iniRow = e.target.closest('.ini-row');
      if (iniRow) {
        const key = iniRow.dataset.iniKey;
        const detail = tbodyIn.querySelector(`.ini-detail[data-ini-key="${key}"]`);
        const chevron = iniRow.querySelector('.expand-chevron');
        const isOpen = detail.style.display === 'block';
        detail.style.display = isOpen ? 'none' : 'block';
        chevron.classList.toggle('open', !isOpen);
        return;
      }
      const epicRow = e.target.closest('.detail-row-epic');
      if (epicRow) {
        const stories = epicRow.nextElementSibling;
        const chevron = epicRow.querySelector('.expand-chevron-sm');
        const isOpen = stories.style.display === 'block';
        stories.style.display = isOpen ? 'none' : 'block';
        chevron.classList.toggle('open', !isOpen);
      }
    });

    function rowIniciativa(ini, idx) {
      return `
        <tr class="ini-row" data-ini-key="${ini.key}">
          <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted)"><span class="expand-chevron">▸</span> ${idx + 1}</td>
          <td><span class="issue-key">${ini.key}</span></td>
          <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ini.summary}</td>
          <td>${statusBadge(ini.status)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.72rem;white-space:nowrap">${dueBadge(ini.due_date, ini.status)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.72rem;text-align:center;color:var(--muted)">${NAME_MAP[ini.assignee] || ini.assignee || '—'}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent)">${epicasByIniciativa[ini.key] || 0}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent3)">${issuesCountByIniciativa[ini.key] || 0}</td>
        </tr>
        <tr class="ini-detail" data-ini-key="${ini.key}" style="display:none">
          <td colspan="8">${renderIniciativaDetail(ini)}</td>
        </tr>
      `;
    }

    let activeStatusTab = 'in progress';

    function renderIniciativasTab(list) {
      const filtered = list.filter(i => {
        const statusKey = i.status.toLowerCase();
        const groupKey = STATUS_ORDER[statusKey] !== undefined ? statusKey : 'to do';
        return groupKey === activeStatusTab;
      });
      tbodyIn.innerHTML = filtered.map((ini, idx) => rowIniciativa(ini, idx)).join('');
    }

    function updateTabCounts(list) {
      document.querySelectorAll('.status-tab').forEach(btn => {
        const key = btn.dataset.status;
        const count = list.filter(i => {
          const statusKey = i.status.toLowerCase();
          const groupKey = STATUS_ORDER[statusKey] !== undefined ? statusKey : 'to do';
          return groupKey === key;
        }).length;
        const label = key === 'in progress' ? 'In progress' : key === 'to do' ? 'To do' : 'Done';
        btn.textContent = `${label} · ${count}`;
      });
    }

    updateTabCounts(iniciativasSorted);
    renderIniciativasTab(iniciativasSorted);

    document.querySelectorAll('.status-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStatusTab = btn.dataset.status;
        const q = $('search-iniciativas').value.toLowerCase();
        const base = q
          ? iniciativasSorted.filter(i =>
              i.key.toLowerCase().includes(q) ||
              i.summary.toLowerCase().includes(q) ||
              i.assignee.toLowerCase().includes(q)
            )
          : iniciativasSorted;
        renderIniciativasTab(base);
      });
    });

    $('search-iniciativas').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = iniciativasSorted.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.assignee.toLowerCase().includes(q)
      );
      updateTabCounts(filtered);
      renderIniciativasTab(filtered);
    });

    // Tabla actividad reciente
    const sorted = [...issues].sort((a,b) => b.updated.localeCompare(a.updated));
    allIssues = sorted;
    renderTable(sorted);

    // Grafica por mes iniciativas cerrada
    const bimestreLabels = ['Ene 26', 'Feb 26', 'Mar 26', 'Abr 26', 'May 26', 'Jun 26', 'Jul 26', 'Ago 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dic 26'];
    const bimestreRanges = [
      ['2026-01-01', '2026-01-31'],
      ['2026-02-01', '2026-02-28'],
      ['2026-03-01', '2026-03-31'],
      ['2026-04-01', '2026-04-30'],
      ['2026-05-01', '2026-05-31'],
      ['2026-06-01', '2026-06-30'],
      ['2026-07-01', '2026-07-31'],
      ['2026-08-01', '2026-08-31'],
      ['2026-09-01', '2026-09-30'],
      ['2026-10-01', '2026-10-31'],
      ['2026-11-01', '2026-11-30'],
      ['2026-12-01', '2026-12-31'],
    ];
    const bimestreData = bimestreRanges.map(([start, end]) =>
      iniciativas.filter(i => {
        if (i.status.toLowerCase() !== 'done' || !i.due_date) return false;
        return i.due_date >= start && i.due_date <= end;
      }).length
    );

    new Chart($('chartBimestre'), {
      type: 'bar',
      data: {
        labels: bimestreLabels,
        datasets: [{
          data: bimestreData,
          backgroundColor: bimestreLabels.map((_, i) => MONTH_COLORS[i % MONTH_COLORS.length]),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} iniciativa${ctx.parsed.y !== 1 ? 's' : ''}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#6b7280', stepSize: 1 },
            beginAtZero: true,
            max: Math.max(...bimestreData) + 1
          }
        }
      },
      plugins: [{
        id: 'topLabels',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          chart.getDatasetMeta(0).data.forEach((bar, i) => {
            const val = data.datasets[0].data[i];
            ctx.save();
            ctx.font = "bold 11px 'DM Mono', monospace";
            ctx.fillStyle = '#e8eaf0';
            ctx.textAlign = 'center';
            ctx.fillText(val, bar.x, bar.y - 6);
            ctx.restore();
          });
        }
      }]
    });

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
