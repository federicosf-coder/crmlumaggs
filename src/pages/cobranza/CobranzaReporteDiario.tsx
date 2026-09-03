import { Navigate } from "react-router-dom";

// El reporte de cobranza ahora vive en la pantalla principal "/cobranza".
export default function CobranzaReporteDiario() {
  return <Navigate to="/cobranza" replace />;
}
