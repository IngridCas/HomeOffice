const express = require('express');
const sql = require('mssql');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE SQL SERVER ---
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Obligatorio para Azure SQL
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

// 2. Obtener todas las asignaciones
app.get('/api/asignaciones', async (req, res) => {
    try {
        const pool = await getConnection();
        // Traemos los datos para cargar el calendario
        const result = await pool.request().query("SELECT usuario, fecha FROM HomeOffice.asignaciones");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar el calendario", details: err.message });
    }
});

// 3. Guardar nuevas asignaciones (Con regla del 50% y Parche de Fecha)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    if (!usuario || !fechas || fechas.length === 0) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    try {
        const pool = await getConnection();
        
        // Calcular el límite del 50% dinámicamente
        const totalRes = await pool.request().query("SELECT COUNT(*) as total FROM HomeOffice.colaboradores WHERE activo = 1");
        const limite = Math.floor(totalRes.recordset.total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let fecha of fechas) {
                // Importante: usamos sql.VarChar para que el string '2026-03-03' llegue exacto a la DB
                const checkRes = await transaction.request()
                    .input('f', sql.VarChar, fecha) 
                    .query("SELECT COUNT(*) as ocupados FROM HomeOffice.asignaciones WHERE fecha = @f");

                if (checkRes.recordset.ocupados >= limite) {
                    throw new Error(`El día ${fecha} ya alcanzó el límite del 50% (${limite} personas).`);
                }

                await transaction.request()
                    .input('u', sql.NVarChar, usuario)
                    .input('f', sql.VarChar, fecha)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f)
                        INSERT INTO HomeOffice.asignaciones (usuario, fecha) VALUES (@u, @f)
                    `);
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (error) {
            await transaction.rollback();
            res.status(400).json({ error: error.message });
        }
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor de base de datos" });
    }
});

// 4. Eliminar asignación (Día por día)
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.VarChar, fecha) // Usamos VarChar para que coincida con el formato del POST
            .query("DELETE FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f");
        
        // rowsAffected es un array, revisamos la primera posición
        if (result.rowsAffected > 0) {
            res.json({ success: true, message: "Registro eliminado correctamente" });
        } else {
            res.status(404).json({ success: false, message: "No se encontró nada para borrar" });
        }
    } catch (err) {
        console.error("Error en DELETE:", err.message);
        res.status(500).json({ error: "Error al eliminar el registro" });
    }
});

// --- SERVIR FRONTEND (REACT) EN AZURE ---
const buildPath = path.resolve(__dirname, 'client', 'dist');

// Servir archivos estáticos (CSS, JS) primero
app.use(express.static(buildPath));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', node_version: process.version });
});

// Ruta comodín segura para Express 5 y Azure
// Captura cualquier navegación del navegador y le entrega el index.html de React
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.resolve(buildPath, 'index.html'));
});

// --- INICIO ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo y escuchando en puerto ${PORT}`);
});