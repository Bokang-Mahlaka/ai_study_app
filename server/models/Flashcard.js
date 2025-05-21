import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
    type: String,
    required: true,
    trim: true
},
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

export default mongoose.model('Flashcard', flashcardSchema);
