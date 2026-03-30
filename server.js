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
        encrypt: true, 
        trustServerCertificate: false,
        connectTimeout: 30000 
    }
};

async function getConnection() {
    try {
        return await sql.connect(dbConfig);
    } catch (err) {
        console.error("ERROR CRÍTICO DE CONEXIÓN:", err.message);
        throw err;
    }
}

// --- API ENDPOINTS ---

// 1. Colaboradores
app.get('/api/colaboradores', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT nombre FROM HomeOffice.colaboradores WHERE activo = 1 ORDER BY nombre");
        res.json(result.recordset.map(r => r.nombre));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Obtener Asignaciones (CON PARCHE DE FORMATO)
app.get('/api/asignaciones', async (req, res) => {
    try {
        const pool = await getConnection();
        // Forzamos formato YYYY-MM-DD desde el motor SQL para evitar líos de zona horaria
        const result = await pool.request().query(`
            SELECT 
                usuario, 
                CONVERT(VARCHAR, fecha, 23) as fecha 
            FROM HomeOffice.asignaciones
        `);
        
        console.log(`[DEBUG] Enviando ${result.recordset.length} registros al frontend`);
        res.json(result.recordset);
    } catch (err) {
        console.error("ERROR GET ASIGNACIONES:", err.message);
        res.status(500).json({ error: "Error al cargar el calendario" });
    }
});

// 3. Guardar Asignaciones
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    if (!usuario || !fechas) return res.status(400).json({ error: "Faltan datos" });

    try {
        const pool = await getConnection();
        const totalRes = await pool.request().query("SELECT COUNT(*) as total FROM HomeOffice.colaboradores WHERE activo = 1");
        const limite = Math.floor(totalRes.recordset.total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let fecha of fechas) {
                const checkRes = await transaction.request()
                    .input('f', sql.VarChar, fecha)
                    .query("SELECT COUNT(*) as ocupados FROM HomeOffice.asignaciones WHERE fecha = @f");

                if (checkRes.recordset.ocupados >= limite) {
                    throw new Error(`Cupo lleno para el día ${fecha}`);
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
        res.status(500).json({ error: "Error de DB" });
    }
});

// 4. Eliminar Asignación
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.VarChar, fecha)
            .query("DELETE FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f");
        
        if (result.rowsAffected > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "No se encontró registro para eliminar" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
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