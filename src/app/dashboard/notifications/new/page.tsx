"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslations } from "next-intl";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sortByName } from "@/lib/utils";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";

type NotificationAudience = "PARENT" | "STAFF" | "ALL" | "CUSTOM";

export default function NewNotificationPage() {
  const t = useTranslations("notifications");
  const readOnly = useReadOnlySession();
  const { isSubAdmin, isAdmin, isSuperAdmin } = useRbac();
  const canSendNotifications = isSubAdmin || isAdmin || isSuperAdmin;
  const router = useRouter();

  // Custom Audience States
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting }
  } = useForm<{ title: string; message: string; targetAudience: NotificationAudience }>({
    defaultValues: { title: "", message: "", targetAudience: "" as unknown as NotificationAudience }
  });

  const watchAudience = useWatch({ control, name: "targetAudience" });

  const fetchSessions = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/academic-sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        const active = data.find((s: any) => s.isActive);
        if (active) setSelectedSessionId(active.id.toString());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/classes`);
      if (res.ok) setClasses(sortByName(await res.json()));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const fetchSections = async (classId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/classes/${classId}/sections`);
      if (res.ok) setSections(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async (sessionId: string, classId: string, sectionId?: string) => {
    if (!classId) return setStudents([]);
    setIsLoadingStudents(true);
    try {
      let url = `${API_BASE_URL}/students?classId=${classId}`;
      if (sessionId) url += `&academicSessionId=${sessionId}`;
      if (sectionId) url += `&sectionId=${sectionId}`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (canSendNotifications) {
      fetchSessions();
      fetchClasses();
    }
  }, [canSendNotifications]);

  useEffect(() => {
    if (watchAudience === "CUSTOM") {
      fetchStudents(selectedSessionId, selectedClassId, selectedSectionId);
    }
  }, [selectedSessionId, selectedClassId, selectedSectionId, watchAudience]);

  // Handle Session selection
  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSessionId(e.target.value);
    setSelectedStudentIds([]); // Reset students
  };

  // Handle Class selection
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedClassId(cid);
    setSelectedSectionId(""); // Reset section
    setSelectedStudentIds([]); // Reset students
    if (cid) {
      fetchSections(cid);
    } else {
      setSections([]);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: { title: string; message: string; targetAudience: NotificationAudience }) => {
    if (data.targetAudience === "CUSTOM" && selectedStudentIds.length === 0) {
      toast.error(t("compose.selectStudent"));
      return;
    }

    try {
      const payload: any = { ...data };
      if (data.targetAudience === "CUSTOM") {
        payload.targetUserIds = selectedStudentIds;
      }

      const res = await authFetch(`${API_BASE_URL}/api/app-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t("compose.sent"));
        router.push('/dashboard/notifications');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t("compose.sendFailed"));
      }
    } catch (error) {
      toast.error(t("compose.error"));
    }
  };

  if (!canSendNotifications) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{t("compose.noPermission")}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/notifications" className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("compose.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("compose.subtitle")}</p>
        </div>
      </div>

      <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">{t("compose.titleLabel")}</label>
            <input
              {...register("title", { required: t("compose.titleRequired") })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition-all placeholder:text-slate-400"
              placeholder={t("compose.titlePlaceholder")}
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">{t("compose.messageLabel")}</label>
            <textarea
              {...register("message", { required: t("compose.messageRequired") })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition-all min-h-[120px] resize-y placeholder:text-slate-400"
              placeholder={t("compose.messagePlaceholder")}
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 w-full block">{t("compose.audienceLabel")}</label>
            <select
              {...register("targetAudience", { required: t("compose.audienceRequired") })}
              className="w-full px-4 py-3 border border-slate-200 text-slate-700 bg-white rounded-lg focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition-all"
            >
              <option value="" disabled>{t("compose.audiencePlaceholder")}</option>
              <option value="ALL">{t("compose.audienceAll")}</option>
              <option value="PARENT">{t("compose.audienceParents")}</option>
              <option value="STAFF">{t("compose.audienceStaff")}</option>
              <option value="CUSTOM">{t("compose.audienceCustom")}</option>
            </select>
            {errors.targetAudience && <p className="text-red-500 text-sm mt-1">{errors.targetAudience.message}</p>}
          </div>

          {watchAudience === "CUSTOM" && (
            <div className="space-y-5 p-5 border border-amber-100 rounded-xl bg-amber-50/30">
              <h4 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">{t("compose.customFilter")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">{t("compose.session")}</label>
                  <select
                    value={selectedSessionId}
                    onChange={handleSessionChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand/40 outline-none transition-all text-sm font-medium"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.isActive ? t("compose.activeSuffix") : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">{t("compose.selectClass")}</label>
                  <select
                    value={selectedClassId}
                    onChange={handleClassChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand/40 outline-none transition-all text-sm"
                  >
                    <option value="">{t("compose.allClasses")}</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">{t("compose.selectSection")}</label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => { setSelectedSectionId(e.target.value); setSelectedStudentIds([]); }}
                    disabled={!selectedClassId || sections.length === 0}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand/40 outline-none transition-all text-sm disabled:opacity-50 disabled:bg-slate-50"
                  >
                    <option value="">{t("compose.allSections")}</option>
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {isLoadingStudents ? (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-blue-500 border-t-white rounded-full animate-spin"></div> {t("compose.loadingStudents")}
                </div>
              ) : students.length > 0 ? (
                <div className="space-y-3">
                   <div className="flex justify-between items-center bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm">
                     <label className="flex items-center gap-3 cursor-pointer group">
                       <input 
                         type="checkbox" 
                         checked={students.length > 0 && selectedStudentIds.length === students.length}
                         onChange={(e) => {
                           if (e.target.checked) {
                             setSelectedStudentIds(students.map(s => s.id.toString()));
                           } else {
                             setSelectedStudentIds([]);
                           }
                         }}
                         className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-brand/40"
                       />
                       <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                         {t("compose.selectAllStudents", { count: students.length })}
                       </span>
                     </label>
                     <div className="flex items-center gap-3">
                       {selectedStudentIds.length > 0 && (
                         <button 
                           type="button" 
                           onClick={() => setSelectedStudentIds([])}
                           className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                         >
                           {t("compose.clearSelection")}
                         </button>
                       )}
                       <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                         {t("compose.selectedCount", { count: selectedStudentIds.length })}
                       </div>
                     </div>
                   </div>
                   
                   <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-inner">
                     {students.map(s => (
                       <label key={s.id} className="flex items-center gap-4 p-3 hover:bg-blue-50/50 cursor-pointer transition-colors">
                         <input 
                           type="checkbox" 
                           checked={selectedStudentIds.includes(s.id.toString())}
                           onChange={() => toggleStudentSelection(s.id.toString())}
                           className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-brand/40 mt-0.5"
                         />
                         <div className="flex-1">
                           <p className="text-sm font-semibold text-slate-900">{s.firstName} {s.lastName}</p>
                           <p className="text-xs text-slate-500 font-medium">{t("compose.studentMeta", { className: `${s.class?.name || t("compose.notAvailable")}${s.section ? ` - ${s.section.name}` : ''}`, roll: s.enrollments?.[0]?.rollNo || t("compose.notAvailable") })}</p>
                         </div>
                       </label>
                     ))}
                   </div>
                </div>
              ) : selectedClassId ? (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 shadow-sm">
                  {t("compose.noStudents")}
                </div>
              ) : (
                <div className="py-8 text-center bg-white rounded-lg border border-slate-200 text-sm text-slate-500 shadow-sm">
                  {t("compose.selectClassFirst")}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
              className="px-8 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {t("compose.sending")}
                </>
              ) : t("compose.sendNow")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
