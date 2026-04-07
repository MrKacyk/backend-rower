const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware (dodatki ułatwiające komunikację z aplikacją frontendową)
app.use(cors());
app.use(express.json()); 

// Konfiguracja logowania do bazy w chmurze (Supabase) - Bezpieczny format
const db = new Pool({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.isebxmteelfqrbfyghky',
    password: 'Kacyk270194#94', // <-- Twoje normalne hasło z kratką
    database: 'postgres',
    ssl: { rejectUnauthorized: false } // <-- Wymagane przez Supabase do bezpiecznych połączeń
});

// Zwykły test - czy sam serwer działa
app.get('/', (req, res) => {
    res.send('Serwer backendowy Projekt Rower działa!');
});

// Testowy endpoint - czy serwer umie gadać z bazą danych
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ 
            status: 'sukces', 
            wiadomosc: 'Udało się połączyć z bazą PostgreSQL!', 
            czas_bazy: result.rows[0].now 
        });
    } catch (err) {
        console.error('Błąd bazy danych:', err);
        res.status(500).json({ status: 'błąd', wiadomosc: 'Nie udało się połączyć z bazą' });
    }
});

// --- REJESTRACJA UŻYTKOWNIKA ---
app.post('/api/users', async (req, res) => {
    const { email, password, nickname } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email',
            [email, password, nickname]
        );
        res.status(201).json({
            status: 'sukces',
            wiadomosc: 'Użytkownik został pomyślnie dodany do bazy!',
            dane: result.rows[0]
        });
    } catch (err) {
        console.error('Błąd podczas rejestracji:', err);
        res.status(500).json({ 
            status: 'błąd', 
            wiadomosc: 'Nie udało się zapisać użytkownika. Być może taki email jest już w bazie.' 
        });
    }
});

// --- LOGOWANIE UŻYTKOWNIKA ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ wiadomosc: 'Nie znaleziono takiego użytkownika.' });
        }
        const user = result.rows[0];
        if (user.password_hash !== password) {
            return res.status(401).json({ wiadomosc: 'Błędne hasło.' });
        }
        res.json({
            status: 'sukces',
            token: 'bezpieczny_token_operacyjny_123',
            nickname: user.display_name,
            user: user
        });
    } catch (err) {
        console.error('Błąd logowania:', err);
        res.status(500).json({ wiadomosc: 'Błąd serwera podczas logowania.' });
    }
});

// --- DODAWANIE ROWERU (POST) ---
app.post('/api/bikes', async (req, res) => {
    const { user_id, name, type, total_km } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO bikes (user_id, name, type, total_km) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, name, type, total_km]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Błąd zapisu roweru:', err);
        res.status(500).json({ error: 'Błąd serwera przy rowerze' });
    }
});

// --- DODAWANIE TRASY (POST) ---
app.post('/api/routes', async (req, res) => {
    const { user_id, name, distance, duration, points_json } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO routes (user_id, name, distance, duration, points_json) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, name, distance, duration, points_json]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Błąd zapisu trasy:', err);
        res.status(500).json({ error: 'Błąd serwera przy trasie' });
    }
});

// --- PRZEJMOWANIE STREFY TURF WARS (POST) ---
app.post('/api/turf', async (req, res) => {
    const { user_id, faction, zX, zY } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO turf_zones (user_id, faction, zx, zy) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (zx, zy) 
             DO UPDATE SET faction = EXCLUDED.faction, user_id = EXCLUDED.user_id, captured_at = CURRENT_TIMESTAMP 
             RETURNING *`,
            [user_id, faction, zX, zY]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Błąd zapisu strefy w SQL:', err);
        res.status(500).json({ error: 'Błąd serwera przy strefie' });
    }
});

// ==========================================
// --- NOWE: FUNKCJE ODCZYTU Z BAZY (GET) ---
// ==========================================

// Pobieranie rowerów danego użytkownika
app.get('/api/bikes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM bikes WHERE user_id = $1', [req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Błąd odczytu rowerów:', err);
        res.status(500).json({ error: 'Błąd pobierania rowerów' });
    }
});

// Pobieranie tras danego użytkownika
app.get('/api/routes/:userId', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM routes WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Błąd odczytu tras:', err);
        res.status(500).json({ error: 'Błąd pobierania tras' });
    }
});

// Pobieranie wszystkich przejętych stref wojen
app.get('/api/turf', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM turf_zones');
        res.json(result.rows);
    } catch (err) {
        console.error('Błąd odczytu stref:', err);
        res.status(500).json({ error: 'Błąd pobierania stref' });
    }
});

// Uruchomienie nasłuchiwania serwera (ZAWSZE NA SAMYM DOLE PLIKU!)
app.listen(port, () => {
    console.log(`Serwer API działa i nasłuchuje na porcie http://localhost:${port}`);
});
