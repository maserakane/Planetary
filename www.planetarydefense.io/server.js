require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', 1);
// ... existing code ...
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false,  // Désactivé pour le développement local
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d'
}));
app.use('/images', express.static(path.join(__dirname, 'images'), {
  maxAge: '30d'
}));
app.use(express.static(path.join(__dirname, 'dist')));

function checkAuth(req, res, next) {
    console.log('=== CheckAuth Middleware ===');
    console.log('Session:', req.session);
    console.log('Session user:', req.session.user);
    
    if (req.session.user) {
        console.log('✅ Session valide, accès autorisé');
        next();
    } else {
        console.log('❌ Pas de session utilisateur, redirection vers /login');
        res.redirect('/login');
    }
}

module.exports = {
    checkAuth: checkAuth
};

// Routes
console.log("test");
const loginRoutes = require('./routes/login');
console.log("test1");
const adminRoutes = require('./routes/admin');
console.log("test2");
const indexRoutes = require('./routes/index');
console.log("test3");
const missionRoutes = require('./routes/mission');
const userRoutes = require('./routes/user');

app.use('/login', loginRoutes);
app.use('/admin', checkAuth, adminRoutes);
app.use('/mission', missionRoutes);
app.use('/login-wax', userRoutes);
app.use('/api', adminRoutes);
app.use('/', indexRoutes);

app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur le port ${port}`);
});
