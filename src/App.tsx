import type React from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom";
import GoogleMap from "./TrackPlay/components/GoogelMap";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ width: "100vw", height: "100vh" }}>
        <Routes>
          <Route path="/" element={<GoogleMap />} />
          <Route path="/track-play/:tripId?" element={<GoogleMap />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;