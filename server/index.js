import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import QuizResult from './models/QuizResult.js';
import User from './models/User.js';
import StudyEvent from './models/StudyEvent.js';
import Note from './models/Notes.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '.env') });

const API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/study-quiz';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
console.log("API Key Loaded:", API_KEY ? "YES" : "NO");

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    if (err.name === 'MongooseServerSelectionError') {
        console.error('Could not connect to MongoDB. Please check:');
        console.error('1. Your internet connection');
        console.error('2. The MongoDB URI is correct');
        console.error('3. Your IP address is whitelisted in MongoDB Atlas');
        console.error('4. Your username and password are correct');
    } else if (err.name === 'MongoParseError') {
        console.error('Invalid MongoDB URI. Please check the connection string format.');
    } else if (err.code === 8000) {
        console.error('Authentication failed. Please check your username and password.');
    }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Vite's default port
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Root Route to Verify Server is Running
app.get('/', (req, res) => {
    res.send('Server is running!');
});



// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return user data (excluding password) and token
        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return user data (excluding password) and token
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Protected Routes
app.post('/api/quiz-results', authenticateToken, async (req, res) => {
    try {
        const quizResult = new QuizResult({
            ...req.body,
            userId: req.user.userId
        });
        await quizResult.save();
        res.status(201).json(quizResult);
    } catch (error) {
        console.error('Error saving quiz result:', error);
        res.status(500).json({ error: 'Failed to save quiz result' });
    }
});

app.get('/api/quiz-results/:userId', authenticateToken, async (req, res) => {
    try {
        // Ensure user can only access their own results
        if (req.params.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        const results = await QuizResult.find({ userId: req.params.userId })
            .sort({ completedAt: -1 });
        res.json(results);
    } catch (error) {
        console.error('Error fetching quiz results:', error);
        res.status(500).json({ error: 'Failed to fetch quiz results' });
    }
});

app.get('/api/quiz-stats/:userId', authenticateToken, async (req, res) => {
    try {
        // Ensure user can only access their own stats
        if (req.params.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        const results = await QuizResult.find({ userId: req.params.userId });
        
        // Calculate stats even if there are no results
        const stats = {
            totalQuizzes: results.length || 0,
            averageScore: results.length > 0 
                ? results.reduce((acc, curr) => acc + curr.percentage, 0) / results.length 
                : 0,
            quizTypeStats: {
                multiple: results.filter(r => r.quizType === 'multiple').length || 0,
                short: results.filter(r => r.quizType === 'short').length || 0,
                long: results.filter(r => r.quizType === 'long').length || 0
            },
            recentScores: results.slice(0, 5).map(r => ({
                date: r.completedAt,
                score: r.percentage,
                type: r.quizType,
                sourceFile: r.sourceFile
            }))
        };

        // Add strengths and weaknesses based on performance
        if (results.length > 0) {
            const questionTypes = ['multiple', 'short', 'long'];
            const typeScores = questionTypes.map(type => {
                const typeResults = results.filter(r => r.quizType === type);
                return {
                    type,
                    averageScore: typeResults.length > 0
                        ? typeResults.reduce((acc, curr) => acc + curr.percentage, 0) / typeResults.length
                        : 0
                };
            });

            stats.strengths = typeScores
                .filter(score => score.averageScore >= 70)
                .map(score => score.type);

            stats.weaknesses = typeScores
                .filter(score => score.averageScore < 70)
                .map(score => score.type);
        }

        res.json(stats);
    } catch (error) {
        console.error('Error fetching quiz stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch quiz statistics',
            details: error.message 
        });
    }
});

// Proxy Route for Gemini API
app.post('/api/generate', authenticateToken, async (req, res) => {
    const { prompt, fileContent } = req.body;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        let finalPrompt = prompt;
        if (fileContent) {
            finalPrompt = prompt.replace('${content}', fileContent);
        }

        console.log('Sending request to Gemini API...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
            { contents: [{ parts: [{ text: finalPrompt }] }] },
            { 
                params: { key: API_KEY }, 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API');
        res.json(response.data);
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status
        });

        let errorMessage = 'Failed to generate content';
        let errorDetails = error.message;

        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Network Error';
            errorDetails = 'Unable to connect to the Gemini API. Please check your internet connection.';
        } else if (error.response?.status === 429) {
            errorMessage = 'Rate Limit Exceeded';
            errorDetails = 'Too many requests. Please try again later.';
        } else if (error.response?.status === 401) {
            errorMessage = 'Authentication Error';
            errorDetails = 'Invalid API key. Please check your configuration.';
        }

        res.status(500).json({ 
            error: errorMessage, 
            details: errorDetails,
            code: error.code
        });
    }
});

// Document Summarization Route
app.post('/api/summarize', authenticateToken, async (req, res) => {
    const { content } = req.body;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    if (!content) {
        return res.status(400).json({ error: 'No content provided' });
    }

    try {
        const prompt = `Please provide a comprehensive summary of the following document. 
        Focus on the main points, key concepts, and important details. 
        Format the summary in a clear and organized way:
        
        ${content}`;

        console.log('Sending request to Gemini API...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { 
                params: { key: API_KEY }, 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API');
        
        if (!response.data || !response.data.candidates || !response.data.candidates[0]?.content?.parts[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error in summarization:', error);
        
        if (error.response) {
            res.status(error.response.status).json({
                error: 'API Error',
                details: error.response.data?.error?.message || error.message
            });
        } else if (error.request) {
            res.status(503).json({
                error: 'Service Unavailable',
                details: 'Could not reach the Gemini API. Please try again later.'
            });
        } else {
            res.status(500).json({
                error: 'Internal Server Error',
                details: error.message
            });
        }
    }
});

// Image Problem Solving Route
app.post('/api/solve-problem', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Convert image buffer to base64
        const imageBase64 = req.file.buffer.toString('base64');

        // Prepare the prompt for Gemini API
        const prompt = `Please analyze this image and solve the problem shown in it. 
        If it's a mathematical problem, show the step-by-step solution.
        If it's a text-based problem, provide a detailed explanation and answer.
        If it's a diagram or graph, explain what it represents and any relevant insights.
        Please provide a clear and concise response.`;

        console.log('Sending request to Gemini API...');
        
        // Call Gemini API with image
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`,
            {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: req.file.mimetype,
                                data: imageBase64
                            }
                        }
                    ]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API:', JSON.stringify(response.data, null, 2));

        if (!response.data) {
            throw new Error('Empty response from Gemini API');
        }

        if (!response.data.candidates || !Array.isArray(response.data.candidates) || response.data.candidates.length === 0) {
            throw new Error('Invalid response format: No candidates found');
        }

        const candidate = response.data.candidates[0];
        if (!candidate.content || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            throw new Error('Invalid response format: No content parts found');
        }

        const textPart = candidate.content.parts[0];
        if (!textPart.text) {
            throw new Error('Invalid response format: No text content found');
        }

        res.json({
            solution: textPart.text
        });
    } catch (error) {
        console.error('Error processing image:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            config: {
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers
            }
        });

        let errorMessage = 'Failed to process image';
        let errorDetails = error.message;

        if (error.response?.status === 404) {
            errorMessage = 'API Endpoint Not Found';
            errorDetails = 'The Gemini API endpoint is not available. Please check the API configuration.';
        } else if (error.response?.status === 429) {
            errorMessage = 'Rate Limit Exceeded';
            errorDetails = 'Too many requests. Please try again later.';
        } else if (error.response?.status === 401) {
            errorMessage = 'Authentication Error';
            errorDetails = 'Invalid API key. Please check your configuration.';
        } else if (error.response?.status === 400) {
            errorMessage = 'Invalid Request';
            errorDetails = error.response.data?.error?.message || 'The image could not be processed.';
        }

        res.status(500).json({
            error: errorMessage,
            details: errorDetails
        });
    }
});

// Study Events Routes
app.post('/api/study-events', authenticateToken, async (req, res) => {
    try {
        const studyEvent = new StudyEvent({
            ...req.body,
            userId: req.user.userId
        });
        await studyEvent.save();
        res.status(201).json(studyEvent);
    } catch (error) {
        console.error('Error creating study event:', error);
        res.status(500).json({ error: 'Failed to create study event' });
    }
});

app.get('/api/study-events', authenticateToken, async (req, res) => {
    try {
        const events = await StudyEvent.find({ userId: req.user.userId })
            .sort({ startDate: 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching study events:', error);
        res.status(500).json({ error: 'Failed to fetch study events' });
    }
});

// Export Routes
app.post('/api/export/google-calendar', authenticateToken, async (req, res) => {
    try {
        const { title, description, startDate, endDate, subject, notes } = req.body;
        
        // Initialize Google Calendar API
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Create event
        const event = {
            summary: title,
            description: `${description}\n\nSubject: ${subject}\n\nNotes: ${notes}`,
            start: {
                dateTime: new Date(startDate).toISOString(),
                timeZone: 'UTC',
            },
            end: {
                dateTime: new Date(endDate).toISOString(),
                timeZone: 'UTC',
            },
        };

        await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        res.json({ message: 'Event exported to Google Calendar successfully' });
    } catch (error) {
        console.error('Error exporting to Google Calendar:', error);
        res.status(500).json({ error: 'Failed to export to Google Calendar' });
    }
});




// Get all notes for logged-in user
app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// Create a new note
app.post('/api/notes', authenticateToken, async (req, res) => {
    try {
        const { heading, content } = req.body;
        if (!heading || !content) {
            return res.status(400).json({ error: 'Heading and content are required' });
        }
        const note = new Note({
            userId: req.user.userId,
            heading,
            content
        });
        await note.save();
        res.status(201).json(note);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

// Update a note
app.put('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { heading, content } = req.body;
        if (!heading || !content) {
            return res.status(400).json({ error: 'Heading and content are required' });
        }
        const note = await Note.findOne({ _id: id, userId: req.user.userId });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        note.heading = heading;
        note.content = content;
        await note.save();
        res.json(note);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// Delete a note
app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const note = await Note.findOneAndDelete({ _id: id, userId: req.user.userId });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

import Flashcard from './models/Flashcard.js';

// Flashcard CRUD routes
app.post('/api/flashcards', authenticateToken, async (req, res) => {
    try {
        const { title, question, answer } = req.body;
        if (!title || !question || !answer) {
            return res.status(400).json({ error: 'Title, question and answer are required' });
        }
        const flashcard = new Flashcard({
            userId: req.user.userId,
            title,
            question,
            answer
        });
        await flashcard.save();
        res.status(201).json(flashcard);
    } catch (error) {
        console.error('Error creating flashcard:', error);
        res.status(500).json({ error: 'Failed to create flashcard' });
    }
});

app.get('/api/flashcards', authenticateToken, async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(flashcards);
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
});
app.get('/api/flashcards', authenticateToken, async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(flashcards);
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
});

app.put('/api/flashcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;
        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required' });
        }
        const flashcard = await Flashcard.findOne({ _id: id, userId: req.user.userId });
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' });
        }
        flashcard.question = question;
        flashcard.answer = answer;
        await flashcard.save();
        res.json(flashcard);
    } catch (error) {
        console.error('Error updating flashcard:', error);
        res.status(500).json({ error: 'Failed to update flashcard' });
    }
});

app.put('/api/flashcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, question, answer } = req.body;
        if (!title || !question || !answer) {
            return res.status(400).json({ error: 'Title, question and answer are required' });
        }
        const flashcard = await Flashcard.findOne({ _id: id, userId: req.user.userId });
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' });
        }
        flashcard.title = title;
        flashcard.question = question;
        flashcard.answer = answer;
        await flashcard.save();
        res.json(flashcard);
    } catch (error) {
        console.error('Error updating flashcard:', error);
        res.status(500).json({ error: 'Failed to update flashcard' });
    }
});
// Generate flashcards from document content
app.post('/api/flashcards/generate', authenticateToken, async (req, res) => {
    const { content } = req.body;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    if (!content) {
        return res.status(400).json({ error: 'No content provided' });
    }

    try {
        const prompt = `Generate flashcards from the following content. For each flashcard, provide a question and an answer. Format the output as a JSON array of objects with "question" and "answer" fields:

${content}`;

        console.log('Sending request to Gemini API for flashcard generation...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { 
                params: { key: API_KEY }, 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API for flashcards');

        if (!response.data || !response.data.candidates || !response.data.candidates[0]?.content?.parts[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }

        const generatedText = response.data.candidates[0].content.parts[0].text;

        // Try to parse JSON from the generated text
        let flashcards;
        try {
            flashcards = JSON.parse(generatedText);
        } catch (parseError) {
            console.error('Error parsing flashcards JSON:', parseError);
            return res.status(500).json({ error: 'Failed to parse generated flashcards' });
        }

        // Save flashcards to DB
        const savedFlashcards = [];
        for (const card of flashcards) {
            if (card.question && card.answer) {
                const flashcard = new Flashcard({
                    userId: req.user.userId,
                    question: card.question,
                    answer: card.answer
                });
                await flashcard.save();
                savedFlashcards.push(flashcard);
            }
        }

        res.json(savedFlashcards);
    } catch (error) {
        console.error('Error generating flashcards:', error);
        res.status(500).json({ error: 'Failed to generate flashcards' });
    }
});
app.post('/api/flashcards/generate', authenticateToken, async (req, res) => {
    const { content, title } = req.body;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    if (!content) {
        return res.status(400).json({ error: 'No content provided' });
    }

    try {
        const prompt = `Generate flashcards from the following content. For each flashcard, provide a question and an answer. Format the output as a JSON array of objects with "question" and "answer" fields:

${content}`;

        console.log('Sending request to Gemini API for flashcard generation...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { 
                params: { key: API_KEY }, 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API for flashcards');

        if (!response.data || !response.data.candidates || !response.data.candidates[0]?.content?.parts[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }

        const generatedText = response.data.candidates[0].content.parts[0].text;

        // Try to parse JSON from the generated text
        let flashcards;
        try {
            flashcards = JSON.parse(generatedText);
        } catch (parseError) {
            console.error('Error parsing flashcards JSON:', parseError);
            return res.status(500).json({ error: 'Failed to parse generated flashcards' });
        }

        // Save flashcards to DB
        const savedFlashcards = [];
        for (const card of flashcards) {
            if (card.question && card.answer) {
                const flashcard = new Flashcard({
                    userId: req.user.userId,
                    title: title || 'Untitled',
                    question: card.question,
                    answer: card.answer
                });
                await flashcard.save();
                savedFlashcards.push(flashcard);
            }
        }

        res.json(savedFlashcards);
    } catch (error) {
        console.error('Error generating flashcards:', error);
        res.status(500).json({ error: 'Failed to generate flashcards' });
    }
});

app.get('/api/flashcards', authenticateToken, async (req, res) => {
    try {
        const flashcards = await Flashcard.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(flashcards);
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
});

app.put('/api/flashcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;
        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required' });
        }
        const flashcard = await Flashcard.findOne({ _id: id, userId: req.user.userId });
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' });
        }
        flashcard.question = question;
        flashcard.answer = answer;
        await flashcard.save();
        res.json(flashcard);
    } catch (error) {
        console.error('Error updating flashcard:', error);
        res.status(500).json({ error: 'Failed to update flashcard' });
    }
});

app.delete('/api/flashcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const flashcard = await Flashcard.findOneAndDelete({ _id: id, userId: req.user.userId });
        if (!flashcard) {
            return res.status(404).json({ error: 'Flashcard not found' });
        }
        res.json({ message: 'Flashcard deleted successfully' });
    } catch (error) {
        console.error('Error deleting flashcard:', error);
        res.status(500).json({ error: 'Failed to delete flashcard' });
    }
});

// Generate flashcards from document content
app.post('/api/flashcards/generate', authenticateToken, async (req, res) => {
    const { content } = req.body;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    if (!content) {
        return res.status(400).json({ error: 'No content provided' });
    }

    try {
        const prompt = `Generate flashcards from the following content. For each flashcard, provide a question and an answer. Format the output as a JSON array of objects with "question" and "answer" fields:

${content}`;

        console.log('Sending request to Gemini API for flashcard generation...');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { 
                params: { key: API_KEY }, 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('Received response from Gemini API for flashcards');

        if (!response.data || !response.data.candidates || !response.data.candidates[0]?.content?.parts[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }

        const generatedText = response.data.candidates[0].content.parts[0].text;

        // Try to parse JSON from the generated text
        let flashcards;
        try {
            flashcards = JSON.parse(generatedText);
        } catch (parseError) {
            console.error('Error parsing flashcards JSON:', parseError);
            return res.status(500).json({ error: 'Failed to parse generated flashcards' });
        }

        // Save flashcards to DB
        const savedFlashcards = [];
        for (const card of flashcards) {
            if (card.question && card.answer) {
                const flashcard = new Flashcard({
                    userId: req.user.userId,
                    question: card.question,
                    answer: card.answer
                });
                await flashcard.save();
                savedFlashcards.push(flashcard);
            }
        }

        res.json(savedFlashcards);
    } catch (error) {
        console.error('Error generating flashcards:', error);
        res.status(500).json({ error: 'Failed to generate flashcards' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
