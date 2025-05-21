import React, { useState } from 'react';

const FlashcardForm = ({ token, onFlashcardAdded }) => {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
        if (!question.trim() || !answer.trim()) {
            setError('Both question and answer are required.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, question, answer })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add flashcard');
            }
            const newFlashcard = await response.json();
            setQuestion('');
            setAnswer('');
            if (onFlashcardAdded) {
                onFlashcardAdded(newFlashcard);
            }
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

    return (
        <>
            {step === 1 && (
                <form onSubmit={handleTitleSubmit} className="max-w-md mx-auto p-4 bg-white rounded shadow">
                    <h2 className="text-xl font-semibold mb-4">Enter Module Title</h2>
                    {error && <p className="text-red-600 mb-2">{error}</p>}
                    <div className="mb-4">
                        <label className="block mb-1 font-medium">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 px-4 rounded text-white font-semibold bg-indigo-600 hover:bg-indigo-700"
                    >
                        Next
                    </button>
                </form>
            )}
            {step === 2 && (
                <form onSubmit={handleFlashcardSubmit} className="max-w-md mx-auto p-4 bg-white rounded shadow">
                    <h2 className="text-xl font-semibold mb-4">Add Flashcard under "{title}"</h2>
                    {error && <p className="text-red-600 mb-2">{error}</p>}
                    <div className="mb-4">
                        <label className="block mb-1 font-medium">Question</label>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded p-2"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1 font-medium">Answer</label>
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded p-2"
                            required
                        />
                    </div>
                    <div className="flex justify-between">
                        <button
                            type="button"
                            onClick={handleBackToTitle}
                            className="py-2 px-4 rounded text-white font-semibold bg-gray-600 hover:bg-gray-700"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`py-2 px-4 rounded text-white font-semibold ${
                                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {loading ? 'Adding...' : 'Add Flashcard'}
                        </button>
                    </div>
                </form>
            )}
        </>
    );
};

export default FlashcardForm;
