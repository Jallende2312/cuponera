"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, setDoc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Tag, LogOut, LayoutDashboard, Wallet, ScanLine } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { signOut, signInAnonymously } from "firebase/auth";

interface Promotion {
  id: string;
  title: string;
  description: string;
  limit: number;
  claimed: number;
  businessId: string;
  active: boolean;
  imageUrl?: string;
}

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, role, loading: authLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const q = query(collection(db, "promotions"), where("active", "==", true));
        const querySnapshot = await getDocs(q);
        const promos: Promotion[] = [];
        querySnapshot.forEach((doc) => {
          promos.push({ id: doc.id, ...doc.data() } as Promotion);
        });
        setPromotions(promos);
      } catch (error) {
        console.error("Error fetching promotions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, []);

  const handleClaim = async (promo: Promotion) => {
    let currentUid = user?.uid;
    let currentRole = role;

    if (!user) {
      try {
        const userCred = await signInAnonymously(auth);
        currentUid = userCred.user.uid;
        currentRole = "customer";
      } catch (err) {
        console.error("Error with anonymous auth:", err);
        alert("Error de autenticación. Intenta de nuevo.");
        return;
      }
    }

    if (currentRole !== "customer") {
      alert("Solo los clientes pueden reclamar cupones.");
      return;
    }

    if (promo.claimed >= promo.limit) {
      alert("¡Esta promoción se ha agotado!");
      return;
    }

    try {
      // Create a unique coupon code
      const couponCode = `CPN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Save the coupon
      await setDoc(doc(db, "coupons", couponCode), {
        promotionId: promo.id,
        userId: currentUid,
        code: couponCode,
        status: "active",
        claimedAt: new Date().toISOString()
      });

      // Update promotion claimed count
      const promoRef = doc(db, "promotions", promo.id);
      await updateDoc(promoRef, {
        claimed: increment(1)
      });

      alert("¡Cupón reclamado con éxito! Revisa tu billetera.");
      router.push("/dashboard/customer");
    } catch (error) {
      console.error("Error claiming coupon:", error);
      alert("Hubo un error al reclamar el cupón.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center text-blue-600 font-bold text-xl tracking-tight">
            <Tag className="w-6 h-6 mr-2" />
            Cuponera O2O
          </div>
          
          <div className="flex items-center space-x-4">
            {!user ? (
              <button 
                onClick={() => router.push("/login")}
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Iniciar Sesión
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                {role === "business" && (
                  <button onClick={() => router.push("/dashboard/business")} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="Mi Panel">
                    <LayoutDashboard className="w-5 h-5" />
                  </button>
                )}
                {role === "customer" && (
                  <button onClick={() => router.push("/dashboard/customer")} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="Mi Billetera">
                    <Wallet className="w-5 h-5" />
                  </button>
                )}
                {role === "cashier" && (
                  <button onClick={() => router.push("/cashier")} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="Escanear">
                    <ScanLine className="w-5 h-5" />
                  </button>
                )}
                {!user.isAnonymous && (
                  <button onClick={handleSignOut} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Cerrar Sesión">
                    <LogOut className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Descubre Ofertas Exclusivas</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Reclama cupones de tus lugares favoritos y canjéalos directamente en el local mostrando el código QR desde tu celular.</p>
        </div>

        {promotions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay promociones activas en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map((promo) => {
              const isSoldOut = promo.claimed >= promo.limit;
              const remaining = promo.limit - promo.claimed;
              
              return (
                <div key={promo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                  {promo.imageUrl && (
                    <div className="w-full h-48 bg-gray-200 relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={promo.imageUrl} 
                        alt={promo.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6 flex-grow">
                    <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-2">{promo.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{promo.description}</p>
                    
                    <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-50 inline-block px-3 py-1 rounded-full">
                      {isSoldOut ? "Agotado" : `Quedan ${remaining} de ${promo.limit}`}
                    </div>
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50">
                    <button
                      onClick={() => handleClaim(promo)}
                      disabled={isSoldOut}
                      className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                        isSoldOut 
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      }`}
                    >
                      {isSoldOut ? "Agotado" : "Reclamar Cupón"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
