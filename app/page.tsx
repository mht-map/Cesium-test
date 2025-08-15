'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative">
      {/* Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Optimise</h1>
            </div>
            <div className="flex space-x-8">
              <Link 
                href="/" 
                className="text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Home
              </Link>
              <Link 
                href="/map" 
                className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Map
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Sage Green Background */}
      <div className="pt-16 min-h-screen" style={{ backgroundColor: '#9CAF88' }}>
        {/* Content can be added here if needed */}
      </div>
    </div>
  );
}
