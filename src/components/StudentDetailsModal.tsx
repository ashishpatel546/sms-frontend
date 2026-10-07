import { FC } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Loader } from "./ui/Loader";

interface StudentDetails {
    id: number;
    firstName: string;
    lastName: string;
    mobile?: string;
    alternateMobile?: string;
    email?: string;
    gender?: string;
    dateOfBirth?: string;
    fathersName?: string;
    mothersName?: string;
    aadhaarNumber?: string;
    bloodGroup?: string;
    religion?: string;
    category?: string;
}

interface StudentDetailsModalProps {
    student: StudentDetails | null;
    isLoading: boolean;
    onClose: () => void;
}

export const StudentDetailsModal: FC<StudentDetailsModalProps> = ({ student, isLoading, onClose }) => {
    const t = useTranslations("students.detailsModal");
    const tc = useTranslations("common");
    if (!student && !isLoading) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/55 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">{t("title")}</h2>
                    <button
                        onClick={onClose}
                        aria-label={tc("action.close")}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-12 flex justify-center">
                            <Loader text={t("loading")} />
                        </div>
                    ) : student ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("fullName")}</p>
                                    <p className="text-base text-gray-900 font-semibold">{student.firstName} {student.lastName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("rollOrId")}</p>
                                    <p className="text-base text-gray-900">#{student.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{tc("field.dob")}</p>
                                    <p className="text-base text-gray-900">{student.dateOfBirth || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{tc("field.gender")}</p>
                                    <p className="text-base text-gray-900">{student.gender || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("bloodGroup")}</p>
                                    <p className="text-base text-gray-900">{student.bloodGroup || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("categoryReligion")}</p>
                                    <p className="text-base text-gray-900">
                                        {[student.category, student.religion].filter(Boolean).join(" / ") || t("na")}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("fathersName")}</p>
                                    <p className="text-base text-gray-900">{student.fathersName || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("mothersName")}</p>
                                    <p className="text-base text-gray-900">{student.mothersName || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("mobile")}</p>
                                    <p className="text-base text-gray-900">{student.mobile || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("alternateMobile")}</p>
                                    <p className="text-base text-gray-900">{student.alternateMobile || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("email")}</p>
                                    <p className="text-base text-gray-900 wrap-break-word">{student.email || t("na")}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{t("aadhaar")}</p>
                                    <p className="text-base text-gray-900">{student.aadhaarNumber || t("na")}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        {tc("action.close")}
                    </button>
                </div>
            </div>
        </div>
    );
};
