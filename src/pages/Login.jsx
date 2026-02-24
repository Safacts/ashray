import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, Lock, Building2, Phone, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState([]);

  // Student Form State
  const [stuMobile, setStuMobile] = useState('');
  const [stuDob, setStuDob] = useState('');
  
  // Admin Form State
  const [adminHostelId, setAdminHostelId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Fetch hostels for the Admin dropdown
  useEffect(() => {
    const fetchHostels = async () => {
      const { data } = await supabase.from('hostels').select('id, name');
      if (data) setHostels(data);
    };
    fetchHostels();
  }, []);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Logic: Find student with matching Mobile AND DOB
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('mobile_number', stuMobile)
        .eq('dob', stuDob)
        .single();

      if (error || !data) throw new Error('Invalid Credentials');
      
      localStorage.setItem('student_user', JSON.stringify(data));
      toast.success(`Welcome, ${data.full_name}!`);
      navigate('/student-dashboard');
    } catch (err) {
      toast.error('Login Failed. Check Mobile & DOB.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (!adminHostelId) {
      toast.error('Please select a hostel');
      return;
    }
    
    // Check against the Environment Variable Password
    if (adminPass === import.meta.env.VITE_ADMIN_PASSWORD) {
      localStorage.setItem('admin_hostel_id', adminHostelId); // Save which hostel is logged in
      toast.success('Admin Access Granted');
      navigate('/admin-dashboard');
    } else {
      toast.error('Incorrect Password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Toggle Header */}
        <div className="flex bg-gray-50/50 border-b border-gray-100 p-2">
          <button 
            onClick={() => setIsAdmin(false)}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${!isAdmin ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <User size={16} /> Student
          </button>
          <button 
            onClick={() => setIsAdmin(true)}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${isAdmin ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <ShieldCheck size={16} /> Admin
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{isAdmin ? 'Hostel Admin' : 'Student Portal'}</h1>
            <p className="text-gray-500 text-sm mt-1">Login to access your dashboard</p>
          </div>

          {!isAdmin ? (
            /* --- STUDENT LOGIN FORM --- */
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type="tel" placeholder="Mobile Number" required
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
                  value={stuMobile} onChange={e => setStuMobile(e.target.value)}
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type="date" required
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all text-gray-600"
                  value={stuDob} onChange={e => setStuDob(e.target.value)}
                />
              </div>
              <button disabled={loading} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black hover:shadow-xl transition-all flex justify-center items-center gap-2">
                {loading ? 'Logging in...' : <>Login <ArrowRight size={18} /></>}
              </button>
            </form>
          ) : (
            /* --- ADMIN LOGIN FORM --- */
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <select 
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all appearance-none text-gray-700"
                  value={adminHostelId} onChange={e => setAdminHostelId(e.target.value)}
                  required
                >
                  <option value="">Select Your Hostel</option>
                  {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type="password" placeholder="Master Password" required
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
                  value={adminPass} onChange={e => setAdminPass(e.target.value)}
                />
              </div>
              <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex justify-center items-center gap-2">
                Access Dashboard <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}