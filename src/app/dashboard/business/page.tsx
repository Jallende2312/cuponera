"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Plus, Tag, ArrowLeft } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState(10);
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "promotions"), {
        businessId: user.uid,
        title,
        description,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", // Default image if empty
        limit: Number(limit),
        claimed: 0,
        active: true,
        createdAt: new Date().toISOString()
      });
      
      // Reset form
      setTitle("");
      setDescription("");
      setImageUrl("");
      setLimit(10);
      setShowForm(false);
      
      // Refresh list
      fetchPromotions();
    } catch (error) {
      console.error("Error creating promotion:", error);
      alert("Error al crear la promoción");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (promoId: string, currentStatus: boolean) => {
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button 
              onClick={() => router.push("/")} 
              className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver al inicio
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Negocio</h1>
            <p className="text-gray-600">Administra tus promociones y cupones</p>
          </div>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
            >
              <Plus className="w-5 h-5 mr-1" />
              Nueva Promo
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Crear Nueva Promoción</h2>
            <form onSubmit={handleCreatePromotion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: 2x1 en Hamburguesas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de la Imagen (Opcional)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                  placeholder="Condiciones, días de validez, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Límite de cupones</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full md:w-1/3 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Guardando..." : "Publicar"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Tus Promociones</h2>
          </div>
          
          {promotions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Tag className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>Aún no has creado ninguna promoción.</p>
            </div>
          ) : (
            <div className="divide-y">
              {promotions.map((promo) => (
                <div key={promo.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between">
                  <div className="mb-4 md:mb-0">
                    <h3 className="font-bold text-lg text-gray-900">{promo.title}</h3>
                    <div className="flex space-x-4 text-sm mt-1">
                      <span className="text-gray-500">Reclamados: <strong className="text-gray-900">{promo.claimed} / {promo.limit}</strong></span>
                      <span className={`font-medium ${promo.active ? "text-green-600" : "text-gray-400"}`}>
                        {promo.active ? "Activa" : "Pausada"}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleStatus(promo.id, promo.active)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      promo.active 
                        ? "border border-red-200 text-red-600 hover:bg-red-50" 
                        : "border border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {promo.active ? "Pausar Promo" : "Activar Promo"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
