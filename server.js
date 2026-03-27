const express = require('express');
const sql = require('mssql');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuración de SQL Server (usa variables de entorno en Azure)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Necesario para Azure SQL
        trustServerCertificate: false
    }
};

// 1. OBTENER COLABORADORES
app.get('/api/colaboradores', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT nombre FROM colaboradores WHERE activo = 1 ORDER BY nombre");
        res.json(result.recordset.map(r => r.nombre));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. OBTENER ASIGNACIONES EXISTENTES (Para que React las pinte al cargar)
app.get('/api/asignaciones', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT usuario, fecha FROM asignaciones");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GUARDAR ASIGNACIONES (Con validación del 50%)
app.post('/api/asignar', async (req, res) => {
    const { usuario, fechas } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        
        // Calcular límite dinámico
        const totalStaff = await pool.request().query("SELECT COUNT(*) as total FROM colaboradores WHERE activo = 1");
        const limite = Math.floor(totalStaff.recordset[0].total * 0.5);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        for (let fecha of fechas) {
            // Validar cupo por día en la DB
            const checkCupo = await transaction.request()
                .input('f', sql.Date, fecha)
                .query("SELECT COUNT(*) as ocupados FROM asignaciones WHERE fecha = @f");
            
            if (checkCupo.recordset[0].ocupados >= limite) {
                await transaction.rollback();
                return res.status(400).json({ error: `Límite del 50% alcanzado para el día ${fecha}` });
            }

            // Insertar si no existe el par usuario-fecha
            await transaction.request()
                .input('u', sql.NVarChar, usuario)
                .input('f', sql.Date, fecha)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM asignaciones WHERE usuario = @u AND fecha = @f)
                    INSERT INTO asignaciones (usuario, fecha) VALUES (@u, @f)
                `);
        }

        await transaction.commit();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. ELIMINAR ASIGNACIÓN
app.delete('/api/asignar/:usuario/:fecha', async (req, res) => {
    const { usuario, fecha } = req.params;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('u', sql.NVarChar, usuario)
            .input('f', sql.Date, fecha)
            .query("DELETE FROM asignaciones WHERE usuario = @u AND fecha = @f");
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SERVIR FRONTEND ---
// Esta parte sirve los archivos de la carpeta 'client/build' que genera React
app.use(express.static(path.join(__dirname, 'client/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));