import React, { useState, useEffect } from 'react';
import FlashcardForm from './FlashcardForm';
import FlashcardList from './FlashcardList';

const FlashcardsPage = ({ token }) => {
    const [flashcards, setFlashcards] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

    // Add new flashcard to state
    const handleFlashcardAdded = (newFlashcard) => {
        setFlashcards(prev => [newFlashcard, ...prev]);
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
        <div className="p-6 space-y-6">
            <FlashcardForm token={token} onFlashcardAdded={handleFlashcardAdded} />
            {loading && <p>Loading flashcards...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && (
                <FlashcardList groupedFlashcards={groupedFlashcards} />
            )}
        </div>
    );
};

export default FlashcardsPage;
