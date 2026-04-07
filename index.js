const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); 

// POŁĄCZENIE Z BAZĄ DANYCH (Teraz jest tylko jedno i to poprawne!)
const db = new Pool({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.isebxmteelfqrbfyghky',
    password: 'Kacyk270194#94', 
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});

// --- TESTY ---
app.get('/', (req, res) => res.send('Backend Projekt Rower działa!'));

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ status: 'sukces', czas_bazy: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ status: 'błąd', wiadomosc: err.message });
    }
});

// --- UŻYTKOWNICY ---
app.post('/api/users', async (req, res) => {
    const { email, password, nickname } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name as nickname',
            [email, password, nickname]
        );
        res.status(201).json({ status: 'sukces', dane: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'błąd', wiadomosc: 'Email zajęty lub błąd bazy.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT id, email, password_hash, display_name as nickname FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0 || result.rows[0].password_hash !== password) {
            return res.status(401).json({ wiadomosc: 'Błędne dane logowania.' });
        }
        res.json({ status: 'sukces', token: 'token_123', user: result.rows[0], id: result.rows[0].id, nickname: result.rows[0].nickname });
    } catch (err) {
        res.status(500).json({ wiadomosc: 'Błąd serwera.' });
    }
});

// --- ROWER (Zapis i Odczyt) ---
app.post('/api/bikes', async (req, res) => {
    const { user_id, name, type, total_km } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO bikes (user_id, name, type, total_km) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, name, type, total_km]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bikes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT id, name, type, total_km as "totalKm", total_km as distance FROM bikes WHERE user_id = $1', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- TRASY (Zapis i Odczyt) ---
app.post('/api/routes', async (req, res) => {
    const { user_id, name, distance, duration, points_json } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO routes (user_id, name, distance, duration, points_json) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, name, distance, duration, points_json]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/routes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT *, points_json as points FROM routes WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STREFY (Zapis i Odczyt) ---
app.post('/api/turf', async (req, res) => {
    const { user_id, faction, zX, zY } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO turf_zones (user_id, faction, zx, zy) VALUES ($1, $2, $3, $4) 
             ON CONFLICT (zx, zy) DO UPDATE SET faction = EXCLUDED.faction, user_id = EXCLUDED.user_id, captured_at = CURRENT_TIMESTAMP RETURNING *`,
            [user_id, faction, zX, zY]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/turf', async (req, res) => {
    try {
        const result = await db.query('SELECT faction, zx as "zX", zy as "zY" FROM turf_zones');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// START SERWERA (Zawsze na końcu!)
app.listen(port, () => console.log(`Serwer działa na porcie ${port}`));
