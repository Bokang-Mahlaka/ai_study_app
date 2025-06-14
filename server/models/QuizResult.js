import mongoose from 'mongoose';

const quizResultSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    quizType: {
        type: String,
        enum: ['multiple', 'short', 'long'],
        required: true
    },
    sourceFile: {
        type: String,
        required: true
    },
    questions: [{
        question: String,
        userAnswer: String,
        correctAnswer: String,
        isCorrect: Boolean,
        score: Number
    }],
    totalScore: {
        type: Number,
        required: true
    },
    maxScore: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('QuizResult', quizResultSchema); 