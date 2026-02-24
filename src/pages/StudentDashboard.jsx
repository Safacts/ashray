import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Calendar, CreditCard, Clock, LogOut, Upload, CheckCircle, AlertCircle, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [payments, setPayments] = useState([]);
  const navigate = useNavigate();
  
  // Payment States
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState(3000);
  const [hostelQr, setHostelQr] = useState(null); 
  const [hostelUpi, setHostelUpi] = useState(''); // UPI ID State
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('student_user'));
    if (!user) { navigate('/login'); return; }
    setStudent(user);
    fetchPayments(user.id);
    fetchHostelDetails(user.hostel_id, user.monthly_fee);
  }, [navigate]);

  const fetchPayments = async (id) => {
    const { data } = await supabase.from('payments').select('*').eq('student_id', id).order('created_at', { ascending: false });
    if(data) setPayments(data);
  };

  // Fixed: Merged the two duplicate functions into one
  const fetchHostelDetails = async (hostelId, studentCustomFee) => {
    if (!hostelId) return;
    const { data } = await supabase
      .from('hostels')
      .select('default_fee, qr_code_url, upi_id')
      .eq('id', hostelId)
      .single();
    
    if (data) {
      // Priority: Student Custom Fee > Hostel Default Fee > 3000 fallback
      setPayAmount(studentCustomFee || data.default_fee || 3000);
      setHostelQr(data.qr_code_url);
      setHostelUpi(data.upi_id || '');
    }
  };

  // Generate the UPI link dynamically based on the state
  const upiLink = hostelUpi 
    ? `upi://pay?pa=${hostelUpi}&pn=AshrayHostel&am=${payAmount}&cu=INR` 
    : '#';

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!proofFile) return toast.error("Please upload the payment screenshot");
    
    setUploading(true);
    const toastId = toast.loading('Submitting payment proof...');

    try {
      const fileName = `${Date.now()}-${student.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('payments').insert([{
        student_id: student.id,
        amount: payAmount,
        transaction_id: `TXN-${Date.now().toString().slice(-6)}`,
        status: 'pending',
        proof_url: publicUrl
      }]);

      if (dbError) throw dbError;

      toast.success('Proof submitted! Waiting for Admin approval.', { id: toastId });
      setShowPayModal(false);
      setProofFile(null);
      fetchPayments(student.id);

    } catch (error) {
      toast.error('Failed to submit proof', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  if (!student) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-indigo-600 p-6 text-white rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
             <h1 className="text-2xl font-bold">Hi, {student.full_name.split(' ')[0]}</h1>
             <p className="text-indigo-200 text-sm">Room {student.room_number}</p>
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
            <LogOut size={20} />
          </button>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 flex items-center justify-between">
           <div>
             <p className="text-xs text-indigo-100 uppercase font-semibold">Next Due Date</p>
             <p className="text-lg font-bold mt-1">
                {student.last_paid_date ? new Date(new Date(student.last_paid_date).setDate(new Date(student.last_paid_date).getDate() + 30)).toLocaleDateString() : 'N/A'}
             </p>
           </div>
           <button onClick={() => setShowPayModal(true)} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition shadow-sm">
             Pay Fees
           </button>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-gray-900 font-bold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" /> Payment History
        </h3>
        <div className="space-y-3">
          {payments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No transactions yet.</p>
          ) : (
            payments.map(pay => (
              <div key={pay.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pay.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                     {pay.status === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                   </div>
                   <div>
                     <p className="font-bold text-gray-800">₹{pay.amount}</p>
                     <p className="text-xs text-gray-400">{pay.transaction_id}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-xs font-bold text-gray-500 mb-1">{new Date(pay.created_at).toLocaleDateString()}</p>
                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${pay.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                     {pay.status}
                   </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pay Hostel Fees</h2>
            
            <label className="block text-sm font-semibold text-gray-700 mb-1">Paying Amount</label>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 font-bold text-lg text-gray-900">
               ₹{payAmount}
            </div>

            {hostelQr ? (
              <div className="mb-6 flex flex-col items-center">
                 <p className="text-xs text-gray-500 mb-2 font-medium">Scan to Pay (GPay / PhonePe)</p>
                 <div className="p-2 border-2 border-indigo-100 rounded-xl bg-white shadow-sm">
                    <img src={hostelQr} alt="Hostel QR" className="w-40 h-40 object-contain" />
                 </div>
              </div>
            ) : (
               <div className="mb-4 bg-amber-50 p-3 rounded-lg text-amber-700 text-xs text-center">
                 Admin hasn't uploaded a QR code yet. Please use the button below or ask admin.
               </div>
            )}

            <a 
              href={upiLink}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 py-3 rounded-xl font-bold mb-4 hover:bg-indigo-100 transition"
            >
              <CreditCard size={18} /> Pay via UPI App
            </a>

            <hr className="mb-6 border-gray-100" />

            <form onSubmit={handleSubmitProof}>
              <p className="text-sm font-semibold text-gray-700 mb-2">Upload Payment Screenshot:</p>
              <input 
                type="file" 
                accept="image/*" 
                required
                onChange={(e) => setProofFile(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-6"
              />
              
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition flex justify-center items-center gap-2">
                  {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Submit Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}