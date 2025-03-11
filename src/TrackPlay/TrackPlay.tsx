"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import { downloadExcel } from "../utils/excelUtils"


// Declare google variable to avoid Typescript errors
declare global {
  interface Window {
    google: any
  }
}

interface Coordinate {
  latitude: string
  longitude: string
}

interface TrackPlayProps {
  coordinates?: Coordinate[]
  apiKey: string // Changed to required prop
}

const TrackPlay = ({
  coordinates: propCoordinates,
  apiKey, // Remove default value
}: TrackPlayProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null)
  const [marker, setMarker] = useState<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [startMarker, setStartMarker] = useState<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [endMarker, setEndMarker] = useState<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [progress, setProgress] = useState(0)
  const animationRef = useRef<number | null>(null)
  const currentPositionRef = useRef(0)
  const pathRef = useRef<google.maps.LatLng[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load sample coordinates from the provided JSON if none are passed as props
  useEffect(() => {
    if (propCoordinates) {
      setCoordinates(propCoordinates)
    } else {
      // Sample coordinates from the provided JSON
      fetch("/coordinates.json")
        .then((response) => response.json())
        .then((data) => {
          setCoordinates(data.data.getDistanceTrackPlay)
        })
        .catch((error) => console.error("Error loading coordinates:", error))
    }
  }, [propCoordinates])

  // Cleanup function to safely remove markers and polyline
  const cleanup = useCallback(() => {
    try {
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }

      // Cleanup markers
      if (marker) {
        try {
          marker.map = null
        } catch (e) {
          console.warn("Error cleaning up marker:", e)
        }
        setMarker(null)
      }

      if (startMarker) {
        try {
          startMarker.map = null
        } catch (e) {
          console.warn("Error cleaning up start marker:", e)
        }
        setStartMarker(null)
      }

      if (endMarker) {
        try {
          endMarker.map = null
        } catch (e) {
          console.warn("Error cleaning up end marker:", e)
        }
        setEndMarker(null)
      }

      // Cleanup polyline
      if (polyline) {
        try {
          polyline.setMap(null)
        } catch (e) {
          console.warn("Error cleaning up polyline:", e)
        }
        setPolyline(null)
      }

      // Reset state
      setProgress(0)
      setIsPlaying(false)
      currentPositionRef.current = 0
    } catch (error) {
      console.error("Error during cleanup:", error)
    }
  }, [marker, startMarker, endMarker, polyline])

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["places", "geometry", "marker"],
      })

      try {
        await loader.load()
        // Import the marker library and destructure AdvancedMarkerElement
        const { AdvancedMarkerElement: MarkerElement } = await window.google.maps.importLibrary("marker")

        if (mapRef.current) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            center: { lat: 28.516552, lng: 77.165808 },
            zoom: 15,
            mapId: "DEMO_MAP_ID", // Required for advanced markers
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            // Remove the styles property since we're using mapId
          })

          setMap(mapInstance)
          setIsLoaded(true)
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
      }
    }

    initMap()

    // Return cleanup function
    return () => {
      cleanup()
    }
  }, [apiKey, cleanup])

  // Create marker element helper function
  const createMarkerElement = (text: string, color: string, isArrow = false) => {
    const div = document.createElement("div")
    div.className = `marker-content ${isArrow ? "arrow" : ""}`
    div.style.width = "24px"
    div.style.height = "24px"
    div.style.backgroundColor = color
    div.style.borderRadius = isArrow ? "0" : "50%"
    div.style.display = "flex"
    div.style.alignItems = "center"
    div.style.justifyContent = "center"
    div.style.color = "white"
    div.style.fontSize = "12px"
    div.style.fontWeight = "bold"
    div.style.border = "2px solid white"
    div.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)"

    if (isArrow) {
      div.style.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)"
    }

    div.textContent = text
    return div
  }

  // Plot polyline when coordinates and map are available
  const plotPolyline = useCallback(async () => {
    if (!map || !isLoaded || coordinates.length === 0 || !window.google) return

    // Clean up existing elements before creating new ones
    cleanup()

    // Convert coordinates to LatLng objects
    const path = coordinates.map(
      (coord) => new window.google.maps.LatLng(Number.parseFloat(coord.latitude), Number.parseFloat(coord.longitude)),
    )

    pathRef.current = path

    // Create new polyline
    const newPolyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#4285F4",
      strokeOpacity: 1.0,
      strokeWeight: 4,
    })

    newPolyline.setMap(map)
    setPolyline(newPolyline)

    // Import marker library and create markers
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker")

    // Create car marker for animation
    const newMarker = new AdvancedMarkerElement({
      position: path[0],
      map,
      content: createMarkerElement("▲", "#4285F4", true),
    })
    setMarker(newMarker)

    // Create start marker
    const newStartMarker = new AdvancedMarkerElement({
      position: path[0],
      map,
      content: createMarkerElement("S", "#4CAF50"),
    })
    setStartMarker(newStartMarker)

    // Create end marker
    const newEndMarker = new AdvancedMarkerElement({
      position: path[path.length - 1],
      map,
      content: createMarkerElement("E", "#F44336"),
    })
    setEndMarker(newEndMarker)

    // Fit bounds to show the entire path
    const bounds = new window.google.maps.LatLngBounds()
    path.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds)

    // Add a small padding to the bounds
    const newBounds = {
      north: bounds.getNorthEast().lat() + 0.001,
      east: bounds.getNorthEast().lng() + 0.001,
      south: bounds.getSouthWest().lat() - 0.001,
      west: bounds.getSouthWest().lng() - 0.001,
    }

    map.fitBounds(newBounds)
  }, [map, coordinates, isLoaded, cleanup])

  // Start animation
  const startAnimation = () => {
    if (!marker || !map || pathRef.current.length === 0) return

    setIsPlaying(true)
    currentPositionRef.current = 0
    setProgress(0)

    // Reset marker to start position
    // @ts-ignore
    marker.position = pathRef.current[0]

    // Start animation loop
    animateMarker()
  }

  // Stop animation
  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setIsPlaying(false)
  }

  // Animate marker along the path
  const animateMarker = () => {
    if (!marker || pathRef.current.length === 0) return

    const path = pathRef.current
    const position = currentPositionRef.current

    // If we've reached the end of the path, stop animation
    if (position >= path.length - 1) {
      stopAnimation()
      // Reset to start position
      // @ts-ignore
      marker.position = path[0]
      setProgress(0)
      currentPositionRef.current = 0
      return
    }

    // Calculate next position based on speed
    const nextPosition = Math.min(position + 0.01 * speed, path.length - 1)
    currentPositionRef.current = nextPosition

    // Update progress percentage
    const progressPercentage = (nextPosition / (path.length - 1)) * 100
    setProgress(progressPercentage)

    // Get the exact point on the path
    const point = getPointOnPath(path, nextPosition)

    // Update marker position
    // @ts-ignore
    marker.position = point

    // Calculate heading for marker rotation
    // if (Math.floor(nextPosition) < path.length - 1) {
    //   const heading = window.google.maps.geometry.spherical.computeHeading(
    //     point,
    //     path[Math.min(Math.ceil(nextPosition), path.length - 1)],
    //   )

    //   // Update marker icon rotation
    //   const icon = marker.getIcon() as google.maps.Symbol
    //   if (icon) {
    //     marker.setIcon({
    //       ...icon,
    //       rotation: heading,
    //     })
    //   }
    // }

    // Continue animation
    animationRef.current = requestAnimationFrame(animateMarker)
  }

  // Get point on path for smooth animation
  const getPointOnPath = (path: google.maps.LatLng[], position: number) => {
    const index = Math.floor(position)
    const fraction = position - index

    if (index >= path.length - 1) {
      return path[path.length - 1]
    }

    const start = path[index]
    const end = path[index + 1]

    const lat = start.lat() + fraction * (end.lat() - start.lat())
    const lng = start.lng() + fraction * (end.lng() - start.lng())

    return new window.google.maps.LatLng(lat, lng)
  }

  // Handle download report
  const handleDownloadReport = () => {
    if (coordinates.length === 0) return

    const data = coordinates.map((coord) => ({
      latitude: coord.latitude,
      longitude: coord.longitude,
    }))

    downloadExcel(data, "track_play_report")
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Map Container */}
      <div ref={mapRef} className="flex-1 h-full relative">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="w-64 bg-gray-800 text-white p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">Track Play</h1>

        {/* Plot Button */}
        <button
          onClick={() => plotPolyline()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 transition duration-200"
          disabled={!isLoaded || coordinates.length === 0}
        >
          Plot
        </button>

        {/* Start/Stop Button */}
        <button
          onClick={isPlaying ? stopAnimation : startAnimation}
          className={`${isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} text-white font-bold py-2 px-4 rounded mb-4 transition duration-200`}
          disabled={!polyline || !isLoaded}
        >
          {isPlaying ? "Stop" : "Start"}
        </button>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">{Math.round(progress)}% complete</div>
        </div>

        {/* Speed Control */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Speed</h2>
          <div className="flex justify-between mb-2">
            <span className={`text-sm ${speed === 1 ? "text-blue-400 font-bold" : "text-gray-400"}`}>1X</span>
            <span className={`text-sm ${speed === 2 ? "text-blue-400 font-bold" : "text-gray-400"}`}>2X</span>
            <span className={`text-sm ${speed === 3 ? "text-blue-400 font-bold" : "text-gray-400"}`}>3X</span>
            <span className={`text-sm ${speed === 4 ? "text-blue-400 font-bold" : "text-gray-400"}`}>4X</span>
          </div>
          <input
            type="range"
            min="1"
            max="4"
            step="1"
            value={speed}
            onChange={(e) => setSpeed(Number.parseInt(e.target.value))}
            className="w-full h-2 appearance-none bg-gray-700 rounded-lg cursor-pointer accent-blue-500"
          />
        </div>

        {/* Reports */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Reports</h2>
          <button
            onClick={handleDownloadReport}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition duration-200 flex items-center justify-center"
            disabled={coordinates.length === 0}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download Excel
          </button>
        </div>
      </div>
    </div>
  )
}

export default TrackPlay

