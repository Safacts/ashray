import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';
import { Upload, User, Mail, Home, Phone, Loader2, CheckCircle, FileText, X, ChevronRight, Camera } from 'lucide-react';

const HOSTEL_RULES = [
  "Full responsibility for one's own belongings lies with them.",
  "A month means exactly 30 days.",
  "Once the fee is paid, it will not be refunded.",
  "Smoking and alcohol are strictly prohibited.",
  "Hostel closed during Dussehra and Sankranti holidays.",
  "Outsiders are not allowed in the hostel.",
  "Management is not responsible for outside disturbances.",
  "Violation of rules will result in immediate expulsion."
];

export default function StudentRegister() {
  const [loading, setLoading] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', roomNumber: '', mobile: '', adharNumber: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);

  // --- Smart Input Handlers ---
  const handleNumberInput = (e, field, maxLength) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, maxLength);
    setFormData({ ...formData, [field]: value });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      setPhoto(compressedFile);
      toast.success("Photo ready!");
    } catch (error) {
      toast.error('Image compression failed');
    }
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!photo) {
      toast.error('Student photo is required');
      return;
    }
    if (formData.mobile.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setShowRulesModal(true);
  };

  const handleFinalSubmit = async () => {
    setShowRulesModal(false);
    setLoading(true);
    const toastId = toast.loading('Creating student profile...');

    try {
      const fileName = `${Date.now()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from('hostel-photos')
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hostel-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('students')
        .insert([{
          full_name: formData.fullName,
          email: formData.email,
          room_number: formData.roomNumber,
          mobile_number: formData.mobile,
          adhar_number: formData.adharNumber,
          photo_url: publicUrl,
          last_paid_date: new Date().toISOString().split('T')[0]
        }]);

      if (dbError) throw dbError;

      toast.success('Registration Complete!', { id: toastId });
      setFormData({ fullName: '', email: '', roomNumber: '', mobile: '', adharNumber: '' });
      setPhoto(null);
      setPreview(null);

    } catch (error) {
      toast.error(error.message || 'Registration failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/50 flex flex-col items-center justify-center p-4 sm:p-6">
      
      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100 overflow-hidden border border-white/50 backdrop-blur-sm relative">
        
        {/* Decorative Top Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        <div className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Registration</h1>
            <p className="text-gray-500 text-sm mt-1">Ashray Hostel System</p>
          </div>

          <form onSubmit={handleInitialSubmit} className="space-y-5">
            
            {/* Photo Upload - Mobile Optimized */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <label className="cursor-pointer w-28 h-28 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-4 border-white flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-all duration-300 overflow-hidden ring-1 ring-gray-100">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 group-hover:text-indigo-600 transition">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Add Photo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} required />
                </label>
                {/* Upload Indicator */}
                <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white transform translate-x-1 translate-y-1">
                  <Upload className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Floating Label Inputs */}
            <div className="space-y-4">
              
              {/* Name */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 placeholder-gray-400 font-medium transition-all focus:bg-white"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              {/* Mobile Number (Numeric Only) */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="tel"
                  placeholder="Mobile Number (10 digits)"
                  required
                  maxLength={10}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 placeholder-gray-400 font-medium transition-all focus:bg-white"
                  value={formData.mobile}
                  onChange={(e) => handleNumberInput(e, 'mobile', 10)}
                />
              </div>

              {/* Email */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 placeholder-gray-400 font-medium transition-all focus:bg-white"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Grid for Room & Aadhar */}
              <div className="grid grid-cols-5 gap-3">
                {/* Room No (Smaller width) */}
                <div className="col-span-2 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Home className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Room"
                    required
                    className="w-full pl-10 pr-2 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 placeholder-gray-400 font-medium transition-all focus:bg-white"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  />
                </div>

                {/* Aadhar (Larger width) */}
                <div className="col-span-3 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Aadhar (12)"
                    required
                    maxLength={12}
                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 text-gray-800 placeholder-gray-400 font-medium transition-all focus:bg-white"
                    value={formData.adharNumber}
                    onChange={(e) => handleNumberInput(e, 'adharNumber', 12)}
                  />
                </div>
              </div>

            </div>

            {/* Action Button */}
            <button
              type="submit"
              className="w-full mt-6 bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl hover:bg-black transition-all duration-300 flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </form>
        </div>
      </div>

      {/* Modern Bottom Sheet / Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowRulesModal(false)}></div>
          
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
            
            {/* Drag Handle (Mobile) */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>

            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">House Rules</h3>
                <p className="text-gray-500 text-sm mt-1">Please read carefully</p>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-6">
              {HOSTEL_RULES.map((rule, index) => (
                <div key={index} className="flex gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {index + 1}
                  </span>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-indigo-200 shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle className="w-5 h-5" /> I Accept & Join</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}