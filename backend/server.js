require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Mount the admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/dashboard', require('./routes/dashboard'));
// Health Check Endpoint for UptimeRobot
app.get('/health', (req, res) => res.status(200).json({ status: 'OK', timestamp: new Date() }));

app.use('/api/admin/actions', require('./routes/actions'));
app.use('/api/admin/vendors', require('./routes/vendors'));

const PORT = process.env.PORT || process.env.ADMIN_PORT || 4000;
app.listen(PORT, () => {
  console.log(`[AdminBackend] Server listening on port ${PORT}`);
});
