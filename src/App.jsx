import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import PerformanceDashboard from './components/PerformanceDashboard';
import Quiz from './components/Quiz';
import DocumentSummarizer from './components/DocumentSummarizer';
import ImageProblemSolver from './components/ImageProblemSolver';
import FlashcardsPage from './components/FlashcardsPage';
import DocumentFlashcardGenerator from './components/DocumentFlashcardGenerator';
import { Upload, Book, ListChecks, AlignLeft, MessageSquare, Camera, BookOpen } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Notes from './components/Notes';


// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
).toString();

// Constants
const CHUNK_SIZE = 2000; // Maximum chunk size
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 1000;

const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [file, setFile] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [questionType, setQuestionType] = useState('multiple'); // Default question type
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [quizResults, setQuizResults] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9)); // Temporary user ID

    useEffect(() => {
        // Check for stored user data on component mount
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
            const userObj = JSON.parse(storedUser);
            userObj.token = storedToken;
            setUser(userObj);
        }
        setLoading(false);
    }, []);

    const handleLogin = (loginData) => {
        // loginData contains { token, user }
        if (loginData && loginData.token && loginData.user) {
            const userObj = { ...loginData.user, token: loginData.token };
            setUser(userObj);
            localStorage.setItem('user', JSON.stringify(loginData.user));
            localStorage.setItem('token', loginData.token);
        }
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    // Read uploaded file content
    const readFileContent = async (file) => {
        const fileType = file.type;

        if (fileType === "application/pdf") {
            try {
                // Convert PDF file to ArrayBuffer
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                let text = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(" ")
                        .replace(/\s+/g, ' ')
                        .trim();
                    text += pageText + "\n\n";
                }

                // Clean up the text
                text = text
                    .replace(/\s+/g, ' ')
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                console.log('Extracted PDF text:', text);
                return { content: text, type: "text/plain" };
            } catch (error) {
                console.error('Error reading PDF:', error);
                throw new Error('Failed to read PDF file');
            }
        } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                   fileType === "application/msword") {
            try {
                // Convert DOCX file to ArrayBuffer
                const arrayBuffer = await file.arrayBuffer();
                
                // Process DOCX with Mammoth
                const result = await mammoth.extractRawText({ arrayBuffer });
                
                // Clean up the text
                let text = result.value
                    .replace(/\s+/g, ' ')
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                console.log('Extracted DOCX text:', text);
                return { content: text, type: "text/plain" };
            } catch (error) {
                console.error('Error reading DOCX:', error);
                throw new Error('Failed to read DOCX file');
            }
        } 

        // If it's not a PDF or DOCX, process as text
        try {
            const text = await file.text();
            return { content: text, type: "text/plain" };
        } catch (error) {
            console.error('Error reading file:', error);
            throw new Error('Failed to read file');
        }
    };

    // Split content into chunks
    const chunkContent = (content) => {
        // Decode base64 content
        const decodedContent = atob(content);
        const sentences = decodedContent.match(/[^.!?]+[.!?]+/g) || [];
        const chunks = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= CHUNK_SIZE) {
                currentChunk += sentence;
            } else {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            }
        }

        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    };

    // Retry mechanism for API calls
    const callWithRetry = async (fn, retries = MAX_RETRIES) => {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0 && (error.response?.status === 429 || !error.response)) {
                await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
                return callWithRetry(fn, retries - 1);
            }
            throw error;
        }
    };

    // Generate questions for a specific chunk using Gemini API
    const generateQuestionsForChunk = async (chunk, type) => {
        console.log('Generating questions for chunk:', {
            chunkLength: chunk.length,
            type: type,
            preview: chunk.substring(0, 100) // Log first 100 chars for debugging
        });

        const prompt = generatePrompt(type, chunk);
        console.log('Generated prompt:', prompt);

        try {
            console.log('Sending request to server...');
            const response = await callWithRetry(async () =>
                fetch('http://localhost:5000/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt,
                        fileContent: chunk // Send the text content directly
                    }),
                })
            );

            console.log('Server response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error(errorData.details || errorData.error || 'Failed to generate questions');
            }

            const data = await response.json();
            console.log('Server response data:', data);

            if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response format from server');
            }

            return parseResponse(data.candidates[0].content.parts[0].text, type);
        } catch (err) {
            console.error("Error generating content:", err);
            setError(`Error: ${err.message}`);
            return [];
        }
    };

    // Generate the prompt for Gemini API
    const generatePrompt = (type, content) => {
        const prompts = {
            multiple: `Generate 5 multiple-choice questions with 4 options (A-D) from this content: ${content}. 
            For each question:
            1. Make the correct answer clear and unambiguous
            2. Label the correct answer as 'Correct: X' where X is A, B, C, or D
            3. Ensure all options are plausible but only one is correct
            4. Format each question EXACTLY as follows:
               
               1. [question text]
               A) [option A]
               B) [option B]
               C) [option C]
               D) [option D]
               Correct: [letter]
               
               (Make sure to include a blank line between questions and keep each question's content together)`,
            short: `Generate 5 short answer questions from this content: ${content}. 
            For each question:
            1. Make the expected answer clear and concise
            2. Format each question as:
               Question: [question text]
               Answer: [expected answer]`,
            long: `Generate 3 essay questions from this content: ${content}. 
            For each question:
            1. Provide clear key points that should be addressed
            2. Format each question as:
               Question: [question text]
               Key Points: [list of key points]`,
        };
        return prompts[type];
    };

    // Parse response into structured questions
    const parseResponse = (response, type) => {
        const parsers = {
            multiple: (response) =>
                response
                    .split(/\d+\./g)
                    .filter(Boolean)
                    .map((block) => {
                        const [question, ...optionsAndAnswer] = block.trim().split('\n');
                        const options = optionsAndAnswer.slice(0, 4);
                        const correctAnswer = optionsAndAnswer[4]?.match(/Correct: ([A-D])/)?.[1] || '';
                        return { question, options, correctAnswer };
                    }),
            short: (response) =>
                response
                    .split(/\d+\./g)
                    .filter(Boolean)
                    .map((block) => {
                        const [question, answer] = block.split('Answer:').map((s) => s.trim());
                        return { question, expectedAnswer: answer };
                    }),
            long: (response) =>
                response
                    .split(/\d+\./g)
                    .filter(Boolean)
                    .map((block) => {
                        const [question, keyPoints] = block.split('Key Points:').map((s) => s.trim());
                        return { question, keyPoints: keyPoints?.split('\n').map((p) => p.trim()) || [] };
                    }),
        };

        return parsers[type] ? parsers[type](response) : [];
    };

    // Main question generation handler
    const generateQuestions = async () => {
        if (!file) {
            console.error('No file selected');
            setError('Please upload a document first.');
            return;
        }

        console.log('Starting question generation for file:', {
            name: file.name,
            type: file.type,
            size: file.size
        });

        setLoading(true);
        setError('');
        setQuestions([]);
        setProgress(0);

        try {
            console.log('Reading file content...');
            const { content, type } = await readFileContent(file);
            console.log('File content read:', {
                contentLength: content.length,
                type: type
            });

            // Process all files as text since we've already extracted the content
            const questions = await generateQuestionsForChunk(content, questionType);
            if (Array.isArray(questions)) {
                setQuestions(questions);
            }
        } catch (err) {
            console.error("Error in generateQuestions:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    // File upload handler
    const handleFileChange = (e) => {
        const uploadedFile = e.target.files[0];
        if (uploadedFile) {
            console.log('File selected:', {
                name: uploadedFile.name,
                type: uploadedFile.type,
                size: uploadedFile.size
            });
            
            // Check if the file type is supported
            const supportedTypes = [
                'text/plain',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ];
            
            if (!supportedTypes.includes(uploadedFile.type)) {
                console.error('Unsupported file type:', uploadedFile.type);
                setError('Please upload a supported file type (TXT, DOC, DOCX, PDF, or PPTX).');
                setFile(null);
                return;
            }
            
            setFile(uploadedFile);
            setError('');
        }
    };

    const handleAnswerChange = (questionIndex, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionIndex]: answer
        }));
    };

    const calculateScore = (questions, answers) => {
        let correctCount = 0;
        const results = questions.map((q, index) => {
            let isCorrect = false;
            let score = 0;

            if (questionType === 'multiple') {
                // Convert both answers to uppercase for case-insensitive comparison
                const userAnswer = answers[index]?.toUpperCase() || '';
                const correctAnswer = q.correctAnswer?.toUpperCase() || '';
                
                // Log the comparison for debugging
                console.log(`Question ${index + 1}:`, {
                    userAnswer,
                    correctAnswer,
                    isCorrect: userAnswer === correctAnswer
                });
                
                isCorrect = userAnswer === correctAnswer;
                score = isCorrect ? 1 : 0;
            } else if (questionType === 'short') {
                // For short answers, we'll just mark as correct for now
                isCorrect = true;
                score = 1;
            } else if (questionType === 'long') {
                // For long answers, we'll just mark as correct for now
                isCorrect = true;
                score = 1;
            }

            if (isCorrect) correctCount++;
            return {
                question: q.question,
                userAnswer: answers[index] || '',
                correctAnswer: q.correctAnswer || q.expectedAnswer || 'N/A',
                isCorrect,
                score
            };
        });

        const totalScore = correctCount;
        const maxScore = questions.length;
        const percentage = (totalScore / maxScore) * 100;

        return {
            questions: results,
            totalScore,
            maxScore,
            percentage
        };
    };

    const submitQuiz = async () => {
        // Check if all questions are answered
        const unansweredQuestions = questions.filter((_, index) => !userAnswers[index]);
        if (unansweredQuestions.length > 0) {
            setError(`Please answer all questions before submitting. You have ${unansweredQuestions.length} unanswered questions.`);
            return;
        }

        const results = calculateScore(questions, userAnswers);
        setQuizResults(results);
        setShowResults(true);

        // Save results to database
        try {
            await fetch('http://localhost:5000/api/quiz-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    quizType: questionType,
                    sourceFile: file.name,
                    ...results
                })
            });
        } catch (error) {
            console.error('Error saving quiz results:', error);
            setError('Failed to save quiz results. Please try again.');
        }
    };

    const retakeQuiz = () => {
        setShowResults(false);
        setUserAnswers({});
        setQuizResults(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <Router>
            <div className="min-h-screen bg-gray-50">
                {user ? (
                    <div className="flex">
                        {/* Sidebar */}
                        <div className="w-64 bg-white shadow-md h-screen fixed">
                            <div className="p-6">
                                <h1 className="text-2xl font-bold text-indigo-600">Study Guide</h1>
                                <p className="text-gray-600 mt-2">Welcome, {user.name}</p>
                            </div>
                            <nav className="mt-6">
                                <Link
                                    to="/quiz"
                                    className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <Book className="w-5 h-5 mr-3" />
                                    Quiz Generator
                                </Link>
                                <Link
                                    to="/summarizer"
                                    className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <AlignLeft className="w-5 h-5 mr-3" />
                                    Document Summarizer
                                </Link>
                                <Link
                                    to="/performance"
                                    className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <ListChecks className="w-5 h-5 mr-3" />
                                    Performance
                                </Link>
                                <Link
                                to="/notes"
                                className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                            >
                                <AlignLeft className="h-5 w-5 mr-3" />
                                Notes
                            </Link>
                                <Link
                                    to="/flashcards"
                                    className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <BookOpen className="w-5 h-5 mr-3" />
                                    Flashcards
                                </Link>
                                <Link
                                    to="/solve"
                                    className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <Camera className="w-5 h-5 mr-3" />
                                    Image Problem Solver
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
                                >
                                    <MessageSquare className="w-5 h-5 mr-3" />
                                    Logout
                                </button>
                            </nav>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 ml-64">
                            <Routes>
                                <Route path="/quiz" element={<Quiz />} />
                                <Route path="/summarizer" element={<DocumentSummarizer />} />
                                <Route path="/performance" element={<PerformanceDashboard userId={user.id} />} />
                                <Route path="/notes" element={<Notes />} />
                                <Route
                                    path="/flashcards"
                                    element={
                                        <div className="p-6 space-y-6">
                                <FlashcardsPage token={user.token} />
                                <DocumentFlashcardGenerator token={user.token} />
                                        </div>
                                    }
                                />
                                <Route path="/solve" element={<ImageProblemSolver />} />
                                <Route path="/" element={<Navigate to="/quiz" replace />} />
                            </Routes>
                        </div>
                    </div>
                ) : (
                    <Routes>
                        <Route path="/login" element={<Login onLogin={handleLogin} />} />
                        <Route path="/register" element={<Register onRegister={handleLogin} />} />
                        <Route path="/" element={<Navigate to="/login" replace />} />
                    </Routes>
                )}
            </div>
        </Router>
    );
};

export default App;