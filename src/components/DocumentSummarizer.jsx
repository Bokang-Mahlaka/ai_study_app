import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

const DocumentSummarizer = () => {
    const [file, setFile] = useState(null);
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setSummary('');
            setError('');
        }
    };

    const readFileContent = async (file) => {
        if (file.type === 'application/pdf') {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                return { content: fullText, type: "text/plain" };
            } catch (error) {
                console.error('Error reading PDF:', error);
                throw new Error('Failed to read PDF file');
            }
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                let text = result.value
                    .replace(/\s+/g, ' ')
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();
                return { content: text, type: "text/plain" };
            } catch (error) {
                console.error('Error reading DOCX:', error);
                throw new Error('Failed to read DOCX file');
            }
        } else {
            try {
                const text = await file.text();
                return { content: text, type: "text/plain" };
            } catch (error) {
                console.error('Error reading file:', error);
                throw new Error('Failed to read file');
            }
        }
    };

    const generateSummary = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setLoading(true);
        setError('');
        setSummary('');

        try {
            const { content } = await readFileContent(file);
            
            const response = await fetch('http://localhost:5000/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', errorText);
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
                throw new Error('Invalid response format from server');
            }

            setSummary(data.candidates[0].content.parts[0].text);
        } catch (err) {
            console.error('Error generating summary:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-6">Document Summarizer</h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Document
                    </label>
                    <div className="flex items-center space-x-4">
                        <input
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-upload"
                        />
                        <label
                            htmlFor="file-upload"
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md cursor-pointer hover:bg-indigo-700"
                        >
                            <Upload className="w-5 h-5 mr-2" />
                            Choose File
                        </label>
                        {file && (
                            <span className="text-sm text-gray-600">
                                {file.name}
                            </span>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <button
                    onClick={generateSummary}
                    disabled={!file || loading}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                        !file || loading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    {loading ? (
                        <div className="flex items-center justify-center">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating Summary...
                        </div>
                    ) : (
                        'Generate Summary'
                    )}
                </button>

                {summary && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Summary</h3>
                        <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap">
                            {summary}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentSummarizer; 