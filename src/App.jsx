import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, MapPin, Phone, MessageSquare, ShieldAlert, Navigation, X, Route, CloudRain, AlertTriangle, Crosshair, HeartHandshake, Shield, User } from 'lucide-react';
import { SERVICIOS_ACAPULCO } from './servicios.js';
import { PUNTOS_CRITICOS_ACAPULCO, evaluarRiesgoRuta } from './hidrologia.js';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const obtenerColorCategoria = (cat) => {
  switch (cat) {
    case 'violeta': return '#a855f7';   // Morado/Violeta para seguridad de mujer
    case 'emergencia': return '#ef4444'; // Rojo albergue/urgencias
    case 'salud': return '#10b981';      // Verde salud
    case 'comercio': return '#f59e0b';   // Ámbar restaurantes
    case 'turismo': return '#3b82f6';    // Azul turismo
    default: return '#6366f1';
  }
};
export default function App() {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const routeLayerRef = useRef(null);
  const serviceMarkersRef = useRef([]);
  const touristMarkerRef = useRef(null);
  const radarLayerRef = useRef(null);
  // Perfil del Usuario: 'general' (Hombre/Ciudadano) o 'mujer' (Protocolo Violeta)
  const [perfil, setPerfil] = useState('mujer');
  const [coords, setCoords] = useState({ lat: 16.8531, lng: -99.8785 });
  const [zona, setZona] = useState('Acapulco Dorado / Costera');
  const [filtro, setFiltro] = useState('todos');
  const [infoRuta, setInfoRuta] = useState(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [buscandoGPS, setBuscandoGPS] = useState(false);
  const [mostrarRadar, setMostrarRadar] = useState(false);
  // Inicializar mapa
  useEffect(() => {
    if (!mapInstance.current && mapContainer.current) {
      const map = L.map(mapContainer.current, { zoomControl: false }).setView([16.8531, -99.8785], 14);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | JSG ZENIT 360',
        maxZoom: 19
      }).addTo(map);
      PUNTOS_CRITICOS_ACAPULCO.forEach(p => {
        const circle = L.circle([p.lat, p.lng], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.16,
          radius: p.radioM,
          weight: 2,
          dashArray: '4, 6'
        }).addTo(map);
        circle.bindTooltip('⚠️ ' + p.nombre + ' (' + p.nivelRiesgo + ')', { permanent: false, direction: 'top' });
      });
      const iconAvatar = L.divIcon({
        className: 'avatar-pin',
        html: '<div style="background:' + (perfil === 'mujer' ? '#a855f7' : '#2563eb') + ';color:white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.4);border:2.5px solid white;font-size:20px;cursor:grab;">' + (perfil === 'mujer' ? '👩' : '🚶') + '</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      const marker = L.marker([16.8531, -99.8785], { draggable: true, icon: iconAvatar }).addTo(map);
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setCoords({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });
        
        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }
        setInfoRuta(null);
        if (lng > -99.83) {
          setZona('Acapulco Diamante & Barra Vieja');
        } else if (lat < 16.835 && lng < -99.89) {
          setZona('Acapulco Tradicional / Caleta');
        } else {
          setZona('Acapulco Dorado / Costera');
        }
      });
      touristMarkerRef.current = marker;
      mapInstance.current = map;
    }
  }, []);
  // Actualizar avatar cuando cambia el perfil
  useEffect(() => {
    if (touristMarkerRef.current) {
      const iconAvatar = L.divIcon({
        className: 'avatar-pin',
        html: '<div style="background:' + (perfil === 'mujer' ? '#a855f7' : '#2563eb') + ';color:white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.4);border:2.5px solid white;font-size:20px;cursor:grab;">' + (perfil === 'mujer' ? '👩' : '🚶') + '</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      touristMarkerRef.current.setIcon(iconAvatar);
    }
  }, [perfil]);
  // Radar meteorológico con límite nativo de zoom
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    if (mostrarRadar) {
      if (!radarLayerRef.current) {
        radarLayerRef.current = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/nowcast_5/256/{z}/{x}/{y}/2/1_1.png', {
          opacity: 0.55,
          zIndex: 500,
          minZoom: 4,
          maxNativeZoom: 8,
          maxZoom: 19
        }).addTo(map);
      }
    } else if (radarLayerRef.current) {
      map.removeLayer(radarLayerRef.current);
      radarLayerRef.current = null;
    }
  }, [mostrarRadar]);
  // Activación de GPS Satelital Automático
  const obtenerUbicacionGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador o dispositivo no soporta geolocalización.');
      return;
    }
    setBuscandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const lat = Number(latitude.toFixed(4));
        const lng = Number(longitude.toFixed(4));
        setCoords({ lat, lng });
        if (touristMarkerRef.current && mapInstance.current) {
          touristMarkerRef.current.setLatLng([lat, lng]);
          mapInstance.current.flyTo([lat, lng], 15, { duration: 1.5 });
        }
        if (routeLayerRef.current && mapInstance.current) {
          mapInstance.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }
        setInfoRuta(null);
        if (lng > -99.83) {
          setZona('Acapulco Diamante & Barra Vieja');
        } else if (lat < 16.835 && lng < -99.89) {
          setZona('Acapulco Tradicional / Caleta');
        } else {
          setZona('Acapulco Dorado / Costera');
        }
        setBuscandoGPS(false);
      },
      (err) => {
        console.error(err);
        alert('No se pudo obtener la ubicación GPS. Verifica que los permisos estén habilitados en tu navegador.');
        setBuscandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  // Pines de Servicios y Espacios Violeta
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    serviceMarkersRef.current.forEach(m => map.removeLayer(m));
    serviceMarkersRef.current = [];
    let lista = SERVICIOS_ACAPULCO;
    if (filtro !== 'todos') {
      lista = lista.filter(s => s.categoria === filtro);
    }
    lista.forEach(s => {
      const colorBorde = obtenerColorCategoria(s.categoria);
      const pinHtml = '<div style="background:#ffffff;border:3px solid ' + colorBorde + ';border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 10px rgba(0,0,0,0.3);cursor:pointer;">' + s.icono + '</div>';
      const pinIcon = L.divIcon({
        className: 'compact-circle-marker',
        html: pinHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
      const marker = L.marker([s.lat, s.lng], { icon: pinIcon }).addTo(map);
      marker.bindPopup(
        '<div style="font-family:system-ui;min-width:200px;padding:2px;">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
            '<span style="font-size:18px;">' + s.icono + '</span>' +
            '<b style="font-size:13px;color:#0f172a;">' + s.nombre + '</b>' +
          '</div>' +
          '<span style="background:' + colorBorde + '1a;color:' + colorBorde + ';font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;">' + s.tipo + '</span>' +
          '<p style="font-size:11px;color:#475569;margin:6px 0 0 0;">' + s.desc + '</p>' +
        '</div>'
      );
      serviceMarkersRef.current.push(marker);
    });
  }, [filtro, perfil]);
  // Ruteo
  const calcularRutaHacia = async (destino) => {
    setCargandoRuta(true);
    const map = mapInstance.current;
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    try {
      const url = 'https://router.project-osrm.org/route/v1/driving/' + coords.lng + ',' + coords.lat + ';' + destino.lng + ',' + destino.lat + '?overview=full&geometries=geojson';
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) {
        alert('No se encontró ruta disponible.');
        setCargandoRuta(false);
        return;
      }
      const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const advertencias = evaluarRiesgoRuta(routeCoords);
      const polyline = L.polyline(routeCoords, {
        color: advertencias.length > 0 ? '#ef4444' : (perfil === 'mujer' ? '#a855f7' : '#2563eb'),
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        dashArray: '2, 6'
      }).addTo(map);
      routeLayerRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      setInfoRuta({
        destino: destino.nombre,
        distanciaKm: (data.routes[0].distance / 1000).toFixed(2),
        minutos: Math.round(data.routes[0].duration / 60),
        alertas: advertencias
      });
    } catch (err) {
      console.error(err);
      alert('Error calculando la ruta.');
    } finally {
      setCargandoRuta(false);
    }
  };
  const limpiarRuta = () => {
    if (routeLayerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    setInfoRuta(null);
  };
  const listaFiltrada = filtro === 'todos'
    ? SERVICIOS_ACAPULCO
    : SERVICIOS_ACAPULCO.filter(s => s.categoria === filtro);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      
      {/* Encabezado */}
      <header style={{ height: '56px', padding: '0 18px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: perfil === 'mujer' ? '#a855f7' : '#2563eb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
            <Compass size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>ACAPULCO JSG ZENIT</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
              {perfil === 'mujer' ? 'Modo Protección & Protocolo Violeta' : 'Plataforma Ciudadana 360°'}
            </p>
          </div>
        </div>
        {/* Selector de Perfil y Botón GPS */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Selector Mujer / General */}
          <div style={{ display: 'flex', background: '#1e293b', borderRadius: '20px', padding: '2px', border: '1px solid #334155' }}>
            <button
              onClick={() => { setPerfil('mujer'); setFiltro('todos'); }}
              style={{
                background: perfil === 'mujer' ? '#a855f7' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <HeartHandshake size={13} /> Protocolo Violeta
            </button>
            <button
              onClick={() => {
                setPerfil('general');
                setFiltro((actual) => (actual === 'violeta' ? 'todos' : actual));
              }}
              style={{
                background: perfil === 'general' ? '#2563eb' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <User size={13} /> General
            </button>
          </div>
          {/* Botón GPS Real */}
          <button
            onClick={obtenerUbicacionGPS}
            disabled={buscandoGPS}
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Crosshair size={14} /> {buscandoGPS ? 'Localizando...' : 'Mi GPS'}
          </button>
          <button
            onClick={() => setMostrarRadar(!mostrarRadar)}
            style={{
              background: mostrarRadar ? '#3b82f6' : '#1e293b',
              color: mostrarRadar ? 'white' : '#94a3b8',
              border: '1px solid #334155',
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CloudRain size={14} /> {mostrarRadar ? 'Ocultar Radar' : 'Radar'}
          </button>
        </div>
      </header>
      {/* Mapa y Paneles */}
      <div style={{ position: 'relative', flex: 1 }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        {/* Tarjeta de Ruta Calculada */}
        {infoRuta && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(15,23,42,0.96)', border: infoRuta.alertas.length > 0 ? '1.5px solid #ef4444' : (perfil === 'mujer' ? '1.5px solid #a855f7' : '1.5px solid #3b82f6'), borderRadius: '12px', padding: '14px 18px', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: perfil === 'mujer' ? '#a855f7' : '#2563eb', borderRadius: '50%', padding: '8px', display: 'flex' }}>
                <Route size={18} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', color: perfil === 'mujer' ? '#d8b4fe' : '#60a5fa', textTransform: 'uppercase', fontWeight: 'bold' }}>Ruta Segura Hacia:</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>{infoRuta.destino}</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Distancia: <b>{infoRuta.distanciaKm} km</b> • Tiempo: <b>{infoRuta.minutos} min</b></div>
              </div>
              <button onClick={limpiarRuta} style={{ background: '#334155', border: 'none', color: '#cbd5e1', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>
            {infoRuta.alertas.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '11px', color: '#fca5a5' }}>
                  <b>Alerta de Escorrentía:</b> Tramo con riesgo en {infoRuta.alertas.map(a => a.nombre).join(', ')}.
                </div>
              </div>
            )}
          </div>
        )}
        {/* Panel Lateral */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', width: '360px', maxHeight: 'calc(100vh - 86px)', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '14px', border: perfil === 'mujer' ? '1px solid #7e22ce' : '1px solid #334155', zIndex: 1000, boxShadow: '0 12px 30px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}>
          
          {/* Banner de Auxilio Rápido si es Protocolo Mujer */}
          {perfil === 'mujer' && (
            <div style={{ background: 'linear-gradient(135deg, #7e22ce, #9333ea)', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} /> Botón de Emergencia Violeta
                </div>
                <div style={{ fontSize: '10px', opacity: 0.9 }}>Enlace directo a Policía de Género</div>
              </div>
              <a href="tel:911" style={{ background: 'white', color: '#7e22ce', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '11px', textDecoration: 'none' }}>
                SOS 911
              </a>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '10px', color: perfil === 'mujer' ? '#d8b4fe' : '#60a5fa', fontWeight: 'bold', textTransform: 'uppercase' }}>Posición de Usuario</span>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{zona}</h2>
            </div>
            <MapPin size={20} color={perfil === 'mujer' ? '#a855f7' : '#60a5fa'} />
          </div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'todos', label: 'Todos' },
              ...(perfil === 'mujer' ? [{ id: 'violeta', label: '💜 Red Violeta' }] : []),
              { id: 'turismo', label: 'Tours' },
              { id: 'comercio', label: 'Comercios' },
              { id: 'salud', label: 'Salud' },
              { id: 'emergencia', label: 'Albergues/SOS' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                style={{
                  background: filtro === f.id ? (perfil === 'mujer' ? '#a855f7' : '#2563eb') : '#1e293b',
                  color: filtro === f.id ? 'white' : '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: filtro === f.id ? 'bold' : 'normal'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Lista de Servicios */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {listaFiltrada.map(s => {
              const colorDistintivo = obtenerColorCategoria(s.categoria);
              return (
                <div key={s.id} style={{ background: '#1e293b', padding: '10px', borderRadius: '10px', border: s.categoria === 'violeta' ? '1.5px solid #a855f7' : '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{s.icono}</span>
                        <span>{s.nombre}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        <span style={{ color: colorDistintivo, fontWeight: 'bold' }}>{s.tipo}</span> • <span style={{ color: '#93c5fd' }}>{s.zona}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '4px 0 0 0' }}>{s.desc}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => calcularRutaHacia(s)}
                      disabled={cargandoRuta}
                      style={{
                        background: perfil === 'mujer' ? '#a855f7' : '#2563eb',
                        border: 'none',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Navigation size={12} />
                      {cargandoRuta ? 'Calculando...' : 'Trazar Ruta'}
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {s.tel && (
                        <a href={'https://wa.me/52' + s.tel} target="_blank" rel="noreferrer" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold' }}>
                          <MessageSquare size={13} /> WA
                        </a>
                      )}
                      {s.tel && (
                        <a href={'tel:' + s.tel} style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '11px' }}>
                          <Phone size={13} /> Llamar
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Pie */}
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
            <span>Lat: {coords.lat} | Lng: {coords.lng}</span>
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
              <ShieldAlert size={14} /> Suelo: 45% absorción
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
