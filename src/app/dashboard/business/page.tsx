"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Plus, Edit2, ArrowLeft, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface Promotion {
  id: string;
  title: string;
  description: string;
  limit: number;
  claimed: number;
  active: boolean;
  imageUrl?: string;
}

export default function BusinessDashboard() {
  const { user, role, loading } = useAuthStore();
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  // Modal state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState(10);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "business") {
        router.push("/");
      } else {
        fetchPromotions();
      }
    }
  }, [user, role, loading, router]);

  const fetchPromotions = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "promotions"), where("businessId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const promos: Promotion[] = [];
      querySnapshot.forEach((doc) => {
        promos.push({ id: doc.id, ...doc.data() } as Promotion);
      });
      setPromotions(promos);
    } catch (error) {
      console.error("Error fetching promotions:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
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
    setShowModal(true);
  };

  const openEditPromoModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setDescription(promo.description);
    setLimit(promo.limit);
    setImageFile(null);
    setImagePreview(promo.imageUrl || null);
    setShowModal(true);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
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
      let finalImageUrl = editingPromo?.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"; // Default image
      
      // If a new physical file was selected, upload it
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile);
      }

      if (editingPromo) {
        // Update existing
        await updateDoc(doc(db, "promotions", editingPromo.id), {
          title,
          description,
          limit: Number(limit),
          imageUrl: finalImageUrl,
        });
      } else {
        // Create new
        await addDoc(collection(db, "promotions"), {
          businessId: user.uid,
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
      fetchPromotions();
    } catch (error) {
      console.error("Error saving promotion:", error);
      alert("Error al guardar la promoción. Asegúrate de tener permisos de escritura en Storage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (promoId: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar abrir el modal al hacer clic en activar/desactivar
    try {
      await updateDoc(doc(db, "promotions", promoId), {
        active: !currentStatus
      });
      fetchPromotions();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  if (loading || !user || role !== "business") {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  // Lógica de grilla (ej. Vitrinas Digitales tiene "espacios")
  // Podemos mostrar las promociones existentes y luego llenar con placeholders hasta un máximo,
  // o simplemente mostrar una cuadrícula responsiva. Aquí usamos una cuadrícula estándar responsiva.
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
              <span className="text-blue-600 font-bold border-b-2 border-blue-600 px-1 py-5">
                Mi Vitrina
              </span>
              <span className="text-gray-500 font-medium px-1 py-5 hover:text-gray-700 cursor-pointer">
                Estadísticas
              </span>
            </div>
            <div className="flex items-center w-20"></div> {/* Spacer to center navbar links */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-500 mb-6">Tienes {Math.max(0, 6 - promotions.length)} espacios disponibles en tu plan.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          
          {/* Tarjetas de Promociones Existentes */}
          {promotions.map((promo) => (
            <div 
              key={promo.id} 
              className="relative rounded-2xl overflow-hidden aspect-[4/5] group shadow-sm hover:shadow-md transition-shadow bg-gray-100"
            >
              {/* Imagen de fondo */}
              <img 
                src={promo.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} 
                alt={promo.title}
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!promo.active && 'grayscale opacity-80'}`}
              />
              
              {/* Gradiente Oscuro inferior */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              {/* Botón Editar esquina superior */}
              <button 
                onClick={() => openEditPromoModal(promo)}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-sm z-10 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              
              {/* Contenido inferior */}
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

          {/* Tarjetas "Agregar" Vacías */}
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
      </div>

      {/* Modal de Creación / Edición */}
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
                
                {/* Zona de imagen */}
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
    </div>
  );
}
