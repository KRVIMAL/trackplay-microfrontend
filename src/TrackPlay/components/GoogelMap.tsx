import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import axios from "axios"
import { useParams } from "react-router-dom"

const GOOGLE_MAPS_API_KEY: any = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const BASE_URL = "http://localhost:8096"
const TRIP_API_URL = "http://localhost:9099/trip"

// Sample IMEI list for dropdown - replace with your actual data source
const SAMPLE_IMEI_LIST = [
  { value: "937066763492", label: "Device 937066763492" },
  { value: "937066763492", label: "Device 937066763492" },
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

interface TripResponse {
  success: boolean
  statusCode: number
  message: string
  data: {
    _id: string
    tripId: string
    vehicleDetails: {
      vehicleNumber: {
        device: {
          imei: string
        }
      }
    }
    tripDetails: {
      tripExpectedStartDate: number
      tripExpectedEndDate: number
    }
  }
}

const GoogleMap: React.FC = () => {
  const params = useParams()
  console.log({params})
  const tripId = params.tripId // Get tripId from URL params
  console.log({tripId})
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
  const [selectedImei, setSelectedImei] = useState<string>("937066763492")
  const [startDate, setStartDate] = useState<string>("2025-03-18T10:07:58Z")
  const [endDate, setEndDate] = useState<string>("2025-03-18T10:08:57Z")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showImeiDropdown, setShowImeiDropdown] = useState<boolean>(false)
  const [tripDataLoaded, setTripDataLoaded] = useState<boolean>(false)

  const filteredImeiList = SAMPLE_IMEI_LIST.filter(imei => 
    imei.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    imei.value.includes(searchQuery)
  )

  const convertTimestampToISOString = (timestamp: number): string => {
    const date = new Date(timestamp);
    
    const istOffsetHours = 5;
    const istOffsetMinutes = 30;
    
    date.setUTCHours(date.getUTCHours() + istOffsetHours);
    date.setUTCMinutes(date.getUTCMinutes() + istOffsetMinutes);
    
    return date.toISOString().slice(0, -1);
  }

const convertToIST = (localDateTimeStr: string): string => {
  if (!localDateTimeStr) return "";
  
  const localDate = new Date(localDateTimeStr);
  
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

  useEffect(() => {
    const fetchTripData = async () => {
      if (!tripId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response:any = await axios.get<any>(`${TRIP_API_URL}/${tripId}`);
        if (response.data.success&& response.data.data) {
          const { vehicleDetails, tripDetails } = response.data.data;
          const imei = vehicleDetails.vehicleNumber.device.imei;
          const startDateISO = convertTimestampToISOString(tripDetails.tripExpectedStartDate);
          const endDateISO = convertTimestampToISOString(tripDetails.tripExpectedEndDate);
       
          setSelectedImei(imei);
          setStartDate(startDateISO);
          setEndDate(endDateISO);
          setTripDataLoaded(true);
        } else {
          setError("Failed to fetch trip data");
        }
      } catch (err) {
        setError(`Error fetching trip data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error("Error fetching trip data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTripData();
  }, [tripId]);

  // Auto fetch track data after trip data is loaded
  useEffect(() => {
    if (tripDataLoaded && tripId) {
      fetchTrackData();
      setTripDataLoaded(false); // Reset to prevent multiple calls
    }
  }, [tripDataLoaded]);

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
      const istStartDate = convertToIST(startDate);
      const istEndDate = convertToIST(endDate);
      
      const response = await axios.get<TrackDataResponse>(
        `${BASE_URL}/trackdata`,
        {
          params: {
            startDate: istStartDate,
            endDate: istEndDate,
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
    <div className="relative w-full h-full">
      {/* Filter Panel */}
      <div className="absolute top-2.5 left-2.5 z-10 bg-white p-4 rounded shadow-md w-72">
        <h3 className="m-0 mb-4 text-base font-medium">Track Filters</h3>
        
        {/* IMEI Dropdown */}
        <div className="mb-4">
          <label className="block mb-1 text-sm">
            Device IMEI:
          </label>
          <div className="relative">
            <div 
              className="border border-gray-300 p-2 rounded cursor-pointer bg-white flex justify-between items-center"
              onClick={() => setShowImeiDropdown(!showImeiDropdown)}
            >
              <span>{selectedImei}</span>
              <span>▼</span>
            </div>
            
            {showImeiDropdown && (
              <div className="absolute top-full left-0 right-0 border border-gray-300 border-t-0 rounded-b bg-white max-h-48 overflow-y-auto z-20 shadow-lg">
                <input
                  type="text"
                  placeholder="Search IMEI..."
                  value={searchQuery}
                  onChange={handleSearch}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-2 border-0 border-b border-gray-200 outline-none"
                />
                
                {filteredImeiList.length === 0 ? (
                  <div className="p-2 text-gray-500 text-center">
                    No IMEI found
                  </div>
                ) : (
                  filteredImeiList.map((imei) => (
                    <div 
                      key={imei.value}
                      className={`p-2 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${selectedImei === imei.value ? 'bg-blue-50' : ''}`}
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
        <div className="mb-4">
          <label className="block mb-1 text-sm">
            Start Date (IST):
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(startDate)}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-1 text-sm">
            End Date (IST):
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(endDate)}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <button
          onClick={fetchTrackData}
          className="w-full py-2.5 bg-green-500 text-white border-0 rounded cursor-pointer text-sm font-medium hover:bg-green-600 transition-colors"
        >
          Load Track Data
        </button>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10">
          <div className="p-5 bg-white rounded shadow-md">
            Loading track data...
          </div>
        </div>
      )}
      
      {/* Error Messages */}
      {error && (
        <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-800 p-2.5 px-5 rounded shadow-md z-10">
          {error}
        </div>
      )}
      
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Playback Controls */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-2.5 bg-white bg-opacity-80 p-2.5 rounded shadow-md">
        <button
          onClick={handlePlayPause}
          disabled={!polyline || loading}
          className={`px-5 py-2.5 text-base text-white border-0 rounded ${
            isPlaying ? 'bg-orange-500' : 'bg-green-500'
          } ${(!polyline || loading) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 transition-opacity'}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleReset}
          disabled={!polyline || loading}
          className={`px-5 py-2.5 text-base bg-red-500 text-white border-0 rounded ${
            (!polyline || loading) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 transition-opacity'
          }`}
        >
          Reset
        </button>
        
        {/* Speed controls */}
        <div className="flex items-center gap-2.5 ml-2.5 bg-gray-100 px-2.5 py-1 rounded">
          <button
            onClick={handleSpeedDecrease}
            disabled={!polyline || loading}
            title="Decrease speed"
            className={`px-2.5 py-1 text-base bg-blue-500 text-white border-0 rounded ${
              (!polyline || loading) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 transition-opacity'
            }`}
          >
            -
          </button>
          
          <div className="min-w-[90px] text-center font-medium">
            {getSpeedLabel()}
          </div>
          
          <button
            onClick={handleSpeedIncrease}
            disabled={!polyline || loading || animationSpeed <= 5}
            title="Increase speed"
            className={`px-2.5 py-1 text-base bg-blue-500 text-white border-0 rounded ${
              (!polyline || loading || animationSpeed <= 5) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 transition-opacity'
            }`}
          >
            +
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-5 right-5 bg-white p-2.5 rounded shadow-md text-xs">
        <div className="mb-1 flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-1 border border-white"></div>
          <span>Start Point</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-1 border border-white"></div>
          <span>End Point</span>
        </div>
      </div>
    </div>
  )
}

export default GoogleMap