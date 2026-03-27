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
        encrypt: true, // Obligatorio para Azure SQL
        trustServerCertificate: false,
        connectTimeout: 30000 // 30 segundos de timeout para evitar caídas en frío
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

// 2. Obtener todas las asignaciones (Carga inicial del calendario)
app.get('/api/asignaciones', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT usuario, fecha FROM HomeOffice.asignaciones");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar el calendario", details: err.message });
    }
});

// 3. Guardar nuevas asignaciones (Con regla del 50%)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    if (!usuario || !fechas || fechas.length === 0) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    try {
        const pool = await getConnection();
        
        // Calcular el límite del 50% dinámicamente
        const totalRes = await pool.request().query("SELECT COUNT(*) as total FROM HomeOffice.colaboradores WHERE activo = 1");
        const limite = Math.floor(totalRes.recordset[0].total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (let fecha of fechas) {
                // Validar cupo por cada día solicitado
                const checkRes = await transaction.request()
                    .input('f', sql.Date, fecha)
                    .query("SELECT COUNT(*) as ocupados FROM HomeOffice.asignaciones WHERE fecha = @f");

                if (checkRes.recordset[0].ocupados >= limite) {
                    throw new Error(`El día ${fecha} ya alcanzó el límite del 50% (${limite} personas).`);
                }

                // Insertar si no está ya asignado
                await transaction.request()
                    .input('u', sql.NVarChar, usuario)
                    .input('f', sql.Date, fecha)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f)
                        INSERT INTO asignaciones (usuario, fecha) VALUES (@u, @f)
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

// 4. Eliminar asignación
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.Date, fecha)
            .query("DELETE FROM HomeOffice.asignaciones WHERE usuario = @u AND fecha = @f");
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "No se pudo eliminar el registro" });
    }
});

// --- SERVIR FRONTEND (REACT) ---

const path = require('path');

// 1. Localizar la carpeta dist de forma absoluta
const buildPath = path.join(__dirname, 'client', 'dist');

// Log de diagnóstico (esto aparecerá en tus logs de Azure)
console.log("Ruta de archivos estáticos configurada en:", buildPath);

// 2. Servir archivos estáticos ANTES de cualquier ruta
app.use(express.static(buildPath));

// 3. Ruta para la API (asegúrate de que estén arriba del comodín)
app.get('/api/test', (req, res) => {
    res.json({ message: "El backend está vivo" });
});

// 4. El comodín para React (Sintaxis Express 5 segura)
app.get('/:any*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    
    // Verificamos si el archivo existe antes de enviarlo
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error("ERROR: No se encuentra index.html en:", indexPath);
            res.status(404).send("Error crítico: El servidor no encuentra el frontend en la carpeta dist.");
        }
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});