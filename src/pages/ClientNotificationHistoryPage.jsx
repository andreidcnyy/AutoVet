import React from "react";
import AppLayout from "../layouts/AppLayout";
import ClientNotificationHistory from "../components/notifications/ClientNotificationHistory";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function ClientNotificationHistoryPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="group flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <FiArrowLeft className="transition-transform group-hover:-translate-x-1" />
          Back
        </button>
      </div>
      <ClientNotificationHistory />
    </div>
  );
}

export default ClientNotificationHistoryPage;
