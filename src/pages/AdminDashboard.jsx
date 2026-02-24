import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Search, Loader2, User, Phone, FileText, Download, MessageCircle, ChevronDown, ChevronUp, Calendar, Lock, Key, PhoneCall, FileDown, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';

// Helper function to convert image URL to Base64 for jsPDF
const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Required to prevent CORS canvas tainting
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast.success('Access Granted');
      fetchStudents();
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

  // --- Upgraded PDF Generation Logic with Photo ---
  const handleDownloadPDF = async (student, bill) => {
    const toastId = toast.loading('Generating Profile PDF...');
    try {
      const doc = new jsPDF();
      const indigo = [79, 70, 229]; // Tailwind indigo-600
      const textGray = [55, 65, 81];
      
      // Header Banner
      doc.setFillColor(...indigo);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('ASHRAY HOSTEL', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Official Student Profile', 105, 30, { align: 'center' });

      // Add Student Photo (Right side)
      if (student.photo_url) {
        try {
          const imgData = await getBase64ImageFromURL(student.photo_url);
          // Draw image: imgData, format, x, y, width, height
          doc.addImage(imgData, 'JPEG', 150, 50, 40, 40);
          
          // Draw a subtle border around the image
          doc.setDrawColor(200, 200, 200);
          doc.rect(150, 50, 40, 40);
        } catch (imgError) {
          console.warn("Could not load image for PDF:", imgError);
        }
      }

      // Section 1: Personal Details (Left side)
      doc.setTextColor(...textGray);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Personal Details', 20, 60);
      doc.setDrawColor(229, 231, 235);
      // Make the line shorter to not intersect with the photo
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
      
      // Address (Handling text wrap if it's long)
      const addressLines = doc.splitTextToSize(`Permanent Address: ${student.address || 'Not Provided'}`, 170);
      doc.text(addressLines, 20, startY + gap * 5);

      // Section 2: Billing Information
      const billingY = Math.max(startY + gap * 5 + (addressLines.length * 7) + 15, 110); // Ensure it drops below the photo
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

      // Footer
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Generated automatically by the Ashray Administration System.', 105, 280, { align: 'center' });

      // Output
      const fileName = `${student.full_name.replace(/\s+/g, '_')}_Profile.pdf`;
      doc.save(fileName);
      window.open(doc.output('bloburl'), '_blank');
      
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.room_number.includes(searchTerm)
  );

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

                <div className={`bg-gray-50/50 border-t border-gray-100 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                      {student.address && (
                        <div className="col-span-2 space-y-1">
                           <span className="text-xs text-gray-400 uppercase font-semibold">Address</span>
                           <div className="font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">
                              {student.address}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <a 
                          href={`tel:${student.mobile_number}`}
                          className="bg-blue-50 text-blue-700 border border-blue-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition"
                        >
                          <PhoneCall size={16} /> Call
                        </a>
                        <a 
                          href={createWhatsAppLink(student, bill)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-green-50 text-green-700 border border-green-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-100 transition"
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                        <button 
                          onClick={() => handleDownloadPDF(student, bill)}
                          className="bg-indigo-50 text-indigo-700 border border-indigo-100 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-100 transition cursor-pointer"
                        >
                          <FileDown size={16} /> PDF Profile
                        </button>
                        <button 
                          onClick={() => handleDownloadImage(student.photo_url, student.full_name)}
                          className="bg-white text-gray-700 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                        >
                          <ImageIcon size={16} /> Get Photo
                        </button>
                      </div>

                      <button 
                        onClick={() => handleDelete(student.id)}
                        className="w-full flex items-center justify-center gap-2 bg-red-50/50 text-red-500 border border-red-100 py-2.5 rounded-xl hover:bg-red-50 transition"
                      >
                        <Trash2 size={16} /> Remove Student
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