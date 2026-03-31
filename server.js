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