import React, { useState, useEffect, useRef } from 'react';
import type { FC, ChartType, ChartData, ChartOptions } from 'react'; // CORRECCIÓN: FC importado como tipo
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { Users, Clock, FileText, DollarSign, UserPlus, Download, LogIn, LogOut, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, Save, Briefcase, BarChart2, UserCheck, Cake, Settings as SettingsIcon, Trash2, Printer, Edit, Upload, Paperclip, History } from 'lucide-react'; // CORRECCIÓN: Imports no usados eliminados
import { Chart, registerables } from 'chart.js';

// --- INICIALIZACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCjCdtE8SzsTvqMuDFtGlFNQLy8SuXB95U",
  authDomain: "pekemanager.firebaseapp.com",
  projectId: "pekemanager",
  storageBucket: "pekemanager.firebasestorage.app",
  messagingSenderId: "653711681849",
  appId: "1:653711681849:web:954da8b6185bafe65560e8",
  measurementId: "G-B657E186WT"
};

// Inicializa Firebase y obtén las instancias de los servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// --- Declaración global para jsPDF ---
declare global {
    interface Window {
        jspdf: any;
    }
}

Chart.register(...registerables);

// --- TIPOS DE DATOS (TypeScript) ---

type Schedule = { id: string; name: string; price: number; endTime: string; };
type Document = { id: string; name: string; data: string; };
type HistoryLog = { id: string; user: string; timestamp: string; changes: string; };
type AppHistoryLog = { id: string; user: string; timestamp: string; action: string; details: string; };
type Student = {
  id: string; // Firestore ID
  numericId: number; // Legacy ID for relations
  name: string;
  surname: string;
  schedule: string;
  enrollmentPaid: boolean;
  monthlyPayment: boolean;
  birthDate: string;
  address: string;
  fatherName: string;
  motherName: string;
  phone1: string;
  phone2: string;
  parentEmail: string;
  allergies: string;
  authorizedPickup: string;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'Domiciliación';
  accountHolderName: string;
  nif?: string; // NIF/DNI del titular
  documents: Document[];
  modificationHistory: HistoryLog[];
};
type Attendance = { id: string; childId: number; childName: string; date: string; entryTime?: string; exitTime?: string; droppedOffBy?: string; pickedUpBy?: string; };
type Penalty = { id: string; childId: number; childName: string; date: string; amount: number; reason: string; };
type Invoice = { id: string; numericId: number; childId: number; childName: string; date: string; amount: number; base: number; penalties: number; enrollmentFeeIncluded: boolean; status: 'Pendiente' | 'Pagada' | 'Vencida'; };
type Staff = { id: string; name: string; role: string; phone: string; checkIn: string; checkOut: string; };
type Config = { centerName: string; currency: string; lateFee: number; };
type NotificationMessage = { id: number; message: string; };
type StudentFormData = Omit<Student, 'id' | 'numericId'|'paymentMethod' | 'documents' | 'modificationHistory'> & { paymentMethod: Student['paymentMethod'] | ''; accountHolderName: string; };

// --- COMPONENTES DE UI Y LÓGICA ---

// Hook para detectar clics fuera de un elemento
const useOnClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

// --- Funciones de Utilidad ---
const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) {
        return '';
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            let cellData = row[header];
            if (typeof cellData === 'object' && cellData !== null) {
                cellData = JSON.stringify(cellData);
            }
            const stringValue = String(cellData ?? '').replace(/"/g, '""');
            return `"${stringValue}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
};

const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

const loadScript = (src: string, id: string) => {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.id = id;
        script.onload = () => resolve(true);
        script.onerror = () => reject(false);
        document.head.appendChild(script);
    });
};


// Componente del Logo - "mi pequeño recreo"
const MiPequenoRecreoLogo: FC<{ width?: number; className?: string }> = ({ width = 150, className = '' }) => (
    <div style={{ fontFamily: "'Dancing Script', cursive", color: '#c55a33', fontSize: `${width / 5}px`, textAlign: 'center' }} className={className}>
        mi pequeño recreo
    </div>
);

// Componente del Logo PEKEMANAGER
const PekemanagerLogo: FC<{ size?: number }> = ({ size = 24 }) => (
    <div style={{ display: 'flex', alignItems: 'center', fontFamily: "'Arial Black', Gadget, sans-serif", fontSize: `${size}px`, color: '#212529' }}>
        <div style={{ position: 'relative', marginRight: '5px' }}>
            <span style={{ fontSize: `${size * 1.5}px`, color: '#212529' }}>P</span>
            <div style={{ position: 'absolute', top: `${size * 0.3}px`, left: `${size * 0.9}px`, width: 0, height: 0, borderLeft: `${size * 0.5}px solid transparent`, borderRight: `${size * 0.5}px solid transparent`, borderBottom: `${size * 0.8}px solid #f39c12` }}></div>
        </div>
        <span style={{ fontStyle: 'italic', letterSpacing: '-1px' }}>EKEMANAGER</span>
    </div>
);


// Componente de Gráfico reutilizable
const ChartComponent: FC<{ type: ChartType; data: ChartData; options: ChartOptions }> = ({ type, data, options }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!chartRef.current) return;
        const chart = new Chart(chartRef.current, { type, data, options });
        return () => chart.destroy();
    }, [type, data, options]);
    return <div style={styles.chartContainer}><canvas ref={chartRef}></canvas></div>;
};

// Componente para Notificaciones
const Notification: FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    return <div style={styles.notification}>{message}</div>;
};

// --- COMPONENTES DE UI Y LÓGICA ---

// Componente de carga
const LoadingSpinner: FC = () => (
    <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Cargando datos...</p>
    </div>
);

// --- COMPONENTES DE MODALES ---

// Modal de confirmación
const ConfirmModal: FC<{ message: string; onConfirm: () => void; onCancel: () => void; }> = ({ message, onConfirm, onCancel }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(modalRef, onCancel);
    return (
        <div style={styles.modalBackdrop}>
            <div style={{...styles.modalContent, maxWidth: '400px'}} ref={modalRef}>
                <h3 style={styles.cardTitle}>Confirmación</h3>
                <p>{message}</p>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
                    <button onClick={onCancel} style={{...styles.actionButton, backgroundColor: '#6c757d'}}>Cancelar</button>
                    <button onClick={onConfirm} style={{...styles.actionButton, backgroundColor: '#dc3545'}}>Confirmar</button>
                </div>
            </div>
        </div>
    );
};


// Calendario Personalizado del Alumno
const StudentPersonalCalendar: FC<{ student: Student; attendance: Attendance[]; penalties: Penalty[]; onClose: () => void; }> = ({ student, attendance, penalties, onClose }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const calendarRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(modalRef, onClose);

    const changeMonth = (amount: number) => { setCurrentDate(prevDate => { const newDate = new Date(prevDate); newDate.setMonth(newDate.getMonth() + amount); return newDate; }); };

    const handleExport = () => {
        const calendarNode = calendarRef.current;
        if (calendarNode) {
            const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            const printWindow = window.open('', '_blank');
            printWindow?.document.write(`
                <html>
                    <head>
                        <title>Calendario de ${student.name} ${student.surname} - ${monthName}</title>
                        <style>
                            body { font-family: system-ui, sans-serif; }
                            h1, h2 { text-align: center; }
                            .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; border: 1px solid #ccc; padding: 5px; }
                            .week-day { font-weight: bold; text-align: center; padding: 5px; background-color: #f2f2f2; }
                            .day-cell { border: 1px solid #eee; min-height: 80px; padding: 5px; font-size: 12px; }
                            .day-number { font-weight: bold; }
                            .event-pill { background-color: #e9f3ff; color: #004085; border-radius: 4px; padding: 3px; margin-top: 5px; text-align: center; }
                            .penalty-pill { background-color: #fff3cd; color: #856404; border-radius: 4px; padding: 3px; margin-top: 5px; text-align: center; }
                            .day-cell-empty { border: 1px solid transparent; }
                        </style>
                    </head>
                    <body>
                        <h1>mi pequeño recreo</h1>
                        <h2>Calendario de Asistencia: ${student.name} ${student.surname}</h2>
                        <h3>${monthName.toUpperCase()}</h3>
                        <div class="calendar-grid">${calendarNode.innerHTML}</div>
                    </body>
                </html>
            `);
            printWindow?.document.close();
            printWindow?.print();
        }
    };

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const renderCells = () => {
        const cells = [];
        const adjustedFirstDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        for (let i = 0; i < adjustedFirstDay; i++) { cells.push(<div key={`empty-${i}`} style={styles.dayCellEmpty}></div>); }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const attendanceRecord = attendance.find(a => a.childId === student.numericId && a.date === dateStr);
            const penaltyRecord = penalties.find(p => p.childId === student.numericId && p.date === dateStr);
            
            cells.push(
                <div key={day} style={styles.dayCell}>
                    <div style={styles.dayNumber}>{day}</div>
                    {attendanceRecord && (
                        <div style={styles.eventPill}>
                            {attendanceRecord.entryTime} - {attendanceRecord.exitTime}
                        </div>
                    )}
                    {penaltyRecord && (
                         <div style={styles.penaltyPill} title={`Motivo: ${penaltyRecord.reason}`}>
                            <DollarSign size={11} style={{marginRight: '4px'}}/> {penaltyRecord.amount}€
                        </div>
                    )}
                </div>
            );
        }
        return cells;
    };

    return (
      <div style={styles.modalBackdrop}>
          <div style={{...styles.modalContent, maxWidth: '900px'}} ref={modalRef}>
              <div style={{...styles.calendarHeader, position: 'relative'}}>
                  <h2 style={styles.cardTitle}>Calendario de {student.name} {student.surname}</h2>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <button onClick={() => changeMonth(-1)} style={styles.calendarNavButton}><ChevronLeft /></button>
                      <h3 style={{margin: 0, minWidth: '180px', textAlign: 'center'}}>{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</h3>
                      <button onClick={() => changeMonth(1)} style={styles.calendarNavButton}><ChevronRight /></button>
                  </div>
                  <button onClick={handleExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Printer size={16} style={{marginRight: '8px'}} /> Exportar</button>
                  <button onClick={onClose} style={{...styles.modalCloseButton, right: '-15px'}}><X size={20} /></button>
              </div>
              <div style={styles.calendarGrid} ref={calendarRef}>
                  {weekDays.map(day => <div key={day} style={styles.weekDay}>{day}</div>)}
                  {renderCells()}
              </div>
          </div>
      </div>
    );
};

// Modal para ver la ficha del alumno
const StudentDetailModal: FC<{
    student: Student;
    onClose: () => void;
    schedules: Schedule[];
    onViewPersonalCalendar: (student: Student) => void;
    onUpdate: (studentId: string, updatedData: Partial<Omit<Student, 'id'>>, currentUser: string) => void;
    onAddDocument: (studentId: string, document: Document, currentUser: string) => void;
    onGenerateAndExportInvoice: (student: Student) => void;
    currentUser: string;
}> = ({ student, onClose, schedules, onViewPersonalCalendar, onUpdate, onAddDocument, onGenerateAndExportInvoice, currentUser }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(modalRef, onClose);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedStudent, setEditedStudent] = useState(student);
    const [historyVisible, setHistoryVisible] = useState(false);

    useEffect(() => {
      setEditedStudent(student);
    }, [student]);

    if (!student) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      setEditedStudent(prev => ({ ...prev!, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value }));
    };

    const handleSave = () => {
        const { id, ...updateData } = editedStudent;
        onUpdate(student.id, updateData, currentUser);
        setIsEditing(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const newDocument: Document = {
                    id: `doc_${Date.now()}`,
                    name: file.name,
                    data: loadEvent.target?.result as string,
                };
                onAddDocument(student.id, newDocument, currentUser);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const getScheduleName = (id: string) => schedules.find(s => s.id === id)?.name || 'No especificado';
    
    return (
        <div style={styles.modalBackdrop}>
            <div style={{...styles.modalContent, maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}} ref={modalRef}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2 style={styles.cardTitle}>{student.name} {student.surname}</h2>
                    <div>
                        {isEditing ? (
                            <>
                                <button onClick={handleSave} style={{...styles.actionButton, marginRight: '10px'}}><Save size={16} style={{marginRight: '8px'}}/> Guardar Cambios</button>
                                <button onClick={() => setIsEditing(false)} style={{...styles.actionButton, backgroundColor: '#6c757d'}}>Cancelar</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} style={styles.actionButton}><Edit size={16} style={{marginRight: '8px'}}/> Editar Ficha</button>
                        )}
                        <button onClick={onClose} style={{...styles.modalCloseButton, position: 'static', marginLeft: '10px'}}><X size={20} /></button>
                    </div>
                </div>
                
                <div style={styles.modalGrid}>
                    <div style={styles.modalSection}>
                        <h3 style={styles.modalSectionTitle}>Datos Personales</h3>
                        <p><strong>F. Nacimiento:</strong> {isEditing ? <input type="date" name="birthDate" value={editedStudent.birthDate} onChange={handleInputChange} style={styles.formInputSmall}/> : student.birthDate}</p>
                        <p><strong>Dirección:</strong> {isEditing ? <input type="text" name="address" value={editedStudent.address} onChange={handleInputChange} style={styles.formInputSmall}/> : student.address}</p>
                        <p><strong>Alergias:</strong> {isEditing ? <textarea name="allergies" value={editedStudent.allergies} onChange={handleInputChange} style={styles.formInputSmall}/> : student.allergies || 'Ninguna'}</p>
                    </div>
                     <div style={styles.modalSection}>
                        <h3 style={styles.modalSectionTitle}>Contacto</h3>
                        <p><strong>Padre:</strong> {isEditing ? <input name="fatherName" value={editedStudent.fatherName} onChange={handleInputChange} style={styles.formInputSmall}/> : student.fatherName}</p>
                        <p><strong>Teléfono 1:</strong> {isEditing ? <input name="phone1" value={editedStudent.phone1} onChange={handleInputChange} style={styles.formInputSmall}/> : student.phone1}</p>
                        <p><strong>Madre:</strong> {isEditing ? <input name="motherName" value={editedStudent.motherName} onChange={handleInputChange} style={styles.formInputSmall}/> : student.motherName}</p>
                        <p><strong>Teléfono 2:</strong> {isEditing ? <input name="phone2" value={editedStudent.phone2} onChange={handleInputChange} style={styles.formInputSmall}/> : student.phone2}</p>
                        <p><strong>Email:</strong> {isEditing ? <input name="parentEmail" type="email" value={editedStudent.parentEmail} onChange={handleInputChange} style={styles.formInputSmall}/> : student.parentEmail}</p>
                        <p><strong>Autorizados:</strong> {isEditing ? <input name="authorizedPickup" value={editedStudent.authorizedPickup} onChange={handleInputChange} style={styles.formInputSmall}/> : student.authorizedPickup}</p>
                    </div>
                    <div style={{...styles.modalSection, gridColumn: '1 / -1'}}>
                        <h3 style={styles.modalSectionTitle}>Cuotas y Pagos</h3>
                        <p><strong>Horario:</strong> {isEditing ? 
                            <select name="schedule" value={editedStudent.schedule} onChange={handleInputChange} style={styles.formInputSmall}>{schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price}€)</option>)}</select> 
                            : getScheduleName(student.schedule)}
                        </p>
                        <p><strong>Método de Pago:</strong> {isEditing ? 
                            <select name="paymentMethod" value={editedStudent.paymentMethod} onChange={handleInputChange} style={styles.formInputSmall}>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Domiciliación">Domiciliación</option>
                            </select> 
                            : student.paymentMethod}
                        </p>
                        <p><strong>Titular Cuenta:</strong> {isEditing ? <input name="accountHolderName" value={editedStudent.accountHolderName} onChange={handleInputChange} style={styles.formInputSmall}/> : student.accountHolderName}</p>
                        <p><strong>NIF/DNI:</strong> {isEditing ? <input name="nif" value={editedStudent.nif || ''} onChange={handleInputChange} style={styles.formInputSmall}/> : student.nif || 'No especificado'}</p>
                        <p><strong>Matrícula:</strong> <label style={styles.checkboxLabel}><input type="checkbox" name="enrollmentPaid" checked={editedStudent.enrollmentPaid} onChange={handleInputChange} disabled={!isEditing} /> {editedStudent.enrollmentPaid ? 'Pagada' : 'Pendiente'}</label></p>
                        <p><strong>Mensualidad:</strong> <label style={styles.checkboxLabel}><input type="checkbox" name="monthlyPayment" checked={editedStudent.monthlyPayment} onChange={handleInputChange} disabled={!isEditing} /> {editedStudent.monthlyPayment ? 'Pagada' : 'Pendiente'}</label></p>
                    </div>
                </div>

                <div style={{...styles.modalSection, gridColumn: '1 / -1'}}>
                    <h3 style={styles.modalSectionTitle}>Documentos Adjuntos</h3>
                    <div style={{...styles.listContainerSmall, marginBottom: '10px'}}>
                        {student.documents && student.documents.length > 0 ? student.documents.map(doc => (
                            <div key={doc.id} style={styles.subListItem}>
                                <a href={doc.data} download={doc.name} style={{textDecoration: 'none', color: '#007bff'}}><Paperclip size={14} style={{marginRight: '8px'}}/>{doc.name}</a>
                            </div>
                        )) : <p>No hay documentos adjuntos.</p>}
                    </div>
                    <label style={styles.uploadButton}>
                        <Upload size={16} style={{marginRight: '8px'}}/> Adjuntar Documento
                        <input type="file" onChange={handleFileChange} style={{display: 'none'}} />
                    </label>
                </div>
                
                <div style={{...styles.modalSection, gridColumn: '1 / -1'}}>
                    <h3 onClick={() => setHistoryVisible(!historyVisible)} style={{...styles.modalSectionTitle, cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                        <History size={16} style={{marginRight: '8px'}} /> Historial de Modificaciones
                        <ChevronRight size={20} style={{marginLeft: 'auto', transform: historyVisible ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}} />
                    </h3>
                    {historyVisible && (
                        <div style={styles.listContainerSmall}>
                            {student.modificationHistory && student.modificationHistory.length > 0 ? [...student.modificationHistory].reverse().map(log => (
                                <div key={log.id} style={styles.subListItem}>
                                    <div>
                                        <p style={{margin: 0, fontSize: '12px', color: '#6c757d'}}><strong>{log.timestamp}</strong> por <strong>{log.user}</strong></p>
                                        <p style={{margin: '4px 0 0 0'}}>{log.changes}</p>
                                    </div>
                                </div>
                            )) : <p>No hay modificaciones registradas.</p>}
                        </div>
                    )}
                </div>

                <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                     <button onClick={() => onViewPersonalCalendar(student)} style={{...styles.submitButton, width:'50%'}}><CalendarIcon size={16} style={{marginRight: '8px'}} /> Ver Calendario Personal</button>
                     <button onClick={() => onGenerateAndExportInvoice(student)} style={{...styles.submitButton, width:'50%', backgroundColor: '#17a2b8'}}><FileText size={16} style={{marginRight: '8px'}} /> Exportar Factura PDF</button>
                </div>

            </div>
        </div>
    );
};

// --- PANTALLA DE INICIO DE SESIÓN ---
const LoginScreen: FC<{ onLogin: (username: string) => void }> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const userCredentials = {
      gonzalo: 'gonzalo123',
      trabajador1: 'pass1',
      trabajador2: 'pass2',
      trabajador3: 'pass3',
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const expectedPassword = userCredentials[selectedUser as keyof typeof userCredentials];
    if (expectedPassword && password === expectedPassword) {
      onLogin(selectedUser);
    } else {
      setError('Contraseña incorrecta');
      setPassword('');
    }
  };

  const handleUserSelect = (user: string) => {
      setSelectedUser(user);
      setError('');
  };

  const handleSwitchUser = () => {
      setSelectedUser(null);
      setPassword('');
      setError('');
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <PekemanagerLogo size={32} />
        
        {!selectedUser ? (
            <>
                <p style={styles.loginSubtitle}>¿Quién eres?</p>
                <div style={styles.userSelectionContainer}>
                    {Object.keys(userCredentials).map(user => (
                        <div key={user} style={styles.userProfile} onClick={() => handleUserSelect(user)}>
                            <div style={styles.userAvatar}>
                                <Users size={32} />
                            </div>
                            <span style={styles.userName}>{user.charAt(0).toUpperCase() + user.slice(1)}</span>
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <>
                <div style={styles.selectedUserProfile}>
                    <div style={styles.userAvatar}>
                        <Users size={32} />
                    </div>
                    <span style={styles.userName}>{selectedUser.charAt(0).toUpperCase() + selectedUser.slice(1)}</span>
                </div>
                <form onSubmit={handleLogin} style={{width: '80%'}}>
                    <input 
                        type="password" 
                        placeholder="Contraseña" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        style={styles.loginInput} 
                        autoFocus
                    />
                    {error && <p style={styles.loginError}>{error}</p>}
                    <button type="submit" style={styles.loginButton}><LogIn size={18} style={{ marginRight: '8px' }} />Entrar</button>
                </form>
                <button onClick={handleSwitchUser} style={styles.switchUserButton}>Cambiar de usuario</button>
            </>
        )}
      </div>
    </div>
  );
};


// --- COMPONENTES DE PESTAÑA (DEFINIDOS ANTES DE USARLOS) ---

const Dashboard: FC<{ students: Student[], staff: Staff[], attendance: Attendance[], invoices: Invoice[], schedules: Schedule[], config: Config }> = ({ students, staff, attendance, invoices, schedules, config }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const presentToday = attendance.filter(a => a.date === todayStr).length;
    const monthlyBilling = invoices.filter(inv => new Date(inv.date).getMonth() === new Date().getMonth()).reduce((sum, inv) => sum + inv.amount, 0);
    const upcomingBirthdays = students.filter(s => { const d = new Date(s.birthDate); d.setFullYear(new Date().getFullYear()); const diff = d.getTime() - new Date().getTime(); return diff > 0 && diff < 2.6e9; });
    const attendanceChartData: ChartData<'bar'> = { labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], datasets: [{ label: 'Asistencia Semanal', data: [1, 2, 3, 2, 3], backgroundColor: 'rgba(0, 123, 255, 0.5)', borderColor: '#007bff', borderWidth: 1, borderRadius: 4 }] };
    const scheduleCounts = students.reduce((acc, child) => { acc[child.schedule] = (acc[child.schedule] || 0) + 1; return acc; }, {} as Record<string, number>);
    const occupancyChartData: ChartData<'doughnut'> = { labels: schedules.map(s => s.name), datasets: [{ label: 'Ocupación', data: schedules.map(s => scheduleCounts[s.id] || 0), backgroundColor: ['#007bff', '#17a2b8', '#ffc107', '#28a745', '#dc3545', '#6c757d', '#343a40'], borderWidth: 0 }] };
    const chartOptions: ChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
    return (
        <div>
            <div style={styles.dashboardGrid}>
                <div style={styles.statCard}><UserCheck size={28} style={{color: '#28a745'}}/><div><p>Alumnos Hoy</p><span>{presentToday} / {students.length}</span></div></div>
                <div style={styles.statCard}><DollarSign size={28} style={{color: '#007bff'}}/><div><p>Facturación del Mes</p><span>{monthlyBilling.toFixed(2)}{config.currency}</span></div></div>
                <div style={styles.statCard}><Cake size={28} style={{color: '#ffc107'}}/><div><p>Próximos Cumpleaños</p><span>{upcomingBirthdays.length}</span></div></div>
                <div style={styles.statCard}><Briefcase size={28} style={{color: '#17a2b8'}}/><div><p>Personal Activo</p><span>{staff.filter(s => s.checkIn && !s.checkOut).length}</span></div></div>
            </div>
            <div style={{...styles.grid, marginTop: '30px'}}>
                <div style={styles.card}><h3 style={styles.cardTitle}>Asistencia Última Semana</h3><ChartComponent type="bar" data={attendanceChartData} options={chartOptions} /></div>
                <div style={styles.card}><h3 style={styles.cardTitle}>Ocupación por Horario</h3><ChartComponent type="doughnut" data={occupancyChartData} options={{...chartOptions, plugins: { legend: { display: true, position: 'bottom' }}}} /></div>
            </div>
        </div>
    );
};

// Componente para la lista de alumnos
const StudentList: FC<{ students: Student[], onSelectChild: (student: Student) => void, onDeleteChild: (id: string, name: string) => void, onExport: () => void }> = ({ students, onSelectChild, onDeleteChild, onExport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredStudents = students.filter(student =>
    `${student.name} ${student.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mejora: Ordenar la lista de alumnos alfabéticamente
  const sortedStudents = [...filteredStudents].sort((a, b) => 
    `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)
  );

  return (
    <div style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h3 style={{...styles.cardTitle, margin: 0}}>Alumnos Inscritos ({sortedStudents.length})</h3>
            <div style={{display: 'flex', gap: '10px'}}>
                <input
                    type="text"
                    placeholder="Buscar alumno..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{...styles.formInputSmall, width: '250px'}}
                />
                 <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
            </div>
        </div>
        <div style={styles.listContainer}>
            {sortedStudents.map(child => (
                <div key={child.id} style={styles.listItem}>
                    <div>
                        <p style={styles.listItemName}>{child.name} {child.surname}</p>
                        <p style={styles.listItemInfo}>Titular: {child.accountHolderName || 'No especificado'}</p>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <button onClick={() => onSelectChild(child)} style={styles.pillInfo}>Ver Ficha</button>
                        <button onClick={() => onDeleteChild(child.id, `${child.name} ${child.surname}`)} style={styles.deleteButton}><Trash2 size={14}/></button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};


// Componente para el formulario de inscripción
const NewStudentForm: FC<{ onAddChild: (e: React.FormEvent) => void, childForm: StudentFormData, onFormChange: React.Dispatch<React.SetStateAction<StudentFormData>>, schedules: Schedule[] }> = ({ onAddChild, childForm, onFormChange, schedules }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const { name, value, type } = e.target; const isCheckbox = type === 'checkbox'; onFormChange(prev => ({ ...prev, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value })); };
  return (
    <div style={styles.card}><h3 style={styles.cardTitle}>Ficha de Inscripción</h3>
        <form onSubmit={onAddChild}>
            <div style={styles.formGrid}>
                <input name="name" value={childForm.name} onChange={handleInputChange} placeholder="Nombre del Alumno" style={styles.formInput} required />
                <input name="surname" value={childForm.surname} onChange={handleInputChange} placeholder="Apellidos" style={styles.formInput} required />
                <input name="birthDate" type="date" value={childForm.birthDate} onChange={handleInputChange} style={{...styles.formInput, gridColumn: '1 / -1'}} required />
                <input name="address" value={childForm.address} onChange={handleInputChange} placeholder="Dirección Completa" style={{...styles.formInput, gridColumn: '1 / -1'}} />
                <input name="fatherName" value={childForm.fatherName} onChange={handleInputChange} placeholder="Nombre del Padre" style={styles.formInput} />
                <input name="phone1" type="tel" value={childForm.phone1} onChange={handleInputChange} placeholder="Teléfono 1" style={styles.formInput} required />
                <input name="motherName" value={childForm.motherName} onChange={handleInputChange} placeholder="Nombre de la Madre" style={styles.formInput} />
                <input name="phone2" type="tel" value={childForm.phone2} onChange={handleInputChange} placeholder="Teléfono 2" style={styles.formInput} />
                <input name="parentEmail" type="email" value={childForm.parentEmail} onChange={handleInputChange} placeholder="Email de Contacto" style={{...styles.formInput, gridColumn: '1 / -1'}} />
                <select name="schedule" value={childForm.schedule} onChange={handleInputChange} style={{...styles.formInput, gridColumn: '1 / -1'}} required><option value="">Seleccionar horario...</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price}€)</option>)}</select>
                <select name="paymentMethod" value={childForm.paymentMethod} onChange={handleInputChange} style={{...styles.formInput, gridColumn: '1 / -1'}} required>
                    <option value="">Seleccionar método de pago...</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Domiciliación">Domiciliación Bancaria</option>
                </select>
                <input name="accountHolderName" value={childForm.accountHolderName} onChange={handleInputChange} placeholder="Titular de la cuenta bancaria" style={{...styles.formInput, gridColumn: '1 / -1'}} />
                 <input name="nif" value={childForm.nif || ''} onChange={handleInputChange} placeholder="NIF/DNI del Titular" style={{...styles.formInput, gridColumn: '1 / -1'}} />
                <input name="authorizedPickup" value={childForm.authorizedPickup} onChange={handleInputChange} placeholder="Personas autorizadas para la recogida" style={{...styles.formInput, gridColumn: '1 / -1'}} />
            </div>
            <textarea name="allergies" value={childForm.allergies} onChange={handleInputChange} placeholder="Alergias y notas médicas..." style={{...styles.formInput, width: 'calc(100% - 24px)', gridColumn: '1 / -1'}} rows={3}></textarea>
            <div style={{gridColumn: '1 / -1', display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px'}}><label style={styles.checkboxLabel}><input type="checkbox" name="enrollmentPaid" checked={childForm.enrollmentPaid} onChange={handleInputChange} /> Matrícula Pagada (100€)</label></div>
            <button type="submit" style={{...styles.submitButton, gridColumn: '1 / -1'}}>Inscribir Alumno</button>
        </form>
    </div>
  );
};

const AttendanceManager: FC<{ students: Student[], attendance: Attendance[], onSave: (data: Omit<Attendance, 'id' | 'childId'> & {childId: number}) => void, onExport: () => void }> = ({ students, attendance, onSave, onExport }) => {
    const today = new Date().toISOString().split('T')[0];
    const [attendanceData, setAttendanceData] = useState<Record<number, Partial<Omit<Attendance, 'id' | 'childId' | 'childName' | 'date'>>>>({});
    const handleAttendanceChange = (childId: number, field: keyof Omit<Attendance, 'id' | 'childId' | 'childName' | 'date'>, value: string) => { setAttendanceData(prev => ({ ...prev, [childId]: { ...prev[childId], [field]: value } })); };
    const handleSaveClick = (childId: number, childName: string) => { const dataToSave = { childId, childName, date: today, ...attendanceData[childId] }; onSave(dataToSave); };
    return (
        <div style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                 <h3 style={{...styles.cardTitle, margin:0}}>Control de Asistencia - {new Date(today).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                 <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
            </div>
            <div style={styles.listContainer}>
                {students.map(student => {
                    const todayAttendance = attendance.find(a => a.childId === student.numericId && a.date === today);
                    const currentData = attendanceData[student.numericId] || {};
                    return (
                        <div key={student.id} style={styles.attendanceItem}>
                            <p style={styles.listItemName}>{student.name} {student.surname}</p>
                            <div style={styles.attendanceGrid}>
                                <input type="time" style={styles.formInputSmall} defaultValue={todayAttendance?.entryTime} onChange={(e) => handleAttendanceChange(student.numericId, 'entryTime', e.target.value)} />
                                <input type="text" placeholder="Quién lo deja" style={styles.formInputSmall} defaultValue={todayAttendance?.droppedOffBy} onChange={(e) => handleAttendanceChange(student.numericId, 'droppedOffBy', e.target.value)} />
                                <input type="time" style={styles.formInputSmall} defaultValue={todayAttendance?.exitTime} onChange={(e) => handleAttendanceChange(student.numericId, 'exitTime', e.target.value)} />
                                <input type="text" placeholder="Quién lo recoge" style={styles.formInputSmall} defaultValue={todayAttendance?.pickedUpBy} onChange={(e) => handleAttendanceChange(student.numericId, 'pickedUpBy', e.target.value)} />
                                <button style={styles.saveButton} onClick={() => handleSaveClick(student.numericId, `${student.name} ${student.surname}`)} disabled={!currentData.entryTime && !currentData.exitTime}><Save size={16} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Invoicing: FC<{ invoices: Invoice[], onGenerate: () => void, onUpdateStatus: (invoiceId: string, newStatus: Invoice['status']) => void, config: Config, onExport: () => void }> = ({ invoices, onGenerate, onUpdateStatus, config, onExport }) => {
    const handleStatusChange = (invoiceId: string, newStatus: Invoice['status']) => { onUpdateStatus(invoiceId, newStatus); };
    return (
        <div style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><h3 style={styles.cardTitle}>Facturación Mensual</h3>
                <div style={{display: 'flex', gap: '10px'}}>
                    <button onClick={onGenerate} style={styles.actionButton}>Generar Facturas del Mes</button>
                    <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
                </div>
            </div>
            <div style={styles.listContainer}>
                {invoices.length > 0 ? invoices.map(inv => (
                    <div key={inv.id} style={styles.listItem}>
                        <div><p style={styles.listItemName}>{inv.childName}</p><p style={styles.listItemInfo}>Fecha: {inv.date} | Base: {inv.base}{config.currency} + Penaliz: {inv.penalties}{config.currency}</p></div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><strong style={{fontSize: '16px'}}>{inv.amount.toFixed(2)}{config.currency}</strong><select value={inv.status} onChange={(e) => handleStatusChange(inv.id, e.target.value as Invoice['status'])} style={styles.formInputSmall}><option value="Pendiente">Pendiente</option><option value="Pagada">Pagada</option><option value="Vencida">Vencida</option></select></div>
                    </div>
                )) : <p>No hay facturas generadas. Haz clic en el botón para crearlas.</p>}
            </div>
        </div>
    );
};

const PenaltiesViewer: FC<{ penalties: Penalty[], config: Config, onExport: () => void, onUpdatePenalty: (id: string, data: Partial<Omit<Penalty, 'id'>>) => void, onDeletePenalty: (id: string) => void }> = ({ penalties, config, onExport, onUpdatePenalty, onDeletePenalty }) => {
    const [editingPenalty, setEditingPenalty] = useState<Penalty | null>(null);
    const [editedData, setEditedData] = useState<{amount: number, reason: string}>({ amount: 0, reason: '' });

    const handleEditClick = (penalty: Penalty) => {
        setEditingPenalty(penalty);
        setEditedData({ amount: penalty.amount, reason: penalty.reason });
    };

    const handleCancelClick = () => {
        setEditingPenalty(null);
    };

    const handleSaveClick = () => {
        if (editingPenalty) {
            onUpdatePenalty(editingPenalty.id, editedData);
            setEditingPenalty(null);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditedData(prev => ({...prev, [name]: name === 'amount' ? Number(value) : value }));
    };

    return (
        <div style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={styles.cardTitle}>Registro de Penalizaciones</h3>
                <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
            </div>
            <div style={styles.listContainer}>
                {penalties.length > 0 ? penalties.map(penalty => (
                    <div key={penalty.id} style={styles.listItem}>
                        {editingPenalty?.id === penalty.id ? (
                            <div style={{width: '100%', display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <input 
                                    type="number" 
                                    name="amount" 
                                    value={editedData.amount} 
                                    onChange={handleInputChange}
                                    style={{...styles.formInputSmall, width: '100px'}}
                                />
                                <input 
                                    type="text" 
                                    name="reason" 
                                    value={editedData.reason} 
                                    onChange={handleInputChange}
                                    style={{...styles.formInputSmall, flex: 1}}
                                />
                                <button onClick={handleSaveClick} style={styles.saveButton}><Save size={16} /></button>
                                <button onClick={handleCancelClick} style={styles.deleteButton}><X size={16} /></button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <p style={styles.listItemName}>{penalty.childName}</p>
                                    <p style={styles.listItemInfo}>Fecha: {penalty.date} - {penalty.reason}</p>
                                </div>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                     <span style={styles.pillWarning}>{penalty.amount}{config.currency}</span>
                                     <button onClick={() => handleEditClick(penalty)} style={{...styles.actionButton, backgroundColor: '#ffc107', padding: '5px 8px'}}><Edit size={14}/></button>
                                     <button onClick={() => onDeletePenalty(penalty.id)} style={styles.deleteButton}><Trash2 size={14}/></button>
                                </div>
                            </>
                        )}
                    </div>
                )) : <p>No hay penalizaciones registradas.</p>}
            </div>
        </div>
    );
};

const StaffManager: FC<{ staff: Staff[], onAddStaff: (newStaff: Omit<Staff, 'id' | 'checkIn' | 'checkOut'>) => void, onUpdateStaff: (id: string, updates: Partial<Staff>) => void, onExport: () => void }> = ({ staff, onAddStaff, onUpdateStaff, onExport }) => {
    const [newStaff, setNewStaff] = useState({name: '', role: '', phone: ''});
    const handleAdd = (e: React.FormEvent) => { e.preventDefault(); onAddStaff(newStaff); setNewStaff({name: '', role: '', phone: ''}); };
    const handleCheckIn = (id: string) => onUpdateStaff(id, { checkIn: new Date().toLocaleTimeString(), checkOut: '' });
    const handleCheckOut = (id: string) => onUpdateStaff(id, { checkOut: new Date().toLocaleTimeString() });
    return (
        <div style={styles.grid}>
            <div style={styles.card}><h3 style={styles.cardTitle}>Añadir Personal</h3>
                <form onSubmit={handleAdd}><input value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} placeholder="Nombre completo" style={styles.formInput} /><input value={newStaff.role} onChange={(e) => setNewStaff({...newStaff, role: e.target.value})} placeholder="Cargo" style={styles.formInput} /><input value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} placeholder="Teléfono" style={styles.formInput} /><button type="submit" style={styles.submitButton}>Añadir Empleado</button></form>
            </div>
            <div style={styles.card}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h3 style={styles.cardTitle}>Control Horario del Personal</h3>
                    <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
                </div>
                <div style={styles.listContainer}>{staff.map(s => (<div key={s.id} style={styles.listItem}><div><p style={styles.listItemName}>{s.name}</p><p style={styles.listItemInfo}>{s.role}</p></div><div style={{display: 'flex', gap: '10px'}}><button onClick={() => handleCheckIn(s.id)} style={styles.pillSuccess}>Entrada</button><button onClick={() => handleCheckOut(s.id)} style={styles.pillWarning}>Salida</button></div></div>))}</div>
            </div>
        </div>
    );
};

const Settings: FC<{ config: Config, onSave: (config: Config) => void, addNotification: (message: string) => void }> = ({ config, onSave, addNotification }) => {
    const [localConfig, setLocalConfig] = useState(config);
    useEffect(() => setLocalConfig(config), [config]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setLocalConfig(prev => ({ ...prev, [name]: name === 'lateFee' ? Number(value) : value })); };
    const handleSave = (e: React.FormEvent) => { 
        e.preventDefault(); 
        onSave(localConfig); 
        addNotification('Configuración guardada.'); 
    };
    return (
        <div style={styles.card}><h3 style={styles.cardTitle}>Configuración General</h3>
            <form onSubmit={handleSave}>
                <label style={styles.formLabel}>Nombre del Centro</label><input name="centerName" value={localConfig.centerName} onChange={handleChange} style={styles.formInput} />
                <label style={styles.formLabel}>Moneda</label><input name="currency" value={localConfig.currency} onChange={handleChange} style={styles.formInput} />
                <label style={styles.formLabel}>Tarifa de Penalización por Retraso (por cada 15 min)</label><input name="lateFee" type="number" value={localConfig.lateFee} onChange={handleChange} style={styles.formInput} />
                <button type="submit" style={styles.submitButton}>Guardar Configuración</button>
            </form>
        </div>
    );
};

// Calendario General
const Calendar: FC<{ attendance: Attendance[] }> = ({ attendance }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const changeMonth = (amount: number) => { setCurrentDate(prevDate => { const newDate = new Date(prevDate); newDate.setMonth(newDate.getMonth() + amount); return newDate; }); };

    const dailyCounts = attendance.reduce((acc, att) => {
        if (!acc[att.date]) {
            acc[att.date] = new Set();
        }
        acc[att.date].add(att.childId);
        return acc;
    }, {} as Record<string, Set<number>>);

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    
    const renderCells = () => {
        const cells = [];
        const adjustedFirstDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        for (let i = 0; i < adjustedFirstDay; i++) { cells.push(<div key={`empty-${i}`} style={styles.dayCellEmpty}></div>); }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const count = dailyCounts[dateStr] ? dailyCounts[dateStr].size : 0;
            cells.push(
                <div key={day} style={{...styles.dayCell, ...(count > 20 ? {backgroundColor: '#d4edda'} : count > 10 ? {backgroundColor: '#fff3cd'} : {})}}>
                    <span style={styles.dayNumber}>{day}</span>
                    {count > 0 && (
                        <div style={styles.dayCount}>
                            <Users size={14} style={{marginRight: '4px'}} />
                            {count}
                        </div>
                    )}
                </div>
            );
        }
        return cells;
    };

    return (
        <div style={styles.card}>
            <div style={styles.calendarHeader}>
                <button onClick={() => changeMonth(-1)} style={styles.calendarNavButton}><ChevronLeft /></button>
                <h2 style={styles.cardTitle}>{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</h2>
                <button onClick={() => changeMonth(1)} style={styles.calendarNavButton}><ChevronRight /></button>
            </div>
            <div style={styles.calendarGrid}>
                {weekDays.map(day => <div key={day} style={styles.weekDay}>{day}</div>)}
                {renderCells()}
            </div>
        </div>
    );
};

// Historial General de la App
const AppHistoryViewer: FC<{ history: AppHistoryLog[], onExport: () => void }> = ({ history, onExport }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredHistory = history.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div style={styles.card}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h3 style={{...styles.cardTitle, margin: 0}}>Historial de Actividad General</h3>
                <div style={{display: 'flex', gap: '10px'}}>
                    <input
                        type="text"
                        placeholder="Buscar en historial..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{...styles.formInputSmall, width: '250px'}}
                    />
                    <button onClick={onExport} style={{...styles.actionButton, backgroundColor: '#17a2b8'}}><Download size={16} style={{marginRight: '8px'}} />Exportar</button>
                </div>
            </div>
            <div style={styles.listContainer}>
                {filteredHistory.length > 0 ? filteredHistory.map(log => (
                    <div key={log.id} style={styles.listItem}>
                        <div>
                            <p style={styles.listItemName}>{log.action}: <span style={{fontWeight: 'normal'}}>{log.details}</span></p>
                            <p style={styles.listItemInfo}>Realizado por <strong>{log.user}</strong> el {log.timestamp}</p>
                        </div>
                    </div>
                )) : <p>No hay actividad registrada.</p>}
            </div>
        </div>
    );
};


// --- COMPONENTES PRINCIPAL DE LA APLICACIÓN ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('invitado');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [viewingCalendarForStudent, setViewingCalendarForStudent] = useState<Student | null>(null);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, message: string, onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => {} });
  const [isLoading, setIsLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);
  const appId = 'pekemanager-app';


  // --- DATOS Y ESTADO GLOBAL ---
  const [config, setConfig] = useState<Config>({ centerName: 'mi pequeño recreo', currency: '€', lateFee: 6 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [children, setChildren] = useState<Student[]>([]);
  const [childForm, setChildForm] = useState<StudentFormData>({ name: '', surname: '', birthDate: '', address: '', fatherName: '', motherName: '', phone1: '', phone2: '', parentEmail: '', schedule: '', allergies: '', authorizedPickup: '', enrollmentPaid: false, monthlyPayment: true, paymentMethod: '', accountHolderName: '', nif: '' });
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [appHistory, setAppHistory] = useState<AppHistoryLog[]>([]);

  const schedules: Schedule[] = [
    { id: 'h_305', name: 'Cuota 305€', price: 305, endTime: '12:00' },
    { id: 'h_315', name: 'Cuota 315€ (8:30-12:30)', price: 315, endTime: '12:30' },
    { id: 'h_400', name: 'Cuota 400€', price: 400, endTime: '13:00' },
    { id: 'h_410', name: 'Cuota 410€ (8:30-13:30)', price: 410, endTime: '13:30' },
    { id: 'h_415', name: 'Cuota 415€', price: 415, endTime: '13:00' },
    { id: 'h_425', name: 'Cuota 425€ (8:30-15:00)', price: 425, endTime: '15:00' },
    { id: 'h_440', name: 'Cuota 440€', price: 440, endTime: '15:00' },
    { id: 'h_450', name: 'Cuota 450€ (8:30-15:30)', price: 450, endTime: '15:30' },
    { id: 'h_460', name: 'Cuota 460€ (8:30-16:30)', price: 460, endTime: '16:30' },
    { id: 'h_480', name: 'Cuota 480€', price: 480, endTime: '17:00' },
    { id: 'h_495', name: 'Cuota 495€ (8:30-17:00)', price: 495, endTime: '17:00' },
    { id: 'h_510', name: 'Cuota 510€', price: 510, endTime: '17:30' },
    { id: 'h_530', name: 'Cuota 530€', price: 530, endTime: '18:00' },
    { id: 'h_545', name: 'Cuota 545€ (8:30-18:00)', price: 545, endTime: '18:00' },
    { id: 'h_560', name: 'Cuota 560€', price: 560, endTime: '18:30' },
  ];

  // --- INICIALIZACIÓN DE FIREBASE Y AUTH LISTENER ---
  useEffect(() => {
    Promise.all([
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf-script"),
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js", "jspdf-autotable-script")
    ]).catch(err => console.error("Error loading PDF scripts", err));
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        console.log("Firebase Auth conectado y listo. UID:", user.uid);
        setIsLoading(false);
      } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Error en el inicio de sesión anónimo:", error);
            setIsLoading(false);
        });
      }
    });
    
    return () => unsubscribe();
  }, []);

  // --- LISTENERS DE FIREBASE PARA DATOS EN TIEMPO REAL ---
  const dataListeners = [
      { name: 'children', setter: setChildren },
      { name: 'staff', setter: setStaff },
      { name: 'attendance', setter: setAttendance },
      { name: 'penalties', setter: setPenalties },
      { name: 'invoices', setter: setInvoices },
      { name: 'appHistory', setter: setAppHistory },
  ];

  useEffect(() => {
    if (!userId) return;

    const unsubscribers = dataListeners.map(({ name, setter }) => {
        const collectionPath = `/artifacts/${appId}/public/data/${name}`;
        const q = query(collection(db, collectionPath));
        return onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setter(data as any);
        }, (error) => console.error(`Error fetching ${name}:`, error));
    });
    
    const configDocPath = `/artifacts/${appId}/public/data/settings/config`;
    const unsubConfig = onSnapshot(doc(db, configDocPath), (docSnap) => {
        if (docSnap.exists()) {
            setConfig(docSnap.data() as Config);
        } else {
             setDoc(doc(db, configDocPath), config);
        }
    }, (error) => console.error("Error fetching config:", error));

    unsubscribers.push(unsubConfig);
    
    return () => unsubscribers.forEach(unsub => unsub());

  }, [userId]);

  // Sincronizar el modal con los datos actualizados de Firestore
  useEffect(() => {
      if(selectedChild) {
          const freshStudentData = children.find(c => c.id === selectedChild.id);
          if (freshStudentData) {
              setSelectedChild(freshStudentData);
          } else {
              setSelectedChild(null);
          }
      }
  }, [children, selectedChild]);


  // --- LÓGICA DE NEGOCIO (CONECTADA A FIREBASE) ---
  const addNotification = (message: string) => { setNotifications(prev => [...prev, { id: Date.now(), message }]); };
  
  const addAppHistoryLog = async (user: string, action: string, details: string) => {
    if (!userId) return;
    const newLog = {
        user,
        action,
        details,
        timestamp: new Date().toLocaleString('es-ES'),
    };
    try {
        const historyCollectionPath = `/artifacts/${appId}/public/data/appHistory`;
        await addDoc(collection(db, historyCollectionPath), newLog);
    } catch (error) {
        console.error("Error logging history:", error);
    }
  };

  const handleExport = (dataType: string) => {
    let dataToExport: any[] = [];
    switch (dataType) {
        case 'alumnos': dataToExport = children; break;
        case 'asistencia': dataToExport = attendance; break;
        case 'facturacion': dataToExport = invoices; break;
        case 'penalizaciones': dataToExport = penalties; break;
        case 'personal': dataToExport = staff; break;
        case 'historial': dataToExport = appHistory; break;
        default: addNotification("Tipo de dato para exportar no reconocido."); return;
    }

    if (dataToExport.length === 0) {
        addNotification("No hay datos para exportar.");
        return;
    }
    
    try {
        const csv = convertToCSV(dataToExport);
        const fileName = `${dataType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(csv, fileName);
        addNotification(`Exportando ${dataType} a CSV.`);
    } catch (error) {
        console.error("Error exporting to CSV:", error);
        addNotification("Ocurrió un error al exportar los datos.");
    }
  };

  const handleLogin = (username: string) => {
    setIsLoggedIn(true);
    setCurrentUser(username);
    addAppHistoryLog(username, 'Inicio de Sesión', `El usuario ${username} ha iniciado sesión.`);
  };

  const handleLogout = () => {
    addAppHistoryLog(currentUser, 'Cierre de Sesión', `El usuario ${currentUser} ha cerrado sesión.`);
    setIsLoggedIn(false);
    setCurrentUser('invitado');
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
        addNotification("Error: No se puede conectar a la base de datos.");
        return;
    }

    const newChild: Omit<Student, 'id'> = { 
        ...childForm, 
        numericId: Date.now(), 
        paymentMethod: childForm.paymentMethod as Student['paymentMethod'],
        documents: [],
        modificationHistory: [] 
    };
    try {
        const childrenCollectionPath = `/artifacts/${appId}/public/data/children`;
        await addDoc(collection(db, childrenCollectionPath), newChild);
        setChildForm({ name: '', surname: '', birthDate: '', address: '', fatherName: '', motherName: '', phone1: '', phone2: '', parentEmail: '', schedule: '', allergies: '', authorizedPickup: '', enrollmentPaid: false, monthlyPayment: true, paymentMethod: '', accountHolderName: '', nif: '' });
        addNotification(`Alumno ${newChild.name} inscrito con éxito.`);
        addAppHistoryLog(currentUser, 'Inscripción', `Se ha inscrito al nuevo alumno: ${newChild.name} ${newChild.surname}.`);
        setActiveTab('alumnos');
    } catch(error) {
        console.error("Error adding child: ", error);
        addNotification("Error al inscribir alumno.");
    }
  };

  const handleDeleteChild = (childId: string, name: string) => { 
      const onConfirmDelete = async () => {
          if (!userId) return;
          try {
              const childDocPath = `/artifacts/${appId}/public/data/children/${childId}`;
              await deleteDoc(doc(db, childDocPath));
              addNotification('Alumno eliminado.');
              addAppHistoryLog(currentUser, 'Eliminación', `Se ha eliminado al alumno: ${name}.`);
          } catch(error) {
              console.error("Error deleting child: ", error);
              addNotification("Error al eliminar alumno.");
          }
          setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
      };

      setConfirmModal({
          isOpen: true,
          message: `¿Estás seguro de que quieres eliminar a ${name}? Esta acción no se puede deshacer.`,
          onConfirm: onConfirmDelete,
      });
  };

    const handleUpdateStudent = async (studentId: string, updatedData: Partial<Omit<Student, 'id'>>, user: string) => {
        if (!userId) return;
        const originalStudent = children.find(c => c.id === studentId);
        if (!originalStudent) return;

        let changesDescription = '';
        Object.keys(updatedData).forEach(key => {
            const typedKey = key as keyof Omit<Student, 'id'>;
            if (originalStudent[typedKey] !== updatedData[typedKey]) {
                changesDescription += `Cambió '${key}'. `;
            }
        });
        
        const finalUpdateData = { ...updatedData };

        if (changesDescription) {
            const newLog: HistoryLog = {
                id: `hist_${Date.now()}`,
                user: user,
                timestamp: new Date().toLocaleString('es-ES'),
                changes: changesDescription,
            };
            (finalUpdateData as Student).modificationHistory = [...(originalStudent.modificationHistory || []), newLog];
        }

        try {
            const studentDocPath = `/artifacts/${appId}/public/data/children/${studentId}`;
            await updateDoc(doc(db, studentDocPath), finalUpdateData);
            addNotification(`Ficha de ${updatedData.name || originalStudent.name} guardada.`);
            if (changesDescription) {
                addAppHistoryLog(user, 'Modificación de Ficha', `Se ha actualizado la ficha de ${originalStudent.name} ${originalStudent.surname}.`);
            }
        } catch(error) {
            console.error("Error updating student: ", error);
            addNotification("Error al guardar la ficha.");
        }
    };
    
    const handleAddDocument = async (studentId: string, documentData: Document, user: string) => {
        const student = children.find(c => c.id === studentId);
        if (!student || !userId) return;
        
        const updatedDocuments = [...(student.documents || []), documentData];
        try {
            const studentDocPath = `/artifacts/${appId}/public/data/children/${studentId}`;
            await updateDoc(doc(db, studentDocPath), { documents: updatedDocuments });
            addNotification(`Documento '${documentData.name}' añadido.`);
            addAppHistoryLog(user, 'Documento Añadido', `Se ha añadido el documento '${documentData.name}' a ${student.name} ${student.surname}.`);
        } catch(error) {
            console.error("Error adding document: ", error);
            addNotification("Error al añadir documento.");
        }
    };

  const handleSaveAttendance = async (attendanceData: Omit<Attendance, 'id'>) => {
    if (!userId) return;
    const existingEntry = attendance.find(a => a.date === attendanceData.date && a.childId === attendanceData.childId);
    
    try {
        const attendanceCollectionPath = `/artifacts/${appId}/public/data/attendance`;
        if (existingEntry) {
            await updateDoc(doc(db, attendanceCollectionPath, existingEntry.id), attendanceData);
        } else {
            await addDoc(collection(db, attendanceCollectionPath), attendanceData);
        }

        addNotification(`Asistencia de ${attendanceData.childName} guardada.`);
        addAppHistoryLog(currentUser, 'Asistencia', `Se ha guardado la asistencia para ${attendanceData.childName} el ${attendanceData.date}.`);
        
        if (attendanceData.exitTime) {
            const child = children.find(c => c.numericId === attendanceData.childId);
            const schedule = schedules.find(s => s.id === child?.schedule);
            if (!child || !schedule) return;
            const [endH, endM] = schedule.endTime.split(':').map(Number);
            const [exitH, exitM] = attendanceData.exitTime.split(':').map(Number);
            const endMins = endH * 60 + endM;
            const exitMins = exitH * 60 + exitM;
            if (exitMins > endMins) {
                const delayMins = exitMins - endMins;
                const penaltyAmount = Math.ceil(delayMins / 15) * config.lateFee; 
                if (penaltyAmount > 0) {
                    const newPenalty = { childId: child.numericId, childName: `${child.name} ${child.surname}`, date: attendanceData.date, amount: penaltyAmount, reason: `Retraso de ${delayMins} min.` };
                    const penaltiesCollectionPath = `/artifacts/${appId}/public/data/penalties`;
                    await addDoc(collection(db, penaltiesCollectionPath), newPenalty);
                    addNotification(`Penalización de ${penaltyAmount}${config.currency} añadida para ${child.name}.`);
                    addAppHistoryLog(currentUser, 'Penalización', `Generada penalización de ${penaltyAmount}${config.currency} para ${child.name} ${child.surname}.`);
                }
            }
        }
    } catch (error) {
        console.error("Error saving attendance: ", error);
        addNotification("Error al guardar asistencia.");
    }
  };

  const generateInvoices = async () => {
    if (!userId) return;
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    
    for (const child of children) {
        const schedule = schedules.find(s => s.id === child.schedule);
        if (!schedule) continue;
        const childPenalties = penalties.filter(p => p.childId === child.numericId && new Date(p.date).getMonth() === month && new Date(p.date).getFullYear() === year);
        const totalPenalties = childPenalties.reduce((sum, p) => sum + p.amount, 0);
        let totalAmount = schedule.price + totalPenalties;
        let enrollmentFeeApplied = false;
        
        if (!child.enrollmentPaid) { 
            totalAmount += 100;
            enrollmentFeeApplied = true;
        }
        
        const invoiceData: Omit<Invoice, 'id'> = {
            numericId: Date.now() + child.numericId,
            childId: child.numericId,
            childName: `${child.name} ${child.surname}`,
            date: new Date().toISOString().split('T')[0],
            amount: totalAmount,
            base: schedule.price,
            penalties: totalPenalties,
            enrollmentFeeIncluded: enrollmentFeeApplied,
            status: 'Pendiente' as Invoice['status'],
        };

        const existingInvoice = invoices.find(inv => inv.childId === child.numericId && new Date(inv.date).getMonth() === month && new Date(inv.date).getFullYear() === year);
        const invoicesCollectionPath = `/artifacts/${appId}/public/data/invoices`;
        
        try {
            if (existingInvoice) {
                await setDoc(doc(db, invoicesCollectionPath, existingInvoice.id), invoiceData);
            } else {
                await addDoc(collection(db, invoicesCollectionPath), invoiceData);
            }
        } catch(e) { console.error("Error generating/updating invoice for ", child.name, e)}
    }
    
    addNotification(`${children.length} facturas generadas/actualizadas.`);
    addAppHistoryLog(currentUser, 'Facturación', `Se han generado/actualizado ${children.length} facturas para el mes actual.`);
  };
  
    const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
        if (!userId) return;
        try {
            const invoiceDocPath = `/artifacts/${appId}/public/data/invoices/${invoiceId}`;
            await updateDoc(doc(db, invoiceDocPath), { status: newStatus });
            addNotification("Estado de factura actualizado.");
        } catch(error) {
            console.error("Error updating invoice status: ", error);
            addNotification("Error al actualizar factura.");
        }
    };

    const handleUpdatePenalty = async (penaltyId: string, updates: Partial<Omit<Penalty, 'id'>>) => {
        if (!userId) return;
        try {
            const penaltyDocPath = `/artifacts/${appId}/public/data/penalties/${penaltyId}`;
            await updateDoc(doc(db, penaltyDocPath), updates);
            addNotification("Penalización actualizada con éxito.");
            addAppHistoryLog(currentUser, 'Actualización Penalización', `Se modificó una penalización.`);
        } catch (error) {
            console.error("Error updating penalty: ", error);
            addNotification("Error al actualizar la penalización.");
        }
    };

    const handleDeletePenalty = async (penaltyId: string) => {
        if (!userId) return;
        try {
            const penaltyDocPath = `/artifacts/${appId}/public/data/penalties/${penaltyId}`;
            await deleteDoc(doc(db, penaltyDocPath));
            addNotification("Penalización eliminada.");
            addAppHistoryLog(currentUser, 'Eliminación Penalización', `Se ha eliminado una penalización.`);
        } catch (error) {
            console.error("Error deleting penalty: ", error);
            addNotification("Error al eliminar la penalización.");
        }
    };
    
    const handleAddStaff = async (staffData: Omit<Staff, 'id' | 'checkIn' | 'checkOut'>) => {
        if (!userId) return;
        const newStaffData = { ...staffData, checkIn: '', checkOut: ''};
        try {
            const staffCollectionPath = `/artifacts/${appId}/public/data/staff`;
            await addDoc(collection(db, staffCollectionPath), newStaffData);
            addNotification("Nuevo miembro de personal añadido.");
        } catch (error) {
            console.error("Error adding staff: ", error);
            addNotification("Error al añadir personal.");
        }
    };
    
    const handleUpdateStaff = async (staffId: string, updates: Partial<Staff>) => {
        if (!userId) return;
        try {
            const staffDocPath = `/artifacts/${appId}/public/data/staff/${staffId}`;
            await updateDoc(doc(db, staffDocPath), updates);
            addNotification("Registro horario del personal actualizado.");
        } catch (error) {
            console.error("Error updating staff: ", error);
            addNotification("Error al actualizar personal.");
        }
    };

    const handleSaveConfig = async (newConfig: Config) => {
        if (!userId) return;
        try {
            const configDocPath = `/artifacts/${appId}/public/data/settings/config`;
            await setDoc(doc(db, configDocPath), newConfig);
        } catch(e) {
            console.error("Error saving config:", e);
            addNotification("Error al guardar la configuración.")
        }
    };
    
    const handleGenerateAndExportInvoice = async (student: Student) => {
        const month = new Date().getMonth();
        const year = new Date().getFullYear();
        let invoiceToExport = invoices.find(inv => inv.childId === student.numericId && new Date(inv.date).getMonth() === month && new Date(inv.date).getFullYear() === year);

        if (!invoiceToExport) {
            addNotification("No se encontró factura del mes actual. Generando una nueva...");
            const schedule = schedules.find(s => s.id === student.schedule);
            if (!schedule) {
                addNotification("Error: El alumno no tiene un horario asignado.");
                return;
            }
            const childPenalties = penalties.filter(p => p.childId === student.numericId && new Date(p.date).getMonth() === month && new Date(p.date).getFullYear() === year);
            const totalPenalties = childPenalties.reduce((sum, p) => sum + p.amount, 0);
            let totalAmount = schedule.price + totalPenalties;
            let enrollmentFeeApplied = !student.enrollmentPaid;
            if (enrollmentFeeApplied) {
                totalAmount += 100;
            }

            const newInvoiceData: Omit<Invoice, 'id'> = {
                numericId: Date.now() + student.numericId,
                childId: student.numericId,
                childName: `${student.name} ${student.surname}`,
                date: new Date().toISOString().split('T')[0],
                amount: totalAmount,
                base: schedule.price,
                penalties: totalPenalties,
                enrollmentFeeIncluded: enrollmentFeeApplied,
                status: 'Pendiente',
            };
            
            try {
                const invoicesCollectionPath = `/artifacts/${appId}/public/data/invoices`;
                const docRef = await addDoc(collection(db, invoicesCollectionPath), newInvoiceData);
                invoiceToExport = { ...newInvoiceData, id: docRef.id };
                addAppHistoryLog(currentUser, 'Factura Individual', `Generada factura para ${student.name}`);
            } catch (error) {
                addNotification("Error al crear la nueva factura.");
                console.error("Error creating new invoice:", error);
                return;
            }
        }
        
        handleGeneratePDFInvoice(student, invoiceToExport);
    };

    const handleGeneratePDFInvoice = (student: Student, invoice: Invoice) => {
        if (!window.jspdf) {
            addNotification("La librería PDF no se ha cargado todavía. Inténtalo de nuevo en unos segundos.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Logo
        doc.setFont('cursive', 'bold');
        doc.setFontSize(32);
        doc.setTextColor('#c55a33');
        doc.text("mi pequeño recreo", 105, 22, { align: 'center' });

        // Datos de la empresa
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text("Vision Paideia SLU", 20, 40);
        doc.text("CIF: B21898341", 20, 45);
        doc.text("C/Alonso Cano 24, 28003, Madrid", 20, 50);

        // Datos de la factura
        doc.text(`Factura Nº: ${new Date(invoice.date).getFullYear()}-${String(invoice.numericId).slice(-4)}`, 190, 40, { align: 'right' });
        doc.text(`Fecha: ${new Date(invoice.date).toLocaleDateString('es-ES')}`, 190, 45, { align: 'right' });

        // Datos del cliente
        doc.setDrawColor(220, 220, 220);
        doc.rect(15, 60, 180, 25); 
        doc.setFont('helvetica', 'bold');
        doc.text("Cliente:", 20, 66);
        doc.setFont('helvetica', 'normal');
        const clientName = student.accountHolderName || `${student.fatherName || ''} ${student.motherName || ''}`.trim();
        doc.text(`Nombre y apellidos: ${clientName}`, 20, 72);
        doc.text(`NIF: ${student.nif || 'No especificado'}`, 20, 78);
        doc.text(`Dirección: ${student.address || 'No especificada'}`, 100, 78);

        // Tabla de conceptos
        const tableColumn = ["Concepto", "Cantidad", "Precio unitario", "Importe"];
        const tableRows = [];

        if (invoice.enrollmentFeeIncluded) {
            tableRows.push(["Matrícula", "1", `100.00 ${config.currency}`, `100.00 ${config.currency}`]);
        }
        
        tableRows.push([`Jardín de infancia (${new Date(invoice.date).toLocaleString('es-ES', { month: 'long' })})`, "1", `${invoice.base.toFixed(2)} ${config.currency}`, `${invoice.base.toFixed(2)} ${config.currency}`]);

        if(invoice.penalties > 0) {
            tableRows.push([`Penalizaciones por retraso`, "", "", `${invoice.penalties.toFixed(2)} ${config.currency}`]);
        }
        
        tableRows.push(["", "", { content: "Total", styles: { halign: 'right', fontStyle: 'bold' } }, { content: `${invoice.amount.toFixed(2)} ${config.currency}`, styles: { fontStyle: 'bold' } }]);

        (doc as any).autoTable({
            startY: 90,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
            didDrawPage: (data: any) => {
                 // Footer
                doc.setFontSize(10);
                doc.text(`Forma de pago: ${student.paymentMethod}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 25);
                
                doc.setFont('cursive', 'bold');
                doc.setFontSize(18);
                doc.setTextColor('#c55a33');
                doc.text("mi pequeño recreo", 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }
        });
        
        doc.save(`factura_${student.name}_${student.surname}_${invoice.date}.pdf`);
        addNotification(`Generando factura PDF para ${student.name}.`);
    };

  // --- RENDERIZADO PRINCIPAL ---
  if (isLoading) return <LoadingSpinner />;
  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
          
          /* Add font definitions for jsPDF */
          @font-face {
            font-family: 'cursive';
            src: url('https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_szLviuEViw.woff2') format('woff2');
            font-weight: 700;
            font-style: normal;
          }
          
          /* Spinner Animation */
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={styles.notificationContainer}>{notifications.map(n => <Notification key={n.id} message={n.message} onClose={() => setNotifications(p => p.filter(item => item.id !== n.id))} />)}</div>
      
      {confirmModal.isOpen && (
          <ConfirmModal 
              message={confirmModal.message}
              onConfirm={confirmModal.onConfirm}
              onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} })}
          />
      )}

      {selectedChild && <StudentDetailModal 
          student={selectedChild} 
          onClose={() => setSelectedChild(null)} 
          schedules={schedules} 
          onViewPersonalCalendar={(student) => {
              setSelectedChild(null);
              setViewingCalendarForStudent(student);
          }}
          onUpdate={handleUpdateStudent}
          onAddDocument={handleAddDocument}
          onGenerateAndExportInvoice={handleGenerateAndExportInvoice}
          currentUser={currentUser}
      />}
      
      {viewingCalendarForStudent && <StudentPersonalCalendar
          student={viewingCalendarForStudent}
          onClose={() => setViewingCalendarForStudent(null)}
          attendance={attendance}
          penalties={penalties}
      />}

      <div style={styles.appContainer}>
        <aside style={styles.sidebar}>
          <div>
            <div style={{ padding: '20px 15px', display: 'flex', justifyContent: 'center' }}><MiPequenoRecreoLogo width={180}/></div>
            <h2 style={styles.sidebarTitle}>General</h2>
            {[
              { id: 'dashboard', name: 'Panel de Control', icon: BarChart2 },
              { id: 'inscripciones', name: 'Nueva Inscripción', icon: UserPlus },
              { id: 'alumnos', name: 'Alumnos', icon: Users },
              { id: 'asistencia', name: 'Asistencia', icon: Clock },
              { id: 'calendario', name: 'Calendario', icon: CalendarIcon },
            ].map(tab => {
              const Icon = tab.icon; const isActive = activeTab === tab.id;
              return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{...styles.sidebarButton, ...(isActive ? styles.sidebarButtonActive : {})}}><Icon size={20} style={{ marginRight: '12px' }} /><span>{tab.name}</span></button>);
            })}
            <h2 style={{...styles.sidebarTitle, marginTop: '20px'}}>Administración</h2>
            {[
              { id: 'facturacion', name: 'Facturación', icon: FileText },
              { id: 'penalizaciones', name: 'Penalizaciones', icon: DollarSign },
              { id: 'personal', name: 'Personal', icon: Briefcase },
              { id: 'historial', name: 'Historial Web', icon: History },
              { id: 'configuracion', name: 'Configuración', icon: SettingsIcon },
            ].map(tab => {
              const Icon = tab.icon; const isActive = activeTab === tab.id;
              return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{...styles.sidebarButton, ...(isActive ? styles.sidebarButtonActive : {})}}><Icon size={20} style={{ marginRight: '12px' }} /><span>{tab.name}</span></button>);
            })}
          </div>
          <div>
            <div style={styles.currentUserInfo}>
              <p style={{margin: 0}}>Usuario: <strong>{currentUser}</strong></p>
            </div>
            <footer style={styles.sidebarFooter}>
                <p style={{margin: '2px 0', fontWeight: 'bold'}}>Vision Paideia SLU</p>
                <p style={{margin: '2px 0'}}>B21898341</p>
                <p style={{margin: '2px 0'}}>C/ Alonso Cano 24, 28003, Madrid</p>
            </footer>
            <button onClick={handleLogout} style={{...styles.sidebarButton, ...styles.logoutButton}}><LogOut size={20} style={{ marginRight: '12px' }} />Cerrar Sesión</button>
          </div>
        </aside>

        <main style={styles.mainContent}>
          <header style={styles.header}>
            <h1 style={styles.headerTitle}>{activeTab === 'inscripciones' ? 'Nueva Inscripción' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          </header>
          <div style={styles.contentArea}>
            {activeTab === 'dashboard' && <Dashboard students={children} staff={staff} attendance={attendance} invoices={invoices} schedules={schedules} config={config} />}
            {activeTab === 'inscripciones' && <NewStudentForm onAddChild={handleAddChild} childForm={childForm} onFormChange={setChildForm} schedules={schedules} />}
            {activeTab === 'alumnos' && <StudentList students={children} onSelectChild={setSelectedChild} onDeleteChild={handleDeleteChild} onExport={() => handleExport('alumnos')} />}
            {activeTab === 'asistencia' && <AttendanceManager students={children} attendance={attendance} onSave={handleSaveAttendance} onExport={() => handleExport('asistencia')} />}
            {activeTab === 'calendario' && <Calendar attendance={attendance} />}
            {activeTab === 'facturacion' && <Invoicing invoices={invoices} onGenerate={generateInvoices} onUpdateStatus={handleUpdateInvoiceStatus} config={config} onExport={() => handleExport('facturacion')} />}
            {activeTab === 'penalizaciones' && <PenaltiesViewer penalties={penalties} config={config} onExport={() => handleExport('penalizaciones')} onUpdatePenalty={handleUpdatePenalty} onDeletePenalty={handleDeletePenalty} />}
            {activeTab === 'personal' && <StaffManager staff={staff} onAddStaff={handleAddStaff} onUpdateStaff={handleUpdateStaff} onExport={() => handleExport('personal')} />}
            {activeTab === 'historial' && <AppHistoryViewer history={appHistory} onExport={() => handleExport('historial')} />}
            {activeTab === 'configuracion' && <Settings config={config} onSave={handleSaveConfig} addNotification={addNotification} />}
          </div>
        </main>
      </div>
    </>
  );
};

export default App;


// --- ESTILOS PARA LA APLICACIÓN ---
const styles: { [key: string]: React.CSSProperties } = {
  loginContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'system-ui, sans-serif' },
  loginBox: { padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1)', textAlign: 'center', width: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  loginSubtitle: { margin: '10px 0 25px 0', fontSize: '16px', color: '#666' },
  loginInput: { width: '100%', boxSizing: 'border-box', padding: '12px 10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  loginButton: { width: '100%', padding: '12px', border: 'none', borderRadius: '6px', backgroundColor: '#007bff', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background-color 0.2s' },
  loginError: { color: '#dc3545', marginBottom: '15px', fontSize: '14px' },
  userSelectionContainer: { display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '20px', },
  userProfile: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', transition: 'background-color 0.2s', width: '100px', },
  userAvatar: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#e9ecef', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#495057', marginBottom: '8px', },
  userName: { fontSize: '14px', fontWeight: '500', color: '#343a40', },
  selectedUserProfile: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', },
  switchUserButton: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', marginTop: '15px', padding: '5px', },
  appContainer: { display: 'flex', height: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#ffffff', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #e9ecef' },
  sidebarTitle: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6c757d', padding: '0 15px', marginBottom: '10px', fontWeight: '600' },
  sidebarButton: { display: 'flex', alignItems: 'center', width: '100%', padding: '12px 15px', border: 'none', backgroundColor: 'transparent', textAlign: 'left', fontSize: '15px', color: '#495057', borderRadius: '8px', cursor: 'pointer', marginBottom: '5px', transition: 'background-color 0.2s, color 0.2s' },
  sidebarButtonActive: { backgroundColor: '#e9f3ff', color: '#007bff', fontWeight: '600' },
  currentUserInfo: { padding: '10px 15px', fontSize: '14px', color: '#495057', textAlign: 'center', borderTop: '1px solid #e9ecef', marginTop: '10px' },
  sidebarFooter: { padding: '15px', fontSize: '12px', color: '#6c757d', textAlign: 'center', borderTop: '1px solid #e9ecef', marginTop: '10px' },
  logoutButton: { color: '#dc3545' },
  mainContent: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 30px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', flexShrink: 0 },
  headerTitle: { margin: 0, fontSize: '28px', color: '#212529', fontWeight: '700' },
  actionButton: { padding: '10px 15px', border: 'none', borderRadius: '6px', backgroundColor: '#007bff', color: 'white', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: '500', transition: 'background-color 0.2s' },
  contentArea: { padding: '30px', overflowY: 'auto', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px' },
  card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  cardTitle: { marginTop: 0, marginBottom: '20px', fontSize: '20px', color: '#343a40', fontWeight: '600' },
  listContainer: { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' },
  listContainerSmall: { maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 5px', borderBottom: '1px solid #f1f3f5' },
  listItemName: { margin: 0, fontWeight: '500', color: '#343a40' },
  listItemInfo: { margin: '4px 0 0 0', fontSize: '14px', color: '#6c757d' },
  pillSuccess: { backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#155724', padding: '5px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' },
  pillWarning: { backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#856404', padding: '5px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' },
  pillInfo: { backgroundColor: 'rgba(0, 123, 255, 0.1)', color: '#004085', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' },
  formInput: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', marginBottom: '10px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' },
  submitButton: { width: '100%', padding: '12px', border: 'none', borderRadius: '6px', backgroundColor: '#007bff', color: 'white', fontSize: '16px', cursor: 'pointer', marginTop: '10px' },
  deleteButton: { backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalBackdrop: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '700px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', position: 'relative' },
  modalGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', rowGap: '5px' },
  modalCloseButton: { background: 'transparent', border: 'none', cursor: 'pointer' },
  modalSection: { marginBottom: '10px' },
  modalSectionTitle: { borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px', fontSize: '16px', color: '#343a40' },
  subListItem: { fontSize: '14px', color: '#495057', padding: '8px 5px', borderBottom: '1px solid #f1f3f5' },
  calendarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  calendarNavButton: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' },
  weekDay: { fontWeight: '600', textAlign: 'center', fontSize: '12px', color: '#6c757d', paddingBottom: '10px' },
  dayCell: { border: '1px solid #f1f3f5', borderRadius: '4px', minHeight: '100px', padding: '5px', transition: 'background-color 0.3s' },
  dayCellEmpty: { border: '1px solid transparent' },
  dayNumber: { fontSize: '12px', fontWeight: '500' },
  dayCount: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px', fontSize: '16px', color: '#343a40', fontWeight: '600' },
  eventsContainer: { marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '4px' },
  eventPill: { padding: '3px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#e9f3ff', color: '#004085', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  penaltyPill: { padding: '3px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#fff3cd', color: '#856404', marginTop: '4px', display: 'flex', alignItems: 'center' },
  attendancePill: { padding: '3px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#e9f3ff', color: '#004085' },
  attendanceItem: { padding: '15px 5px', borderBottom: '1px solid #f1f3f5' },
  attendanceGrid: { display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1.5fr auto', gap: '10px', alignItems: 'center', marginTop: '10px' },
  formInputSmall: { width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  saveButton: { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px' },
  chartContainer: { position: 'relative', height: '300px', width: '100%' },
  notificationContainer: { position: 'fixed', top: '20px', right: '20px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '10px' },
  notification: { backgroundColor: '#28a745', color: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'fadeIn 0.5s, fadeOut 0.5s 2.5s' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '5px', color: '#495057' },
  uploadButton: { backgroundColor: '#17a2b8', color: 'white', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: '14px' },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        color: '#495057'
    },
    spinner: {
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px'
    }
};

