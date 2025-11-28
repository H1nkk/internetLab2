const express = require('express');
const pool = require('./db_test.js');

const app = express();

pool.query('SELECT NOW()', function(err, res) {
    if (err) {
        console.log('Error connecting to db', err.stack);
    } else {
        console.log('Connected to db successfully');
    }
})

const PORT = process.env.DB_PORT || 3000; // зачем 3000?
app.listen(PORT, function() {
    console.log('function running on port ', PORT);
})
