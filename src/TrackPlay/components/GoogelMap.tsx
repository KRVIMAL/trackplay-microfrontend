import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import coordinatesData from "../../data/coordinates.json"

const GOOGLE_MAPS_API_KEY = "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0"

interface Coordinate {
  latitude: string
  longitude: string
}

const GoogleMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const animationRef = useRef<number | null>(null)
  const countRef = useRef<number>(0)

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
          const coordinates = coordinatesData.data.getDistanceTrackPlay
          const path = coordinates.map((coord: Coordinate) => ({
            lat: Number.parseFloat(coord.latitude),
            lng: Number.parseFloat(coord.longitude),
          }))

          const mapInstance = new google.maps.Map(mapRef.current, {
            center: path[0],
            zoom: 18,
            mapTypeId: "terrain",
          })
          setMap(mapInstance)

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
            map: mapInstance,
          })

          setPolyline(polylineInstance)

          // Fit the map to the polyline bounds
          const bounds = new google.maps.LatLngBounds()
          path.forEach((coord:any) => bounds.extend(coord))
          mapInstance.fitBounds(bounds)
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
      }
    }

    initMap()

    return () => {
      if (animationRef.current) {
        window.clearInterval(animationRef.current)
      }
    }
  }, [])

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
    }, 20)
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={handlePlayPause}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default GoogleMap

