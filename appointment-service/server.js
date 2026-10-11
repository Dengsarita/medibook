require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');

const app = express();
app.use(express.json());

// The API Gateway verifies the JWT and adds these headers.
const userId = (req) => req.headers['x-user-id'];
const userRole = (req) => req.headers['x-user-role'];

function handleError(err, res) {
    if (err.code === 11000) return res.status(409).json({ message: 'This doctor is already booked for that date and time slot' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    return res.status(500).json({ message: err.message });
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Book an appointment (patient)
app.post('/api/appointments', async (req, res) => {
    try {
        if (!userId(req)) return res.status(401).json({ message: 'Not authenticated' });
        const { doctorId, date, timeSlot, reason } = req.body;
        if (!doctorId || !date || !timeSlot) {
            return res.status(400).json({ message: 'doctorId, date and timeSlot are required' });
        }

        // Inter-service call: check that the doctor exists
        let docRes;
        try {
            docRes = await fetch(`${process.env.DOCTOR_URL}/api/doctors/${doctorId}`);
        } catch (e) {
            return res.status(503).json({ message: 'Doctor service unavailable' });
        }
        if (docRes.status === 404 || docRes.status === 400) return res.status(404).json({ message: 'Doctor not found' });
        if (!docRes.ok) return res.status(503).json({ message: 'Doctor service error' });
        const { doctor } = await docRes.json();

        if (doctor.timeSlots.length && !doctor.timeSlots.includes(timeSlot)) {
            return res.status(400).json({ message: 'Time slot not offered by this doctor', available: doctor.timeSlots });
        }

        const appointment = await Appointment.create({ patientId: userId(req), doctorId, date, timeSlot, reason });
        res.status(201).json({ message: 'Appointment booked', appointment });
    } catch (err) { handleError(err, res); }
});

// My appointments (patient)
app.get('/api/appointments/my', async (req, res) => {
    try {
        if (!userId(req)) return res.status(401).json({ message: 'Not authenticated' });
        const list = await Appointment.find({ patientId: userId(req) }).sort({ date: 1 });
        res.json({ count: list.length, appointments: list });
    } catch (err) { handleError(err, res); }
});

// All appointments (admin)
app.get('/api/appointments', async (req, res) => {
    try {
        const list = await Appointment.find().sort({ date: 1 });
        res.json({ count: list.length, appointments: list });
    } catch (err) { handleError(err, res); }
});

// Update status (admin)
app.put('/api/appointments/:id/status', async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id, { status: req.body.status }, { new: true, runValidators: true });
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
        res.json({ message: 'Status updated', appointment });
    } catch (err) { handleError(err, res); }
});

// Cancel / delete (patient: own only, admin: any)
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
        if (userRole(req) !== 'admin' && String(appointment.patientId) !== userId(req)) {
            return res.status(403).json({ message: 'You can only cancel your own appointments' });
        }
        await appointment.deleteOne();
        res.json({ message: 'Appointment deleted' });
    } catch (err) { handleError(err, res); }
});

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        await Appointment.init(); // builds the unique index
        app.listen(process.env.PORT, () => console.log('Appointment service on port ' + process.env.PORT));
    })
    .catch(err => console.error('MongoDB connection failed:', err.message));