import React, { useState, useEffect } from 'react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  getDay, isSameDay, getWeek, endOfWeek, isSameMonth
} from 'date-fns';
import es from 'date-fns/locale/es';
import { Trash2, UserPlus, Calendar, Lock, AlertCircle } from 'lucide-react';

const App = () => {
  const [staffList, setStaffList] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [currentDate] = useState(new Date());

  const dynamicMaxCapacity = staffList.length > 0 ? Math.floor(staffList.length * 0.5) : 10;

  const SETTINGS = {
    areaName: "Planificación de Operaciones",
    maxCapacity: dynamicMaxCapacity, 
    allowedDays:[2, 3, 4], // Martes, Miércoles, Jueves
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [resStaff, resApps] = await Promise.all([
          fetch('/api/colaboradores'),
          fetch('/api/asignaciones')
        ]);

        const staffData = await resStaff.json();
        const appsData = await resApps.json();

        setStaffList(staffData);
        
        // CORRECCIÓN DEFINITIVA DEL MAPEO
        const correctedApps = appsData.map(a => {
          let fechaLimpia = "";

          if (typeof a.fecha === 'string') {
            // Tomamos la parte antes de la 'T' o el string completo si ya viene limpio
            fechaLimpia = a.fecha.includes('T') ? a.fecha.split('T') : a.fecha;
          } 
          else if (a.fecha instanceof Date) {
            fechaLimpia = a.fecha.toISOString().split('T');
          }

          if (!fechaLimpia) return null;

          // Ahora el split('-') es seguro porque fechaLimpia es un string
          const partes = fechaLimpia.split('-');
          if (partes.length !== 3) return null;

          const [year, month, day] = partes.map(Number);
          
          return {
            ...a,
            date: new Date(year, month - 1, day), 
            user: a.usuario 
          };
        }).filter(Boolean);

        setAppointments(correctedApps);
        setLoading(false);
      } catch (error) {
        console.error("Error cargando datos:", error);
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

  const handleAssign = async (day) => {
    if (!selectedStaff) {
        alert("Selecciona un colaborador primero");
        return;
    }

    const dayOfWeek = getDay(day);
    const replicaFechas = businessDays
      .filter(d => getDay(d) === dayOfWeek && isSameMonth(d, currentDate))
      .map(d => format(d, 'yyyy-MM-dd'));

    try {
      const response = await fetch('/api/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: selectedStaff, fechas: replicaFechas })
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Error al asignar");
      }
    } catch (err) {
      alert("Error de red");
    }
  };

 // --- ELIMINAR (Masivo por día de la semana) ---
  const removeAssign = async (day, userName) => {
    const fechaFormateada = format(day, 'yyyy-MM-dd');
    const diaDeLaSemana = getDay(day); // Obtenemos qué día es (ej: 2 para Martes)
    
    if (!window.confirm(`¿Deseas eliminar a ${userName} de todos los ${format(day, 'eeee', { locale: es })} del mes?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/asignar/${encodeURIComponent(userName)}/${fechaFormateada}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Actualizamos el estado local: Filtramos para quitar al usuario 
        // de todos los días que coincidan con el mismo día de la semana
        setAppointments(prev => prev.filter(app => {
          const coincideUsuario = app.user === userName;
          const coincideDiaSemana = getDay(app.date) === diaDeLaSemana;
          const coincideMes = isSameMonth(app.date, day);
          
          // Retenemos solo lo que NO coincide con el patrón borrado
          return !(coincideUsuario && coincideDiaSemana && coincideMes);
        }));
      } else {
        alert("Error al procesar la eliminación masiva.");
      }
    } catch (err) {
      alert("Error de conexión al eliminar.");
    }
  };

  // --- ESTILOS (Resumidos para claridad) ---
  const styles = {
    container: { backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' },
    card: { backgroundColor: 'white', maxWidth: '1200px', margin: '0 auto', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' },
    header: { padding: '25px 35px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', padding: '25px' },
    dayLabel: { textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' },
    dayBox: (isAllowed, isEmpty, isFull) => ({
      minHeight: '160px',
      backgroundColor: isEmpty ? 'transparent' : (isAllowed ? (isFull ? '#fff1f2' : 'white') : '#f8fafc'),
      borderRadius: '20px',
      border: isEmpty ? 'none' : (isAllowed ? `2px solid ${isFull ? '#fda4af' : '#4f46e5'}` : '1px solid #e2e8f0'),
      padding: '16px',
      display: 'flex', flexDirection: 'column',
    }),
    badge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', fontSize: '11px', fontWeight: '700' },
    limitWarning: { color: '#e11d48', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }
  };

  if (loading) return <div style={{padding: '100px', textAlign: 'center'}}>Cargando...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Calendar color="#4f46e5" size={24} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>{SETTINGS.areaName}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Cupo: {SETTINGS.maxCapacity}</p>
            </div>
          </div>
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} style={{ padding: '10px', borderRadius: '12px' }}>
            <option value="">Seleccionar Colaborador...</option>
            {staffList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div style={styles.grid}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => <div key={d} style={styles.dayLabel}>{d}</div>)}
          {emptyDays.map((_, i) => <div key={`empty-${i}`} style={styles.dayBox(false, true, false)} />)}
          {businessDays.map((day, idx) => {
            const isAllowed = SETTINGS.allowedDays.includes(getDay(day));
            const dayApps = appointments.filter(app => isSameDay(app.date, day));
            const isFull = dayApps.length >= SETTINGS.maxCapacity;

            return (
              <div key={idx} style={styles.dayBox(isAllowed, false, isFull)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '900', fontSize: '18px' }}>{format(day, 'd')}</span>
                  {isAllowed && (
                    <button onClick={() => handleAssign(day)} disabled={isFull} style={{ background: isFull ? '#cbd5e1' : '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, marginTop: '10px' }}>
                  {dayApps.map((app, i) => (
                    <div key={i} style={styles.badge}>
                      <span>{app.user}</span>
                      <Trash2 size={14} onClick={() => removeAssign(day, app.user)} style={{ cursor: 'pointer', color: '#94a3b8' }} />
                    </div>
                  ))}
                  {isFull && isAllowed && <div style={styles.limitWarning}><AlertCircle size={10} /> LLENO</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;