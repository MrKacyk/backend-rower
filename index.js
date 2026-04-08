const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Zwiększamy limity dla ciężkich tras LIVE
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const db = new Pool({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.isebxmteelfqrbfyghky',
    password: 'Kacyk270194#94', 
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});

// LOGI DEBUGOWANIA - zobaczysz w Render.com co dokładnie puka do serwera
app.use((req, res, next) => {
    if (req.method === 'POST') console.log(`[POST] Cel: ${req.url}, Wielkość danych: ${JSON.stringify(req.body).length} bajtów`);
    next();
});

app.get('/', (req, res) => res.send('API Projekt Rower – System Stabilny'));

// --- LOGOWANIE (Zwraca ID potrzebne do synchronizacji) ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT id, email, password_hash, display_name as nickname, avatar FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0 || result.rows[0].password_hash !== password) {
            return res.status(401).json({ wiadomosc: 'Błędne dane.' });
        }
        res.json({ status: 'sukces', ...result.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROWER (Zapis i synchronizacja) ---
app.post('/api/bikes', async (req, res) => {
    const { user_id, name, type, total_km } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO bikes (user_id, name, type, total_km) VALUES ($1, $2, $3, $4) RETURNING id, name, type, total_km as distance',
            [user_id, name, type, total_km]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bikes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT id, name, type, total_km as distance FROM bikes WHERE user_id = $1', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- ROWER (Usuwanie) ---
app.delete('/api/bikes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM bikes WHERE id = $1', [req.params.id]);
        console.log(`✅ ROWER ${req.params.id} USUNIĘTY Z SQL`);
        res.json({ status: 'sukces' });
    } catch (err) { 
        console.error("❌ BŁĄD USUWANIA ROWERU:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- TRASY (Zapis) ---
app.post('/api/routes', async (req, res) => {
    // Dodaliśmy bike_id do odbieranych danych:
    const { user_id, bike_id, name, distance, duration, points_json } = req.body;
    try {
        const result = await db.query(
            // Dodaliśmy bike_id do zapytania SQL:
            'INSERT INTO routes (user_id, bike_id, name, distance, duration, points_json) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user_id, bike_id, name, distance, duration, points_json]
        );
        console.log("✅ TRASA ZAPISANA W SQL");
        res.status(201).json(result.rows[0]);
    } catch (err) { 
        console.error("❌ BŁĄD SQL TRASA:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- TRASY (Usuwanie) ---
app.delete('/api/routes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
        console.log(`✅ TRASA ${req.params.id} USUNIĘTA Z SQL`);
        res.json({ status: 'sukces' });
    } catch (err) { 
        console.error("❌ BŁĄD USUWANIA TRASY:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- UŻYTKOWNICY (Aktualizacja Awatara) ---
app.put('/api/users/:id/avatar', async (req, res) => {
    const { avatar } = req.body;
    try {
        await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.params.id]);
        console.log(`✅ AWATAR ZAKTUALIZOWANY DLA USERA: ${req.params.id}`);
        res.json({ status: 'sukces' });
    } catch (err) { 
        console.error("❌ BŁĄD ZAPISU AWATARA:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});
app.get('/api/routes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT *, points_json as points FROM routes WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STREFY (POST & GET) ---
app.post('/api/turf', async (req, res) => {
    const { user_id, faction, zX, zY } = req.body;
    try {
        await db.query(
            `INSERT INTO turf_zones (user_id, faction, zx, zy) VALUES ($1, $2, $3, $4) 
             ON CONFLICT (zx, zy) DO UPDATE SET faction = EXCLUDED.faction, user_id = EXCLUDED.user_id`,
            [user_id, faction, zX, zY]
        );
        res.status(201).json({ status: 'ok' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/turf', async (req, res) => {
    try {
        const result = await db.query('SELECT faction, zx as "zX", zy as "zY" FROM turf_zones');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`Serwer na porcie ${port}`));
