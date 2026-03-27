import React, { useState, useEffect } from 'react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  getDay, isSameDay, getWeek, endOfWeek, isSameMonth, parseISO
} from 'date-fns';
import es from 'date-fns/locale/es';
import { Trash2, UserPlus, Calendar, Lock, AlertCircle } from 'lucide-react';

const App = () => {
  // --- ESTADOS CONECTADOS AL BACKEND ---
  const [staffList, setStaffList] = useState([]); // Ahora viene de SQL
  const [appointments, setAppointments] = useState([]); // Ahora viene de SQL
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [currentDate] = useState(new Date());

  // Capacidad dinámica basada en la lista real de SQL
  const dynamicMaxCapacity = staffList.length > 0 ? Math.floor(staffList.length * 0.5) : 10;

  const SETTINGS = {
    areaName: "Planificación de Operaciones",
    maxCapacity: dynamicMaxCapacity, 
    allowedDays: [1, 2, 3], // Lun, Mar, Mié (Ajustado a índices 1,2,3)
  };

  // --- EFECTO INICIAL: CARGAR DATOS DE AZURE ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Cargamos colaboradores y asignaciones existentes en paralelo
        const [resStaff, resApps] = await Promise.all([
          fetch('/api/colaboradores'),
          fetch('/api/asignaciones') // Necesitarás este endpoint en tu server.js
        ]);

        const staffData = await resStaff.json();
        const appsData = await resApps.json();

        setStaffList(staffData);
        // Convertimos las fechas de texto de SQL a objetos Date de JS
        setAppointments(appsData.map(a => ({
          ...a,
          date: parseISO(a.fecha),
          user: a.usuario
        })));
        
        setLoading(false);
      } catch (error) {
        console.error("Error conectando con el servidor:", error);
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // --- LÓGICA DE CALENDARIO ---
  const startOfCalendar = startOfMonth(currentDate);
  const endOfCalendar = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });
  
  const businessDays = allDays.filter(day => {
    const d = getDay(day);
    return d !== 0 && d !== 6;
  });

  const firstDayDayOfWeek = getDay(startOfCalendar);
  const skipCount = firstDayDayOfWeek === 0 || firstDayDayOfWeek === 6 ? 0 : firstDayDayOfWeek - 1;
  const emptyDays = Array(Math.max(0, skipCount)).fill(null);
  const masterWeekNumber = getWeek(startOfCalendar);

  // --- FUNCIÓN DE ASIGNACIÓN (POST A SQL) ---
  const handleAssign = async (day) => {
    if (!selectedStaff || getWeek(day) !== masterWeekNumber) return;

    // Validación local de seguridad
    if (appointments.find(app => app.user === selectedStaff && getWeek(app.date) === masterWeekNumber)) {
      alert(`${selectedStaff} ya está en la planificación semanal.`);
      return;
    }

    const dayOfWeek = getDay(day);
    const replicaFechas = businessDays
      .filter(d => getDay(d) === dayOfWeek)
      .map(d => format(d, 'yyyy-MM-dd'));

    try {
      const response = await fetch('/api/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: selectedStaff,
          fechas: replicaFechas
        })
      });

      if (response.ok) {
        // Si SQL aceptó, actualizamos la interfaz
        const newApps = replicaFechas.map(f => ({
          date: parseISO(f),
          user: selectedStaff
        }));
        setAppointments([...appointments, ...newApps]);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al asignar");
      }
    } catch (err) {
      alert("Error de red al conectar con Azure");
    }
  };

  // --- FUNCIÓN PARA ELIMINAR (DELETE EN SQL) ---
  const removeAssign = async (day, userName) => {
    const fechaFormateada = format(day, 'yyyy-MM-dd');
    
    try {
      const response = await fetch(`/api/asignar/${userName}/${fechaFormateada}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAppointments(appointments.filter(app => 
          !(isSameDay(app.date, day) && app.user === userName)
        ));
      }
    } catch (err) {
      alert("No se pudo eliminar de la base de datos");
    }
  };

  // --- ESTILOS (IGUALES A LOS TUYOS) ---
  const styles = {
    container: { backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' },
    card: { backgroundColor: 'white', maxWidth: '1200px', margin: '0 auto', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' },
    header: { padding: '25px 35px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', padding: '25px', alignItems: 'stretch' },
    dayLabel: { textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' },
    dayBox: (isMaster, isAllowed, isEmpty, isFull) => ({
      minHeight: '180px',
      height: '100%',
      backgroundColor: isEmpty ? 'transparent' : (isMaster && isAllowed ? (isFull ? '#fff1f2' : 'white') : '#f8fafc'),
      borderRadius: '20px',
      border: isEmpty ? 'none' : (isMaster && isAllowed ? `2px solid ${isFull ? '#fda4af' : '#4f46e5'}` : '1px solid #e2e8f0'),
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
    }),
    badge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', fontSize: '11px', fontWeight: '700', color: '#334155' },
    limitWarning: { color: '#e11d48', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Cargando planificación de Azure SQL...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Calendar color="#4f46e5" size={24} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>{SETTINGS.areaName}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Cupo máximo: {SETTINGS.maxCapacity} personas (50% del staff)</p>
            </div>
          </div>
          <select 
            value={selectedStaff} 
            onChange={(e) => setSelectedStaff(e.target.value)}
            style={{ padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '700', outline: 'none' }}
          >
            <option value="">Seleccionar Colaborador...</option>
            {staffList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div style={styles.grid}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => <div key={d} style={styles.dayLabel}>{d}</div>)}
          
          {emptyDays.map((_, i) => <div key={`empty-${i}`} style={styles.dayBox(false, false, true, false)} />)}

          {businessDays.map((day, idx) => {
            const isMasterWeek = getWeek(day) === masterWeekNumber;
            const isAllowed = SETTINGS.allowedDays.includes(getDay(day));
            const isCurrentMonth = isSameMonth(day, currentDate);
            const dayApps = appointments.filter(app => isSameDay(app.date, day));
            const isFull = dayApps.length >= SETTINGS.maxCapacity;

            return (
              <div key={idx} style={styles.dayBox(isMasterWeek, isAllowed, false, isFull)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <span style={{ fontWeight: '900', fontSize: '18px', color: isMasterWeek ? '#1e293b' : '#94a3b8' }}>
                      {format(day, 'd')}
                    </span>
                    {!isCurrentMonth && <span style={{fontSize: '10px', marginLeft: '5px', color: '#94a3b8'}}>{format(day, 'MMM')}</span>}
                  </div>
                  
                  {isMasterWeek && isAllowed ? (
                    <button 
                      onClick={() => handleAssign(day)}
                      disabled={isFull}
                      style={{ 
                        border: 'none', 
                        background: isFull ? '#cbd5e1' : '#4f46e5', 
                        color: 'white', 
                        padding: '6px', 
                        borderRadius: '10px', 
                        cursor: isFull ? 'not-allowed' : 'pointer' 
                      }}
                    >
                      <UserPlus size={16} />
                    </button>
                  ) : !isMasterWeek && <Lock size={12} color="#cbd5e1" />}
                </div>

                <div style={{ flex: 1, marginTop: '12px' }}>
                  {dayApps.map((app, i) => (
                    <div key={i} style={styles.badge}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.user}</span>
                      {isMasterWeek && (
                        <Trash2 
                          size={12} 
                          onClick={() => removeAssign(day, app.user)} 
                          style={{ cursor: 'pointer', color: '#94a3b8' }} 
                        />
                      )}
                    </div>
                  ))}
                  {isMasterWeek && isFull && (
                    <div style={styles.limitWarning}>
                      <AlertCircle size={10} /> LÍMITE 50% ALCANZADO
                    </div>
                  )}
                </div>

                {isAllowed && (
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '900', color: isFull ? '#e11d48' : '#94a3b8' }}>
                      <span>CUPOS</span>
                      <span>{dayApps.length}/{SETTINGS.maxCapacity}</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '4px' }}>
                       <div style={{ width: `${(dayApps.length/SETTINGS.maxCapacity)*100}%`, height: '100%', background: isFull ? '#e11d48' : '#4f46e5', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;