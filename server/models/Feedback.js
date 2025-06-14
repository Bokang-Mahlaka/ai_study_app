import mongoose from 'mongoose';

const Feedbackschema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    feedback: {
        type: String,
        required: true,
        trim: true
    }

})