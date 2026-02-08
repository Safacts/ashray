import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Home, LayoutDashboard } from 'lucide-react';
import StudentRegister from './components/forms/StudentRegister';
import AdminDashboard from './pages/AdminDashboard';
// 1. Import Footer
import Footer from './components/ui/Footer';

function App() {
  return (
    <Router>
      {/* Make the app take full height */}
      <div className="min-h-screen w-full flex flex-col bg-gray-50 font-sans">
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff' } }} />
        
        <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm sticky top-0 z-50">
          <div className="container mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition">
                <Home className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Ashray</h1>
            </Link>

            <div className="flex gap-1 sm:gap-4 bg-gray-100 p-1 rounded-lg">
              <Link to="/" className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition">
                Register
              </Link>
              <Link to="/admin" className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        {/* 2. Use flex-1 to push footer to bottom */}
        <main className="flex-1 container mx-auto">
          <Routes>
            <Route path="/" element={<StudentRegister />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>

        {/* 3. Add Footer here */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;