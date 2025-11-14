// VARIÁVEL ESSENCIAL: SUBSTITUA PELA SUA URL DO GOOGLE APPS SCRIPT
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwdDWr1vGuU0AKrXiBoxS13PFMVOWnDC8xXv2EEO_P0NKtZ_7F47OAj5KuQoYxtInIs/exec"; 

document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE ENVIO DO FORMULÁRIO (ASSÍNCRONO) ---
    document.getElementById('link-schedule-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const form = e.target;
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
                form.reset(); // Limpa o formulário
            } else {
                throw new Error('Falha no servidor.');
            }
        })
        .catch(error => {
            console.error('Erro no envio:', error);
            message.textContent = 'Erro ao agendar. Verifique o link do Webhook.';
            message.style.color = '#dc3545';
        });
    });

    // --- INICIALIZAÇÃO DOS DATEPICKERS (FLATPCKIR) ---
    flatpickr("#datepicker-vencimento", {
        dateFormat: "d/m/Y", // Formato brasileiro
        locale: "pt", 
        allowInput: true, // Permite digitar
        altInput: true, 
        altFormat: "d/m/Y",
    });

    flatpickr("#datepicker-gerar", {
        dateFormat: "d/m/Y", // Formato brasileiro
        locale: "pt",
        minDate: "today", 
        allowInput: true,
        altInput: true, 
        altFormat: "d/m/Y"
    });
});

// VARIÁVEL ESSENCIAL: URL DO GOOGLE APPS SCRIPT PARA LEITURA DE DADOS
const READ_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyDGqDIsV80L6a-8KyEPKLPa90nw4QClI2sp5Ig68kUGGan-X1JA2S4Ve2gZJZIuOs6/exec"; 

// --- FUNÇÃO DE TROCA DE ABAS ---
function showTab(tabId, clickedButton) {
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));

    document.getElementById(tabId).classList.remove('hidden');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // AÇÃO EXCLUSIVA: Se for o calendário, carregue os dados
    if (tabId === 'tab-calendario') {
        loadCalendarData();
    }
}


// --- FUNÇÃO PARA CARREGAR DADOS DA PLANILHA PARA O CALENDÁRIO ---
function loadCalendarData() {
    const calendarView = document.getElementById('calendar-view');
    const calendarControls = document.getElementById('calendar-controls');
    
    calendarView.innerHTML = 'Buscando agendamentos...';
    calendarControls.style.display = 'none'; // Esconde controles durante o fetch

    fetch(READ_WEBHOOK_URL)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                renderCalendar(data);
                calendarControls.style.display = 'flex'; // Mostra controles
            } else {
                calendarView.innerHTML = 'Nenhum agendamento encontrado.';
            }
        })
        .catch(error => {
            console.error('Erro ao buscar dados do calendário:', error);
            calendarView.innerHTML = 'Erro ao carregar o calendário. Verifique a URL do Webhook de leitura.';
        });
}

function formatDate(date) {
    // Assegura que o dia, mês e ano sejam lidos de acordo com o padrão universal (UTC),
    // ignorando o fuso horário local do navegador.
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

let currentCalendarDate = new Date();
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// NOVO: FUNÇÃO QUE ATUALIZA O MÊS E RECARREGA O CALENDÁRIO
function changeMonth(offset) {
    if (offset !== 0) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    }
    loadCalendarData(); // Recarrega os dados com o novo contexto de mês
}

// --- FUNÇÃO PARA RENDERIZAR O CALENDÁRIO (CORREÇÃO FINAL DE FORMATO ISO) ---
function renderCalendar(agendamentos) {
    const calendarView = document.getElementById('calendar-view');
    
    // Filtra e renderiza com base na variável global currentCalendarDate
    const renderMonthIndex = currentCalendarDate.getMonth();
    const renderYear = currentCalendarDate.getFullYear();
    const renderMonthName = MONTHS[renderMonthIndex];

    // Atualiza o título dos controles
    document.getElementById('currentMonthDisplay').textContent = `${renderMonthName} ${renderYear}`;
    
    const renderMonth = String(renderMonthIndex + 1).padStart(2, '0');
    const daysInMonth = new Date(renderYear, renderMonthIndex + 1, 0).getDate(); 

    
    
    // 1. Cria um mapa de agendamentos por data (DD/MM/YYYY)
    const appointmentsByDate = agendamentos.reduce((acc, item) => {
        const dateObject = new Date(item.DataGerarLink); 
        const dateKey = formatDate(dateObject); 
        const firstName = item.Nome ? item.Nome.split(' ')[0] : 'Aluno'; 

        // CRUCIAL: Filtra apenas os agendamentos do mês/ano ATUALMENTE SELECIONADO
        if (dateObject.getFullYear() === renderYear && dateObject.getMonth() === renderMonthIndex) {
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(firstName);
        }
        return acc;
    }, {});
    
    // 2. Inicia a construção visual
    const firstDayOfMonth = new Date(renderYear, renderMonthIndex, 1).getDay(); // 0=Dom, 1=Seg...
    let html = '';
    html += '<div class="calendar-grid">';

    // Adiciona células vazias para preencher o início da semana
    for (let i = 0; i < firstDayOfMonth; i++) {
        html += `<div class="calendar-day empty-day"></div>`;
    }

    // Loop para gerar os dias do mês
    for (let day = 1; day <= daysInMonth; day++) { 
        const dayString = String(day).padStart(2, '0');
        const dateKey = `${dayString}/${renderMonth}/${renderYear}`; 
        
        const names = appointmentsByDate[dateKey] ? appointmentsByDate[dateKey].join(', ') : '';
        const isScheduled = names !== '' ? 'scheduled-day' : '';

        html += `<div class="calendar-day ${isScheduled}">
                    <div class="day-number">${day}</div>
                    <div class="appointment-names">${names}</div>
                 </div>`;
    }

    html += '</div>';
    document.getElementById('calendar-view').innerHTML = html;
}