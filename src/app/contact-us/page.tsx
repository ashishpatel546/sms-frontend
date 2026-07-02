"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Mail, Phone, MapPin, ArrowLeft } from "lucide-react";
import { getEnv } from "@/lib/env";

export default function ContactUsPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState("");

  const supportNumber = "7838160389";
  const supportEmail = "support@colegios.in";
  
  useEffect(() => {
    // Populate school name if configured
    setSchoolName(getEnv('SCHOOL_NAME') || "EduSphere Academy");
  }, []);

  const handleWhatsAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !issue) return;
    
    // Construct the WhatsApp message
    const message = `Hello, I need help.\n\n*School:* ${schoolName}\n*Mobile:* ${mobile}\n*Email:* ${email || 'N/A'}\n\n*Issue Details:*\n${issue}`;
    
    // Encode the URI and redirect to wa.me
    const encodeMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/91${supportNumber}?text=${encodeMessage}`;
    
    window.open(waUrl, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 selection:bg-indigo-500/30 font-sans">
      {/* Left — Info & Branding Panel */}
      <div className="relative flex flex-col md:w-5/12 justify-between p-8 md:p-12 overflow-hidden border-r border-white/10 shadow-2xl z-10 bg-slate-900/80 backdrop-blur-md">
        {/* Subtle background glow effect */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 40%, rgba(99,102,241,1) 0%, transparent 40%),
                              radial-gradient(circle at 80% 80%, rgba(168,85,247,1) 0%, transparent 40%)`
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Header/Back Link */}
          <button 
             onClick={() => router.push('/')}
             className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors w-fit mb-12 text-sm font-semibold tracking-wide uppercase"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="mb-10">
            <h1 className="text-white text-4xl lg:text-5xl font-extrabold leading-tight mb-4 drop-shadow-md">
              Get in Touch
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed font-medium">
              We&apos;re here to help! Connect with our support team instantly via WhatsApp or reach out through email.
            </p>
          </div>

          <div className="space-y-6 mt-4">
            {/* Direct Information Blocks */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                <Mail size={24} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Email Support</span>
                <a href={`mailto:${supportEmail}`} className="text-white font-medium text-lg hover:text-indigo-300 transition-colors">
                  {supportEmail}
                </a>
                <span className="text-slate-500 text-sm mt-1">Average response time: 24hrs</span>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-green-500/20 transition-all" />
              <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
                {/* Official generic WhatsApp SVG icon */}
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.418-.098.823z" />
                   <path d="M12.031 2c5.626.004 10.188 4.567 10.188 10.185 0 2.721-1.059 5.281-2.983 7.206-1.926 1.926-4.485 2.987-7.207 2.987-1.735 0-3.418-.431-4.913-1.25l-5.116 1.343 1.365-4.981c-.898-1.545-1.373-3.32-1.373-5.099 0-5.619 4.562-10.185 10.184-10.189zm0-2c-6.728 0-12.184 5.457-12.184 12.185 0 2.146.562 4.238 1.621 6.082l-2.316 8.45 8.653-2.27c1.785.952 3.8 1.455 5.86 1.455 6.726 0 12.188-5.457 12.188-12.185-.001-6.729-5.462-12.185-12.188-12.185z" />
                </svg>
              </div>
              <div className="flex flex-col flex-1 relative z-10">
                <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">WhatsApp Support</span>
                <span className="text-white font-medium text-lg tracking-widest">+91 {supportNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}</span>
                <span className="text-slate-500 text-sm mt-1">Chat directly with our team</span>
              </div>
            </div>
            
            {/* Visual QR element */}
            <div className="hidden md:flex flex-col items-center justify-center p-6 mt-8 rounded-2xl bg-white border border-slate-200 w-fit mx-auto shadow-2xl">
              <QRCode value={`https://wa.me/91${supportNumber}`} size={140} level="M" className="mb-4" />
              <div className="flex items-center gap-2 text-indigo-600 font-bold tracking-wide text-sm">
                <span>Scan to Connect</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Input Form Container w/ improved spacing & responsive design */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 w-full relative">
        <div className="absolute inset-0 z-0">
           {/* Fallback pattern matching the main page */}
           <div className="absolute inset-0 bg-slate-950/90" />
        </div>
        
        <div className="w-full max-w-xl z-10 relative mt-8 md:mt-0">
          
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Tell us how we can help</h2>
            <p className="text-slate-400">Fill out the form below to quickly summarize your issue and start a WhatsApp conversation with our support team.</p>
          </div>

          <form onSubmit={handleWhatsAppSubmit} className="space-y-6 bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
             
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">Mobile Number <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
                {/* Email Address */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">Email <span className="text-slate-500 font-normal">(Optional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              </div>

              {/* School Name (Disabled) */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">School Name</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={schoolName}
                    className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-400 cursor-not-allowed rounded-xl px-4 py-3.5 font-medium"
                  />
                  <div className="absolute right-4 top-[50%] -translate-y-[50%]">
                    <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  </div>
                </div>
              </div>

              {/* Issue Details */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 ml-1">Issue Details <span className="text-red-400">*</span></label>
                <textarea
                  required
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  rows={4}
                  placeholder="Please describe the issue you are facing..."
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full relative group overflow-hidden py-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(22,163,74,0.3)] transition-all duration-300 flex items-center justify-center gap-3 mt-4 active:scale-[0.98]"
            >
              <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 2C6.405 2 1.843 6.565 1.843 12.185c0 1.954.544 3.864 1.579 5.546L1.517 24l6.406-1.681c1.616.921 3.447 1.408 5.334 1.408 5.626 0 10.188-4.565 10.188-10.185C23.445 7.915 21.258 5.926 19.332 4 17.406 2.073 14.752 2 12.031 2zm0 18.062c-1.618 0-3.204-.434-4.595-1.259l-.329-.195-3.414.895.913-3.33-.214-.34C3.412 14.398 2.894 12.809 2.894 11.206 2.894 6.55 6.678 2.768 11.332 2.768c2.253 0 4.37.878 5.962 2.472 1.593 1.594 2.47 3.712 2.47 5.966 0 4.654-3.784 8.436-8.437 8.436zm4.61-4.993c-.252-.127-1.493-.738-1.724-.822-.232-.085-.4-.127-.568.127-.169.253-.652.822-.8.991-.148.169-.295.19-.548.064-.252-.127-1.066-.393-2.032-1.253-.752-.67-1.26-1.498-1.408-1.752-.148-.253-.015-.39.111-.516.114-.114.252-.295.379-.443.127-.148.169-.253.253-.422.085-.169.042-.317-.021-.443-.063-.127-.568-1.373-.778-1.879-.205-.494-.413-.428-.568-.436-.148-.008-.316-.008-.485-.008s-.442.063-.674.317C3.127 10.334 2.5 11.2 2.5 12.973c0 1.774 1.137 3.484 1.295 3.695.158.211 2.532 3.864 6.136 5.419.858.371 1.528.593 2.051.759.86.273 1.644.234 2.261.141.693-.105 2.128-.869 2.422-1.71.295-.841.295-1.562.205-1.71-.089-.148-.316-.233-.568-.36z" />
              </svg>
              <span>Connect on WhatsApp</span>
            </button>
            <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed px-4">
              Clicking the button will open a WhatsApp chat directly with our team, transferring the details you filled in above. 
            </p>
          </form>

        </div>
      </div>
    </div>
  );
}
