import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Search, Loader2, User, Phone, FileText, MessageCircle, ChevronDown, ChevronUp, Calendar, PhoneCall, FileDown, Image as ImageIcon, LogOut, CheckCircle, XCircle, Eye, IndianRupee, Edit2, TrendingUp, Users, Wallet, Upload, QrCode, Filter, ArrowLeft, PlusCircle, Receipt, TrendingDown, BarChart3, AlertTriangle, Calculator } from 'lucide-react';
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
  const [currentFee, setCurrentFee] = useState(3000); 
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [upiId, setUpiId] = useState(''); 
  
  // --- Detailed Analytics & Expense States ---
  const [expenses, setExpenses] = useState([]);
  const [successfulPayments, setSuccessfulPayments] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, collectedThisMonth: 0 });
  const [detailedStats, setDetailedStats] = useState({ 
    currentIncome: 0, lastIncome: 0, currentExpense: 0, lastExpense: 0,
    expectedRev: 0, pendingDues: 0, profitMargin: 0 
  });
  
  // --- Include/Exclude Sandbox States ---
  const [excludedTxns, setExcludedTxns] = useState(new Set());
  const [excludedExpenses, setExcludedExpenses] = useState(new Set());

  // UI States
  const [activeTab, setActiveTab] = useState('analytics'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // --- Filter States ---
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Custom Modal States
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm', 
    inputType: 'number', 
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDestructive: false,
    onConfirm: () => {},
  });
  const [promptValue, setPromptValue] = useState('');
  
  // --- Expense Modal State ---
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseData, setExpenseData] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });

  // Modal Helper Functions
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const showConfirmModal = (title, message, isDestructive, onConfirm) => {
    setModalConfig({ isOpen: true, type: 'confirm', inputType: 'text', title, message, confirmText: isDestructive ? 'Delete' : 'Confirm', isDestructive, onConfirm });
  };

  const showPromptModal = (title, message, defaultValue, onConfirm, inputType = 'number') => {
    setPromptValue(defaultValue);
    setModalConfig({ isOpen: true, type: 'prompt', inputType, title, message, confirmText: 'Save', isDestructive: false, onConfirm });
  };

  // 1. Authentication & Data Fetching
  const fetchDashboardData = async () => {
    setLoading(true);
    const hostelId = localStorage.getItem('admin_hostel_id');
    
    if (!hostelId) {
      navigate('/login');
      return;
    }

    try {
      // Fetch Hostel Name, Default Fee, QR & UPI ID
      const { data: hostelData } = await supabase.from('hostels').select('name, default_fee, qr_code_url, upi_id').eq('id', hostelId).single();
      let stdFee = 3000;
      if (hostelData) {
        setHostelName(hostelData.name);
        stdFee = hostelData.default_fee || 3000;
        setCurrentFee(stdFee);
        setQrCodeUrl(hostelData.qr_code_url);
        setUpiId(hostelData.upi_id || ''); 
      }

      // Fetch Students
      const { data: studentsData, error: stuError } = await supabase
        .from('students')
        .select('*')
        .eq('hostel_id', hostelId)
        .order('created_at', { ascending: false });
      if (stuError) throw stuError;
      const activeStudents = studentsData || [];
      setStudents(activeStudents);

      // Fetch Pending Payments
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select(`*, students!inner ( id, full_name, room_number, hostel_id )`)
        .eq('status', 'pending')
        .eq('students.hostel_id', hostelId)
        .order('created_at', { ascending: false });
      if (payError) throw payError;
      setPendingPayments(payData || []);

      // Fetch Expenses
      const { data: expData } = await supabase
        .from('expenses')
        .select('*')
        .eq('hostel_id', hostelId)
        .order('expense_date', { ascending: false });
      const expensesList = expData || [];
      setExpenses(expensesList);

      // Fetch Successful Payments for Analytics
      const { data: revenueData } = await supabase
        .from('payments')
        .select('id, amount, created_at, students!inner(hostel_id, full_name, room_number)')
        .eq('status', 'success')
        .eq('students.hostel_id', hostelId)
        .order('created_at', { ascending: false });

      const successTxns = revenueData || [];
      setSuccessfulPayments(successTxns);

      // --- Silent 30-Day Proof Cleanup ---
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      supabase.from('payments')
        .select('id, proof_url')
        .not('proof_url', 'is', null)
        .lt('created_at', thirtyDaysAgo.toISOString())
        .then(({ data: oldProofs }) => {
           if (oldProofs && oldProofs.length > 0) {
             oldProofs.forEach(async (p) => {
               try {
                 const urlParts = p.proof_url.split('/payment-proofs/');
                 if (urlParts.length > 1) {
                   const fileName = urlParts[1];
                   await supabase.storage.from('payment-proofs').remove([fileName]);
                   await supabase.from('payments').update({ proof_url: null }).eq('id', p.id);
                 }
               } catch(e) { console.error("Cleanup error"); }
             });
           }
        });

    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, [navigate]);

  // --- Dynamic Analytics Sandbox Calculations ---
  useEffect(() => {
    if (!successfulPayments || !expenses || !students) return;

    const activeTxns = successfulPayments.filter(t => !excludedTxns.has(t.id));
    const activeExps = expenses.filter(e => !excludedExpenses.has(e.id));

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const totalRev = activeTxns.reduce((sum, txn) => sum + Number(txn.amount), 0);
    const currInc = activeTxns.filter(t => new Date(t.created_at).getMonth() === currentMonth && new Date(t.created_at).getFullYear() === currentYear).reduce((sum, t) => sum + Number(t.amount), 0);
    const lastInc = activeTxns.filter(t => new Date(t.created_at).getMonth() === lastMonth && new Date(t.created_at).getFullYear() === lastMonthYear).reduce((sum, t) => sum + Number(t.amount), 0);
    
    const currExp = activeExps.filter(e => new Date(e.expense_date).getMonth() === currentMonth && new Date(e.expense_date).getFullYear() === currentYear).reduce((sum, e) => sum + Number(e.amount), 0);
    const lastExp = activeExps.filter(e => new Date(e.expense_date).getMonth() === lastMonth && new Date(e.expense_date).getFullYear() === lastMonthYear).reduce((sum, e) => sum + Number(e.amount), 0);

    const expectedRev = students.reduce((sum, s) => sum + (s.monthly_fee || currentFee), 0);
    const pendingDues = Math.max(0, expectedRev - currInc);
    const profitMargin = currInc > 0 ? Math.round(((currInc - currExp) / currInc) * 100) : 0;

    setStats({ totalRevenue: totalRev, collectedThisMonth: currInc });
    setDetailedStats({ currentIncome: currInc, lastIncome: lastInc, currentExpense: currExp, lastExpense: lastExp, expectedRev, pendingDues, profitMargin });
  }, [successfulPayments, expenses, students, excludedTxns, excludedExpenses, currentFee]);

  const toggleExcludeTxn = (id) => { setExcludedTxns(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleExcludeExp = (id) => { setExcludedExpenses(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  // --- Utility Functions ---
  const getBillingDetails = (lastPaidDateString) => {
    if (!lastPaidDateString) return { nextBillDate: 'N/A', daysLeft: 0, statusColor: 'text-gray-400', riskLevel: 'low' };
    const lastPaid = new Date(lastPaidDateString);
    const nextBill = new Date(lastPaid);
    nextBill.setDate(lastPaid.getDate() + 30);
    const today = new Date(); today.setHours(0,0,0,0); nextBill.setHours(0,0,0,0);
    const daysLeft = Math.ceil((nextBill - today) / (1000 * 60 * 60 * 24));
    let statusColor = daysLeft <= 3 ? 'text-red-600 bg-red-50' : daysLeft <= 7 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
    let riskLevel = daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'safe';
    return { nextBillDate: nextBill.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), daysLeft, statusColor, riskLevel };
  };

  // --- Expense Logic ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').insert([{
        hostel_id: localStorage.getItem('admin_hostel_id'),
        amount: parseInt(expenseData.amount),
        description: expenseData.description,
        expense_date: expenseData.date
      }]);
      if (error) throw error;
      toast.success('Expense Added');
      setExpenseModalOpen(false);
      setExpenseData({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      fetchDashboardData();
    } catch (err) { toast.error('Failed to add expense'); setLoading(false); }
  };

  const handleDeleteExpense = (expId) => {
    showConfirmModal("Delete Expense", "Remove this expense record permanently?", true, async () => {
      const { error } = await supabase.from('expenses').delete().eq('id', expId);
      if (!error) { toast.success('Expense deleted'); fetchDashboardData(); } else { toast.error('Failed to delete expense'); }
    });
  };

  // --- Analytics & Admin Controls ---
  const handleUpdateFee = () => {
    showPromptModal("Update Standard Fee", "Enter new default monthly fee (₹):", currentFee, async (newFee) => {
      const parsedFee = parseInt(newFee);
      if (!parsedFee || isNaN(parsedFee)) return;
      const hostelId = localStorage.getItem('admin_hostel_id');
      const { error } = await supabase.from('hostels').update({ default_fee: parsedFee }).eq('id', hostelId);
      if (!error) { setCurrentFee(parsedFee); toast.success('Default fee updated!'); fetchDashboardData(); } else { toast.error('Failed to update fee'); }
    });
  };

  const handleUpdateStudentFee = (e, studentId, currentVal) => {
    e.stopPropagation(); 
    showPromptModal("Update Student Fee", "Enter CUSTOM fee for this student (₹):", currentVal || currentFee, async (newFee) => {
      const parsedFee = parseInt(newFee);
      if (!parsedFee || isNaN(parsedFee)) return;
      const { error } = await supabase.from('students').update({ monthly_fee: parsedFee }).eq('id', studentId);
      if (!error) { toast.success('Student fee updated'); fetchDashboardData(); } else { toast.error('Failed to update'); }
    });
  };

  const handleUpdateUPI = () => {
    showPromptModal("Update UPI ID", "Enter your hostel's UPI ID (e.g., phone@upi):", upiId, async (newUpi) => {
      if (!newUpi) return;
      const hostelId = localStorage.getItem('admin_hostel_id');
      const { error } = await supabase.from('hostels').update({ upi_id: newUpi }).eq('id', hostelId);
      if (!error) { setUpiId(newUpi); toast.success('UPI ID updated!'); } else { toast.error('Failed to update UPI ID'); }
    }, 'text');
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
    } catch (error) { toast.error("Upload failed", { id: toastId }); }
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
    } catch (error) { toast.error('Failed to approve payment', { id: toastId }); }
  };

  const handleRejectPayment = (paymentId) => {
    showConfirmModal("Reject Payment", "Are you sure you want to reject this payment?", true, async () => {
        const toastId = toast.loading('Rejecting payment...');
        try {
          const { error } = await supabase.from('payments').update({ status: 'rejected' }).eq('id', paymentId);
          if (error) throw error;
          toast.success('Payment Rejected', { id: toastId });
          fetchDashboardData();
        } catch (error) { toast.error('Failed to reject payment', { id: toastId }); }
      }
    );
  };

  const handleLogout = () => { localStorage.removeItem('admin_hostel_id'); navigate('/login'); };

  const handleDelete = (id) => {
    showConfirmModal("Permanently Delete Student?", "This action cannot be undone. All data associated with this student will be lost.", true, async () => {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) { setStudents(students.filter(s => s.id !== id)); toast.success('Student removed'); fetchDashboardData(); } else { toast.error('Failed to delete student'); }
      }
    );
  };

  const toggleExpand = (id) => { setExpandedId(expandedId === id ? null : id); };

  const handleDownloadImage = async (url, name) => {
    if (!url) return;
    try {
      const response = await fetch(url); const blob = await response.blob();
      const link = document.createElement('a'); link.href = window.URL.createObjectURL(blob);
      link.download = `${name.replace(/\s+/g, '_')}_photo.${blob.type.split('/')[1]}`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { toast.error("Download failed"); }
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
      
      doc.setFillColor(...indigo); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.setFont('helvetica', 'bold');
      doc.text(hostelName.toUpperCase() || 'ASHRAY HOSTEL', 105, 20, { align: 'center' });
      doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text('Official Student Profile', 105, 30, { align: 'center' });
      if (student.photo_url) {
        try { const imgData = await getBase64ImageFromURL(student.photo_url); doc.addImage(imgData, 'JPEG', 150, 50, 40, 40); doc.setDrawColor(200, 200, 200); doc.rect(150, 50, 40, 40); } catch (imgError) { console.warn("Could not load image for PDF:", imgError); }
      }
      doc.setTextColor(...textGray); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Personal Details', 20, 60); doc.setDrawColor(229, 231, 235); doc.line(20, 63, 140, 63); 
      doc.setFontSize(12); doc.setFont('helvetica', 'normal');
      const startY = 75; const gap = 12;
      doc.text(`Full Name: ${student.full_name}`, 20, startY); doc.text(`Room Number: ${student.room_number}`, 20, startY + gap); doc.text(`Mobile Number: ${student.mobile_number}`, 20, startY + gap * 2); doc.text(`Email Address: ${student.email || 'Not Provided'}`, 20, startY + gap * 3); doc.text(`Aadhar Number: ${student.adhar_number || 'Not Provided'}`, 20, startY + gap * 4);
      const addressLines = doc.splitTextToSize(`Permanent Address: ${student.address || 'Not Provided'}`, 170); doc.text(addressLines, 20, startY + gap * 5);
      const billingY = Math.max(startY + gap * 5 + (addressLines.length * 7) + 15, 110); 
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Billing Status', 20, billingY); doc.line(20, billingY + 3, 190, billingY + 3);
      doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(`Last Payment Date: ${student.last_paid_date || 'N/A'}`, 20, billingY + 15); doc.text(`Next Bill Due Date: ${bill.nextBillDate}`, 20, billingY + 15 + gap);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(bill.daysLeft <= 3 ? 220 : 55, bill.daysLeft <= 3 ? 38 : 65, bill.daysLeft <= 3 ? 38 : 81); doc.text(`Status: ${bill.daysLeft} Days Remaining`, 20, billingY + 15 + gap * 2);
      doc.setTextColor(156, 163, 175); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Generated automatically by the Ashray Administration System.', 105, 280, { align: 'center' });
      const fileName = `${student.full_name.replace(/\s+/g, '_')}_Profile.pdf`; doc.save(fileName); window.open(doc.output('bloburl'), '_blank');
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) { toast.error('Failed to generate PDF', { id: toastId }); }
  };

  const handleDownloadFinancialReport = () => {
    const doc = new jsPDF();
    doc.setFillColor(79, 70, 229); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(`${hostelName.toUpperCase()} - FINANCIAL REPORT`, 105, 18, { align: 'center' });
    doc.setTextColor(50, 50, 50); doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 20, 40);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('Monthly Summary', 20, 55); doc.line(20, 58, 190, 58);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`Total Expected Revenue: Rs. ${detailedStats.expectedRev.toLocaleString()}`, 20, 70);
    doc.text(`Actual Collected Income: Rs. ${detailedStats.currentIncome.toLocaleString()}`, 20, 80);
    doc.text(`Pending Dues: Rs. ${detailedStats.pendingDues.toLocaleString()}`, 20, 90);
    doc.text(`Total Expenses: Rs. ${detailedStats.currentExpense.toLocaleString()}`, 20, 100);
    doc.setFont('helvetica', 'bold');
    const netProfit = detailedStats.currentIncome - detailedStats.currentExpense;
    doc.setTextColor(netProfit >= 0 ? 34 : 220, netProfit >= 0 ? 197 : 38, netProfit >= 0 ? 94 : 38);
    doc.text(`Net Profit: Rs. ${netProfit.toLocaleString()}`, 20, 115);
    doc.text(`Profit Margin: ${detailedStats.profitMargin}%`, 20, 125);
    doc.save(`${hostelName.replace(/\s+/g, '_')}_Financial_Report.pdf`);
    toast.success('Report Downloaded!');
  };

  // --- Advanced Filtering Logic ---
  const uniqueRooms = ['all', ...new Set(students.map(s => s.room_number))].sort();

  const filteredStudents = students.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.room_number.includes(searchTerm);
    const bill = getBillingDetails(s.last_paid_date);
    const matchStatus = filterStatus === 'all' || bill.riskLevel === filterStatus;
    const matchRoom = filterRoom === 'all' || s.room_number === filterRoom;
    return matchSearch && matchStatus && matchRoom;
  });

  const unpaidStudents = students.filter(s => {
    const bill = getBillingDetails(s.last_paid_date);
    return bill.riskLevel === 'critical' || bill.riskLevel === 'warning';
  }).sort((a, b) => getBillingDetails(a.last_paid_date).daysLeft - getBillingDetails(b.last_paid_date).daysLeft);

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

            {/* --- Tabs --- */}
            <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${activeTab === 'analytics' || activeTab === 'detailed-analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="max-w-5xl mx-auto p-4 space-y-3 mt-2">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
        ) : activeTab === 'analytics' ? (
          /* ========================================= */
          /* BASIC ANALYTICS & CONTROLS TAB            */
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

            <button onClick={() => setActiveTab('detailed-analytics')} className="w-full bg-white border border-indigo-100 hover:bg-indigo-50 text-indigo-700 rounded-2xl p-4 shadow-sm transition flex items-center justify-center gap-2 font-bold group">
              <BarChart3 className="text-indigo-500 group-hover:scale-110 transition-transform" /> 
              View Detailed Financial Analytics & Expenses
            </button>

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
              <div className="flex-1 text-center sm:text-left w-full">
                <h3 className="text-lg font-bold text-gray-900">Payment Configuration</h3>
                <p className="text-sm text-gray-500 mb-4">Upload your UPI QR code or manually set your UPI ID. This helps students pay seamlessly directly through the app.</p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold text-sm cursor-pointer hover:bg-indigo-700 transition shadow-md">
                    <Upload size={16} /> Upload QR Image
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadQR} />
                  </label>
                  
                  <button onClick={handleUpdateUPI} className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-5 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition shadow-sm">
                    <Edit2 size={16} /> Edit UPI ID
                  </button>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Current UPI ID Link</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono bg-gray-50 px-2 py-1 rounded border inline-block">{upiId || 'Not configured'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'detailed-analytics' ? (
          /* ========================================= */
          /* DETAILED ANALYTICS & EXPENSES TAB         */
          /* ========================================= */
          <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('analytics')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-bold text-gray-900">Financial Overview</h2>
              </div>
              <button onClick={handleDownloadFinancialReport} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition flex items-center gap-2">
                <FileDown size={16}/> Export Report
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">Cash Flow Sandbox <Calculator size={16} className="text-indigo-500"/></h3>
                  <p className="text-xs text-gray-500 mt-1">Use the toggles in the lists below to temporarily include/exclude items.</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">{detailedStats.profitMargin}%</span>
                  <p className="text-xs text-gray-500 font-medium">Profit Margin</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-5 flex overflow-hidden border border-gray-200 shadow-inner">
                {detailedStats.currentIncome === 0 && detailedStats.currentExpense === 0 ? (
                   <div className="w-full bg-gray-200 h-full"></div>
                ) : (
                  <>
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(detailedStats.currentIncome / (detailedStats.currentIncome + detailedStats.currentExpense)) * 100}%` }}></div>
                    <div className="bg-red-500 h-full transition-all duration-1000" style={{ width: `${(detailedStats.currentExpense / (detailedStats.currentIncome + detailedStats.currentExpense)) * 100}%` }}></div>
                  </>
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs font-bold">
                <span className="text-emerald-600">IN: ₹{detailedStats.currentIncome.toLocaleString()}</span>
                <span className="text-red-500">OUT: ₹{detailedStats.currentExpense.toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm border-b-4 border-b-emerald-500">
                  <p className="text-xs text-gray-500 font-medium mb-1">Net Income</p>
                  <h3 className="text-xl font-bold text-gray-900">₹{detailedStats.currentIncome.toLocaleString()}</h3>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm border-b-4 border-b-red-500">
                  <p className="text-xs text-gray-500 font-medium mb-1">Expenses</p>
                  <h3 className="text-xl font-bold text-gray-900">₹{detailedStats.currentExpense.toLocaleString()}</h3>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm border-b-4 border-b-amber-500">
                  <p className="text-xs text-gray-500 font-medium mb-1">Pending Dues</p>
                  <h3 className="text-xl font-bold text-gray-900">₹{detailedStats.pendingDues.toLocaleString()}</h3>
               </div>
               <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-lg border-b-4 border-b-indigo-500">
                  <p className="text-xs text-gray-400 font-medium mb-1">Net Profit</p>
                  <h3 className="text-xl font-bold">₹{(detailedStats.currentIncome - detailedStats.currentExpense).toLocaleString()}</h3>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500"/> Action Required: Unpaid</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {unpaidStudents.length === 0 ? <p className="text-sm text-gray-400">Everyone has paid! 🎉</p> :
                    unpaidStudents.map((student) => {
                      const bill = getBillingDetails(student.last_paid_date);
                      return (
                        <div key={student.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border-l-4 border-l-amber-400">
                          <div>
                            <p className="font-bold text-sm text-gray-900">{student.full_name}</p>
                            <p className="text-xs text-gray-500">Room {student.room_number}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-bold ${bill.riskLevel === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{bill.daysLeft} Days</p>
                            <a href={`tel:${student.mobile_number}`} className="text-[10px] text-indigo-600 font-bold hover:underline">Call</a>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><Receipt size={18} className="text-red-500"/> Recent Expenses</h3>
                  <button onClick={() => setExpenseModalOpen(true)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition flex items-center gap-1">
                    <PlusCircle size={14}/> Add
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {expenses.length === 0 ? <p className="text-sm text-gray-400">No expenses recorded.</p> :
                    expenses.map((exp) => {
                      const isExcluded = excludedExpenses.has(exp.id);
                      return (
                        <div key={exp.id} className={`flex justify-between items-center p-3 rounded-xl border-l-4 transition-all duration-300 ${isExcluded ? 'bg-gray-50 border-l-gray-300 opacity-60' : 'bg-red-50/50 border-l-red-400'}`}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleExcludeExp(exp.id)} title={isExcluded ? "Include in calculation" : "Exclude from calculation"} className="text-gray-400 hover:text-indigo-600 transition">
                               {isExcluded ? <XCircle size={18} /> : <CheckCircle size={18} />}
                            </button>
                            <div>
                              <p className={`font-bold text-sm capitalize ${isExcluded ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{exp.description}</p>
                              <p className="text-xs text-gray-500">{new Date(exp.expense_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${isExcluded ? 'text-gray-400 line-through' : 'text-red-600'}`}>-₹{exp.amount}</span>
                            <button onClick={() => handleDeleteExpense(exp.id)} title="Delete Expense" className="text-red-300 hover:text-red-600 transition p-1"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 md:col-span-2">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Wallet size={18} className="text-emerald-500"/> Recent Payments (Income Sandbox)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {successfulPayments.length === 0 ? <p className="text-sm text-gray-400">No payments found.</p> :
                    successfulPayments.map((txn) => {
                      const isExcluded = excludedTxns.has(txn.id);
                      return (
                        <div key={txn.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all duration-300 ${isExcluded ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-emerald-50/30 border-emerald-100'}`}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleExcludeTxn(txn.id)} title={isExcluded ? "Include in calculation" : "Exclude from calculation"} className="text-gray-400 hover:text-indigo-600 transition">
                               {isExcluded ? <XCircle size={18} /> : <CheckCircle size={18} />}
                            </button>
                            <div>
                              <p className={`font-bold text-sm ${isExcluded ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{txn.students.full_name}</p>
                              <p className="text-xs text-gray-500">Room {txn.students.room_number}</p>
                            </div>
                          </div>
                          <span className={`font-bold ${isExcluded ? 'text-gray-400 line-through' : 'text-emerald-600'}`}>+₹{txn.amount}</span>
                        </div>
                      )
                    })
                  }
                </div>
              </div>

            </div>
          </div>
        ) : activeTab === 'students' ? (
          /* ========================================= */
          /* STUDENTS TAB WITH ADVANCED FILTERS        */
          /* ========================================= */
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search name..." 
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex gap-2 flex-1 sm:flex-none">
                <div className="relative w-full sm:w-32">
                  <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select 
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 outline-none appearance-none" 
                    value={filterRoom} 
                    onChange={e => setFilterRoom(e.target.value)}
                  >
                    {uniqueRooms.map(r => <option key={r} value={r}>{r === 'all' ? 'All Rooms' : `Rm ${r}`}</option>)}
                  </select>
                </div>
                <select 
                  className="w-full sm:w-36 px-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 outline-none" 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="safe">Paid (Safe)</option>
                  <option value="warning">Due Soon</option>
                  <option value="critical">Overdue</option>
                </select>
              </div>
            </div>

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
                  <p className="font-medium text-gray-500">No students match your filters</p>
                  <p className="text-sm mt-1">Try adjusting the search or dropdowns.</p>
               </div>
            )}
          </div>
        ) : (
          /* ========================================= */
          /* PENDING PAYMENTS TAB                      */
          /* ========================================= */
          <div className="space-y-4 animate-in fade-in">
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

      {/* --- Global Modal System UI --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{modalConfig.title}</h2>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{modalConfig.message}</p>
            
            {modalConfig.type === 'prompt' && (
              <input 
                type={modalConfig.inputType || 'number'} 
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 font-bold text-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
            )}

            <div className="flex gap-3">
              <button 
                onClick={closeModal} 
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  modalConfig.onConfirm(modalConfig.type === 'prompt' ? promptValue : undefined);
                  closeModal();
                }} 
                className={`flex-1 text-white py-3 rounded-xl font-bold transition flex justify-center items-center shadow-md ${modalConfig.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add Expense Modal --- */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Receipt size={20} className="text-red-500"/> Log New Expense
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Amount (₹)</label>
                <input 
                  type="number" 
                  required 
                  value={expenseData.amount} 
                  onChange={e => setExpenseData({...expenseData, amount: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. 1500" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                <input 
                  type="text" 
                  required 
                  value={expenseData.description} 
                  onChange={e => setExpenseData({...expenseData, description: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. Electricity Bill, Groceries" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Date</label>
                <input 
                  type="date" 
                  required 
                  value={expenseData.date} 
                  onChange={e => setExpenseData({...expenseData, date: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setExpenseModalOpen(false)} 
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-md flex justify-center items-center"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}