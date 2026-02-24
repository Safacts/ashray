import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Home, LogIn, UserPlus, Building2 } from 'lucide-react'; // Changed BuildingPlus to Building2

import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentRegister from './components/forms/StudentRegister';
import HostelRegister from './components/forms/HostelRegister';
import Footer from './components/ui/Footer';

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full flex flex-col bg-gray-50 font-sans">
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff' } }} />
        
        <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm sticky top-0 z-50">
          <div className="container mx-auto flex items-center justify-between">
            
            <Link to="/login" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition">
                <Home className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Ashray</h1>
            </Link>

            <div className="flex gap-1 sm:gap-2 bg-gray-100 p-1 rounded-lg overflow-x-auto">
              <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition whitespace-nowrap">
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Login</span>
              </Link>
              
              <Link to="/register-student" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition whitespace-nowrap">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Join Hostel</span>
              </Link>
              
              <Link to="/register-hostel" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition whitespace-nowrap">
                <Building2 className="w-4 h-4" /> {/* Updated Icon */}
                <span className="hidden sm:inline">Add Hostel</span>
              </Link>
            </div>
            
          </div>
        </nav>

        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/register-student" element={<StudentRegister />} />
            <Route path="/register-hostel" element={<HostelRegister />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>

        <Footer />
        
      </div>
    </Router>
  );
}

export default App;