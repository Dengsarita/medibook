require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
app.use(express.json());

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'email and password are required' });
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '1h' }
        );
        res.json({ message: 'Login successful', token, role: user.role });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// The gateway verifies the token and sends x-user-id; this service trusts it.
app.get('/api/me', async (req, res) => {
    try {
        const id = req.headers['x-user-id'];
        if (!id) return res.status(401).json({ message: 'Not authenticated' });
        const user = await User.findById(id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ message: 'Invalid user id' });
    }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => app.listen(process.env.PORT, () => console.log('Login service on port ' + process.env.PORT)))
    .catch(err => console.error('MongoDB connection failed:', err.message));