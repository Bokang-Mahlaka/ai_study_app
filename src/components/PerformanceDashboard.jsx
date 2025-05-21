import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const PerformanceDashboard = ({ userId }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5000/api/quiz-stats/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch stats');
                }
                const data = await response.json();
                setStats(data);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-red-800">Error loading performance stats: {error}</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-800">No performance data available yet.</p>
            </div>
        );
    }

    const chartData = {
        labels: stats.recentScores.map(score => 
            new Date(score.date).toLocaleDateString()
        ),
        datasets: [
            {
                label: 'Quiz Scores',
                data: stats.recentScores.map(score => score.score),
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                tension: 0.1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Recent Quiz Performance'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100
            }
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900">Total Quizzes</h3>
                    <p className="text-3xl font-bold text-indigo-600">{stats.totalQuizzes || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900">Average Score</h3>
                    <p className="text-3xl font-bold text-indigo-600">
                        {stats.averageScore ? stats.averageScore.toFixed(1) : '0'}%
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900">Quiz Types</h3>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-600">Multiple Choice: {stats.quizTypeStats?.multiple || 0}</p>
                        <p className="text-sm text-gray-600">Short Answer: {stats.quizTypeStats?.short || 0}</p>
                        <p className="text-sm text-gray-600">Long Answer: {stats.quizTypeStats?.long || 0}</p>
                    </div>
                </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-4 rounded-lg shadow">
                <Line data={chartData} options={chartOptions} />
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-2">
                    {stats.recentScores.map((score, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b">
                            <div>
                                <p className="text-sm font-medium text-gray-900">
                                    {new Date(score.date).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-500">{score.type} Quiz</p>
                            </div>
                            <p className="text-sm font-medium text-indigo-600">{score.score.toFixed(1)}%</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PerformanceDashboard; 