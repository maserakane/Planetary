const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db');

// Serve login-wax.html on GET request to /login-wax
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login-wax.html'));
});

// Handle POST request to /login-wax/add
router.post('/add', (req, res) => {
  const { owner } = req.body;

  // Log the received owner value for debugging
  console.log('Received owner:', owner);

  if (!owner) {
    return res.status(400).send('Owner is required');
  }

  const query = `INSERT INTO Players (owner) VALUES (?)`;

  db.run(query, [owner], function(err) {
    if (err) {
      console.error('Error inserting user:', err.stack);
      return res.status(500).send('Error inserting user');
    }
    res.status(200).send('User added successfully');
  });
});

module.exports = router;
