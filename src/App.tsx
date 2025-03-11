import type React from "react"
import GoogleMap from "./TrackPlay/components/GoogelMap"

const App: React.FC = () => {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <GoogleMap />
    </div>
  )
}

export default App

