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
        const result = await pool.request().query("SELECT usuario, fecha FROM HomeOffice.asignaciones");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar el calendario", details: err.message });
    }
});

// 3. Guardar nuevas asignaciones (Corregido recordset)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    if (!usuario || !fechas || fechas.length === 0) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    try {
        const pool = await getConnection();
        
        // CORRECCIÓN: Acceso a recordset para el conteo total
        const totalRes = await pool.request().query("SELECT COUNT(*) as total FROM HomeOffice.colaboradores WHERE activo = 1");
        const limite = Math.floor(totalRes.recordset.total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let fecha of fechas) {
                // Validación de cupo por cada día
                const checkRes = await transaction.request()
                    .input('f', sql.VarChar, fecha) 
                    .query("SELECT COUNT(*) as ocupados FROM HomeOffice.asignaciones WHERE fecha = @f");

                // CORRECCIÓN: Acceso a recordset para los ocupados
                if (checkRes.recordset.ocupados >= limite) {
                    throw new Error(`El día ${fecha} ya alcanzó el límite del 50% (${limite} personas).`);
                }

                // Insertar si no existe
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

// 4. Eliminar asignación (Corregido rowsAffected)
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.VarChar, fecha)
            .query("DELETE FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f");
        
        if (result.rowsAffected > 0) {
            res.json({ success: true, message: "Eliminado correctamente" });
        } else {
            res.status(404).json({ success: false, message: "No se encontró el registro" });
        }
    } catch (err) {
        res.status(500).json({ error: "No se pudo eliminar el registro", details: err.message });
    }
});

// --- SERVIR FRONTEND (REACT) EN AZURE ---
const buildPath = path.resolve(__dirname, 'client', 'dist');

// 1. Servir archivos estáticos primero
app.use(express.static(buildPath));

// 2. Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor funcionando' });
});

// 3. CORRECCIÓN PARA EXPRESS 5: Manejo de rutas SPA (React Router)
// Esto evita el error "Missing parameter name" al usar comodines
app.get('*', (req, res, next) => {
    // Si la ruta empieza por /api, la dejamos pasar para que falle con 404 normal si no existe
    if (req.path.startsWith('/api')) {
        return next();
    }
    // Para todo lo demás, enviamos el index.html de React
    res.sendFile(path.resolve(buildPath, 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});