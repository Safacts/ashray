import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Search, Loader2, User, Phone, FileText, MessageCircle, ChevronDown, ChevronUp, Calendar, PhoneCall, FileDown, Image as ImageIcon, LogOut, CheckCircle, XCircle, Eye, IndianRupee, Edit2, TrendingUp, Users, Wallet, Upload, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';

// Helper function to convert image URL to Base64 for jsPDF
const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; 
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/jpeg');
      resolve(dataURL);
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // Data States
  const [students, setStudents] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostelName, setHostelName] = useState('');
  const [currentFee, setCurrentFee] = useState(3000); // Default fee state
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [stats, setStats] = useState({ totalRevenue: 0, collectedThisMonth: 0 });
  
  // UI States
  const [activeTab, setActiveTab] = useState('analytics'); // Default to the new dashboard view
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // 1. Authentication & Data Fetching
  const fetchDashboardData = async () => {
    setLoading(true);
    const hostelId = localStorage.getItem('admin_hostel_id');
    
    if (!hostelId) {
      navigate('/login');
      return;
    }

    try {
      // Fetch Hostel Name, Default Fee & QR
      const { data: hostelData } = await supabase.from('hostels').select('name, default_fee, qr_code_url').eq('id', hostelId).single();
      if (hostelData) {
        setHostelName(hostelData.name);
        setCurrentFee(hostelData.default_fee || 3000);
        setQrCodeUrl(hostelData.qr_code_url);
      }

      // Fetch Students
      const { data: studentsData, error: stuError } = await supabase
        .from('students')
        .select('*')
        .eq('hostel_id', hostelId)
        .order('created_at', { ascending: false });
      if (stuError) throw stuError;
      setStudents(studentsData);

      // Fetch Pending Payments with Student Info joined
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select(`
          *,
          students!inner ( id, full_name, room_number, hostel_id )
        `)
        .eq('status', 'pending')
        .eq('students.hostel_id', hostelId)
        .order('created_at', { ascending: false });
      if (payError) throw payError;
      setPendingPayments(payData);

      // Calculate Financials
      const { data: revenueData } = await supabase
        .from('payments')
        .select('amount, created_at, students!inner(hostel_id)')
        .eq('status', 'success')
        .eq('students.hostel_id', hostelId);

      if (revenueData) {
        const total = revenueData.reduce((sum, txn) => sum + (txn.amount || 0), 0);
        const currentMonth = new Date().getMonth();
        const monthly = revenueData
          .filter(txn => new Date(txn.created_at).getMonth() === currentMonth)
          .reduce((sum, txn) => sum + (txn.amount || 0), 0);
        setStats({ totalRevenue: total, collectedThisMonth: monthly });
      }

    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  // --- NEW: Analytics & Admin Controls ---
  const handleUpdateFee = async () => {
    const newFee = prompt("Enter new default monthly fee (₹):", currentFee);
    if (!newFee || isNaN(newFee)) return;
    
    const hostelId = localStorage.getItem('admin_hostel_id');
    const { error } = await supabase.from('hostels').update({ default_fee: parseInt(newFee) }).eq('id', hostelId);
    
    if (!error) {
      setCurrentFee(parseInt(newFee));
      toast.success('Default fee updated!');
    } else {
      toast.error('Failed to update fee');
    }
  };

  const handleUpdateStudentFee = async (e, studentId, currentVal) => {
    e.stopPropagation(); // Prevent the accordion from opening
    const newFee = prompt("Enter CUSTOM fee for this student (₹):", currentVal || currentFee);
    if (!newFee || isNaN(newFee)) return;

    const { error } = await supabase.from('students').update({ monthly_fee: parseInt(newFee) }).eq('id', studentId);
    if (!error) {
      toast.success('Student fee updated');
      fetchDashboardData();
    } else {
      toast.error('Failed to update');
    }
  };

  const handleUploadQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const toastId = toast.loading("Uploading QR Code...");

    try {
      const fileName = `qr-${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from('hostel-assets').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('hostel-assets').getPublicUrl(fileName);
      
      const hostelId = localStorage.getItem('admin_hostel_id');
      await supabase.from('hostels').update({ qr_code_url: publicUrl }).eq('id', hostelId);
      
      setQrCodeUrl(publicUrl);
      toast.success("QR Code Updated!", { id: toastId });
    } catch (error) {
      toast.error("Upload failed", { id: toastId });
    }
  };

  // --- Payment Approval Logic ---
  const handleApprovePayment = async (payment) => {
    const toastId = toast.loading('Approving payment...');
    try {
      const { error: payError } = await supabase.from('payments').update({ status: 'success' }).eq('id', payment.id);
      if (payError) throw payError;

      const today = new Date().toISOString().split('T')[0];
      const { error: stuError } = await supabase.from('students').update({ last_paid_date: today }).eq('id', payment.students.id);
      if (stuError) throw stuError;

      toast.success('Payment Approved & Date Updated!', { id: toastId });
      fetchDashboardData(); 
    } catch (error) {
      toast.error('Failed to approve payment', { id: toastId });
    }
  };

  const handleRejectPayment = async (paymentId) => {
    if (!confirm('Are you sure you want to reject this payment?')) return;
    const toastId = toast.loading('Rejecting payment...');
    try {
      const { error } = await supabase.from('payments').update({ status: 'rejected' }).eq('id', paymentId);
      if (error) throw error;
      toast.success('Payment Rejected', { id: toastId });
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to reject payment', { id: toastId });
    }
  };

  // --- Utility Functions ---
  const handleLogout = () => {
    localStorage.removeItem('admin_hostel_id');
    navigate('/login');
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

    return { nextBillDate: nextBill.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), daysLeft, statusColor, riskLevel };
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

  const handleDownloadPDF = async (student, bill) => {
    const toastId = toast.loading('Generating Profile PDF...');
    try {
      const doc = new jsPDF();
      const indigo = [79, 70, 229]; 
      const textGray = [55, 65, 81];
      
      doc.setFillColor(...indigo);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(hostelName.toUpperCase() || 'ASHRAY HOSTEL', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Official Student Profile', 105, 30, { align: 'center' });

      if (student.photo_url) {
        try {
          const imgData = await getBase64ImageFromURL(student.photo_url);
          doc.addImage(imgData, 'JPEG', 150, 50, 40, 40);
          doc.setDrawColor(200, 200, 200);
          doc.rect(150, 50, 40, 40);
        } catch (imgError) {
          console.warn("Could not load image for PDF:", imgError);
        }
      }

      doc.setTextColor(...textGray);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Personal Details', 20, 60);
      doc.setDrawColor(229, 231, 235);
      doc.line(20, 63, 140, 63); 

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const startY = 75;
      const gap = 12;
      
      doc.text(`Full Name: ${student.full_name}`, 20, startY);
      doc.text(`Room Number: ${student.room_number}`, 20, startY + gap);
      doc.text(`Mobile Number: ${student.mobile_number}`, 20, startY + gap * 2);
      doc.text(`Email Address: ${student.email || 'Not Provided'}`, 20, startY + gap * 3);
      doc.text(`Aadhar Number: ${student.adhar_number || 'Not Provided'}`, 20, startY + gap * 4);
      
      const addressLines = doc.splitTextToSize(`Permanent Address: ${student.address || 'Not Provided'}`, 170);
      doc.text(addressLines, 20, startY + gap * 5);

      const billingY = Math.max(startY + gap * 5 + (addressLines.length * 7) + 15, 110); 
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Billing Status', 20, billingY);
      doc.line(20, billingY + 3, 190, billingY + 3);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Last Payment Date: ${student.last_paid_date || 'N/A'}`, 20, billingY + 15);
      doc.text(`Next Bill Due Date: ${bill.nextBillDate}`, 20, billingY + 15 + gap);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bill.daysLeft <= 3 ? 220 : 55, bill.daysLeft <= 3 ? 38 : 65, bill.daysLeft <= 3 ? 38 : 81);
      doc.text(`Status: ${bill.daysLeft} Days Remaining`, 20, billingY + 15 + gap * 2);

      doc.setTextColor(156, 163, 175);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Generated automatically by the Ashray Administration System.', 105, 280, { align: 'center' });

      const fileName = `${student.full_name.replace(/\s+/g, '_')}_Profile.pdf`;
      doc.save(fileName);
      window.open(doc.output('bloburl'), '_blank');
      
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) {
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.room_number.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      {/* --- Sticky Header --- */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{hostelName || 'Admin Dashboard'}</h1>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-gray-500">Ashray Management</span>
                  <span className="text-gray-300">•</span>
                  <button onClick={handleUpdateFee} className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                     Std Fee: ₹{currentFee} <Edit2 size={10} />
                  </button>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-full hover:bg-red-100 transition shadow-sm" title="Logout">
                <LogOut size={18} />
              </button>
            </div>

            {/* --- Tabs & Search --- */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('students')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  All Students ({students.length})
                </button>
                <button 
                  onClick={() => setActiveTab('payments')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap relative ${activeTab === 'payments' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Approvals 
                  {pendingPayments.length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full absolute -top-1 -right-1 sm:relative sm:top-auto sm:right-auto">
                      {pendingPayments.length}
                    </span>
                  )}
                </button>
              </div>

              {activeTab === 'students' && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search name or room..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-sm h-full"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="max-w-5xl mx-auto p-4 space-y-3 mt-2">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
        ) : activeTab === 'analytics' ? (
          /* ========================================= */
          /* ANALYTICS & CONTROLS TAB                  */
          /* ========================================= */
          <div className="space-y-6 animate-in fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-indigo-100 text-sm font-medium">Total Revenue</span>
                  <Wallet className="opacity-80" size={20} />
                </div>
                <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
                <div className="text-xs text-indigo-200 mt-1">Lifetime Collection</div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">Active Students</span>
                  <Users className="text-indigo-500" size={20} />
                </div>
                <div className="text-2xl font-bold text-gray-900">{students.length}</div>
                <div className="text-xs text-green-600 mt-1 font-medium">Occupancy Status</div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">This Month</span>
                  <TrendingUp className="text-emerald-500" size={20} />
                </div>
                <div className="text-2xl font-bold text-gray-900">₹{stats.collectedThisMonth.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-1">Revenue</div>
              </div>
            </div>

            {/* QR Code Manager */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0 p-3 bg-gray-50 rounded-xl border border-gray-200">
                 {qrCodeUrl ? (
                   <img src={qrCodeUrl} alt="Payment QR" className="w-32 h-32 object-contain" />
                 ) : (
                   <div className="w-32 h-32 flex flex-col items-center justify-center text-gray-400">
                     <QrCode size={32} />
                     <span className="text-xs mt-2">No QR Uploaded</span>
                   </div>
                 )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-gray-900">Payment QR Code</h3>
                <p className="text-sm text-gray-500 mb-4">Upload your UPI QR code (GPay/PhonePe/Paytm). This will be shown to students as a fallback if the direct payment link fails.</p>
                <label className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:bg-indigo-700 transition shadow-md">
                  <Upload size={16} /> Upload New QR
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadQR} />
                </label>
              </div>
            </div>
          </div>
        ) : activeTab === 'students' ? (
          /* ========================================= */
          /* STUDENTS TAB                              */
          /* ========================================= */
          <>
            {filteredStudents.map((student) => {
              const bill = getBillingDetails(student.last_paid_date);
              const isExpanded = expandedId === student.id;
              const borderColor = bill.riskLevel === 'critical' ? 'border-l-red-500' : bill.riskLevel === 'warning' ? 'border-l-amber-500' : 'border-l-indigo-500';
              const studentFee = student.monthly_fee || currentFee;

              return (
                <div key={student.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${borderColor} border-l-4`}>
                  <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/50" onClick={() => toggleExpand(student.id)}>
                    <div className="relative shrink-0">
                      <img src={student.photo_url || "https://via.placeholder.com/150"} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="Student" />
                      {bill.daysLeft <= 3 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-bold truncate">{student.full_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-gray-200">Room {student.room_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${bill.statusColor}`}>{bill.daysLeft} Days Left</span>
                      </div>
                    </div>
                    
                    {/* Individual Fee Edit Button */}
                    <button 
                      onClick={(e) => handleUpdateStudentFee(e, student.id, studentFee)} 
                      className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-lg font-bold hover:bg-indigo-100 border border-indigo-100 flex items-center gap-1 shadow-sm transition"
                      title="Edit Individual Fee"
                    >
                       ₹{studentFee} <Edit2 size={12} />
                    </button>
                    
                    <button className="text-gray-400">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                  </div>

                  <div className={`bg-gray-50/50 border-t border-gray-100 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 uppercase font-semibold">Next Bill</span>
                          <div className="flex items-center gap-1 font-medium text-gray-700"><Calendar size={14} className="text-indigo-500" />{bill.nextBillDate}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 uppercase font-semibold">Mobile</span>
                          <div className="flex items-center gap-1 font-medium text-gray-700"><Phone size={14} className="text-indigo-500" />{student.mobile_number || '--'}</div>
                        </div>
                        <div className="col-span-2 space-y-1">
                           <span className="text-xs text-gray-400 uppercase font-semibold">Aadhar Number</span>
                           <div className="flex items-center gap-1 font-mono text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 w-fit"><FileText size={14} />{student.adhar_number || 'Not Submitted'}</div>
                        </div>
                        {student.address && (
                          <div className="col-span-2 space-y-1">
                             <span className="text-xs text-gray-400 uppercase font-semibold">Address</span>
                             <div className="font-medium text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200">{student.address}</div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 space-y-2 border-t border-gray-200 mt-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                          <a href={`tel:${student.mobile_number}`} className="bg-blue-50 text-blue-700 border border-blue-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition"><PhoneCall size={16} /> Call</a>
                          <a href={createWhatsAppLink(student, bill)} target="_blank" rel="noreferrer" className="bg-green-50 text-green-700 border border-green-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-100 transition"><MessageCircle size={16} /> WhatsApp</a>
                          <button onClick={() => handleDownloadPDF(student, bill)} className="bg-indigo-50 text-indigo-700 border border-indigo-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-100 transition cursor-pointer"><FileDown size={16} /> PDF Profile</button>
                          <button onClick={() => handleDownloadImage(student.photo_url, student.full_name)} className="bg-white text-gray-700 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition"><ImageIcon size={16} /> Get Photo</button>
                        </div>
                        <button onClick={() => handleDelete(student.id)} className="w-full flex items-center justify-center gap-2 bg-red-50/50 text-red-600 border border-red-100 py-2.5 rounded-xl hover:bg-red-100 transition font-medium"><Trash2 size={16} /> Remove Student</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredStudents.length === 0 && (
               <div className="text-center py-20 text-gray-400">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><User className="w-8 h-8 opacity-40" /></div>
                  <p className="font-medium text-gray-500">No students found</p>
                  <p className="text-sm mt-1">Try adjusting your search criteria.</p>
               </div>
            )}
          </>
        ) : (
          /* ========================================= */
          /* PENDING PAYMENTS TAB                    */
          /* ========================================= */
          <div className="space-y-4">
            {pendingPayments.length === 0 ? (
              <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 border-dashed">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                <p className="font-bold text-gray-600">All caught up!</p>
                <p className="text-sm mt-1">No pending payments to approve.</p>
              </div>
            ) : (
              pendingPayments.map(payment => (
                <div key={payment.id} className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200/60 border-l-4 border-l-amber-400">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    
                    {/* Payment Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                        <IndianRupee size={24} />
                      </div>
                      <div>
                        <h3 className="text-gray-900 font-bold text-lg">{payment.students.full_name}</h3>
                        <p className="text-sm text-gray-500 font-medium">Room {payment.students.room_number} • Txn: {payment.transaction_id}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded-md">Amount: ₹{payment.amount}</span>
                          <span className="text-xs text-gray-400">{new Date(payment.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:items-end justify-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-4">
                      <a 
                        href={payment.proof_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 px-4 rounded-xl font-bold text-sm hover:bg-indigo-100 transition"
                      >
                        <Eye size={16} /> View Proof
                      </a>
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => handleRejectPayment(payment.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white text-red-600 border border-red-200 py-2 px-3 rounded-xl font-bold text-sm hover:bg-red-50 transition"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                        <button 
                          onClick={() => handleApprovePayment(payment)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-emerald-600 text-white py-2 px-4 rounded-xl font-bold text-sm hover:bg-emerald-700 transition shadow-sm"
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}