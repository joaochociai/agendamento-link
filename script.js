// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE (INSIRA SUAS CHAVES AQUI) ---
const firebaseConfig = {
    apiKey: "AIzaSyA9EnKileAfQkKwN8G1li6VNLePlmLqOyg",
    authDomain: "agendamento-link-912a3.firebaseapp.com",
    projectId: "agendamento-link-912a3",
    storageBucket: "agendamento-link-912a3.firebasestorage.app",
    messagingSenderId: "825610948854",
    appId: "1:825610948854:web:00e079107d10673d895cd7",
    measurementId: "G-839M7L1ZBL"
  };


// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variáveis Globais do Calendário
let currentCalendarDate = new Date();
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

window.allAppointments = []; 

// Funções para abrir/fechar o novo modal
window.closeDetailsModal = function() {
    const overlay = document.getElementById('details-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('modal-hidden');
    }
}

// --- SISTEMA DE LOGIN ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'flex';
        
        // Inicializa na aba de agendamento
        window.showTab('tab-agendamento', document.querySelector('.nav-tab.active'));
        window.showOperationalWarning();
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const message = document.getElementById('login-message');

    message.textContent = "Autenticando...";
    message.style.color = "#007bff";

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            console.error(error);
            message.textContent = "Erro: E-mail ou senha incorretos.";
            message.style.color = "#dc3545";
        });
});

window.logoutSystem = function() {
    signOut(auth).then(() => {
        window.location.reload();
    });
}


// --- FUNÇÕES DE AGENDAMENTO E BANCO DE DADOS ---

// Envio do Formulário
const agendamentoForm = document.getElementById('link-schedule-form');
if (agendamentoForm) {
    agendamentoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('form-message');
        const formData = new FormData(agendamentoForm);
        
        const dataToSave = {};
        formData.forEach((value, key) => dataToSave[key] = value.trim());
        
        // CORREÇÃO 1: Converter Valor e Parcelas para números
        if (dataToSave.ValorParcela) {
            // Remove R$, pontos e troca vírgula por ponto
            const limpo = dataToSave.ValorParcela.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            dataToSave.ValorParcela = parseFloat(limpo);
        }
        if (dataToSave.QtdParcelas) {
            dataToSave.QtdParcelas = parseInt(dataToSave.QtdParcelas);
        }

        // CORREÇÃO 2: Converter as Datas de texto para Objeto Date
        const dataVenc = parseDateBR(dataToSave.DataVencimento);
        const dataGerar = parseDateBR(dataToSave.DataGerarLink);

        if (dataVenc) dataToSave.DataVencimento = dataVenc;
        if (dataGerar) dataToSave.DataGerarLink = dataGerar;

        // Metadados
        dataToSave.createdAt = new Date();
        dataToSave.createdBy = auth.currentUser ? auth.currentUser.email : 'Sistema';

        message.textContent = 'Salvando...';
        message.style.color = '#007bff';

        try {
            await addDoc(collection(db, "agendamentos"), dataToSave);
            message.textContent = 'Agendamento salvo com sucesso!';
            message.style.color = '#28a745';
            agendamentoForm.reset();
            
            // Atualiza os dados locais se a função existir
            if (typeof loadCalendarData === 'function') loadCalendarData();
            
        } catch (error) {
            console.error("Erro ao salvar: ", error);
            message.textContent = 'Erro ao salvar. Tente novamente.';
            message.style.color = '#dc3545';
        }
    });
}

// Leitura do Calendário
async function loadCalendarData() {
    const calendarView = document.getElementById('calendar-view');
    calendarView.innerHTML = '<div class="loader"></div>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "agendamentos"));
        const agendamentos = [];
        
        // CORREÇÃO: Captura o ID do documento junto com os dados
        querySnapshot.forEach((doc) => {
            agendamentos.push({
                id: doc.id, // O ID é crucial para o clique funcionar
                ...doc.data()
            });
        });
        
        // Armazena globalmente para que o Modal consiga ler depois
        window.allAppointments = agendamentos; 
        
        window.renderCalendar(agendamentos);
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        calendarView.innerHTML = 'Erro ao carregar dados.';
    }
}


// --- FUNÇÕES DE INTERFACE (Window) ---

window.showTab = function(tabId, clickedButton) {
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    if (tabId === 'tab-calendario') {
        window.changeMonth(0);
    }

    if (tabId === 'tab-lista') {
        // Se a lista estiver vazia, tenta carregar (caso o usuário tenha ido direto pra essa aba)
        if (!window.allAppointments || window.allAppointments.length === 0) {
             loadCalendarData().then(() => window.filterList());
        } else {
             window.filterList(); // Apenas renderiza
        }
    }
}

window.changeMonth = function(offset) {
    if (offset !== 0) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    }
    loadCalendarData();
}

window.renderCalendar = function(agendamentos) {
    const calendarView = document.getElementById('calendar-view');
    const todayKey = getTodayDateKey(); 

    const renderMonthIndex = currentCalendarDate.getMonth();
    const renderYear = currentCalendarDate.getFullYear();
    const renderMonthName = MONTHS[renderMonthIndex];
    
    const titleDisplay = document.getElementById('currentMonthDisplay');
    if(titleDisplay) titleDisplay.textContent = `${renderMonthName} ${renderYear}`;
    
    // 1. Mapeamento de dados (CORRIGIDO PARA LER TIMESTAMP E TEXTO)
    const appointmentsByDate = agendamentos.reduce((acc, item) => {
        let dateObject;

        // CENÁRIO 1: É um Timestamp do Firebase (Novos Agendamentos)
        if (item.DataGerarLink && typeof item.DataGerarLink.toDate === 'function') {
            dateObject = item.DataGerarLink.toDate();
        } 
        // CENÁRIO 2: É texto ou Date string (Importados)
        else if (item.DataGerarLink) {
            const dateString = String(item.DataGerarLink);
            if (dateString.includes('/')) {
                const parts = dateString.split('/');
                dateObject = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                dateObject = new Date(dateString);
            }
        }

        // Se a data for válida, processa
        if (dateObject && !isNaN(dateObject)) {
            // Ajuste de fuso horário para exibição correta no dia
            const dateKey = formatDate(dateObject); 
            const fullName = item.Nome || 'Aluno';
            const firstName = fullName.split(' ')[0];

            // Verifica Ano e Mês (usando métodos locais para casar com a visualização)
            if (dateObject.getFullYear() === renderYear && dateObject.getMonth() === renderMonthIndex) {
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push({ name: firstName, id: item.id }); 
            }
        }
        return acc;
    }, {});
    
    // ... (O RESTANTE DA FUNÇÃO - Lógica do Alerta e Grid HTML - PERMANECE IGUAL) ...
    // Copie a parte do "Alerta de Hoje" e da "Construção do Grid" do seu código anterior
    // ou mantenha o que já está lá embaixo.
    
    // (Para facilitar, segue o bloco final do Grid para garantir que não falte nada)
    const daysInMonth = new Date(renderYear, renderMonthIndex + 1, 0).getDate();
    const firstDayOfMonth = new Date(renderYear, renderMonthIndex, 1).getDay(); 
    
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    let gridHtml = '<div class="calendar-header-row">';
    dayLabels.forEach(label => gridHtml += `<div class="day-label">${label}</div>`);
    gridHtml += '</div><div class="calendar-grid">';

    for (let i = 0; i < firstDayOfMonth; i++) gridHtml += `<div class="calendar-day empty-day"></div>`;

    for (let day = 1; day <= daysInMonth; day++) { 
        const dayString = String(day).padStart(2, '0');
        const monthString = String(renderMonthIndex + 1).padStart(2, '0');
        const dateKey = `${dayString}/${monthString}/${renderYear}`; 
        
        const namesArray = appointmentsByDate[dateKey];
        const namesHtml = namesArray ? namesArray.map(app => 
            `<span class="app-link" onclick="window.showAppointmentDetails('${app.id}')" title="Ver detalhes de ${app.name}">${app.name}</span>`
        ).join('') : '';
        
        const isScheduled = namesArray && namesArray.length > 0 ? 'scheduled-day' : '';
        const isTodayHighlight = (dateKey === todayKey) ? 'today-highlight-calendar' : '';

        gridHtml += `<div class="calendar-day ${isScheduled} ${isTodayHighlight}">
                    <div class="day-number">${day}</div>
                    <div class="appointment-names">${namesHtml}</div>
                 </div>`;
    }
    gridHtml += '</div>';
    calendarView.innerHTML = gridHtml;
}

// Helpers
window.openModal = function(title, message) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-message').innerHTML = message;
    overlay.classList.remove('modal-hidden');
    overlay.style.display = 'flex';
}

window.closeCustomAlert = function() {
    document.getElementById('modal-overlay').style.display = 'none';
}

window.showOperationalWarning = function() {
    window.openModal("⚠️ Atenção", "Lembre-se de verificar o histórico e evitar duplicidade antes de agendar.");
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// FUNÇÃO NOVA: Converte texto "DD/MM/AAAA" para Data Real
function parseDateBR(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
        // Cria a data: Ano, Mês (0-11), Dia
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null; 
}

function getTodayDateKey() { return formatDate(new Date()); }

// Flatpickr
document.addEventListener('DOMContentLoaded', () => {
    flatpickr("#datepicker-vencimento", { dateFormat: "d/m/Y", locale: "pt", allowInput: true });
    flatpickr("#datepicker-gerar", { dateFormat: "d/m/Y", locale: "pt", minDate: "today", allowInput: true });
    // Inicializa Flatpickr para os filtros da lista
    flatpickr("#filter-start-date", { 
        dateFormat: "d/m/Y", 
        locale: "pt", 
        allowInput: true,
        onChange: function() { window.filterList(); } 
    });
    flatpickr("#filter-end-date", { 
        dateFormat: "d/m/Y", 
        locale: "pt", 
        allowInput: true,
        onChange: function() { window.filterList(); } 
    });

});

window.showAppointmentDetails = function(appointmentId) {
    const appointment = window.allAppointments.find(app => app.id === appointmentId);

    if (!appointment) {
        alert("Detalhes não encontrados.");
        return;
    }

    window.lastOpenedAppointment = appointment;


    // Formatação de Valores e Datas para exibição amigável
    const valor = appointment.ValorParcela ? parseFloat(appointment.ValorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
    
    // Helper interno para formatar data string ou timestamp
    const formatDataSafe = (data) => {
        if (!data) return '-';
        // Se for Timestamp do Firebase
        if (data.seconds) return formatDateUTC(data.toDate());
        // Se for string ISO
        return formatDateUTC(new Date(data));
    };

    const detailsHtml = `
        <div class="details-content-wrapper">
            <table class="details-table">
                <tr><th>Aluno</th><td>${appointment.Nome || '-'}</td></tr>
                <tr><th>E-mail</th><td>${appointment.Email || '-'}</td></tr>
                <tr><th>Telefone</th><td>${appointment.Telefone || '-'}</td></tr>
                <tr><th>Curso</th><td>${appointment.Curso || '-'}</td></tr>
                <tr><th>Motivo</th><td>${appointment.Motivo || '-'}</td></tr>
                <tr><th>Parcelas</th><td>${appointment.QtdParcelas || '1'}x</td></tr>
                <tr><th>Valor Parcela</th><td>${valor}</td></tr>
                <tr><th>Vencimento</th><td>${formatDataSafe(appointment.DataVencimento)}</td></tr>
                <tr><th>Gerar Link Em</th><td><strong>${formatDataSafe(appointment.DataGerarLink)}</strong></td></tr>
                <tr><th>Observação</th><td style="white-space: pre-wrap;">${appointment.Observacao || '-'}</td></tr>
            </table>
        </div>
    `;
    
    document.getElementById('details-modal-content').innerHTML = detailsHtml;
    const overlay = document.getElementById('details-modal-overlay');
    overlay.classList.remove('modal-hidden');
    overlay.style.display = 'flex';
}



window.copyAppointmentFormatted = function() {
    // O último agendamento visualizado fica guardado aqui:
    const app = window.lastOpenedAppointment;

    if (!app) {
        alert("Nenhum agendamento selecionado.");
        return;
    }

    function formatarDataVencimento(valor) {
    if (!valor) return "N/A";

    // Caso venha como Timestamp do Firestore
    if (typeof valor === "object" && valor.seconds) {
        const d = new Date(valor.seconds * 1000);
        return d.toLocaleDateString("pt-BR");
    }

    // Caso venha como string dd/mm/aaaa (já formatada)
    if (typeof valor === "string" && valor.includes("/")) {
        return valor;
    }

    // Caso seja yyyy-mm-dd
    if (typeof valor === "string" && valor.includes("-")) {
        const d = new Date(valor);
        if (!isNaN(d)) return d.toLocaleDateString("pt-BR");
    }

    // Última tentativa
    const d = new Date(valor);
    if (!isNaN(d)) return d.toLocaleDateString("pt-BR");

    return "N/A";
}

const dataVencimento = formatarDataVencimento(app.DataVencimento);

    // Monta o texto final
    const texto =
    `Link agendado para ${dataVencimento}

Nome: ${app.Nome}
E-mail: ${app.Email}
Curso: ${app.Curso}
Assunto: Link agendado com vencimento para ${dataVencimento}, previsto ${app.QtdParcelas}x ${app.ValorParcela}`;

    // Copiar para área de transferência
    navigator.clipboard.writeText(texto)
};

// Helper para formatar UTC (necessário, pois as datas no Firebase são UTC)
function formatDateUTC(dateInput) {
    if (!dateInput) return '-';
    
    let d;
    
    // CENÁRIO 1: É um Timestamp do Firebase (tem a função .toDate)
    if (dateInput && typeof dateInput.toDate === 'function') {
        d = dateInput.toDate();
    } 
    // CENÁRIO 2: É uma String ou Objeto Date padrão
    else {
        d = new Date(dateInput);
    }

    // Verifica se a data é válida (evita NaN)
    if (isNaN(d.getTime())) return 'Data Inválida';

    // Formata (Usa UTC para evitar que o dia volte devido ao fuso horário)
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

// Renderiza a tabela com os dados passados
window.renderListTable = function(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        document.getElementById('no-results-message').style.display = 'block';
        return;
    }
    document.getElementById('no-results-message').style.display = 'none';

    data.forEach(app => {
        const tr = document.createElement('tr');
        
        // Formatação de Valor
        const valor = app.ValorParcela ? parseFloat(app.ValorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
        
        // Formatação de Datas (Usa a função inteligente formatDateUTC)
        const dataGerar = formatDateUTC(app.DataGerarLink);
        const dataVenc = formatDateUTC(app.DataVencimento);

        tr.innerHTML = `
            <td><strong>${dataGerar}</strong></td>
            <td>${app.Nome || '-'}</td>
            <td>${app.Curso || '-'}</td>
            <td>${valor} <small>(${app.QtdParcelas || 1}x)</small></td>
            <td>${dataVenc}</td>
            <td style="text-align: center;">
                <button class="action-btn" onclick="window.showAppointmentDetails('${app.id}')">Ver Detalhes</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Função de Filtragem (Chamada ao digitar ou mudar datas)
window.filterList = function() {
    const searchTerm = document.getElementById('list-search').value.toLowerCase();
    const startDateStr = document.getElementById('filter-start-date').value; 
    const endDateStr = document.getElementById('filter-end-date').value; 

    let filteredData = window.allAppointments || [];

    // 1. Filtros de Texto
    if (searchTerm) {
        filteredData = filteredData.filter(app => 
            (app.Nome && app.Nome.toLowerCase().includes(searchTerm)) ||
            (app.Email && app.Email.toLowerCase().includes(searchTerm)) ||
            (app.Curso && app.Curso.toLowerCase().includes(searchTerm))
        );
    }

    // 2. Filtros de Data (Normalizado)
    if (startDateStr && endDateStr) {
        const parseBrDate = (str) => {
            const [d, m, y] = str.split('/');
            return new Date(y, m - 1, d).getTime();
        };
        const start = parseBrDate(startDateStr);
        const end = parseBrDate(endDateStr) + 86399999; // Final do dia

        filteredData = filteredData.filter(app => {
            if (!app.DataGerarLink) return false;
            // Converte para milissegundos para comparar
            let appTime = 0;
            if (app.DataGerarLink.toDate) appTime = app.DataGerarLink.toDate().getTime();
            else if (typeof app.DataGerarLink === 'string') {
                const d = app.DataGerarLink.includes('/') ? parseDateBR(app.DataGerarLink) : new Date(app.DataGerarLink);
                appTime = d ? d.getTime() : 0;
            }
            return appTime >= start && appTime <= end;
        });
    }

    // 3. ORDENAÇÃO (AQUI ESTÁ A MÁGICA DAS SETINHAS)
    filteredData.sort((a, b) => {
        // Helper para extrair valor comparável (numérico ou texto minúsculo)
        const getValue = (item, col) => {
            let val = item[col];
            if (!val) return 0;

            // Datas (Retorna milissegundos)
            if (col === 'DataGerarLink' || col === 'DataVencimento') {
                if (val.toDate) return val.toDate().getTime();
                if (typeof val === 'string' && val.includes('/')) return parseDateBR(val).getTime();
                return new Date(val).getTime();
            }
            
            // Valor (Retorna número float)
            if (col === 'ValorParcela') {
                return typeof val === 'number' ? val : parseFloat(val);
            }

            // Texto (Retorna string minúscula)
            return val.toString().toLowerCase();
        };

        let valA = getValue(a, currentSort.column);
        let valB = getValue(b, currentSort.column);

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    window.renderListTable(filteredData);
}

// Limpa filtros
window.clearFilters = function() {
    document.getElementById('list-search').value = '';
    const startPicker = document.getElementById('filter-start-date')._flatpickr;
    const endPicker = document.getElementById('filter-end-date')._flatpickr;
    if(startPicker) startPicker.clear();
    if(endPicker) endPicker.clear();
    window.filterList();
}

let currentSort = {
    column: 'DataGerarLink', // Coluna padrão
    direction: 'desc'        // Ordem padrão
};

// Função de Ordenação (Chamada ao clicar no cabeçalho)
window.sortTable = function(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    updateSortIcons();
    window.filterList(); // Re-aplica filtros e ordenação
}

// --- FUNÇÃO DE ORDENAÇÃO (CHAMADA PELO CLIQUE NO CABEÇALHO) ---
window.sortTable = function(column) {
    // Se clicar na mesma coluna, inverte a direção
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Se for nova coluna, começa ascendente
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    // Atualiza os ícones visuais (Opcional, mas recomendado)
    updateSortIcons();

    // Chama o filtro novamente para aplicar a nova ordem e renderizar
    window.filterList();
}

// Função auxiliar para atualizar setinhas nos cabeçalhos (Visual)
function updateSortIcons() {
    // Reseta todos os ícones para neutro
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '↕');
    
    // Define o ícone da coluna atual
    const activeIcon = document.getElementById(`icon-${currentSort.column}`);
    if (activeIcon) {
        activeIcon.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
    }
}