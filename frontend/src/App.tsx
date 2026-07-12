// src/App.tsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  HashRouter,
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
import { HowToPlay } from "./pages/HowToPlay";
import { AboutBlockopoly } from "./pages/AboutBlockopoly";
import { TutorialRoom } from "./pages/TutorialRoom";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { LoadingSplash } from "./components/LoadingSplash";

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
      <StartScreen
        onStart={() => navigate("/main")}
        onLearn={() => navigate("/learn")}
        onAbout={() => navigate("/about")}
        onTutorial={() => navigate("/tutorial")}
      />
    </AnimatedRoute>
  );
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const AppRouter =
    typeof window !== "undefined" && window.location.protocol === "file:"
      ? HashRouter
      : Router;

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1250);
    return () => window.clearTimeout(splashTimer);
  }, []);

  return (
    <AppErrorBoundary>
      {showSplash && <LoadingSplash />}
      <AppRouter>
        {/* AnimatePresence outside Routes for page exit animation */}
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<StartRoute />} />

            <Route
              path="/learn"
              element={
                <AnimatedRoute>
                  <HowToPlay />
                </AnimatedRoute>
              }
            />

            <Route
              path="/about"
              element={
                <AnimatedRoute>
                  <AboutBlockopoly />
                </AnimatedRoute>
              }
            />

            <Route
              path="/tutorial"
              element={
                <AnimatedRoute>
                  <TutorialRoom />
                </AnimatedRoute>
              }
            />

            <Route
              path="/main"
              element={
                <AnimatedRoute>
                  <MainMenu />
                </AnimatedRoute>
              }
            />

            <Route
              path="/join/:roomCode"
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
      </AppRouter>
    </AppErrorBoundary>
  );
}

export default App;
