//  Mapeo de nombres a iniciales 
const NAME_MAP = {
  'Eduardo Rodriguez':  'ER',
  'Jazz Novelo':        'JN',
  'Juan Manuel Garza':  'JM',
  'Carlos Garcia':      'CA',
  'Montserrat Valerio': 'MV',
};

// Color fijo por persona
const ASSIGNEE_COLORS = {
  'JN': '#c084fc',
  'ER': '#00c9ff',
  'JM': '#ffa87c',
  'MV': '#ff86a7',
  'CA': '#36d399',
};

// Helpers
const $ = id => document.getElementById(id);


// ===== Vista General / Quarters (ciclo Tecmilenio: agosto a julio) =====
let RAW_ISSUES   = [];
let currentView  = 'general';     // 'general' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
let currentCycle = cicloActual(); // año en que inicia el ciclo (2026 = ago 2026 a jul 2027)

// Filtros de la tabla (se conservan al cambiar de vista)
let activeStatusTab = 'in progress';
let activeAssigneeFilter = 'all';

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function cicloActual() {
  const hoy = new Date();
  return hoy.getMonth() + 1 >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1;
}

// Fecha que define el quarter: End Date, si no Start Date, si no Created
function fechaBaseQuarter(i) {
  if (i.due_date)   return { fecha: i.due_date.slice(0, 10),   base: 'End Date' };
  if (i.start_date) return { fecha: i.start_date.slice(0, 10), base: 'fecha de inicio' };
  if (i.created)    return { fecha: i.created.slice(0, 10),    base: 'fecha de creación' };
  return null;
}

function quarterDe(i) {
  const fb = fechaBaseQuarter(i);
  if (!fb) return null;
  const y = parseInt(fb.fecha.slice(0, 4), 10);
  const m = parseInt(fb.fecha.slice(5, 7), 10); // 1 a 12
  const idx = (m - 8 + 12) % 12;                 // ago = 0 ... jul = 11
  return {
    cycle: m >= 8 ? y : y - 1,
    q: 'Q' + (Math.floor(idx / 3) + 1),
    fecha: fb.fecha,
    base: fb.base,
  };
}

function grupoEstatus(i) {
  const s = i.status.toLowerCase();
  return (s === 'in progress' || s === 'done') ? s : 'to do';
}

// Mes absoluto (año * 12 + mes de 0 a 11) para recorrer rangos
function mesInicioQuarter(cycle, q) {
  return cycle * 12 + 7 + (parseInt(q.slice(1), 10) - 1) * 3; // 7 = agosto
}
function mesAbsTxt(abs) {
  return `${MESES_CORTOS[abs % 12]} ${Math.floor(abs / 12)}`;
}

function vistaLabel() {
  if (currentView === 'general') return 'General (todas las iniciativas)';
  const ini = mesInicioQuarter(currentCycle, currentView);
  return `${currentView} ciclo ${currentCycle}-${currentCycle + 1} (${mesAbsTxt(ini)} a ${mesAbsTxt(ini + 2)})`;
}

// Iniciativas de la vista + sus épicas y storys/tasks
function getViewData() {
  const iniAll = RAW_ISSUES.filter(i => i.type === 'Iniciativa');
  const iniciativas = currentView === 'general'
    ? iniAll
    : iniAll.filter(i => {
        const q = quarterDe(i);
        return q && q.cycle === currentCycle && q.q === currentView;
      });
  const iniKeys = new Set(iniciativas.map(i => i.key));
  const epics = RAW_ISSUES.filter(i =>
    i.type === 'Epic' && i.parent_type === 'Iniciativa' && iniKeys.has(i.parent_key));
  const epicKeys = new Set(epics.map(e => e.key));
  const stories = RAW_ISSUES.filter(i =>
    (i.type === 'Story' || i.type === 'Task') && i.parent_type === 'Epic' && epicKeys.has(i.parent_key));
  const issues = currentView === 'general' ? RAW_ISSUES : [...iniciativas, ...epics, ...stories];
  return { iniciativas, issues, epics, stories };
}

// Meses para la gráfica "Cierres por mes"
function mesesDeVista(iniciativas) {
  let inicio, fin;
  if (currentView !== 'general') {
    inicio = mesInicioQuarter(currentCycle, currentView);
    fin = inicio + 2;
  } else {
    const absDe = f => parseInt(f.slice(0, 4), 10) * 12 + parseInt(f.slice(5, 7), 10) - 1;
    const meses = iniciativas
      .filter(i => i.status.toLowerCase() === 'done' && i.due_date)
      .map(i => absDe(i.due_date));
    if (meses.length) {
      inicio = Math.min(...meses);
      fin = Math.max(...meses);
    } else {
      inicio = mesInicioQuarter(currentCycle, 'Q1');
      fin = inicio + 11;
    }
  }
  const lista = [];
  for (let a = inicio; a <= fin; a++) {
    const y = Math.floor(a / 12), m = a % 12;
    const mm = String(m + 1).padStart(2, '0');
    const ult = String(new Date(y, m + 1, 0).getDate()).padStart(2, '0');
    lista.push({
      label: `${MESES_CORTOS[m]} ${String(y).slice(2)}`,
      start: `${y}-${mm}-01`,
      end: `${y}-${mm}-${ult}`,
      monthIdx: m,
    });
  }
  return lista;
}

// Celda Fecha fin: semáforo o etiqueta "Sin fecha fin"
function fechaFinCell(ini) {
  if (ini.due_date) return dueBadge(ini.due_date, ini.status);
  const q = quarterDe(ini);
  const tip = q
    ? `Sin End Date. Quarter ${q.q} asignado por ${q.base} (${q.fecha})`
    : 'Sin End Date';
  return `<span class="badge-sin-fecha" title="${tip}">Sin fecha fin</span>`;
}

function actualizarBarraVista(iniciativas) {
  $('view-bar').classList.toggle('is-general', currentView === 'general');
  const sinFecha = iniciativas.filter(i => !i.due_date).length;
  $('view-hint').textContent =
    `${vistaLabel()} · ${iniciativas.length} ${iniciativas.length === 1 ? 'iniciativa' : 'iniciativas'}` +
    (sinFecha ? ` · ${sinFecha} sin fecha fin` : '');
}

function setupViewBar() {
  // Ciclos disponibles según los datos (siempre incluye el actual)
  const ciclos = new Set([cicloActual()]);
  RAW_ISSUES.filter(i => i.type === 'Iniciativa').forEach(i => {
    const q = quarterDe(i);
    if (q) ciclos.add(q.cycle);
  });
  const sel = $('cycle-select');
  sel.innerHTML = [...ciclos].sort((a, b) => b - a)
    .map(c => `<option value="${c}">Ciclo ${c}-${c + 1}</option>`).join('');
  sel.value = currentCycle;
  sel.onchange = () => {
    currentCycle = parseInt(sel.value, 10);
    renderDashboard();
  };

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderDashboard();
    };
  });

  // Menú de descarga
  const dBtn = $('download-btn');
  const menu = $('download-menu');
  dBtn.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('button').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      menu.classList.remove('open');
      if (b.dataset.format === 'pdf') descargarPDF();
      else descargarExcel();
    };
  });
}

function nombreArchivo() {
  const hoy = new Date().toISOString().slice(0, 10);
  return currentView === 'general'
    ? `Tablero_GdlU_General_${hoy}`
    : `Tablero_GdlU_${currentView}_${currentCycle}-${currentCycle + 1}_${hoy}`;
}

// ===== Descarga PDF (foto del tablero con la vista actual) =====
async function descargarPDF() {
  const btn = $('download-btn');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Generando PDF...';
  btn.disabled = true;
  try {
    let bg = getComputedStyle(document.body).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#0f1117';
    const canvas = await html2canvas($('dashboard'), { scale: 2, backgroundColor: bg, useCORS: true });
    const w = canvas.width / 2;
    const h = canvas.height / 2;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
    pdf.save(`${nombreArchivo()}.pdf`);
  } catch (err) {
    console.error('Error al generar PDF', err);
    alert('No se pudo generar el PDF. Revisa la consola para más detalle.');
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}

// ===== Descarga Excel (datos de la vista actual) =====
function descargarExcel() {
  const { iniciativas, epics, stories } = getViewData();
  const ORDEN = { 'in progress': 0, 'to do': 1, 'done': 2 };
  const inis = [...iniciativas].sort((a, b) =>
    (ORDEN[grupoEstatus(a)] - ORDEN[grupoEstatus(b)]) ||
    ((parseInt(a.summary) || 99999) - (parseInt(b.summary) || 99999)));

  // Conteos de épicas y storys por iniciativa
  const epicsPorIni = {}, storiesPorIni = {}, epicToIni = {};
  epics.forEach(e => {
    epicsPorIni[e.parent_key] = (epicsPorIni[e.parent_key] || 0) + 1;
    epicToIni[e.key] = e.parent_key;
  });
  stories.forEach(s => {
    const k = epicToIni[s.parent_key];
    if (k) storiesPorIni[k] = (storiesPorIni[k] || 0) + 1;
  });

  // Hoja Resumen
  const total = inis.length;
  const cuenta = g => inis.filter(i => grupoEstatus(i) === g).length;
  const pct = n => total ? Math.round(n / total * 100) : 0;
  const prog = cuenta('in progress'), todo = cuenta('to do'), done = cuenta('done');
  const resumen = [
    ['Tablero', 'Gestión de la Universidad (UGSU01)'],
    ['Vista', vistaLabel()],
    ['Descargado', new Date().toLocaleString('es-MX')],
    [],
    ['Estatus', 'Iniciativas', '% del total'],
    ['In progress', prog, pct(prog)],
    ['To do', todo, pct(todo)],
    ['Done', done, pct(done)],
    ['Total', total, total ? 100 : 0],
    [],
    ['Iniciativas sin fecha fin', inis.filter(i => !i.due_date).length],
  ];

  // Hoja Iniciativas
  const filasIni = inis.map((ini, idx) => {
    const q = quarterDe(ini);
    return {
      '#': idx + 1,
      'Clave': ini.key,
      'Iniciativa': ini.summary,
      'Estatus': ini.status,
      'Prioridad': ini.priority,
      'Asignee': ini.assignee,
      'Fecha fin': ini.due_date || 'Sin fecha fin',
      'Fecha inicio': ini.start_date || '',
      'Creada': ini.created || '',
      'Quarter': q ? `${q.q} ${q.cycle}-${q.cycle + 1}` : '',
      'Quarter asignado por': q ? q.base : '',
      'Épicas': epicsPorIni[ini.key] || 0,
      'Storys': storiesPorIni[ini.key] || 0,
    };
  });

  // Hoja Épicas y storys
  const siNo = v => v ? 'Sí' : 'No';
  const porClave = (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true });
  const filasDet = [];
  inis.forEach(ini => {
    epics.filter(e => e.parent_key === ini.key).sort(porClave).forEach(e => {
      filasDet.push({
        'Iniciativa': ini.key, 'Tipo': 'Épica', 'Clave': e.key, 'Resumen': e.summary,
        'Épica': '', 'Estatus': e.status, 'Asignee': e.assignee, 'Fecha fin': e.due_date || '',
        'Descripción': siNo(e.has_description), 'Criterios de aceptación': '',
        'Story points': siNo(e.has_story_points),
      });
      stories.filter(s => s.parent_key === e.key).sort(porClave).forEach(s => {
        filasDet.push({
          'Iniciativa': ini.key, 'Tipo': s.type, 'Clave': s.key, 'Resumen': s.summary,
          'Épica': e.key, 'Estatus': s.status, 'Asignee': s.assignee, 'Fecha fin': s.due_date || '',
          'Descripción': siNo(s.has_description),
          'Criterios de aceptación': siNo(s.has_acceptance_criteria),
          'Story points': siNo(s.has_story_points),
        });
      });
    });
  });

  const hoja = (ws, anchos) => {
    ws['!cols'] = anchos.map(w => ({ wch: w }));
    if (ws['!ref'] && anchos.length > 3) ws['!autofilter'] = { ref: ws['!ref'] };
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(XLSX.utils.aoa_to_sheet(resumen), [26, 45, 12]), 'Resumen');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX.utils.json_to_sheet(filasIni),
    [5, 13, 55, 13, 12, 22, 13, 13, 12, 14, 20, 8, 8]), 'Iniciativas');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX.utils.json_to_sheet(filasDet),
    [13, 8, 13, 55, 13, 13, 22, 12, 12, 22, 12]), 'Épicas y storys');
  XLSX.writeFile(wb, `${nombreArchivo()}.xlsx`);
}

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
    RAW_ISSUES = await res.json();

    setupViewBar();
    renderDashboard();

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

// Dibuja todo el tablero según la vista (General o Quarter)
function renderDashboard() {
    // Destruir gráficas anteriores antes de volver a dibujar
    Object.values(Chart.instances).forEach(c => c.destroy());

    const { iniciativas, issues } = getViewData();
    allIssues = issues;
    actualizarBarraVista(iniciativas);

    // Normalizar claves
    const done = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() === 'done')
      .reduce((s, [,v]) => s + v, 0);
    const prog = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() === 'in progress')
      .reduce((s, [,v]) => s + v, 0);
    // cualquier estatus que no sea "in progress" o "done" cae por default en "to do"
      const todo = Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase() !== 'done' && k.toLowerCase() !== 'in progress')
      .reduce((s, [,v]) => s + v, 0);

    $('kpi-total').textContent = total;
    $('kpi-done').textContent  = done;
    $('kpi-prog').textContent  = prog;
    $('kpi-todo').textContent  = todo;
    const pctDe = n => total ? Math.round(n / total * 100) : 0;
    $('kpi-done-pct').textContent = `${pctDe(done)}% del total`;
    $('kpi-prog-pct').textContent = `${pctDe(prog)}% del total`;
    $('kpi-todo-pct').textContent = `${pctDe(todo)}% del total`;

    // Progress bar
    const donePct = pctDe(done);
    const progPct = pctDe(prog);
    $('bar-done').style.width = donePct + '%';
    $('bar-prog').style.width = progPct + '%';
    $('pct-label').textContent = donePct + '% Done';
    document.querySelector('.progress-track').setAttribute('data-tooltip',
      `Done: ${done} (${donePct}%)  |  In Progress: ${prog} (${progPct}%)  |  To Do: ${todo} (${pctDe(todo)}%)`
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
            max: Math.max(0, ...statusVals) + 2
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
    const epicToIniciativa = {};

    // Primera pasada: registrar épicas y a qué iniciativa pertenecen
    issues.forEach(i => {
      if (i.type === 'Epic' && i.parent_type === 'Iniciativa' && i.parent_key) {
        epicasByIniciativa[i.parent_key] = (epicasByIniciativa[i.parent_key] || 0) + 1;
        epicsByIniciativaList[i.parent_key] = epicsByIniciativaList[i.parent_key] || [];
        epicsByIniciativaList[i.parent_key].push(i);
        epicToIniciativa[i.key] = i.parent_key;
      }
    });

    // Segunda pasada: contar Storys/Tasks reales, agrupadas por su épica y
    // sumadas hacia la iniciativa correspondiente
    issues.forEach(i => {
      if ((i.type === 'Story' || i.type === 'Task') && i.parent_type === 'Epic' && i.parent_key) {
        storiesByEpicList[i.parent_key] = storiesByEpicList[i.parent_key] || [];
        storiesByEpicList[i.parent_key].push(i);

        const iniKey = epicToIniciativa[i.parent_key];
        if (iniKey) {
          issuesCountByIniciativa[iniKey] = (issuesCountByIniciativa[iniKey] || 0) + 1;
        }
      }
    });

function tipoIcon(type) {
  const icons = { 'Story': '🔰', 'Task': '☑️' };
  return icons[type] || '';
}

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
            <div class="detail-label">
              <span title="${st.type}">${tipoIcon(st.type)}</span>
              <span class="issue-key">${st.key}</span>
              <span class="detail-summary">${st.summary}</span>
            </div>
            <span></span>
            <span class="detail-due">${dueBadge(st.due_date, st.status)}</span>
            <div class="detail-dots">
              ${calidadDot(st.has_description, 'Desc')}
              ${calidadDot(st.has_acceptance_criteria, 'CA')}
              ${calidadDot(st.has_story_points, 'SP')}
            </div>
          </div>
        `).join('');
        return `
          <div class="detail-epic-block">
            <div class="detail-row-epic">
              <div class="detail-label">
                <span class="expand-chevron-sm">▸</span>
                <span class="issue-key">${epic.key}</span>
                <span class="detail-summary">${epic.summary}</span>
              </div>
              <span></span>
              <span class="detail-due">${dueBadge(epic.due_date, epic.status)}</span>
              <div class="detail-dots">
                ${calidadDot(epic.has_description, 'Desc')}
                ${calidadDot(epic.has_story_points, 'SP')}
              </div>
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
    tbodyIn.onclick = (e) => {
      const iniRow = e.target.closest('.ini-row');
      if (iniRow) {
        const key = iniRow.dataset.iniKey;
        const detail = tbodyIn.querySelector(`.ini-detail[data-ini-key="${key}"]`);
        const chevron = iniRow.querySelector('.expand-chevron');
        const isOpen = detail.style.display === 'table-row';
        detail.style.display = isOpen ? 'none' : 'table-row';
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
     };

    function rowIniciativa(ini, idx) {
      return `
        <tr class="ini-row" data-ini-key="${ini.key}">
          <td style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted)"><span class="expand-chevron">▸</span> ${idx + 1}</td>
          <td><span class="issue-key">${ini.key}</span></td>
          <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ini.summary}</td>
          <td>${statusBadge(ini.status)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.72rem;white-space:nowrap">${fechaFinCell(ini)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.72rem;text-align:center;color:var(--muted)">${NAME_MAP[ini.assignee] || ini.assignee || '—'}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent)">${epicasByIniciativa[ini.key] || 0}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--accent3)">${issuesCountByIniciativa[ini.key] || 0}</td>
        </tr>
        <tr class="ini-detail" data-ini-key="${ini.key}" style="display:none">
          <td colspan="8">${renderIniciativaDetail(ini)}</td>
        </tr>
      `;
    }

    // Filtros de la tabla: búsqueda + responsable + pestaña de estatus
    function filtrarBusqueda(list) {
      const q = $('search-iniciativas').value.toLowerCase();
      if (!q) return list;
      return list.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.assignee.toLowerCase().includes(q)
      );
    }

    function pasaAssignee(i) {
      if (activeAssigneeFilter === 'all') return true;
      return (NAME_MAP[i.assignee] || i.assignee) === activeAssigneeFilter;
    }

    function aplicarFiltrosTabla() {
      const base = filtrarBusqueda(iniciativasSorted).filter(pasaAssignee);
      updateTabCounts(base);
      const filtered = base.filter(i => grupoEstatus(i) === activeStatusTab);
      tbodyIn.innerHTML = filtered.length
        ? filtered.map((ini, idx) => rowIniciativa(ini, idx)).join('')
        : `<tr><td colspan="8"><div class="detail-empty">Sin iniciativas para este filtro</div></td></tr>`;
    }

    function renderAssigneeTabs() {
      const initials = ['all', ...new Set(Object.values(NAME_MAP))];
      const container = $('assignee-tabs');
      container.innerHTML = initials.map(a => `
        <button class="assignee-tab${a === activeAssigneeFilter ? ' active' : ''}" data-assignee="${a}">${a === 'all' ? 'Todos' : a}</button>
      `).join('');
      container.querySelectorAll('.assignee-tab').forEach(btn => {
        btn.onclick = () => {
          container.querySelectorAll('.assignee-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeAssigneeFilter = btn.dataset.assignee;
          aplicarFiltrosTabla();
        };
      });
    }

    function updateTabCounts(list) {
      document.querySelectorAll('.status-tab').forEach(btn => {
        const key = btn.dataset.status;
        const n = list.filter(i => grupoEstatus(i) === key).length;
        const label = key === 'in progress' ? 'In progress' : key === 'to do' ? 'To do' : 'Done';
        btn.textContent = `${label} · ${n}`;
      });
    }

    renderAssigneeTabs();
    aplicarFiltrosTabla();

    document.querySelectorAll('.status-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStatusTab = btn.dataset.status;
        aplicarFiltrosTabla();
      };
    });

    $('search-iniciativas').oninput = aplicarFiltrosTabla;

    // Tabla actividad reciente
    const sorted = [...issues].sort((a,b) => b.updated.localeCompare(a.updated));
    allIssues = sorted;
    renderTable(sorted);

    // Grafica por mes iniciativas cerradas (meses según la vista)
    const mesesVista = mesesDeVista(iniciativas);
    const bimestreLabels = mesesVista.map(m => m.label);
    const cerradasEn = m => iniciativas.filter(i =>
      i.status.toLowerCase() === 'done' && i.due_date &&
      i.due_date.slice(0, 10) >= m.start && i.due_date.slice(0, 10) <= m.end
    );
    const bimestreData  = mesesVista.map(m => cerradasEn(m).length);
    const bimestreNames = mesesVista.map(m => cerradasEn(m).map(i => i.summary));

new Chart($('chartBimestre'), {
      type: 'bar',
      data: {
        labels: bimestreLabels,
        datasets: [{
          data: bimestreData,
          backgroundColor: mesesVista.map(m => MONTH_COLORS[m.monthIdx]),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const nombres = bimestreNames[ctx.dataIndex] || [];
                if (nombres.length === 0) return ' Sin cierres';
                return nombres.map(n => ` • ${n}`);
              }
            }
          }
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
}

init();
