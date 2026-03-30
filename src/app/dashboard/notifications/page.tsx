"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import Link from "next/link";
import FeeRemindersTab from "./FeeRemindersTab";

type NotificationAudience = "PARENT" | "STAFF" | "ALL" | "CUSTOM";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetAudience: NotificationAudience;
  createdAt: string;
}

export default function NotificationsPage() {
  const { isSubAdmin, isAdmin, isSuperAdmin, isTeacher } = useRbac();
  const canSendNotifications = isSubAdmin || isAdmin || isSuperAdmin;
  const canSendReminders = isTeacher || canSendNotifications;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'BROADCASTS' | 'FEE_REMINDERS'>(
    canSendNotifications ? 'BROADCASTS' : 'FEE_REMINDERS'
  );

  const fetchNotifications = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`);
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canSendNotifications) {
      fetchNotifications();
    }
  }, [canSendNotifications]);

  if (!canSendNotifications && !canSendReminders) {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Notifications & Reminders</h1>
          <p className="mt-1 text-sm text-slate-500">Manage broadcasts and send fee reminders.</p>
        </div>
        {activeTab === 'BROADCASTS' && canSendNotifications && (
          <Link
            href="/dashboard/notifications/new"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Send Notification
          </Link>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        {canSendNotifications && (
          <button
            onClick={() => setActiveTab('BROADCASTS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'BROADCASTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            General Broadcasts
          </button>
        )}
        {canSendReminders && (
          <button
            onClick={() => setActiveTab('FEE_REMINDERS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'FEE_REMINDERS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Fee Reminders
          </button>
        )}
      </div>

      {activeTab === 'BROADCASTS' && canSendNotifications && (
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
                <div key={notif.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-start hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-base">{notif.title}</h4>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{notif.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md tracking-wide ${
                      notif.targetAudience === 'ALL' ? 'bg-purple-100 text-purple-700' :
                      notif.targetAudience === 'PARENT' ? 'bg-blue-100 text-blue-700' :
                      notif.targetAudience === 'CUSTOM' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {notif.targetAudience}
                    </span>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                      {new Date(notif.createdAt).toLocaleString(undefined, {
                         month: 'short', day: 'numeric', year: 'numeric',
                         hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'FEE_REMINDERS' && canSendReminders && (
        <FeeRemindersTab />
      )}
    </div>
  );
}
