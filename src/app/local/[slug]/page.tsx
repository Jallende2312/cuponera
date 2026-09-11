"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter, useParams } from "next/navigation";
import { Tag, LayoutDashboard, Wallet, ScanLine, LogOut, ArrowLeft, Store } from "lucide-react";
import { signOut, signInAnonymously } from "firebase/auth";
import Link from "next/link";

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

interface BusinessProfile {
  id: string;
  businessName: string;
  status: string;
}

export default function BusinessPublicProfile() {
  const params = useParams();
  const slug = params?.slug as string;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { user, role, loading: authLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const fetchProfileAndPromotions = async () => {
      try {
        // 1. Encontrar el negocio por su slug
        const usersQ = query(
          collection(db, "users"), 
          where("role", "==", "business"), 
          where("slug", "==", slug)
        );
        const usersSnap = await getDocs(usersQ);
        
        if (usersSnap.empty) {
          setLoading(false);
          return; // No se encontró
        }

        const businessDoc = usersSnap.docs[0];
        const bizData = businessDoc.data();
        
        setBusiness({
          id: businessDoc.id,
          businessName: bizData.businessName || "Negocio sin nombre",
          status: bizData.status || "Activo"
        });

        // 2. Si está inactivo, no mostramos promociones
        if (bizData.status !== "Activo") {
          setLoading(false);
          return;
        }

        // 3. Buscar sus promociones activas
        const promosQ = query(
          collection(db, "promotions"), 
          where("businessId", "==", businessDoc.id),
          where("active", "==", true)
        );
        const promosSnap = await getDocs(promosQ);
        
        const promos: Promotion[] = [];
        promosSnap.forEach((doc) => {
          promos.push({ id: doc.id, ...doc.data() } as Promotion);
        });
        setPromotions(promos);
      } catch (error) {
        console.error("Error fetching business profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchProfileAndPromotions();
    }
  }, [slug]);

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
      // 1. Check if user already claimed this specific promotion
      const existingCouponQuery = query(
        collection(db, "coupons"), 
        where("promotionId", "==", promo.id), 
        where("userId", "==", currentUid)
      );
      const existingSnap = await getDocs(existingCouponQuery);
      
      if (!existingSnap.empty) {
        alert("¡Ya tienes este cupón! Te llevaremos a tu Billetera para que lo uses.");
        router.push("/dashboard/customer");
        return;
      }

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
    return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 mb-6 text-center">No pudimos encontrar la cuponera que estás buscando.</p>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors">
          Ir al Inicio
        </Link>
      </div>
    );
  }

  if (business.status !== "Activo") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Cuponera Inactiva</h1>
        <p className="text-gray-500 mb-6 text-center">Las promociones de {business.businessName} no están disponibles en este momento.</p>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors">
          Explorar otras ofertas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center text-blue-600 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
            <Tag className="w-6 h-6 mr-2" />
            Cuponera O2O
          </Link>
          
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
        <Link href="/" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a todas las ofertas
        </Link>

        <div className="mb-10 text-center md:text-left bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{business.businessName}</h1>
            <p className="text-gray-500 font-medium text-lg">Promociones exclusivas y cupones</p>
          </div>
          <div className="mt-6 md:mt-0 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-lg border border-blue-100">
            {promotions.length} {promotions.length === 1 ? 'oferta disponible' : 'ofertas disponibles'}
          </div>
        </div>

        {promotions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sin promociones activas</h3>
            <p className="text-gray-500 font-medium">Este negocio aún no tiene cupones disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map((promo) => {
              const isSoldOut = promo.claimed >= promo.limit;
              const remaining = promo.limit - promo.claimed;
              
              return (
                <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col hover:-translate-y-1">
                  {promo.imageUrl && (
                    <div className="w-full h-48 bg-gray-200 relative overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={promo.imageUrl} 
                        alt={promo.title} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-white/90 text-black px-4 py-1.5 rounded-full font-bold text-sm">AGOTADO</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-6 flex-grow">
                    <h3 className="font-bold text-xl text-gray-900 mb-3 leading-tight">{promo.title}</h3>
                    <p className="text-gray-600 text-sm mb-5 line-clamp-3 leading-relaxed">{promo.description}</p>
                    
                    <div className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-md ${
                      isSoldOut ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    }`}>
                      {isSoldOut ? "¡Se han agotado todos los cupones!" : `¡Quedan ${remaining} cupones!`}
                    </div>
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50">
                    <button
                      onClick={() => handleClaim(promo)}
                      disabled={isSoldOut}
                      className={`w-full py-3 rounded-xl font-bold transition-all duration-200 shadow-sm ${
                        isSoldOut 
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                          : "bg-blue-600 hover:bg-blue-700 hover:shadow text-white active:scale-[0.98]"
                      }`}
                    >
                      {isSoldOut ? "Agotado" : "Reclamar Cupón Gratis"}
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
