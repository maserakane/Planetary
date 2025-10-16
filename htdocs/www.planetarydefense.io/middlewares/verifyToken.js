const jwt = require('jsonwebtoken');
require('dotenv').config();
const secretKey = process.env.SECRET_KEY;

function verifyToken(req, res, next) {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).send('No token provided');

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) return res.status(500).send('Failed to authenticate token');
        req.userAccount = decoded.userAccount;
        next();
    });
}

module.exports = verifyToken;