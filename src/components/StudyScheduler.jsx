import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Book, Download } from 'lucide-react';

const StudyScheduler = () => {
    const [events, setEvents] = useState([]);
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        subject: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('http://localhost:5000/api/study-events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newEvent)
            });

            if (!response.ok) {
                throw new Error('Failed to create study event');
            }

            const data = await response.json();
            setEvents(prev => [...prev, data]);
            setNewEvent({
                title: '',
                description: '',
                startDate: '',
                endDate: '',
                subject: '',
                notes: ''
            });
            setSuccess('Study event created successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Export to Google Calendar
    const exportToGoogleCalendar = async (event) => {
        try {
            const response = await fetch('http://localhost:5000/api/export/google-calendar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                throw new Error('Failed to export to Google Calendar');
            }

            setSuccess('Event exported to Google Calendar successfully!');
        } catch (err) {
            setError(err.message);
        }
    };

    // Export to Notion
    const exportToNotion = async (event) => {
        try {
            const response = await fetch('http://localhost:5000/api/export/notion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                throw new Error('Failed to export to Notion');
            }

            setSuccess('Event exported to Notion successfully!');
        } catch (err) {
            setError(err.message);
        }
    };

    // Export to Evernote
    const exportToEvernote = async (event) => {
        try {
            const response = await fetch('http://localhost:5000/api/export/evernote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                throw new Error('Failed to export to Evernote');
            }

            setSuccess('Event exported to Evernote successfully!');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6">Study Scheduler</h2>

            {/* Study Event Form */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input
                            type="text"
                            name="title"
                            value={newEvent.title}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Subject</label>
                        <input
                            type="text"
                            name="subject"
                            value={newEvent.subject}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input
                            type="datetime-local"
                            name="startDate"
                            value={newEvent.startDate}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                        <input
                            type="datetime-local"
                            name="endDate"
                            value={newEvent.endDate}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            name="description"
                            value={newEvent.description}
                            onChange={handleChange}
                            rows="3"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea
                            name="notes"
                            value={newEvent.notes}
                            onChange={handleChange}
                            rows="4"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 ${
                            loading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        {loading ? 'Creating...' : 'Create Study Event'}
                    </button>
                </div>
            </form>

            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                    {success}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Study Events List */}
            <div className="bg-white rounded-lg shadow">
                <h3 className="text-lg font-semibold p-4 border-b">Upcoming Study Events</h3>
                <div className="divide-y">
                    {events.map((event, index) => (
                        <div key={index} className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{event.title}</h4>
                                    <p className="text-sm text-gray-600">{event.subject}</p>
                                    <div className="mt-2 flex items-center text-sm text-gray-500">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        <span>
                                            {new Date(event.startDate).toLocaleString()} - 
                                            {new Date(event.endDate).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-700">{event.description}</p>
                                    {event.notes && (
                                        <p className="mt-2 text-sm text-gray-600">{event.notes}</p>
                                    )}
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => exportToGoogleCalendar(event)}
                                        className="p-2 text-gray-600 hover:text-indigo-600"
                                        title="Export to Google Calendar"
                                    >
                                        <Calendar className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => exportToNotion(event)}
                                        className="p-2 text-gray-600 hover:text-indigo-600"
                                        title="Export to Notion"
                                    >
                                        <Book className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => exportToEvernote(event)}
                                        className="p-2 text-gray-600 hover:text-indigo-600"
                                        title="Export to Evernote"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudyScheduler; 