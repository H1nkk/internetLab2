const express = require('express');
const expressSession = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const pg = require('pg'); // что это
const { json } = require('stream/consumers');
const { log } = require('console');
const pgSession = require('connect-pg-simple')(expressSession);

const app = express();
const admin_login = 'admin';
const admin_password = 'qwer';

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ?????????
app.use(cookieParser());

const pgPool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydatabase',
  password: 'root',
  port: 5433,
});

// module.exports = pgPool;

pgPool.query('SELECT NOW()', function(err, res) {
    if (err) {
        console.log('Error connecting to db', err.stack);
    } else {
        console.log('Connected to db successfully');
    }
})

app.use(expressSession({
    store: new pgSession({
        pool: pgPool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: 'session_cookie_secret', //????????????
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 час
}))

app.post('/user', async function(req, res) {
    try {
        console.log("new problem req: ", req.body);
        var count_result = await pgPool.query('SELECT COUNT(*) FROM problems');
        console.log("cres:", count_result);
        var count = parseInt(count_result.rows[0].count);
        var problem_id = count + 1;

        var login = req.session.login;
        var row_result = (await pgPool.query(`SELECT * FROM users WHERE login ='${login}'`)).rows[0];
        console.log(row_result);
        var {firstname, secondname, lastname} = req.body;
        var author = row_result['firstname'] + ' ' + row_result['secondname'] + ' ' + row_result['lastname'];
        var result = await pgPool.query(
            `INSERT INTO problems (id, title, description, author, note, status, author_login, responsible_worker)
            VALUES ($1, $2, $3, $4, '', 'unsolved', $5, NULL) RETURNING *`,
            [
                problem_id, 
                req.body.problemtitle, 
                req.body.problemdescription, 
                author, 
                req.session.login
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
        var login = req.body.login;
        var count_result_users = await pgPool.query(`SELECT COUNT(*) FROM users WHERE login='${login}'`);
        var count_result_workers = await pgPool.query(`SELECT COUNT(*) FROM workers WHERE login='${login}'`);
        if (parseInt(count_result_users.rows[0].count) > 0 || parseInt(count_result_workers.rows[0].count) > 0 || login == 'admin') {

            res.status(500).json('error: неуникальный логин');
            console.log('error: неуникальный логин');
            return;
        }
        var count_result = await pgPool.query('SELECT COUNT(*) FROM users');
        var count = parseInt(count_result.rows[0].count);
        var user_id = count + 1;
        var {firstname, secondname, lastname} = req.body;
        
        var result = await pgPool.query(
            `INSERT INTO users (login, password, firstname, secondname, lastname, phone)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                login, 
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
    }
})

app.post('/auth', async function(req, res) {
    try {
        console.log("auth req: ", req.body);
        const login = req.body.login;
        const password = req.body.password;

        // admin check:
        if (login == admin_login && password == admin_password) {
            // TODO тут надо менять куки навернооооооо #########################################
            req.session.login = login;
            res.redirect('/admin.html');
            return;
        }

        // worker check:
        const worker_count_result = await pgPool.query(`SELECT COUNT(*) FROM workers WHERE login = '${login}'`);
        if (parseInt(worker_count_result.rows[0].count) != 0) {
            // TODO тут надо менять куки навернооооооо #########################################
            req.session.login = login;

            res.redirect('/worker.html');
            return;
        }

        const user_count_result = await pgPool.query(`SELECT COUNT(*) FROM users WHERE login = '${login}'`);
        if (parseInt(user_count_result.rows[0].count) != 0) {
            // TODO тут надо менять куки #########################################
            req.session.login = login;

            res.redirect('/user');
            return;
        }

        // переделать на ajax: #########################################
        console.log("invalid login or password");
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
    var login = req.session.login || '';
    if (login != 'admin') {
        res.status(403).json("only admin can see this page");
        return;
    }
    console.log('admin requested admin.html');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
})

app.get('/logout', function(req, res) {
    console.log('logout');
    req.session.destroy(function(err) {
        if (err) {
            console.log('error:', err);
        }

        res.clearCookie(req.sessionID);
        res.redirect('/auth');
    })
})

app.get('/get_login', function(req, res) {
    console.log('get_login');
    res.end(JSON.stringify({login: req.session.login}));
})

app.get('/unsolved/admin', async function(req, res) { // норм что async? ###############################################################
    console.log('unsolved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'unsolved'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/unsolved/user', async function(req, res) { // норм что async? ###############################################################
    console.log('unsolved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'unsolved' AND author_login = '${req.session.login}'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})


app.get('/solved/admin', async function(req, res) { // норм что async? ###############################################################
    console.log('solved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'solved'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/solved/user', async function(req, res) { // норм что async? ###############################################################
    console.log('solved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'solved' AND author_login = '${req.session.login}'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/test', function(req, res) {
    console.log('test');
    res.end(JSON.stringify([{id : "534", car: "mbw"}]));
})

app.get('/cook', function(req, res) {
    req.session.number = (req.session.number + 1) || 1;
    req.session.gg = "dsa";
    res.end("You read this", req.session.number, "times");
})

const PORT = 3000;
app.listen(PORT, function() {
    console.log('function running on port ', PORT);
})
