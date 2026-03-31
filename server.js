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

// 1. Obtener lista de colaboradores
app.get('/api/colaboradores', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT nombre FROM HomeOffice.colaboradores WHERE activo = 1 ORDER BY nombre");
        res.json(result.recordset.map(r => r.nombre));
    } catch (err) {
        res.status(500).json({ error: "No se pudo obtener la lista de staff", details: err.message });
    }
});

// 2. Obtener todas las asignaciones (CORREGIDO PARA EVITAR ERROR .SPLIT)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    if (!usuario || !fechas || fechas.length === 0) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    let pool;
    try {
        pool = await getConnection();
        
        // 1. Validar si ya existe en OTRO día de la semana este mes
        const fechaRef = fechas;
        const checkUser = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.Date, fechaRef)
            .query(`
                SELECT TOP 1 fecha 
                FROM HomeOffice.asignaciones 
                WHERE usuario = @u 
                AND MONTH(fecha) = MONTH(@f) 
                AND YEAR(fecha) = YEAR(@f)
                AND DATEPART(dw, fecha) != DATEPART(dw, @f)
            `);

        if (checkUser.recordset.length > 0) {
            return res.status(400).json({ 
                error: `El colaborador ya está asignado a otro día de la semana este mes.` 
            });
        }

        // 2. Ejecutar inserción en transacción
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let f of fechas) {
                await transaction.request()
                    .input('u', sql.NVarChar, usuario)
                    .input('f', sql.Date, f)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f)
                        BEGIN
                            INSERT INTO HomeOffice.asignaciones (usuario, fecha) VALUES (@u, @f)
                        END
                    `);
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (transError) {
            await transaction.rollback();
            throw transError; // Lanza al catch principal
        }

    } catch (err) {
        console.error("DETALLE DEL ERROR 500:", err.message);
        res.status(500).json({ 
            error: "Error interno en el servidor", 
            message: err.message // Esto te dirá exactamente qué falló en el navegador
        });
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