import React, { useState, useEffect } from 'react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  getDay, isSameDay, endOfWeek, isSameMonth, addMonths, getDate 
} from 'date-fns';
import es from 'date-fns/locale/es';
import { Trash2, UserPlus, Calendar, AlertCircle } from 'lucide-react';

const App = () => {
  const [staffList, setStaffList] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState("");

  // --- FECHA ACTUAL CON LÓGICA DE AVANCE AUTOMÁTICO ---
  const today = new Date();
  const lastDayOfMonth = endOfMonth(today).getDate();
  let initialDate = today;

  if (lastDayOfMonth - getDate(today) < 5) {
    initialDate = addMonths(today, 1); // Mostrar siguiente mes si estamos a 5 días o menos
  }

  const [currentDate] = useState(initialDate);

  const dynamicMaxCapacity = staffList.length > 0 ? Math.floor(staffList.length * 0.5) : 10;

  const SETTINGS = {
    areaName: "Planificación HomeOffice",
    maxCapacity: dynamicMaxCapacity, 
    allowedDays:[2, 3, 4], // Mar, Mié, Jue
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [resStaff, resApps, resAreas] = await Promise.all([
          fetch('/api/colaboradores'),
          fetch('/api/asignaciones'),
          fetch('/api/areas')
        ]);

        const staffData = await resStaff.json();
        const appsData = await resApps.json();
        const areasData = await resAreas.json();

        setStaffList(staffData);
        setAreas(areasData);

        const correctedApps = appsData.map(a => {
          let fechaLimpia = typeof a.fecha === 'string' 
            ? (a.fecha.includes('T') ? a.fecha.split('T')[0] : a.fecha) 
            : a.fecha.toISOString().split('T')[0];
          const [year, month, day] = fechaLimpia.split('-').map(Number);
          return { ...a, date: new Date(year, month-1, day), user: a.usuario };
        }).filter(Boolean);

        setAppointments(correctedApps);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const startOfCalendar = startOfMonth(currentDate);
  const endOfCalendar = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });
  const businessDays = allDays.filter(day => getDay(day) !== 0 && getDay(day) !== 6);

  const firstDayDayOfWeek = getDay(startOfCalendar);
  const skipCount = firstDayDayOfWeek === 0 || firstDayDayOfWeek === 6 ? 0 : firstDayDayOfWeek - 1;
  const emptyDays = Array(Math.max(0, skipCount)).fill(null);

  const handleAssign = async (day) => {
    if (!selectedStaff) { alert("Selecciona un colaborador primero"); return; }
    const dayOfWeek = getDay(day);
    const replicaFechas = businessDays
      .filter(d => getDay(d) === dayOfWeek && isSameMonth(d, currentDate))
      .map(d => format(d,'yyyy-MM-dd'));

    try {
      const response = await fetch('/api/asignar',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({usuario: selectedStaff, fechas: replicaFechas})
      });
      if(response.ok) window.location.reload();
      else {
        const err = await response.json();
        alert(err.error || "Error al asignar");
      }
    } catch { alert("Error de red"); }
  };

  const removeAssign = async (day,userName) => {
    const fechaFormateada = format(day,'yyyy-MM-dd');
    const diaDeLaSemana = getDay(day);
    if(!window.confirm(`Eliminar ${userName} de todos los ${format(day,'eeee',{locale: es})}?`)) return;
    try {
      const response = await fetch(`/api/asignar/${encodeURIComponent(userName)}/${fechaFormateada}`,{method:'DELETE'});
      if(response.ok){
        setAppointments(prev => prev.filter(app => !(app.user===userName && getDay(app.date)===diaDeLaSemana && isSameMonth(app.date,day))));
      } else alert("Error al eliminar");
    } catch { alert("Error de conexión"); }
  };

  const styles = {
    container:{backgroundColor:'#f1f5f9',minHeight:'100vh',padding:'20px',fontFamily:'sans-serif'},
    card:{backgroundColor:'white',maxWidth:'1200px',margin:'0 auto',borderRadius:'24px',boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)',border:'1px solid #e2e8f0',overflow:'hidden'},
    header:{padding:'25px 35px',borderBottom:'2px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'},
    grid:{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'15px',padding:'25px'},
    dayLabel:{textAlign:'center',fontSize:'11px',fontWeight:'900',color:'#94a3b8',textTransform:'uppercase',marginBottom:'10px'},
    dayBox:(isAllowed,isEmpty,isFull)=>(({
      minHeight:'160px',
      backgroundColor:isEmpty?'transparent':(isAllowed?(isFull?'#fff1f2':'white'):'#f8fafc'),
      borderRadius:'20px',
      border:isEmpty?'none':(isAllowed?`2px solid ${isFull?'#fda4af':'#4f46e5'}`:'1px solid #e2e8f0'),
      padding:'16px', display:'flex', flexDirection:'column'
    })),
    badge:{display:'flex',justifyContent:'space-between',alignItems:'center',backgroundColor:'white',border:'1px solid #e2e8f0',padding:'6px 10px',borderRadius:'8px',marginBottom:'6px',fontSize:'11px',fontWeight:'700'},
    limitWarning:{color:'#e11d48',fontSize:'9px',fontWeight:'800',display:'flex',alignItems:'center',gap:'4px',marginTop:'4px'}
  };

  if(loading) return <div style={{padding:'100px',textAlign:'center'}}>Cargando...</div>;

  return(
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{display:'flex',alignItems:'center',gap:'15px'}}>
            <Calendar color="#4f46e5" size={24}/>
            <div>
              <h1 style={{margin:0,fontSize:'20px',fontWeight:'900'}}>{SETTINGS.areaName}</h1>
              <p style={{margin:0,fontSize:'12px',color:'#64748b'}}>Cupo: {SETTINGS.maxCapacity}</p>
            </div>
          </div>
          
          <div style={{display:'flex',gap:'10px'}}>
            <select value={selectedArea} onChange={e=>{setSelectedArea(e.target.value); setSelectedStaff("");}} style={{padding:'10px',borderRadius:'12px'}}>
              <option value="">Seleccionar Área...</option>
              {areas.map(a=><option key={a} value={a}>{a}</option>)}
            </select>

            <select value={selectedStaff} onChange={e=>setSelectedStaff(e.target.value)} style={{padding:'10px',borderRadius:'12px'}}>
              <option value="">Seleccionar Colaborador...</option>
              {staffList.filter(s=>!selectedArea||s.area===selectedArea).map(n=><option key={n.usuario} value={n.usuario}>{n.usuario}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.grid}>
          {['Lun','Mar','Mié','Jue','Vie'].map(d=><div key={d} style={styles.dayLabel}>{d}</div>)}
          {emptyDays.map((_,i)=><div key={`empty-${i}`} style={styles.dayBox(false,true,false)}/>)}

          {businessDays.map((day,idx)=>{
            const esPrimeraSemana = day.getDate() <= 7;
            const esDiaPermitido = SETTINGS.allowedDays.includes(getDay(day));
            const puedeEditar = esPrimeraSemana && esDiaPermitido;

            const dayApps = appointments.filter(app=>isSameDay(app.date,day));
            const isFull = dayApps.length>=SETTINGS.maxCapacity;

            return(
              <div key={idx} style={styles.dayBox(esDiaPermitido,false,isFull)}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontWeight:'900',fontSize:'18px'}}>{format(day,'d')}</span>
                  {puedeEditar && (
                    <button onClick={()=>handleAssign(day)} disabled={isFull} style={{background:isFull?'#cbd5e1':'#4f46e5',color:'white',border:'none',borderRadius:'8px',cursor:'pointer'}}>
                      <UserPlus size={16}/>
                    </button>
                  )}
                </div>

                <div style={{flex:1,marginTop:'10px'}}>
                  {dayApps.map((app,i)=>(
                    <div key={i} style={styles.badge}>
                      <span>{app.user}</span>
                      {puedeEditar && <Trash2 size={14} onClick={()=>removeAssign(day,app.user)} style={{cursor:'pointer',color:'#94a3b8'}} />}
                    </div>
                  ))}

                  {isFull && esDiaPermitido && <div style={styles.limitWarning}><AlertCircle size={10}/> LLENO</div>}
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