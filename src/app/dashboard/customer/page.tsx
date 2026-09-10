"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Wallet, CheckCircle, Clock } from "lucide-react";

interface Coupon {
  id: string; // The coupon code
  code: string;
  promotionId: string;
  status: "active" | "redeemed";
  claimedAt: string;
  promotionTitle?: string;
}

export default function CustomerDashboard() {
  const { user, role, loading } = useAuthStore();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "customer") {
        router.push("/");
      } else {
        fetchCoupons();
      }
    }
  }, [user, role, loading, router]);

  const fetchCoupons = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "coupons"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const userCoupons: Coupon[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const couponData = docSnapshot.data();
        
        // Fetch promotion title
        let promoTitle = "Promoción Desconocida";
        try {
          const promoDoc = await getDoc(doc(db, "promotions", couponData.promotionId));
          if (promoDoc.exists()) {
            promoTitle = promoDoc.data().title;
          }
        } catch (e) {
          console.error("Error fetching promo:", e);
        }

        userCoupons.push({
          id: docSnapshot.id,
          code: couponData.code,
          promotionId: couponData.promotionId,
          status: couponData.status,
          claimedAt: couponData.claimedAt,
          promotionTitle: promoTitle
        });
      }
      
      // Sort by newest first
      userCoupons.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
      
      setCoupons(userCoupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setFetching(false);
    }
  };

  if (loading || !user || role !== "customer") {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <button 
            onClick={() => router.push("/")} 
            className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a promociones
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Wallet className="w-6 h-6 mr-2 text-blue-600" /> Mi Billetera
          </h1>
          <p className="text-gray-600">Muestra el código QR al cajero para canjear tu oferta</p>
        </div>

        {fetching ? (
          <div className="text-center py-10">Cargando tus cupones...</div>
        ) : coupons.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">Billetera vacía</h2>
            <p className="text-gray-500 mb-6">Aún no has reclamado ninguna promoción.</p>
            <button 
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Explorar Ofertas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coupons.map(coupon => (
              <div 
                key={coupon.id}
                onClick={() => coupon.status === "active" && setSelectedCoupon(coupon)}
                className={`bg-white rounded-xl border p-5 transition-all ${
                  coupon.status === "active" 
                    ? "shadow-sm hover:shadow-md cursor-pointer border-blue-100" 
                    : "opacity-60 bg-gray-50 cursor-default"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 line-clamp-2 pr-2">{coupon.promotionTitle}</h3>
                  {coupon.status === "active" ? (
                    <span className="flex items-center text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full whitespace-nowrap">
                      <Clock className="w-3 h-3 mr-1" /> Activo
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full whitespace-nowrap">
                      <CheckCircle className="w-3 h-3 mr-1" /> Canjeado
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mb-4">
                  Reclamado el {new Date(coupon.claimedAt).toLocaleDateString()}
                </p>
                
                {coupon.status === "active" && (
                  <div className="text-center pt-3 border-t border-dashed">
                    <span className="text-blue-600 font-medium text-sm">Toca para ver QR</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* QR Modal */}
        {selectedCoupon && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedCoupon(null)}>
            <div 
              className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl transform transition-all"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedCoupon.promotionTitle}</h2>
              <p className="text-gray-500 text-sm mb-8">Muestra este código al cajero</p>
              
              <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100 inline-block mb-6">
                <QRCodeSVG 
                  value={selectedCoupon.code} 
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              
              <div className="bg-gray-50 py-3 rounded-lg border border-gray-100 mb-6">
                <span className="font-mono text-lg font-bold tracking-widest text-gray-800">
                  {selectedCoupon.code}
                </span>
              </div>
              
              <button
                onClick={() => setSelectedCoupon(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
