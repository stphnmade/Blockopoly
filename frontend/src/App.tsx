// src/App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { StartScreen } from "./pages/StartScreen";
import MainMenu from "./pages/Mainmenu"; // renamed GameScreen
import PlayScreen from "./pages/PlayScreen";
import Lobby from "./pages/Lobby";
import WinnerScreen from "./pages/WinnerScreen";
import { AnimatePresence, motion } from "framer-motion";

/* ─── Animated wrapper with correct typing ─── */
const AnimatedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation(); // ensures key changes on navigation
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  );
};

/* ─── Thin wrapper to inject onStart → navigate("/main") ─── */
const StartRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AnimatedRoute>
      <StartScreen onStart={() => navigate("/main")} />
    </AnimatedRoute>
  );
};

function App() {
  return (
    <Router>
      {/* AnimatePresence outside Routes for page exit animation */}
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<StartRoute />} />

          <Route
            path="/main"
            element={
              <AnimatedRoute>
                <MainMenu />
              </AnimatedRoute>
            }
          />

          <Route
            path="/lobby/:roomCode"
            element={
              <AnimatedRoute>
                <Lobby />
              </AnimatedRoute>
            }
          />

          <Route
            path="/game/:joinId"
            element={
              <AnimatedRoute>
                <PlayScreen />
              </AnimatedRoute>
            }
          />

          <Route
            path="/play/:roomCode"
            element={
              <AnimatedRoute>
                <PlayScreen />
              </AnimatedRoute>
            }
          />

          <Route
            path="/winner/:roomCode"
            element={
              <AnimatedRoute>
                <WinnerScreen />
              </AnimatedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

export default App;
