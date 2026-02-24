import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Search, Loader2, User, Phone, FileText, Download, MessageCircle, ChevronDown, ChevronUp, Calendar, Lock, Key } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    // Verify password against Vite environment variable
    if (passwordInput === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast.success('Access Granted');
      fetchStudents(); // Load data only after auth
    } else {
      toast.error('Incorrect Password');
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data);
    } catch (error) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this student?')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) {
      setStudents(students.filter(s => s.id !== id));
      toast.success('Student removed');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getBillingDetails = (lastPaidDateString) => {
    if (!lastPaidDateString) return { nextBillDate: 'N/A', daysLeft: 0, statusColor: 'text-gray-400', riskLevel: 'low' };

    const lastPaid = new Date(lastPaidDateString);
    const nextBill = new Date(lastPaid);
    nextBill.setDate(lastPaid.getDate() + 30);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    nextBill.setHours(0,0,0,0);

    const diffTime = nextBill - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let statusColor = 'text-emerald-600 bg-emerald-50';
    let riskLevel = 'safe'; 

    if (daysLeft <= 3) {
      statusColor = 'text-red-600 bg-red-50';
      riskLevel = 'critical';
    } else if (daysLeft <= 7) {
      statusColor = 'text-amber-600 bg-amber-50';
      riskLevel = 'warning';
    }

    return {
      nextBillDate: nextBill.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      daysLeft,
      statusColor,
      riskLevel
    };
  };

  const handleDownloadImage = async (url, name) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${name.replace(/\s+/g, '_')}_photo.${blob.type.split('/')[1]}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error("Download failed");
    }
  };

  const createWhatsAppLink = (student, billInfo) => {
    if (!student.mobile_number) return '#';
    const message = `Hello ${student.full_name},\nReminder from Ashray Hostel:\nNext Bill Date: ${billInfo.nextBillDate}\nDays Remaining: ${billInfo.daysLeft}\nPlease clear your dues on time.`;
    const number = student.mobile_number.replace(/\D/g, '');
    return `https://wa.me/${number.length === 10 ? '91'+number : number}?text=${encodeURIComponent(message)}`;
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.room_number.includes(searchTerm)
  );

  // --- Auth Guard UI ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
          <div className="text-center mb-6">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-sm text-gray-500 mt-1">Ashray Dashboard Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="password"
                placeholder="Enter Admin Password"
                required
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 font-medium transition-all focus:bg-white"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition-all">
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Dashboard UI ---
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-xs text-gray-500">{students.length} Active Students</p>
              </div>
              <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                Ashray Admin
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search student..." 
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : (
          filteredStudents.map((student) => {
            const bill = getBillingDetails(student.last_paid_date);
            const isExpanded = expandedId === student.id;
            
            const borderColor = bill.riskLevel === 'critical' ? 'border-l-red-500' 
              : bill.riskLevel === 'warning' ? 'border-l-amber-500' 
              : 'border-l-indigo-500';

            return (
              <div 
                key={student.id} 
                className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${borderColor} border-l-4`}
              >
                <div 
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(student.id)}
                >
                  <div className="relative shrink-0">
                    <img 
                      src={student.photo_url || "https://via.placeholder.com/150"} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      alt={student.full_name}
                    />
                    {bill.daysLeft <= 3 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-bold truncate">{student.full_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                        Room {student.room_number}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${bill.statusColor}`}>
                        {bill.daysLeft} Days Left
                      </span>
                    </div>
                  </div>

                  <button className="text-gray-400">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                <div className={`bg-gray-50/50 border-t border-gray-100 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-4 space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-xs text-gray-400 uppercase font-semibold">Next Bill</span>
                        <div className="flex items-center gap-1 font-medium text-gray-700">
                          <Calendar size={14} className="text-indigo-500" />
                          {bill.nextBillDate}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-gray-400 uppercase font-semibold">Mobile</span>
                        <div className="flex items-center gap-1 font-medium text-gray-700">
                          <Phone size={14} className="text-indigo-500" />
                          {student.mobile_number || '--'}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                         <span className="text-xs text-gray-400 uppercase font-semibold">Aadhar Number</span>
                         <div className="flex items-center gap-1 font-mono text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 w-fit">
                            <FileText size={14} />
                            {student.adhar_number || 'Not Submitted'}
                         </div>
                      </div>
                      {/* Optional: Add a display for the newly collected Address here if you want */}
                      {student.address && (
                        <div className="col-span-2 space-y-1">
                           <span className="text-xs text-gray-400 uppercase font-semibold">Address</span>
                           <div className="font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">
                              {student.address}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <a 
                        href={createWhatsAppLink(student, bill)}
                        target="_blank"
                        className="flex-1 bg-green-50 text-green-700 border border-green-200 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-100 transition"
                      >
                        <MessageCircle size={16} /> WhatsApp
                      </a>
                      
                      <button 
                        onClick={() => handleDownloadImage(student.photo_url, student.full_name)}
                        className="flex-1 bg-white text-gray-700 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                      >
                        <Download size={16} /> Photo
                      </button>

                      <button 
                        onClick={() => handleDelete(student.id)}
                        className="w-12 flex items-center justify-center bg-red-50 text-red-500 border border-red-100 rounded-xl hover:bg-red-100 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}

        {!loading && filteredStudents.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>No students found.</p>
          </div>
        )}
      </div>
    </div>
  );
}