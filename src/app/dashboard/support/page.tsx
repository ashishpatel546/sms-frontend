"use client";

import { useState, useEffect } from "react";
import { getUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import QRCode from "react-qr-code";
import { Mail, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function DashboardSupportPage() {
  const [activeTab, setActiveTab] = useState<"contact" | "faqs">("faqs");
  const [user, setUser] = useState<any>(null);
  
  // Form State
  const [schoolName, setSchoolName] = useState("");
  const [issue, setIssue] = useState("");
  
  // FAQ State
  const [faqs, setFaqs] = useState<{question: string, answer: string}[]>([]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const supportNumber = "7838160389";
  const supportEmail = "support@colegios.in";

  useEffect(() => {
    // Load logged in user
    const u = getUser();
    if (u) {
      setUser(u);
    }
    // Load School Config
    setSchoolName(getEnv('SCHOOL_NAME') || "EduSphere Academy");

    // Load FAQs
    fetch('/faq.json')
      .then(res => {
        if (!res.ok) throw new Error("Failed to load FAQs");
        return res.json();
      })
      .then(data => setFaqs(data))
      .catch(err => console.error("Error loading FAQs:", err));
  }, []);

  const handleWhatsAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !user) return;
    
    // Construct the WhatsApp message
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const message = `Hello, I need help.\n\n*Name:* ${name}\n*Mobile:* ${user.mobile || 'N/A'}\n*School:* ${schoolName}\n*Role:* ${user.role || 'N/A'}\n\n*Issue Details:*\n${issue}`;
    
    // Encode the URI and redirect to wa.me
    const encodeMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/91${supportNumber}?text=${encodeMessage}`;
    
    window.open(waUrl, '_blank');
  };

  const toggleFaq = (index: number) => {
    if (openFaqIndex === index) {
      setOpenFaqIndex(null); // Close if already open
    } else {
      setOpenFaqIndex(index);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Help & Support</h1>
        <p className="text-slate-500 mt-2">Find answers in our FAQs or connect directly with our support team.</p>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab("faqs")}
          className={`pb-4 px-6 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "faqs" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Frequently Asked Questions
        </button>
        <button
          onClick={() => setActiveTab("contact")}
          className={`pb-4 px-6 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "contact" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Contact Support
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden min-h-[500px]">
        
        {/* FAQs Section */}
        {activeTab === "faqs" && (
          <div className="p-6 md:p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Common Questions</h2>
            {faqs.length === 0 ? (
              <div className="text-center text-slate-500 py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                Loading FAQs...
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl">
                {faqs.map((faq, index) => (
                  <div key={index} className="border border-slate-200 rounded-xl overflow-hidden transition-all duration-200 bg-slate-50 hover:bg-slate-100/50">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between p-4 md:p-5 text-left focus:outline-none"
                    >
                      <span className="font-semibold text-slate-800 pr-8">{faq.question}</span>
                      <span className="text-slate-400 shrink-0">
                        {openFaqIndex === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </span>
                    </button>
                    
                    <div 
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        openFaqIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-4 md:p-5 pt-0 text-slate-600 border-t border-slate-200 bg-white leading-relaxed">
                        <ReactMarkdown
                          components={{
                            strong: ({node, ...props}) => <strong className="font-semibold text-slate-800" {...props} />
                          }}
                        >
                          {faq.answer}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-12 p-6 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-blue-900 font-semibold mb-1">Still need help?</h3>
                <p className="text-blue-700/80 text-sm">If you couldn&apos;t find the answer you were looking for, our team is ready to assist you.</p>
              </div>
              <button 
                onClick={() => setActiveTab("contact")}
                className="shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
              >
                Contact Us
              </button>
            </div>
          </div>
        )}

        {/* Contact form Section */}
        {activeTab === "contact" && (
          <div className="flex flex-col md:flex-row h-full">
            {/* Left Contact Info */}
            <div className="md:w-5/12 bg-slate-50 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-6">Get in Touch</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Us</p>
                      <a href={`mailto:${supportEmail}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors">
                        {supportEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">WhatsApp</p>
                      <p className="font-medium text-slate-800">+91 {supportNumber}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-center mt-12 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <QRCode value={`https://wa.me/91${supportNumber}`} size={120} level="M" />
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-4">Scan to Connect</p>
              </div>
            </div>

            {/* Right Contact Form */}
            <div className="flex-1 p-6 md:p-8">
              <form onSubmit={handleWhatsAppSubmit} className="max-w-md mx-auto xl:mx-0 xl:max-w-lg space-y-5">
                
                {/* Prefilled Profile details summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Your Details</p>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                     <div className="text-slate-500">Name:</div>
                     <div className="font-medium text-slate-800 text-right">{user?.firstName} {user?.lastName}</div>
                     <div className="text-slate-500">Mobile:</div>
                     <div className="font-medium text-slate-800 text-right">{user?.mobile || 'N/A'}</div>
                     <div className="text-slate-500">Role:</div>
                     <div className="font-medium text-slate-800 text-right capitalize">{user?.role?.replace("_", " ")}</div>
                     <div className="text-slate-500">School:</div>
                     <div className="font-medium text-slate-800 text-right">{schoolName}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">How can we help you? <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    rows={5}
                    placeholder="Describe the issue you are facing or the question you have..."
                    className="w-full bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full relative group overflow-hidden py-3.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <MessageCircle size={20} />
                    <span>Send via WhatsApp</span>
                  </button>
                  <p className="text-center text-xs text-slate-500 mt-3">
                    Clicking this button will open WhatsApp with a pre-filled message including your details and issue description.
                  </p>
                </div>

              </form>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
