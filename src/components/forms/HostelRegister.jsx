import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { Building2, MapPin, Phone, CheckCircle, Loader2, Home } from 'lucide-react';

export default function HostelRegister() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', admin_mobile: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Registering Hostel...');

    try {
      const { error } = await supabase.from('hostels').insert([formData]);
      
      if (error) throw error;
      
      toast.success('Hostel Registered Successfully!', { id: toastId });
      setFormData({ name: '', address: '', admin_mobile: '' });
    } catch (error) {
      toast.error(error.message || 'Registration failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <Building2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Hostel Registration</h2>
          <p className="text-sm text-gray-500 mt-1">Add your hostel to the Ashray network</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Home className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
             </div>
             <input 
               type="text" 
               placeholder="Hostel Name" 
               required 
               className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
               value={formData.name} 
               onChange={e => setFormData({...formData, name: e.target.value})} 
             />
          </div>

          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
             </div>
             <input 
               type="text" 
               placeholder="Full Address" 
               required 
               className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
               value={formData.address} 
               onChange={e => setFormData({...formData, address: e.target.value})} 
             />
          </div>

          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
             </div>
             <input 
               type="tel" 
               placeholder="Admin Mobile Number" 
               required 
               className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
               value={formData.admin_mobile} 
               onChange={e => setFormData({...formData, admin_mobile: e.target.value})} 
             />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> Register Hostel</>}
          </button>
        </form>
      </div>
    </div>
  );
}