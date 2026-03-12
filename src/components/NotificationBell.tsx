"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

const fetcher = (url: string) => authFetch(url).then((res) => res.json());

interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Polling interval logic with jitter to prevent server overload
  const [pollInterval, setPollInterval] = useState(600000); // default 10min

  useEffect(() => {
    const baseInterval = Number(process.env.NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL) || 60000;
    const jitter = Math.floor(Math.random() * 5000);
    setPollInterval(baseInterval + jitter);
  }, []);

  const { data: notifications, error } = useSWR<AppNotification[]>(
    `${API_BASE_URL}/api/app-notifications`,
    fetcher,
    { refreshInterval: pollInterval }
  );

  useEffect(() => {
    if (notifications) {
      const lastRead = localStorage.getItem("notifications_last_read");
      if (!lastRead) {
        setUnreadCount(notifications.length);
      } else {
        const lastReadTime = new Date(lastRead).getTime();
        const unread = notifications.filter(n => new Date(n.createdAt).getTime() > lastReadTime);
        setUnreadCount(unread.length);
      }
    }
  }, [notifications]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
      localStorage.setItem("notifications_last_read", new Date().toISOString());
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buttonClass = variant === 'dark' 
        ? "relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mx-1"
        : "relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors mx-1";

  const theme = {
    container: variant === 'dark' ? "bg-slate-900 border-slate-800 shadow-slate-950/50" : "bg-white border-slate-100",
    header: variant === 'dark' ? "border-slate-800 bg-slate-950/50" : "border-slate-100 bg-slate-50",
    headerText: variant === 'dark' ? "text-slate-100" : "text-slate-800",
    item: variant === 'dark' ? "border-slate-800/50 hover:bg-slate-800/50" : "border-slate-50 hover:bg-slate-50",
    title: variant === 'dark' ? "text-slate-200" : "text-slate-900",
    message: variant === 'dark' ? "text-slate-400" : "text-slate-600",
    date: variant === 'dark' ? "text-slate-500" : "text-slate-400",
    emptyIcon: variant === 'dark' ? "text-slate-700" : "text-slate-300",
    emptyText: variant === 'dark' ? "text-slate-500" : "text-slate-500",
    pulse: variant === 'dark' ? "bg-slate-800" : "bg-slate-200"
  };

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className={buttonClass}
        title="Notifications"
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 border border-white bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`fixed right-4 left-4 top-16 sm:absolute sm:-right-2 sm:top-full sm:mt-2 sm:w-96 sm:left-auto rounded-2xl shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ${theme.container}`}>
          <div className={`px-4 py-3 border-b flex justify-between items-center ${theme.header}`}>
            <h3 className={`font-semibold ${theme.headerText}`}>Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>
          <div className="max-h-[350px] overflow-y-auto">
            {!notifications && !error && (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2 py-1">
                      <div className={`h-4 rounded w-3/4 ${theme.pulse}`}></div>
                      <div className={`h-3 rounded w-full ${theme.pulse}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {notifications?.length === 0 && (
              <div className={`p-8 text-center text-sm flex flex-col items-center ${theme.emptyText}`}>
                <svg className={`w-10 h-10 mb-2 ${theme.emptyIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                No notifications right now
              </div>
            )}
            {notifications?.map((notif) => (
              <div key={notif.id} className={`p-4 border-b transition-colors ${theme.item}`}>
                <h4 className={`font-medium text-sm ${theme.title}`}>{notif.title}</h4>
                <p className={`text-sm mt-1.5 leading-snug break-words whitespace-pre-wrap ${theme.message}`}>{notif.message}</p>
                <span className={`text-xs font-medium mt-2.5 block ${theme.date}`}>
                  {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
