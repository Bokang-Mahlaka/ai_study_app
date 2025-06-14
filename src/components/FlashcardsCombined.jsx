import React, { useState, useEffect } from 'react';
import { Plus, ArrowLeft, RotateCw, BookOpen, Check, X } from 'lucide-react';
import '../Flashcard.css';

const FlashcardsCombined = ({ token }) => {
    const [flashcards, setFlashcards] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Form state
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [flashcardInputs, setFlashcardInputs] = useState([{ question: '', answer: '' }]);

    // UI state
    const [selectedTitle, setSelectedTitle] = useState(null);
    const [flippedIds, setFlippedIds] = useState(new Set());
    const [activeTab, setActiveTab] = useState('view'); // 'view' or 'create'

    // Fetch flashcards from backend
    const fetchFlashcards = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('http://localhost:5000/api/flashcards', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch flashcards');
            }
            const data = await response.json();
            setFlashcards(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlashcards();
    }, []);

    // Remove DocumentFlashcardGenerator integration: no code for file upload or generate tab

    // Add new flashcard to state
    const handleFlashcardAdded = (newFlashcard) => {
        setFlashcards(prev => [newFlashcard, ...prev]);
    };

    // Toggle flip state of a flashcard
    const toggleFlip = (id) => {
        setFlippedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Form handlers
    const handleTitleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) {
            setError('Title is required.');
            return;
        }
        setStep(2);
    };

    const handleFlashcardSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate all flashcard inputs
        for (const input of flashcardInputs) {
            if (!input.question.trim() || !input.answer.trim()) {
                setError('All questions and answers are required.');
                return;
            }
        }

        setLoading(true);
        try {
            // Submit all flashcards in one or multiple API calls
            const responses = await Promise.all(
                flashcardInputs.map(input =>
                    fetch('http://localhost:5000/api/flashcards', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ title, question: input.question, answer: input.answer })
                    })
                )
            );

            for (const response of responses) {
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to add flashcard');
                }
            }

            const newFlashcards = await Promise.all(responses.map(res => res.json()));

            // Add all new flashcards to state
            newFlashcards.forEach(flashcard => handleFlashcardAdded(flashcard));

            // Reset form
            setFlashcardInputs([{ question: '', answer: '' }]);
            setActiveTab('view');
            setStep(1);
            setTitle('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToTitle = () => {
        setStep(1);
        setQuestion('');
        setAnswer('');
        setError('');
    };

    // Group flashcards by title
    const groupedFlashcards = flashcards.reduce((groups, card) => {
        if (!groups[card.title]) {
            groups[card.title] = [];
        }
        groups[card.title].push(card);
        return groups;
    }, {});

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-3 mb-3">
                    <BookOpen className="h-8 w-8 text-indigo-600" />
                    <h1 className="text-3xl font-bold text-gray-900">Flashcard Genius</h1>
                </div>
                <p className="text-lg text-gray-600">Master your knowledge with interactive flashcards</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button
                        onClick={() => setActiveTab('view')}
                        className={`px-6 py-3 text-sm font-medium rounded-l-lg ${
                            activeTab === 'view'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        View Flashcards
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-6 py-3 text-sm font-medium rounded-r-lg ${
                            activeTab === 'create'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Create New
                    </button>
                </div>
            </div>

            {/* Create Flashcard Form */}
            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto mb-10">
                    <div className="p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {step === 1 ? 'Create New Module' : `Add to "${title}"`}
                            </h2>
                            <div className="flex items-center space-x-2">
                                <span className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 flex items-start">
                                <X className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <form onSubmit={handleTitleSubmit}>
                                <div className="mb-6">
                                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                        Module Title
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. Biology 101, French Vocabulary"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Continue
                                        <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 2 && (
                            <form onSubmit={handleFlashcardSubmit}>
                                {flashcardInputs.map((input, index) => (
                                    <div key={index} className="mb-6 border-b border-gray-200 pb-6">
                                        <label htmlFor={`question-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                                            Question {index + 1}
                                        </label>
                                        <textarea
                                            id={`question-${index}`}
                                            value={input.question}
                                            onChange={(e) => {
                                                const newInputs = [...flashcardInputs];
                                                newInputs[index].question = e.target.value;
                                                setFlashcardInputs(newInputs);
                                            }}
                                            rows={3}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter your question..."
                                            required
                                        />
                                        <label htmlFor={`answer-${index}`} className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                                            Answer {index + 1}
                                        </label>
                                        <textarea
                                            id={`answer-${index}`}
                                            value={input.answer}
                                            onChange={(e) => {
                                                const newInputs = [...flashcardInputs];
                                                newInputs[index].answer = e.target.value;
                                                setFlashcardInputs(newInputs);
                                            }}
                                            rows={3}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter the answer..."
                                            required
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => setFlashcardInputs([...flashcardInputs, { question: '', answer: '' }])}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        <Plus className="-ml-1 mr-2 h-5 w-5" />
                                        Add Another Flashcard
                                    </button>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleBackToTitle}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-4"
                                        >
                                            <ArrowLeft className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                                            Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                                                loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                                            }`}
                                        >
                                            {loading ? (
                                                <>
                                                    <RotateCw className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                                    Adding...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="-ml-1 mr-3 h-5 w-5" />
                                                    Add Flashcards
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* View Flashcards */}
            {activeTab === 'view' && (
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <RotateCw className="mx-auto h-12 w-12 text-indigo-600 animate-spin" />
                            <p className="mt-4 text-lg text-gray-600">Loading your flashcards...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg mb-8">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <X className="h-5 w-5 text-red-400" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {!selectedTitle && (
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Flashcard Modules</h2>
                                    {Object.keys(groupedFlashcards).length === 0 ? (
                                        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                                            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                                            <h3 className="mt-4 text-lg font-medium text-gray-900">No flashcards yet</h3>
                                            <p className="mt-2 text-gray-500">Create your first flashcard module to get started!</p>
                                            <button
                                                onClick={() => setActiveTab('create')}
                                                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            >
                                                <Plus className="-ml-1 mr-2 h-5 w-5" />
                                                Create Module
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {Object.keys(groupedFlashcards).map(title => (
                                                <div 
                                                    key={title} 
                                                    className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                                                    onClick={() => setSelectedTitle(title)}
                                                >
                                                    <div className="p-6">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-lg font-medium text-gray-900 truncate">{title}</h3>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                                {groupedFlashcards[title].length} cards
                                                            </span>
                                                        </div>
                                                        <div className="mt-4 flex items-center text-sm text-gray-500">
                                                            <Check className="flex-shrink-0 mr-1.5 h-5 w-5 text-green-500" />
                                                            <p>Ready to study</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {selectedTitle && (
                                <div>
                                    <button
                                        onClick={() => setSelectedTitle(null)}
                                        className="mb-6 inline-flex items-center text-indigo-600 hover:text-indigo-800"
                                    >
                                        <ArrowLeft className="mr-2 h-5 w-5" />
                                        Back to Modules
                                    </button>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{selectedTitle}</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedFlashcards[selectedTitle].map(card => (
                                            <div
                                                key={card._id}
                                                onClick={() => toggleFlip(card._id)}
                                                className={`cursor-pointer h-48 perspective-1000 group`}
                                            >
                                                <div className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
                                                    flippedIds.has(card._id) ? 'rotate-y-180' : ''
                                                }`}>
                                                    {/* Front of card */}
                                                    <div className={`absolute w-full h-full backface-hidden rounded-xl p-6 shadow-md flex flex-col justify-center ${
                                                        flippedIds.has(card._id) ? 'bg-indigo-50' : 'bg-white'
                                                    }`}>
                                                        <div className="text-sm font-medium text-indigo-600 mb-2">Question</div>
                                                        <p className="text-lg font-medium text-gray-900 line-clamp-4">{card.question}</p>
                                                        <div className="mt-auto pt-2 text-xs text-gray-500">Click to reveal answer</div>
                                                    </div>
                                                    
                                                    {/* Back of card */}
                                                    <div className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl p-6 shadow-md flex flex-col justify-center bg-indigo-100`}>
                                                        <div className="text-sm font-medium text-indigo-600 mb-2">Answer</div>
                                                        <p className="text-lg font-medium text-gray-900 line-clamp-4">{card.answer}</p>
                                                        <div className="mt-auto pt-2 text-xs text-indigo-500">Click to flip back</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FlashcardsCombined;