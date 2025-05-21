import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ImageProblemSolver = () => {
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [solution, setSolution] = useState(null);
    const videoRef = useRef(null);
    const navigate = useNavigate();

    // Handle file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('File size should be less than 5MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setError('Please upload an image file');
                return;
            }
            processImage(file);
        }
    };

    // Process and optimize image
    const processImage = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions while maintaining aspect ratio
                let width = img.width;
                let height = img.height;
                const maxDimension = 1200;
                
                if (width > height && width > maxDimension) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;
                
                // Draw and optimize image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to optimized JPEG
                canvas.toBlob(
                    (blob) => {
                        const optimizedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        setImage(optimizedFile);
                        setPreview(URL.createObjectURL(blob));
                        setError('');
                    },
                    'image/jpeg',
                    0.8 // Quality parameter (0.8 = 80% quality)
                );
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Handle camera capture
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
        } catch (err) {
            setError('Error accessing camera: ' + err.message);
        }
    };

    const captureImage = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        
        canvas.toBlob(
            (blob) => {
                const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                processImage(file);
                stopCamera();
            },
            'image/jpeg',
            0.8
        );
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!image) {
            setError('Please upload or capture an image');
            return;
        }

        setLoading(true);
        setError('');
        setSolution(null);

        try {
            const formData = new FormData();
            formData.append('image', image);

            const response = await fetch('http://localhost:5000/api/solve-problem', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to process image');
            }

            if (!data.solution) {
                throw new Error('No solution was provided');
            }

            setSolution(data.solution);
        } catch (err) {
            setError(err.message);
            console.error('Error processing image:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6">Solve Problems with Images</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Upload Section */}
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                        />
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer block"
                        >
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <p className="mt-1 text-sm text-gray-600">
                                Click to upload an image
                            </p>
                        </label>
                    </div>

                    {/* Camera Section */}
                    <div className="space-y-4">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full rounded-lg hidden"
                        />
                        <div className="flex space-x-4">
                            <button
                                onClick={startCamera}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Start Camera
                            </button>
                            <button
                                onClick={captureImage}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                Capture
                            </button>
                            <button
                                onClick={stopCamera}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Stop Camera
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview && (
                        <div className="mt-4">
                            <img
                                src={preview}
                                alt="Preview"
                                className="max-w-full h-auto rounded-lg"
                            />
                        </div>
                    )}
                </div>

                {/* Solution Section */}
                <div className="space-y-4">
                    <form onSubmit={handleSubmit}>
                        <button
                            type="submit"
                            disabled={loading || !image}
                            className={`w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 ${
                                (loading || !image) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </span>
                            ) : 'Solve Problem'}
                        </button>
                    </form>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {solution && (
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-2">Solution:</h3>
                            <div className="prose max-w-none whitespace-pre-wrap">
                                {solution}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageProblemSolver; 