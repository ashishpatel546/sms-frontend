import { FC } from "react";
import { X } from "lucide-react";
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
    if (!student && !isLoading) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">Student Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-12 flex justify-center">
                            <Loader text="Loading student details..." />
                        </div>
                    ) : student ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Full Name</p>
                                    <p className="text-base text-gray-900 font-semibold">{student.firstName} {student.lastName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Roll No / ID</p>
                                    <p className="text-base text-gray-900">#{student.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Date of Birth</p>
                                    <p className="text-base text-gray-900">{student.dateOfBirth || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Gender</p>
                                    <p className="text-base text-gray-900">{student.gender || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Blood Group</p>
                                    <p className="text-base text-gray-900">{student.bloodGroup || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Category / Religion</p>
                                    <p className="text-base text-gray-900">
                                        {[student.category, student.religion].filter(Boolean).join(" / ") || "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Father's Name</p>
                                    <p className="text-base text-gray-900">{student.fathersName || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Mother's Name</p>
                                    <p className="text-base text-gray-900">{student.mothersName || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Mobile Number</p>
                                    <p className="text-base text-gray-900">{student.mobile || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Alternate Mobile</p>
                                    <p className="text-base text-gray-900">{student.alternateMobile || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Email Address</p>
                                    <p className="text-base text-gray-900 wrap-break-word">{student.email || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Aadhaar Number</p>
                                    <p className="text-base text-gray-900">{student.aadhaarNumber || "N/A"}</p>
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
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
