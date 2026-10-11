require('dotenv').config();
const os = require('os');
const express = require('express');
const mongoose = require('mongoose');
const Doctor = require('./models/Doctor');

const app = express();
app.use(express.json());

const servedBy = os.hostname(); // shows which replica answered (load balancer proof)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [${servedBy}] ${req.method} ${req.originalUrl}`);
    next();
});
function handleError(err, res) {
    if (err.code === 11000) return res.status(409).json({ message: 'Doctor email already exists' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid doctor id' });
    return res.status(500).json({ message: err.message });
}

app.get('/health', (req, res) => res.json({ status: 'ok', servedBy }));

// Read all
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.json({ servedBy, count: doctors.length, doctors });
    } catch (err) { handleError(err, res); }
});

// Read one
app.get('/api/doctors/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json({ servedBy, doctor });
    } catch (err) { handleError(err, res); }
});

// Create (admin only, enforced by the gateway)
app.post('/api/doctors', async (req, res) => {
    try {
        const doctor = await Doctor.create(req.body);
        res.status(201).json({ servedBy, message: 'Doctor created', doctor });
    } catch (err) { handleError(err, res); }
});

// Update (admin only)
app.put('/api/doctors/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json({ servedBy, message: 'Doctor updated', doctor });
    } catch (err) { handleError(err, res); }
});

// Delete (admin only)
app.delete('/api/doctors/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndDelete(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json({ servedBy, message: 'Doctor deleted' });
    } catch (err) { handleError(err, res); }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => app.listen(process.env.PORT, () => console.log('Doctor service on port ' + process.env.PORT)))
    .catch(err => console.error('MongoDB connection failed:', err.message));