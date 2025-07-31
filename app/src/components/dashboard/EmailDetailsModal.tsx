"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  DollarSign,
  User,
  Clock,
  ExternalLink,
  FileText,
  Video,
  Star,
  AlertCircle,
  Copy,
  Bookmark,
  Send,
  Edit,
  Save,
  Download,
  Archive,
  Eye,
  ChevronRight,
  Building,
  Users,
  Target,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EmailDetailsModalProps {
  email: any;
  onClose: () => void;
}

export function EmailDetailsModal({ email, onClose }: EmailDetailsModalProps) {
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "email">("overview");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Extract data with better fallbacks
  const extractedData = email?.extracted_data || {};
  const details = {
    ...(extractedData.classification || {}),
    ...(extractedData.content_analysis || {}),
    ...(extractedData.structured_data || {}),
    ...(email?.extracted_details || {}),
  };

  const hasValue = (value: any) => {
    if (!value || value === null || value === undefined) return false;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return (
        trimmed !== "" &&
        ![
          "n/a",
          "null",
          "undefined",
          "[]",
          "not specified",
          "unknown",
        ].includes(trimmed.toLowerCase())
      );
    }
    return true;
  };

  // Smart urgency detection
  const getUrgency = () => {
    const urgency = details.urgency || email?.urgency || "normal";
    const hasDeadline =
      hasValue(details.assessment_deadline) ||
      hasValue(details.response_deadline);
    const isInterview =
      email?.type === "interview" || email?.email_type === "interview";

    if (hasDeadline || (isInterview && hasValue(details.interview_date)))
      return "high";
    return urgency;
  };

  const urgency = getUrgency();
  const emailType = email?.type || email?.email_type || "other";
  const company = email?.company || details.company || "Unknown Company";
  const position = details.position || details.job_title || email?.position;
  const summary =
    details.actionable_summary ||
    details.summary ||
    email?.summary ||
    email?.subject;

  // Animation variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", damping: 25, stiffness: 300 },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  const tabContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: 0.2 },
    },
  };

  // Copy email handler
  const handleCopyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Tab content components with new design
  const OverviewTab = () => {
    // Determine which actions should be shown based on email type and content
    const getAvailableActions = () => {
      const actions = [];

      // Add to Tracker - only for job-related emails
      const jobRelatedTypes = [
        "interview",
        "assessment",
        "offer",
        "recruiter",
        "job_opportunity",
      ];
      if (
        jobRelatedTypes.includes(emailType) ||
        (emailType === "other" && position)
      ) {
        actions.push({
          icon: Briefcase,
          label: "Add to Tracker",
          onClick: handleAddToTracker,
          primary: true,
        });
      }

      // Quick Reply - available for most emails except rejections
      if (emailType !== "rejection") {
        actions.push({
          icon: Send,
          label: "Quick Reply",
          onClick: handleQuickReply,
        });
      }

      // Add to Calendar - only for emails with dates
      const hasDate =
        hasValue(details.interview_date) ||
        hasValue(details.assessment_deadline) ||
        hasValue(details.response_deadline) ||
        emailType === "interview" ||
        emailType === "assessment";
      if (hasDate) {
        actions.push({
          icon: Calendar,
          label: "Add to Calendar",
          onClick: handleAddToCalendar,
        });
      }

      // Generate Resume - only for job opportunities with position details
      if (position && emailType !== "rejection" && emailType !== "assessment") {
        actions.push({
          icon: FileText,
          label: "Generate Resume",
          onClick: handleGenerateResume,
        });
      }

      return actions;
    };

    const availableActions = getAvailableActions();

    // Determine grid columns based on number of actions
    const getGridCols = () => {
      const count = availableActions.length;
      if (count === 1) return "grid-cols-1";
      if (count === 2) return "grid-cols-2";
      if (count === 3) return "grid-cols-2 md:grid-cols-3";
      return "grid-cols-2 md:grid-cols-4";
    };

    return (
      <motion.div
        variants={tabContentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="space-y-6"
      >
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "p-6 rounded-2xl border backdrop-blur-sm",
            urgency === "high"
              ? "bg-gradient-to-r from-red-50 to-pink-50 border-red-200"
              : "bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200",
          )}
        >
          <div className="flex items-start gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-3 rounded-xl",
                urgency === "high"
                  ? "bg-red-100 text-red-600"
                  : "bg-purple-100 text-purple-600",
              )}
            >
              {emailType === "interview" ? (
                <Video className="h-5 w-5" />
              ) : emailType === "assessment" ? (
                <FileText className="h-5 w-5" />
              ) : emailType === "offer" ? (
                <Star className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-gray-900">
                  {emailType === "interview"
                    ? "Interview Invitation"
                    : emailType === "assessment"
                      ? "Assessment Request"
                      : emailType === "offer"
                        ? "Job Offer"
                        : emailType === "rejection"
                          ? "Application Update"
                          : "Job Opportunity"}
                </h3>
                <Badge
                  variant={urgency === "high" ? "destructive" : "secondary"}
                  className={cn(
                    "text-xs font-medium",
                    urgency === "high"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-purple-100 text-purple-700 hover:bg-purple-200",
                  )}
                >
                  {urgency === "high" ? "Urgent" : "Standard"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions - only shown if there are available actions */}
        {availableActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn("grid gap-3", getGridCols())}
          >
            {availableActions.map((action, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant={action.primary ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full h-16 flex flex-col gap-1.5",
                    action.primary
                      ? "bg-purple-600 hover:bg-purple-700 text-white border-0"
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200",
                  )}
                  onClick={action.onClick}
                >
                  <action.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{action.label}</span>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Information card removed - contact now shown in header */}

          {/* Position Details */}
          {position && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-purple-600" />
                Position Details
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Role</p>
                  <p className="text-sm font-medium text-gray-900">
                    {position}
                  </p>
                </div>
                {hasValue(details.location) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900">
                        {details.location}
                      </p>
                    </div>
                  </div>
                )}
                {hasValue(details.salary_range) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Salary Range</p>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900">
                        {details.salary_range}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Interview/Assessment Details */}
        {(emailType === "interview" || emailType === "assessment") && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-5 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200"
          >
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {emailType === "interview" ? (
                <>
                  <Video className="h-4 w-4 text-purple-600" />
                  Interview Details
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 text-purple-600" />
                  Assessment Details
                </>
              )}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasValue(
                details.interview_date || details.assessment_deadline,
              ) && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.interview_date || details.assessment_deadline}
                    </p>
                  </div>
                </div>
              )}
              {hasValue(details.interview_time) && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Time</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.interview_time}
                    </p>
                  </div>
                </div>
              )}
              {hasValue(details.interview_platform) && (
                <div className="flex items-start gap-3">
                  <Video className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Platform</p>
                    <p className="text-sm font-medium text-gray-900">
                      {details.interview_platform}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Action Items */}
        {details.action_items && details.action_items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Next Steps
            </h4>
            <div className="space-y-2">
              {details.action_items
                .slice(0, 3)
                .map((item: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                        item.priority === "high"
                          ? "bg-red-500"
                          : "bg-purple-500",
                      )}
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      {item.task}
                    </span>
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  const EmailTab = () => {
    const getEmailContent = () => {
      // Import content cleaner dynamically to avoid SSR issues
      const { cleanEmailForDisplay } = require('@/lib/utils/content-cleaner');
      
      // Clean and format the email content
      const { content, links } = cleanEmailForDisplay({
        body_html: email?.body_html,
        body_text: email?.body_text,
        subject: email?.subject
      });

      if (content && content.trim().length > 10) {
        return { content, links };
      }

      // Fallback to other content sources
      const contentSources = [
        email?.content,
        email?.body,
        email?.snippet,
        details.full_content,
        extractedData?.raw_content,
        email?.raw_content,
      ];

      for (const fallbackContent of contentSources) {
        if (
          fallbackContent &&
          typeof fallbackContent === "string" &&
          fallbackContent.trim().length > 10
        ) {
          return { content: fallbackContent.trim(), links: [] };
        }
      }

      return { 
        content: `Email content not available. This may be due to privacy settings or data structure changes.`,
        links: []
      };
    };

    const { content: emailContent, links: emailLinks } = getEmailContent();

    return (
      <motion.div
        variants={tabContentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="space-y-6"
      >
        {/* Email Headers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gray-50 rounded-xl"
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">From</p>
              <p className="font-medium text-gray-900">
                {email?.sender || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Date</p>
              <p className="font-medium text-gray-900">
                {email?.timestamp || email?.received_at || email?.email_date
                  ? new Date(
                      email?.timestamp ||
                        email?.received_at ||
                        email?.email_date,
                    ).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 mb-1">Subject</p>
              <p className="font-medium text-gray-900">{email?.subject}</p>
            </div>
          </div>
        </motion.div>

        {/* Email Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
        >
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Email Content
            </h3>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="prose prose-sm max-w-none">
              {emailContent.split("\n").map((line, index) => (
                <p key={index} className="mb-3 text-gray-700 leading-relaxed">
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
            
            {/* Display extracted links if any */}
            {emailLinks && emailLinks.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Links in this email</h4>
                <div className="space-y-2">
                  {emailLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {link.text || link.url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Email Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3"
        >
          <Button
            variant="outline"
            size="sm"
            className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
            onClick={() => navigator.clipboard.writeText(emailContent)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Content
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
            disabled
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  const NotesTab = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-gray-50 rounded-xl"
      >
        <label className="text-sm font-semibold text-gray-900 mb-3 block">
          Your Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this opportunity, interview preparation, follow-up actions..."
          className="w-full h-40 p-4 border border-gray-200 rounded-lg resize-none bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3"
      >
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white border-0"
          onClick={handleSaveNotes}
          disabled={isSavingNotes}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSavingNotes ? "Saving..." : "Save Notes"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
          onClick={handleExportPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </motion.div>
    </motion.div>
  );

  // Handler functions
  const handleSaveNotes = async () => {
    if (!notes.trim()) return;
    setIsSavingNotes(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSavingNotes(false);
  };

  const handleExportPDF = () => {
    console.log("Exporting email details to PDF");
  };

  const handleAddToTracker = () => {
    console.log("Adding to job tracker");
  };

  const handleQuickReply = () => {
    console.log("Opening quick reply");
  };

  const handleAddToCalendar = () => {
    console.log("Adding to calendar");
  };

  const handleGenerateResume = () => {
    console.log("Generating resume");
  };

  return (
    <AnimatePresence>
      {email && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center"
                  >
                    <Building className="h-6 w-6 text-purple-600" />
                  </motion.div>
                  <div>
                    <h2 className="font-bold text-xl text-gray-900">
                      {company}
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {position || "Position not specified"}
                    </p>
                    {(details.recruiter_email || email?.sender_email) && (
                      <p className="text-xs text-purple-700 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {details.recruiter_email || email?.sender_email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 hover:bg-white/80 rounded-lg transition-colors"
                  >
                    <Bookmark className="h-5 w-5 text-gray-600" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="p-2 hover:bg-white/80 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-600" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 bg-gray-50/50">
              <div className="flex">
                {[
                  { id: "overview", label: "Overview", icon: Eye },
                  { id: "email", label: "Full Email", icon: Mail },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    whileHover={{ y: -1 }}
                    whileTap={{ y: 0 }}
                    className={cn(
                      "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all",
                      activeTab === tab.id
                        ? "border-purple-600 text-purple-600 bg-white"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] bg-gray-50/30">
              <AnimatePresence mode="wait">
                {activeTab === "overview" && <OverviewTab key="overview" />}
                {activeTab === "email" && <EmailTab key="email" />}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
