"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";

type NotificationAudience = "PARENT" | "STAFF" | "ALL";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetAudience: NotificationAudience;
  createdAt: string;
}

export default function NotificationsPage() {
  const { isSubAdmin, isAdmin, isSuperAdmin } = useRbac();
  const canSendNotifications = isSubAdmin || isAdmin || isSuperAdmin;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<{ title: string; message: string; targetAudience: NotificationAudience }>();

  const fetchNotifications = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onSubmit = async (data: { title: string; message: string; targetAudience: NotificationAudience }) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success("Notification sent successfully!");
        reset();
        setIsModalOpen(false);
        fetchNotifications();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to send notification.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    }
  };

  if (!canSendNotifications) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">You do not have permission to view or manage notifications.</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and broadcast notifications to users.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Send Notification
        </button>
      </div>

      <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Recent Notifications</h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-lg"></div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No notifications sent yet.</div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-900">{notif.title}</h4>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{notif.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      notif.targetAudience === 'ALL' ? 'bg-purple-100 text-purple-700' :
                      notif.targetAudience === 'PARENT' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {notif.targetAudience}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">Send New Notification</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 w-full">Title</label>
                <input
                  {...register("title", { required: "Title is required" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g., Holiday Announcement"
                />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 w-full">Message</label>
                <textarea
                  {...register("message", { required: "Message is required" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-y"
                  placeholder="Type your notification message here..."
                />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 w-full">Target Audience</label>
                <select
                  {...register("targetAudience", { required: "Please select an audience" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="ALL">All Portals (Parents & Staff)</option>
                  <option value="PARENT">Parent Portal Only</option>
                  <option value="STAFF">Staff Portal Only</option>
                </select>
                {errors.targetAudience && <p className="text-red-500 text-xs mt-1">{errors.targetAudience.message}</p>}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  Send Broadcast
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
