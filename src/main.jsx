import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ui/ToastContainer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
