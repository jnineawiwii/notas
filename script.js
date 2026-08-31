// ============================================================
// CONFIGURACIÓN SUPABASE
// ============================================================
const SUPABASE_URL = 'https://jkkzrljzyncqwaghsnve.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ous809GaaSz9WUONNfVglg_MmTNvMeJ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = 'notas_rtp';

// ============================================================
// VARIABLES GLOBALES
// ============================================================
let pdfFile = null;
let notasNuevas = [];
let todasLasNotas = [];
let datosFiltrados = [];
let debugLogs = [];
let charts = {};

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================================
// MODO OSCURO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggle = document.getElementById('themeToggle');
    
    const savedTheme = localStorage.getItem('rtp-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
        themeToggleBtn.textContent = '☀️';
    }
    
    function toggleTheme(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('rtp-theme', 'dark');
            themeToggleBtn.textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('rtp-theme', 'light');
            themeToggleBtn.textContent = '🌙';
        }
    }
    
    themeToggleBtn.addEventListener('click', function() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        toggleTheme(!isDark);
        if (themeToggle) themeToggle.checked = !isDark;
    });
    
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            toggleTheme(this.checked);
        });
    }
});

// ============================================================
// REFERENCIAS A ELEMENTOS
// ============================================================
const dropArea = document.getElementById('dropArea');
const pdfInput = document.getElementById('pdfInput');
const processPdfBtn = document.getElementById('processPdfBtn');
const clearPdfBtn = document.getElementById('clearPdfBtn');
const extractedTextDisplay = document.getElementById('extractedTextDisplay');
const tableBody = document.getElementById('tableBody');
const progressBar = document.getElementById('progressBar');
const saveAllBtn = document.getElementById('saveAllBtn');
const refreshTableBtn = document.getElementById('refreshTableBtn');
const addRowBtn = document.getElementById('addRowBtn');
const debugContent = document.getElementById('debugContent');
const rawTextContent = document.getElementById('rawTextContent');

// Filtros
const filterYear = document.getElementById('filterYear');
const filterMonth = document.getElementById('filterMonth');
const filterType = document.getElementById('filterType');
const filterRelevant = document.getElementById('filterRelevant');
const filterMedium = document.getElementById('filterMedium');
const filterSearch = document.getElementById('filterSearch');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const resultsBody = document.getElementById('resultsBody');
const resultCount = document.getElementById('resultCount');
const filteredCount = document.getElementById('filteredCount');
const totalBDCount = document.getElementById('totalBDCount');
const nuevasCount = document.getElementById('nuevasCount');

// Estadísticas
const statTotal = document.getElementById('statTotal');
const statPositivo = document.getElementById('statPositivo');
const statNegativo = document.getElementById('statNegativo');
const statRelevante = document.getElementById('statRelevante');
const statImpresos = document.getElementById('statImpresos');
const statMeses = document.getElementById('statMeses');

// Dashboard
const dashTotal = document.getElementById('dashTotal');
const dashMeses = document.getElementById('dashMeses');
const dashTipos = document.getElementById('dashTipos');
const dashMedios = document.getElementById('dashMedios');
const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');

// ============================================================
// DRAG & DROP
// ============================================================
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'));
});
['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'));
});
dropArea.addEventListener('drop', function(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        pdfFile = files[0];
        processPdfBtn.disabled = false;
        showFileName(files[0].name);
    }
});
dropArea.addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', function(e) {
    if (this.files.length > 0) {
        pdfFile = this.files[0];
        processPdfBtn.disabled = false;
        showFileName(this.files[0].name);
    }
});
function showFileName(name) {
    dropArea.innerHTML = `
        <i class="fas fa-file-pdf fa-4x text-danger"></i>
        <h5 class="mt-3">📄 ${name}</h5>
        <p class="text-muted">PDF listo para analizar</p>
    `;
}

function debug(msg) {
    debugLogs.push(msg);
    debugContent.textContent = debugLogs.join('\n');
    debugContent.scrollTop = debugContent.scrollHeight;
}

// ============================================================
// PROCESAR PDF - PARSER MEJORADO
// ============================================================
processPdfBtn.addEventListener('click', async function() {
    if (!pdfFile) return;
    debugLogs = [];
    debug('=== INICIO DE ANÁLISIS ===');
    extractedTextDisplay.innerHTML = '<span class="text-primary">⏳ Procesando PDF...</span>';
    progressBar.style.width = '30%';
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        progressBar.style.width = '50%';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textoCompleto = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            textoCompleto += pageText + '\n';
            progressBar.style.width = `${50 + (i / pdf.numPages) * 40}%`;
        }
        progressBar.style.width = '90%';
        rawTextContent.textContent = textoCompleto.substring(0, 2000) + '...';
        debug('📄 Texto extraído (' + textoCompleto.length + ' caracteres)');

        const notasExtraidas = extraerNotasMejorado(textoCompleto);
        const notasFiltradas = filtrarNotasNuevas(notasExtraidas);
        mostrarNotasPreview(notasFiltradas);
        agregarNotasATabla(notasFiltradas);
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.style.width = '0%', 1000);
        alert(`✅ ${notasExtraidas.length} notas extraídas. ${notasFiltradas.length} son nuevas.`);
    } catch (error) {
        alert('Error: ' + error.message);
        progressBar.style.width = '0%';
        debug('❌ ERROR: ' + error.message);
    }
});

// ============================================================
// PARSER MEJORADO
// ============================================================
function extraerNotasMejorado(texto) {
    const notas = [];
    const fechaActual = new Date();
    const mesActual = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][fechaActual.getMonth()];
    const añoActual = fechaActual.getFullYear().toString();
    const fechaStr = fechaActual.toISOString().split('T')[0];

    debug('🔍 Buscando notas en el texto (parser ultra)...');

    let text = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    const partes = text.split(/##\s*TEMA:\s*|TEMA:\s*/i);
    
    debug(`📌 Se encontraron ${partes.length - 1} bloques de TEMA:`);
    
    for (let i = 1; i < partes.length; i++) {
        const bloque = partes[i].trim();
        if (!bloque) continue;
        debug(`📦 Bloque ${i}: ${bloque.substring(0, 150)}...`);
        const nota = extraerNotaUltra(bloque, añoActual, mesActual, fechaStr);
        if (nota) {
            notas.push(nota);
            debug(`✅ Nota ${i} extraída: "${nota.title}"`);
        }
    }
    
    if (notas.length === 0) {
        debug('⚠️ No se encontraron TEMA:, buscando por "Resumen:"...');
        const partesResumen = text.split(/Resumen:\s*/i);
        for (let i = 1; i < partesResumen.length; i++) {
            const bloque = partesResumen[i].trim();
            if (bloque && bloque.length > 20) {
                const nota = extraerNotaUltra('TEMA: Nota ' + i + ' ' + bloque, añoActual, mesActual, fechaStr);
                if (nota) notas.push(nota);
            }
        }
    }
    
    if (notas.length === 0) {
        debug('⚠️ Buscando por "MEDIOS:"...');
        const partesMedios = text.split(/MEDIOS:\s*/i);
        for (let i = 1; i < partesMedios.length; i++) {
            const bloque = partesMedios[i].trim();
            if (bloque && bloque.length > 20) {
                const nota = extraerNotaUltra('TEMA: Nota ' + i + ' ' + bloque, añoActual, mesActual, fechaStr);
                if (nota) notas.push(nota);
            }
        }
    }
    
    debug(`📊 Total notas extraídas: ${notas.length}`);
    return notas;
}

function extraerNotaUltra(bloque, añoActual, mesActual, fechaStr) {
    let titulo = '';
    let resumen = '';
    let link = '';
    let medios = '';
    let tema = '';
    
    const resumenRegex = /Resumen:\s*([^]*?)(?=(?:MEDIOS:|TEMA:|https?:\/\/|$))/i;
    const resumenMatch = bloque.match(resumenRegex);
    if (resumenMatch) {
        resumen = resumenMatch[1].trim();
        resumen = resumen.replace(/^[^a-zA-Záéíóúüñ]+/, '').trim();
        debug(`📄 Resumen: "${resumen.substring(0, 80)}..."`);
        bloque = bloque.replace(resumenMatch[0], '');
    } else {
        const puntoMayusRegex = /\.\s*([A-ZÁÉÍÓÚÜÑ][^.]*\.)/;
        const puntoMatch = bloque.match(puntoMayusRegex);
        if (puntoMatch && !puntoMatch[1].includes('MEDIOS') && !puntoMatch[1].includes('http')) {
            resumen = puntoMatch[1].trim();
            debug(`📄 Resumen (por punto): "${resumen.substring(0, 80)}..."`);
            bloque = bloque.replace(puntoMatch[0], '');
        }
    }
    
    const linkRegex = /https?:\/\/[^\s]+/;
    const linkMatch = bloque.match(linkRegex);
    if (linkMatch) {
        link = linkMatch[0].trim();
        debug(`🔗 Link: ${link}`);
        bloque = bloque.replace(link, '');
    }
    
    const mediosRegex = /MEDIOS:\s*([^]*?)(?=(?:TEMA:|Resumen:|$))/i;
    const mediosMatch = bloque.match(mediosRegex);
    if (mediosMatch) {
        medios = mediosMatch[1].trim();
        medios = medios.replace(/https?:\/\/[^\s]+/g, '').trim();
        debug(`📻 Medios: "${medios}"`);
        bloque = bloque.replace(mediosMatch[0], '');
    } else {
        const linkIndex = bloque.indexOf('http');
        if (linkIndex > 0) {
            const despuesLink = bloque.substring(linkIndex + link.length).trim();
            if (despuesLink && !despuesLink.includes('TEMA')) {
                medios = despuesLink;
                debug(`📻 Medios (detectados): "${medios}"`);
                bloque = bloque.substring(0, linkIndex);
            }
        }
    }
    
    let tituloRaw = bloque;
    
    const temaRegex = /TEMA:\s*([^]*?)(?=(?:Resumen:|MEDIOS:|https?:\/\/|$))/i;
    const temaMatch = bloque.match(temaRegex);
    if (temaMatch) {
        tituloRaw = temaMatch[1].trim();
    }
    
    titulo = tituloRaw
        .replace(/^[^a-zA-Záéíóúüñ]+/, '')
        .replace(/Resumen:/i, '')
        .replace(/MEDIOS:/i, '')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/^Nota\s+\d+\s*/i, '')
        .trim();
    
    if (titulo.length > 100) {
        const primerPunto = titulo.indexOf('.');
        if (primerPunto > 20 && primerPunto < 150) {
            resumen = titulo.substring(primerPunto + 1).trim() + (resumen ? ' ' + resumen : '');
            titulo = titulo.substring(0, primerPunto + 1).trim();
        }
    }
    
    tema = titulo;
    debug(`📝 Título: "${titulo}"`);
    
    if (!titulo && resumen) {
        titulo = resumen.substring(0, 80);
        if (titulo.length > 0) titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
        debug(`📝 Título generado desde resumen: "${titulo}"`);
    }
    
    if (!titulo) {
        titulo = 'Nota sin título';
        debug(`⚠️ Título por defecto: "${titulo}"`);
    }
    
    const mediosList = medios ? medios.split(/[,;]\s*/).filter(m => m.trim() && !m.match(/^https?:\/\//)) : [];
    let radio = '', tv = '', digital = '', impresos = '', otros = '';
    
    const mediosImpresos = ['universal', 'jornada', 'reforma', 'excelsior', 'grafico', 'milenio', 
                           'ovaciones', 'contra réplica', 'contrareplica', 'metro', 'el universal',
                           'la jornada', 'el gráfico', 'el grafico', 'sol de méxico', 'excélsior'];
    
    for (const m of mediosList) {
        const lowerM = m.toLowerCase().trim();
        if (!lowerM) continue;
        
        if (lowerM.includes('radio') || lowerM.includes('fm') || lowerM.includes('am') || lowerM.includes('fórmula')) {
            radio += (radio ? ', ' : '') + m;
        } else if (lowerM.includes('tv') || lowerM.includes('televisa') || lowerM.includes('azteca') || lowerM.includes('television') || lowerM.includes('canal')) {
            tv += (tv ? ', ' : '') + m;
        } else if (lowerM.includes('digital') || lowerM.includes('portal') || lowerM.includes('web') || lowerM.includes('internet') || lowerM.includes('sitio')) {
            digital += (digital ? ', ' : '') + m;
        } else if (mediosImpresos.some(p => lowerM.includes(p))) {
            impresos += (impresos ? ', ' : '') + m;
        } else {
            otros += (otros ? ', ' : '') + m;
        }
    }
    
    if (mediosList.length > 0 && !radio && !tv && !digital && !impresos) {
        otros = medios;
    }
    
    if (!tema) {
        tema = titulo;
    }
    
    return {
        year: añoActual,
        month: mesActual,
        date: fechaStr,
        title: titulo,
        relevant: 'No',
        topic: tema || '',
        campaign: '',
        radio: radio || '',
        tv: tv || '',
        digital: digital || '',
        print: impresos || '',
        others: otros || '',
        type: 'Informativo',
        link: link || '',
        author: '',
        bulletin: 'NO',
        summary: resumen || ''
    };
}

// ============================================================
// FILTRAR NOTAS NUEVAS
// ============================================================
function filtrarNotasNuevas(notas) {
    return notas.filter(nota => {
        return !todasLasNotas.some(bd => {
            const tituloMatch = bd.title && nota.title && 
                bd.title.toLowerCase().trim() === nota.title.toLowerCase().trim();
            const resumenMatch = bd.summary && nota.summary && 
                bd.summary.toLowerCase().trim().substring(0, 50) === nota.summary.toLowerCase().trim().substring(0, 50);
            return tituloMatch || resumenMatch;
        });
    });
}

// ============================================================
// PREVIEW Y TABLA
// ============================================================
function mostrarNotasPreview(notas) {
    if (!notas || notas.length === 0) {
        extractedTextDisplay.innerHTML = '<span class="text-warning">⚠️ No hay notas nuevas.</span>';
        return;
    }
    let html = `<div class="mb-2"><span class="badge-nota">${notas.length} notas nuevas</span></div>`;
    notas.forEach((nota, index) => {
        html += `
            <div class="nota-card">
                <div class="titulo">#${index+1} 🟡 ${nota.title || 'Sin título'} <span class="badge-nuevo">NUEVA</span></div>
                <div class="resumen">🌸 ${nota.summary ? nota.summary.substring(0,100) + (nota.summary.length>100?'...':'') : 'Sin resumen'}</div>
                ${nota.link ? `<div class="link">🔵 <a href="${nota.link}" target="_blank">${nota.link.substring(0,50)}...</a></div>` : ''}
                ${nota.print ? `<div class="medios">📰 ${nota.print}</div>` : ''}
                ${nota.radio ? `<div class="medios">📻 ${nota.radio}</div>` : ''}
                ${nota.tv ? `<div class="medios">📺 ${nota.tv}</div>` : ''}
            </div>
        `;
    });
    extractedTextDisplay.innerHTML = html;
}

function agregarNotasATabla(notas) {
    if (!notas || notas.length === 0) return;
    notasNuevas = [...notasNuevas, ...notas];
    renderizarTabla(notasNuevas);
}

function renderizarTabla(datos) {
    if (!datos || datos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="19" class="text-center py-4">✅ No hay notas nuevas.</td></tr>`;
        document.getElementById('recordCount').textContent = '0 notas nuevas';
        nuevasCount.textContent = '0';
        return;
    }
    
    let html = '';
    datos.forEach((nota, index) => {
        const id = `nota_${Date.now()}_${index}_${Math.random().toString(36).substr(2,5)}`;
        const tituloCorto = nota.title ? nota.title.substring(0, 80) + (nota.title.length > 80 ? '...' : '') : '';
        const resumenCorto = nota.summary ? nota.summary.substring(0, 80) + (nota.summary.length > 80 ? '...' : '') : '';
        const linkCorto = nota.link ? nota.link.substring(0, 50) + (nota.link.length > 50 ? '...' : '') : '';
        
        html += `
            <tr id="fila_${id}" class="fila-editando">
                <td style="text-align:center; font-weight:700; color:var(--guinda);">${index+1}</td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.year||'')}" data-field="year" data-id="${id}" placeholder="Año"></td>
                <td>
                    <select class="form-select form-select-sm" data-field="month" data-id="${id}">
                        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m => 
                            `<option value="${m}" ${m===nota.month?'selected':''}>${m}</option>`).join('')}
                    </select>
                </td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.date||'')}" data-field="date" data-id="${id}" placeholder="YYYY-MM-DD"></td>
                <td>
                    <input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.title||'')}" data-field="title" data-id="${id}" placeholder="Título" title="${escapeHtml(nota.title||'')}">
                </td>
                <td>
                    <select class="form-select form-select-sm" data-field="relevant" data-id="${id}">
                        <option value="Si" ${nota.relevant==='Si'?'selected':''}>⭐ Si</option>
                        <option value="No" ${nota.relevant==='No'?'selected':''}>No</option>
                    </select>
                </td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.topic||'')}" data-field="topic" data-id="${id}" placeholder="Tema"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.campaign||'')}" data-field="campaign" data-id="${id}" placeholder="Campaña"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.radio||'')}" data-field="radio" data-id="${id}" placeholder="Radio"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.tv||'')}" data-field="tv" data-id="${id}" placeholder="TV"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.digital||'')}" data-field="digital" data-id="${id}" placeholder="Digital"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.print||'')}" data-field="print" data-id="${id}" placeholder="Impresos"></td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.others||'')}" data-field="others" data-id="${id}" placeholder="Otros"></td>
                <td>
                    <select class="form-select form-select-sm" data-field="type" data-id="${id}">
                        <option value="Informativo" ${nota.type==='Informativo'?'selected':''}>📄 Informativo</option>
                        <option value="Positivo" ${nota.type==='Positivo'?'selected':''}>✅ Positivo</option>
                        <option value="Negativo" ${nota.type==='Negativo'?'selected':''}>❌ Negativo</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.link||'')}" data-field="link" data-id="${id}" placeholder="https://..." title="${escapeHtml(nota.link||'')}">
                </td>
                <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(nota.author||'')}" data-field="author" data-id="${id}" placeholder="Autor"></td>
                <td>
                    <select class="form-select form-select-sm" data-field="bulletin" data-id="${id}">
                        <option value="NO" ${nota.bulletin==='NO'?'selected':''}>NO</option>
                        <option value="Sí" ${nota.bulletin==='Sí'?'selected':''}>Sí</option>
                    </select>
                </td>
                <td>
                    <textarea class="form-control form-control-sm" data-field="summary" data-id="${id}" rows="3" placeholder="Resumen...">${escapeHtml(nota.summary||'')}</textarea>
                </td>
                <td>
                    <button class="btn btn-success btn-sm btn-accion guardar-fila" data-id="${id}" title="Guardar cambios">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger btn-sm btn-accion eliminar-fila" data-id="${id}" title="Eliminar nota">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
    document.getElementById('recordCount').textContent = `${datos.length} notas nuevas`;
    nuevasCount.textContent = datos.length;

    document.querySelectorAll('.guardar-fila').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            guardarFila(id);
        });
    });
    document.querySelectorAll('.eliminar-fila').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            if (confirm('¿Eliminar esta nota?')) eliminarFila(id);
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function guardarFila(id) {
    const fila = document.getElementById(`fila_${id}`);
    if (!fila) return;
    const inputs = fila.querySelectorAll('input, textarea, select');
    const datos = {};
    inputs.forEach(input => { datos[input.dataset.field] = input.value; });
    const index = Array.from(tableBody.children).indexOf(fila);
    if (notasNuevas[index]) notasNuevas[index] = { ...notasNuevas[index], ...datos };
    fila.classList.remove('fila-editando');
    fila.classList.add('fila-guardada');
    const btn = fila.querySelector('.guardar-fila');
    if (btn) { btn.innerHTML = '<i class="fas fa-check-circle"></i>'; btn.classList.remove('btn-success'); btn.classList.add('btn-secondary'); btn.disabled = true; }
    setTimeout(() => { fila.classList.remove('fila-guardada'); }, 2000);
}

function eliminarFila(id) {
    const fila = document.getElementById(`fila_${id}`);
    if (!fila) return;
    const index = Array.from(tableBody.children).indexOf(fila);
    if (index > -1) notasNuevas.splice(index, 1);
    fila.remove();
    renumerarFilas();
    document.getElementById('recordCount').textContent = `${notasNuevas.length} notas nuevas`;
    nuevasCount.textContent = notasNuevas.length;
}

function renumerarFilas() {
    const filas = tableBody.querySelectorAll('tr');
    filas.forEach((tr, i) => { const td = tr.querySelector('td:first-child'); if (td) td.textContent = i + 1; });
}

addRowBtn.addEventListener('click', function() {
    const fechaActual = new Date();
    const mesActual = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][fechaActual.getMonth()];
    const añoActual = fechaActual.getFullYear().toString();
    const fechaStr = fechaActual.toISOString().split('T')[0];
    notasNuevas.push({
        year: añoActual, month: mesActual, date: fechaStr, title: '', relevant: 'No',
        topic: '', campaign: '', radio: '', tv: '', digital: '', print: '', others: '',
        type: 'Informativo', link: '', author: '', bulletin: 'NO', summary: ''
    });
    renderizarTabla(notasNuevas);
});

// ============================================================
// GUARDAR EN SUPABASE
// ============================================================
saveAllBtn.addEventListener('click', async function() {
    if (notasNuevas.length === 0) { alert('No hay notas nuevas.'); return; }
    const filas = tableBody.querySelectorAll('tr');
    const datosParaGuardar = [];
    filas.forEach((fila) => {
        const inputs = fila.querySelectorAll('input, textarea, select');
        const datos = {};
        inputs.forEach(input => { datos[input.dataset.field] = input.value; });
        datosParaGuardar.push(datos);
    });
    try {
        const { error } = await supabaseClient.from(TABLE_NAME).insert(datosParaGuardar);
        if (error) { alert('Error: ' + error.message); return; }
        alert(`✅ Se guardaron ${datosParaGuardar.length} registros.`);
        notasNuevas = [];
        renderizarTabla([]);
        await cargarDatos();
    } catch (err) { alert('Error: ' + err.message); }
});

// ============================================================
// CARGAR DATOS
// ============================================================
async function cargarDatos() {
    try {
        const { data, error } = await supabaseClient.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
        if (error) { console.error(error); return; }
        todasLasNotas = data || [];
        totalBDCount.textContent = todasLasNotas.length;
        actualizarFiltros();
        aplicarFiltros();
        actualizarDashboard();
    } catch (err) { console.error(err); }
}

// ============================================================
// FILTROS
// ============================================================
function actualizarFiltros() {
    const años = [...new Set(todasLasNotas.map(d => d.year).filter(Boolean))].sort();
    filterYear.innerHTML = '<option value="">Todos</option>';
    años.forEach(a => { filterYear.innerHTML += `<option value="${a}">${a}</option>`; });
}

function aplicarFiltros() {
    const year = filterYear.value, month = filterMonth.value, type = filterType.value;
    const relevant = filterRelevant.value, medium = filterMedium.value;
    const search = filterSearch.value.toLowerCase().trim();

    datosFiltrados = todasLasNotas.filter(d => {
        if (year && d.year !== year) return false;
        if (month && d.month !== month) return false;
        if (type && d.type !== type) return false;
        if (relevant && d.relevant !== relevant) return false;
        if (medium && !d[medium]) return false;
        if (search) {
            const title = (d.title || '').toLowerCase();
            const summary = (d.summary || '').toLowerCase();
            if (!title.includes(search) && !summary.includes(search)) return false;
        }
        return true;
    });

    mostrarResultados(datosFiltrados);
    actualizarEstadisticas(datosFiltrados);
    resultCount.textContent = datosFiltrados.length;
    filteredCount.textContent = `${datosFiltrados.length} registros`;
}

function mostrarResultados(datos) {
    if (!datos || datos.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="14" class="text-center">No hay resultados.</td></tr>`;
        return;
    }
    let html = '';
    datos.forEach((d, i) => {
        html += `<tr>
            <td>${i+1}</td><td>${escapeHtml(d.year||'')}</td><td>${escapeHtml(d.month||'')}</td>
            <td>${escapeHtml(d.date||'')}</td><td><strong>${escapeHtml(d.title||'')}</strong></td>
            <td>${d.relevant==='Si'?'⭐ Si':'No'}</td><td>${escapeHtml(d.topic||'')}</td>
            <td>${escapeHtml(d.radio||'')}</td><td>${escapeHtml(d.tv||'')}</td>
            <td>${escapeHtml(d.digital||'')}</td><td>${escapeHtml(d.print||'')}</td>
            <td>${escapeHtml(d.others||'')}</td>
            <td><span class="badge ${d.type==='Positivo'?'bg-success':d.type==='Negativo'?'bg-danger':'bg-secondary'}">${d.type||'Informativo'}</span></td>
            <td>${escapeHtml((d.summary||'').substring(0,100))}${(d.summary||'').length>100?'...':''}</td>
        </tr>`;
    });
    resultsBody.innerHTML = html;
}

function actualizarEstadisticas(datos) {
    statTotal.textContent = datos.length;
    statPositivo.textContent = datos.filter(d => d.type === 'Positivo').length;
    statNegativo.textContent = datos.filter(d => d.type === 'Negativo').length;
    statRelevante.textContent = datos.filter(d => d.relevant === 'Si').length;
    statImpresos.textContent = datos.filter(d => d.print && d.print.trim().length > 0).length;
    statMeses.textContent = [...new Set(datos.map(d => d.month).filter(Boolean))].length;
}

applyFiltersBtn.addEventListener('click', aplicarFiltros);
clearFiltersBtn.addEventListener('click', function() {
    filterYear.value = ''; filterMonth.value = ''; filterType.value = '';
    filterRelevant.value = ''; filterMedium.value = ''; filterSearch.value = '';
    aplicarFiltros();
});
[filterYear, filterMonth, filterType, filterRelevant, filterMedium].forEach(el => {
    el.addEventListener('change', aplicarFiltros);
});
filterSearch.addEventListener('input', aplicarFiltros);

// ============================================================
// EXPORTAR CSV
// ============================================================
exportCsvBtn.addEventListener('click', function() {
    if (datosFiltrados.length === 0) { alert('No hay datos.'); return; }
    const headers = ['Año','Mes','Fecha','Título','Relevante','Tema','Campaña','Radio','TV','Digital','Impresos','Otros','Tipo','Link','Autor','Boletín','Resumen'];
    const rows = datosFiltrados.map(d => [
        d.year||'', d.month||'', d.date||'', d.title||'', d.relevant||'',
        d.topic||'', d.campaign||'', d.radio||'', d.tv||'', d.digital||'',
        d.print||'', d.others||'', d.type||'', d.link||'', d.author||'',
        d.bulletin||'', (d.summary||'').replace(/,/g,' ')
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(row => { csv += row.map(c => `"${c}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
});

// ============================================================
// DASHBOARD
// ============================================================
// ============================================================
// DASHBOARD MEJORADO CON FILTROS
// ============================================================
let datosFiltradosDashboard = [];

function aplicarFiltrosDashboard() {
    const año = document.getElementById('dashFilterYear').value;
    const mes = document.getElementById('dashFilterMonth').value;
    const tipo = document.getElementById('dashFilterType').value;
    const relevante = document.getElementById('dashFilterRelevant').value;
    
    datosFiltradosDashboard = todasLasNotas.filter(d => {
        if (año !== 'todos' && d.year !== año) return false;
        if (mes !== 'todos' && d.month !== mes) return false;
        if (tipo !== 'todos' && d.type !== tipo) return false;
        if (relevante !== 'todos' && d.relevant !== relevante) return false;
        return true;
    });
    
    actualizarDashboardConFiltros();
}

function actualizarDashboardConFiltros() {
    const datos = datosFiltradosDashboard;
    const total = datos.length;
    
    // Actualizar métricas
    dashTotal.textContent = total;
    dashMeses.textContent = [...new Set(datos.map(d => d.month).filter(Boolean))].length;
    dashTipos.textContent = [...new Set(datos.map(d => d.type).filter(Boolean))].length;
    
    let mediosConDatos = 0;
    ['radio','tv','digital','print','others'].forEach(m => {
        if (datos.some(d => d[m] && d[m].trim().length > 0)) mediosConDatos++;
    });
    dashMedios.textContent = mediosConDatos;

    // ============================================================
    // GRÁFICO 1: DISTRIBUCIÓN POR TIPO (COLORES ESPECÍFICOS)
    // ============================================================
    const tipos = ['Informativo', 'Positivo', 'Negativo'];
    const coloresTipos = {
        'Informativo': '#6c757d',  // Gris
        'Positivo': '#78BE20',     // Verde
        'Negativo': '#E5074C'      // Rojo
    };
    const conteoTipos = tipos.map(t => datos.filter(d => d.type === t).length);
    const coloresTiposArray = tipos.map(t => coloresTipos[t]);
    
    if (charts.tipos) charts.tipos.destroy();
    charts.tipos = new Chart(document.getElementById('chartTipos'), {
        type: 'doughnut',
        data: {
            labels: tipos.map(t => {
                const iconos = {'Informativo': '📄', 'Positivo': '✅', 'Negativo': '❌'};
                return `${iconos[t]} ${t}`;
            }),
            datasets: [{
                data: conteoTipos,
                backgroundColor: coloresTiposArray,
                borderColor: coloresTiposArray.map(c => c),
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} notas (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // ============================================================
    // GRÁFICO 2: MEDIOS DE COMUNICACIÓN (POR TIPO)
    // ============================================================
    const medios = ['radio', 'tv', 'digital', 'print', 'others'];
    const nombresMedios = ['📻 Radio', '📺 TV', '💻 Digital', '📰 Impresos', '🌐 Otros'];
    const coloresMedios = ['#8b5cf6', '#3b82f6', '#06b6d4', '#78BE20', '#B28E5C'];
    
    // Datos por tipo de nota y medio
    const datosPorTipoYMedio = tipos.map(tipo => {
        const datosTipo = datos.filter(d => d.type === tipo);
        return medios.map(m => datosTipo.filter(d => d[m] && d[m].trim().length > 0).length);
    });
    
    if (charts.medios) charts.medios.destroy();
    charts.medios = new Chart(document.getElementById('chartMedios'), {
        type: 'bar',
        data: {
            labels: nombresMedios,
            datasets: tipos.map((tipo, idx) => ({
                label: tipo,
                data: datosPorTipoYMedio[idx],
                backgroundColor: coloresTipos[tipo] + '99',
                borderColor: coloresTipos[tipo],
                borderWidth: 2,
                borderRadius: 4,
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} notas`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });

    // ============================================================
    // GRÁFICO 3: RELEVANCIA POR TIPO
    // ============================================================
    const relevanciaData = tipos.map(tipo => {
        const datosTipo = datos.filter(d => d.type === tipo);
        const relevantes = datosTipo.filter(d => d.relevant === 'Si').length;
        const noRelevantes = datosTipo.filter(d => d.relevant === 'No').length;
        return { relevantes, noRelevantes };
    });
    
    if (charts.relevancia) charts.relevancia.destroy();
    charts.relevancia = new Chart(document.getElementById('chartRelevancia'), {
        type: 'bar',
        data: {
            labels: tipos.map(t => `📄 ${t}`),
            datasets: [
                {
                    label: '⭐ Relevantes',
                    data: relevanciaData.map(d => d.relevantes),
                    backgroundColor: '#B28E5C',
                    borderColor: '#B28E5C',
                    borderWidth: 2,
                    borderRadius: 4,
                },
                {
                    label: 'No relevantes',
                    data: relevanciaData.map(d => d.noRelevantes),
                    backgroundColor: '#94a3b8',
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} notas`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });

    // ============================================================
    // GRÁFICO 4: EVOLUCIÓN MENSUAL POR TIPO
    // ============================================================
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const coloresEvolucion = {
        'Informativo': '#6c757d',
        'Positivo': '#78BE20',
        'Negativo': '#E5074C'
    };
    
    // Si hay filtro de año, mostrar solo ese año, sino todos los años combinados
    const añosDisponibles = [...new Set(datos.map(d => d.year).filter(Boolean))].sort();
    let datosEvolucion = [];
    
    if (document.getElementById('dashFilterYear').value !== 'todos') {
        // Un año específico
        const añoSeleccionado = document.getElementById('dashFilterYear').value;
        datosEvolucion = tipos.map(tipo => {
            return meses.map(mes => {
                return datos.filter(d => d.year === añoSeleccionado && d.month === mes && d.type === tipo).length;
            });
        });
        
        if (charts.evolucion) charts.evolucion.destroy();
        charts.evolucion = new Chart(document.getElementById('chartEvolucion'), {
            type: 'line',
            data: {
                labels: meses,
                datasets: tipos.map((tipo, idx) => ({
                    label: tipo,
                    data: datosEvolucion[idx],
                    borderColor: coloresEvolucion[tipo],
                    backgroundColor: coloresEvolucion[tipo] + '33',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: coloresEvolucion[tipo],
                    borderWidth: 3,
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} notas`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    } else {
        // Todos los años - evolución mensual agregada
        datosEvolucion = tipos.map(tipo => {
            return meses.map(mes => {
                return datos.filter(d => d.month === mes && d.type === tipo).length;
            });
        });
        
        if (charts.evolucion) charts.evolucion.destroy();
        charts.evolucion = new Chart(document.getElementById('chartEvolucion'), {
            type: 'line',
            data: {
                labels: meses,
                datasets: tipos.map((tipo, idx) => ({
                    label: tipo,
                    data: datosEvolucion[idx],
                    borderColor: coloresEvolucion[tipo],
                    backgroundColor: coloresEvolucion[tipo] + '33',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: coloresEvolucion[tipo],
                    borderWidth: 3,
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} notas`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // ============================================================
    // GRÁFICO 5: NOTAS POR MES (DESGLOSADO POR TIPO)
    // ============================================================
    const datosMensualesPorTipo = tipos.map(tipo => {
        return meses.map(mes => {
            return datos.filter(d => d.month === mes && d.type === tipo).length;
        });
    });
    
    if (charts.mensual) charts.mensual.destroy();
    charts.mensual = new Chart(document.getElementById('chartMensual'), {
        type: 'bar',
        data: {
            labels: meses,
            datasets: tipos.map((tipo, idx) => ({
                label: tipo,
                data: datosMensualesPorTipo[idx],
                backgroundColor: coloresTipos[tipo] + '99',
                borderColor: coloresTipos[tipo],
                borderWidth: 2,
                borderRadius: 4,
                stack: 'stack1',
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} notas`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: { 
                    stacked: true,
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// ============================================================
// EVENTOS DE FILTROS DEL DASHBOARD
// ============================================================
document.getElementById('applyDashFilters').addEventListener('click', aplicarFiltrosDashboard);
document.getElementById('resetDashFilters').addEventListener('click', function() {
    document.getElementById('dashFilterYear').value = 'todos';
    document.getElementById('dashFilterMonth').value = 'todos';
    document.getElementById('dashFilterType').value = 'todos';
    document.getElementById('dashFilterRelevant').value = 'todos';
    aplicarFiltrosDashboard();
});

// Actualizar cuando cambien los filtros
document.getElementById('dashFilterYear').addEventListener('change', aplicarFiltrosDashboard);
document.getElementById('dashFilterMonth').addEventListener('change', aplicarFiltrosDashboard);
document.getElementById('dashFilterType').addEventListener('change', aplicarFiltrosDashboard);
document.getElementById('dashFilterRelevant').addEventListener('change', aplicarFiltrosDashboard);

// ============================================================
// ACTUALIZAR AÑOS EN EL FILTRO DEL DASHBOARD
// ============================================================
function actualizarFiltrosDashboard() {
    const años = [...new Set(todasLasNotas.map(d => d.year).filter(Boolean))].sort();
    const dashFilterYear = document.getElementById('dashFilterYear');
    dashFilterYear.innerHTML = '<option value="todos">Todos los años</option>';
    años.forEach(a => {
        dashFilterYear.innerHTML += `<option value="${a}">${a}</option>`;
    });
}

// Modificar cargarDatos() para actualizar también los filtros del dashboard
const cargarDatosOriginal = cargarDatos;
cargarDatos = async function() {
    await cargarDatosOriginal();
    actualizarFiltrosDashboard();
    aplicarFiltrosDashboard();
};

refreshDashboardBtn.addEventListener('click', function() {
    cargarDatos();
});

// ============================================================
// LIMPIAR
// ============================================================
clearPdfBtn.addEventListener('click', function() {
    pdfFile = null;
    processPdfBtn.disabled = true;
    extractedTextDisplay.innerHTML = '<span class="text-muted">📄 Sube un PDF</span>';
    dropArea.innerHTML = `
        <i class="fas fa-cloud-upload-alt fa-4x text-primary"></i>
        <h5 class="mt-3">Arrastra tu PDF aquí</h5>
        <p class="text-muted">o haz clic para seleccionar</p>
    `;
    debugLogs = [];
    debugContent.textContent = 'Esperando...';
    rawTextContent.textContent = 'Texto crudo...';
});

refreshTableBtn.addEventListener('click', function() { cargarDatos(); });

// ============================================================
// INICIAR
// ============================================================
cargarDatos();
console.log('✅ Sistema RTP cargado con parser mejorado.');
console.log('📌 Ahora reconoce notas aunque el texto esté pegado.');