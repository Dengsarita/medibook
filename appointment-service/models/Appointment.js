const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeSlot: { type: String, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

// Prevent double booking: one active appointment per doctor, date and slot.
// Cancelled or completed appointments do not block the slot.
appointmentSchema.index(
    { doctorId: 1, date: 1, timeSlot: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

module.exports = mongoose.model('Appointment', appointmentSchema);