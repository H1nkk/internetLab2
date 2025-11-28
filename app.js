const express = require('express');
const path = require('path');
const pool = require('./db_test.js');
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ?????????

pool.query('SELECT NOW()', function(err, res) {
    if (err) {
        console.log('Error connecting to db', err.stack);
    } else {
        console.log('Connected to db successfully');
    }
})

const PORT = process.env.PORT; // зачем 3000?
app.listen(PORT, function() {
    console.log('function running on port ', PORT);
})

app.post('/user', async function(req, res) {
    try {
        console.log(req.body);
        const count_result = await pool.query('SELECT COUNT(*) FROM problems');
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
        res.status(500).json('Не удалось создать проблему: ' + error.message); // что за фигурные скобки
        console.log("error: ", error.message);
    }
})

app.get('/user', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'user.html'))
})
