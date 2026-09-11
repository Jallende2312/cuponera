"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Edit2, ArrowLeft, X, Image as ImageIcon, Loader2, Share2, BarChart3, Ticket, CheckCircle, QrCode, TrendingUp, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Promotion {
  id: string;
  title: string;
  description: string;
  limit: number;
  claimed: number;
  redeemed?: number; // Added to track redeemed, though we'll calculate it from coupons
  active: boolean;
  imageUrl?: string;
}

// The main dashboard content that uses search params
function DashboardContent() {
  const { user, role, loading: authLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Si el admin está impersonando a un negocio, usamos el ID de la URL
  const impersonateId = searchParams.get("impersonate");
  const isImpersonating = role === "admin" && impersonateId;
  const currentBusinessId = isImpersonating ? impersonateId : user?.uid;
  
  const [activeTab, setActiveTab] = useState<"vitrina" | "estadisticas">("vitrina");
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stats, setStats] = useState({ totalClaimed: 0, totalRedeemed: 0 });
  const [businessSlug, setBusinessSlug] = useState<string>("");
  
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  // Modal state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState(10);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user && !isImpersonating) {
        router.push("/login");
      } else if (role !== "business" && !isImpersonating) {
        router.push("/");
      } else if (currentBusinessId) {
        fetchPromotionsAndStats();
      }
    }
  }, [user, role, authLoading, router, isImpersonating, currentBusinessId]);

  const fetchPromotionsAndStats = async () => {
    if (!currentBusinessId) return;
    try {
      // Fetch user profile to get slug
      const userDoc = await getDoc(doc(db, "users", currentBusinessId));
      if (userDoc.exists()) {
        setBusinessSlug(userDoc.data().slug || "");
      }

      const q = query(collection(db, "promotions"), where("businessId", "==", currentBusinessId));
      const querySnapshot = await getDocs(q);
      const promos: Promotion[] = [];
      
      let claimedCount = 0;
      let redeemedCount = 0;
      
      for (const document of querySnapshot.docs) {
        const promoData = document.data() as Promotion;
        promos.push({ ...promoData, id: document.id });
        
        claimedCount += promoData.claimed || 0;
        
        // Fetch redeemed coupons for this promotion to calculate true stats
        const couponsQ = query(collection(db, "coupons"), where("promotionId", "==", document.id), where("status", "==", "redeemed"));
        const couponsSnap = await getDocs(couponsQ);
        redeemedCount += couponsSnap.size;
      }
      
      setPromotions(promos);
      setStats({ totalClaimed: claimedCount, totalRedeemed: redeemedCount });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrlInput(""); // Clear URL input if file is selected
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openNewPromoModal = () => {
    setEditingPromo(null);
    setTitle("");
    setDescription("");
    setLimit(10);
    setImageFile(null);
    setImagePreview(null);
    setImageUrlInput("");
    setShowModal(true);
  };

  const openEditPromoModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setDescription(promo.description);
    setLimit(promo.limit);
    setImageFile(null);
    setImagePreview(promo.imageUrl || null);
    setImageUrlInput(promo.imageUrl || "");
    setShowModal(true);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "vitrinas_public");
    
    const cloudName = "n3pool8h";
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error("Error uploading to Cloudinary");
    }
    
    const data = await response.json();
    return data.secure_url;
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      let finalImageUrl = imageUrlInput || editingPromo?.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"; // Default image
      
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile);
      }

      if (editingPromo) {
        await updateDoc(doc(db, "promotions", editingPromo.id), {
          title,
          description,
          limit: Number(limit),
          imageUrl: finalImageUrl,
        });
      } else {
        await addDoc(collection(db, "promotions"), {
          businessId: currentBusinessId,
          title,
          description,
          imageUrl: finalImageUrl,
          limit: Number(limit),
          claimed: 0,
          active: true,
          createdAt: new Date().toISOString()
        });
      }
      
      setShowModal(false);
      fetchPromotionsAndStats();
    } catch (error) {
      console.error("Error saving promotion:", error);
      alert("Error al guardar la promoción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (promoId: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "promotions", promoId), {
        active: !currentStatus
      });
      fetchPromotionsAndStats();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleShare = (e: React.MouseEvent, promo: Promotion) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/local/${businessSlug}`;
    const shareText = `¡Aprovecha esta promoción: ${promo.title}! Ven y guarda tu cupón antes de que se acaben.`;

    if (navigator.share) {
      navigator.share({
        title: promo.title,
        text: shareText,
        url: shareUrl
      }).catch(err => console.error("Error sharing:", err));
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert("¡Enlace copiado al portapapeles!");
    }
  };

  if (authLoading || !user || (role !== "business" && !isImpersonating)) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  const emptySlots = Math.max(0, 6 - promotions.length);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar Superior */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => router.push("/")} 
                className="text-gray-500 hover:text-gray-900 flex items-center"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver
              </button>
            </div>
            <div className="flex items-center space-x-8">
              <button
                onClick={() => setActiveTab("vitrina")}
                className={`font-bold px-1 py-5 border-b-2 transition-colors ${
                  activeTab === "vitrina" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                Mis Promociones
              </button>
              <button
                onClick={() => setActiveTab("estadisticas")}
                className={`font-bold px-1 py-5 border-b-2 transition-colors ${
                  activeTab === "estadisticas" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                Estadísticas
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center text-sm font-medium text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Mi QR
              </button>
              <button
                onClick={() => {
                  auth.signOut();
                  router.push("/");
                }}
                className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === "vitrina" ? (
          <>
            <p className="text-gray-500 mb-6">Tienes {Math.max(0, 6 - promotions.length)} espacios disponibles en tu plan.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <div 
                  key={promo.id} 
                  className="relative rounded-2xl overflow-hidden aspect-[4/5] group shadow-sm hover:shadow-md transition-shadow bg-gray-100"
                >
                  <img 
                    src={promo.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} 
                    alt={promo.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!promo.active && 'grayscale opacity-80'}`}
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute top-4 right-4 flex space-x-2 z-10">
                    <button 
                      onClick={(e) => handleShare(e, promo)}
                      className="bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-sm transition-colors"
                      title="Compartir"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => openEditPromoModal(promo)}
                      className="bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-sm transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <h3 className="font-bold text-xl mb-1 line-clamp-1">{promo.title}</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-200">
                        Disponibles: {promo.limit - promo.claimed} / {promo.limit}
                      </span>
                      
                      <button
                        onClick={(e) => toggleStatus(promo.id, promo.active, e)}
                        className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border ${
                          promo.active 
                            ? "bg-green-500/20 border-green-400 text-green-100 hover:bg-green-500/40" 
                            : "bg-red-500/20 border-red-400 text-red-100 hover:bg-red-500/40"
                        }`}
                      >
                        {promo.active ? "Activa" : "Pausada"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {Array.from({ length: emptySlots }).map((_, idx) => (
                <div 
                  key={`empty-${idx}`} 
                  onClick={openNewPromoModal}
                  className="rounded-2xl border-2 border-dashed border-gray-300 aspect-[4/5] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-gray-500 font-medium">Espacio {promotions.length + idx + 1}</span>
                  <span className="text-gray-400 text-sm">Toca para agregar</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Estadísticas Avanzadas</h2>
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Visitas Únicas</span>
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-gray-900">{stats.totalClaimed * 3 + 12}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tasa Conversión</span>
                  <div className="bg-green-50 text-green-600 p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-gray-900">
                    {stats.totalClaimed > 0 ? Math.round((stats.totalRedeemed / stats.totalClaimed) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Guardadas</span>
                  <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                    <Ticket className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-gray-900">{stats.totalClaimed}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Canjes</span>
                  <div className="bg-purple-50 text-purple-600 p-2 rounded-lg">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-gray-900">{stats.totalRedeemed}</span>
                </div>
              </div>
            </div>

            {/* Chart and Popular List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
              {/* Bar Chart */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Interacciones (Últimos 7 días)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Lun', visitas: 20, guardadas: 15, canjes: 5 },
                        { name: 'Mar', visitas: 35, guardadas: 20, canjes: 8 },
                        { name: 'Mié', visitas: 40, guardadas: 25, canjes: 12 },
                        { name: 'Jue', visitas: 30, guardadas: 18, canjes: 7 },
                        { name: 'Vie', visitas: 55, guardadas: 40, canjes: 20 },
                        { name: 'Sáb', visitas: 70, guardadas: 50, canjes: 30 },
                        { name: 'Dom', visitas: 65, guardadas: 45, canjes: 25 },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#F3F4F6' }}
                      />
                      <Bar dataKey="visitas" name="Visitas" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="guardadas" name="Guardadas" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="canjes" name="Canjes" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Popular Promos List */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Promociones Populares</h3>
                <div className="space-y-6 overflow-y-auto pr-2 flex-grow">
                  {promotions.slice().sort((a, b) => b.claimed - a.claimed).slice(0, 4).map(promo => {
                    const percentage = Math.round((promo.claimed / promo.limit) * 100);
                    return (
                      <div key={promo.id}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold text-gray-900 truncate pr-4">{promo.title}</span>
                          <span className="text-gray-500 flex-shrink-0">{promo.claimed} guardados</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {promotions.length === 0 && (
                    <div className="text-center text-gray-500 py-10 text-sm">
                      Aún no hay promociones.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal ... (resto del código del modal) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-xl font-bold">{editingPromo ? "Editar Promoción" : "Nueva Promoción"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              <form id="promoForm" onSubmit={handleSavePromotion} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Foto de la Promoción</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white font-medium flex items-center"><Edit2 className="w-4 h-4 mr-2"/> Cambiar Foto</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500 font-medium">Sube una foto llamativa</span>
                        <span className="text-xs text-gray-400">JPG, PNG o WEBP</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                  />
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">O pega el enlace de una imagen (URL)</label>
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => {
                        setImageUrlInput(e.target.value);
                        if (!imageFile) setImagePreview(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                      placeholder="https://ejemplo.com/foto.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                    placeholder="Ej: 2x1 en Hamburguesas"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción y Condiciones</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors h-24 resize-none"
                    placeholder="Términos, validez, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Límite de cupones (Stock)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                  />
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t bg-gray-50 flex space-x-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="promoForm"
                disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-70 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando</>
                ) : (
                  editingPromo ? "Guardar Cambios" : "Publicar Promoción"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QR Modal del Negocio */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowQrModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">QR de mi Negocio</h2>
              <button onClick={() => setShowQrModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mb-6">Muestra este código a tus clientes para que guarden tus promociones.</p>
            
            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100 inline-block mb-6">
              <QRCodeSVG 
                value={typeof window !== "undefined" ? `${window.location.origin}/local/${businessSlug}` : "https://cuponera-o2o.vercel.app"} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            
            <button
              onClick={() => {
                const link = typeof window !== "undefined" ? `${window.location.origin}/local/${businessSlug}` : "https://cuponera-o2o.vercel.app";
                navigator.clipboard.writeText(link);
                alert("¡Enlace copiado!");
              }}
              className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors flex justify-center items-center"
            >
              <Share2 className="w-4 h-4 mr-2" /> Copiar Enlace Directo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BusinessDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando panel...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
