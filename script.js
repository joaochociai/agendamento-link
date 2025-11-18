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
agendamentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('form-message');
    const formData = new FormData(agendamentoForm);
    
    const dataToSave = {};
    formData.forEach((value, key) => dataToSave[key] = value);
    
    dataToSave.createdAt = new Date();
    dataToSave.createdBy = auth.currentUser.email;

    message.textContent = 'Salvando...';
    message.style.color = '#007bff';

    try {
        await addDoc(collection(db, "agendamentos"), dataToSave);
        message.textContent = 'Agendamento salvo com sucesso!';
        message.style.color = '#28a745';
        agendamentoForm.reset();
    } catch (error) {
        console.error("Erro ao salvar: ", error);
        message.textContent = 'Erro ao salvar. Tente novamente.';
        message.style.color = '#dc3545';
    }
});

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
    
    // 1. Mapeamento de dados
    const appointmentsByDate = agendamentos.reduce((acc, item) => {
        let dateString = item.DataGerarLink;
        if (typeof dateString === 'string' && dateString.includes('/')) {
            const parts = dateString.split('/');
            dateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        const dateObject = new Date(dateString); 
        const userTimezoneOffset = dateObject.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(dateObject.getTime() + userTimezoneOffset);

        const dateKey = formatDate(adjustedDate);
        
        // Garante que tenhamos um nome para exibir
        const fullName = item.Nome || 'Aluno';
        const firstName = fullName.split(' ')[0];

        if (adjustedDate.getFullYear() === renderYear && adjustedDate.getMonth() === renderMonthIndex) {
            if (!acc[dateKey]) acc[dateKey] = [];
            // SALVA O ID E O NOME PARA O BOTÃO
            acc[dateKey].push({ name: firstName, id: item.id }); 
        }
        return acc;
    }, {});
    
    // ... (Lógica do Alerta mantida igual) ...
    
    // 3. Constrói o Calendário
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
        
        // GERAÇÃO DOS BOTÕES INTERATIVOS COM O ID CORRETO
        const namesHtml = namesArray ? namesArray.map(app => 
            `<span class="app-link" onclick="window.showAppointmentDetails('${app.id}')" title="Ver detalhes de ${app.name}">
                ${app.name}
             </span>`
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

function getTodayDateKey() { return formatDate(new Date()); }

// Flatpickr
document.addEventListener('DOMContentLoaded', () => {
    flatpickr("#datepicker-vencimento", { dateFormat: "d/m/Y", locale: "pt", allowInput: true });
    flatpickr("#datepicker-gerar", { dateFormat: "d/m/Y", locale: "pt", minDate: "today", allowInput: true });
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
function formatDateUTC(date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}