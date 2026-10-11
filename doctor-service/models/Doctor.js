const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    availableDays: { type: [String], default: [] },
    timeSlots: { type: [String], default: [] },
    fee: { type: Number, required: true, min: 0 }
});

module.exports = mongoose.model('Doctor', doctorSchema);