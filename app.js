const express = require('express');
const expressSession = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const pg = require('pg'); // что это
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

app.put('/user/put_problem', async function(req, res) {
    try {
        console.log("new problem req: ", req.body);
        var id_result = await pgPool.query('SELECT MAX(id) FROM problems');
        var prev_id = parseInt(id_result.rows[0].max) || 0;
        var problem_id = prev_id + 1;

        var login = req.session.login;
        var row_result = (await pgPool.query(`SELECT * FROM users WHERE login ='${login}'`)).rows[0];
        var author = row_result['firstname'] + ' ' + row_result['secondname'] + ' ' + row_result['lastname'];
        var result = await pgPool.query(
            `INSERT INTO problems (id, title, description, author, note, status, author_login, responsible_worker)
            VALUES ($1, $2, $3, $4, '', 'unassigned', $5, NULL) RETURNING *`,
            [
                problem_id, 
                req.body.title, 
                req.body.description, 
                author, 
                req.session.login
            ]
        );

        res.status(200).end(`put problem id#${problem_id} successfully`);
    } catch (error) {
        res.status(500).json('Не удалось создать проблему: ' + error.message); // TODO надо пересмотреть все res.status().. ##########################################
        console.log("error: ", error.message);
    }
})


app.post('/register', async function(req, res) {
    try {
        console.log("register req: ", req.body);
        var login = req.body.login;
        var count_result_users = await pgPool.query(`SELECT COUNT(*) FROM users WHERE login='${login}'`);
        var count_result_workers = await pgPool.query(`SELECT COUNT(*) FROM workers WHERE login='${login}'`);
        if (parseInt(count_result_users.rows[0].count) > 0 || parseInt(count_result_workers.rows[0].count) > 0 || login == admin_login) {

            // TODO может тут надо res.status(???) ??????? #############################################################################################################
            res.end(JSON.stringify({status: "This login is currently in use"})); // TODO в чем разница между .end И .send? ######################################################
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
        res.end(JSON.stringify({status: "ok", redirect: "/auth"}));
    } catch (error) {
        res.status(500).json('Не удалось создать проблему: ' + error.message);
        console.log('error: ', error.message);
    }
})

app.post('/check_login', async function(req, res) {
    try {
        console.log("auth req: ", req.body);
        const login = req.body.login;
        const password = req.body.password;

        // admin check:
        if (login == admin_login && password == admin_password) {
            console.log(login, "logged successfully");
            req.session.login = login;
            res.end(JSON.stringify({status: 'ok', redirect: '/admin'}));
            return;
        }

        // worker check:
        const worker_count_result = await pgPool.query(`SELECT COUNT(*) FROM workers WHERE login = '${login}'`);
        if (parseInt(worker_count_result.rows[0].count) != 0) {
            const worker_password_result = await pgPool.query(`SELECT PASSWORD FROM workers WHERE login = '${login}'`);
            if (password == worker_password_result.rows[0].password) {
                console.log(login, "logged successfully");

                req.session.login = login;
                res.end(JSON.stringify({status: 'ok', redirect: '/worker.html'})); // TODO мб сделать не .html?? --------- не, с /worker не работает
            } else {
                console.log("invalid worker password");
                console.log(`requested password: ${password}, real password: ${worker_password_result.rows[0].password}`);
                res.send(JSON.stringify({status: "Invalid login or password"}));
            }
            return;
        }

        const user_count_result = await pgPool.query(`SELECT COUNT(*) FROM users WHERE login = '${login}'`);
        if (parseInt(user_count_result.rows[0].count) != 0) {
            const user_password_result = await pgPool.query(`SELECT PASSWORD FROM users WHERE login = '${login}'`);
            if (password == user_password_result.rows[0].password) {
                console.log(login, "logged successfully");
                
                req.session.login = login;
                res.end(JSON.stringify({status: 'ok', redirect: '/user'}));
            } else {
                console.log("invalid user password");
                console.log(`requested password: ${password}, real password: ${user_password_result.rows[0].password}`);
                res.send(JSON.stringify({status: "Invalid login or password"}));
            }
            return;
        }

        // переделать на ajax:  DONE #########################################
        console.log("invalid login or password");
        res.send(JSON.stringify({status: "Invalid login or password"}));
    } catch (error) {
        console.log(error.message);
        res.status(500).send('server error');
    }
})

app.get('/admin_check', function(req, res) {
    try {
        if (req.session.login != admin_login) {
            res.end(JSON.stringify({status: "not ok"}));
        } else {
            res.end(JSON.stringify({status: "ok"}));
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).send('server error');
    }
})
app.get('/user', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
})

app.get('/user/unsolved', async function(req, res) { // норм что async? ###############################################################
    console.log('unsolved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE (status = 'unsolved' OR status = 'unassigned') AND author_login = '${req.session.login}'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/user/solved', async function(req, res) { // норм что async? ###############################################################
    console.log('solved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'solved' AND author_login = '${req.session.login}'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/worker/unsolved', async function(req, res) { // норм что async? ###############################################################
    console.log('unsolved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT id, title, description, author, note, author_login FROM problems WHERE status = 'unsolved' AND responsible_worker = '${req.session.login}'`);
        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/worker/solved', async function(req, res) { // норм что async? ###############################################################
    console.log('solved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT id, title, description, author, note, author_login FROM problems WHERE status = 'solved' AND responsible_worker = '${req.session.login}'`);
        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

// TODO Добавить защиту чтобы нельзя было прийти по admin.html ####################################################################################################
app.get('/admin', function(req, res) {
    var login = req.session.login || '';
    if (login != admin_login) {
        res.status(403).json("only admin can see this page");
        return;
    }
    console.log('admin requested admin.html');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
})

app.get('/admin/unassigned', async function(req, res) { // норм что async? ###############################################################
    console.log('unassigned requested by', req.session.login);
    try {
        var table_result = await pgPool.query(`SELECT * FROM problems WHERE status = 'unassigned'`);
        var workers_result = await pgPool.query(`SELECT login, secondname FROM workers`);

        res.end(JSON.stringify([table_result.rows, workers_result.rows]));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/admin/unsolved', async function(req, res) { // норм что async? ###############################################################
    console.log('unsolved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'unsolved'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/admin/solved', async function(req, res) { // норм что async? ###############################################################
    console.log('solved requested by', req.session.login);
    try {
        var result = await pgPool.query(`SELECT * FROM problems WHERE status = 'solved'`);

        res.end(JSON.stringify(result.rows));
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
})

app.get('/auth', function(req, res) {
    res.sendFile(path.join(__dirname, 'auth.html'));
})

app.get('/register', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
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

app.put('/admin/put', function(req, res) {
    console.log('assigning: ', req.body);
    try {
        var result = pgPool.query(`UPDATE problems SET responsible_worker = '${req.body.worker}', status = 'unsolved' WHERE id = ${req.body.id}`);

        res.status(200).send('ok');
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
    res.status(200); // TODO передлеать ??
})

app.put('/worker/put', function(req, res) {
    console.log('assigning: ', req.body);
    try {
        var result = pgPool.query(`UPDATE problems SET note = '${req.body.note}', status = 'solved' WHERE id = ${req.body.id}`);
        res.status(200).send('ok');
    } catch (error) {
        console.log('error: ', error.message);
        res.status(500).json(error.message);
    }
    res.status(200); // TODO передлеать ??
})

const PORT = 3000;
app.listen(PORT, function() {
    console.log('function running on port ', PORT);
})
