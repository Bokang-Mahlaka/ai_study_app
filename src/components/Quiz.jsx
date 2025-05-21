import React, { useState } from 'react';
import { Upload, ListChecks, AlignLeft, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const Quiz = ({ userId }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [questionType, setQuestionType] = useState('multiple');
    const [error, setError] = useState('');
    const [userAnswers, setUserAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [quizResults, setQuizResults] = useState(null);

    // Read uploaded file content
    const readFileContent = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    let content = '';
                    const fileType = file.type;

                    if (fileType === 'application/pdf') {
                        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            content += textContent.items.map(item => item.str).join(' ') + '\n';
                        }
                    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                             fileType === 'application/msword') {
                        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
                        content = result.value;
                    } else if (fileType === 'text/plain') {
                        content = e.target.result;
                    } else {
                        throw new Error('Unsupported file type');
                    }

                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError('');
        }
    };

    const generateQuestions = async () => {
        if (!file) return;

        setLoading(true);
        setError('');

        try {
            const content = await readFileContent(file);
            const prompt = generatePrompt(content, questionType);

            const response = await fetch('http://localhost:5000/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ prompt, fileContent: content })
            });

            if (!response.ok) {
                throw new Error('Failed to generate questions');
            }

            const data = await response.json();
            const parsedQuestions = parseResponse(data.candidates[0].content.parts[0].text, questionType);
            setQuestions(parsedQuestions);
            setUserAnswers({});
            setShowResults(false);
            setQuizResults(null);
        } catch (err) {
            setError(err.message);
            console.error('Error generating questions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (index, value) => {
        setUserAnswers(prev => ({
            ...prev,
            [index]: value
        }));
    };

    const calculateScore = () => {
        let totalScore = 0;
        const maxScore = questions.length;
        const questionResults = questions.map((q, index) => {
            const userAnswer = userAnswers[index]?.toLowerCase() || '';
            const correctAnswer = q.correctAnswer?.toLowerCase() || '';
            const isCorrect = userAnswer === correctAnswer;
            if (isCorrect) totalScore++;

            return {
                question: q.question,
                userAnswer: userAnswers[index] || 'Not answered',
                correctAnswer: q.correctAnswer,
                isCorrect
            };
        });

        return {
            totalScore,
            maxScore,
            percentage: (totalScore / maxScore) * 100,
            questions: questionResults
        };
    };

    const submitQuiz = async () => {
        const unansweredQuestions = questions.filter((_, index) => !userAnswers[index]);
        if (unansweredQuestions.length > 0) {
            setError(`Please answer all questions before submitting. You have ${unansweredQuestions.length} unanswered questions.`);
            return;
        }

        const results = calculateScore();
        setQuizResults(results);
        setShowResults(true);

        try {
            await fetch('http://localhost:5000/api/quiz-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userId,
                    quizType: questionType,
                    sourceFile: file.name,
                    totalScore: results.totalScore,
                    maxScore: results.maxScore,
                    percentage: results.percentage,
                    questions: results.questions
                })
            });
        } catch (err) {
            console.error('Error saving quiz results:', err);
            setError('Failed to save quiz results. Please try again.');
        }
    };

    const retakeQuiz = () => {
        setQuestions([]);
        setUserAnswers({});
        setShowResults(false);
        setQuizResults(null);
    };

    const generatePrompt = (content, type) => {
        const basePrompt = `Based on the following content, generate 5 questions. Content: ${content}\n\n`;
        
        switch (type) {
            case 'multiple':
                return `${basePrompt}Generate 5 multiple-choice questions with 4 options (A-D) each. Format each question as follows:
                Question 1: [Question text]
                A) [Option A]
                B) [Option B]
                C) [Option C]
                D) [Option D]
                Correct: [A/B/C/D]
                
                [Blank line between questions]`;
            
            case 'short':
                return `${basePrompt}Generate 5 short-answer questions. Format each question as follows:
                Question 1: [Question text]
                Answer: [Expected answer]
                
                [Blank line between questions]`;
            
            case 'long':
                return `${basePrompt}Generate 5 essay questions. Format each question as follows:
                Question 1: [Question text]
                Key points to address:
                - [Point 1]
                - [Point 2]
                - [Point 3]
                
                [Blank line between questions]`;
            
            default:
                return basePrompt;
        }
    };

    const parseResponse = (response, type) => {
        const questions = response.split('\n\n').filter(q => q.trim());
        return questions.map(q => {
            const lines = q.split('\n').filter(line => line.trim());
            const questionText = lines[0].replace(/^Question \d+:\s*/, '');
            
            switch (type) {
                case 'multiple':
                    const options = lines.slice(1, 5).map(line => line.replace(/^[A-D]\)\s*/, ''));
                    const correctAnswer = lines[5]?.replace(/^Correct:\s*/, '') || '';
                    return { question: questionText, options, correctAnswer };
                
                case 'short':
                    const answer = lines[1]?.replace(/^Answer:\s*/, '') || '';
                    return { question: questionText, correctAnswer: answer };
                
                case 'long':
                    const keyPoints = lines.slice(1).map(line => line.replace(/^-\s*/, ''));
                    return { question: questionText, keyPoints };
                
                default:
                    return { question: questionText };
            }
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* File Upload Section */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Study Material
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                    <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                                <span>Upload a file</span>
                                <input
                                    type="file"
                                    className="sr-only"
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.txt"
                                />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                            PDF, DOC, DOCX, or TXT up to 10MB
                        </p>
                        {file && (
                            <p className="text-sm text-green-500">
                                Selected file: {file.name}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Question Type Selection */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Question Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => setQuestionType('multiple')}
                        className={`p-4 rounded-lg border ${
                            questionType === 'multiple'
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200'
                        } hover:border-indigo-600 transition-colors`}
                    >
                        <ListChecks className="h-6 w-6 mx-auto mb-2" />
                        <span className="block text-sm font-medium">Multiple Choice</span>
                    </button>
                    <button
                        onClick={() => setQuestionType('short')}
                        className={`p-4 rounded-lg border ${
                            questionType === 'short'
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200'
                        } hover:border-indigo-600 transition-colors`}
                    >
                        <AlignLeft className="h-6 w-6 mx-auto mb-2" />
                        <span className="block text-sm font-medium">Short Answer</span>
                    </button>
                    <button
                        onClick={() => setQuestionType('long')}
                        className={`p-4 rounded-lg border ${
                            questionType === 'long'
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200'
                        } hover:border-indigo-600 transition-colors`}
                    >
                        <MessageSquare className="h-6 w-6 mx-auto mb-2" />
                        <span className="block text-sm font-medium">Long Answer</span>
                    </button>
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={generateQuestions}
                disabled={loading || !file}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    loading || !file
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
                {loading ? 'Generating Questions...' : 'Generate Questions'}
            </button>

            {/* Error Message */}
            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Questions Display */}
            {questions.length > 0 && !showResults && (
                <div className="mt-8">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Questions</h2>
                    <div className="space-y-6">
                        {questions.map((q, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                                <div className="p-4">
                                    <p className="text-base font-medium text-gray-900 mb-3">
                                        {index + 1}. {q.question}
                                    </p>
                                    {questionType === 'multiple' && (
                                        <div className="space-y-2 pl-4">
                                            {q.options.map((option, i) => (
                                                <div key={i} className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name={`question-${index}`}
                                                        value={String.fromCharCode(65 + i)}
                                                        checked={userAnswers[index] === String.fromCharCode(65 + i)}
                                                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <label className="ml-3 text-sm text-gray-700">
                                                        {option}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {questionType === 'short' && (
                                        <textarea
                                            className="w-full mt-2 p-2 border border-gray-300 rounded-md"
                                            rows="3"
                                            placeholder="Enter your answer..."
                                            value={userAnswers[index] || ''}
                                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                                        />
                                    )}
                                    {questionType === 'long' && (
                                        <textarea
                                            className="w-full mt-2 p-2 border border-gray-300 rounded-md"
                                            rows="6"
                                            placeholder="Enter your detailed answer..."
                                            value={userAnswers[index] || ''}
                                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={submitQuiz}
                        disabled={loading || !file || questions.length === 0 || Object.keys(userAnswers).length !== questions.length}
                        className={`mt-4 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                            loading || !file || questions.length === 0 || Object.keys(userAnswers).length !== questions.length
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                    >
                        {Object.keys(userAnswers).length !== questions.length 
                            ? `Answer all ${questions.length} questions to submit`
                            : 'Submit Quiz'}
                    </button>
                </div>
            )}

            {/* Quiz Results */}
            {showResults && quizResults && (
                <div className="mt-8">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Quiz Results</h2>
                    <div className="bg-green-50 p-4 rounded-lg mb-4">
                        <p className="text-lg font-semibold text-green-800">
                            Score: {quizResults.totalScore}/{quizResults.maxScore} ({quizResults.percentage.toFixed(1)}%)
                        </p>
                    </div>
                    <div className="space-y-4">
                        {quizResults.questions.map((q, index) => (
                            <div key={index} className={`p-4 rounded-lg ${q.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className="font-medium mb-2">Question {index + 1}: {q.question}</p>
                                <div className="mt-2 space-y-2">
                                    <p className="text-sm">
                                        <span className="font-medium">Your answer: </span>
                                        <span className={q.isCorrect ? 'text-green-700' : 'text-red-700'}>
                                            {q.userAnswer || 'Not answered'}
                                        </span>
                                    </p>
                                    <p className="text-sm">
                                        <span className="font-medium">Correct answer: </span>
                                        <span className="text-green-700">{q.correctAnswer}</span>
                                    </p>
                                    <p className={`text-sm font-medium ${q.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                        {q.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={retakeQuiz}
                        className="mt-4 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Retake Quiz
                    </button>
                </div>
            )}
        </div>
    );
};

export default Quiz; 