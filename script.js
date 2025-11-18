// --- VARIÁVEIS GLOBAIS ESSENCIAIS ---
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwdDWr1vGuU0AKrXiBoxS13PFMVOWnDC8xXv2EEO_P0NKtZ_7F47OAj5KuQoYxtInIs/exec"; 
const READ_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyDGqDIsV80L6a-8KyEPKLPa90nw4QClI2sp5Ig68kUGGan-X1JA2S4Ve2gZJZIuOs6/exec"; 

let currentCalendarDate = new Date();
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// --- FUNÇÕES AUXILIARES ---
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

function getTodayDateKey() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// --- FUNÇÕES DO MODAL (POP-UP) ---
function showCustomAlert(names, dateKey) {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    
    if (!overlay || !messageEl) return;
    
    messageEl.innerHTML = `
        <strong>Hoje (${dateKey}):</strong> Você precisa gerar os links para os seguintes alunos: <br><br><strong>${names}</strong>.
    `;
    
    overlay.classList.remove('modal-hidden');
    overlay.style.display = 'flex';
}

function closeCustomAlert() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('modal-hidden');
    }
}

// --- FUNÇÕES DE TROCA DE ABA ---
function showTab(tabId, clickedButton) {
    // 1. Atualiza botões
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // 2. Esconde todas as abas
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));

    // 3. Mostra a aba correta
    document.getElementById(tabId).classList.remove('hidden');
    
    // 4. SÓ CARREGA O CALENDÁRIO SE A ABA FOR A DO CALENDÁRIO
    if (tabId === 'tab-calendario') {
        changeMonth(0); 
    }
}

function changeMonth(offset) {
    if (offset !== 0) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    }
    loadCalendarData();
}

function loadCalendarData() {
    const calendarView = document.getElementById('calendar-view');
    const calendarControls = document.getElementById('calendar-controls');
    
    calendarView.innerHTML = '<div class="loader"></div>';
    if (calendarControls) calendarControls.style.display = 'none';

    fetch(READ_WEBHOOK_URL)
        .then(response => {
            if (!response.ok) { throw new Error('Falha no Webhook: ' + response.statusText); }
            return response.json(); 
        })
        .then(data => {
            renderCalendar(data); 
            if (calendarControls) calendarControls.style.display = 'flex';
        })
        .catch(error => {
            console.error('Erro de Fetch/JSON:', error);
            calendarView.innerHTML = 'Erro ao carregar o calendário.'; 
            if (calendarControls) calendarControls.style.display = 'flex';
        });
}

function renderCalendar(agendamentos) {
    const calendarView = document.getElementById('calendar-view');
    const todayKey = getTodayDateKey(); 

    // Definições de Mês e Ano
    const renderMonthIndex = currentCalendarDate.getMonth();
    const renderYear = currentCalendarDate.getFullYear();
    const renderMonthName = MONTHS[renderMonthIndex];
    const renderMonth = String(renderMonthIndex + 1).padStart(2, '0');
    const daysInMonth = new Date(renderYear, renderMonthIndex + 1, 0).getDate(); 
    
    // Atualiza título
    const titleDisplay = document.getElementById('currentMonthDisplay');
    if (titleDisplay) titleDisplay.textContent = `${renderMonthName} ${renderYear}`;
    
    // 1. Mapeia agendamentos
    const appointmentsByDate = agendamentos.reduce((acc, item) => {
        const dateObject = new Date(item.DataGerarLink); 
        const dateKey = formatDate(dateObject); 
        const firstName = item.Nome ? item.Nome.split(' ')[0] : 'Aluno'; 

        if (dateObject.getFullYear() === renderYear && dateObject.getUTCMonth() === renderMonthIndex) {
            if (!acc[dateKey]) { acc[dateKey] = []; }
            acc[dateKey].push(firstName);
        }
        return acc;
    }, {});
    
    // =================================================================
    // TRAVA DE SEGURANÇA VISUAL: SÓ MOSTRA ALERTA SE A ABA ESTIVER VISÍVEL
    // =================================================================
    const tabCalendario = document.getElementById('tab-calendario');
    // Verifica se a aba do calendário NÃO tem a classe 'hidden'
    const isCalendarVisible = tabCalendario && !tabCalendario.classList.contains('hidden');

    if (isCalendarVisible) {
        const today = new Date();
        // Verifica se estamos visualizando o mês atual
        if (today.getMonth() === renderMonthIndex && today.getFullYear() === renderYear) {
            const appointmentsToday = appointmentsByDate[todayKey];
            
            if (appointmentsToday && appointmentsToday.length > 0) {
                const names = appointmentsToday.join(', ');
                showCustomAlert(names, todayKey);
            }
        }
    }
    // =================================================================
    
    // 3. Constrói o Calendário
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    let gridHtml = '';

    // Cabeçalho
    gridHtml += '<div class="calendar-header-row">';
    dayLabels.forEach(label => {
        gridHtml += `<div class="day-label">${label}</div>`;
    });
    gridHtml += '</div>';

    // Grid
    gridHtml += '<div class="calendar-grid">';
    let firstDayOfMonth = new Date(renderYear, renderMonthIndex, 1).getDay(); 

    for (let i = 0; i < firstDayOfMonth; i++) {
        gridHtml += `<div class="calendar-day empty-day"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) { 
        const dayString = String(day).padStart(2, '0');
        const dateKey = `${dayString}/${renderMonth}/${renderYear}`; 
        
        const names = appointmentsByDate[dateKey] ? appointmentsByDate[dateKey].join(', ') : '';
        const isScheduled = names !== '' ? 'scheduled-day' : '';
        
        // Lógica de destaque visual do dia (mantida mesmo sem alerta)
        const todayDate = new Date();
        const isTodayHighlight = (dateKey === todayKey && todayDate.getMonth() === renderMonthIndex && todayDate.getFullYear() === renderYear) ? 'today-highlight-calendar' : '';

        gridHtml += `<div class="calendar-day ${isScheduled} ${isTodayHighlight}">
                    <div class="day-number">${day}</div>
                    <div class="appointment-names">${names}</div>
                 </div>`;
    }
    
    gridHtml += '</div>';
    calendarView.innerHTML = gridHtml; 
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Formulário
    const form = document.getElementById('link-schedule-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const message = document.getElementById('form-message');
            const formData = new FormData(form);
            const urlEncodedData = new URLSearchParams(formData);

            message.textContent = 'Enviando...';
            message.style.color = '#007bff';

            fetch(WEBHOOK_URL, {
                method: 'POST',
                body: urlEncodedData 
            })
            .then(response => {
                if (response.ok) {
                    message.textContent = 'Agendamento realizado com sucesso!';
                    message.style.color = '#28a745';
                    form.reset(); 
                } else {
                    throw new Error('Falha no servidor.');
                }
            })
            .catch(error => {
                console.error('Erro no envio:', error);
                message.textContent = 'Erro ao agendar.';
                message.style.color = '#dc3545';
            });
        });
    }

    // Flatpickr
    flatpickr("#datepicker-vencimento", { dateFormat: "d/m/Y", locale: "pt", allowInput: true });
    flatpickr("#datepicker-gerar", { dateFormat: "d/m/Y", locale: "pt", minDate: "today", allowInput: true });

    // --- CORREÇÃO FINAL DO ESTADO INICIAL ---
    // Garante que começamos na aba de agendamento e SEM carregar o calendário
    const agendamentoBtn = document.querySelector("button[onclick*='tab-agendamento']");
    if (agendamentoBtn) {
        showTab('tab-agendamento', agendamentoBtn);
    }
});