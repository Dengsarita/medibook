require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();
app.use(express.json());

async function createUser(req, res, role) {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'name, email and password are required' });
        }
        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hash, role });
        res.status(201).json({ message: 'Registered', id: user._id, email: user.email, role: user.role });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
        res.status(400).json({ message: err.message });
    }
}

// Public: always creates a patient
app.post('/api/register', (req, res) => createUser(req, res, 'patient'));

// Admin only (the gateway will enforce this later): always creates an admin
app.post('/api/register/admin', (req, res) => createUser(req, res, 'admin'));

mongoose.connect(process.env.MONGO_URI)
    .then(() => app.listen(process.env.PORT, () => console.log('Registration service on port ' + process.env.PORT)))
    .catch(err => console.error('MongoDB connection failed:', err.message));