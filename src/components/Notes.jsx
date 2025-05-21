import React, { useState, useEffect } from 'react';

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [heading, setHeading] = useState('');
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/notes', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch notes');
            }
            const data = await response.json();
            setNotes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    const resetForm = () => {
        setHeading('');
        setContent('');
        setEditingId(null);
        setError('');
    };

    const handleSave = async () => {
        if (!heading.trim() || !content.trim()) {
            setError('Heading and content are required');
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId ? `http://localhost:5000/api/notes/${editingId}` : 'http://localhost:5000/api/notes';
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ heading, content })
            });
            if (!response.ok) {
                throw new Error('Failed to save note');
            }
            await fetchNotes();
            resetForm();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (note) => {
        setHeading(note.heading);
        setContent(note.content);
        setEditingId(note._id);
        setError('');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/notes/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to delete note');
            }
            await fetchNotes();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4 text-indigo-600">Notes</h2>
            {error && <div className="mb-4 text-red-600">{error}</div>}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Heading"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                    className="w-full p-2 mb-2 border border-gray-300 rounded"
                />
                <textarea
                    placeholder="Write your note here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="w-full p-2 border border-gray-300 rounded"
                />
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {editingId ? 'Update Note' : 'Save Note'}
                </button>
                {editingId && (
                    <button
                        onClick={resetForm}
                        disabled={loading}
                        className="mt-2 ml-2 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                )}
            </div>
            <div>
                {loading && <p>Loading...</p>}
                {!loading && notes.length === 0 && <p>No notes found.</p>}
                <ul>
                    {notes.map((note) => (
                        <li key={note._id} className="mb-4 p-4 border border-gray-200 rounded shadow-sm">
                            <h3 className="text-lg font-semibold text-indigo-600">{note.heading}</h3>
                            <p className="whitespace-pre-wrap">{note.content}</p>
                            <div className="mt-2">
                                <button
                                    onClick={() => handleEdit(note)}
                                    className="mr-2 px-3 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(note._id)}
                                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Notes;
