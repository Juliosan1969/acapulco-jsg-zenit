// Zonas críticas de inundación y escurrimiento pluvial en Acapulco
export const PUNTOS_CRITICOS_ACAPULCO = [
  {
    id: 'juan-de-la-cosa',
    nombre: 'Cuenca Calle Juan de la Cosa - Costera',
    descripcion: 'Punto crítico de saturación del colector pluvial hacia playa El Morro.',
    lat: 16.8572,
    lng: -99.8731,
    radioM: 180,
    nivelRiesgo: 'Alto'
  },
  {
    id: 'glorieta-diana',
    nombre: 'Glorieta de la Diana Cazadora',
    descripcion: 'Acumulación de escorrentía superficial de laderas del anfiteatro.',
    lat: 16.8565,
    lng: -99.8682,
    radioM: 130,
    nivelRiesgo: 'Medio'
  },
  {
    id: 'crucero-cayaco',
    nombre: 'Bifurcación Carretera Cayaco - Llano Largo',
    descripcion: 'Desbordamiento de cauces secundarios cercanos a la cuenca de La Sabana.',
    lat: 16.8385,
    lng: -99.8240,
    radioM: 200,
    nivelRiesgo: 'Alto'
  }
];
// Cálculo de proximidad para evaluar si la ruta entra en zona de riesgo
export function evaluarRiesgoRuta(coordenadasRuta) {
  const R = 6371e3; // Radio de la Tierra en metros
  const alertas = [];
  coordenadasRuta.forEach(([lat, lng]) => {
    PUNTOS_CRITICOS_ACAPULCO.forEach(punto => {
      const phi1 = (lat * Math.PI) / 180;
      const phi2 = (punto.lat * Math.PI) / 180;
      const deltaPhi = ((punto.lat - lat) * Math.PI) / 180;
      const deltaLambda = ((punto.lng - lng) * Math.PI) / 180;
      const a = Math.sin(deltaPhi / 2) ** 2 +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distancia = R * c;
      if (distancia <= punto.radioM) {
        if (!alertas.some(a => a.id === punto.id)) {
          alertas.push(punto);
        }
      }
    });
  });
  return alertas;
}
