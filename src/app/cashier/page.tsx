"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Scan, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

export default function CashierPage() {
  const { user, role, loading } = useAuthStore();
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else {
        // En una app real podríamos validar que el user sea cashier o business
        // Para este MVP permitiremos al business también usar la pantalla de cajero
        if (role !== "business" && role !== "cashier") {
          router.push("/");
        }
      }
    }
  }, [user, role, loading, router]);

  // Mantener el input siempre enfocado
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && status !== "processing") {
        inputRef.current.focus();
      }
    };
    
    focusInput();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, [status]);

  const processCoupon = async (code: string) => {
    setStatus("processing");
    setMessage("Verificando cupón...");
    
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setStatus("error");
        setMessage("Cupón no encontrado.");
        return;
      }
      
      const couponDoc = querySnapshot.docs[0];
      const couponData = couponDoc.data();
      
      if (couponData.status === "redeemed") {
        setStatus("error");
        setMessage("Este cupón ya fue canjeado.");
        return;
      }
      
      // Validar promoción
      const promoRef = doc(db, "promotions", couponData.promotionId);
      const promoSnap = await getDoc(promoRef);
      
      if (!promoSnap.exists() || !promoSnap.data().active) {
        setStatus("error");
        setMessage("La promoción asociada ya no está activa.");
        return;
      }
      
      // Marcar como canjeado
      await updateDoc(couponDoc.ref, {
        status: "redeemed",
        redeemedAt: new Date().toISOString()
      });
      
      setStatus("success");
      setMessage(`¡Éxito! Cupón de "${promoSnap.data().title}" canjeado.`);
      
    } catch (error) {
      console.error("Error processing coupon:", error);
      setStatus("error");
      setMessage("Error interno al procesar.");
    } finally {
      // Limpiar y volver a estado idle después de unos segundos
      setTimeout(() => {
        setInputValue("");
        setStatus("idle");
        setMessage("");
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim() !== "") {
      processCoupon(inputValue.trim());
    }
  };

  if (loading || !user || (role !== "business" && role !== "cashier")) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6">
        <button 
          onClick={() => router.push("/")} 
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" /> Salir de modo cajero
        </button>
      </div>

      <div className="w-full max-w-md text-center">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 relative overflow-hidden">
          
          {/* Decorative scanner line */}
          {status === "processing" && (
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-[pulse_1s_ease-in-out_infinite]" />
          )}

          <div className="mb-6 flex justify-center">
            {status === "idle" && <Scan className="w-16 h-16 text-blue-500" />}
            {status === "processing" && <Scan className="w-16 h-16 text-yellow-500 animate-pulse" />}
            {status === "success" && <CheckCircle className="w-16 h-16 text-green-500" />}
            {status === "error" && <XCircle className="w-16 h-16 text-red-500" />}
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Escáner de Cupones</h1>
          
          <p className={`text-sm mb-8 h-6 ${
            status === "success" ? "text-green-400 font-medium" : 
            status === "error" ? "text-red-400 font-medium" : 
            "text-gray-400"
          }`}>
            {message || "Listo para escanear. Acerque el código QR a la lectora."}
          </p>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            disabled={status !== "idle"}
            className="w-full bg-gray-900 border-2 border-gray-700 text-white text-center text-xl font-mono py-4 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-colors disabled:opacity-50"
            placeholder="Esperando código..."
            autoComplete="off"
          />
          
          <p className="text-xs text-gray-500 mt-6">
            La lectora enviará el código automáticamente.<br/>
            También puede ingresarlo manualmente y presionar Enter.
          </p>
        </div>
      </div>
    </div>
  );
}
