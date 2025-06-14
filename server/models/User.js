import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    totalQuizzes: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    },
    quizHistory: [{
        quizType: {
            type: String,
            enum: ['multiple', 'short', 'long']
        },
        sourceFile: String,
        score: Number,
        maxScore: Number,
        percentage: Number,
        completedAt: {
            type: Date,
            default: Date.now
        }
    }],
    strengths: [{
        topic: String,
        score: Number
    }],
    weaknesses: [{
        topic: String,
        score: Number
    }],
    lastActive: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema); 