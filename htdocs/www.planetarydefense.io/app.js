// Routes pour les produits
app.get('/api/products', async (req, res) => {
    try {
        const { section, page = 1, limit = 6 } = req.query;
        const offset = (page - 1) * limit;

        const query = `
            SELECT * FROM products 
            WHERE section = ? 
            ORDER BY date DESC 
            LIMIT ? OFFSET ?
        `;
        
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM products 
            WHERE section = ?
        `;

        const [products, countResult] = await Promise.all([
            db.all(query, [section, limit, offset]),
            db.get(countQuery, [section])
        ]);

        const totalPages = Math.ceil(countResult.total / limit);

        res.json({
            success: true,
            products,
            totalPages,
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des produits:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des produits'
        });
    }
});

// Routes pour les dev logs
app.get('/api/dev-logs', async (req, res) => {
    try {
        const { page = 1, limit = 6 } = req.query;
        const offset = (page - 1) * limit;

        const query = `
            SELECT * FROM dev_logs 
            ORDER BY date DESC 
            LIMIT ? OFFSET ?
        `;
        
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM dev_logs
        `;

        const [logs, countResult] = await Promise.all([
            db.all(query, [limit, offset]),
            db.get(countQuery)
        ]);

        const totalPages = Math.ceil(countResult.total / limit);

        res.json({
            success: true,
            logs,
            totalPages,
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des dev logs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des dev logs'
        });
    }
}); 