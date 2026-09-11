import Link from "next/link";
import { Ticket, Zap, BarChart3, Users, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-100">
      {/* Navigation */}
      <nav className="border-b border-gray-100 relative z-10 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2 text-blue-600 font-black text-xl">
              <Ticket className="w-6 h-6" />
              <span>Cuponera O2O</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-gray-600 font-medium hover:text-gray-900 transition-colors"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <div className="relative pt-20 pb-20 lg:pt-32 lg:pb-28 overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-8">
              Digitaliza tus Cupones con <span className="text-blue-600">Zero-Fricción</span>
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto mb-10">
              La plataforma ideal para negocios físicos. Crea tu propia cuponera digital, compártela mediante QR y atrae más clientes sin obligarlos a descargar apps ni crear contraseñas.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Entrar a mi Panel <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">Todo lo que tu negocio necesita</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">0 Fricción para el Cliente</h3>
                <p className="text-gray-500 leading-relaxed">
                  Tus clientes guardan promociones con un solo clic. No necesitan registrarse ni recordar contraseñas gracias a nuestra tecnología de autenticación invisible.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Sitio Propio Exclusivo</h3>
                <p className="text-gray-500 leading-relaxed">
                  No eres uno más en un catálogo gigante. Tendrás tu propio enlace exclusivo donde los clientes solo verán TUS promociones.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Métricas en Tiempo Real</h3>
                <p className="text-gray-500 leading-relaxed">
                  Mide el impacto de tus campañas. Descubre cuántas personas ven tus cupones, cuántos los guardan y cuántos terminan comprando en tu local.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Cuponera O2O. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
