import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import axios from "axios"

const GOOGLE_MAPS_API_KEY: any = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const BASE_URL = "http://localhost:3000"

// Sample IMEI list for dropdown - replace with your actual data source
const SAMPLE_IMEI_LIST = [
  { value: "700070635323", label: "Device 700070635323" },
  { value: "700070635324", label: "Device 700070635324" },
  { value: "700070635325", label: "Device 700070635325" },
  { value: "700070635326", label: "Device 700070635326" },
  { value: "800070635323", label: "Device 800070635323" },
  { value: "900070635323", label: "Device 900070635323" },
  { value: "700080635323", label: "Device 700080635323" },
  { value: "700090635323", label: "Device 700090635323" },
]

interface TrackDataPoint {
  _id: string
  latitude: number
  longitude: number
  imei: string
  altitude: number
  bearing: number
  dateTime: string
}

interface TrackDataResponse {
  success: boolean
  count: number
  data: TrackDataPoint[]
}

interface IMEIOption {
  value: string
  label: string
}

const GoogleMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null)
  const [startMarker, setStartMarker] = useState<google.maps.Marker | null>(null)
  const [endMarker, setEndMarker] = useState<google.maps.Marker | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const animationRef = useRef<number | null>(null)
  const countRef = useRef<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackData, setTrackData] = useState<TrackDataPoint[]>([])
  const [animationSpeed, setAnimationSpeed] = useState<number>(20) // Default animation interval in ms
  
  // Filter inputs
  const [selectedImei, setSelectedImei] = useState<string>("700070635323")
  const [startDate, setStartDate] = useState<string>("2025-03-18T10:07:58Z")
  const [endDate, setEndDate] = useState<string>("2025-03-18T10:08:57Z")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showImeiDropdown, setShowImeiDropdown] = useState<boolean>(false)

  // Filter the IMEI list based on search query
  const filteredImeiList = SAMPLE_IMEI_LIST.filter(imei => 
    imei.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    imei.value.includes(searchQuery)
  )

  // Convert local time to UTC
  const convertToUTC = (localDateTimeStr: string): string => {
    if (!localDateTimeStr) return "";
    
    const localDate = new Date(localDateTimeStr);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  }

  const fetchTrackData = async () => {
    if (!selectedImei || !startDate || !endDate) {
      setError("Please select IMEI, start date, and end date");
      return;
    }
    
    setLoading(true)
    setError(null)
    
    // Clear existing markers and polyline
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);
    if (polyline) polyline.setMap(null);
    
    // Reset animation
    handleReset();
    
    try {
      // Convert local times to UTC for API request
      const utcStartDate = convertToUTC(startDate);
      const utcEndDate = convertToUTC(endDate);
      
      const response = await axios.get<TrackDataResponse>(
        `${BASE_URL}/trackdata`,
        {
          params: {
            startDate: utcStartDate,
            endDate: utcEndDate,
            imei: selectedImei
          },
          headers: {
            "Content-Type": "application/json",
            // "X-API-Key": "your-api-key"
          }
        }
      )
      
      if (response.data.success && response.data.data.length > 0) {
        setTrackData(response.data.data)
      } else {
        setError("No track data available for the selected criteria")
      }
    } catch (err) {
      setError("Failed to fetch track data")
      console.error("Error fetching track data:", err)
    } finally {
      setLoading(false)
    }
  }

  // Initialize map once
  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["geometry"],
      })

      try {
        const google = await loader.load()
        if (mapRef.current) {
          const mapInstance = new google.maps.Map(mapRef.current, {
            center: { lat: 20.5937, lng: 78.9629 }, // India center coordinates as default
            zoom: 5,
            mapTypeId: "terrain",
          })
          setMap(mapInstance)
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setError("Failed to load Google Maps")
      }
    }

    initMap()

    return () => {
      if (animationRef.current) {
        window.clearInterval(animationRef.current)
      }
    }
  }, [])

  // Draw track line once data is available
  useEffect(() => {
    if (!map || trackData.length === 0) return

    const drawTrack = async () => {
      // Clean up previous polyline and markers
      if (polyline) polyline.setMap(null);
      if (startMarker) startMarker.setMap(null);
      if (endMarker) endMarker.setMap(null);

      try {
        const path = trackData.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        }))

        // Create start and end markers
        if (path.length > 0) {
          // Start marker (green)
          const startPoint = path[0];
          const newStartMarker = new google.maps.Marker({
            position: startPoint,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#4CAF50",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            title: "Start Point"
          });
          setStartMarker(newStartMarker);
          
          // End marker (red)
          const endPoint = path[path.length - 1];
          const newEndMarker = new google.maps.Marker({
            position: endPoint,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#f44336",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            title: "End Point"
          });
          setEndMarker(newEndMarker);
        }

        const lineSymbol = {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          strokeColor: "#393",
        }

        const polylineInstance = new google.maps.Polyline({
          path: path,
          icons: [
            {
              icon: lineSymbol,
              offset: "0%",
            },
          ],
          map: map,
          strokeColor: "#2196F3",
          strokeOpacity: 0.8,
          strokeWeight: 3,
        })

        setPolyline(polylineInstance)

        // Fit the map to the polyline bounds
        if (path.length > 0) {
          const bounds = new google.maps.LatLngBounds()
          path.forEach((coord) => bounds.extend(coord))
          map.fitBounds(bounds)
        }
        
        // Reset animation counter
        countRef.current = 0
        
      } catch (error) {
        console.error("Error drawing track:", error)
      }
    }

    drawTrack()
  }, [map, trackData])

  // Reset animation when speed changes while playing
  useEffect(() => {
    if (isPlaying && polyline) {
      if (animationRef.current) {
        window.clearInterval(animationRef.current)
      }
      animateSymbol(polyline)
    }
  }, [animationSpeed])

  const animateSymbol = (line: google.maps.Polyline) => {
    animationRef.current = window.setInterval(() => {
      countRef.current = (countRef.current + 1) % 201  // Use 201 instead of 200
      
      if (line && line.get) {
        const icons = line.get("icons")
        if (icons && icons[0]) {
          // Calculate offset from 0% to 100%
          icons[0].offset = (countRef.current / 2) + "%"
          line.set("icons", icons)
  
          // Stop at 100%
          if (countRef.current === 200) {
            if (animationRef.current) {
              window.clearInterval(animationRef.current)
            }
            setIsPlaying(false)
          }
        }
      }
    }, animationSpeed)
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      if (animationRef.current) {
        window.clearInterval(animationRef.current)
      }
      setIsPlaying(false)
    } else {
      if (polyline) {
        setIsPlaying(true)
        animateSymbol(polyline)
      }
    }
  }

  const handleReset = () => {
    if (animationRef.current) {
      window.clearInterval(animationRef.current)
    }
    setIsPlaying(false)
    countRef.current = 0
    if (polyline && polyline.get) {
      const icons = polyline.get("icons")
      if (icons && icons[0]) {
        icons[0].offset = "0%"
        polyline.set("icons", icons)
      }
    }
  }

  const handleSpeedIncrease = () => {
    if (animationSpeed > 5) {
      setAnimationSpeed(prev => prev - 5)
    }
  }

  const handleSpeedDecrease = () => {
    setAnimationSpeed(prev => prev + 5)
  }

  const getSpeedLabel = () => {
    // Lower ms = faster speed
    if (animationSpeed <= 5) return "Very Fast"
    if (animationSpeed <= 10) return "Fast"
    if (animationSpeed <= 20) return "Normal"
    if (animationSpeed <= 30) return "Slow"
    return "Very Slow"
  }
  
  const handleImeiSelect = (imei: string) => {
    setSelectedImei(imei);
    setShowImeiDropdown(false);
  }
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }
  
  // Format dates for display
  const formatDateForInput = (dateString: string) => {
    // Remove 'Z' from the end if present (for UTC marker)
    return dateString.replace('Z', '');
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Filter Panel */}
      <div style={{ 
        position: "absolute", 
        top: "10px", 
        left: "10px", 
        zIndex: 1000,
        backgroundColor: "white",
        padding: "15px",
        borderRadius: "5px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        width: "300px"
      }}>
        <h3 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>Track Filters</h3>
        
        {/* IMEI Dropdown */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            Device IMEI:
          </label>
          <div style={{ position: "relative" }}>
            <div 
              style={{ 
                border: "1px solid #ccc", 
                padding: "8px", 
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
              onClick={() => setShowImeiDropdown(!showImeiDropdown)}
            >
              <span>{selectedImei}</span>
              <span>▼</span>
            </div>
            
            {showImeiDropdown && (
              <div style={{ 
                position: "absolute", 
                top: "100%", 
                left: 0, 
                right: 0, 
                border: "1px solid #ccc",
                borderTop: "none",
                borderRadius: "0 0 4px 4px",
                backgroundColor: "#fff",
                maxHeight: "200px",
                overflowY: "auto",
                zIndex: 1001,
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
              }}>
                <input
                  type="text"
                  placeholder="Search IMEI..."
                  value={searchQuery}
                  onChange={handleSearch}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    width: "calc(100% - 16px)", 
                    padding: "8px",
                    border: "none",
                    borderBottom: "1px solid #eee",
                    outline: "none"
                  }}
                />
                
                {filteredImeiList.length === 0 ? (
                  <div style={{ padding: "8px", color: "#999", textAlign: "center" }}>
                    No IMEI found
                  </div>
                ) : (
                  filteredImeiList.map((imei) => (
                    <div 
                      key={imei.value}
                      style={{ 
                        padding: "8px", 
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                        backgroundColor: selectedImei === imei.value ? "#f0f9ff" : "transparent"
                      }}
                      onClick={() => handleImeiSelect(imei.value)}
                    >
                      {imei.label}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Date Time Pickers */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            Start Date (IST):
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(startDate)}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "8px", 
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
          />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            End Date (IST):
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(endDate)}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "8px", 
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
          />
        </div>
        
        <button
          onClick={fetchTrackData}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          Load Track Data
        </button>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div style={{ 
          position: "absolute", 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center",
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          zIndex: 1000
        }}>
          <div style={{
            padding: "20px",
            backgroundColor: "white",
            borderRadius: "5px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}>Loading track data...</div>
        </div>
      )}
      
      {/* Error Messages */}
      {error && (
        <div style={{ 
          position: "absolute", 
          top: 10, 
          left: "50%", 
          transform: "translateX(-50%)",
          backgroundColor: "#f8d7da",
          color: "#721c24",
          padding: "10px 20px",
          borderRadius: "5px",
          zIndex: 1000,
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        }}>
          {error}
        </div>
      )}
      
      {/* Map Container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Playback Controls */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        }}
      >
        <button
          onClick={handlePlayPause}
          disabled={!polyline || loading}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: isPlaying ? "#FF9800" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: polyline && !loading ? "pointer" : "not-allowed",
            opacity: polyline && !loading ? 1 : 0.7,
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleReset}
          disabled={!polyline || loading}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: polyline && !loading ? "pointer" : "not-allowed",
            opacity: polyline && !loading ? 1 : 0.7,
          }}
        >
          Reset
        </button>
        
        {/* Speed controls */}
        <div style={{ 
          display: "flex", 
          alignItems: "center",
          gap: "10px",
          marginLeft: "10px",
          backgroundColor: "#f0f0f0",
          padding: "5px 10px",
          borderRadius: "5px"
        }}>
          <button
            onClick={handleSpeedDecrease}
            disabled={!polyline || loading}
            title="Decrease speed"
            style={{
              padding: "5px 10px",
              fontSize: "16px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: polyline && !loading ? "pointer" : "not-allowed",
              opacity: polyline && !loading ? 1 : 0.7,
            }}
          >
            -
          </button>
          
          <div style={{ 
            minWidth: "90px", 
            textAlign: "center",
            fontWeight: "bold"
          }}>
            {getSpeedLabel()}
          </div>
          
          <button
            onClick={handleSpeedIncrease}
            disabled={!polyline || loading || animationSpeed <= 5}
            title="Increase speed"
            style={{
              padding: "5px 10px",
              fontSize: "16px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: polyline && !loading && animationSpeed > 5 ? "pointer" : "not-allowed",
              opacity: polyline && !loading && animationSpeed > 5 ? 1 : 0.7,
            }}
          >
            +
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        backgroundColor: "white",
        padding: "10px",
        borderRadius: "5px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        fontSize: "12px"
      }}>
        <div style={{ marginBottom: "5px", display: "flex", alignItems: "center" }}>
          <div style={{ 
            width: "12px", 
            height: "12px", 
            backgroundColor: "#4CAF50", 
            borderRadius: "50%",
            marginRight: "5px",
            border: "1px solid white"
          }}></div>
          Start Point
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ 
            width: "12px", 
            height: "12px", 
            backgroundColor: "#f44336", 
            borderRadius: "50%",
            marginRight: "5px",
            border: "1px solid white"
          }}></div>
          End Point
        </div>
      </div>
    </div>
  )
}

export default GoogleMap