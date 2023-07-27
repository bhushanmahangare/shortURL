const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'aventri',
  password: 'test123',
  database: 'URL',
  port:3306
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database!');
});
module.exports = connection;