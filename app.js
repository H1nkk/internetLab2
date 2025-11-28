const express = require('express');
const path = require('path');
const {Pool} = require('pg'); // что это
require('dotenv').config();

const app = express();
const admin_login = 'admin';
const admin_password = 'qwer';

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ?????????

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = pool;

pool.query('SELECT NOW()', function(err, res) {
    if (err) {
        console.log('Error connecting to db', err.stack);
    } else {
        console.log('Connected to db successfully');
    }
})


app.post('/user', async function(req, res) {
    try {
        console.log("new problem req: ", req.body);
        const count_result = await pool.query('SELECT COUNT(*) FROM problems');
        console.log("cres:", count_result);
        const count = parseInt(count_result.rows[0].count);
        const problem_id = count + 1;
        const {firstname, secondname, lastname} = req.body;
        const author = firstname + ' ' + secondname + ' ' + lastname;
        const result = await pool.query(
            `INSERT INTO problems (id, title, description, author, note, status)
            VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
            [
                problem_id, 
                req.body.problemtitle, 
                req.body.problemdescription, 
                author, 
                ""
            ]
        );

        res.status(200);
        res.redirect('/user');
    } catch (error) {
        res.status(500).json('Не удалось создать проблему: ' + error.message);
        console.log("error: ", error.message);
    }
})


app.post('/register', async function(req, res) {
    try {
        console.log("register req: ", req.body);
        const count_result = await pool.query('SELECT COUNT(*) FROM users');
        const count = parseInt(count_result.rows[0].count);
        const user_id = count + 1;
        const {firstname, secondname, lastname} = req.body;
        const result = await pool.query(
            `INSERT INTO users (login, password, firstname, secondname, lastname, phone)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                req.body.login, 
                req.body.password,
                firstname,
                secondname,
                lastname, 
                req.body.phone
            ]
        );

        res.status(200);
        res.redirect('/auth');
    } catch (error) {
        res.status(500).json('Не удалось создать проблему: ' + error.message);
        console.log('error: ', error.message);
        res.redirect('/register');
        alert('Ошибка при регистрации: ' + error.message);
    }
})

app.post('/auth', async function(req, res) {
    try {
        console.log("auth req: ", req.body);
        const login = req.body.login;
        const password = req.body.password;

        // admin check:
        if (login == admin_login && password == admin_password) {
            res.redirect('/admin.html');
            return;
        }

        // worker check:
        const worker_count_result = await pool.query(`SELECT COUNT(*) FROM workers WHERE login = '${login}'`);
        if (parseInt(worker_count_result.rows[0].count) != 0) {
            // TODO тут надо менять куки навернооооооо #########################################
            res.redirect('/worker.html');
            return;
        }

        const user_count_result = await pool.query(`SELECT COUNT(*) FROM users WHERE login = '${login}'`);
        if (parseInt(user_count_result.rows[0].count) != 0) {
            // TODO тут надо менять куки #########################################
            res.redirect('/user.html');
            return;
        }

        res.send(`
            <html>
                <body>
                    <script>
                        alert('Неверно введены логин или пароль.');
                        window.location.href='/auth';
                    </script>

                </body>
            </html>
            `);
    } catch (error) {
        console.log(error.message);
        res.status(500).send('server error');
    }
})

app.get('/user', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
})

app.get('/auth', function(req, res) {
    res.sendFile(path.join(__dirname, 'auth.html'));
})

app.get('/register', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
})

app.get('/admin', function(req, res) {
    console.log('admin');
    // тут проверка из куки что заходит админ
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
})

const PORT = process.env.PORT || 3000; // зачем 3000?
app.listen(PORT, function() {
    console.log('function running on port ', PORT);
})