import { useToast } from "../../context/ToastContext";
import Toast from "./Toast";
import AiForecastToast from "./AiForecastToast";

export default function ToastContainer() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-0">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    {toast.type === "ai_forecast" ? (
                        <AiForecastToast
                            data={toast.message} // Pass object payload to data
                            isExiting={toast.isExiting}
                            onClose={() => removeToast(toast.id)}
                        />
                    ) : (
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            isExiting={toast.isExiting}
                            onClose={() => removeToast(toast.id)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
