const express = require('express');
const sql = require('mssql');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE SQL SERVER ---
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true, 
        trustServerCertificate: false,
        connectTimeout: 30000 
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Función para conectar a la DB
async function getConnection() {
    try {
        return await sql.connect(dbConfig);
    } catch (err) {
        console.error("Error de conexión a SQL Server:", err.message);
        throw err;
    }
}

// --- ENDPOINTS DE LA API ---
// Obtener áreas únicas
app.get('/api/areas', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query("SELECT DISTINCT area FROM HomeOffice.colaboradores WHERE activo = 1");
    console.log('Areas query result:', result.recordset);
    const areas = Array.isArray(result.recordset) ? result.recordset.map(r => r.area).filter(Boolean) : [];
    res.json(areas);
  } catch (err) {
    console.error('Error en /api/areas:', err);
    res.status(500).json({ error: err.message });
  }
});
// 1. Obtener lista de colaboradores
app.get('/api/colaboradores', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT nombre, area, activo FROM colaboradores WHERE activo = 1');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Obtener todas las asignaciones 
app.get('/api/asignaciones', async (req, res) => {
    try {
        const pool = await getConnection();
        // Convertimos la fecha a VARCHAR(10) directamente en SQL para que React reciba "YYYY-MM-DD"
        const result = await pool.request().query(`
            SELECT 
                usuario, 
                CONVERT(VARCHAR(10), fecha, 120) as fecha 
            FROM HomeOffice.asignaciones
        `);    
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar el calendario", details: err.message });
    }
});

// 3. Guardar nuevas asignaciones (VERSIÓN ORIGINAL QUE TE FUNCIONÓ)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;

    if (!usuario || !fechas || fechas.length === 0) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    try {
        const pool = await getConnection();

        // 1. LIMPIAR FECHAS
        const fechasLimpias = fechas.map(f => {
            return f.split('T')[0].replace(/-/g, ''); // ✅ FIX
        });

        // 2. VALIDACIÓN DE MES (usar UNA fecha, no array)
        const fRef = fechasLimpias[0]; // ✅ FIX

        const checkUserMonth = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.VarChar, fRef)
            .query(`
                SELECT TOP 1 fecha 
                FROM HomeOffice.asignaciones 
                WHERE usuario = @u 
                AND MONTH(fecha) = MONTH(CAST(@f AS DATE)) 
                AND YEAR(fecha) = YEAR(CAST(@f AS DATE))
            `);

        if (checkUserMonth.recordset.length > 0) {
            return res.status(400).json({ error: `${usuario} ya tiene una asignación este mes.` });
        }

        // 3. LÍMITE
        const totalRes = await pool.request()
            .query("SELECT COUNT(*) as total FROM HomeOffice.colaboradores WHERE activo = 1");

        const total = totalRes.recordset[0].total; // ✅ FIX
        const limite = Math.floor(total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let f of fechasLimpias) {

                const checkRes = await transaction.request()
                    .input('f', sql.VarChar, f)
                    .query(`
                        SELECT COUNT(*) as ocupados 
                        FROM HomeOffice.asignaciones 
                        WHERE fecha = CAST(@f AS DATE)
                    `);

                const ocupados = checkRes.recordset[0].ocupados; // ✅ FIX

                if (ocupados >= limite) {
                    throw new Error(`Cupo lleno para el día ${f}.`);
                }

                await transaction.request()
                    .input('u', sql.NVarChar, usuario)
                    .input('f', sql.VarChar, f)
                    .query(`
                        IF NOT EXISTS (
                            SELECT 1 
                            FROM HomeOffice.asignaciones 
                            WHERE usuario = @u 
                            AND fecha = CAST(@f AS DATE)
                        )
                        BEGIN
                            INSERT INTO HomeOffice.asignaciones (usuario, fecha) 
                            VALUES (@u, CAST(@f AS DATE))
                        END
                    `);
            }

            await transaction.commit();
            res.json({ success: true });

        } catch (error) {
            await transaction.rollback();
            res.status(400).json({ error: error.message });
        }

    } catch (err) {
        res.status(500).json({ error: "Error en el servidor: " + err.message });
    }
});

// 4. Eliminar asignaciones (Borrado en cascada para todo el mes)
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    
    try {
        const pool = await getConnection();
        
        // Usamos una consulta que identifica el día de la semana (WEEKDAY) 
        // y borra todas las fechas que coincidan con ese día en el mismo mes y año
        const query = `
            DELETE FROM HomeOffice.asignaciones 
            WHERE usuario = @u 
            AND DATEPART(dw, fecha) = DATEPART(dw, CAST(@f AS DATE))
            AND MONTH(fecha) = MONTH(CAST(@f AS DATE))
            AND YEAR(fecha) = YEAR(CAST(@f AS DATE))
        `;

        const result = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.Date, fecha)
            .query(query);

        if (result.rowsAffected > 0) {
            res.json({ success: true, message: `Se eliminaron ${result.rowsAffected} registros.` });
        } else {
            res.status(404).json({ success: false, message: "No se encontraron registros para eliminar" });
        }

    } catch (err) {
        console.error("Error en DELETE masivo:", err.message);
        res.status(500).json({ error: "Error al eliminar el ciclo mensual", details: err.message });
    }
});


// --- SERVIR FRONTEND (REACT) EN AZURE ---
const buildPath = path.resolve(__dirname, 'client', 'dist');
// 1. Servir archivos estáticos
app.use(express.static(buildPath));

// 2. Ruta de salud (siempre útil para monitoreo)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 3. MUESTRA
// Usar una expresión regular pura (sin comillas) 
// Esto evita que Express 5 busque un ":name" que no existe.
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});