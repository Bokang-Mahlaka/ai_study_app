import React, { useState } from 'react';

const FlashcardList = ({ groupedFlashcards }) => {
    const [selectedTitle, setSelectedTitle] = useState(null);
    const [flippedIds, setFlippedIds] = useState(new Set());

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

    const titles = Object.keys(groupedFlashcards);

    if (titles.length === 0) return <p>No flashcards found.</p>;

    return (
        <div>
            {!selectedTitle && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Flashcard Modules</h2>
                    <ul className="space-y-2">
                        {titles.map(title => (
                            <li key={title} className="flex justify-between items-center border p-3 rounded shadow-sm bg-white">
                                <span>{title}</span>
                                <button
                                    onClick={() => setSelectedTitle(title)}
                                    className="text-indigo-600 hover:underline"
                                >
                                    View Flashcards
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {selectedTitle && (
                <div>
                    <button
                        onClick={() => setSelectedTitle(null)}
                        className="mb-4 text-indigo-600 hover:underline"
                    >
                        &larr; Back to Modules
                    </button>
                    <h2 className="text-xl font-semibold mb-4">Flashcards for "{selectedTitle}"</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {groupedFlashcards[selectedTitle].map(card => (
                            <div
                                key={card._id}
                                onClick={() => toggleFlip(card._id)}
                                className={`cursor-pointer p-4 rounded shadow-md bg-white transition-transform duration-300 ${
                                    flippedIds.has(card._id) ? 'bg-indigo-100' : 'bg-white'
                                }`}
                            >
                                <p className="font-semibold">
                                    {flippedIds.has(card._id) ? card.answer : card.question}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlashcardList;
