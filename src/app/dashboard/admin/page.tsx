"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, setDoc, updateDoc } from "firebase/firestore";
import { db, auth, firebaseConfig } from "@/lib/firebase/config";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Shield, Plus, Link as LinkIcon, Trash2, Calendar, Search, X, Key } from "lucide-react";

interface BusinessUser {
  id: string;
  email: string;
  role: string;
  businessName?: string;
  slug?: string;
  pin?: string;
  status?: "Activo" | "Inactivo";
  expiresAt?: string;
}

export default function AdminDashboard() {
  const { user, role, loading: authLoading, setRole } = useAuthStore();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // New Agency Modal State
  const [showModal, setShowModal] = useState(false);
  const [newAgency, setNewAgency] = useState({
    businessName: "",
    slug: "",
    email: "",
    password: "",
    pin: "",
    logoUrl: ""
  });
  const [creating, setCreating] = useState(false);

  const fetchBusinesses = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "business"));
      const snap = await getDocs(q);
      const data: BusinessUser[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as BusinessUser));
      setBusinesses(data);
    } catch (error) {
      console.error("Error fetching businesses", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (role === "admin") {
        fetchBusinesses();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, role]);

  const handleImpersonate = (businessId: string) => {
    router.push(`/dashboard/business?impersonate=${businessId}`);
  };

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Create a secondary app to create a user without logging out the admin
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newAgency.email, newAgency.password);
      const newUid = userCred.user.uid;
      
      await secondaryAuth.signOut();
      
      const newBizData = {
        email: newAgency.email,
        role: "business",
        businessName: newAgency.businessName,
        slug: newAgency.slug,
        pin: newAgency.pin,
        logoUrl: newAgency.logoUrl,
        status: "Activo",
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "users", newUid), newBizData);
      
      setBusinesses([{ id: newUid, ...newBizData } as BusinessUser, ...businesses]);
      setShowModal(false);
      setNewAgency({ businessName: "", slug: "", email: "", password: "", pin: "", logoUrl: "" });
      alert("¡Agencia creada con éxito!");
    } catch (error: any) {
      console.error("Error creating agency", error);
      alert("Error: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando Modo Dios...</div>;
  }

  // SECRET BACKDOOR TO BECOME ADMIN (For the user to test)
  if (role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col">
        <Shield className="w-16 h-16 mb-4 text-blue-500" />
        <h1 className="text-2xl font-bold mb-6">Acceso Restringido</h1>
        <button 
          onClick={async () => {
            if (user) {
              await setDoc(doc(db, "users", user.uid), { role: "admin" }, { merge: true });
              setRole("admin");
              window.location.reload();
            } else {
              alert("Inicia sesión primero");
              router.push("/login");
            }
          }}
          className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700 font-bold"
        >
          [Dev] Reclamar rol de Admin
        </button>
      </div>
    );
  }

  const handleUpdate = async (bizId: string, field: string, value: any) => {
    try {
      await updateDoc(doc(db, "users", bizId), { [field]: value });
      setBusinesses(businesses.map(b => b.id === bizId ? { ...b, [field]: value } : b));
    } catch (error) {
      console.error("Error updating", error);
      alert("Error al actualizar");
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`¿Estás seguro de enviar un correo de recuperación a ${email}?`)) return;
    
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Correo de recuperación enviado a ${email}. Revisa la bandeja de entrada o spam.`);
    } catch (error: any) {
      console.error("Error resetting password", error);
      alert("Error al enviar correo: " + error.message);
    }
  };

  const filtered = businesses.filter(b => 
    (b.businessName || "").toLowerCase().includes(search.toLowerCase()) || 
    (b.slug || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[#0f172a] text-white py-6 px-6 sm:px-10 rounded-b-3xl shadow-lg mx-4 sm:mx-10 mt-4 flex flex-col sm:flex-row justify-between items-center relative">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="bg-blue-500 p-3 rounded-full mr-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centro de Control</h1>
            <p className="text-blue-300 text-sm">Cuponera O2O - Modo Dios</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-6 rounded-full flex items-center transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Cuponera
          </button>
          
          <button 
            onClick={() => {
              auth.signOut();
              router.push("/");
            }}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-full flex items-center transition-colors text-sm"
          >
            Salir
          </button>
        </div>
      </div>

      {/* MODAL NUEVA AGENCIA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Crear Nueva Cuponera</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAgency} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newAgency.businessName} onChange={e => setNewAgency({...newAgency, businessName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo del Negocio (URL Opcional)</label>
                <input 
                  type="url" 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://ejemplo.com/logo.png"
                  value={newAgency.logoUrl} onChange={e => setNewAgency({...newAgency, logoUrl: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enlace Personalizado (slug)</label>
                <div className="flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-3 py-2 text-gray-500 text-sm">/local/</span>
                  <input 
                    type="text" required 
                    className="w-full px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="smash-burgers"
                    value={newAgency.slug} onChange={e => setNewAgency({...newAgency, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                  <input 
                    type="email" required 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal</label>
                  <input 
                    type="text" required minLength={6}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newAgency.password} onChange={e => setNewAgency({...newAgency, password: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN (4 dígitos)</label>
                <input 
                  type="text" required maxLength={4} minLength={4} pattern="\d*"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: 4679"
                  value={newAgency.pin} onChange={e => setNewAgency({...newAgency, pin: e.target.value})}
                />
              </div>
              
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 mt-6"
              >
                {creating ? "Creando..." : "Crear Agencia"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-gray-100 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-7 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar agencias por nombre o URL..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-gray-700"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Agencia / Link</th>
                  <th className="px-6 py-4">Estado (Candado)</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((biz) => (
                  <tr key={biz.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3 font-bold text-gray-500">
                          {biz.businessName ? biz.businessName.charAt(0).toUpperCase() : "B"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{biz.businessName || biz.email}</p>
                          <div className="flex items-center text-blue-500 text-sm mt-0.5">
                            <LinkIcon className="w-3 h-3 mr-1" />
                            <span>/{biz.slug || "sin-link"}</span>
                          </div>
                          <p className="text-orange-500 text-xs font-medium mt-0.5">PIN: {biz.pin || "0000"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-2">
                        <button 
                          onClick={() => handleUpdate(biz.id, "status", biz.status === "Inactivo" ? "Activo" : "Inactivo")}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit cursor-pointer hover:opacity-80 transition-opacity ${biz.status === "Inactivo" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${biz.status === "Inactivo" ? "bg-red-500" : "bg-green-500"}`}></span>
                          {biz.status || "Activo"}
                        </button>
                        <div className="flex items-center text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 w-fit bg-white">
                          <Calendar className="w-3 h-3 mr-1.5 text-gray-400" />
                          Vence: <input 
                            type="date" 
                            className="ml-1 outline-none text-gray-700 bg-transparent" 
                            value={biz.expiresAt || ""} 
                            onChange={(e) => handleUpdate(biz.id, "expiresAt", e.target.value)}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleImpersonate(biz.id)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-1.5 px-3 rounded transition-colors"
                        >
                          Entrar al Panel
                        </button>
                        <button 
                          onClick={() => handleResetPassword(biz.email)}
                          className="text-gray-400 hover:text-blue-500 p-1.5 transition-colors"
                          title="Restablecer Contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button className="text-gray-400 hover:text-red-500 p-1.5 transition-colors" title="Eliminar Cuponera">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      No se encontraron agencias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
